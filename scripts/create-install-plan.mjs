import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const repositoryRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputRoot = path.join(repositoryRoot, "install-output");
const slugPattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])$/;
const forbiddenKeyPattern = /(?:secret|token|password|passcode|credential|api[-_]?key|email|phone|contact|owner[-_]?name|street|postal|live[-_]?url)/i;
const forbiddenExactKeys = new Set(["address", "owner", "renter", "tenantname"]);
const sensitiveValuePatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bBearer\s+[A-Za-z0-9._~-]+/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:sk|rk|pk)_[A-Za-z0-9_-]{16,}\b/
];

const ownerApprovalRequiredFor = [
  "availability",
  "pricing",
  "legal-or-lease-language",
  "refunds-or-deposits",
  "urgent-maintenance",
  "personal-data",
  "renter-facing-content",
  "external-actions"
];

const blockedActions = [
  "publish_listing",
  "send_renter_message",
  "dispatch_vendor",
  "approve_applicant",
  "disclose_access_secret",
  "change_price_or_availability"
];

const readinessLabels = {
  ownerFactsApproved: "Owner-approved property facts",
  mediaRightsApproved: "Media rights approval",
  publicAddressPolicyApproved: "Public address disclosure policy",
  privacyRolesAssigned: "Controller, processor, and access roles",
  retentionPolicyApproved: "Retention and deletion policy",
  incidentOwnerAssigned: "Named incident owner",
  legalReviewComplete: "Jurisdiction-specific legal review",
  notificationRouteApproved: "Urgent notification route"
};

let validatorsPromise;

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    );
  }

  return value;
}

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function findSensitiveInput(value, pointer = "$") {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      findSensitiveInput(value[index], `${pointer}[${index}]`);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (forbiddenKeyPattern.test(key) || forbiddenExactKeys.has(normalizedKey)) {
        throw new Error(`Install configuration must not include sensitive field ${pointer}.${key}`);
      }
      findSensitiveInput(child, `${pointer}.${key}`);
    }
    return;
  }

  if (typeof value === "string" && sensitiveValuePatterns.some((pattern) => pattern.test(value))) {
    throw new Error(`Install configuration contains a sensitive-looking value at ${pointer}`);
  }
}

function formatSchemaErrors(errors = []) {
  return errors
    .map((error) => `${error.instancePath || "$"} ${error.message}`)
    .join("; ");
}

async function loadValidators() {
  if (!validatorsPromise) {
    validatorsPromise = (async () => {
      const [configSchema, planSchema] = await Promise.all([
        readFile(path.join(repositoryRoot, "schemas", "install-config.schema.json"), "utf8").then(JSON.parse),
        readFile(path.join(repositoryRoot, "schemas", "install-plan.schema.json"), "utf8").then(JSON.parse)
      ]);
      const ajv = new Ajv2020({ allErrors: true, strict: true });
      addFormats(ajv);
      return {
        validateConfig: ajv.compile(configSchema),
        validatePlan: ajv.compile(planSchema)
      };
    })();
  }
  return validatorsPromise;
}

