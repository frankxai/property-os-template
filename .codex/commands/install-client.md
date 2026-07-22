# Install Client

Create and execute the bounded Property OS install contract.

1. Read `README.md`, `SUCCESS_CRITERIA.md`, `workspace/02-data-boundaries.md`, `docs/self-service-install-plan.md`, and `docs/integration-readiness.md`.
2. Create a public-safe configuration conforming to `schemas/install-config.schema.json`. Exclude names, addresses, contacts, URLs, credentials, and personal data.
3. Run `npm run install:plan -- --config <path>` and attach the source config hash and stable plan hash to the implementation record.
4. Keep the portal and control-plane Postgres databases logically separate and use least-privilege roles.
5. Execute generated gates in order. Record host-generated evidence; never edit the plan posture or proof status.
6. Keep all renter-facing, legal, price, availability, urgent, private, and external actions owner-gated.
7. Report unresolved approvals, unmeasured hypotheses, live evidence, failures, rollback, and blocked actions without claiming readiness from configuration alone.
