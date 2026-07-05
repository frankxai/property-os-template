# MCP Architecture

Property OS should expose one MCP layer for agents and implementers once runtime storage exists.

## Server Roles

- Property context server: approved facts, units, FAQs, listing drafts.
- Operations server: sanitized inquiries, support tickets, approvals, agent runs.
- Integration server: dry-run payloads for EstateSync, ImmoScout24, email, calendar, and future channels.
- Implementation readiness server: partner-safe install audits, blocked-action summaries, and handoff checks.

## Deployment

- Local stdio MCP is best for private owner workspaces and implementer development.
- Streamable HTTP MCP is best for hosted SaaS, agency mode, and Railway-hosted services.
- Railway is appropriate for always-on MCP servers, queue workers, sync workers, and integration dry-run services.

## V1 Tool Boundary

Allowed tools draft, summarize, validate, request approval, and create sanitized issues.

Blocked tools publish listings, send renter messages, dispatch vendors, approve applicants, disclose access secrets, or change pricing/availability.

Use `create_implementation_readiness_snapshot` before a paid install is handed to an owner or agency. It should summarize what is ready, what still needs runtime configuration, and which actions remain blocked by the v1 safety model.

See `property-os.mcp.json` for the machine-readable capability map.
