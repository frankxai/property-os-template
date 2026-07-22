import { createHash, randomUUID } from "node:crypto";
import postgres from "postgres";

const POLICY_VERSION = "property-os-authority.v2";
const INTERNAL_SCOPE = "property:apply:internal";

function failClosed(message, code = "POLICY_DENIED") {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function makeId(prefix) {
  return `${prefix}-${randomUUID()}`;
}

function buildReceipt(proposal, context, issuedAt, receiptTtlMs) {
  return {
    id: makeId("receipt"),
    proposalId: proposal.id,
    tenantId: proposal.tenantId,
    actorId: context.actorId,
    actorRole: context.actorRole,
    operation: proposal.operation,
    resourceId: proposal.resourceId,
    baseVersionHash: proposal.baseVersionHash,
    payloadHash: proposal.payloadHash,
    scope: [INTERNAL_SCOPE],
    policyVersion: POLICY_VERSION,
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.getTime() + receiptTtlMs).toISOString(),
    status: "active"
  };
}

function validateTransition({ proposal, receipt, context, now, currentVersion }) {
  if (!proposal || !receipt) failClosed("Proposal or approval receipt was not found.", "TRANSITION_NOT_FOUND");
  if (proposal.tenantId !== context.tenantId || receipt.tenantId !== context.tenantId) failClosed("Cross-tenant transition denied.", "TENANT_MISMATCH");
  if (proposal.status !== "approved") failClosed(`Proposal is ${proposal.status}.`, "PROPOSAL_NOT_APPROVED");
  if (
    proposal.id !== receipt.proposalId ||
    proposal.operation !== receipt.operation ||
    proposal.resourceId !== receipt.resourceId ||
    proposal.baseVersionHash !== receipt.baseVersionHash ||
    proposal.payloadHash !== receipt.payloadHash
  ) {
    failClosed("Proposal and approval receipt binding failed.", "RECEIPT_BINDING_FAILED");
  }
  if (receipt.actorId !== context.actorId) failClosed("Approval receipt belongs to a different actor.", "ACTOR_MISMATCH");
  if (receipt.policyVersion !== POLICY_VERSION) failClosed("Approval receipt policy version is not accepted.", "POLICY_VERSION_MISMATCH");
  if (!receipt.scope.includes(INTERNAL_SCOPE)) failClosed("Approval receipt does not grant internal apply scope.", "RECEIPT_SCOPE_MISMATCH");
  if (receipt.status !== "active") failClosed(`Approval receipt is ${receipt.status}.`, "RECEIPT_NOT_ACTIVE");
  if (new Date(receipt.expiresAt).getTime() <= now.getTime()) failClosed("Approval receipt expired.", "RECEIPT_EXPIRED");
  if (currentVersion !== proposal.baseVersionHash) failClosed("Target state changed after approval.", "STALE_BASE_VERSION");
}

function transitionResult({ transitionId, proposal, receiptId, newVersionHash }) {
  return {
    transitionId,
    proposalId: proposal.id,
    approvalReceiptId: receiptId,
    contentApplied: true,
    operation: proposal.operation,
    resourceId: proposal.resourceId,
    newVersionHash,
    auditEvent: "controlled_transition.applied",
    undo: { supported: true, mode: "internal-accepted-state", previousVersionHash: proposal.baseVersionHash },
    replayed: false,
    externalActionsPerformed: []
  };
}

function replayOrConflict(existing, proposalId, receiptId) {
  if (!existing) return undefined;
  if (existing.proposalId !== proposalId || existing.receiptId !== receiptId) {
    failClosed("Idempotency key was already used for a different transition.", "IDEMPOTENCY_CONFLICT");
  }
  return { ...existing.result, replayed: true };
}

export class MemoryPropertyOsRepository {
  constructor() {
    this.kind = "memory";
    this.missions = new Map();
    this.proposals = new Map();
    this.receipts = new Map();
    this.transitions = new Map();
    this.currentVersions = new Map();
    this.queue = Promise.resolve();
  }