function environmentPlan(config) {
  const railwayIdentityKeys =
    config.deployment.authMode === "oidc"
      ? [
          "PROPERTY_OS_MCP_OIDC_ISSUER",
          "PROPERTY_OS_MCP_OIDC_AUDIENCE",
          "PROPERTY_OS_MCP_OIDC_JWKS_URL",
          "PROPERTY_OS_MCP_TENANT_CLAIM",
          "PROPERTY_OS_MCP_ROLE_CLAIM"
        ]
      : ["PROPERTY_OS_MCP_AUTH_TOKEN"];

  const portalIdentityKeys =
    config.deployment.authMode === "oidc"
      ? ["AUTH_PROVIDER", "OWNER_ADMIN_EMAIL"]
      : ["OWNER_PORTAL_SECRET", "OWNER_PORTAL_PASSCODE_HASH"];

  return {
    vercel: {
      requiredKeys: [
        "DATABASE_URL",
        "APP_BASE_URL",
        "OWNER_NOTIFICATION_EMAIL",
        "PROPERTY_OS_ORG_ID",
        ...portalIdentityKeys,
        "MCP_SERVER_URL",
        "MCP_SERVER_ACCESS_TOKEN",
        "MCP_SERVER_ORIGIN"
      ],
      optionalKeys: [
        "OWNER_PORTAL_API_TOKEN",
        "OWNER_NOTIFICATION_WEBHOOK_URL",
        "GITHUB_ISSUE_REPO",
        "RUNTIME_STORE",
        "EMAIL_PROVIDER",
        "OBJECT_STORAGE_PROVIDER",
        "MCP_REQUEST_TIMEOUT_MS"
      ],
      valuePolicy: "Store values only in Vercel environment settings; the plan records key names, never values."
    },
    railway: {
      requiredKeys: [
        "DATABASE_URL",
        "PROPERTY_OS_MCP_AUTH_MODE",
        ...railwayIdentityKeys,
        "PROPERTY_OS_MCP_PUBLIC_URL",
        "PROPERTY_OS_MCP_ALLOWED_HOSTS",
        "PROPERTY_OS_MCP_ALLOWED_ORIGINS",
        "PROPERTY_OS_DEFAULT_TENANT_ID",
        "PROPERTY_OS_AUDIT_MODE",
        "PROPERTY_OS_AI_MODEL",
        "PROPERTY_OS_AI_TIMEOUT_MS",
        "PROPERTY_OS_AI_MAX_OUTPUT_TOKENS",
        "AI_GATEWAY_API_KEY"
      ],
      optionalKeys: ["PROPERTY_OS_MCP_ACTOR_ID", "PROPERTY_OS_MCP_ACTOR_ROLE"],
      valuePolicy: "Store values only in Railway environment settings; use a control-plane database credential unavailable to Vercel."
    },
    operator: {
      requiredKeys: [
        "PROPERTY_OS_REMOTE_MCP_URL",
        "PROPERTY_OS_REMOTE_MCP_TOKEN",
        "PROPERTY_OS_REMOTE_MCP_ORIGIN",
        "PROPERTY_OS_ACTIVATION_TENANT_ID"
      ],
      optionalKeys: [
        "PROPERTY_OS_ACTIVATION_TIMEOUT_MS",
        "PROPERTY_OS_ACTIVATION_ALLOW_WRITES",
        "PROPERTY_OS_ACTIVATION_ALLOW_MEMORY"
      ],
      valuePolicy: "Load values from an approved local secret store for activation only; never write them into the plan or repository."
    }
  };
}

function phaseGates(config, unresolved) {
  return [
    {
      id: "install-contract",
      label: "Install contract",
      status: "planned",
      ownerGate: false,
      evidence: ["schema-valid config", "source config hash", "stable plan hash"]
    },
    {
      id: "owner-content",
      label: "Owner content and rights",
      status: unresolved.length > 0 ? "waiting-owner" : "proof-required",
      ownerGate: true,
      evidence: ["signed facts review", "rights ledger", "address disclosure decision"]
    },
    {
      id: "identity-boundary",
      label: "Identity and access boundary",
      status: config.deployment.authMode === "oidc" ? "implementation-required" : "proof-required",
      ownerGate: true,
      evidence: ["auth smoke", "role matrix", "revocation test"]
    },
    {
      id: "portal-data-plane",
      label: "Portal tenant data plane",
      status: "configuration-required",
      ownerGate: false,
      evidence: ["portal database migration receipt", "live portal RLS smoke"]
    },
    {
      id: "control-plane",
      label: "Governed MCP control plane",
      status: "configuration-required",
      ownerGate: false,
      evidence: ["control-plane migration receipt", "Railway ready check", "remote activation receipt"]
    },
    {
      id: "portal-preview",
      label: "Vercel portal preview",
      status: "proof-required",
      ownerGate: true,
      evidence: ["preview URL", "install proof packet", "desktop and mobile visual QA"]
    },
    {
      id: "pilot-acceptance",
      label: "Owner pilot acceptance",
      status: "waiting-owner",
      ownerGate: true,
      evidence: ["rejected synthetic agent review", "urgent notification receipt", "weekly review receipt", "signed acceptance record"]
    }
  ];
}

