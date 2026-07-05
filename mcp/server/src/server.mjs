#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const capabilityMap = JSON.parse(
  await readFile(new URL("../../property-os.mcp.json", import.meta.url), "utf8")
);

const sampleResources = {
  "property://profile/sample-property": {
    name: "Sample Property",
    status: "owner-review",
    note: "Sample-safe profile. Replace with tenant-scoped runtime data in production."
  },
  "property://knowledge/sample-property": {
    articles: [
      "Approved facts only.",
      "No access codes, payment data, or private owner notes."
    ]
  },
  "property://listing-drafts/sample-property": {
    drafts: ["own-website", "kleinanzeigen", "immoscout24", "immowelt"],
    publicationMode: "dry-run-only"
  },
  "property://implementation-readiness/sample-org": {
    posture: "template-ready",
    portalPath: "/admin/implementation",
    layers: [
      "approved property knowledge",
      "premium renter and owner portal",
      "secure runtime data layer",
      "Codex, Claude, and MCP agent substrate",
      "listing channel operations",
      "owner notification loop",
      "community and partner packaging"
    ],
    blockedV1Actions: [
      "publish listing",
      "send renter message",
      "dispatch vendor",
      "approve applicant",
      "disclose access secret",
      "change price or availability"
    ]
  }
};

const tools = [
  {
    name: "draft_listing",
    description: "Create a channel-specific listing draft from approved property facts.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        channel: { type: "string" }
      },
      required: ["propertyId", "channel"]
    }
  },
  {
    name: "draft_reply",
    description: "Draft an owner-reviewed inquiry reply from approved knowledge.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        inquiry: { type: "string" }
      },
      required: ["propertyId", "inquiry"]
    }
  },
  {
    name: "create_support_ticket_summary",
    description: "Summarize and classify renter support without repair promises.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        message: { type: "string" },
        urgency: { type: "string" }
      },
      required: ["propertyId", "message"]
    }
  },
  {
    name: "request_owner_approval",
    description: "Create an owner approval request for a consequential action.",
    inputSchema: {
      type: "object",
      properties: {
        sourceId: { type: "string" },
        ownerAction: { type: "string" }
      },
      required: ["sourceId", "ownerAction"]
    }
  },
  {
    name: "create_sanitized_github_issue",
    description: "Prepare a sanitized GitHub issue body without private renter data.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string" }
      },
      required: ["title", "summary"]
    }
  },
  {
    name: "run_listing_dry_run",
    description: "Create a dry-run listing payload without publishing.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        channel: { type: "string" }
      },
      required: ["propertyId", "channel"]
    }
  },
  {
    name: "create_implementation_readiness_snapshot",
    description: "Create a partner-safe install readiness summary for owner, agency, or implementer review.",
    inputSchema: {
      type: "object",
      properties: {
        organizationId: { type: "string" },
        portalUrl: { type: "string" },
        runtimeMode: { type: "string" }
      },
      required: ["organizationId"]
    }
  }
];

const prompts = capabilityMap.prompts.map((name) => ({
  name,
  description: `Property OS workflow prompt: ${name}`
}));

