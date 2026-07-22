# Community Fork Guide

## What You Can Do

- fork the template
- use sample data
- build a public-safe property portal
- improve docs, agents, skills, prompts, and dry-run tools
- adapt the workflow for other property types

## What Must Stay Private

- renter identities
- access codes
- payment records
- identity documents
- leases and contracts
- private addresses if not meant for publication
- owner financial details

## Contribution Standard

- keep examples sample-safe
- run `npm run validate`
- do not add live posting, messaging, vendor dispatch, or applicant decisions
- document every new workflow with blocked actions and owner approval rules
- prefer small, reusable workflows over broad claims

## Free Community Version

The community version should stay useful without paid services:

- local workspace
- sample portal
- dry-run MCP tools
- manual listing workflow
- docs and templates
- validation scripts
- official-SDK local MCP server, authority tests, and hosted deployment contract
- agent and skill packs for Codex and Claude
- owner control-center source and sample mission workflow in the paired portal

Safety is not a premium feature. Privacy boundaries, blocked actions, authority tests, schemas, and release checks remain in the community edition.

## Fork-to-Proof Path

1. Fork `property-os-template` and `property-portal-template`.
2. Keep sample data until `npm run validate` and the full MCP test suite pass.
3. Deploy the portal as a Vercel preview; deploy MCP to Railway only when hosted auth is configured.
4. Complete the sample install proof before adding real owner or renter data.
5. Put client facts in a private install repo, never in a public fork.

Community support is documentation and issue-driven. It does not include production operations, incident response, legal review, custom integrations, uptime, or data-controller responsibility.
