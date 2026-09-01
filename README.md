# BizManage documentation

Source-backed end-user, administrator, API, AI, and CLI documentation for BizManage.

The site is intentionally static: Cloudflare Pages serves the repository root with no build command or output directory. Pushes to `main` publish automatically.

## Local preview

Run any static file server from this directory, for example:

```bash
npx serve .
```

## Refresh source indexes

With a BizManage core checkout available locally:

```bash
node scripts/generate-catalogs.js ../bizmanage-core
```

This updates the searchable UI action and supported REST API catalogs. Review generated changes before committing.

## Public repository safety

This repository and its deployed site are public. Use placeholders in examples and never commit credentials, tokens, tenant/customer data, private host details, source archives, or proprietary implementation snippets. Generated catalogs intentionally contain public-safe behavior descriptions and route contracts rather than backend source code.
