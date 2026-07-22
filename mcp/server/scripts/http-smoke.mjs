import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { startPropertyOsHttpServer } from "../src/http.mjs";

const token = randomUUID();
const { listener, port } = await startPropertyOsHttpServer({
  port: 0,
  host: "127.0.0.1",
  publicUrl: "http://127.0.0.1:8787/mcp",
  authMode: "static",
  staticToken: token,
  defaultTenantId: "sample-org",
  actorId: "smoke-owner",
  actorRole: "owner",
  allowedHosts: ["127.0.0.1"],
  allowedOrigins: ["https://portal.example.com"]
});
const baseUrl = `http://127.0.0.1:${port}`;

try {
  const health = await fetch(`${baseUrl}/healthz`);
  if (!health.ok || (await health.json()).status !== "ok") throw new Error("HTTP liveness check failed.");

  const readiness = await fetch(`${baseUrl}/readyz`);
  const readinessBody = await readiness.json();
  if (!readiness.ok || readinessBody.authMode !== "static" || readinessBody.transport !== "streamable-http") {
    throw new Error("HTTP readiness contract failed.");
  }

  const unauthorized = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "smoke", version: "0.2.0" } } })
  });
  if (unauthorized.status !== 401) throw new Error(`Expected 401, received ${unauthorized.status}.`);

  const badOrigin = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, origin: "https://attacker.example", "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "smoke", version: "0.2.0" } } })
  });
  if (badOrigin.status !== 403) throw new Error(`Expected 403 for rejected Origin, received ${badOrigin.status}.`);

  const initialized = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, origin: "https://portal.example.com", "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "smoke", version: "0.2.0" } } })
  });
  const initializedBody = await initialized.json();
  if (!initialized.ok || initializedBody.result?.serverInfo?.name !== "property-os") {
    throw new Error(`Authenticated HTTP initialization failed (${initialized.status}): ${JSON.stringify(initializedBody)}`);
  }

  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
    requestInit: {
      headers: {
        authorization: `Bearer ${token}`,
        origin: "https://portal.example.com"
      }
    }
  });
  const client = new Client({ name: "property-os-http-smoke", version: "0.2.0" });
  await client.connect(transport);
  const proposalResponse = await client.callTool({
    name: "propose_controlled_transition",
    arguments: {
      organizationId: "sample-org",
      operation: "mark-draft-reviewed",
      resourceId: "listing:sample-property:own-website",
      baseVersionHash: "version-http-1",
      payloadHash: "payload-http-1",
      summary: "Mark the sample draft reviewed after owner inspection."
    }
  });
  const proposal = proposalResponse.structuredContent;
  const decisionResponse = await client.callTool({
    name: "record_owner_decision",
    arguments: { organizationId: "sample-org", proposalId: proposal.id, decision: "approve" }
  });
  const decision = decisionResponse.structuredContent;
  const applyResponse = await client.callTool({
    name: "apply_approved_transition",
    arguments: {
      organizationId: "sample-org",
      proposalId: proposal.id,
      approvalReceiptId: decision.approvalReceipt.id,
      idempotencyKey: "http-smoke-transition-1"
    }
  });
  if (!applyResponse.structuredContent?.contentApplied || applyResponse.structuredContent?.externalActionsPerformed?.length) {
    throw new Error("Cross-request controlled transition did not return safe apply evidence.");
  }
  await client.close();

  console.log("Property OS Streamable HTTP smoke passed.");
} finally {
  await new Promise((resolve) => listener.close(resolve));
}
