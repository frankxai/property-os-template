#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const requiredTools = [
  "create_agent_mission",
  "record_approved_evidence",
  "run_agent_draft",
  "record_agent_run_review"
];

function requiredValue(env, names) {
  const name = names.find((candidate) => env[candidate]?.trim());
  if (!name) throw new Error(`Missing required environment key: ${names.join(" or ")}.`);
  return env[name].trim();
}

function activationConfiguration(env) {
  const endpoint = new URL(requiredValue(env, ["PROPERTY_OS_REMOTE_MCP_URL", "PROPERTY_OS_MCP_PUBLIC_URL"]));
  const credential = requiredValue(env, ["PROPERTY_OS_REMOTE_MCP_TOKEN", "PROPERTY_OS_MCP_AUTH_TOKEN"]);
  const tenantId = requiredValue(env, ["PROPERTY_OS_ACTIVATION_TENANT_ID", "PROPERTY_OS_DEFAULT_TENANT_ID"]);
  const origin = env.PROPERTY_OS_REMOTE_MCP_ORIGIN?.trim() || env.PROPERTY_OS_MCP_ALLOWED_ORIGINS?.split(",")[0]?.trim() || "";
  const timeoutMs = Math.min(60000, Math.max(3000, Number(env.PROPERTY_OS_ACTIVATION_TIMEOUT_MS || 30000)));
  const local = new Set(["localhost", "127.0.0.1"]).has(endpoint.hostname);

  if (!new Set(["http:", "https:"]).has(endpoint.protocol) || (!local && endpoint.protocol !== "https:")) {
    throw new Error("Remote MCP URL must use HTTPS outside localhost.");
  }
  if (endpoint.username || endpoint.password) throw new Error("Remote MCP URL cannot contain credentials.");
  if (credential.length < 24) throw new Error("Remote MCP credential must contain at least 24 characters.");
  if (!Number.isFinite(timeoutMs)) throw new Error("PROPERTY_OS_ACTIVATION_TIMEOUT_MS must be numeric.");

  return {
    endpoint,
    credential,
    tenantId,
    origin,
    timeoutMs,
    allowWrites: env.PROPERTY_OS_ACTIVATION_ALLOW_WRITES === "true",
    allowMemory: env.PROPERTY_OS_ACTIVATION_ALLOW_MEMORY === "true"
  };
}

async function callTool(client, name, args) {
  const response = await client.callTool({ name, arguments: args });
  if (response.isError || !response.structuredContent) throw new Error(`${name} was rejected by the remote control plane.`);
  return response.structuredContent;
}

function assertNoExternalAction(receipt, operation) {
  if (receipt.contentApplied !== false || !Array.isArray(receipt.externalActionsPerformed) || receipt.externalActionsPerformed.length !== 0) {
    throw new Error(`${operation} crossed the no-external-action boundary.`);
  }
}

function assertHash(value, label) {
  if (!/^[a-f0-9]{64}$/.test(value || "")) throw new Error(`${label} was not a SHA-256 receipt.`);
}

