# AI Architecture And Control Plane

## Runtime Roles

| Layer | Job | Authority |
| --- | --- | --- |
| Portal on Vercel | renter, owner, implementer experience | typed product APIs only |
| Postgres | private runtime truth, RLS, audit, receipts | tenant-scoped transactions |
| AI SDK runtime | structured drafting and tool selection | proposal output only |
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
- Every model call records tenant, mission, prompt version, evidence references, latency, token/cost estimate, output hash, risk, and final owner decision.

## MCP V0.2

- Official TypeScript SDK.
- `stdio` for local owner and implementer workspaces.
- stateless JSON Streamable HTTP for hosted tool calls.
- host and Origin validation.
- static bearer token for a private single-tenant pilot.
- OIDC JWT verification with issuer, audience, JWKS, tenant claim, role, and scopes for production.
- short-lived, actor-bound, single-use approval receipts for one internal proof transition.
- `/healthz`, `/readyz`, and OAuth protected-resource metadata.
- adversarial tests for tenant mismatch, forged/expired/consumed receipts, stale state, idempotency conflict, privacy redaction, and blocked external actions.

## Durable Work

Use a durable workflow or queue for weekly digests, integration retries, media processing, and long-running portfolio analysis. Each step must be retry-safe and checkpointed. Keep interactive forms and owner decisions in typed portal APIs; MCP is an interoperability layer, not an authorization bypass.

## Current Official Anchors

- [MCP Streamable HTTP specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
- [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [MCP TypeScript SDK server guide](https://ts.sdk.modelcontextprotocol.io/server)
- [Vercel AI agent guide](https://vercel.com/kb/guide/how-to-build-ai-agents-with-vercel-and-the-ai-sdk)
- [v0 Platform API overview](https://v0.dev/docs/api/platform/overview)
- [Railway template best practices](https://docs.railway.com/templates/best-practices)
