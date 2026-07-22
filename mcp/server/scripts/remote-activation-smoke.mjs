import { randomUUID } from "node:crypto";
import { PropertyOsAgentRuntime } from "../src/agent-runtime.mjs";
import { createPropertyOsEngine } from "../src/domain.mjs";
import { startPropertyOsHttpServer } from "../src/http.mjs";
import { MemoryPropertyOsRepository } from "../src/repository.mjs";
import { runRemoteActivation } from "./remote-activation.mjs";

const token = `remote-activation-${randomUUID()}`;
const origin = "https://portal.example.com";
const agentRuntime = new PropertyOsAgentRuntime({
  env: { PROPERTY_OS_AI_MODEL: "test/provider-model" },
  generate: async (request) => ({
    output: {
      summary: "The governed activation draft is ready for owner review.",
      draft: "This installation supports owner-supervised draft generation only.",
      evidenceRefs: request.input.evidence.map((item) => item.ref),
      missingFacts: [],
      risks: ["This synthetic artifact must not be reused."],
      confidence: "high",
      ownerAction: "Review and reject this synthetic activation artifact.",
      recommendedNextSteps: ["Keep external actions disabled."]
    },
    usage: { inputTokens: 90, outputTokens: 60, totalTokens: 150 }
  })
});
const repository = new MemoryPropertyOsRepository();
const engine = createPropertyOsEngine({ repository, agentRuntime });
const { listener, port } = await startPropertyOsHttpServer({
  port: 0,
  host: "127.0.0.1",
  publicUrl: "http://127.0.0.1:8787/mcp",
  authMode: "static",
  staticToken: token,
  defaultTenantId: "activation-org",
  actorId: "activation-owner",
  actorRole: "owner",
  allowedHosts: ["127.0.0.1"],
  allowedOrigins: [origin],
  engine,
  repository
});

const baseEnv = {
  PROPERTY_OS_REMOTE_MCP_URL: `http://127.0.0.1:${port}/mcp`,
  PROPERTY_OS_REMOTE_MCP_TOKEN: token,
  PROPERTY_OS_REMOTE_MCP_ORIGIN: origin,
  PROPERTY_OS_ACTIVATION_TENANT_ID: "activation-org",
  PROPERTY_OS_ACTIVATION_ALLOW_MEMORY: "true"
};

try {
  const checkOnly = await runRemoteActivation(baseEnv);
  if (checkOnly.mode !== "check-only" || !checkOnly.readiness.agentRuntimeConfigured || checkOnly.readiness.agentRuntimeMode !== "structured-draft") {
    throw new Error("Remote activation check-only proof failed.");
  }

  const writeProof = await runRemoteActivation({ ...baseEnv, PROPERTY_OS_ACTIVATION_ALLOW_WRITES: "true" });
  if (
    writeProof.mode !== "governed-write-proof" || writeProof.proof.reviewStatus !== "rejected" ||
    writeProof.proof.contentApplied !== false || writeProof.proof.externalActionCount !== 0 ||
    writeProof.proof.totalTokens !== 150
  ) {
    throw new Error("Remote governed write proof crossed its activation boundary.");
  }
  console.log("Property OS remote activation proof passed.");
} finally {
  await repository.close?.();
  await new Promise((resolve) => listener.close(resolve));
}