function successMetrics() {
  return [
    {
      id: "owner-review-time",
      hypothesis: "The weekly operating review is concise enough for routine owner use.",
      target: "under 30 minutes",
      evidence: "timestamped weekly review receipt",
      status: "unmeasured"
    },
    {
      id: "self-service-coverage",
      hypothesis: "Approved knowledge answers most recurring renter questions without owner intervention.",
      target: "at least 70 percent",
      evidence: "article coverage and escalation analytics",
      status: "unmeasured"
    },
    {
      id: "vacancy-readiness",
      hypothesis: "A channel-ready listing draft exists before a known vacancy begins.",
      target: "30 days before known exit",
      evidence: "availability timeline and owner-reviewed draft receipt",
      status: "unmeasured"
    },
    {
      id: "urgent-acknowledgement",
      hypothesis: "The approved urgent route reaches the accountable owner promptly.",
      target: "under 5 minutes",
      evidence: "notification provider and owner acknowledgement receipt",
      status: "unmeasured"
    },
    {
      id: "partner-activation",
      hypothesis: "A trained implementer can install the sample property with the documented path.",
      target: "under 60 minutes",
      evidence: "install proof packet and timed activation log",
      status: "unmeasured"
    },
    {
      id: "unauthorized-actions",
      hypothesis: "No agent can perform a consequential external action in v1.",
      target: "zero",
      evidence: "blocked-action and controlled-transition audit",
      status: "unmeasured"
    }
  ];
}

