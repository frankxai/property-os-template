import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PropertyOsAgentRuntime } from "../src/agent-runtime.mjs";
import { createPropertyOsEngine } from "../src/domain.mjs";
import { PostgresPropertyOsRepository } from "../src/repository.mjs";

function asPostgresJs(executor, root) {
  const sql = async (strings, ...params) => {
    const result = await executor.sql(strings, ...params);
    return result.rows;
  };
  sql.json = (value) => JSON.stringify(value);
  sql.begin = async (operation) => root.transaction(async (transaction) => operation(asPostgresJs(transaction, root)));
  sql.end = async () => root.close();
  return sql;
}

const owner = {
  authInfo: {
    scopes: ["property:read", "property:draft", "property:approve", "property:apply:internal"],
    extra: { tenantId: "org-a", actorId: "owner-a", actorRole: "owner" }
  }
};
const db = new PGlite();
const migrations = await Promise.all([
  readFile(new URL("../db/001-control-plane.sql", import.meta.url), "utf8"),
  readFile(new URL("../db/002-governed-agent-runtime.sql", import.meta.url), "utf8")
]);

try {
  for (const migration of migrations) await db.exec(migration);
  await db.exec(`
    insert into organizations (id, name) values ('org-a', 'Organization A'), ('org-b', 'Organization B');
    create role property_os_runtime nologin;
    grant usage on schema public to property_os_runtime;
    grant select, insert, update, delete on all tables in schema public to property_os_runtime;
    grant execute on function property_os_current_organization_id() to property_os_runtime;
    set role property_os_runtime;
  `);

  const sql = asPostgresJs(db, db);
  const repository = new PostgresPropertyOsRepository("pglite://contract-test", { sql });
  const health = await repository.health();
  if (!health.ready || health.adapter !== "postgres") throw new Error("Durable repository readiness failed after migration.");
  const agentRuntime = new PropertyOsAgentRuntime({
    env: { PROPERTY_OS_AI_MODEL: "test/provider-model" },
    generate: async () => ({
      output: {
        summary: "A durable grounded draft is ready.",
        draft: "The property facts are prepared for owner review.",
        evidenceRefs: ["knowledge://sample/profile"],
        missingFacts: ["Owner must confirm availability."],
        risks: ["No availability was inferred."],
        confidence: "high",
        ownerAction: "Review the draft before reuse.",
        recommendedNextSteps: ["Compare the draft with the approved profile."]
      },
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 }
    })
  });
  const engine = createPropertyOsEngine({ repository, agentRuntime });

  const mission = (await engine.executeTool("create_agent_mission", {
    organizationId: "org-a",
    role: "property-steward",
    propertyId: "sample-property",
    objective: "Prove durable tenant-scoped mission persistence.",
    successMetric: "One mission is visible only to org-a."
  }, owner)).structuredContent;
  if (!mission.id || mission.tenantId !== "org-a") throw new Error("Durable mission creation failed.");

  const ownRows = await repository.tenantTransaction("org-a", (tx) => tx`select id from agent_missions`);
  const otherRows = await repository.tenantTransaction("org-b", (tx) => tx`select id from agent_missions`);
  if (ownRows.length !== 1 || otherRows.length !== 0) throw new Error("Forced RLS did not isolate mission visibility.");

  const evidence = (await engine.executeTool("record_approved_evidence", {
    organizationId: "org-a",
    ref: "knowledge://sample/profile",
    propertyId: "sample-property",
    excerpt: "The apartment has two bedrooms and a furnished kitchen.",
    sourceType: "property-profile",
    sourceVersionHash: "sample-profile-v1"
  }, owner)).structuredContent;
  if (evidence.approvalStatus !== "approved" || evidence.contentApplied !== true) {
    throw new Error("Durable owner-approved evidence registration failed.");
  }
  const ownEvidence = await repository.tenantTransaction("org-a", (tx) => tx`select ref, content_hash from approved_evidence`);
  const otherEvidence = await repository.tenantTransaction("org-b", (tx) => tx`select ref from approved_evidence`);
  if (ownEvidence[0]?.ref !== evidence.ref || ownEvidence[0]?.content_hash !== evidence.contentHash || otherEvidence.length !== 0) {
    throw new Error("Forced RLS did not isolate approved evidence visibility.");
  }

  const agentRun = (await engine.executeTool("run_agent_draft", {
    organizationId: "org-a",
    missionId: mission.id,
    role: "property-steward",
    propertyId: "sample-property",
    outputType: "weekly-owner-review",
    objective: "Prepare a durable owner-review draft.",
    evidenceRefs: ["knowledge://sample/profile"]
  }, owner)).structuredContent;
  if (agentRun.status !== "owner-review" || agentRun.contentApplied !== false) {
    throw new Error("Durable agent run crossed the draft-only boundary.");
  }
  const ownRuns = await repository.tenantTransaction("org-a", (tx) => tx`select id, output_hash, evidence_refs from agent_runs`);
  const otherRuns = await repository.tenantTransaction("org-b", (tx) => tx`select id from agent_runs`);
  if (ownRuns[0]?.id !== agentRun.id || ownRuns[0]?.output_hash !== agentRun.outputHash || otherRuns.length !== 0) {
    throw new Error("Forced RLS did not isolate durable agent-run visibility.");
  }
  const evidenceSnapshot = typeof ownRuns[0]?.evidence_refs === "string" ? JSON.parse(ownRuns[0].evidence_refs) : ownRuns[0]?.evidence_refs;
  if (evidenceSnapshot?.[0]?.contentHash !== evidence.contentHash || evidenceSnapshot?.[0]?.sourceVersionHash !== "sample-profile-v1") {
    throw new Error("Durable agent run did not freeze the exact evidence version.");
  }
  const review = (await engine.executeTool("record_agent_run_review", {
    organizationId: "org-a",
    runId: agentRun.id,
    decision: "accept-draft",
    feedback: "Facts and owner boundary verified."
  }, owner)).structuredContent;
  if (review.status !== "accepted" || review.contentApplied !== false || review.externalActionsPerformed.length) {
    throw new Error("Owner review changed content or crossed the external-action boundary.");
  }
  const reviewed = await repository.tenantTransaction("org-a", (tx) => tx`
    select r.status, r.owner_decision, m.status as mission_status
    from agent_runs r join agent_missions m on m.id = r.mission_id
    where r.id = ${agentRun.id}
  `);
  if (reviewed[0]?.status !== "accepted" || reviewed[0]?.owner_decision !== "accept-draft" || reviewed[0]?.mission_status !== "verified") {
    throw new Error("Durable owner review and mission state diverged.");
  }

  const proposal = (await engine.executeTool("propose_controlled_transition", {
    organizationId: "org-a",
    operation: "mark-draft-reviewed",
    resourceId: "listing:sample-property:own-website",
    baseVersionHash: "postgres-base-v1",
    payloadHash: "postgres-payload-v2",
    summary: "Owner inspected the exact internal draft."
  }, owner)).structuredContent;
  const decision = (await engine.executeTool("record_owner_decision", {
    organizationId: "org-a",
    proposalId: proposal.id,
    decision: "approve"
  }, owner)).structuredContent;
  const applyArguments = {
    organizationId: "org-a",
    proposalId: proposal.id,
    approvalReceiptId: decision.approvalReceipt.id,
    idempotencyKey: "postgres-integration-apply"
  };
  const applied = (await engine.executeTool("apply_approved_transition", applyArguments, owner)).structuredContent;
  const replay = (await engine.executeTool("apply_approved_transition", applyArguments, owner)).structuredContent;
  if (!applied.contentApplied || replay.transitionId !== applied.transitionId || !replay.replayed) {
    throw new Error("Durable controlled transition or idempotent replay failed.");
  }

  const state = await repository.tenantTransaction("org-a", (tx) => tx`
    select p.status as proposal_status, r.status as receipt_status, v.version_hash
    from transition_proposals p
    join approval_receipts r on r.proposal_id = p.id
    join resource_versions v on v.organization_id = p.organization_id and v.resource_id = p.resource_id
    where p.id = ${proposal.id}
  `);
  if (state[0]?.proposal_status !== "applied" || state[0]?.receipt_status !== "consumed" || state[0]?.version_hash !== applied.newVersionHash) {
    throw new Error("Durable accepted state, receipt consumption, and version ledger diverged.");
  }

  console.log("Property OS embedded Postgres/RLS integration passed.");
} finally {
  await db.close();
}
