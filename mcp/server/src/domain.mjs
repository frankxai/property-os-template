import { createHash, randomUUID } from "node:crypto";

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

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
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
  constructor({ now = () => new Date(), receiptTtlMs = 15 * 60 * 1000 } = {}) {
    this.now = now;
    this.receiptTtlMs = receiptTtlMs;
    this.missions = new Map();
    this.proposals = new Map();
    this.receipts = new Map();
    this.transitions = new Map();
    this.currentVersions = new Map();
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
        return output(this.createMission(args, context));
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
        return output(this.proposeTransition(args, context));
      case "record_owner_decision":
        return output(this.recordOwnerDecision(args, context));
      case "apply_approved_transition":
        return output(this.applyApprovedTransition(args, context));
      default:
        failClosed(`Unknown tool: ${name}`, "UNKNOWN_TOOL");
    }
  }

  createMission(args, context) {
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
      createdAt: this.now().toISOString()
    };
    this.missions.set(mission.id, mission);
    return mission;
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
      productionGates: ["OIDC resource-server mode", "Postgres transition repository", "RLS proof", "notifications", "backups and retention", "live visual QA"],
      blockedActions: blockedV1Tools
    };
  }

  proposeTransition(args, context) {
    requireScope(context, "property:draft");
    const tenantId = assertTenant(context, args.organizationId);
    const operation = clean(args.operation, 120);
    if (operation !== "mark-draft-reviewed") {
      failClosed("Only the internal mark-draft-reviewed transition is enabled in the template proof.", "OPERATION_BLOCKED");
    }
    const resourceId = clean(args.resourceId, 180);
    const baseVersionHash = clean(args.baseVersionHash, 128);
    const payloadHash = clean(args.payloadHash, 128);
    const stateKey = `${tenantId}:${resourceId}`;
    const currentVersion = this.currentVersions.get(stateKey);
    if (currentVersion && currentVersion !== baseVersionHash) {
      failClosed("The proposal base version is stale.", "STALE_BASE_VERSION");
    }
    this.currentVersions.set(stateKey, baseVersionHash);
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
    this.proposals.set(proposal.id, proposal);
    return { ...proposal, contentApplied: false, ownerAction: "Review the exact proposal, then record an approve or reject decision." };
  }

  recordOwnerDecision(args, context) {
    requireScope(context, "property:approve");
    requireOwner(context);
    assertTenant(context, args.organizationId);
    const proposal = this.proposals.get(clean(args.proposalId, 180));
    if (!proposal || proposal.tenantId !== context.tenantId) {
      failClosed("Proposal not found in this tenant.", "PROPOSAL_NOT_FOUND");
    }
    if (proposal.status !== "pending") {
      failClosed(`Proposal is already ${proposal.status}.`, "PROPOSAL_NOT_PENDING");
    }
    const decision = clean(args.decision, 20);
    if (decision === "reject") {
      proposal.status = "rejected";
      return {
        proposalId: proposal.id,
        decision: "rejected",
        contentApplied: false,
        receiptIssued: false,
        ownerAction: "Revise or stop the mission. Accepted state is unchanged."
      };
    }
    if (decision !== "approve") {
      failClosed("Decision must be approve or reject.", "INVALID_DECISION");
    }
    proposal.status = "approved";
    const issuedAt = this.now();
    const receipt = {
      id: makeId("receipt"),
      proposalId: proposal.id,
      tenantId: proposal.tenantId,
      actorId: context.actorId,
      actorRole: context.actorRole,
      operation: proposal.operation,
      resourceId: proposal.resourceId,
      baseVersionHash: proposal.baseVersionHash,
      payloadHash: proposal.payloadHash,
      scope: ["property:apply:internal"],
      policyVersion: "property-os-authority.v2",
      issuedAt: issuedAt.toISOString(),
      expiresAt: new Date(issuedAt.getTime() + this.receiptTtlMs).toISOString(),
      status: "active"
    };
    this.receipts.set(receipt.id, receipt);
    return {
      proposalId: proposal.id,
      decision: "approved",
      contentApplied: false,
      receiptIssued: true,
      approvalReceipt: receipt,
      ownerAction: "Apply the approved internal transition before the receipt expires. External actions remain blocked."
    };
  }

  applyApprovedTransition(args, context) {
    requireScope(context, "property:apply:internal");
    requireOwner(context);
    assertTenant(context, args.organizationId);
    const proposalId = clean(args.proposalId, 180);
    const receiptId = clean(args.approvalReceiptId, 180);
    const idempotencyKey = clean(args.idempotencyKey, 180);
    const idempotencyState = this.transitions.get(`${context.tenantId}:${idempotencyKey}`);
    if (idempotencyState) {
      if (idempotencyState.proposalId !== proposalId || idempotencyState.receiptId !== receiptId) {
        failClosed("Idempotency key was already used for a different transition.", "IDEMPOTENCY_CONFLICT");
      }
      return { ...idempotencyState.result, replayed: true };
    }
    const proposal = this.proposals.get(proposalId);
    const receipt = this.receipts.get(receiptId);
    if (!proposal || !receipt) failClosed("Proposal or approval receipt was not found.", "TRANSITION_NOT_FOUND");
    if (proposal.tenantId !== context.tenantId || receipt.tenantId !== context.tenantId) failClosed("Cross-tenant transition denied.", "TENANT_MISMATCH");
    if (proposal.status !== "approved") failClosed(`Proposal is ${proposal.status}.`, "PROPOSAL_NOT_APPROVED");
    if (proposal.id !== receipt.proposalId || proposal.operation !== receipt.operation || proposal.resourceId !== receipt.resourceId || proposal.baseVersionHash !== receipt.baseVersionHash || proposal.payloadHash !== receipt.payloadHash) {
      failClosed("Proposal and approval receipt binding failed.", "RECEIPT_BINDING_FAILED");
    }
    if (receipt.actorId !== context.actorId) failClosed("Approval receipt belongs to a different actor.", "ACTOR_MISMATCH");
    if (receipt.policyVersion !== "property-os-authority.v2") failClosed("Approval receipt policy version is not accepted.", "POLICY_VERSION_MISMATCH");
    if (!receipt.scope.includes("property:apply:internal")) failClosed("Approval receipt does not grant internal apply scope.", "RECEIPT_SCOPE_MISMATCH");
    if (receipt.status !== "active") failClosed(`Approval receipt is ${receipt.status}.`, "RECEIPT_NOT_ACTIVE");
    if (new Date(receipt.expiresAt).getTime() <= this.now().getTime()) {
      receipt.status = "expired";
      failClosed("Approval receipt expired.", "RECEIPT_EXPIRED");
    }
    const stateKey = `${context.tenantId}:${proposal.resourceId}`;
    if (this.currentVersions.get(stateKey) !== proposal.baseVersionHash) failClosed("Target state changed after approval.", "STALE_BASE_VERSION");
    const transitionId = makeId("transition");
    const newVersionHash = digest(`${proposal.baseVersionHash}:${proposal.payloadHash}:${transitionId}`);
    const result = {
      transitionId,
      proposalId,
      approvalReceiptId: receiptId,
      contentApplied: true,
      operation: proposal.operation,
      resourceId: proposal.resourceId,
      newVersionHash,
      auditEvent: "controlled_transition.applied",
      undo: { supported: true, mode: "internal-sample-state", previousVersionHash: proposal.baseVersionHash },
      replayed: false,
      externalActionsPerformed: []
    };
    this.currentVersions.set(stateKey, newVersionHash);
    proposal.status = "applied";
    receipt.status = "consumed";
    this.transitions.set(`${context.tenantId}:${idempotencyKey}`, { proposalId, receiptId, result });
    return result;
  }
}

export function createPropertyOsEngine(options) {
  return new PropertyOsEngine(options);
}

export { contextFrom };
