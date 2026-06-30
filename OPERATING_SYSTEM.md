# Property OS Operating System

This workspace is the owner-side operating layer for a rental property or small portfolio.

It is designed to keep approved facts, listing drafts, renter support knowledge, maintenance triage, and weekly owner decisions in one place. Agents can help draft, classify, validate, and summarize. The owner remains the authority for renter-facing promises.

## Core Loops

Daily:

- review new inquiries and support requests
- approve or rewrite drafted replies
- add missing facts to the knowledge queue
- escalate urgent maintenance through the owner-approved channel

Weekly:

- update availability and vacancy timeline
- review listing status by channel
- approve new renter FAQ answers
- close or escalate maintenance tickets
- pick the next property improvement
- record proof in `workspace/05-proof/proof-notes.md`

Monthly:

- review inquiry quality
- review recurring support questions
- improve property media and copy
- check privacy and public/private boundaries
- decide whether to extract improvements into the public template

## Human Approval Required

The agent may not independently approve:

- rent, deposit, utilities, refunds, or fees
- availability or reservation status
- lease terms
- legal wording
- urgent repair commitments
- access details
- renter-specific personal data
- channel publication

## Source Of Truth

Approved property facts live in:

- `data/properties/`
- `data/knowledge/`
- `workspace/01-property-profile.md`
- approved workflow docs

Runtime submissions belong in the connected portal database or secure form backend. GitHub issues should receive sanitized summaries only.

## How To Operate

1. Keep data small and accurate.
2. Draft with agents.
3. Approve with the owner.
4. Publish manually until the workflow is proven.
5. Improve one self-service answer every week.
6. Never let private data leak into public template material.
