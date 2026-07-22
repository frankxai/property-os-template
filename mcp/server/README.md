# Property OS MCP Server

Production-oriented v0.2 control-plane template built on the official MCP TypeScript SDK.

## Surfaces

- local `stdio`: `npm start`
- hosted Streamable HTTP: `npm run start:http`
- liveness: `GET /healthz`
- readiness: `GET /readyz`
- MCP endpoint: `POST /mcp`
- protected-resource metadata: `GET /.well-known/oauth-protected-resource/mcp`

## Local Proof

```bash
npm ci
npm test
npm audit --audit-level=moderate
```

The tests use no secret values and cover SDK interoperability, HTTP auth and Origin denial, tenant isolation, governed model output, prompt-injection and private-input denial before model invocation, invented evidence citations, authority-crossing drafts, owner review outcomes, forged and expired receipts, concurrent single-use consumption, idempotent replay, privacy redaction, blocked external actions, and an embedded Postgres execution of the real migrations and repository.

After Railway and managed Postgres are configured, run `npm run activation:verify` from the repository root. It is check-only by default. With `PROPERTY_OS_ACTIVATION_ALLOW_WRITES=true`, it runs one synthetic mission/evidence/draft/rejection loop and emits a redacted activation packet while asserting that no content or external action was applied. See `docs/remote-activation-proof.md`.

## Governed Agent Runtime

`record_approved_evidence` lets an authenticated owner place an exact, versioned, privacy-checked fact in the tenant evidence ledger. `run_agent_draft` accepts an existing mission plus one to twelve references; the server resolves their excerpts from that RLS-protected ledger rather than trusting a caller-supplied approval flag. The AI SDK uses a release-pinned `PROPERTY_OS_AI_MODEL`, structured Zod output, bounded retries/tokens/time, content telemetry disabled, and zero model tools. A second deterministic policy pass rejects invented evidence references and copy that claims owner-gated actions happened.

Successful runs are tenant-scoped in `agent_runs` with prompt version, model alias, immutable evidence ref/version/content-hash snapshots, output hash, risk, latency, and token usage. `record_agent_run_review` records accept, revision, or reject feedback but always returns `contentApplied: false`; it does not publish or send the draft.

Set `PROPERTY_OS_AI_MODEL`, `PROPERTY_OS_AI_TIMEOUT_MS`, `PROPERTY_OS_AI_MAX_OUTPUT_TOKENS`, and `AI_GATEWAY_API_KEY` in the hosted service. The model is intentionally a deployment alias rather than a hardcoded product claim. Without `PROPERTY_OS_AI_MODEL`, the tool fails closed with `AGENT_RUNTIME_NOT_CONFIGURED` while non-model MCP tools remain available.

## Auth Modes

`static` is for one private pilot tenant. Set a generated high-entropy `PROPERTY_OS_MCP_AUTH_TOKEN` of at least 32 bytes, `PROPERTY_OS_DEFAULT_TENANT_ID`, an exact `PROPERTY_OS_MCP_ALLOWED_TENANTS` allowlist containing that tenant, `PROPERTY_OS_MCP_PUBLIC_URL`, and allowed hosts/origins.

`oidc` is for production. Set issuer, audience, JWKS URL, tenant claim, role claim, and the mandatory deployment tenant allowlist. The server verifies JWT signature, issuer, audience, expiry, scopes, tenant admission, and actor before tool execution. `npm run test:oidc` signs real RS256 tokens against a local JWKS server and proves valid, missing-tenant, foreign-tenant, wrong-issuer, wrong-audience, and expired outcomes.

Hosted public metadata, issuer, and JWKS URLs must use HTTPS and must not target private or reserved hosts. HTTP and loopback endpoints are accepted only when the server is explicitly bound to loopback with insecure-local mode for isolated protocol tests.

Static tokens are never a multi-tenant authorization model. Agency portals obtain short-lived service tokens with client credentials; those tokens must carry the same tenant as `PROPERTY_OS_ORG_ID`, `PROPERTY_OS_MCP_ALLOWED_TENANTS`, and the activation packet.

## Authority Boundary

The controlled transition proof supports only `mark-draft-reviewed`:

1. `propose_controlled_transition`
2. `record_owner_decision`
3. `apply_approved_transition`

Approval does not apply content. Apply requires an exact, active, actor-bound, tenant-bound, short-lived, single-use receipt plus an idempotency key. All renter messaging, publishing, dispatch, applicant, access, pricing, and availability actions remain blocked.

Without `DATABASE_URL`, the server uses memory for explicit loopback-only protocol proofs. Hosted readiness always requires durable state. With `DATABASE_URL`, the server uses the Postgres repository in `src/repository.mjs`. Apply `db/001-control-plane.sql` and then `db/002-governed-agent-runtime.sql` before deployment. `/readyz` returns `503` when durable state is absent, Postgres is unreachable, or either required control-plane table set is missing.

The durable path forces tenant RLS, locks accepted resource versions, serializes each idempotency key with a transaction-scoped advisory lock, consumes approval receipts atomically, and writes audit evidence in the same transaction. Run `npm run test:postgres` for an embedded non-superuser RLS proof, then repeat the live database gate against the target managed Postgres before production.
