# Production Readiness Standard

## Required Gates

### Security

- private data boundary reviewed
- privacy scan passes
- secrets are environment-only
- portal and control-plane databases are separate logical databases with tenant isolation and least-privilege roles
- owner/renter roles are explicit
- audit log records consequential actions

### Performance

- portal builds successfully
- portal install proof packet passes with `npm run install:proof`
- first load stays lightweight
- images are rights-approved and optimized
- admin routes remain usable on mobile
- no long-running work blocks request response

### Reliability

- forms degrade gracefully
- notifications retry safely
- integrations have dry-run mode
- failed agent runs are visible
- model timeouts and schema/policy failures fail closed without downstream work
- owner can continue manually if an integration fails

### Agent Governance

- agent profiles exist
- skill files exist
- commands exist for install, commercial offer, audit, and production readiness
- blocked actions are encoded in docs and evals
- every consequential output includes owner action
- each successful model run cites approved evidence and records an owner review outcome
- draft calls resolve evidence from the tenant ledger; a caller cannot self-declare approval

### Deployment

- schema-valid install config and stable plan hash recorded before host configuration
- Vercel preview for portal
- `/admin/setup` and `/api/install/proof-packet` reviewed before owner handoff
- Railway only for always-on MCP, workers, or integration services
- database migration plan
- environment separation
- rollback path
- remote activation proof passes in check-only and approved synthetic-write modes
- generated plan still says `planned-not-proven`; live receipts, not self-attestation, establish readiness

## Ready Definition

An install is ready for paid usage when:

- owner can update property facts
- renter can self-serve approved information
- owner receives urgent issues
- listing drafts are channel-ready
- no private data appears in public artifacts
- validation, privacy, typecheck, build, smoke, and visual QA pass
- install proof packet, auth smoke, and live RLS smoke pass for the target install
- deployed MCP activation receipt proves the four governed tools, evidence/output hashes, model receipt, rejected synthetic review, and zero external actions
- at least one weekly review loop has been run
