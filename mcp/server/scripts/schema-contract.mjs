import { readFile } from "node:fs/promises";

const schemaUrl = new URL("../db/001-control-plane.sql", import.meta.url);
const repositoryUrl = new URL("../src/repository.mjs", import.meta.url);
const [schema, repository] = await Promise.all([
  readFile(schemaUrl, "utf8"),
  readFile(repositoryUrl, "utf8")
]);

const requiredTables = [
  "agent_missions",
  "resource_versions",
  "transition_proposals",
  "approval_receipts",
  "controlled_transitions",
  "audit_events"
];

for (const table of requiredTables) {
  if (!schema.includes(`create table if not exists ${table}`)) throw new Error(`Control-plane migration is missing ${table}.`);
  if (!schema.includes(`alter table ${table} force row level security`)) throw new Error(`Control-plane migration does not force RLS for ${table}.`);
}

const requiredRepositoryGuards = [
  "pg_advisory_xact_lock",
  "for update",
  "STALE_BASE_VERSION",
  "IDEMPOTENCY_CONFLICT",
  "RECEIPT_BINDING_FAILED",
  "property_os.organization_id"
];

for (const guard of requiredRepositoryGuards) {
  if (!repository.toLowerCase().includes(guard.toLowerCase())) throw new Error(`Postgres repository is missing guard: ${guard}.`);
}

console.log("Property OS durable schema contract passed.");
