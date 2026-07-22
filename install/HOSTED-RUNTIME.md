# Hosted Runtime Install

Use this when moving from local template to paid owner or agency install.

## Minimum Services

| Layer | Recommended Start | Notes |
| --- | --- | --- |
| Portal | Vercel | Next.js property, renter, owner, and admin routes |
| Portal database | Managed Postgres | tenant-isolated inquiries, support, portal approvals, and portal audit |
| Control-plane database | Managed Postgres | tenant-isolated missions, approved evidence, model receipts, reviews, and transitions |
| Storage | Vercel Blob or Supabase Storage | rights-approved media and private documents |
| Notification adapter | Resend worker, n8n, Make, or equivalent signed webhook receiver | primary and fallback owner routes with provider receipts |
| MCP | Railway | always-on Property OS MCP server and dry-run tools |
| Worker | Railway | weekly digest, retries, and integration dry-run jobs |

## Environment Keys

Portal:

- `DATABASE_URL`
- `APP_BASE_URL`
- `PROPERTY_OS_ORG_ID`
- `PROPERTY_OS_AUTH_MODE` (explicitly `static-private-pilot` or `oidc`)
- private pilot: `OWNER_PORTAL_SECRET`, `OWNER_PORTAL_PASSCODE_HASH`
- agency: `BETTER_AUTH_SECRET`, pinned OIDC issuer/authorization/token/JWKS endpoints, client credentials, and claim names
- `OWNER_NOTIFICATION_WEBHOOK_URL`
- `OWNER_NOTIFICATION_WEBHOOK_SIGNING_SECRET`
- `OWNER_NOTIFICATION_FALLBACK_WEBHOOK_URL`
- `OWNER_NOTIFICATION_FALLBACK_SIGNING_SECRET`
- `OWNER_NOTIFICATION_WORKER_TOKEN`
- `GITHUB_ISSUE_REPO`
- `EMAIL_PROVIDER`
- `OBJECT_STORAGE_PROVIDER`
- `MCP_SERVER_URL`
- `MCP_SERVER_AUTH_MODE`
- private pilot: `MCP_SERVER_ACCESS_TOKEN`
- agency: `MCP_OIDC_TOKEN_URL`, `MCP_OIDC_CLIENT_ID`, `MCP_OIDC_CLIENT_SECRET`, `MCP_OIDC_AUDIENCE`, `MCP_OIDC_SCOPE`
- `MCP_SERVER_ORIGIN`

Railway MCP:

- `DATABASE_URL`
- `PROPERTY_OS_MCP_AUTH_MODE`
- `PROPERTY_OS_MCP_PUBLIC_URL`
- `PROPERTY_OS_MCP_ALLOWED_HOSTS`
- `PROPERTY_OS_MCP_ALLOWED_ORIGINS`
- `PROPERTY_OS_MCP_ALLOWED_TENANTS`
- `PROPERTY_OS_DEFAULT_TENANT_ID`
- private pilot: `PROPERTY_OS_MCP_AUTH_TOKEN`
- agency: `PROPERTY_OS_MCP_OIDC_ISSUER`, `PROPERTY_OS_MCP_OIDC_AUDIENCE`, `PROPERTY_OS_MCP_OIDC_JWKS_URL`, `PROPERTY_OS_MCP_TENANT_CLAIM`, `PROPERTY_OS_MCP_ROLE_CLAIM`
- optional service identity: `PROPERTY_OS_MCP_ACTOR_ID`, `PROPERTY_OS_MCP_ACTOR_ROLE`, `PROPERTY_OS_MCP_STATIC_SCOPES`
- `PROPERTY_OS_AUDIT_MODE`
- `PROPERTY_OS_AI_MODEL`
- `PROPERTY_OS_AI_TIMEOUT_MS`
- `PROPERTY_OS_AI_MAX_OUTPUT_TOKENS`
- `AI_GATEWAY_API_KEY`

Do not commit values. Store them in Vercel or Railway environment settings.

All hosted MCP public, issuer, and JWKS URLs use HTTPS and public hosts. Private, reserved, credential-bearing, fragmented, or cleartext endpoints fail startup; only an explicit loopback insecure-local proof may use HTTP.

The Vercel and Railway `DATABASE_URL` values must point to separate logical databases and least-privilege roles. Do not apply the portal and MCP schemas to the same logical database. The services exchange governed data through the authenticated MCP boundary. Railway `/readyz` fails with `503` unless the durable control-plane schema is reachable; the memory adapter can report ready only when the server is explicitly in loopback-only insecure-local mode.

Create the owner passcode materials inside the portal repo with `npm run auth:hash -- "private owner passcode"`. Store the generated `OWNER_PORTAL_SECRET` and `OWNER_PORTAL_PASSCODE_HASH` in the host; never commit the passcode or generated values.

Before owner handoff, run `npm run install:proof` in the portal repo and review `/api/install/proof-packet` through an owner browser session. The portal has no global owner bearer. The proof packet reports key names and configured booleans only; it does not print secret values.

## First Production Milestone

1. Keep portal content static and approved.
2. Select the explicit auth mode. Run `npm run auth:smoke` and `npm run identity:smoke`; agencies also pre-bind reviewed identities and prove a real provider callback.
3. Apply the portal `db/schema.sql` to the portal database.
4. Apply the portal `db/rls.sql` to the portal database.
5. Apply `db/002-notification-lifecycle.sql` for an upgrade; fresh schema installs already include the notification tables.
6. Apply `db/003-weekly-owner-review.sql` after the notification migration for an upgrade.
7. Apply `db/004-tenant-oidc.sql` for an upgrade and rerun RLS; fresh installs already include the pinned identity schema.
8. Seed `organizations` and `properties` for `PROPERTY_OS_ORG_ID`; bind agency members with the database-owner function.
9. Run `npm run db:rls:smoke`; agencies also run `npm run identity:db:smoke` against a non-owner, non-bypass runtime role.
10. Configure independently signed primary and fallback webhook routes plus the scoped worker token.
11. Run `npm run notification:smoke`, then collect live provider delivery, fallback, payload-hash, and acknowledgement receipts.
12. Run `npm run weekly:smoke` and `npm run weekly:visual`, then complete one live review without converting `unmeasured` evidence into a pass.
13. Run `npm run install:proof` and attach the packet to the owner or partner handoff.
14. Turn on runtime database and verify `/admin/runtime`, `/admin/notifications`, and `/admin/ops`.
15. Log inquiries, support, approvals, agent runs, listing dry-runs, notification events, weekly observations, and audit events.
16. Apply MCP migrations `001-control-plane.sql` and `002-governed-agent-runtime.sql` in order to the separate control-plane database.
17. Deploy MCP server in mission, structured-draft, owner-review, and dry-run mode. Agency deployments require OIDC plus a tenant allowlist and short-lived portal service credentials.
18. Run one approved-evidence agent draft and record an owner review outcome.
19. Verify owner approval and notification acknowledgement queues.
20. Run privacy, validation, build, smoke, identity, install proof, both database, notification, weekly, and visual gates.
21. Keep listing publication manual.

## Blocked Until Proven

- live channel posting
- renter messaging automation
- vendor dispatch
- rent or deposit handling
- applicant selection
- access secret disclosure