export async function createInstallPlan(config, { generatedAt = new Date().toISOString() } = {}) {
  findSensitiveInput(config);
  const { validateConfig, validatePlan } = await loadValidators();

  if (!validateConfig(config)) {
    throw new Error(`Invalid install configuration: ${formatSchemaErrors(validateConfig.errors)}`);
  }

  if (config.portfolio.unitCount < config.portfolio.propertyCount) {
    throw new Error("Invalid install configuration: portfolio.unitCount must be at least portfolio.propertyCount");
  }

  const unresolved = Object.entries(config.readiness)
    .filter(([, complete]) => !complete)
    .map(([key]) => readinessLabels[key]);

  const recommendations = [
    "Keep the install at planned-not-proven until host-generated evidence passes every release gate.",
    "Use separate logical Postgres databases and least-privilege roles for the portal and MCP control plane."
  ];

  if (config.deployment.authMode === "static-private-pilot") {
    recommendations.push("Keep static passcode authentication private and single-tenant; implement and prove OIDC before agency use.");
  } else {
    recommendations.push("Implement the portal OIDC adapter, role mapping, revocation, and session tests before handling real agency data.");
  }
  if (config.deployment.storageProvider === "tbd") {
    recommendations.push("Select a region-compatible private object store and prove signed access, retention, and deletion behavior.");
  }
  if (config.deployment.notificationProvider === "tbd") {
    recommendations.push("Select an urgent notification provider and prove delivery, retry, acknowledgement, and fallback receipts.");
  }
  if (!config.deployment.dataResidencyReviewed) {
    recommendations.push("Review service regions and subprocessors before importing personal or renter data.");
  }

  const stablePlan = {
    schema: "property-os.installPlan.v1",
    installationId: config.installationId,
    tenantId: config.tenantId,
    edition: config.edition,
    operatorMode: config.operatorMode,
    sourceConfigHash: sha256(config),
    posture: "planned-not-proven",
    proofStatus: "unverified",
    architecture: {
      portal: {
        provider: "vercel",
        repository: "property-portal-template",
        purpose: "Premium renter experience, protected owner workbench, and public intake."
      },
      controlPlane: {
        provider: "railway",
        repository: "property-os-template/mcp/server",
        purpose: "Authenticated MCP tools, approved evidence, structured drafts, and owner review receipts."
      },
      portalStore: {
        provider: "managed-postgres",
        logicalDatabase: "portal-db",
        isolation: "tenant-rls",
        purpose: "Inquiries, support, portal approvals, operational audit, and public-facing runtime state."
      },
      controlPlaneLedger: {
        provider: "managed-postgres",
        logicalDatabase: "control-plane-db",
        isolation: "tenant-rls",
        purpose: "Agent missions, approved evidence, model receipts, reviews, and controlled transitions."
      },
      modelRuntime: {
        provider: "vercel-ai-gateway",
        repository: "property-os-template/mcp/server",
        purpose: "Release-pinned structured draft generation inside the governed MCP service."
      },
      databaseBoundary: "The Vercel and Railway DATABASE_URL values must target separate logical databases and roles; data crosses only through authenticated MCP tools."
    },
    governance: {
      authority: "draft-only",
      ownerApprovalRequiredFor,
      blockedActions,
      claimBoundary: "This packet is a configuration plan, not security, legal, deployment, commercial, or production-readiness evidence."
    },
    readiness: {
      selfAttested: config.readiness,
      unresolved,
      recommendations
    },
    phaseGates: phaseGates(config, unresolved),
    environment: environmentPlan(config),
    migrations: [
      {
        order: 1,
        repository: "property-portal-template",
        path: "db/schema.sql",
        target: "portal-db",
        proof: "migration receipt"
      },
      {
        order: 2,
        repository: "property-portal-template",
        path: "db/rls.sql",
        target: "portal-db",
        proof: "npm run db:rls:smoke"
      },
      {
        order: 3,
        repository: "property-os-template",
        path: "mcp/server/db/001-control-plane.sql",
        target: "control-plane-db",
        proof: "control-plane schema receipt"
      },
      {
        order: 4,
        repository: "property-os-template",
        path: "mcp/server/db/002-governed-agent-runtime.sql",
        target: "control-plane-db",
        proof: "npm --prefix mcp/server run test:postgres"
      }
    ],
    commands: [
      { repository: "property-os-template", phase: "install", command: "npm ci", proof: "locked root dependencies installed" },
      { repository: "property-os-template", phase: "local-gates", command: "npm run validate", proof: "workspace, privacy, installer, policy, MCP, and database tests pass" },
      { repository: "property-os-template", phase: "security", command: "npm run audit", proof: "dependency audit passes" },
      { repository: "property-os-template", phase: "live-control-plane", command: "npm run activation:verify", proof: "check-only then explicit synthetic write and rejection receipts" },
      { repository: "property-portal-template", phase: "install", command: "npm ci", proof: "locked portal dependencies installed" },
      { repository: "property-portal-template", phase: "local-gates", command: "npm run validate", proof: "content, privacy, agent, and MCP contract tests pass" },
      { repository: "property-portal-template", phase: "local-gates", command: "npm run typecheck", proof: "TypeScript passes" },
      { repository: "property-portal-template", phase: "local-gates", command: "npm run build", proof: "production build passes" },
      { repository: "property-portal-template", phase: "preview-gates", command: "npm run smoke", proof: "renter and owner route smoke passes" },
      { repository: "property-portal-template", phase: "identity", command: "npm run auth:smoke", proof: "protected routes and APIs reject unauthorized access" },
      { repository: "property-portal-template", phase: "data-plane", command: "npm run db:rls:smoke", proof: "live portal tenant isolation passes" },
      { repository: "property-portal-template", phase: "handoff", command: "npm run install:proof", proof: "secret-free install proof packet" },
      { repository: "property-portal-template", phase: "preview-gates", command: "npm run visual:qa", proof: "desktop and mobile visual evidence passes" },
      { repository: "property-portal-template", phase: "security", command: "npm run audit", proof: "dependency audit passes" }
    ],
    acceptance: [
      { id: "approved-content", action: "Load only owner-approved facts, policies, media, and knowledge.", evidence: "signed content review", ownerApproval: true },
      { id: "portal-rls", action: "Apply portal migrations with a migration role and prove live tenant RLS.", evidence: "RLS smoke receipt", ownerApproval: false },
      { id: "control-ledger", action: "Apply MCP migrations to its separate logical database and non-bypass runtime role.", evidence: "migration and RLS receipt", ownerApproval: false },
      { id: "remote-activation", action: "Run check-only activation before enabling the approved synthetic write proof.", evidence: "redacted activation receipt", ownerApproval: true },
      { id: "owner-review", action: "Create one evidence-grounded draft and reject it in the owner workbench.", evidence: "model, evidence, output, and review hashes", ownerApproval: true },
      { id: "urgent-route", action: "Trigger a synthetic urgent request and acknowledge the approved fallback route.", evidence: "delivery and acknowledgement receipt", ownerApproval: true },
      { id: "portal-preview", action: "Inspect the exact Vercel preview on desktop and mobile before production.", evidence: "preview URL and visual QA evidence", ownerApproval: true },
      { id: "weekly-loop", action: "Run one timed weekly owner review and record unresolved work.", evidence: "timestamped weekly review receipt", ownerApproval: true },
      { id: "launch-record", action: "Sign what is live, manual, blocked, deferred, supported, and reversible.", evidence: "owner acceptance record", ownerApproval: true }
    ],
    successMetrics: successMetrics(),
    commercial: {
      offerId: config.commercial.offerId,
      supportTier: config.commercial.supportTier,
      commercialStatus: "not-contracted",
      scopeBoundary: "Pricing, service levels, subprocessors, incident ownership, and ongoing support require a separate written agreement."
    }
  };

  const plan = {
    ...stablePlan,
    generatedAt,
    planHash: sha256(stablePlan)
  };

  if (!validatePlan(plan)) {
    throw new Error(`Generated install plan failed its schema: ${formatSchemaErrors(validatePlan.errors)}`);
  }

  return plan;
}

