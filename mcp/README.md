# MCP Architecture

Property OS exposes one governed interoperability layer for Codex, Claude, partner tools, and hosted agents.

## Capability Split

- Resources: approved sample facts, authority contract, agent team, success metrics, readiness.
- Prompts: owner review, listing gaps, maintenance, implementation, commercial offer, mission and transition review.
- Draft tools: missions, inquiry/support summaries, listings, replies, privacy scan, sanitized issues.
- Decision tools: proposal and owner decision are separate.
- Apply tool: consumes one server-issued receipt for one internal proof transition.
- External tools: publication, messaging, dispatch, applicant selection, access disclosure, pricing, and availability remain blocked.

## Deployments

- `stdio` is the default for a private owner workspace.
- Streamable HTTP is the hosted route for Vercel integrations, agency services, and Railway.
- Static bearer mode supports one private pilot tenant.
- OIDC JWT mode is required for multi-tenant production.
- Portal APIs remain the source for interactive owner decisions and high-frequency product state.

Run `npm --prefix mcp/server test` before every release. See `docs/ai-architecture-and-control-plane.md` and `mcp/property-os.mcp.json`.
