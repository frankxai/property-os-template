# Security Policy

This template is public-safe by default and must stay free of renter private data, secrets, access codes, payment information, identity documents, and unapproved exact addresses.

## Supported Version

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |

## Reporting

Do not open a public issue for secrets, data exposure, auth bypasses, or unsafe automation behavior. Use a private GitHub security advisory on the repository, or contact the maintainer through the private client channel that installed the system.

## Production Rule

Before using this with real renters, add:

- private authentication
- encrypted runtime storage
- owner approval gates
- audit logs
- backup/retention policy
- legal review for leases, pricing, deposits, and local rental obligations

The template must not automatically publish listings, message renters, dispatch vendors, approve applicants, reveal access information, or change pricing/availability without explicit owner approval.
