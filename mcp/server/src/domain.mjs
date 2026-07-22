import { createHash, randomUUID } from "node:crypto";
import { assertAgentSafeInput, createAgentRuntimeFromEnv } from "./agent-runtime.mjs";
import { MemoryPropertyOsRepository } from "./repository.mjs";

const EXTERNAL_ACTIONS = new Set([
  "publish_listing",
  "send_renter_message",
  "dispatch_vendor",
  "approve_applicant",
  "disclose_access_secret",
  "change_price_or_availability"
]);

export const blockedV1Tools = [...EXTERNAL_ACTIONS];

export const agentProfiles = [
  { id: "property-steward", mandate: "Maintain approved property truth and owner decision queues." },
  { id: "listing-ops", mandate: "Prepare channel-ready drafts and expose missing facts." },
  { id: "inquiry-concierge", mandate: "Draft factual inquiry replies without commitments." },
  { id: "renter-guide", mandate: "Answer from approved renter knowledge only." },
  { id: "maintenance-triage", mandate: "Classify urgency and route owner action without dispatch promises." },
  { id: "vacancy-pipeline", mandate: "Surface vacancy risk and next approved acquisition actions." },
  { id: "renovation-planner", mandate: "Prepare scoped renovation options, dependencies, and review gates." },
  { id: "compliance-reviewer", mandate: "Block unsafe privacy, legal, selection, and publication behavior." },
  { id: "visual-qa", mandate: "Verify desktop, mobile, accessibility, property media, and premium quality." },
  { id: "implementation-lead", mandate: "Run install proof, production gates, and partner handoff." }
];

export const sampleResources = {
  "property://profile/sample-property": {
    name: "Sample Property",
    status: "owner-review",
    note: "Public-safe sample profile. Replace it with tenant-scoped approved data."
  },
  "property://knowledge/sample-property": {
    articles: ["Approved facts only.", "Access, identity, payment, and private owner data remain outside public resources."]
  },
  "property://listing-drafts/sample-property": {
    channels: ["own-website", "kleinanzeigen", "immoscout24", "immowelt"],
    publicationMode: "dry-run-only"
  },
  "property://contracts/authority": {
    policyVersion: "property-os-authority.v2",
    lifecycle: ["observe", "draft", "review", "owner-decision", "controlled-apply", "verify"],
    blockedV1Tools,
    rule: "An approval decision is not an external action. Publishing, messaging, dispatch, pricing, availability, and applicant decisions remain blocked."
  },
  "property://contracts/agent-team": {
    topology: "owner-led-hierarchical",
    profiles: agentProfiles,
    sharedExitGate: "Every mission ends with evidence, owner action, and keep/change/stop."
  },
  "property://contracts/success-metrics": {
    owner: ["weekly admin minutes", "approval queue age", "urgent acknowledgement time", "vacancy lead time"],
    renter: ["self-service resolution rate", "first-response time", "portal task completion", "escalation accuracy"],
    implementer: ["time to first property", "install proof score", "production gate pass rate", "support hours per install"]
  },
  "property://implementation-readiness/sample-org": {
    posture: "control-plane-ready",
    requiredProof: ["authenticated transport", "tenant isolation", "approval receipt tests", "portal install proof", "visual QA", "runtime database proof"],
    blockedV1Tools
  }
};

function clean(value, maxLength = 1200) {
  if (typeof value !== "string") return "";
  return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function makeId(prefix) {
  return `${prefix}-${randomUUID()}`;
}

function failClosed(message, code = "POLICY_DENIED") {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function contextFrom(extra = {}) {
  const auth = extra.authInfo ?? {};
  const details = auth.extra ?? {};
  return {
    tenantId: clean(details.tenantId, 120) || "sample-org",
    actorId: clean(details.actorId, 120) || "local-owner",
    actorRole: clean(details.actorRole, 40) || "owner",
    scopes: Array.isArray(auth.scopes)
      ? auth.scopes
      : ["property:read", "property:draft", "property:approve", "property:apply:internal"]
  };
}

function requireScope(context, scope) {
  if (!context.scopes.includes(scope)) {
    failClosed(`Missing required scope: ${scope}`, "INSUFFICIENT_SCOPE");
  }
}

function requireOwner(context) {
  if (!new Set(["owner", "operator"]).has(context.actorRole)) {
    failClosed("Owner or operator authority is required.", "OWNER_AUTHORITY_REQUIRED");
  }
}

function assertTenant(context, requestedTenantId) {
  const tenantId = clean(requestedTenantId, 120) || context.tenantId;
  if (tenantId !== context.tenantId) {
    failClosed("Cross-tenant request denied.", "TENANT_MISMATCH");
  }
  return tenantId;
}

function output(value) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value
  };
}

