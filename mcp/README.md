# MCP Architecture

Property OS should expose one MCP layer for agents and implementers once runtime storage exists.

## Server Roles

- Property context server: approved facts, units, FAQs, listing drafts.
- Operations server: sanitized inquiries, support tickets, approvals, agent runs.
- Integration server: dry-run payloads for EstateSync, ImmoScout24, email, calendar, and future channels.

## Deployment

- Local stdio MCP is best for private owner workspaces and implementer development.
- Streamable HTTP MCP is best for hosted SaaS, agency mode, and Railway-hosted services.
- Railway is appropriate for always-on MCP servers, queue workers, sync workers, and integration dry-run services.

## V1 Tool Boundary

Allowed tools draft, summarize, validate, request approval, and create sanitized issues.

Blocked tools publish listings, send renter messages, dispatch vendors, approve applicants, disclose access secrets, or change pricing/availability.

See `property-os.mcp.json` for the machine-readable capability map.