  async serialized(operation) {
    const previous = this.queue;
    let release;
    this.queue = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  async health() {
    return { ready: true, adapter: this.kind, durable: false };
  }

  async createMission(mission) {
    return this.serialized(() => {
      this.missions.set(mission.id, structuredClone(mission));
      return mission;
    });
  }

  async proposeTransition(proposal) {
    return this.serialized(() => {
      const stateKey = `${proposal.tenantId}:${proposal.resourceId}`;
      const currentVersion = this.currentVersions.get(stateKey);
      if (currentVersion && currentVersion !== proposal.baseVersionHash) failClosed("The proposal base version is stale.", "STALE_BASE_VERSION");
      this.currentVersions.set(stateKey, proposal.baseVersionHash);
      this.proposals.set(proposal.id, structuredClone(proposal));
      return proposal;
    });
  }

  async recordDecision({ context, proposalId, decision, now, receiptTtlMs }) {
    return this.serialized(() => {
      const proposal = this.proposals.get(proposalId);
      if (!proposal || proposal.tenantId !== context.tenantId) failClosed("Proposal not found in this tenant.", "PROPOSAL_NOT_FOUND");
      if (proposal.status !== "pending") failClosed(`Proposal is already ${proposal.status}.`, "PROPOSAL_NOT_PENDING");
      if (decision === "reject") {
        proposal.status = "rejected";
        return { proposalId, decision: "rejected", contentApplied: false, receiptIssued: false };
      }
      if (decision !== "approve") failClosed("Decision must be approve or reject.", "INVALID_DECISION");
      proposal.status = "approved";
      const receipt = buildReceipt(proposal, context, now, receiptTtlMs);
      this.receipts.set(receipt.id, receipt);
      return { proposalId, decision: "approved", contentApplied: false, receiptIssued: true, approvalReceipt: receipt };
    });
  }

  async applyTransition({ context, proposalId, receiptId, idempotencyKey, now }) {
    return this.serialized(() => {
      const transitionKey = `${context.tenantId}:${idempotencyKey}`;
      const replay = replayOrConflict(this.transitions.get(transitionKey), proposalId, receiptId);
      if (replay) return replay;
      const proposal = this.proposals.get(proposalId);
      const receipt = this.receipts.get(receiptId);
      const stateKey = `${context.tenantId}:${proposal?.resourceId ?? "missing"}`;
      validateTransition({ proposal, receipt, context, now, currentVersion: this.currentVersions.get(stateKey) });
      const transitionId = makeId("transition");
      const newVersionHash = digest(`${proposal.baseVersionHash}:${proposal.payloadHash}:${transitionId}`);
      const result = transitionResult({ transitionId, proposal, receiptId, newVersionHash });
      this.currentVersions.set(stateKey, newVersionHash);
      proposal.status = "applied";
      receipt.status = "consumed";
      this.transitions.set(transitionKey, { proposalId, receiptId, result });
      return result;
    });
  }
}

function mapProposal(row) {
  if (!row) return undefined;
  return {
    id: row.id,
    tenantId: row.organization_id,
    operation: row.operation,
    resourceId: row.resource_id,
    baseVersionHash: row.base_version_hash,
    payloadHash: row.payload_hash,
    summary: row.summary,
    createdBy: row.created_by,
    status: row.status,
    createdAt: row.created_at.toISOString()
  };
}

function mapReceipt(row) {
  if (!row) return undefined;
  return {
    id: row.id,
    proposalId: row.proposal_id,
    tenantId: row.organization_id,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    operation: row.operation,
    resourceId: row.resource_id,
    baseVersionHash: row.base_version_hash,
    payloadHash: row.payload_hash,
    scope: row.scopes,
    policyVersion: row.policy_version,
    issuedAt: row.issued_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    status: row.status
  };
}

function mapTransition(row) {
  if (!row) return undefined;
  const result = {
    transitionId: row.id,
    proposalId: row.proposal_id,
    approvalReceiptId: row.approval_receipt_id,
    contentApplied: true,
    operation: row.operation,
    resourceId: row.resource_id,
    newVersionHash: row.new_version_hash,
    auditEvent: "controlled_transition.applied",
    undo: row.undo_metadata,
    replayed: false,
    externalActionsPerformed: []
  };
  return { proposalId: row.proposal_id, receiptId: row.approval_receipt_id, result };
}

export class PostgresPropertyOsRepository {
  constructor(databaseUrl, options = {}) {
    if (!databaseUrl) throw new Error("DATABASE_URL is required for PostgresPropertyOsRepository.");
    this.kind = "postgres";
    this.sql = options.sql ?? postgres(databaseUrl, {
      max: Number(options.maxConnections ?? 5),
      idle_timeout: 20,
      connect_timeout: 10,
      max_lifetime: 60 * 30
    });
  }

  async tenantTransaction(tenantId, operation) {
    return this.sql.begin(async (tx) => {
      await tx`select set_config('property_os.organization_id', ${tenantId}, true)`;
      return operation(tx);
    });
  }

