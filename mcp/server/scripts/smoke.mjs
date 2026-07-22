import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createPropertyOsEngine } from "../src/domain.mjs";
import { createPropertyOsServer } from "../src/server-factory.mjs";

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const { server } = createPropertyOsServer({ engine: createPropertyOsEngine() });
const client = new Client({ name: "property-os-smoke", version: "0.2.0" });

await server.connect(serverTransport);
await client.connect(clientTransport);

const serverVersion = client.getServerVersion();
if (serverVersion?.name !== "property-os" || serverVersion?.version !== "0.2.0") {
  throw new Error("MCP initialization did not return Property OS v0.2.0.");
}

const listedTools = await client.listTools();
for (const required of ["create_agent_mission", "record_approved_evidence", "run_agent_draft", "record_agent_run_review", "run_listing_dry_run", "propose_controlled_transition", "record_owner_decision", "apply_approved_transition"]) {
  if (!listedTools.tools.some((tool) => tool.name === required)) throw new Error(`MCP tools list is missing ${required}.`);
}

const draft = await client.callTool({ name: "draft_listing", arguments: { propertyId: "sample-property", channel: "immoscout24" } });
if (!draft.content[0]?.text?.includes("OWNER REVIEW REQUIRED")) throw new Error("Listing drafts must require owner review.");

const resource = await client.readResource({ uri: "property://contracts/authority" });
if (!resource.contents[0]?.text?.includes("property-os-authority.v2")) throw new Error("Authority contract resource is missing.");

const prompt = await client.getPrompt({ name: "controlled_transition_review", arguments: { organizationId: "sample-org" } });
if (!prompt.messages[0]?.content?.text?.includes("Do not apply or publish external actions")) throw new Error("Governed prompt boundary is missing.");

await client.close();
await server.close();
console.log("Property OS SDK MCP smoke passed.");
