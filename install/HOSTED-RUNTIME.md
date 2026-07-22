# Hosted Runtime Install

Use this when moving from local template to paid owner or agency install.

## Minimum Services

| Layer | Recommended Start | Notes |
| --- | --- | --- |
| Portal | Vercel | Next.js property, renter, owner, and admin routes |
| Database | Managed Postgres | organizations, properties, tickets, approvals, agent runs, audit events |
| Storage | Vercel Blob or Supabase Storage | rights-approved media and private documents |
| Email | Resend or equivalent | owner notifications and weekly digest |
| MCP | Railway | always-on Property OS MCP server and dry-run tools |
| Worker | Railway | weekly digest, retries, and integration dry-run jobs |

## Environment Keys

Portal:

- `DATABASE_URL`
- `APP_BASE_URL`
- `OWNER_NOTIFICATION_EMAIL`
- `PROPERTY_OS_ORG_ID`
- `PROPERTY_OS_DEMO_AUTH`
- `OWNER_PORTAL_SECRET`
- `OWNER_PORTAL_PASSCODE_HASH`
- `OWNER_PORTAL_API_TOKEN` (optional automation bearer for protected owner APIs)
- `OWNER_NOTIFICATION_WEBHOOK_URL` (optional n8n, Make, Railway, or email-worker bridge)
- `GITHUB_ISSUE_REPO`
- `EMAIL_PROVIDER`
- `OBJECT_STORAGE_PROVIDER`
- `MCP_SERVER_URL`
- `AGENT_RUNTIME_URL`

Railway MCP:

- `PROPERTY_OS_MCP_AUTH_MODE`
- `DATABASE_URL`
- `PROPERTY_OS_MCP_ALLOWED_ORIGINS`
- `PROPERTY_OS_AUDIT_MODE`
- `PROPERTY_OS_AI_MODEL`
- `PROPERTY_OS_AI_TIMEOUT_MS`
- `PROPERTY_OS_AI_MAX_OUTPUT_TOKENS`
- `AI_GATEWAY_API_KEY`

Do not commit values. Store them in Vercel or Railway environment settings.

Create the owner passcode materials inside the portal repo with `npm run auth:hash -- "private owner passcode"`. Store the generated `OWNER_PORTAL_SECRET` and `OWNER_PORTAL_PASSCODE_HASH` in the host; never commit the passcode or generated values.

Before owner handoff, run `npm run install:proof` in the portal repo and review `/api/install/proof-packet` through an owner session or trusted `OWNER_PORTAL_API_TOKEN`. The proof packet reports key names and configured booleans only; it does not print secret values.

## First Production Milestone

1. Keep portal content static and approved.
2. Configure owner passcode auth and run `npm run auth:smoke`.
3. Apply the portal `db/schema.sql`.
4. Apply the portal `db/rls.sql`.
5. Seed `organizations` and `properties` for `PROPERTY_OS_ORG_ID`.
6. Run `npm run db:rls:smoke` against the live database.
7. Run `npm run install:proof` and attach the packet to the owner or partner handoff.
8. Turn on runtime database and verify `/admin/runtime`.
9. Log inquiries, support, approvals, agent runs, listing dry-runs, and audit events.
10. Wire sanitized owner notification webhook or worker.
11. Apply MCP migrations `001-control-plane.sql` and `002-governed-agent-runtime.sql` in order.
12. Deploy MCP server in mission, structured-draft, owner-review, and dry-run mode.
13. Run one approved-evidence agent draft and record an owner review outcome.
14. Verify owner approval queue.
15. Run privacy, validation, build, smoke, auth smoke, install proof, RLS smoke, and visual QA.
16. Keep listing publication manual.

## Blocked Until Proven

- live channel posting
- renter messaging automation
- vendor dispatch
- rent or deposit handling
- applicant selection
- access secret disclosure
