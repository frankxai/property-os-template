# Security Policy

This template is public-safe by default and must stay free of renter private data, secrets, access codes, payment information, identity documents, and unapproved exact addresses.

## Supported Version

| Version | Supported |
| --- | --- |
| 0.2.x | Yes |
| 0.1.x | Security fixes only |

## Reporting

Do not open a public issue for secrets, data exposure, auth bypasses, or unsafe automation behavior. Use a private GitHub security advisory on the repository, or contact the maintainer through the private client channel that installed the system.

## Production Rule

Before using this with real renters, prove:

- the paired portal's explicit private-pilot or pre-bound agency OIDC authentication, with no global owner bearer
- encrypted runtime storage
- owner approval gates
- audit logs
- backup/retention policy
- legal review for leases, pricing, deposits, and local rental obligations
- dedicated non-owner, non-bypass database roles and tenant isolation in both logical databases
- short-lived portal-to-MCP client credentials plus a deployment tenant allowlist for agency use

The template must not automatically publish listings, message renters, dispatch vendors, approve applicants, reveal access information, or change pricing/availability without explicit owner approval.