  async insertAudit(tx, { tenantId, actorId, eventType, subjectType, subjectId, metadata }) {
    await tx`
      insert into audit_events (id, organization_id, actor, event_type, subject_type, subject_id, metadata)
      values (${makeId("audit")}, ${tenantId}, ${actorId}, ${eventType}, ${subjectType}, ${subjectId}, ${tx.json(metadata)})
    `;
  }

  async health() {
    try {
      const rows = await this.sql`
        select to_regclass('public.agent_missions') as missions,
               to_regclass('public.resource_versions') as versions,
               to_regclass('public.controlled_transitions') as transitions
      `;
      const ready = Boolean(rows[0]?.missions && rows[0]?.versions && rows[0]?.transitions);
      return { ready, adapter: this.kind, durable: true, schema: ready ? "ready" : "missing" };
    } catch {
      return { ready: false, adapter: this.kind, durable: true, schema: "unreachable" };
    }
  }

  async createMission(mission) {
    await this.tenantTransaction(mission.tenantId, async (tx) => {
      await tx`
        insert into agent_missions (
          id, organization_id, role, property_slug, objective, success_metric,
          status, authority, stages, owner_action, created_at, updated_at
        ) values (
          ${mission.id}, ${mission.tenantId}, ${mission.role}, ${mission.propertyId}, ${mission.objective},
          ${mission.successMetric}, ${mission.status}, ${mission.authority}, ${tx.json(mission.stages)},
          ${mission.ownerAction}, ${mission.createdAt}, ${mission.createdAt}
        )
      `;
      await this.insertAudit(tx, {
        tenantId: mission.tenantId,
        actorId: mission.createdBy,
        eventType: "agent_mission.created",
        subjectType: "agent_mission",
        subjectId: mission.id,
        metadata: { role: mission.role, propertyId: mission.propertyId, successMetric: mission.successMetric }
      });
    });
    return mission;
  }

  async proposeTransition(proposal) {
    await this.tenantTransaction(proposal.tenantId, async (tx) => {
      await tx`
        insert into resource_versions (organization_id, resource_id, version_hash)
        values (${proposal.tenantId}, ${proposal.resourceId}, ${proposal.baseVersionHash})
        on conflict (organization_id, resource_id) do nothing
      `;
      const versions = await tx`
        select version_hash from resource_versions
        where organization_id = ${proposal.tenantId} and resource_id = ${proposal.resourceId}
        for update
      `;
      if (versions[0]?.version_hash !== proposal.baseVersionHash) failClosed("The proposal base version is stale.", "STALE_BASE_VERSION");
      await tx`
        insert into transition_proposals (
          id, organization_id, operation, resource_id, base_version_hash, payload_hash,
          summary, status, created_by, created_at
        ) values (
          ${proposal.id}, ${proposal.tenantId}, ${proposal.operation}, ${proposal.resourceId},
          ${proposal.baseVersionHash}, ${proposal.payloadHash}, ${proposal.summary}, ${proposal.status},
          ${proposal.createdBy}, ${proposal.createdAt}
        )
      `;
      await this.insertAudit(tx, {
        tenantId: proposal.tenantId,
        actorId: proposal.createdBy,
        eventType: "controlled_transition.proposed",
        subjectType: "transition_proposal",
        subjectId: proposal.id,
        metadata: { operation: proposal.operation, resourceId: proposal.resourceId, missionId: proposal.createdByRunId }
      });
    });
    return proposal;
  }

