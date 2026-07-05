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
- `GITHUB_ISSUE_REPO`
- `EMAIL_PROVIDER`
- `OBJECT_STORAGE_PROVIDER`

Railway MCP:

- `PROPERTY_OS_MCP_AUTH_MODE`
- `PROPERTY_OS_DATABASE_URL`
- `PROPERTY_OS_ALLOWED_ORIGINS`
- `PROPERTY_OS_AUDIT_MODE`

Do not commit values. Store them in Vercel or Railway environment settings.

## First Production Milestone

1. Keep portal content static and approved.
2. Turn on runtime database.
3. Log inquiries, support, approvals, and agent runs.
4. Deploy MCP server in read-only plus dry-run mode.
5. Verify owner approval queue.
6. Run privacy, validation, build, smoke, and visual QA.
7. Keep listing publication manual.

## Blocked Until Proven

- live channel posting
- renter messaging automation
- vendor dispatch
- rent or deposit handling
- applicant selection
- access secret disclosure