export async function createInstallPlanFromFile(configPath, options) {
  const absoluteConfigPath = path.resolve(repositoryRoot, configPath);
  const config = JSON.parse(await readFile(absoluteConfigPath, "utf8"));
  return createInstallPlan(config, options);
}

export async function writeInstallPlan(plan, outputName = plan.installationId) {
  if (!slugPattern.test(outputName) || outputName.length > 64) {
    throw new Error("Output name must be a 3-64 character lowercase slug");
  }
  await mkdir(outputRoot, { recursive: true });
  const outputPath = path.join(outputRoot, `${outputName}.plan.json`);
  await writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return outputPath;
}

function parseArgs(argv) {
  const args = { config: undefined, outputName: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--config") {
      args.config = argv[index + 1];
      index += 1;
    } else if (argument === "--output-name") {
      args.outputName = argv[index + 1];
      index += 1;
    } else if (argument === "--help") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: npm run install:plan -- --config <public-safe-config.json> [--output-name <slug>]");
    return;
  }
  if (!args.config) {
    throw new Error("Missing --config. Start with install/sample-install.config.json.");
  }
  const plan = await createInstallPlanFromFile(args.config);
  const outputPath = await writeInstallPlan(plan, args.outputName);
  console.log(
    JSON.stringify(
      {
        output: path.relative(repositoryRoot, outputPath).replaceAll("\\", "/"),
        installationId: plan.installationId,
        posture: plan.posture,
        proofStatus: plan.proofStatus,
        sourceConfigHash: plan.sourceConfigHash,
        planHash: plan.planHash
      },
      null,
      2
    )
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
