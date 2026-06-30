# Listing Draft Studio

## Purpose

Turn approved property facts into channel-specific listing drafts for manual owner review and publishing.

## Inputs

- property profile
- unit details
- approved amenities
- approved rules
- public area notes
- owner-approved availability and pricing only

## Outputs

- own website listing draft
- Kleinanzeigen listing draft
- ImmoScout24 listing draft
- Immowelt listing draft
- missing facts checklist
- owner approval checklist

## Rules

- Do not invent price, availability, utilities, fees, deposits, exact address, or lease terms.
- Do not scrape or auto-post.
- Mark every draft as `DRAFT - OWNER REVIEW REQUIRED`.
- Use German-first copy unless the owner requests English.

## Keep/Change/Stop

After each use, record:

- keep: what saved time
- change: what facts were missing or wrong
- stop: what should not be repeated

