# Sunbird — Poki edition

A one-button 3D arcade glider: hold to dive, release to soar, and follow the hills before daylight runs out. This repository contains the game, its Poki integration, and local verification tools.

## Start here

Requirements: Node 22.19 or later in the Node 22 series and pnpm 9.15.0 (see `.nvmrc` and `packageManager`).

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev --host 0.0.0.0
```

Open the URL printed by Vite. The standalone preview can run without the Poki SDK; real platform features must be tested in Poki Inspector.

## Checks and build

```bash
pnpm check                        # lint, types, audits and upload-server tests
pnpm test                         # unit tests
pnpm build:poki                   # dist-poki/, poki-upload/, sunbird-poki.zip
pnpm verify:upload && pnpm verify:portals
pnpm exec playwright test -c playwright.artifact.config.ts  # packaged browser tests
pnpm exec playwright test -c playwright.hud.config.ts       # responsive flight HUD
pnpm test:visual                  # packaged visual checks (build first)
VISUAL_CAPTURE=1 pnpm test:visual -- e2e/visual-screens.spec.ts  # save screen-walk images
```

Playwright requires a compatible Chromium installation. Build artifacts, browser traces, dependencies, and local environment files are ignored by Git; they are not source files. Do not assume an old artifact matches the current source: rebuild it before verification or upload.

## Architecture

- `src/poki-main.ts` and `src/poki-shell.ts`: framework-free Poki entry, boot and error recovery.
- `src/game/`: game loop, physics, terrain, audio, input, persistence and gameplay systems. `src/game/hud/` contains screen renderers; `HUD.ts` owns the DOM.
- `src/sdk/`: platform adapter and Poki SDK lifecycle, language and ad integration.
- `src/i18n/translations.barrel.json`: translation source. Run `node scripts/gen-i18n-packs.mjs` after edits; the runtime loads the generated `public/i18n/` packs on demand.
- `e2e/` and `src/**/__tests__/`: browser and unit regression tests.
- `scripts/`: build, packaging, audits and local verification. `docs/poki/requirements.json` is the repository's extracted rule inventory, not a substitute for current Poki documentation or Inspector.

The Poki package has no real-money purchasing flow. Poki controls ad availability and playback; a rewarded ad grants its reward only when the SDK reports success. Automatic language selection respects a saved player preference.

## Release status and documentation

A passing local build or audit is **not** a Poki approval. Test the exact packaged artifact in [Poki Inspector](https://inspector.poki.dev/), on real mobile/tablet and desktop hardware, including ad outcomes and language switching, before requesting release. See [current handoff](./docs/HANDOFF.md), [documentation index](./docs/README.md), [Poki guide notes](./docs/poki/README.md), and [submission checklist](./SUBMISSION_CHECKLIST.md).

License: [MIT](./LICENSE).
