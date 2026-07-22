# Remote Activation Proof

Use this gate after managed Postgres migrations and the Railway MCP deployment are live. It verifies the deployed service rather than the local implementation.

## Check-Only Mode

Set these environment keys in a private operator shell or secret manager:

```env
PROPERTY_OS_REMOTE_MCP_URL=https://your-service.example/mcp
PROPERTY_OS_REMOTE_MCP_TOKEN=set-me
PROPERTY_OS_REMOTE_MCP_ORIGIN=https://your-portal.example
PROPERTY_OS_ACTIVATION_TENANT_ID=pilot-tenant-id
```

Then run:

```bash
npm run activation:verify
```

The default mode performs no writes. It proves:

- `/readyz` reports the state store and agent runtime ready
- authority policy v2 is active with all six external actions blocked
- authenticated Streamable HTTP negotiation works
- mission, evidence, draft, and review tools are present
- the output reports environment posture without printing the bearer token

## Governed Write Proof

Enable the write gate only in a preview or approved pilot tenant:

```env
PROPERTY_OS_ACTIVATION_ALLOW_WRITES=true
```

Run the same command. The proof records synthetic data only:

1. one draft-only mission
2. one exact approved evidence record
3. one real structured model draft
4. one rejection review so the synthetic artifact cannot be reused as accepted work

The command fails unless evidence and output hashes are present, the evidence snapshot matches, model/prompt/latency/token receipts exist, `contentApplied` remains `false`, and the external action list is empty.

## Evidence Packet

Store the redacted JSON output with the pilot release evidence. It contains host, tenant id, service/runtime posture, mission/run ids, hashes, model alias, prompt version, risk, latency, tokens, and review outcome. It never prints the bearer token or evidence excerpt.

## Stop Conditions

- do not run write mode against an unapproved production tenant
- do not use real renter, payment, access, legal, or property-private content
- do not continue if `/readyz` reports memory storage, a disabled model runtime, or missing migrations
- do not interpret a successful draft as approval to publish, send, price, promise, dispatch, or apply content