  async recordDecision({ context, proposalId, decision, now, receiptTtlMs }) {
    return this.tenantTransaction(context.tenantId, async (tx) => {
      const rows = await tx`
        select * from transition_proposals
        where id = ${proposalId} and organization_id = ${context.tenantId}
        for update
      `;
      const proposal = mapProposal(rows[0]);
      if (!proposal) failClosed("Proposal not found in this tenant.", "PROPOSAL_NOT_FOUND");
      if (proposal.status !== "pending") failClosed(`Proposal is already ${proposal.status}.`, "PROPOSAL_NOT_PENDING");
      if (decision === "reject") {
        await tx`update transition_proposals set status = 'rejected' where id = ${proposalId}`;
        await this.insertAudit(tx, {
          tenantId: context.tenantId, actorId: context.actorId, eventType: "controlled_transition.rejected",
          subjectType: "transition_proposal", subjectId: proposalId, metadata: { contentApplied: false }
        });
        return { proposalId, decision: "rejected", contentApplied: false, receiptIssued: false };
      }
      if (decision !== "approve") failClosed("Decision must be approve or reject.", "INVALID_DECISION");
      const receipt = buildReceipt(proposal, context, now, receiptTtlMs);
      await tx`update transition_proposals set status = 'approved' where id = ${proposalId}`;
      await tx`
        insert into approval_receipts (
          id, proposal_id, organization_id, actor_id, actor_role, operation, resource_id,
          base_version_hash, payload_hash, policy_version, scopes, status, issued_at, expires_at
        ) values (
          ${receipt.id}, ${receipt.proposalId}, ${receipt.tenantId}, ${receipt.actorId}, ${receipt.actorRole},
          ${receipt.operation}, ${receipt.resourceId}, ${receipt.baseVersionHash}, ${receipt.payloadHash},
          ${receipt.policyVersion}, ${tx.json(receipt.scope)}, ${receipt.status}, ${receipt.issuedAt}, ${receipt.expiresAt}
        )
      `;
      await this.insertAudit(tx, {
        tenantId: context.tenantId, actorId: context.actorId, eventType: "controlled_transition.approved",
        subjectType: "approval_receipt", subjectId: receipt.id,
        metadata: { proposalId, expiresAt: receipt.expiresAt, contentApplied: false }
      });
      return { proposalId, decision: "approved", contentApplied: false, receiptIssued: true, approvalReceipt: receipt };
    });
  }

  async applyTransition({ context, proposalId, receiptId, idempotencyKey, now }) {
    return this.tenantTransaction(context.tenantId, async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtextextended(${`${context.tenantId}:${idempotencyKey}`}, 0))`;
      const existingRows = await tx`
        select * from controlled_transitions
        where organization_id = ${context.tenantId} and idempotency_key = ${idempotencyKey}
      `;
      const replay = replayOrConflict(mapTransition(existingRows[0]), proposalId, receiptId);
      if (replay) return replay;

      const proposalRows = await tx`
        select * from transition_proposals
        where id = ${proposalId} and organization_id = ${context.tenantId}
        for update
      `;
      const receiptRows = await tx`
        select * from approval_receipts
        where id = ${receiptId} and organization_id = ${context.tenantId}
        for update
      `;
      const proposal = mapProposal(proposalRows[0]);
      const receipt = mapReceipt(receiptRows[0]);
      const versionRows = proposal ? await tx`
        select version_hash from resource_versions
        where organization_id = ${context.tenantId} and resource_id = ${proposal.resourceId}
        for update
      ` : [];
      validateTransition({ proposal, receipt, context, now, currentVersion: versionRows[0]?.version_hash });

      const transitionId = makeId("transition");
      const newVersionHash = digest(`${proposal.baseVersionHash}:${proposal.payloadHash}:${transitionId}`);
      const result = transitionResult({ transitionId, proposal, receiptId, newVersionHash });
      await tx`
        update resource_versions set version_hash = ${newVersionHash}, updated_at = now()
        where organization_id = ${context.tenantId} and resource_id = ${proposal.resourceId}
      `;
      await tx`update transition_proposals set status = 'applied' where id = ${proposalId}`;
      await tx`update approval_receipts set status = 'consumed', consumed_at = now() where id = ${receiptId}`;
      await tx`
        insert into controlled_transitions (
          id, organization_id, proposal_id, approval_receipt_id, idempotency_key, operation,
          resource_id, previous_version_hash, new_version_hash, undo_metadata, applied_by
        ) values (
          ${transitionId}, ${context.tenantId}, ${proposalId}, ${receiptId}, ${idempotencyKey},
          ${proposal.operation}, ${proposal.resourceId}, ${proposal.baseVersionHash}, ${newVersionHash},
          ${tx.json(result.undo)}, ${context.actorId}
        )
      `;
      await this.insertAudit(tx, {
        tenantId: context.tenantId, actorId: context.actorId, eventType: "controlled_transition.applied",
        subjectType: "controlled_transition", subjectId: transitionId,
        metadata: { proposalId, receiptId, resourceId: proposal.resourceId, previousVersionHash: proposal.baseVersionHash, newVersionHash }
      });
      return result;
    });
  }

  async close() {
    await this.sql.end({ timeout: 5 });
  }
}

export function createRepositoryFromEnv(env = process.env) {
  return env.DATABASE_URL ? new PostgresPropertyOsRepository(env.DATABASE_URL) : new MemoryPropertyOsRepository();
}

export { INTERNAL_SCOPE, POLICY_VERSION };
