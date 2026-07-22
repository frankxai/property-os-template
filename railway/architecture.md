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
| readiness-worker | Railway Node/TS | scheduled implementation readiness snapshots and partner handoff checks |

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
- sanitized notification webhooks only; private renter detail remains in Postgres

## First Railway Milestone

Deploy `mcp/server` with its Dockerfile and `/readyz` health check. Start with one private pilot tenant, a generated bearer token, allowed host/origin policy, read resources, mission tools, dry runs, and the internal controlled-transition proof. External actions remain blocked.

## Production Auth Milestone

Move from static bearer to OIDC mode before agency or marketplace use. Configure issuer, audience, JWKS URL, tenant claim, role claim, scopes, and allowed tenants. The public MCP service is a resource server; identity and authorization policy are not delegated to caller headers.

## Railway Template Gate

- root directory `mcp/server`
- Dockerfile build
- health check `/readyz`
- generated secrets, never defaults
- private Postgres hostname for future repository adapter
- one public domain for `/mcp`
- separate development, preview, and production environments
- deployment support and update policy documented before Marketplace publication

## Readiness Milestone

After the portal is deployed, call the portal `/api/implementation/readiness`, `/api/runtime/snapshot`, and the MCP `create_implementation_readiness_snapshot` tool during every preview handoff. Store only sanitized readiness and runtime summaries in client issues or partner reports.

## Notification Milestone

Point `OWNER_NOTIFICATION_WEBHOOK_URL` at a Railway worker, n8n workflow, Make scenario, or email bridge. The payload must remain sanitized: source id, kind, urgency, route, summary, owner action, and timestamp only.
