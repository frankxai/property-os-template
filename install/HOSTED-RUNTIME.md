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
- `PROPERTY_OS_DEMO_AUTH`
- `OWNER_PORTAL_SECRET`
- `OWNER_PORTAL_PASSCODE_HASH`
- `OWNER_PORTAL_API_TOKEN` (optional automation bearer for protected owner APIs)
- `OWNER_NOTIFICATION_WEBHOOK_URL`
- `OWNER_NOTIFICATION_WEBHOOK_SIGNING_SECRET`
- `OWNER_NOTIFICATION_FALLBACK_WEBHOOK_URL`
- `OWNER_NOTIFICATION_FALLBACK_SIGNING_SECRET`
- `OWNER_NOTIFICATION_WORKER_TOKEN`
- `GITHUB_ISSUE_REPO`
- `EMAIL_PROVIDER`
- `OBJECT_STORAGE_PROVIDER`
- `MCP_SERVER_URL`
- `MCP_SERVER_ACCESS_TOKEN`
- `MCP_SERVER_ORIGIN`

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

The Vercel and Railway `DATABASE_URL` values must point to separate logical databases and least-privilege roles. Do not apply the portal and MCP schemas to the same logical database. The services exchange governed data through the authenticated MCP boundary.

Create the owner passcode materials inside the portal repo with `npm run auth:hash -- "private owner passcode"`. Store the generated `OWNER_PORTAL_SECRET` and `OWNER_PORTAL_PASSCODE_HASH` in the host; never commit the passcode or generated values.

Before owner handoff, run `npm run install:proof` in the portal repo and review `/api/install/proof-packet` through an owner session or trusted `OWNER_PORTAL_API_TOKEN`. The proof packet reports key names and configured booleans only; it does not print secret values.

## First Production Milestone

1. Keep portal content static and approved.
2. Configure owner passcode auth and run `npm run auth:smoke`.
3. Apply the portal `db/schema.sql` to the portal database.
4. Apply the portal `db/rls.sql` to the portal database.
5. Apply `db/002-notification-lifecycle.sql` for an upgrade; fresh schema installs already include the notification tables.
6. Apply `db/003-weekly-owner-review.sql` after the notification migration for an upgrade.
7. Seed `organizations` and `properties` for `PROPERTY_OS_ORG_ID`.
8. Run `npm run db:rls:smoke` against the live database.
9. Configure independently signed primary and fallback webhook routes plus the scoped worker token.
10. Run `npm run notification:smoke`, then collect live provider delivery, fallback, payload-hash, and acknowledgement receipts.
11. Run `npm run weekly:smoke` and `npm run weekly:visual`, then complete one live review without converting `unmeasured` evidence into a pass.
12. Run `npm run install:proof` and attach the packet to the owner or partner handoff.
13. Turn on runtime database and verify `/admin/runtime`, `/admin/notifications`, and `/admin/ops`.
14. Log inquiries, support, approvals, agent runs, listing dry-runs, notification events, weekly observations, and audit events.
15. Apply MCP migrations `001-control-plane.sql` and `002-governed-agent-runtime.sql` in order to the separate control-plane database.
16. Deploy MCP server in mission, structured-draft, owner-review, and dry-run mode.
17. Run one approved-evidence agent draft and record an owner review outcome.
18. Verify owner approval and notification acknowledgement queues.
19. Run privacy, validation, build, smoke, auth smoke, install proof, RLS smoke, notification smoke, weekly smoke, weekly visual, and visual QA.
20. Keep listing publication manual.

## Blocked Until Proven

- live channel posting
- renter messaging automation
- vendor dispatch
- rent or deposit handling
- applicant selection
- access secret disclosure
