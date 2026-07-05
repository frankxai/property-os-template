# Portal Wiring

Use `property-portal-template` when the owner wants a renter-facing website.

## V1 Flow

1. Copy approved property facts into the portal template data files.
2. Keep private renter details out of build-time content.
3. Store form submissions in a secure runtime database.
4. Send only sanitized summaries to GitHub issues.
5. Verify the Vercel preview before production.
6. Check `/api/runtime/health` and confirm whether the portal is still in demo mode.
7. Use `/api/listing-dry-run` for integration payload review before any live publishing work.

## Do Not Wire Yet

Do not connect channel publishing, WhatsApp, Stripe, e-signature, or vendor routing until the owner has used and approved the manual workflow.
