import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { agentOutputTypes } from "./agent-runtime.mjs";
import { agentProfiles, blockedV1Tools, createPropertyOsEngine, sampleResources } from "./domain.mjs";

const text = (max) => z.string().trim().min(1).max(max);
const optionalText = (max) => z.string().trim().max(max).optional();
const organizationId = optionalText(120);

export const toolDefinitions = [
  {
    name: "create_agent_mission",
    description: "Create a bounded, evidence-led mission for one Property OS specialist. It creates planning state only.",
    inputSchema: {
      organizationId,
      role: z.enum(agentProfiles.map((profile) => profile.id)),
      propertyId: optionalText(120),
      objective: text(800),
      successMetric: text(240)
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  },
  {
    name: "run_agent_draft",
    description: "Generate and persist one structured, evidence-grounded draft for an existing mission. The model has no tools and every result requires owner review.",
    inputSchema: {
      organizationId,
      missionId: text(180),
      role: z.enum(agentProfiles.map((profile) => profile.id)),
      propertyId: optionalText(120),
      outputType: z.enum(agentOutputTypes),
      objective: text(1000),
      evidenceRefs: z.array(text(180)).min(1).max(12)
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  },
  {
    name: "record_approved_evidence",
    description: "Record an owner-approved, versioned evidence excerpt in the tenant store for later grounded drafts. It performs no external action.",
    inputSchema: {
      organizationId,
      ref: text(180),
      propertyId: optionalText(120),
      excerpt: text(2000),
      sourceType: z.enum(["property-profile", "knowledge-article", "policy", "listing-fact"]),
      sourceVersionHash: text(128)
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  },
  {
    name: "record_agent_run_review",
    description: "Record an owner decision on a generated draft. This updates review state only and never sends, publishes, prices, approves, or dispatches anything.",
    inputSchema: {
      organizationId,
      runId: text(180),
      decision: z.enum(["accept-draft", "request-revision", "reject-draft"]),
      feedback: optionalText(600)
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  },
  {
    name: "create_inquiry_summary",
    description: "Create a sanitized owner-review summary for a rental inquiry without promising availability or acceptance.",
    inputSchema: { organizationId, propertyId: text(120), message: text(800), rentalWindow: optionalText(160) },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "create_support_ticket_summary",
    description: "Summarize and classify renter support without repair timing or vendor dispatch commitments.",
    inputSchema: { organizationId, propertyId: text(120), message: text(800), urgency: optionalText(80) },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "draft_listing",
    description: "Create a channel-specific listing draft from approved property facts.",
    inputSchema: { organizationId, propertyId: text(120), channel: text(80) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  },
  {
    name: "draft_reply",
    description: "Draft an owner-reviewed inquiry reply from approved knowledge.",
    inputSchema: { organizationId, propertyId: text(120), inquiry: text(600) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  },
  {
    name: "request_owner_approval",
    description: "Create a review request. This does not issue an approval receipt and does not apply an action.",
    inputSchema: { organizationId, sourceId: text(120), ownerAction: text(500) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  },
  {
    name: "create_sanitized_github_issue",
    description: "Prepare a public-safe GitHub issue draft without private renter or owner data.",
    inputSchema: { organizationId, title: text(120), summary: text(1000) },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "run_privacy_scan",
    description: "Check text for blocked private-data classes without returning the submitted text.",
    inputSchema: { organizationId, text: text(4000) },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "run_listing_dry_run",
    description: "Create a channel payload proof without publishing it.",
    inputSchema: { organizationId, propertyId: text(120), channel: text(80) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  },
  {
    name: "create_implementation_readiness_snapshot",
    description: "Create a partner-safe readiness summary for an owner, agency, or implementer handoff.",
    inputSchema: { organizationId, portalUrl: optionalText(240), runtimeMode: optionalText(80) },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "propose_controlled_transition",
    description: "Create an immutable proposal for the internal mark-draft-reviewed proof transition. Accepted state remains unchanged.",
    inputSchema: {
      organizationId,
      operation: z.literal("mark-draft-reviewed"),
      resourceId: text(180),
      baseVersionHash: text(128),
      payloadHash: text(128),
      summary: text(500),
      missionId: optionalText(120)
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  },
  {
    name: "record_owner_decision",
    description: "Record an owner approve or reject decision. Approval issues a short-lived, actor-bound receipt but does not apply content.",
    inputSchema: { organizationId, proposalId: text(180), decision: z.enum(["approve", "reject"]) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  },
  {
    name: "apply_approved_transition",
    description: "Consume a valid single-use receipt to apply the internal proof transition atomically and return audit and undo evidence.",
    inputSchema: { organizationId, proposalId: text(180), approvalReceiptId: text(180), idempotencyKey: text(180) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }
];

const promptNames = [
  "weekly_owner_review",
  "listing_missing_facts",
  "maintenance_triage",
  "integration_dry_run_review",
  "implementation_readiness_review",
  "commercial_offer",
  "agent_mission_review",
  "controlled_transition_review"
];

function toolError(error) {
  const code = typeof error?.code === "string" ? error.code : "TOOL_ERROR";
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify({ error: code, message: error?.message ?? "Tool failed." }) }],
    structuredContent: { error: code, message: error?.message ?? "Tool failed." }
  };
}

export function createPropertyOsServer({ engine = createPropertyOsEngine() } = {}) {
  const server = new McpServer(
    { name: "property-os", version: "0.2.0" },
    {
      instructions: "Use approved facts only. Agents draft; owners decide. External publication, messaging, dispatch, applicant selection, access disclosure, pricing, and availability changes remain blocked.",
      capabilities: { logging: {} }
    }
  );

  for (const [uri, value] of Object.entries(sampleResources)) {
    server.registerResource(
      uri.replace("property://", "").replaceAll("/", "-"),
      uri,
      { description: `Property OS contract resource: ${uri}`, mimeType: "application/json" },
      async () => ({ contents: [{ uri, mimeType: "application/json", text: JSON.stringify(value, null, 2) }] })
    );
  }

  for (const definition of toolDefinitions) {
    server.registerTool(
      definition.name,
      {
        description: definition.description,
        inputSchema: definition.inputSchema,
        annotations: definition.annotations
      },
      async (args, extra) => {
        try {
          return await engine.executeTool(definition.name, args, extra);
        } catch (error) {
          return toolError(error);
        }
      }
    );
  }

  for (const name of promptNames) {
    server.registerPrompt(
      name,
      {
        description: `Property OS governed workflow: ${name}`,
        argsSchema: { organizationId: z.string().trim().max(120).optional() }
      },
      async ({ organizationId }) => ({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Run ${name} for ${organizationId || "the authenticated tenant"}. Use approved facts, cite evidence, state risk, and end with owner action plus keep/change/stop. Do not apply or publish external actions.`
            }
          }
        ]
      })
    );
  }

  return { server, engine };
}

export { blockedV1Tools, promptNames };
