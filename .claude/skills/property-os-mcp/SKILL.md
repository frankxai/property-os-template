---
name: property-os-mcp
description: Design MCP resources, tools, prompts, Railway services, auth boundaries, and audit trails for Property OS.
---

# Property OS MCP Skill

Use this when designing or reviewing an MCP server, Railway service, hosted agent tool, or external integration for Property OS.

## MCP Shape

Resources expose readable context:

- `property://profile/{propertyId}`
- `property://knowledge/{propertyId}`
- `property://listing-drafts/{propertyId}`
- `property://agent-runs/{organizationId}`
- `property://approvals/{organizationId}`
- `property://contracts/authority`
- `property://contracts/agent-team`
- `property://contracts/success-metrics`

Tools perform guarded actions:

- `create_inquiry_summary`
- `create_support_ticket_summary`
- `draft_listing`
- `draft_reply`
- `request_owner_approval`
- `create_sanitized_github_issue`
- `run_privacy_scan`
- `create_agent_mission`
- `propose_controlled_transition`
- `record_owner_decision`
- `apply_approved_transition`

Prompts provide repeatable workflows:

- `weekly_owner_review`
- `listing_missing_facts`
- `maintenance_triage`
- `integration_dry_run_review`
- `agent_mission_review`
- `controlled_transition_review`

## Guardrails

- Read tools can access approved facts and sanitized summaries.
- Write tools require organization auth, audit log, and owner approval where consequential.
- No tool may publish listings, send renter messages, dispatch vendors, disclose access data, or make lease/pricing decisions in v1.
- HTTP MCP deployments require authentication, rate limiting, retention, and tenant isolation.
- Use static bearer auth only for a private single-tenant pilot. Production requires OIDC issuer, audience, JWKS, tenant claims, actor identity, scopes, a deployment tenant allowlist, and short-lived portal client credentials.
- An owner decision is not a mutation. Controlled apply consumes an expiring, actor-bound, single-use receipt and returns audit plus undo evidence.
- Run `npm --prefix mcp/server test` and `npm --prefix mcp/server run audit` before deployment.

## Railway Pattern

Use Railway for optional always-on MCP/API services when Vercel functions are not the right fit: long-running MCP server, queue worker, sync worker, or integration dry-run service.

Deploy `mcp/server` with its Dockerfile, `/readyz` health check, generated token or OIDC configuration, private Postgres networking, and one public MCP domain. Never put secret values in a Railway template file.
