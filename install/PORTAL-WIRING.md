# Portal Wiring

Use `property-portal-template` when the owner wants a renter-facing website.

## V1 Flow

1. Copy approved property facts into the portal template data files.
2. Keep private renter details out of build-time content.
3. Store form submissions in a secure runtime database.
4. Send only sanitized summaries to GitHub issues.
5. Verify the Vercel preview before production.
6. Check `/api/runtime/health` and confirm whether the portal is still in demo mode.
7. Check `/api/runtime/snapshot` and `/admin/runtime` for queue, adapter, notification, and audit posture.
8. Use `/api/listing-dry-run` for integration payload review before any live publishing work.

## Runtime Adapter

`property-portal-template` starts in `demo-memory` mode and switches to the Postgres adapter when `DATABASE_URL` is set.

Production installs should set:

- `DATABASE_URL`
- `PROPERTY_OS_ORG_ID`
- `APP_BASE_URL`
- `OWNER_NOTIFICATION_EMAIL`
- optional `OWNER_NOTIFICATION_WEBHOOK_URL`
- optional `MCP_SERVER_URL`
- optional `AGENT_RUNTIME_URL`

The portal writes inquiries, support tickets, approvals, agent runs, listing dry-run audit events, and sanitized notification handoffs. Agents and partner reports should use only sanitized summaries outside the runtime database.

Production database install order:

1. Apply portal `db/schema.sql`.
2. Apply portal `db/rls.sql` so Postgres enforces tenant isolation through `property_os.organization_id`.
3. Seed `db/seed-sample.sql` for local smoke or a private owner seed for the real install.
4. Set `PROPERTY_OS_ORG_ID` to the seeded organization.
5. Check `/api/runtime/snapshot` and `/admin/runtime`.

The portal issue templates include install support, integration requests, safety review, and portal QA. Use them as the public-safe support layer for community forks and partner installs.

## Do Not Wire Yet

Do not connect channel publishing, WhatsApp, Stripe, e-signature, or vendor routing until the owner has used and approved the manual workflow.
