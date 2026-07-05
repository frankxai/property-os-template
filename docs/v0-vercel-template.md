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

## Vercel Template Requirements

- README includes setup commands.
- `.env.example` has no secrets.
- sample data is marked sample-safe.
- build and smoke pass locally.
- preview URL is inspected on desktop and mobile before production.
