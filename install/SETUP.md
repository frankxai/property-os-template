# Setup

## Install Contract

Before private content or infrastructure work, create a public-safe install configuration and generate its implementation packet:

```bash
npm ci
npm run install:plan -- --config install/sample-install.config.json
```

Review `docs/self-service-install-plan.md`. Record the source config hash and plan hash in the implementation issue. The packet remains planned and unverified; it never substitutes for live proof or owner acceptance.

## Private Folder

1. Copy this repo to a private folder.
2. Fill in `workspace/01-property-profile.md`.
3. Update `data/properties/sample-property.json`.
4. Run `npm run validate`.
5. Choose one workflow.

## Hosted Runtime

When the owner wants a production portal or agency install, follow `install/HOSTED-RUNTIME.md` after the local workspace validates.

## Private GitHub Repo

Recommended when the owner starts using the workspace.

```bash
git init
git add .
git commit -m "Initial property OS scaffold"
```

Keep the repo private unless every file is public-safe.
