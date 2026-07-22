# Portal Wiring

Use `property-portal-template` when the owner wants a renter-facing website.

## V1 Flow

1. Copy approved property facts into the portal template data files.
2. Keep private renter details out of build-time content.
3. Store form submissions in a secure runtime database.
4. Select owner auth explicitly. Run `npm run auth:hash -- "private owner passcode"` only for a private one-owner pilot; agencies use the portal's pre-bound OIDC mode.
5. Send only sanitized summaries to GitHub issues.
6. Verify the Vercel preview before production.
7. Run `npm run auth:smoke` and `npm run identity:smoke` so downgrade, signed-token, role, origin, session, and schema boundaries are proven locally.
8. Run `npm run install:proof` so the install proof packet records the current phase gates without printing secret values.
9. Check `/api/install/proof-packet` and `/admin/setup` for proof score, command checks, missing environment names, owner approvals, and blocked v1 actions.
10. Check `/api/runtime/health` and confirm whether the portal is still in demo mode.
11. Check `/api/runtime/snapshot` and `/admin/runtime` for queue, adapter, notification, and audit posture.
12. Use `/api/listing-dry-run` for integration payload review before any live publishing work.
13. Run `npm run notification:smoke`, then inspect `/admin/notifications`; a local pass proves lifecycle logic but not live provider delivery.
14. Run `npm run weekly:smoke` and `npm run weekly:visual`, then inspect `/admin/ops`; local proof does not replace one live tenant-scoped owner review.

## Runtime Adapter

`property-portal-template` starts in `demo-memory` mode and switches to the Postgres adapter when `DATABASE_URL` is set. This URL is for the portal's tenant-isolated logical database only. Railway uses a separate control-plane database; the portal reaches it through authenticated MCP calls.

Production installs should set:

- `DATABASE_URL`
- `PROPERTY_OS_ORG_ID`
- `APP_BASE_URL`
- `PROPERTY_OS_AUTH_MODE`
- private pilot: `OWNER_PORTAL_SECRET`, `OWNER_PORTAL_PASSCODE_HASH`
- agency: Better Auth secret, pinned OIDC endpoints/client, and reviewed member bindings
- `OWNER_NOTIFICATION_WEBHOOK_URL`
- `OWNER_NOTIFICATION_WEBHOOK_SIGNING_SECRET`
- `OWNER_NOTIFICATION_FALLBACK_WEBHOOK_URL`
- `OWNER_NOTIFICATION_FALLBACK_SIGNING_SECRET`
- `OWNER_NOTIFICATION_WORKER_TOKEN`
- `MCP_SERVER_URL`
- `MCP_SERVER_AUTH_MODE`
- private pilot: `MCP_SERVER_ACCESS_TOKEN`
- agency: short-lived MCP client-credential settings
- `MCP_SERVER_ORIGIN`

The portal writes inquiries, support tickets, approvals, agent runs, listing dry-run audit events, and sanitized notification handoffs. Agents and partner reports should use only sanitized summaries outside the runtime database.

Protected owner/admin API calls require a revocable owner browser session and a route capability. There is no global owner bearer. Public intake routes stay open only for inquiry and support submission; machine agent work crosses the MCP service boundary.

Production database install order:

1. Apply portal `db/schema.sql` to the portal logical database.
2. Apply portal `db/rls.sql` there so Postgres enforces tenant isolation through `property_os.organization_id`.
3. Apply portal `db/002-notification-lifecycle.sql` when upgrading an existing portal database; fresh installs already receive those tables through `db/schema.sql` and policies through `db/rls.sql`.
4. Apply portal `db/003-weekly-owner-review.sql` after the notification migration when upgrading; it binds each metric row to a review in the same tenant.
5. Apply portal `db/004-tenant-oidc.sql` when upgrading; it is transactional and pinned to the portal auth package version.
6. Seed `db/seed-sample.sql` for local smoke or a private owner seed for the real install; pre-bind reviewed agency identities.
7. Set `PROPERTY_OS_ORG_ID` to the seeded organization.
8. Run `npm run db:rls:smoke`; agency installs also set expected subjects and run `npm run identity:db:smoke`.
9. Run `npm run notification:smoke`; then prove signed primary delivery, fallback after the acknowledgement timeout, and idempotent acknowledgement against the selected provider.
10. Run `npm run weekly:smoke` and `npm run weekly:visual`; then complete one live review and preserve all five observations.
11. Run `npm run install:proof` and attach the packet to the owner or partner handoff.
12. Check `/api/install/proof-packet`, `/api/runtime/snapshot`, `/admin/setup`, `/admin/runtime`, `/admin/notifications`, and `/admin/ops`.

The portal issue templates include install support, integration requests, safety review, and portal QA. Use them as the public-safe support layer for community forks and partner installs.

Use separate logical databases for the portal and MCP. Never apply their migrations to the same logical database. Their runtime ledgers are deliberately isolated and connected by the MCP API contract.

## Do Not Wire Yet

Do not connect channel publishing, WhatsApp, Stripe, e-signature, or vendor routing until the owner has used and approved the manual workflow.
