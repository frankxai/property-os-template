#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createPropertyOsEngine } from "./domain.mjs";
import { createPropertyOsServer } from "./server-factory.mjs";

export async function startPropertyOsStdioServer({ engine = createPropertyOsEngine() } = {}) {
  const { server } = createPropertyOsServer({ engine });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return { server, transport, engine };
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  await startPropertyOsStdioServer();
}

export { createPropertyOsEngine, createPropertyOsServer };
