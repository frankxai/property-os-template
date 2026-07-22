#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { blockedV1Tools, createPropertyOsEngine } from "./domain.mjs";
import { createTokenVerifier, loadHttpPolicy, protectedResourceMetadata, validateOrigin } from "./auth.mjs";
import { createRepositoryFromEnv } from "./repository.mjs";
import { createPropertyOsServer } from "./server-factory.mjs";

function jsonRpcError(res, status, code, message) {
  return res.status(status).json({ jsonrpc: "2.0", error: { code, message }, id: null });
}

export function createPropertyOsHttpApp(options = {}) {
  const policy = options.policy ?? loadHttpPolicy(options.env ?? process.env, options);
  const app = createMcpExpressApp({ host: policy.host, allowedHosts: policy.allowedHosts });
  const verifier = createTokenVerifier(policy);
  const repository = options.repository ?? (options.engine ? options.engine.repository : createRepositoryFromEnv(options.env ?? process.env));
  const engine = options.engine ?? createPropertyOsEngine({ repository });
  const resourceMetadataUrl = new URL("/.well-known/oauth-protected-resource/mcp", policy.publicUrl).toString();

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok", service: "property-os-mcp", version: "0.2.0" });
  });

  app.get("/readyz", async (_req, res) => {
    const stateStore = await repository.health();
    const agentRuntime = engine.agentRuntime.health();
    const durableStateReady = stateStore.ready && (!policy.requireDurableState || stateStore.durable === true);
    res.status(durableStateReady ? 200 : 503).json({
      ready: durableStateReady,
      service: "property-os-mcp",
      version: "0.2.0",
      protocolVersion: "2025-11-25",
      transport: "streamable-http",
      sessionMode: "stateless-json",
      authMode: policy.authMode,
      tenantMode: policy.authMode === "oidc" ? "tenant-bound-verified-claim" : "single-tenant-token",
      durableStateRequired: policy.requireDurableState,
      stateStore,
      agentRuntime,
      policyVersion: "property-os-authority.v2",
      blockedActionCount: blockedV1Tools.length
    });
  });

  app.get("/.well-known/oauth-protected-resource/mcp", (_req, res) => {
    res.json(protectedResourceMetadata(policy));
  });

  app.use("/mcp", (req, res, next) => {
    const origin = req.get("origin");
    if (!validateOrigin(policy, origin)) {
      return jsonRpcError(res, 403, -32003, "Origin is not allowed for this MCP deployment.");
    }
    return next();
  });

  app.use("/mcp", requireBearerAuth({
    verifier,
    requiredScopes: ["property:read"],
    resourceMetadataUrl
  }));

  app.post("/mcp", async (req, res) => {
    const { server } = createPropertyOsServer({ engine });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });

    try {
      await server.connect(transport);
      res.once("close", async () => {
        await transport.close();
        await server.close();
      });
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Property OS MCP request failed", { message: error?.message ?? "unknown error" });
      if (!res.headersSent) jsonRpcError(res, 500, -32603, "Internal MCP server error.");
    }
  });

  app.get("/mcp", (_req, res) => {
    res.set("Allow", "POST");
    return jsonRpcError(res, 405, -32000, "GET event streams are not enabled for this stateless deployment.");
  });

  app.delete("/mcp", (_req, res) => {
    res.set("Allow", "POST");
    return jsonRpcError(res, 405, -32000, "Stateless sessions cannot be deleted.");
  });

  return { app, policy, engine, repository };
}

export async function startPropertyOsHttpServer(options = {}) {
  const port = Number(options.port ?? process.env.PORT ?? 8787);
  const { app, policy, repository } = createPropertyOsHttpApp({ ...options, port });
  const listener = await new Promise((resolve, reject) => {
    const server = app.listen(port, policy.host, () => resolve(server));
    server.on("error", reject);
  });
  const address = listener.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  console.error(`Property OS MCP v0.2.0 ready on ${policy.host}:${actualPort}`);
  return { listener, policy, port: actualPort, repository };
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const { listener, repository } = await startPropertyOsHttpServer();
  const shutdown = async () => {
    await repository.close?.();
    listener.close(() => process.exit(0));
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
