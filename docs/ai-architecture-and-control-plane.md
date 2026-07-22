# AI Architecture And Control Plane

## Runtime Roles

| Layer | Job | Authority |
| --- | --- | --- |
| Portal on Vercel | renter, owner, implementer experience | typed product APIs only |
| Postgres | private runtime truth, RLS, audit, receipts | tenant-scoped transactions |
| AI SDK runtime | structured, evidence-grounded drafting | proposal output only; zero model tools |
| Property OS MCP | interoperable resources, missions, dry runs, governed internal transitions | scope and receipt enforced |
| Railway | always-on MCP, queues, retries, scheduled review | no public portal state by itself |
| GitHub | code, approved MDX/YAML, skills, issues with sanitized summaries | human-reviewed PRs |
| Codex | engineering, tests, visual QA, release work | repository permissions only |
| Claude Code | planning, critique, owner-workspace operations | workspace permissions only |
| v0 | design exploration and template/project automation | development tool, not renter runtime |

Codex and Claude Code are implementation harnesses. Customer-facing drafts should run through a provider-neutral model gateway with structured schemas, evaluation, cost limits, and the same policy service used by MCP and product APIs.

## Decision Path

```text
event -> deterministic policy -> tenant context -> evidence retrieval -> bounded agent mission
      -> structured draft -> specialist review -> owner decision
      -> server-issued receipt -> exact internal apply -> audit + undo -> outcome metric
```

External listing publication, renter messaging, vendor dispatch, applicant decisions, access disclosure, pricing, and availability changes stop before apply in v1.

## Model Routing

- Deterministic code handles auth, privacy classes, blocked actions, urgency rules, receipt binding, and idempotency.
- A fast approved model may classify and draft low-risk summaries from approved knowledge.
- A higher-reasoning approved model may draft complex listing, renovation, or compliance analysis.
- A second-model review is optional for high-risk drafts; it never substitutes for owner authority.
- Model aliases live in deployment configuration and are pinned per release. The template does not hardcode a volatile provider model name.
- Every successful model call records tenant, mission, prompt version, immutable evidence ref/version/content-hash snapshots, latency, token usage, output hash, and risk. Owner accept/revise/reject is recorded separately; provider billing remains the source of cost truth.
- Model input is limited to sanitized objectives and server-resolved references from the tenant approved-evidence ledger. Caller-supplied approval flags are not trusted; private-data and prompt-injection classes fail at evidence ingest and again before generation.
- Generated objects are schema-validated and policy-scanned again. Invented citations and external-action claims are rejected rather than softened.

## MCP V0.2

- Official TypeScript SDK.
- `stdio` for local owner and implementer workspaces.
- stateless JSON Streamable HTTP for hosted tool calls.
- host and Origin validation.
- static bearer token for a private single-tenant pilot.
- OIDC JWT verification with issuer, audience, JWKS, tenant claim, role, and scopes for production.
- short-lived, actor-bound, single-use approval receipts for one internal proof transition.
- memory adapter for local protocol demonstrations; Postgres is the authoritative hosted adapter when `DATABASE_URL` is set.
- forced tenant RLS, accepted-state `resource_versions`, transaction-scoped idempotency locks, atomic receipt consumption, and same-transaction audit evidence.
- `record_approved_evidence` stores exact versioned facts under forced RLS; `run_agent_draft` resolves those refs server-side and uses AI SDK 7 structured output, bounded runtime settings, disabled content telemetry, no model tools, and deterministic post-generation policy.
- `record_agent_run_review` stores owner accept, revision, or reject outcomes without applying or sending content.
- `/healthz`, `/readyz`, and OAuth protected-resource metadata.
- `/readyz` fails when configured Postgres is unavailable or unmigrated.
- adversarial tests for tenant mismatch, forged/expired/consumed receipts, stale state, concurrent replay, idempotency conflict, privacy redaction, and blocked external actions.
- embedded Postgres proof executes both production migrations under a non-superuser role and verifies RLS, durable mission and model-run state, owner review, proposal, receipt, apply, version, audit, and replay behavior.

The portal calls `create_agent_mission` through the authenticated MCP client whenever MCP is configured. Invalid configuration or transport failure returns `503`; it does not create a second local mission or notify the owner as if durable work succeeded.

## Durable Work

Use a durable workflow or queue for weekly digests, integration retries, media processing, and long-running portfolio analysis. Each step must be retry-safe and checkpointed. Keep interactive forms and owner decisions in typed portal APIs; MCP is an interoperability layer, not an authorization bypass.

## Current Official Anchors

- [MCP Streamable HTTP specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
- [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [MCP TypeScript SDK server guide](https://ts.sdk.modelcontextprotocol.io/server)
- [Vercel AI agent guide](https://vercel.com/kb/guide/how-to-build-ai-agents-with-vercel-and-the-ai-sdk)
- [AI SDK structured output](https://ai-sdk.dev/docs/reference/ai-sdk-core/output)
- [Vercel AI Gateway](https://vercel.com/ai-gateway)
- [v0 Platform API overview](https://v0.dev/docs/api/platform/overview)
- [Railway template best practices](https://docs.railway.com/templates/best-practices)
