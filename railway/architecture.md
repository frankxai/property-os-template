# Railway Architecture

## When To Use Railway

Use Railway when a service needs to run outside Vercel request/response limits:

- hosted MCP server
- integration dry-run worker
- queue worker
- scheduled sync monitor
- background notification worker
- agency webhook receiver

Keep the public portal on Vercel unless the repo is intentionally moved.

## Service Topology

| Service | Runtime | Role |
| --- | --- | --- |
| portal | Vercel Next.js | public property pages, renter portal, owner/admin UI |
| postgres | managed Postgres | organizations, properties, tickets, approvals, agent runs |
| object-storage | Vercel Blob or Supabase Storage | media and documents |
| property-os-mcp | Railway Node/TS | MCP resources, tools, prompts |
| queue-worker | Railway Node/TS | weekly digest, retry, dry-run integration jobs |
| notification-worker | Railway Node/TS | email and optional messaging notifications |

## Environment Boundary

Use separate environments for development, preview, and production. Agents may read preview data and write sandbox records. Production writes require explicit owner or operator approval.

## Minimum Production Controls

- authenticated MCP HTTP transport
- tenant-scoped database access
- audit events for every tool write
- rate limits on external calls
- dead-letter handling for failed jobs
- dry-run mode for listing integrations
- no secrets in repo files

## First Railway Milestone

Deploy only `property-os-mcp` with read-only sample resources and dry-run tools. Add write tools after auth, audit, and owner approval are proven.
