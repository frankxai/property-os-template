import { createPropertyOsEngine } from "../src/domain.mjs";

const owner = {
  authInfo: {
    scopes: ["property:read", "property:draft", "property:approve", "property:apply:internal"],
    extra: { tenantId: "org-a", actorId: "owner-a", actorRole: "owner" }
  }
};
const otherOwner = {
  authInfo: {
    scopes: owner.authInfo.scopes,
    extra: { tenantId: "org-b", actorId: "owner-b", actorRole: "owner" }
  }
};
const sameTenantOtherOwner = {
  authInfo: {
    scopes: owner.authInfo.scopes,
    extra: { tenantId: "org-a", actorId: "owner-b", actorRole: "owner" }
  }
};
const engine = createPropertyOsEngine();

async function expectError(run, code) {
  try {
    await run();
  } catch (error) {
    if (error.code === code) return;
    throw new Error(`Expected ${code}, received ${error.code || error.message}.`);
  }
  throw new Error(`Expected ${code}, but the operation succeeded.`);
}

const blocked = await engine.executeTool("publish_listing", { organizationId: "org-a" }, owner);
if (!blocked.structuredContent.blocked || blocked.structuredContent.contentApplied) throw new Error("External publication must fail closed.");

const proposal = (await engine.executeTool("propose_controlled_transition", {
  organizationId: "org-a",
  operation: "mark-draft-reviewed",
  resourceId: "listing-draft-1",
  baseVersionHash: "base-v1",
  payloadHash: "payload-v2",
  summary: "Owner-reviewed internal draft state"
}, owner)).structuredContent;

await expectError(
  () => engine.executeTool("record_owner_decision", { organizationId: "org-b", proposalId: proposal.id, decision: "approve" }, otherOwner),
  "PROPOSAL_NOT_FOUND"
);

const decision = (await engine.executeTool("record_owner_decision", {
  organizationId: "org-a",
  proposalId: proposal.id,
  decision: "approve"
}, owner)).structuredContent;
if (decision.contentApplied || !decision.receiptIssued) throw new Error("Approval must issue a receipt without applying content.");

const actorEngine = createPropertyOsEngine();
const actorProposal = (await actorEngine.executeTool("propose_controlled_transition", {
  organizationId: "org-a",
  operation: "mark-draft-reviewed",
  resourceId: "listing-draft-actor-bound",
  baseVersionHash: "actor-base-v1",
  payloadHash: "actor-payload-v2",
  summary: "Actor binding proof"
}, owner)).structuredContent;
const actorDecision = (await actorEngine.executeTool("record_owner_decision", {
  organizationId: "org-a",
  proposalId: actorProposal.id,
  decision: "approve"
}, owner)).structuredContent;
await expectError(
  () => actorEngine.executeTool("apply_approved_transition", {
    organizationId: "org-a",
    proposalId: actorProposal.id,
    approvalReceiptId: actorDecision.approvalReceipt.id,
    idempotencyKey: "actor-bound-apply"
  }, sameTenantOtherOwner),
  "ACTOR_MISMATCH"
);

const policyEngine = createPropertyOsEngine();
const policyProposal = (await policyEngine.executeTool("propose_controlled_transition", {
  organizationId: "org-a",
  operation: "mark-draft-reviewed",
  resourceId: "listing-draft-policy-bound",
  baseVersionHash: "policy-base-v1",
  payloadHash: "policy-payload-v2",
  summary: "Policy binding proof"
}, owner)).structuredContent;
const policyDecision = (await policyEngine.executeTool("record_owner_decision", {
  organizationId: "org-a",
  proposalId: policyProposal.id,
  decision: "approve"
}, owner)).structuredContent;
policyDecision.approvalReceipt.policyVersion = "obsolete-policy";
await expectError(
  () => policyEngine.executeTool("apply_approved_transition", {
    organizationId: "org-a",
    proposalId: policyProposal.id,
    approvalReceiptId: policyDecision.approvalReceipt.id,
    idempotencyKey: "policy-bound-apply"
  }, owner),
  "POLICY_VERSION_MISMATCH"
);
policyDecision.approvalReceipt.policyVersion = "property-os-authority.v2";
policyDecision.approvalReceipt.scope = [];
await expectError(
  () => policyEngine.executeTool("apply_approved_transition", {
    organizationId: "org-a",
    proposalId: policyProposal.id,
    approvalReceiptId: policyDecision.approvalReceipt.id,
    idempotencyKey: "scope-bound-apply"
  }, owner),
  "RECEIPT_SCOPE_MISMATCH"
);