export class PropertyOsEngine {
  constructor({
    now = () => new Date(),
    receiptTtlMs = 15 * 60 * 1000,
    repository = new MemoryPropertyOsRepository(),
    agentRuntime = createAgentRuntimeFromEnv(process.env, { now })
  } = {}) {
    this.now = now;
    this.receiptTtlMs = receiptTtlMs;
    this.repository = repository;
    this.agentRuntime = agentRuntime;
  }

  getResource(uri) {
    return sampleResources[uri];
  }

  async executeTool(name, args = {}, extra = {}) {
    const context = contextFrom(extra);
    if (EXTERNAL_ACTIONS.has(name)) {
      return output({
        blocked: true,
        ownerApprovalRequired: true,
        contentApplied: false,
        reason: `${name} is blocked in v1. Use a draft, review, or dry-run workflow.`
      });
    }

    switch (name) {
      case "create_agent_mission":
        return output(await this.createMission(args, context));
      case "record_approved_evidence":
        return output(await this.recordApprovedEvidence(args, context));
      case "run_agent_draft":
        return output(await this.runAgentDraft(args, context));
      case "record_agent_run_review":
        return output(await this.recordAgentRunReview(args, context));
      case "create_inquiry_summary":
        return output(this.createInquirySummary(args, context));
      case "create_support_ticket_summary":
        return output(this.createSupportSummary(args, context));
      case "draft_listing":
      case "run_listing_dry_run":
        return output(this.createListingDraft(name, args, context));
      case "draft_reply":
        return output(this.createReplyDraft(args, context));
      case "request_owner_approval":
        return output(this.createApprovalRequest(args, context));
      case "create_sanitized_github_issue":
        return output(this.createIssueDraft(args, context));
      case "run_privacy_scan":
        return output(this.runPrivacyScan(args, context));
      case "create_implementation_readiness_snapshot":
        return output(this.createReadinessSnapshot(args, context));
      case "propose_controlled_transition":
        return output(await this.proposeTransition(args, context));
      case "record_owner_decision":
        return output(await this.recordOwnerDecision(args, context));
      case "apply_approved_transition":
        return output(await this.applyApprovedTransition(args, context));
      default:
        failClosed(`Unknown tool: ${name}`, "UNKNOWN_TOOL");
    }
  }

  async createMission(args, context) {
    requireScope(context, "property:draft");
    const tenantId = assertTenant(context, args.organizationId);
    const role = clean(args.role, 80);
    if (!agentProfiles.some((profile) => profile.id === role)) {
      failClosed(`Unknown agent role: ${role}`, "UNKNOWN_AGENT_ROLE");
    }
    const mission = {
      id: makeId("mission"),
      tenantId,
      role,
      propertyId: clean(args.propertyId, 120) || null,
      objective: clean(args.objective, 800),
      successMetric: clean(args.successMetric, 240),
      status: "planned",
      authority: "draft-only",
      stages: ["ground", "draft", "review", "owner-decision", "verify"],
      blockedActions: blockedV1Tools,
      createdBy: context.actorId,
      createdAt: this.now().toISOString(),
      ownerAction: "Review the mission objective and evidence gate before any agent output is reused."
    };
    return this.repository.createMission(mission);
  }

  async recordApprovedEvidence(args, context) {
    requireScope(context, "property:approve");
    requireOwner(context);
    const tenantId = assertTenant(context, args.organizationId);
    const ref = clean(args.ref, 180);
    const excerpt = clean(args.excerpt, 2000);
    assertAgentSafeInput(excerpt);
    const contentHash = createHash("sha256").update(excerpt).digest("hex");
    const evidence = {
      tenantId,
      ref,
      propertyId: clean(args.propertyId, 120) || null,
      excerpt,
      sourceType: clean(args.sourceType, 60),
      sourceVersionHash: clean(args.sourceVersionHash, 128),
      contentHash,
      approvedBy: context.actorId,
      approvedAt: this.now().toISOString()
    };
    await this.repository.recordApprovedEvidence(evidence);
    return {
      ref,
      propertyId: evidence.propertyId,
      sourceType: evidence.sourceType,
      sourceVersionHash: evidence.sourceVersionHash,
      contentHash,
      approvalStatus: "approved",
      contentApplied: true,
      applicationScope: "internal-evidence-store-only",
      externalActionsPerformed: [],
      ownerAction: "The exact evidence hash is available to future drafts. Replace it explicitly if the approved fact changes."
    };
  }

