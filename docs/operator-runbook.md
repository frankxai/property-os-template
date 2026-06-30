# Operator Runbook

Use this runbook when installing the template for a landlord or property owner.

## 1. Intake

Use `templates/property-intake.md` to gather:

- public property facts
- units and capacity
- availability notes
- pricing policy
- amenities
- house rules
- property photos and rights
- renter FAQ
- support escalation path

Do not collect private renter data into this repo.

## 2. Build The Approved Property Profile

Update:

- `workspace/01-property-profile.md`
- `data/properties/sample-property.json`
- `data/knowledge/sample-faq.json`

Keep draft facts marked as draft until owner-approved.

## 3. Prepare Listing Drafts

Use:

- `workspace/03-active-workflows/listing-draft-studio.md`
- `.codex/commands/listing-draft.md`
- `templates/listing-channel-checklist.md`

Create drafts for the owner website and priority channels. Publication remains manual in v1.

## 4. Prepare Renter Self-Service

Use:

- `workspace/03-active-workflows/renter-portal-knowledge.md`
- `templates/renter-faq-template.md`

Start with the questions that remove the most owner admin:

- move-in or arrival
- utilities
- trash and recycling
- Wi-Fi or connectivity policy
- maintenance
- house rules
- extension or renewal interest

## 5. Prepare Support And Maintenance

Use:

- `workspace/03-active-workflows/maintenance-triage.md`
- `templates/maintenance-triage-template.md`

Make urgent escalation visible, but keep direct phone numbers or private channels out of public template examples.

## 6. Wire The Portal

Use:

- `install/PORTAL-WIRING.md`
- connected `property-portal-template`

Run portal validation, typecheck, build, and smoke checks before showing the owner.

## 7. Weekly Review

Use:

- `.claude/commands/weekly-owner-review.md`
- `templates/weekly-review-template.md`
- `workspace/04-scorecards/weekly-owner-dashboard.md`

The weekly review is the product. It turns scattered renter/admin work into one owner decision rhythm.
