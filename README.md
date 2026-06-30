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
```

## Included

- `AGENTS.md`: Codex operating rules.
- `CLAUDE.md`: Claude project instructions.
- `.codex/skills/property-os`: reusable Codex skill.
- `.codex/commands`: Codex workflow prompts.
- `.claude/commands`: Claude workflow prompts.
- `workspace/`: owner context, data boundaries, workflows, scorecards, proof notes.
- `workspace/06-runbooks/`: first 30 days, listing publication, renter support, and portal release gates.
- `docs/`: operator runbook, taste standard, and agent team.
- `templates/`: copyable intake, listing, FAQ, maintenance, and weekly review templates.
- `data/`: sample property and approved knowledge records.
- `schemas/`: starter JSON schema copies.
- `scripts/`: validation and privacy scan.
- `install/`: setup, packaging, and portal wiring notes.

## V1 Rule

The system drafts and organizes. A human approves anything renter-facing, price-related, legal, availability-related, urgent, or private.