function ok(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function fail(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function textContent(value) {
  return {
    content: [
      {
        type: "text",
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2)
      }
    ]
  };
}

function sanitize(value, maxLength = 1200) {
  if (typeof value !== "string") return "";
  return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export async function callTool(name, args = {}) {
  if (capabilityMap.blockedV1Tools.includes(name)) {
    return textContent({
      blocked: true,
      ownerApprovalRequired: true,
      reason: `${name} is blocked in v1. Use dry-run or owner approval workflow.`
    });
  }

  if (!tools.some((tool) => tool.name === name)) {
    throw new Error(`Unknown tool: ${name}`);
  }

  if (name === "draft_listing" || name === "run_listing_dry_run") {
    return textContent({
      tool: name,
      propertyId: sanitize(args.propertyId, 120),
      channel: sanitize(args.channel, 80),
      status: "DRAFT - OWNER REVIEW REQUIRED",
      publicationMode: "dry-run-only",
      missingFacts: ["rent", "availability", "media rights", "required channel disclosures"],
      blockedActions: capabilityMap.blockedV1Tools
    });
  }

  if (name === "draft_reply") {
    return textContent({
      status: "DRAFT - OWNER REVIEW REQUIRED",
      propertyId: sanitize(args.propertyId, 120),
      summary: sanitize(args.inquiry, 600),
      ownerAction: "Approve or edit before sending. Do not promise availability, pricing, lease terms, or acceptance."
    });
  }

  if (name === "create_support_ticket_summary") {
    return textContent({
      status: "OWNER REVIEW REQUIRED",
      propertyId: sanitize(args.propertyId, 120),
      urgency: sanitize(args.urgency, 80) || "standard",
      summary: sanitize(args.message, 800),
      ownerAction: "Confirm urgency and next step. Do not promise repair timing or vendor dispatch."
    });
  }

  if (name === "request_owner_approval") {
    return textContent({
      approvalId: `appr-${Date.now()}`,
      sourceId: sanitize(args.sourceId, 120),
      status: "owner-review",
      ownerAction: sanitize(args.ownerAction, 500)
    });
  }

  if (name === "create_implementation_readiness_snapshot") {
    return textContent({
      status: "PARTNER REVIEW REQUIRED",
      organizationId: sanitize(args.organizationId, 120),
      portalUrl: sanitize(args.portalUrl, 240) || "Set APP_BASE_URL and verify /admin/implementation",
      runtimeMode: sanitize(args.runtimeMode, 80) || "demo",
      readyLayers: ["premium portal", "manual listing drafts", "owner approval gates", "partner offer ladder"],
      configureBeforeProduction: ["database", "auth", "notifications", "private client workspace", "monitoring"],
      blockedActions: capabilityMap.blockedV1Tools,
      ownerAction: "Approve production gates, support scope, and private-data handling before real renter operations."
    });
  }

  return textContent({
    title: sanitize(args.title, 120),
    body: sanitize(args.summary, 1000),
    privateDataPolicy: "Sanitized issue draft only. Do not include renter identity, access, payment, lease, or private owner data."
  });
}

export async function handleRequest(request) {
  const id = request.id ?? null;
  const method = request.method;

  if (method === "initialize") {
    return ok(id, {
      protocolVersion: "2025-06-18",
      capabilities: { resources: {}, tools: {}, prompts: {} },
      serverInfo: { name: capabilityMap.name, version: capabilityMap.version }
    });
  }

  if (method === "resources/list") {
    return ok(id, {
      resources: Object.keys(sampleResources).map((uri) => ({
        uri,
        name: uri.replace("property://", ""),
        mimeType: "application/json"
      }))
    });
  }

  if (method === "resources/read") {
    const uri = request.params?.uri;
    const resource = sampleResources[uri];
    if (!resource) return fail(id, -32004, `Unknown resource: ${uri}`);
    return ok(id, {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(resource, null, 2)
        }
      ]
    });
  }

  if (method === "tools/list") {
    return ok(id, { tools });
  }

  if (method === "tools/call") {
    try {
      return ok(id, await callTool(request.params?.name, request.params?.arguments ?? {}));
    } catch (error) {
      return fail(id, -32601, error.message);
    }
  }

  if (method === "prompts/list") {
    return ok(id, { prompts });
  }

  if (method === "prompts/get") {
    const name = request.params?.name;
    if (!capabilityMap.prompts.includes(name)) return fail(id, -32601, `Unknown prompt: ${name}`);
    return ok(id, {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Run the Property OS workflow "${name}" with approved facts only. End with owner action and risks.`
          }
        }
      ]
    });
  }

  return fail(id, -32601, `Unknown method: ${method}`);
}

async function runStdio() {
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", async (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const response = await handleRequest(JSON.parse(line));
      process.stdout.write(`${JSON.stringify(response)}\n`);
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runStdio();
}
