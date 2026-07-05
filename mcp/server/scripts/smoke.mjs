import { callTool, handleRequest } from "../src/server.mjs";

const initialized = await handleRequest({ jsonrpc: "2.0", id: 1, method: "initialize" });
if (initialized.result?.serverInfo?.name !== "property-os") {
  throw new Error("MCP initialize did not return property-os server info.");
}

const tools = await handleRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" });
if (!tools.result.tools.some((tool) => tool.name === "run_listing_dry_run")) {
  throw new Error("MCP tools list is missing run_listing_dry_run.");
}

const draft = await callTool("draft_listing", {
  propertyId: "sample-property",
  channel: "immoscout24"
});
if (!draft.content[0].text.includes("OWNER REVIEW REQUIRED")) {
  throw new Error("draft_listing must require owner review.");
}

const blocked = await callTool("publish_listing", {
  propertyId: "sample-property"
});
if (!blocked.content[0].text.includes("\"blocked\": true")) {
  throw new Error("publish_listing must be blocked in v1.");
}

const resource = await handleRequest({
  jsonrpc: "2.0",
  id: 3,
  method: "resources/read",
  params: { uri: "property://profile/sample-property" }
});
if (!resource.result.contents[0].text.includes("Sample Property")) {
  throw new Error("MCP resource read failed.");
}

console.log("Property OS MCP smoke passed.");
