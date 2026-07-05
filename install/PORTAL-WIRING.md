# Portal Wiring

Use `property-portal-template` when the owner wants a renter-facing website.

## V1 Flow

1. Copy approved property facts into the portal template data files.
2. Keep private renter details out of build-time content.
3. Store form submissions in a secure runtime database.
4. Generate owner auth secrets with `npm run auth:hash -- "private owner passcode"` and store only the generated values in Vercel.
5. Send only sanitized summaries to GitHub issues.
6. Verify the Vercel preview before production.
7. Run `npm run auth:smoke` so owner/admin routes and protected APIs prove the auth boundary.
8. Check `/api/runtime/health` and confirm whether the portal is still in demo mode.
9. Check `/api/runtime/snapshot` and `/admin/runtime` for queue, adapter, notification, and audit posture.
10. Use `/api/listing-dry-run` for integration payload review before any live publishing work.

## Runtime Adapter

`property-portal-template` starts in `demo-memory` mode and switches to the Postgres adapter when `DATABASE_URL` is set.

Production installs should set:

- `DATABASE_URL`
- `PROPERTY_OS_ORG_ID`
- `APP_BASE_URL`
- `OWNER_NOTIFICATION_EMAIL`
- `PROPERTY_OS_DEMO_AUTH` set to `false`
- `OWNER_PORTAL_SECRET`
- `OWNER_PORTAL_PASSCODE_HASH`
- optional `OWNER_PORTAL_API_TOKEN`
- optional `OWNER_NOTIFICATION_WEBHOOK_URL`
- optional `MCP_SERVER_URL`
- optional `AGENT_RUNTIME_URL`

The portal writes inquiries, support tickets, approvals, agent runs, listing dry-run audit events, and sanitized notification handoffs. Agents and partner reports should use only sanitized summaries outside the runtime database.

Protected owner/admin API calls require either a signed owner browser session or `OWNER_PORTAL_API_TOKEN` bearer auth. Public intake routes stay open only for inquiry and support submission.

Production database install order:

1. Apply portal `db/schema.sql`.
2. Apply portal `db/rls.sql` so Postgres enforces tenant isolation through `property_os.organization_id`.
3. Seed `db/seed-sample.sql` for local smoke or a private owner seed for the real install.
4. Set `PROPERTY_OS_ORG_ID` to the seeded organization.
5. Run `npm run db:rls:smoke` against the live `DATABASE_URL`.
6. Check `/api/runtime/snapshot` and `/admin/runtime`.

The portal issue templates include install support, integration requests, safety review, and portal QA. Use them as the public-safe support layer for community forks and partner installs.

## Do Not Wire Yet

Do not connect channel publishing, WhatsApp, Stripe, e-signature, or vendor routing until the owner has used and approved the manual workflow.
