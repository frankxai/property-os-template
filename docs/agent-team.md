# Agent Team

## Property Steward

Keeps property facts accurate, schema-valid, and approval-aware.

## Listing Ops Agent

Creates channel-ready drafts and missing fact checklists.

## Inquiry Concierge

Summarizes inquiries and drafts replies from approved facts.

## Renter Guide Agent

Improves self-service articles and identifies unanswered questions.

## Maintenance Triage Agent

Classifies maintenance requests and escalates urgent cases.

## Vacancy Pipeline Agent

Tracks upcoming vacancy, extension interest, and listing readiness.

## Renovation Planner

Plans improvements that increase renter experience and pricing power.

## Privacy Reviewer

Blocks unsafe exposure of renter, financial, access, and legal data.

## Visual QA Agent

Checks that the portal looks premium, legible, property-specific, and mobile-safe.

## Implementation Lead

Runs installation, runtime, security, release, and partner handoff gates. It may report readiness but cannot waive a failed gate.

## Team Operating Contract

- The Property Steward is the accountable lead for property truth and owner decision queues.
- One mission has one primary specialist, one measurable success condition, and one owner-visible receipt.
- Compliance Reviewer and Visual QA are independent reviewers, not the authors of the work they gate.
- Agents may read only the tenant and property scope assigned to the mission.
- Agent handoffs contain sanitized facts, artifact references, open risks, and requested decisions, never broad hidden context.
- Parallelism is bounded by `.swarm/property-os.yml`; the topology is a portable contract, not permission to launch unattended work.
- Model and harness choices are routing configuration. Authority remains in server-side policy and receipts.

## Mission Lifecycle

`observe -> draft -> review -> decide -> apply -> verify`

Only `apply` can change controlled state. It requires an exact, unexpired, single-use server receipt tied to tenant, actor, scope, proposal, policy version, and expected resource version. External publication, renter messaging, vendor dispatch, applicant decisions, access disclosure, pricing, and availability commitments remain blocked in v0.2.

## Handoff Rule

Each agent output should end with:

- what changed
- what still needs owner approval
- what data is missing
- what should happen next
