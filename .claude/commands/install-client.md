# Install Client

Create and interpret a client install plan from this template.

1. Read `README.md`, `SUCCESS_CRITERIA.md`, `workspace/02-data-boundaries.md`, `docs/self-service-install-plan.md`, and `docs/integration-readiness.md`.
2. Create a public-safe configuration conforming to `schemas/install-config.schema.json`. Never place names, addresses, contacts, URLs, or credentials in it.
3. Run `npm run install:plan -- --config <path>` and report the source config hash and plan hash.
4. Keep portal and control-plane Postgres databases logically separate and connect them only through authenticated MCP tools.
5. Turn each generated phase gate into an implementation issue with a named evidence artifact.
6. Build a 14-day setup sequence around approved facts, media rights, renter FAQs, support rules, identity, databases, notifications, preview, and owner training.
7. End with unresolved owner approvals, unmeasured success hypotheses, blocked automations, and the explicit statement that the generated plan is not production proof.