export async function runRemoteActivation(env = process.env) {
  const config = activationConfiguration(env);
  const readinessUrl = new URL("/readyz", config.endpoint);
  const readinessResponse = await fetch(readinessUrl, { signal: AbortSignal.timeout(config.timeoutMs), cache: "no-store" });
  const readiness = await readinessResponse.json().catch(() => null);
  if (!readinessResponse.ok || !readiness?.ready || readiness.transport !== "streamable-http") {
    throw new Error(`Remote readiness failed with status ${readinessResponse.status}.`);
  }
  if (readiness.policyVersion !== "property-os-authority.v2" || readiness.blockedActionCount < 6) {
    throw new Error("Remote authority policy or blocked-action posture is incomplete.");
  }
  if (!readiness.stateStore?.ready || !readiness.agentRuntime?.configured) {
    throw new Error("Remote database or agent runtime is not ready.");
  }
  if (!config.allowMemory && readiness.stateStore.adapter !== "postgres") {
    throw new Error("Remote activation requires the Postgres state store.");
  }

  const headers = { authorization: `Bearer ${config.credential}` };
  if (config.origin) headers.origin = config.origin;
  const transport = new StreamableHTTPClientTransport(config.endpoint, {
    requestInit: { headers, signal: AbortSignal.timeout(config.timeoutMs) }
  });
  const client = new Client({ name: "property-os-remote-activation", version: "0.2.0" });
  let connected = false;

  try {
    await client.connect(transport);
    connected = true;
    const tools = await client.listTools();
    const availableTools = new Set(tools.tools.map((tool) => tool.name));
    const missingTools = requiredTools.filter((name) => !availableTools.has(name));
    if (missingTools.length) throw new Error(`Remote MCP is missing required tools: ${missingTools.join(", ")}.`);

    const baseProof = {
      checkedAt: new Date().toISOString(),
      mode: config.allowWrites ? "governed-write-proof" : "check-only",
      endpointHost: config.endpoint.host,
      tenantId: config.tenantId,
      readiness: {
        service: readiness.service,
        version: readiness.version,
        authMode: readiness.authMode,
        tenantMode: readiness.tenantMode,
        stateStore: readiness.stateStore.adapter,
        agentRuntimeMode: readiness.agentRuntime.mode,
        agentRuntimeConfigured: readiness.agentRuntime.configured,
        promptVersion: readiness.agentRuntime.promptVersion,
        policyVersion: readiness.policyVersion,
        blockedActionCount: readiness.blockedActionCount
      },
      requiredTools
    };

    if (!config.allowWrites) return baseProof;

    const proofId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const evidenceRef = `activation://property-os/${proofId}`;
    const mission = await callTool(client, "create_agent_mission", {
      organizationId: config.tenantId,
      role: "property-steward",
      objective: "Create one synthetic activation summary from the approved activation fact.",
      successMetric: "One evidence-cited draft reaches owner review with zero external actions."
    });
    if (mission.status !== "planned" || mission.authority !== "draft-only") throw new Error("Remote mission contract is invalid.");

    const evidence = await callTool(client, "record_approved_evidence", {
      organizationId: config.tenantId,
      ref: evidenceRef,
      excerpt: "Synthetic activation fact: this installation is being verified for owner-supervised draft generation only.",
      sourceType: "policy",
      sourceVersionHash: `activation-${proofId}`
    });
    if (evidence.approvalStatus !== "approved" || evidence.applicationScope !== "internal-evidence-store-only") {
      throw new Error("Remote evidence was not confined to the approved internal ledger.");
    }
    assertHash(evidence.contentHash, "Evidence content hash");

    const run = await callTool(client, "run_agent_draft", {
      organizationId: config.tenantId,
      missionId: mission.id,
      role: "property-steward",
      outputType: "weekly-owner-review",
      objective: "Summarize the synthetic activation fact and name owner review as the only next action.",
      evidenceRefs: [evidenceRef]
    });
    if (run.status !== "owner-review" || run.authority !== "draft-only" || run.evidenceRefs?.[0] !== evidenceRef) {
      throw new Error("Remote draft did not preserve mission authority and evidence scope.");
    }
    assertNoExternalAction(run, "run_agent_draft");
    assertHash(run.outputHash, "Agent output hash");
    if (run.evidenceSnapshot?.[0]?.contentHash !== evidence.contentHash) throw new Error("Remote draft did not freeze the approved evidence hash.");
    if (!run.modelAlias || !run.promptVersion || !Number.isFinite(run.latencyMs)) throw new Error("Remote model receipt is incomplete.");

    const review = await callTool(client, "record_agent_run_review", {
      organizationId: config.tenantId,
      runId: run.id,
      decision: "reject-draft",
      feedback: "Synthetic activation proof completed; this artifact must not be reused or applied."
    });
    if (review.status !== "rejected" || review.missionId !== mission.id) throw new Error("Remote review receipt is invalid.");
    assertNoExternalAction(review, "record_agent_run_review");

    return {
      ...baseProof,
      proof: {
        missionId: mission.id,
        evidenceRef,
        evidenceContentHash: evidence.contentHash,
        runId: run.id,
        outputHash: run.outputHash,
        modelAlias: run.modelAlias,
        promptVersion: run.promptVersion,
        riskLevel: run.riskLevel,
        latencyMs: run.latencyMs,
        totalTokens: run.usage?.totalTokens ?? null,
        reviewStatus: review.status,
        contentApplied: review.contentApplied,
        externalActionCount: review.externalActionsPerformed.length
      }
    };
  } finally {
    if (connected) await client.close().catch(() => undefined);
    else await transport.close().catch(() => undefined);
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    console.log(JSON.stringify(await runRemoteActivation(), null, 2));
  } catch (error) {
    console.error(`Remote activation failed: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  }
}
