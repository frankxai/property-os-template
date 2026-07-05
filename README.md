# Property OS Template

Cloneable Codex/Claude-ready operating workspace for a landlord, property owner, or small property group.

This is not a property management suite. It is a private operating layer for approved property facts, renter knowledge, listing drafts, inquiry support, maintenance triage, and weekly owner review.

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

## Included

- `AGENTS.md`: Codex operating rules.
- `CLAUDE.md`: Claude project instructions.
- `.codex/skills/property-os`: reusable Codex skill.
- `.codex/commands`: Codex workflow prompts.
- `.claude/agents`: dedicated agent profiles for property, listing, inquiry, support, privacy, platform, visual QA, and implementer growth.
- `.claude/skills`: business and MCP skills for commercial packaging and hosted agent architecture.
- `.claude/commands`: Claude workflow prompts.
- `mcp/`: MCP capability map and tool boundary.
- `mcp/server/`: runnable dependency-free MCP server skeleton for dry-run tools.
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
- `docs/agentic-service-offering.md`: agentic-as-a-service packaging.
- `docs/implementer-business-model.md`: how agencies and technical partners can earn with the template.
- `docs/production-readiness-standard.md`: security, performance, reliability, deployment, and agent governance gates.
- `docs/integration-readiness.md`: manual-first and API-later integration gates.
- `evals/agent-workflow-cases.json`: blocked-output expectations for agent workflows.
- `templates/`: copyable intake, listing, FAQ, maintenance, and weekly review templates.
- `data/`: sample property and approved knowledge records.
- `schemas/`: starter JSON schema copies.
- `scripts/`: validation and privacy scan.
- `install/`: setup, packaging, and portal wiring notes.
- `install/HOSTED-RUNTIME.md`: Vercel, Railway, database, storage, email, and MCP production path.

## V1 Rule

The system drafts and organizes. A human approves anything renter-facing, price-related, legal, availability-related, urgent, or private.
