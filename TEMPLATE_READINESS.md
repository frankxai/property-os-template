# Template Readiness

## Audience

- independent landlords
- family property operators
- boutique real estate agencies
- implementation partners selling premium property portals

## Template Type

GitHub operating-system template with Codex and Claude skill packs, an official-SDK MCP control plane, bounded swarm contracts, Railway deployment, and Vercel portal wiring.

## Buyer Outcome

Install an approved-facts property workspace that supports listing drafts, inquiry replies, renter self-service knowledge, maintenance triage, vacancy planning, weekly owner review, and premium portal handoff.

## Deploy Target

- GitHub template repo for the operating workspace
- Vercel for the web portal
- Railway for hosted MCP/worker services after production hardening

## Monetization Path

- free community fork
- paid implementation package
- managed monthly owner operations
- partner/agency install services
- future premium bundle with videos, adapters, and managed hosting

The free edition keeps every safety control, sample workflow, schema, validation gate, and local MCP capability. Paid value is implementation, customization, hosting, integrations, operational accountability, and support.

## Required Before Production

- private owner/renter authentication
- secure runtime database
- email or WhatsApp intake with owner approval
- audit log and retention policy
- monitoring and incident process
- legal/compliance review for local rental market
- approved property photos and exact address publication policy
- portal install proof packet exported with `npm run install:proof` and reviewed through `/api/install/proof-packet`
- OIDC issuer, audience, JWKS, tenant claim, role claim, scopes, Origin allowlist, mandatory tenant allowlist, short-lived portal client credentials, and health checks configured for hosted MCP
- controlled-transition persistence implemented transactionally if any internal transition is enabled beyond the sample proof flow

## Publish Action

1. Push this repo as `frankxai/property-os-template`.
2. Mark it as a GitHub template.
3. Create a release only after validation, security scan, MCP adversarial tests, portal build, smoke tests, visual QA, and preview verification pass.
4. Link it from the FrankX Property Intelligence OS page.
5. Pair it with `frankxai/property-portal-template`.
