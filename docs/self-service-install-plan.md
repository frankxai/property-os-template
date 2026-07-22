# Self-Service Install Plan

## Purpose

The install planner turns a public-safe deployment intent into a schema-validated implementation packet. It gives an owner, partner, or agency the same topology, gates, environment key names, migrations, commands, acceptance steps, and measurement contract before anyone configures live infrastructure.

It does not deploy services, collect personal data, accept commercial terms, or prove readiness. Every generated packet remains `planned-not-proven` and `unverified` until the target hosts and owner produce evidence.

## Generate A Plan

1. Edit `install/sample-install.config.json` or create another file that conforms to `schemas/install-config.schema.json`.
2. Use pseudonymous slugs only. Do not add owner names, addresses, emails, phone numbers, tenant details, URLs, tokens, passcodes, credentials, or provider keys.
3. Generate the packet:

```bash
npm ci
npm run install:plan -- --config install/sample-install.config.json
```

The ignored output is written to `install-output/<installationId>.plan.json`. The command prints only its path, posture, proof status, source config hash, and plan hash.

Run `npm run test:install-plan` to prove schema validation, stable hashing, secret-field rejection, portfolio invariants, agency identity requirements, blocked actions, and the two-database boundary.

## Inputs

The v1 contract accepts only:

- pseudonymous installation and tenant IDs
- product edition and operator mode
- property and unit counts
- approved deployment providers and region label
- static private-pilot or OIDC intent
- storage and notification provider choices
- eight boolean readiness attestations
- offer and support tier identifiers

Unknown fields fail closed. `unitCount` must be at least `propertyCount`. Community installs must remain self-service. Managed Ops must remain managed. Agency Platform plans require OIDC.

OIDC in a plan is an architecture requirement, not a claim that the current portal adapter is production-ready. The generated identity gate remains `implementation-required` until role mapping, revocation, session behavior, and auth smoke are implemented and proven.

## Output Contract

`schemas/install-plan.schema.json` validates every generated packet. The packet contains:

- immutable source config and stable plan hashes
- Vercel portal, Railway MCP, model runtime, and two logical database boundaries
- draft-only authority and the six blocked v1 actions
- unresolved owner decisions and provider recommendations
- phase gates with exact evidence requirements
- environment key names grouped by host, never values
- migration targets and verification commands
- owner acceptance steps
- six product hypotheses, all initially `unmeasured`
- commercial scope labels without pricing or service claims

`generatedAt` is intentionally excluded from `planHash`, so the same valid input produces the same plan hash at different times.

## Database Boundary

Use two separate logical Postgres databases with tenant isolation, ideally with separate least-privilege runtime roles:

| Host | Logical database | Owns |
| --- | --- | --- |
| Vercel portal | `portal-db` | inquiries, support, portal approvals, portal audit, operational state |
| Railway MCP | `control-plane-db` | missions, approved evidence, structured model receipts, owner reviews, controlled transitions |

The portal and MCP currently have different runtime contracts for similarly named records. Never point their `DATABASE_URL` values at the same logical database. They interoperate through authenticated MCP tools, which keeps the authority and audit boundary explicit.

## Handoff Rule

Attach the config hash and plan hash to the implementation issue or commercial statement of work. At handoff, replace planned gates with host-generated proof references; do not edit a generated plan to say a gate passed. The live evidence set must include portal install proof, live portal RLS smoke, Railway readiness, remote activation, rejected synthetic owner review, urgent notification acknowledgement, visual QA, weekly review, and signed owner acceptance.
