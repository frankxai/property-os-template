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
    this.approvedEvidence = new Map();
    this.agentRuns = new Map();
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

  async getMission(tenantId, missionId) {
    const mission = this.missions.get(missionId);
    return mission?.tenantId === tenantId ? structuredClone(mission) : undefined;
  }

  async recordApprovedEvidence(evidence) {
    return this.serialized(() => {
      this.approvedEvidence.set(`${evidence.tenantId}:${evidence.ref}`, structuredClone(evidence));
      return evidence;
    });
  }

  async getApprovedEvidence(tenantId, refs, propertyId) {
    return refs.map((ref) => {
      const evidence = this.approvedEvidence.get(`${tenantId}:${ref}`);
      if (!evidence) failClosed(`Approved evidence was not found: ${ref}.`, "APPROVED_EVIDENCE_NOT_FOUND");
      if (evidence.propertyId && evidence.propertyId !== propertyId) {
        failClosed(`Approved evidence belongs to a different property: ${ref}.`, "EVIDENCE_PROPERTY_MISMATCH");
      }
      return {
        ref: evidence.ref,
        excerpt: evidence.excerpt,
        contentHash: evidence.contentHash,
        sourceVersionHash: evidence.sourceVersionHash,
        approvalStatus: "approved"
      };
    });
  }

  async createAgentRun(run) {
    return this.serialized(() => {
      const mission = this.missions.get(run.missionId);
      if (!mission || mission.tenantId !== run.tenantId) failClosed("Agent mission not found in this tenant.", "MISSION_NOT_FOUND");
      if (mission.role !== run.role) failClosed("Agent run role does not match its mission.", "MISSION_ROLE_MISMATCH");
      mission.status = "owner-review";
      mission.updatedAt = run.createdAt;
      this.agentRuns.set(run.id, structuredClone(run));
      return run;
    });
  }

  async recordAgentRunReview({ context, runId, decision, feedback, now }) {
    return this.serialized(() => {
      const run = this.agentRuns.get(runId);
      if (!run || run.tenantId !== context.tenantId) failClosed("Agent run not found in this tenant.", "AGENT_RUN_NOT_FOUND");
      if (run.status !== "owner-review") failClosed(`Agent run is already ${run.status}.`, "AGENT_RUN_ALREADY_REVIEWED");
      const statusByDecision = {
        "accept-draft": "accepted",
        "request-revision": "revision-requested",
        "reject-draft": "rejected"
      };
      const status = statusByDecision[decision];
      if (!status) failClosed("Agent run decision is not supported.", "INVALID_AGENT_RUN_DECISION");
      run.status = status;
      run.ownerDecision = decision;
      run.reviewFeedback = feedback;
      run.reviewedBy = context.actorId;
      run.reviewedAt = now.toISOString();
      const mission = this.missions.get(run.missionId);
      if (mission) {
        mission.status = decision === "accept-draft" ? "verified" : decision === "request-revision" ? "planned" : "stopped";
        mission.updatedAt = run.reviewedAt;
      }
      return {
        runId,
        missionId: run.missionId,
        decision,
        status,
        contentApplied: false,
        externalActionsPerformed: [],
        reviewedAt: run.reviewedAt
      };
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
               to_regclass('public.approved_evidence') as evidence,
               to_regclass('public.agent_runs') as runs,
               to_regclass('public.resource_versions') as versions,
               to_regclass('public.controlled_transitions') as transitions
      `;
      const ready = Boolean(rows[0]?.missions && rows[0]?.evidence && rows[0]?.runs && rows[0]?.versions && rows[0]?.transitions);
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

  async getMission(tenantId, missionId) {
    return this.tenantTransaction(tenantId, async (tx) => {
      const rows = await tx`
        select id, organization_id, role, property_slug, objective, success_metric, status, authority,
               stages, owner_action, created_at, updated_at
        from agent_missions
        where id = ${missionId} and organization_id = ${tenantId}
      `;
      const mission = rows[0];
      if (!mission) return undefined;
      return {
        id: mission.id,
        tenantId: mission.organization_id,
        role: mission.role,
        propertyId: mission.property_slug,
        objective: mission.objective,
        successMetric: mission.success_metric,
        status: mission.status,
        authority: mission.authority,
        stages: mission.stages,
        ownerAction: mission.owner_action,
        createdAt: mission.created_at.toISOString(),
        updatedAt: mission.updated_at.toISOString()
      };
    });
  }

  async recordApprovedEvidence(evidence) {
    return this.tenantTransaction(evidence.tenantId, async (tx) => {
      await tx`
        insert into approved_evidence (
          organization_id, ref, property_slug, excerpt, source_type, source_version_hash,
          content_hash, approved_by, approved_at, updated_at
        ) values (
          ${evidence.tenantId}, ${evidence.ref}, ${evidence.propertyId}, ${evidence.excerpt},
          ${evidence.sourceType}, ${evidence.sourceVersionHash}, ${evidence.contentHash},
          ${evidence.approvedBy}, ${evidence.approvedAt}, ${evidence.approvedAt}
        )
        on conflict (organization_id, ref) do update set
          property_slug = excluded.property_slug,
          excerpt = excluded.excerpt,
          source_type = excluded.source_type,
          source_version_hash = excluded.source_version_hash,
          content_hash = excluded.content_hash,
          approved_by = excluded.approved_by,
          approved_at = excluded.approved_at,
          updated_at = excluded.updated_at
      `;
      await this.insertAudit(tx, {
        tenantId: evidence.tenantId,
        actorId: evidence.approvedBy,
        eventType: "approved_evidence.recorded",
        subjectType: "approved_evidence",
        subjectId: evidence.ref,
        metadata: {
          propertyId: evidence.propertyId,
          sourceType: evidence.sourceType,
          sourceVersionHash: evidence.sourceVersionHash,
          contentHash: evidence.contentHash,
          externalActionsPerformed: []
        }
      });
      return evidence;
    });
  }

  async getApprovedEvidence(tenantId, refs, propertyId) {
    return this.tenantTransaction(tenantId, async (tx) => {
      const evidence = [];
      for (const ref of refs) {
        const rows = await tx`
          select ref, property_slug, excerpt, content_hash, source_version_hash from approved_evidence
          where organization_id = ${tenantId} and ref = ${ref}
        `;
        if (!rows[0]) failClosed(`Approved evidence was not found: ${ref}.`, "APPROVED_EVIDENCE_NOT_FOUND");
        if (rows[0].property_slug && rows[0].property_slug !== propertyId) {
          failClosed(`Approved evidence belongs to a different property: ${ref}.`, "EVIDENCE_PROPERTY_MISMATCH");
        }
        evidence.push({
          ref: rows[0].ref,
          excerpt: rows[0].excerpt,
          contentHash: rows[0].content_hash,
          sourceVersionHash: rows[0].source_version_hash,
          approvalStatus: "approved"
        });
      }
      return evidence;
    });
  }

  async createAgentRun(run) {
    return this.tenantTransaction(run.tenantId, async (tx) => {
      const missions = await tx`
        select id, role from agent_missions
        where id = ${run.missionId} and organization_id = ${run.tenantId}
        for update
      `;
      if (!missions[0]) failClosed("Agent mission not found in this tenant.", "MISSION_NOT_FOUND");
      if (missions[0].role !== run.role) failClosed("Agent run role does not match its mission.", "MISSION_ROLE_MISMATCH");
      await tx`
        insert into agent_runs (
          id, organization_id, mission_id, property_slug, role, output_type, status, authority,
          model_alias, prompt_version, evidence_refs, output, output_hash, input_tokens,
          output_tokens, total_tokens, latency_ms, risk_level, created_by, created_at
        ) values (
          ${run.id}, ${run.tenantId}, ${run.missionId}, ${run.propertyId}, ${run.role}, ${run.outputType},
          ${run.status}, ${run.authority}, ${run.modelAlias}, ${run.promptVersion}, ${tx.json(run.evidenceSnapshot)},
          ${tx.json(run.output)}, ${run.outputHash}, ${run.usage.inputTokens}, ${run.usage.outputTokens},
          ${run.usage.totalTokens}, ${run.latencyMs}, ${run.riskLevel}, ${run.createdBy}, ${run.createdAt}
        )
      `;
      await tx`
        update agent_missions set status = 'owner-review', updated_at = ${run.createdAt}
        where id = ${run.missionId} and organization_id = ${run.tenantId}
      `;
      await this.insertAudit(tx, {
        tenantId: run.tenantId,
        actorId: run.createdBy,
        eventType: "agent_run.created",
        subjectType: "agent_run",
        subjectId: run.id,
        metadata: {
          missionId: run.missionId,
          role: run.role,
          outputType: run.outputType,
          modelAlias: run.modelAlias,
          promptVersion: run.promptVersion,
          evidenceSnapshot: run.evidenceSnapshot,
          outputHash: run.outputHash,
          riskLevel: run.riskLevel,
          latencyMs: run.latencyMs,
          usage: run.usage,
          contentApplied: false,
          externalActionsPerformed: []
        }
      });
      return run;
    });
  }

  async recordAgentRunReview({ context, runId, decision, feedback, now }) {
    return this.tenantTransaction(context.tenantId, async (tx) => {
      const rows = await tx`
        select id, mission_id, status from agent_runs
        where id = ${runId} and organization_id = ${context.tenantId}
        for update
      `;
      const run = rows[0];
      if (!run) failClosed("Agent run not found in this tenant.", "AGENT_RUN_NOT_FOUND");
      if (run.status !== "owner-review") failClosed(`Agent run is already ${run.status}.`, "AGENT_RUN_ALREADY_REVIEWED");
      const statusByDecision = {
        "accept-draft": "accepted",
        "request-revision": "revision-requested",
        "reject-draft": "rejected"
      };
      const missionStatusByDecision = {
        "accept-draft": "verified",
        "request-revision": "planned",
        "reject-draft": "stopped"
      };
      const status = statusByDecision[decision];
      if (!status) failClosed("Agent run decision is not supported.", "INVALID_AGENT_RUN_DECISION");
      const reviewedAt = now.toISOString();
      await tx`
        update agent_runs set status = ${status}, owner_decision = ${decision}, review_feedback = ${feedback},
          reviewed_by = ${context.actorId}, reviewed_at = ${reviewedAt}
        where id = ${runId} and organization_id = ${context.tenantId}
      `;
      await tx`
        update agent_missions set status = ${missionStatusByDecision[decision]}, updated_at = ${reviewedAt}
        where id = ${run.mission_id} and organization_id = ${context.tenantId}
      `;
      await this.insertAudit(tx, {
        tenantId: context.tenantId,
        actorId: context.actorId,
        eventType: "agent_run.reviewed",
        subjectType: "agent_run",
        subjectId: runId,
        metadata: { missionId: run.mission_id, decision, status, contentApplied: false, externalActionsPerformed: [] }
      });
      return {
        runId,
        missionId: run.mission_id,
        decision,
        status,
        contentApplied: false,
        externalActionsPerformed: [],
        reviewedAt
      };
    });
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