await expectError(
  () => engine.executeTool("apply_approved_transition", {
    organizationId: "org-a",
    proposalId: proposal.id,
    approvalReceiptId: "forged-receipt",
    idempotencyKey: "apply-1"
  }, owner),
  "TRANSITION_NOT_FOUND"
);

const applied = (await engine.executeTool("apply_approved_transition", {
  organizationId: "org-a",
  proposalId: proposal.id,
  approvalReceiptId: decision.approvalReceipt.id,
  idempotencyKey: "apply-1"
}, owner)).structuredContent;
if (!applied.contentApplied || applied.externalActionsPerformed.length) throw new Error("Internal controlled transition proof failed.");

const replay = (await engine.executeTool("apply_approved_transition", {
  organizationId: "org-a",
  proposalId: proposal.id,
  approvalReceiptId: decision.approvalReceipt.id,
  idempotencyKey: "apply-1"
}, owner)).structuredContent;
if (!replay.replayed || replay.transitionId !== applied.transitionId) throw new Error("Exact idempotent replay did not return prior evidence.");

await expectError(
  () => engine.executeTool("apply_approved_transition", {
    organizationId: "org-a",
    proposalId: "different-proposal",
    approvalReceiptId: decision.approvalReceipt.id,
    idempotencyKey: "apply-1"
  }, owner),
  "IDEMPOTENCY_CONFLICT"
);

const privateText = "Door code and IBAN must never be public.";
const privacy = (await engine.executeTool("run_privacy_scan", { organizationId: "org-a", text: privateText }, owner)).structuredContent;
if (privacy.passed || JSON.stringify(privacy).includes(privateText)) throw new Error("Privacy scan must flag classes without echoing submitted text.");

let clock = new Date("2026-07-22T00:00:00.000Z");
const expiring = createPropertyOsEngine({ now: () => clock, receiptTtlMs: 1000 });
const expiringProposal = (await expiring.executeTool("propose_controlled_transition", {
  organizationId: "org-a",
  operation: "mark-draft-reviewed",
  resourceId: "listing-draft-expiring",
  baseVersionHash: "base-v1",
  payloadHash: "payload-v2",
  summary: "Expiry proof"
}, owner)).structuredContent;
const expiringDecision = (await expiring.executeTool("record_owner_decision", {
  organizationId: "org-a",
  proposalId: expiringProposal.id,
  decision: "approve"
}, owner)).structuredContent;
clock = new Date("2026-07-22T00:00:02.000Z");
await expectError(
  () => expiring.executeTool("apply_approved_transition", {
    organizationId: "org-a",
    proposalId: expiringProposal.id,
    approvalReceiptId: expiringDecision.approvalReceipt.id,
    idempotencyKey: "expired-apply"
  }, owner),
  "RECEIPT_EXPIRED"
);

const concurrent = createPropertyOsEngine();
const concurrentProposal = (await concurrent.executeTool("propose_controlled_transition", {
  organizationId: "org-a",
  operation: "mark-draft-reviewed",
  resourceId: "listing-draft-concurrent",
  baseVersionHash: "concurrent-base-v1",
  payloadHash: "concurrent-payload-v2",
  summary: "Concurrent retry proof"
}, owner)).structuredContent;
const concurrentDecision = (await concurrent.executeTool("record_owner_decision", {
  organizationId: "org-a",
  proposalId: concurrentProposal.id,
  decision: "approve"
}, owner)).structuredContent;
const concurrentArgs = {
  organizationId: "org-a",
  proposalId: concurrentProposal.id,
  approvalReceiptId: concurrentDecision.approvalReceipt.id,
  idempotencyKey: "concurrent-exact-retry"
};
const concurrentResults = await Promise.all([
  concurrent.executeTool("apply_approved_transition", concurrentArgs, owner),
  concurrent.executeTool("apply_approved_transition", concurrentArgs, owner)
]);
const concurrentBodies = concurrentResults.map((result) => result.structuredContent);
if (new Set(concurrentBodies.map((result) => result.transitionId)).size !== 1) {
  throw new Error("Concurrent exact retries created more than one transition.");
}
if (concurrentBodies.filter((result) => result.replayed).length !== 1) {
  throw new Error("Concurrent exact retries must return one apply and one replay receipt.");
}

console.log("Property OS controlled-transition adversarial tests passed.");
