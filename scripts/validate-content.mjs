import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  ".claude/agents/property-steward.md",
  ".claude/agents/listing-ops-agent.md",
  ".claude/agents/inquiry-concierge-agent.md",
  ".claude/agents/renter-guide-agent.md",
  ".claude/agents/maintenance-triage-agent.md",
  ".claude/agents/vacancy-pipeline-agent.md",
  ".claude/agents/privacy-compliance-reviewer.md",
  ".claude/agents/platform-architect.md",
  ".claude/agents/visual-qa-agent.md",
  ".claude/agents/implementer-growth-agent.md",
  ".claude/skills/property-os-business/SKILL.md",
  ".claude/skills/property-os-mcp/SKILL.md",
  ".claude/commands/install-client.md",
  ".claude/commands/commercial-offer.md",
  ".claude/commands/agent-run-audit.md",
  ".claude/commands/production-readiness.md",
  ".codex/commands/install-client.md",
  ".github/workflows/ci.yml",
  "docs/prd-lite.md",
  "docs/user-flows.md",
  "docs/success-metrics.md",
  "docs/v0-vercel-template.md",
  "docs/community-fork-guide.md",
  "docs/partner-implementation-kit.md",
  "docs/implementation-readiness-cockpit.md",
  "docs/agentic-service-offering.md",
  "docs/implementer-business-model.md",
  "docs/production-readiness-standard.md",
  "docs/remote-activation-proof.md",
  "docs/self-service-install-plan.md",
  "docs/ai-architecture-and-control-plane.md",
  "docs/product-editions-and-economics.md",
  "agents/team.manifest.json",
  ".swarm/property-os.yml",
  "mcp/property-os.mcp.json",
  "mcp/README.md",
  "mcp/server/package.json",
  "mcp/server/src/server.mjs",
  "mcp/server/src/server-factory.mjs",
  "mcp/server/src/domain.mjs",
  "mcp/server/src/auth.mjs",
  "mcp/server/src/http.mjs",
  "mcp/server/src/agent-runtime.mjs",
  "mcp/server/src/repository.mjs",
  "mcp/server/db/001-control-plane.sql",
  "mcp/server/db/002-governed-agent-runtime.sql",
  "mcp/server/scripts/smoke.mjs",
  "mcp/server/scripts/adversarial.mjs",
  "mcp/server/scripts/http-smoke.mjs",
  "mcp/server/scripts/agent-runtime.mjs",
  "mcp/server/scripts/remote-activation.mjs",
  "mcp/server/scripts/remote-activation-smoke.mjs",
  "mcp/server/scripts/postgres-integration.mjs",
  "mcp/server/Dockerfile",
  "mcp/server/railway.toml",
  "schemas/install-config.schema.json",
  "schemas/install-plan.schema.json",
  "install/sample-install.config.json",
  "scripts/create-install-plan.mjs",
  "scripts/install-plan-smoke.mjs",
  "railway/architecture.md",
  "railway/property-os-mcp.service.json",
  "install/HOSTED-RUNTIME.md",
  "install/PORTAL-WIRING.md",
  ".github/ISSUE_TEMPLATE/install-support.md",
  ".github/ISSUE_TEMPLATE/integration-request.md",
  ".github/ISSUE_TEMPLATE/safety-review.md"
];

for (const file of requiredFiles) {
  await readFile(path.join(root, file), "utf8");
}

