import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInstallPlan } from "./create-install-plan.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const sample = JSON.parse(await readFile(path.join(root, "install", "sample-install.config.json"), "utf8"));
const timestampA = "2026-07-22T10:00:00.000Z";
const timestampB = "2026-07-22T11:00:00.000Z";

const first = await createInstallPlan(sample, { generatedAt: timestampA });
const second = await createInstallPlan(sample, { generatedAt: timestampB });

assert.equal(first.schema, "property-os.installPlan.v1");
assert.equal(first.posture, "planned-not-proven");
assert.equal(first.proofStatus, "unverified");
assert.equal(first.generatedAt, timestampA);
assert.equal(first.sourceConfigHash, second.sourceConfigHash);
assert.equal(first.planHash, second.planHash, "plan hash must be stable across generation timestamps");
assert.notEqual(first.generatedAt, second.generatedAt);
assert.equal(first.architecture.portalStore.logicalDatabase, "portal-db");
assert.equal(first.architecture.controlPlaneLedger.logicalDatabase, "control-plane-db");
assert.match(first.architecture.databaseBoundary, /separate logical databases/i);
assert.deepEqual(first.governance.blockedActions, [
  "publish_listing",
  "send_renter_message",
  "dispatch_vendor",
  "approve_applicant",
  "disclose_access_secret",
  "change_price_or_availability"
]);
assert.ok(first.environment.vercel.requiredKeys.includes("MCP_SERVER_ACCESS_TOKEN"));
assert.ok(first.environment.vercel.requiredKeys.includes("OWNER_NOTIFICATION_WEBHOOK_SIGNING_SECRET"));
assert.ok(first.environment.vercel.requiredKeys.includes("OWNER_NOTIFICATION_FALLBACK_SIGNING_SECRET"));
assert.ok(first.environment.vercel.requiredKeys.includes("OWNER_NOTIFICATION_WORKER_TOKEN"));
assert.ok(first.environment.railway.requiredKeys.includes("PROPERTY_OS_MCP_AUTH_TOKEN"));
assert.ok(first.environment.operator.requiredKeys.includes("PROPERTY_OS_REMOTE_MCP_TOKEN"));
assert.ok(first.commands.some((entry) => entry.command === "npm run activation:verify"));
assert.ok(first.commands.some((entry) => entry.command === "npm run notification:smoke"));
assert.ok(first.commands.some((entry) => entry.command === "npm run notification:visual"));
assert.ok(first.migrations.some((entry) => entry.path === "db/002-notification-lifecycle.sql" && entry.target === "portal-db"));
assert.ok(first.acceptance.some((entry) => entry.id === "owner-review" && entry.ownerApproval));
assert.ok(first.acceptance.some((entry) => entry.id === "urgent-route" && /fallback/i.test(entry.action)));
assert.equal(first.successMetrics.every((metric) => metric.status === "unmeasured"), true);

const serialized = JSON.stringify(first);
assert.doesNotMatch(serialized, /@example\./i);
assert.doesNotMatch(serialized, /-----BEGIN [A-Z ]*PRIVATE KEY-----/);

await assert.rejects(
  () => createInstallPlan({ ...sample, apiToken: "sk_test_value_that_must_not_be_logged" }),
  /must not include sensitive field/
);

await assert.rejects(
  () =>
    createInstallPlan({
      ...sample,
      portfolio: { ...sample.portfolio, propertyCount: 2, unitCount: 1 }
    }),
  /unitCount must be at least/
);

await assert.rejects(
  () =>
    createInstallPlan({
      ...sample,
      edition: "agency-platform",
      operatorMode: "partner-led",
      commercial: { offerId: "agency-workspace", supportTier: "implementation" }
    }),
  /must be equal to constant/
);

console.log(`Install plan smoke passed: ${first.phaseGates.length} gates, ${first.commands.length} commands, ${first.successMetrics.length} unmeasured metrics.`);
