# Production Readiness Standard

## Required Gates

### Security

- private data boundary reviewed
- privacy scan passes
- secrets are environment-only
- runtime database has tenant isolation
- owner/renter roles are explicit
- audit log records consequential actions

### Performance

- portal builds successfully
- first load stays lightweight
- images are rights-approved and optimized
- admin routes remain usable on mobile
- no long-running work blocks request response

### Reliability

- forms degrade gracefully
- notifications retry safely
- integrations have dry-run mode
- failed agent runs are visible
- owner can continue manually if an integration fails

### Agent Governance

- agent profiles exist
- skill files exist
- commands exist for install, commercial offer, audit, and production readiness
- blocked actions are encoded in docs and evals
- every consequential output includes owner action

### Deployment

- Vercel preview for portal
- Railway only for always-on MCP, workers, or integration services
- database migration plan
- environment separation
- rollback path

## Ready Definition

An install is ready for paid usage when:

- owner can update property facts
- renter can self-serve approved information
- owner receives urgent issues
- listing drafts are channel-ready
- no private data appears in public artifacts
- validation, privacy, typecheck, build, smoke, and visual QA pass
- at least one weekly review loop has been run