  async runAgentDraft(args, context) {
    requireScope(context, "property:draft");
    const tenantId = assertTenant(context, args.organizationId);
    const missionId = clean(args.missionId, 180);
    const mission = await this.repository.getMission(tenantId, missionId);
    if (!mission) failClosed("Agent mission not found in this tenant.", "MISSION_NOT_FOUND");
    if (mission.role !== args.role) failClosed("Agent role does not match the selected mission.", "MISSION_ROLE_MISMATCH");
    if (mission.propertyId && args.propertyId && mission.propertyId !== clean(args.propertyId, 120)) {
      failClosed("Agent property does not match the selected mission.", "MISSION_PROPERTY_MISMATCH");
    }
    const evidenceRefs = args.evidenceRefs.map((ref) => clean(ref, 180));
    if (new Set(evidenceRefs).size !== evidenceRefs.length) failClosed("Evidence references must be unique.", "DUPLICATE_EVIDENCE_REF");
    const evidence = await this.repository.getApprovedEvidence(tenantId, evidenceRefs, clean(args.propertyId, 120) || mission.propertyId || null);
    const run = await this.agentRuntime.draft({
      missionId,
      propertyId: clean(args.propertyId, 120) || mission.propertyId || null,
      role: args.role,
      outputType: args.outputType,
      objective: clean(args.objective, 1000),
      evidence
    }, context);
    await this.repository.createAgentRun(run);
    return run;
  }

  async recordAgentRunReview(args, context) {
    requireScope(context, "property:approve");
    requireOwner(context);
    assertTenant(context, args.organizationId);
    const result = await this.repository.recordAgentRunReview({
      context,
      runId: clean(args.runId, 180),
      decision: clean(args.decision, 40),
      feedback: clean(args.feedback, 600) || null,
      now: this.now()
    });
    return {
      ...result,
      ownerAction: result.decision === "request-revision"
        ? "Revise the mission evidence or objective before running another draft."
        : "The review is recorded. Any message, publication, pricing, applicant, access, or dispatch action remains a separate manual step."
    };
  }

  createInquirySummary(args, context) {
    requireScope(context, "property:draft");
    assertTenant(context, args.organizationId);
    return {
      id: makeId("inquiry-summary"),
      status: "OWNER REVIEW REQUIRED",
      propertyId: clean(args.propertyId, 120),
      summary: clean(args.message, 800),
      requestedWindow: clean(args.rentalWindow, 160) || "not provided",
      ownerAction: "Confirm availability, pricing, qualification process, and reply before sending."
    };
  }

  createSupportSummary(args, context) {
    requireScope(context, "property:draft");
    assertTenant(context, args.organizationId);
    const message = clean(args.message, 800);
    const urgency = clean(args.urgency, 80) || "standard";
    const safetyTerms = ["fire", "gas", "flood", "break-in", "no heat", "water leak"];
    const urgent = urgency === "emergency" || safetyTerms.some((term) => message.toLowerCase().includes(term));
    return {
      id: makeId("support-summary"),
      status: "OWNER REVIEW REQUIRED",
      propertyId: clean(args.propertyId, 120),
      urgency: urgent ? "urgent-owner-escalation" : urgency,
      summary: message,
      ownerAction: urgent
        ? "Review now, use emergency services when safety is at risk, and choose the vendor path."
        : "Confirm urgency and next step. Do not promise repair timing or vendor dispatch."
    };
  }

  createListingDraft(name, args, context) {
    requireScope(context, "property:draft");
    assertTenant(context, args.organizationId);
    return {
      id: makeId(name === "draft_listing" ? "listing" : "dryrun"),
      tool: name,
      propertyId: clean(args.propertyId, 120),
      channel: clean(args.channel, 80),
      status: "DRAFT - OWNER REVIEW REQUIRED",
      publicationMode: "dry-run-only",
      missingFacts: ["rent", "availability", "media rights", "energy and channel disclosures"],
      blockedActions: blockedV1Tools
    };
  }

  createReplyDraft(args, context) {
    requireScope(context, "property:draft");
    assertTenant(context, args.organizationId);
    return {
      id: makeId("reply"),
      status: "DRAFT - OWNER REVIEW REQUIRED",
      propertyId: clean(args.propertyId, 120),
      inquirySummary: clean(args.inquiry, 600),
      ownerAction: "Approve or edit before sending. Do not promise availability, price, lease terms, or acceptance."
    };
  }

