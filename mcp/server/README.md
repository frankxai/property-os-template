# Property OS MCP Server

Dependency-free JSON-RPC skeleton for the Property OS MCP layer.

It is intentionally dry-run only:

- lists property resources, tools, and prompts
- reads sample-safe resources
- drafts listing/reply/support summaries
- requests owner approval
- creates sanitized GitHub issue drafts
- blocks live publication, renter messaging, vendor dispatch, applicant approval, access disclosure, and pricing/availability changes

Run:

```bash
node mcp/server/scripts/smoke.mjs
node mcp/server/src/server.mjs
```

Production should replace the demo backing store with tenant-scoped runtime storage, auth, audit logging, and rate limits.
