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
          "PROPERTY_OS_MCP_ALLOWED_TENANTS",
          "PROPERTY_OS_MCP_TENANT_CLAIM",
          "PROPERTY_OS_MCP_ROLE_CLAIM"
        ]
      : ["PROPERTY_OS_MCP_AUTH_TOKEN", "PROPERTY_OS_MCP_ALLOWED_TENANTS"];

  const portalIdentityKeys =
    config.deployment.authMode === "oidc"
      ? [
          "PROPERTY_OS_AUTH_MODE",
          "BETTER_AUTH_SECRET",
          "PROPERTY_OS_OIDC_ISSUER",
          "PROPERTY_OS_OIDC_AUTHORIZATION_URL",
          "PROPERTY_OS_OIDC_TOKEN_URL",
          "PROPERTY_OS_OIDC_JWKS_URL",
          "PROPERTY_OS_OIDC_CLIENT_ID",
          "PROPERTY_OS_OIDC_CLIENT_SECRET"
        ]
      : ["PROPERTY_OS_AUTH_MODE", "OWNER_PORTAL_SECRET", "OWNER_PORTAL_PASSCODE_HASH"];

  return {
    vercel: {
      requiredKeys: [
        "DATABASE_URL",
        "APP_BASE_URL",
        "PROPERTY_OS_ORG_ID",
        ...portalIdentityKeys,
        "MCP_SERVER_URL",
        "MCP_SERVER_AUTH_MODE",
        ...(config.deployment.authMode === "oidc"
          ? ["MCP_OIDC_TOKEN_URL", "MCP_OIDC_CLIENT_ID", "MCP_OIDC_CLIENT_SECRET", "MCP_OIDC_AUDIENCE", "MCP_OIDC_SCOPE"]
          : ["MCP_SERVER_ACCESS_TOKEN"]),
        "MCP_SERVER_ORIGIN",
        "OWNER_NOTIFICATION_WEBHOOK_URL",
        "OWNER_NOTIFICATION_WEBHOOK_SIGNING_SECRET",
        "OWNER_NOTIFICATION_FALLBACK_WEBHOOK_URL",
        "OWNER_NOTIFICATION_FALLBACK_SIGNING_SECRET",
        "OWNER_NOTIFICATION_WORKER_TOKEN"
      ],
      optionalKeys: [
        "PROPERTY_OS_OIDC_PROVIDER_ID",
        "PROPERTY_OS_OIDC_ORGANIZATION_CLAIM",
        "PROPERTY_OS_OIDC_ROLE_CLAIM",
        "GITHUB_ISSUE_REPO",
        "RUNTIME_STORE",
        "EMAIL_PROVIDER",
        "OBJECT_STORAGE_PROVIDER",
        "MCP_REQUEST_TIMEOUT_MS",
        "OWNER_NOTIFICATION_MAX_ATTEMPTS",
        "OWNER_NOTIFICATION_RETRY_BASE_MS",
        "OWNER_NOTIFICATION_ACK_TIMEOUT_MS",
        "OWNER_NOTIFICATION_CLAIM_LEASE_MS",
        "OWNER_NOTIFICATION_REQUEST_TIMEOUT_MS",
        "OWNER_NOTIFICATION_BATCH_SIZE"
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
        "PROPERTY_OS_ACTIVATION_TENANT_ID",
        ...(config.deployment.authMode === "oidc" ? ["PROPERTY_OS_EXPECTED_OIDC_SUBJECTS"] : [])
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
      status: "proof-required",
      ownerGate: true,
      evidence: ["auth smoke", "signed-token negatives", "pre-bound role matrix", "revocation test", "foreign-tenant denial", "portal-service-token-activation-RLS tenant equality"]
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
      id: "owner-notifications",
      label: "Owner notification lifecycle",
      status: "configuration-required",
      ownerGate: true,
      evidence: ["signed primary receipt", "bounded retry receipt", "signed fallback receipt", "idempotent owner acknowledgement"]
    },
    {
      id: "weekly-measurement",
      label: "Weekly owner evidence",
      status: "configuration-required",
      ownerGate: true,
      evidence: ["server-timestamped review", "five metric observations", "Keep Change Stop decisions", "zero external actions receipt"]
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
      evidence: ["rejected synthetic agent review", "urgent notification receipt", "five weekly metric observations", "signed acceptance record"]
    }
  ];
}

