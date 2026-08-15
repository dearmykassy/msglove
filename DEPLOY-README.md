# Massage Love deployment bundle

This is a self-contained source + static-export handoff prepared on 2026-08-15.

## Deploy the current static site

Publish the contents of `out/` as the web root. Do not publish `src/`, `scripts/`,
or project metadata as public files.

```bash
cd /Users/ssm/Documents/Services/massagelove
# Upload/sync the *contents* of out/ to the hosting document root.
```

The static export already contains the generated regional pages and the version-2
regional banner WebPs under `out/images/massage-love-heroes/v2/`.

## Rebuild before a future deploy

```bash
cd /Users/ssm/Documents/Services/massagelove
pnpm install --frozen-lockfile
pnpm lint
pnpm exec next build
```

`node_modules/` and `.next/` are intentionally not bundled. The lockfile is
included so a clean install is reproducible.

## Pre-launch caveat

The current project uses a placeholder site domain / noindex-oriented setting.
Set the real production domain and search-index policy deliberately before
publishing, then rebuild `out/`. Search Advisor registration has not been run
from this bundle.

## Release contents

- `src/data/image-release.generated.json`: complete version-2 image release map.
- `public/images/massage-love-heroes/v2/`: 390 responsive WebPs (130 assets × 3).
- `out/`: current static export.
- `artifacts/`: focused image-release receipts only; temporary screenshots and
  historical QA/cache directories are intentionally excluded.