const requiredSnippetChecks = [
  {
    file: ".github/workflows/ci.yml",
    snippets: [
      "cache-dependency-path: |",
      "package-lock.json",
      "run: npm ci",
      "npm ci --prefix mcp/server"
    ]
  },
  {
    file: "docs/self-service-install-plan.md",
    snippets: [
      "npm run install:plan",
      "planned-not-proven",
      "separate logical Postgres databases",
      "Never point their `DATABASE_URL` values at the same logical database",
      "plan hash"
    ]
  },
  {
    file: "docs/remote-activation-proof.md",
    snippets: [
      "npm run activation:verify",
      "PROPERTY_OS_ACTIVATION_ALLOW_WRITES=true",
      "contentApplied",
      "external action list is empty",
      "rejection review"
    ]
  },
  {
    file: "install/PORTAL-WIRING.md",
    snippets: [
      "OWNER_PORTAL_SECRET",
      "OWNER_PORTAL_PASSCODE_HASH",
      "PROPERTY_OS_AUTH_MODE",
      "no global owner bearer",
      "npm run auth:hash",
      "npm run auth:smoke",
      "npm run identity:smoke",
      "npm run db:rls:smoke",
      "npm run install:proof",
      "/api/install/proof-packet",
      "separate logical databases",
      "Protected owner/admin API calls"
    ]
  },
  {
    file: "install/HOSTED-RUNTIME.md",
    snippets: [
      "OWNER_PORTAL_SECRET",
      "OWNER_PORTAL_PASSCODE_HASH",
      "MCP_SERVER_AUTH_MODE",
      "MCP_OIDC_CLIENT_SECRET",
      "npm run auth:hash",
      "npm run auth:smoke",
      "npm run identity:smoke",
      "npm run db:rls:smoke",
      "npm run install:proof",
      "/api/install/proof-packet",
      "separate logical databases"
    ]
  },
  {
    file: "docs/implementation-readiness-cockpit.md",
    snippets: [
      "explicit auth mode",
      "npm run auth:smoke",
      "npm run install:proof",
      "/api/install/proof-packet",
      "npm run db:rls:smoke",
      "live database RLS smoke"
    ]
  }
];

for (const check of requiredSnippetChecks) {
  const raw = await readFile(path.join(root, check.file), "utf8");
  for (const snippet of check.snippets) {
    if (!raw.includes(snippet)) {
      throw new Error(`${check.file} must include ${snippet}`);
    }
  }
}

const mcpMap = JSON.parse(await readFile(path.join(root, "mcp", "property-os.mcp.json"), "utf8"));
JSON.parse(await readFile(path.join(root, "railway", "property-os-mcp.service.json"), "utf8"));
for (const field of ["resources", "tools", "prompts", "blockedV1Tools"]) {
  if (!Array.isArray(mcpMap[field]) || mcpMap[field].length === 0) {
    throw new Error(`mcp/property-os.mcp.json must include ${field}`);
  }
}

if (mcpMap.version !== "0.2.0" || !mcpMap.security?.controlledTransitions) {
  throw new Error("mcp/property-os.mcp.json must expose the v0.2 controlled-transition security contract");
}

const teamManifest = JSON.parse(await readFile(path.join(root, "agents", "team.manifest.json"), "utf8"));
if (!Array.isArray(teamManifest.profiles) || teamManifest.profiles.length < 10) {
  throw new Error("agents/team.manifest.json must include the full specialist team");
}

const swarmContract = await readFile(path.join(root, ".swarm", "property-os.yml"), "utf8");
for (const snippet of ["max_parallel_agents: 4", "authority", "compliance-reviewer", "visual-qa"]) {
  if (!swarmContract.includes(snippet)) {
    throw new Error(`.swarm/property-os.yml must include ${snippet}`);
  }
}

async function readJsonFiles(dir) {
  const absolute = path.join(root, dir);
  const names = await readdir(absolute);
  const files = names.filter((name) => name.endsWith(".json"));
  const records = [];
  for (const file of files) {
    const filePath = path.join(absolute, file);
    const raw = await readFile(filePath, "utf8");
    records.push({ file: path.join(dir, file), data: JSON.parse(raw) });
  }
  return records;
}

function requireField(record, field) {
  if (!record.data[field]) {
    throw new Error(`${record.file} is missing required field: ${field}`);
  }
}

const properties = await readJsonFiles("data/properties");
for (const property of properties) {
  for (const field of ["id", "slug", "name", "status", "location", "units"]) {
    requireField(property, field);
  }
  if (!Array.isArray(property.data.units) || property.data.units.length === 0) {
    throw new Error(`${property.file} must define at least one unit`);
  }
  if (!property.data.approval || typeof property.data.approval.publicFactsApproved !== "boolean") {
    throw new Error(`${property.file} must include approval.publicFactsApproved`);
  }
}

const knowledge = await readJsonFiles("data/knowledge");
for (const entry of knowledge) {
  for (const field of ["id", "propertyId", "status", "articles"]) {
    requireField(entry, field);
  }
  if (!Array.isArray(entry.data.articles)) {
    throw new Error(`${entry.file} articles must be an array`);
  }
}

console.log(`Validated ${properties.length} property file(s) and ${knowledge.length} knowledge file(s).`);