  createApprovalRequest(args, context) {
    requireScope(context, "property:draft");
    assertTenant(context, args.organizationId);
    return {
      id: makeId("approval-request"),
      sourceId: clean(args.sourceId, 120),
      status: "owner-review",
      contentApplied: false,
      ownerAction: clean(args.ownerAction, 500),
      note: "This is a review request, not an approval receipt and not authority to apply or publish."
    };
  }

  createIssueDraft(args, context) {
    requireScope(context, "property:draft");
    assertTenant(context, args.organizationId);
    return {
      title: clean(args.title, 120),
      body: clean(args.summary, 1000),
      status: "SANITIZED DRAFT",
      privateDataPolicy: "Exclude renter identity, access, payment, lease, complaint, and private owner data."
    };
  }

  runPrivacyScan(args, context) {
    requireScope(context, "property:draft");
    assertTenant(context, args.organizationId);
    const text = clean(args.text, 4000).toLowerCase();
    const checks = {
      accessSecret: /\b(lockbox|door code|alarm code|wifi password)\b/.test(text),
      paymentData: /\b(iban|bank account|credit card|deposit account)\b/.test(text),
      identityDocument: /\b(passport|identity card|id card)\b/.test(text),
      privateLeaseData: /\b(signed lease|payment arrears|renter complaint)\b/.test(text)
    };
    const findings = Object.entries(checks).filter(([, found]) => found).map(([name]) => name);
    return {
      passed: findings.length === 0,
      findings,
      scannedLength: text.length,
      textReturned: false,
      ownerAction: findings.length ? "Remove or move sensitive content to the approved private runtime." : "No blocked phrase class detected; human privacy review still applies."
    };
  }

  createReadinessSnapshot(args, context) {
    requireScope(context, "property:read");
    const tenantId = assertTenant(context, args.organizationId);
    return {
      id: makeId("readiness"),
      tenantId,
      status: "PARTNER REVIEW REQUIRED",
      portalUrl: clean(args.portalUrl, 240) || "Set APP_BASE_URL and verify the owner control center.",
      runtimeMode: clean(args.runtimeMode, 80) || "demo",
      readyLayers: ["agent missions", "draft workflows", "owner decision boundary", "internal controlled-transition proof", "community fork kit"],
      productionGates: ["OIDC resource-server mode", "managed Postgres migration and live RLS proof", "notifications", "backups and retention", "live visual QA"],
      blockedActions: blockedV1Tools
    };
  }

  async proposeTransition(args, context) {
    requireScope(context, "property:draft");
    const tenantId = assertTenant(context, args.organizationId);
    const operation = clean(args.operation, 120);
    if (operation !== "mark-draft-reviewed") {
      failClosed("Only the internal mark-draft-reviewed transition is enabled in the template proof.", "OPERATION_BLOCKED");
    }
    const resourceId = clean(args.resourceId, 180);
    const baseVersionHash = clean(args.baseVersionHash, 128);
    const payloadHash = clean(args.payloadHash, 128);
    const proposal = {
      id: makeId("proposal"),
      tenantId,
      operation,
      resourceId,
      baseVersionHash,
      payloadHash,
      summary: clean(args.summary, 500),
      createdByRunId: clean(args.missionId, 120) || null,
      createdBy: context.actorId,
      status: "pending",
      createdAt: this.now().toISOString()
    };
    await this.repository.proposeTransition(proposal);
    return { ...proposal, contentApplied: false, ownerAction: "Review the exact proposal, then record an approve or reject decision." };
  }

  async recordOwnerDecision(args, context) {
    requireScope(context, "property:approve");
    requireOwner(context);
    assertTenant(context, args.organizationId);
    const decision = clean(args.decision, 20);
    const result = await this.repository.recordDecision({
      context,
      proposalId: clean(args.proposalId, 180),
      decision,
      now: this.now(),
      receiptTtlMs: this.receiptTtlMs
    });
    if (result.decision === "rejected") {
      return {
        ...result,
        ownerAction: "Revise or stop the mission. Accepted state is unchanged."
      };
    }
    return {
      ...result,
      ownerAction: "Apply the approved internal transition before the receipt expires. External actions remain blocked."
    };
  }

  async applyApprovedTransition(args, context) {
    requireScope(context, "property:apply:internal");
    requireOwner(context);
    assertTenant(context, args.organizationId);
    const proposalId = clean(args.proposalId, 180);
    const receiptId = clean(args.approvalReceiptId, 180);
    const idempotencyKey = clean(args.idempotencyKey, 180);
    return this.repository.applyTransition({ context, proposalId, receiptId, idempotencyKey, now: this.now() });
  }
}

export function createPropertyOsEngine(options) {
  return new PropertyOsEngine(options);
}

export { contextFrom };
