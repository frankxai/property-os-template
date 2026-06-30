---
name: property-os
description: Use when working on rental property profiles, listing drafts, renter portal knowledge, inquiry replies, maintenance triage, vacancy planning, or weekly owner dashboards inside a Property OS workspace.
---

# Property OS

## Source Order

1. `AGENTS.md`
2. `workspace/02-data-boundaries.md`
3. `workspace/01-property-profile.md`
4. The active workflow file in `workspace/03-active-workflows/`
5. Relevant records in `data/`

## Rules

- AI drafts; owner approves.
- Do not invent property facts, availability, rent, fees, lease terms, access codes, or promises.
- Mark renter-facing copy as `DRAFT - OWNER REVIEW REQUIRED`.
- Keep private data out of public outputs.
- End every workflow with a keep/change/stop decision.

## Default Workflows

- Property profile: make approved facts clear.
- Listing draft studio: create channel-specific drafts for manual owner publishing.
- Inquiry draft: answer only from approved facts and escalate sensitive topics.
- Renter portal knowledge: convert approved facts into self-service answers.
- Maintenance triage: classify urgency and draft owner notes.
- Weekly review: summarize open issues, vacancy risk, listing status, and decisions.

## Output Shape

Return:

- `Summary`
- `Inputs Used`
- `Draft`
- `Approval Required`
- `Risks Or Unknowns`
- `Next Action`

