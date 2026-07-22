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

The tests use no secret values and cover SDK interoperability, HTTP auth and Origin denial, tenant isolation, forged and expired receipts, concurrent single-use consumption, idempotent replay, privacy redaction, blocked external actions, and an embedded Postgres execution of the real migration and repository.

## Auth Modes

`static` is for one private pilot tenant. Set `PROPERTY_OS_MCP_AUTH_TOKEN`, `PROPERTY_OS_DEFAULT_TENANT_ID`, `PROPERTY_OS_MCP_PUBLIC_URL`, and allowed hosts/origins.

`oidc` is for production. Set issuer, audience, JWKS URL, tenant claim, and role claim. The server verifies JWT signature, issuer, audience, expiry, scopes, tenant, and actor before tool execution.

Static tokens are never a multi-tenant authorization model. Put the service behind an OAuth 2.1/OIDC authorization server for agency or marketplace use.

## Authority Boundary

The controlled transition proof supports only `mark-draft-reviewed`:

1. `propose_controlled_transition`
2. `record_owner_decision`
3. `apply_approved_transition`

Approval does not apply content. Apply requires an exact, active, actor-bound, tenant-bound, short-lived, single-use receipt plus an idempotency key. All renter messaging, publishing, dispatch, applicant, access, pricing, and availability actions remain blocked.

Without `DATABASE_URL`, the server uses memory for local protocol proofs only. With `DATABASE_URL`, it uses the durable Postgres repository in `src/repository.mjs`. Apply `db/001-control-plane.sql` before deployment. `/readyz` returns `503` when Postgres is unreachable or the control-plane tables are missing.

The durable path forces tenant RLS, locks accepted resource versions, serializes each idempotency key with a transaction-scoped advisory lock, consumes approval receipts atomically, and writes audit evidence in the same transaction. Run `npm run test:postgres` for an embedded non-superuser RLS proof, then repeat the live database gate against the target managed Postgres before production.
