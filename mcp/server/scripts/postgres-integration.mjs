import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
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
const migration = await readFile(new URL("../db/001-control-plane.sql", import.meta.url), "utf8");

try {
  await db.exec(migration);
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
  const engine = createPropertyOsEngine({ repository });

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
