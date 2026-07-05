# Implementation Readiness Cockpit

The Property Intelligence OS has two install surfaces:

- `property-portal-template` exposes `/admin/implementation` and `/api/implementation/readiness`.
- `property-portal-template` exposes `/admin/runtime` and `/api/runtime/snapshot` for storage, notification, and audit posture.
- `property-os-template` exposes the MCP prompt/tool pair for implementation readiness review.

Together they let an owner, agency, or implementation partner see whether a fork is only template-ready or ready for a paid production install.

## Agent Workflow

Use the MCP tool:

```json
{
  "tool": "create_implementation_readiness_snapshot",
  "arguments": {
    "organizationId": "client-or-owner-id",
    "portalUrl": "https://example.com/admin/implementation",
    "runtimeMode": "demo"
  }
}
```

The output is intentionally partner-safe. It should contain:

- ready layers
- missing production configuration
- blocked v1 actions
- owner approval gates
- next implementer action

It must not contain renter identity, payment data, access secrets, private owner financials, legal advice, or promises about occupancy/rent uplift.

## Portal Workflow

The portal cockpit should be reviewed after each install milestone:

1. free fork created
2. property facts and images replaced
3. Vercel preview deployed
4. database/auth/email configured
5. `db/schema.sql`, `db/rls.sql`, and the owner seed are applied
6. `/admin/runtime` confirms Postgres adapter, queue posture, and missing environment gates
7. owner notification webhook or worker tested with sanitized payload
8. Codex/Claude/MCP agent workspace paired
9. first owner weekly review completed

## Commercial Use

The readiness cockpit supports four offers:

| Offer | Buyer | What Is Sold |
| --- | --- | --- |
| Free community fork | technical owner | self-serve template and safety model |
| Owner install | landlord with a small portfolio | setup, content migration, portal launch, training |
| Agency kit | property manager or local AI implementer | repeatable install system and private-client workflow |
| Managed OS | premium owner or agency | monthly optimization, FAQ/listing refresh, review support |

## Quality Standard

An install is not production-ready because the portal builds. Production readiness requires:

- private runtime storage
- auth and access control
- database row-level security
- runtime snapshot review
- owner-approved property facts
- visual QA on the deployed preview
- notification privacy review
- MCP capability boundary review
- human approval for consequential actions
- support ownership and escalation policy

Use this doc as the handoff standard when selling or delivering paid installs.
