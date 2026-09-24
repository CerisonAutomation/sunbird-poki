# Poki CLI — Developer CI/CD Setup

Automated deployments to Poki using [poki-cli](https://github.com/poki/poki-cli).

## Prerequisites

- Node.js 18+
- A `POKI_UPLOAD_TOKEN` from the Poki dashboard → Integrations → Game Upload Token
- Game ID: `3625e78b-0b3d-4f62-8224-ac1c4b2a9ab2`

> **Security**: Never commit `POKI_UPLOAD_TOKEN` to git. Store it as a CI secret or in `.env.local` (which is gitignored).

## Quick Start

```bash
# Build the Poki bundle
pnpm build:poki

# Upload via poki-cli
POKI_UPLOAD_TOKEN=<your-token> poki upload \
  --game 3625e78b-0b3d-4f62-8224-ac1c4b2a9ab2 \
  sunbird-poki.zip

> **Note:** `poki` resolves from `node_modules/.bin` (via pnpm or your IDE). From a plain shell use `pnpm exec poki upload ...`. The canonical project command is `pnpm poki:upload`, which builds the portal bundle first.
```

## GitHub Actions

Add `POKI_UPLOAD_TOKEN` as a repository secret, then:

```yaml
# .github/workflows/poki-deploy.yml
name: Deploy to Poki

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Build Poki bundle
        run: pnpm build:poki

      - name: Upload to Poki
        env:
          POKI_UPLOAD_TOKEN: ${{ secrets.POKI_UPLOAD_TOKEN }}
        run: |
          poki upload \
            --game 3625e78b-0b3d-4f62-8224-ac1c4b2a9ab2 \
            sunbird-poki.zip
```

## Local Development

```bash
# Build and verify compliance before uploading
pnpm build:poki
pnpm verify:upload

# Preview locally — serves the exact upload artifact (poki-upload/) on :4174
# with the framing headers the Inspector needs, so what you fly is the shipped
# single file rather than a dev-server view. (`pnpm preview` is Vite's preview
# of dist/, which is NOT the portal artifact.)
pnpm serve:upload
```

## Manual Upload

The `sunbird-poki.zip` produced by `pnpm build:poki` can also be dragged into the Poki dashboard at:
https://developers.poki.com/games/3625e78b-0b3d-4f62-8224-ac1c4b2a9ab2/submissions

## Verification Checks

`pnpm verify:upload` validates the bundle against Poki upload requirements before submission:

| Check | What it verifies |
|-------|-----------------|
| ROOT-01 | Single `index.html` at zip root |
| ROOT-02 | Poki SDK script present |
| ROOT-03 | `gameLoadingStart` + `gameLoadingFinished` called |
| ROOT-04 | `gameplayStart` + `gameplayStop` wired |
| ROOT-05 | `commercialBreak` call present |
| ROOT-06 | No absolute URLs (`http://`, `https://`) |
| ROOT-07 | No IAP/foreign portal strings |
| ROOT-08 | Bundle ≤ 50 MB |

## Build Output

| File | Size | Description |
|------|------|-------------|
| `sunbird-poki.zip` | ~900 KB | Upload-ready bundle |
| `poki-upload/index.html` | ~900 KB | Self-contained single file |
| `dist-poki/` | — | Build intermediates |
