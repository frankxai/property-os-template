# v0 And Vercel Template

Use this when turning the portal into a v0-generated or Vercel-template-facing public experience.

## Prompt

Build a premium rental-property operating portal for Property Intelligence OS using Next.js App Router.

Routes:

- `/`
- `/properties/[slug]`
- `/properties/[slug]/inquire`
- `/stay/[accessCode]`
- `/support`
- `/owner`
- `/admin/setup`
- `/admin/listings`
- `/admin/integrations`
- `/admin/agent-runs`
- `/admin/control-center`

Design:

- property media leads
- owner-review state is visible
- missing facts are shown
- mobile is intentionally composed
- no generic SaaS hero
- no fake automation claims
- no text overlap

Runtime:

- inquiry and support APIs return route and owner action
- agent run API records risk and owner review
- listing dry-run API blocks live publication
- runtime health shows demo or database-ready mode
- agent mission API records one specialist, objective, success metric, authority, audit event, and owner action
- control center shows runtime posture, authority boundary, mission lifecycle, team mandates, and auditable outcome targets

## Vercel Template Requirements

- README includes setup commands.
- `.env.example` has no secrets.
- sample data is marked sample-safe.
- build and smoke pass locally.
- preview URL is inspected on desktop and mobile before production.

## Architecture Boundary

- v0 is the project-generation and remix surface. Generated changes still pass the repository release gates.
- Vercel runs the Next.js portal, previews, server routes, and optional durable AI workflows.
- The Vercel AI SDK/model gateway can route provider-neutral model calls; no volatile model identifier is part of the product contract.
- Railway runs the long-lived authenticated MCP service and future workers on private networking.
- GitHub stores approved public-safe content, schemas, skills, prompts, releases, and sanitized issue summaries.
- Postgres stores tenant-scoped runtime records. Object storage holds private documents and media with explicit access policy.
- Codex and Claude are interchangeable engineering/co-worker harnesses around the same repository and authority contracts.

Use v0's Platform API for partner-controlled project creation only after generated-project ownership, billing, retention, and deletion behavior are documented. Do not call v0 from renter-facing runtime paths.

## Acceptance Flow

1. Fork or create the portal project.
2. Replace sample facts and media with approved client assets.
3. Configure owner auth, database, notifications, organization scope, and MCP OIDC.
4. Run validation, typecheck, build, API smoke, auth smoke, install proof, RLS smoke, and visual QA.
5. Inspect one Vercel preview on desktop and mobile.
6. Record unresolved risks and obtain owner acceptance before production.
