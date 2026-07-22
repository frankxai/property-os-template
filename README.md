# Property OS Template

[Use this template](https://github.com/frankxai/property-os-template/generate) ·
[Download ZIP](https://github.com/frankxai/property-os-template/archive/refs/heads/main.zip) ·
[Portal Template](https://github.com/frankxai/property-portal-template)

Cloneable Codex/Claude-ready operating workspace for a landlord, property owner, or small property group.

This is not a property management suite. It is an owner-controlled operating layer for approved property facts, renter knowledge, listing drafts, inquiry support, maintenance triage, agent missions, and weekly review.

## Who This Is For

- Owners who want an approved-facts operating layer before buying a heavy property suite.
- Implementers who install premium renter portals and AI-assisted workflows for landlords.
- Agencies that need a safe, repeatable starting point for property knowledge, listing drafts, support triage, and owner review.

The free template is MIT-licensed. Paid client installs, hosted operations, custom integrations, and managed support can be sold by partners as implementation services.

## Start Here

1. Read `OPERATING_SYSTEM.md`.
2. Review `SUCCESS_CRITERIA.md`.
3. Fill in `workspace/01-property-profile.md`.
4. Review `workspace/02-data-boundaries.md`.
5. Update `data/properties/sample-property.json`.
6. Choose one workflow in `workspace/03-active-workflows/`.
7. Run validation:

```bash
npm run validate
npm run mcp:smoke
```

For the hosted control plane, run `npm run mcp:http`. The local stdio and hosted Streamable HTTP transports expose the same typed resources, prompts, tools, authority policy, and controlled-transition proof.

After Railway and managed Postgres are live, run `npm run activation:verify`. It checks readiness, Postgres mode, auth, tenant scope, authority policy, and the four governed agent tools without writing. Set `PROPERTY_OS_ACTIVATION_ALLOW_WRITES=true` only for the approved synthetic mission/evidence/draft/rejection proof described in `docs/remote-activation-proof.md`.

## Publish-Ready Paths

- Forkable GitHub workspace: this repo.
- Portal frontend: `property-portal-template`.
- Hosted MCP/worker plan: `railway/architecture.md`.
- Deployed MCP release receipt: `docs/remote-activation-proof.md`.
- Vercel/v0 implementation brief: `docs/v0-vercel-template.md`.
- Partner offer and handoff: `docs/partner-implementation-kit.md`.
- Implementation readiness cockpit: `docs/implementation-readiness-cockpit.md`.
- Portal install proof packet: `property-portal-template` v0.2.0 exposes `/admin/setup`, `/admin/control-center`, `/api/install/proof-packet`, `/api/agent-missions`, and `npm run install:proof`.
- Template readiness checklist: `TEMPLATE_READINESS.md`.
- Product editions and partner economics: `docs/product-editions-and-economics.md`.

## Included

- `AGENTS.md`: Codex operating rules.
- `CLAUDE.md`: Claude project instructions.
- `.codex/skills/property-os`: reusable Codex skill.
- `.codex/commands`: Codex workflow prompts.
- `.claude/agents`: dedicated agent profiles for property, listing, inquiry, support, privacy, platform, visual QA, and implementer growth.
- `.claude/skills`: business and MCP skills for commercial packaging and hosted agent architecture.
- `.claude/commands`: Claude workflow prompts.
- `mcp/`: MCP capability map and tool boundary.
- `mcp/server/`: official MCP SDK server for stdio and authenticated Streamable HTTP tools.
- `agents/team.manifest.json`: machine-readable specialist mandates, authority, proof, and handoffs.
- `.swarm/property-os.yml`: bounded swarm topology for Codex/Claude-compatible orchestration.
- `railway/`: hosted MCP/worker deployment architecture.
- `workspace/`: owner context, data boundaries, workflows, scorecards, proof notes.
- `workspace/06-runbooks/`: first 30 days, listing publication, renter support, and portal release gates.
- `docs/`: operator runbook, taste standard, and agent team.
- `docs/prd-lite.md`: public template requirements and release criteria.
- `docs/user-flows.md`: owner, renter, implementer, and agent swarm flows.
- `docs/success-metrics.md`: template, owner, renter, and implementer success metrics.
- `docs/v0-vercel-template.md`: v0 prompt and Vercel template expectations.
- `docs/community-fork-guide.md`: free/community fork rules.
- `docs/partner-implementation-kit.md`: partner offer, deliverables, sales script, and handoff proof.
- `docs/implementation-readiness-cockpit.md`: portal plus MCP readiness workflow for paid installs and agency delivery.
- `docs/agentic-service-offering.md`: agentic-as-a-service packaging.
- `docs/implementer-business-model.md`: how agencies and technical partners can earn with the template.
- `docs/production-readiness-standard.md`: security, performance, reliability, deployment, and agent governance gates.
- `docs/remote-activation-proof.md`: check-only and explicit synthetic-write proof for the deployed Railway control plane.
- `docs/ai-architecture-and-control-plane.md`: provider-neutral model routing, MCP deployment, receipts, and failure boundaries.
- `docs/product-editions-and-economics.md`: community, partner, managed-service, and agency product boundary.
- `docs/integration-readiness.md`: manual-first and API-later integration gates.
- `evals/agent-workflow-cases.json`: blocked-output expectations for agent workflows.
- `templates/`: copyable intake, listing, FAQ, maintenance, and weekly review templates.
- `data/`: sample property and approved knowledge records.
- `schemas/`: starter JSON schema copies.
- `scripts/`: validation and privacy scan.
- `install/`: setup, packaging, and portal wiring notes.
- `install/HOSTED-RUNTIME.md`: Vercel, Railway, database, storage, email, and MCP production path.

## V1 Rule

The system observes, drafts, reviews, and records evidence. A human approves anything renter-facing, price-related, legal, availability-related, urgent, or private. Approval alone never causes an external action.

## Support Boundary

Community users get the template, docs, and validation scripts as-is. Production installs should add private data storage, auth, monitoring, owner notification, legal review, and support ownership before handling real renter data.