function successMetrics() {
  return [
    {
      id: "owner-review-time",
      hypothesis: "The weekly operating review is concise enough for routine owner use.",
      target: "under 30 minutes",
      evidence: "server-timestamped owner-review-time observation",
      status: "unmeasured"
    },
    {
      id: "self-service-coverage",
      hypothesis: "Approved knowledge answers most recurring renter questions without owner intervention.",
      target: "at least 70 percent",
      evidence: "owner-entered self-service-coverage observation",
      status: "unmeasured"
    },
    {
      id: "vacancy-readiness",
      hypothesis: "A channel-ready listing draft exists before a known vacancy begins.",
      target: "30 days before known exit",
      evidence: "owner-entered vacancy-readiness observation",
      status: "unmeasured"
    },
    {
      id: "urgent-acknowledgement",
      hypothesis: "The approved urgent route reaches the accountable owner promptly.",
      target: "under 5 minutes",
      evidence: "server-derived urgent-acknowledgement observation backed by the notification ledger",
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
      evidence: "system-policy observation bounded to the governed product action surface",
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
    recommendations.push("Bind reviewed agency members to immutable OIDC subjects, then prove the real callback, role denials, fixed session expiry, atomic revocation, and tenant equality before handling real agency data.");
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
        purpose: "Inquiries, support, portal approvals, notification outbox and events, weekly owner reviews and metric observations, operational audit, and public-facing runtime state."
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
        repository: "property-portal-template",
        path: "db/002-notification-lifecycle.sql",
        target: "portal-db",
        proof: "notification schema and forced-RLS receipt"
      },
      {
        order: 4,
        repository: "property-portal-template",
        path: "db/003-weekly-owner-review.sql",
        target: "portal-db",
        proof: "weekly schema, tenant-matching foreign key, and forced-RLS receipt"
      },
      {
        order: 5,
        repository: "property-portal-template",
        path: "db/004-tenant-oidc.sql",
        target: "portal-db",
        proof: "pinned transactional auth schema, reviewed pre-binding, fixed revocable sessions, and active membership receipt"
      },
      {
        order: 6,
        repository: "property-os-template",
        path: "mcp/server/db/001-control-plane.sql",
        target: "control-plane-db",
        proof: "control-plane schema receipt"
      },
      {
        order: 7,
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
      { repository: "property-portal-template", phase: "identity", command: "npm run identity:smoke", proof: "fail-closed mode, signed ID-token negatives, exact claims, role capabilities, and pinned schema contract pass" },
      ...(config.deployment.authMode === "oidc"
        ? [{ repository: "property-portal-template", phase: "identity", command: "npm run identity:db:smoke", proof: "reviewed pre-bound members, fixed sessions, revocation, and live identity database contract pass" }]
        : []),
      { repository: "property-portal-template", phase: "data-plane", command: "npm run db:rls:smoke", proof: "live portal tenant isolation passes" },
      { repository: "property-portal-template", phase: "owner-notifications", command: "npm run notification:smoke", proof: "signed outbox, retry, urgent fallback, and idempotent acknowledgement pass with zero downstream actions" },
      { repository: "property-portal-template", phase: "handoff", command: "npm run install:proof", proof: "secret-free install proof packet" },
      { repository: "property-portal-template", phase: "preview-gates", command: "npm run visual:qa", proof: "desktop and mobile visual evidence passes" },
      { repository: "property-portal-template", phase: "preview-gates", command: "npm run notification:visual", proof: "desktop and mobile notification console evidence passes" },
      { repository: "property-portal-template", phase: "weekly-measurement", command: "npm run weekly:smoke", proof: "idempotent review, five honest metrics, immutable replay, and zero external actions pass" },
      { repository: "property-portal-template", phase: "weekly-measurement", command: "npm run weekly:visual", proof: "desktop and mobile weekly evidence renders without overflow, clipping, or misleading current-week state" },
      { repository: "property-portal-template", phase: "security", command: "npm run audit", proof: "dependency audit passes" }
    ],
    acceptance: [
      { id: "approved-content", action: "Load only owner-approved facts, policies, media, and knowledge.", evidence: "signed content review", ownerApproval: true },
      { id: "portal-rls", action: "Apply portal migrations with a migration role and prove live tenant RLS.", evidence: "RLS smoke receipt", ownerApproval: false },
      { id: "control-ledger", action: "Apply MCP migrations to its separate logical database and non-bypass runtime role.", evidence: "migration and RLS receipt", ownerApproval: false },
      config.deployment.authMode === "oidc"
        ? { id: "identity-chain", action: "Prove portal organization, pre-bound owner identity, MCP service-token tenant, activation tenant, and both database RLS organizations are identical; reject a foreign tenant and revoke one test session.", evidence: "real IdP callback, signed token, pre-bound membership, foreign-tenant denial, atomic revocation, and tenant equality receipts", ownerApproval: false }
        : { id: "identity-chain", action: "Prove the private owner cookie, portal organization, static MCP default tenant, activation tenant, and both database RLS organizations are identical; reject an invalid cookie and foreign tenant request.", evidence: "private-pilot auth, static-token tenant, denial, expiry, and tenant equality receipts", ownerApproval: false },
      { id: "remote-activation", action: "Run check-only activation before enabling the approved synthetic write proof.", evidence: "redacted activation receipt", ownerApproval: true },
      { id: "owner-review", action: "Create one evidence-grounded draft and reject it in the owner workbench.", evidence: "model, evidence, output, and review hashes", ownerApproval: true },
      { id: "urgent-route", action: "Trigger a synthetic urgent request; prove signed primary delivery, bounded retry, fallback after the acknowledgement timeout, and idempotent owner acknowledgement.", evidence: "provider delivery, fallback, payload hash, and owner acknowledgement receipts", ownerApproval: true },
      { id: "portal-preview", action: "Inspect the exact Vercel preview on desktop and mobile before production.", evidence: "preview URL and visual QA evidence", ownerApproval: true },
      { id: "weekly-loop", action: "Run one timed weekly owner review, preserve met, not-met, and unmeasured states, and record Keep, Change, and Stop decisions.", evidence: "five tenant-scoped metric observations and zero external actions receipt", ownerApproval: true },
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
