# AI_RULES.md — Sunbird (Poki fork)

Sunbird is a one-button HTML5 arcade glider that ships as a **single-file Poki portal zip**. It is a
TypeScript game, not a content website: the only React in the product is the page shell. Rules below
win over any general habit — if something here conflicts with a "usual" React practice, this file is
the reason.

## Tech stack

- **Runtime**: TypeScript 5.9 in `strict` mode (`noUnusedLocals`, `noUnusedParameters`,
  `noFallthroughCasesInSwitch`), ES2020 target, ESM, no emit. No Babel, no `any` in shipped client code.
- **Build**: Vite 7 + `vite-plugin-singlefile` — the production build is one self-contained
  `index.html` (fonts and CSS inlined as data URIs, `base: "./"`). Terser with `drop_console`.
- **Rendering**: Three.js r186 (WebGL, ACES tone mapping) — the *only* graphics dependency.
- **Physics**: hand-rolled fixed-step deterministic simulation (`PHYS_HZ`/`PHYS_DT` in
  `src/game/constants.ts`, stepped in `src/game/Bird.ts`). No physics engine.
- **UI**: React 19.2 for the shell only (`src/App.tsx`, `src/GameShell.tsx`). The entire game HUD,
  menus and overlays are vanilla TS + direct DOM (`src/game/HUD.ts`, styled by
  `src/game/ui.css`).
- **Styling**: Tailwind CSS v4 via `@tailwindcss/vite`, CSS-first config in `src/index.css` (no
  `tailwind.config.js`). Design tokens are CSS custom properties (`--ink`, `--coral`, `--display`…).
- **Audio**: zero-asset procedural WebAudio — `src/game/Audio.ts`, `src/game/Music.ts`,
  `src/game/Songbook.ts`. There are no sound or music files in the repo.
- **Persistence**: `src/game/Storage.ts` (quota-aware wrapper + `src/game/resilience/durableSet.ts`).
  No database, no ORM, no state-management library.
- **Networking**: `src/game/resilience/fetchJson.ts` (timeout, retry, per-host circuit breaker),
  offline outbox, and portal P2P via `@poki/netlib`. The Poki SDK is wrapped in `src/sdk/*`.
- **Testing**: Vitest (jsdom) for units in `src/game/__tests__/`, `@playwright/test` for e2e in
  `e2e/`. Gates: `pnpm lint`, `typecheck`, `test`, `audit:ui`, `verify:prod`, `build:poki`.

## Library rules

### Adding dependencies
- **Runtime deps are near-banned.** The bundle is size-gated (`pnpm verify:prod`, portal zip audit)
  and everything is code-split behind one HTML file. Adding a runtime dependency needs an explicit
  request plus a note on bundle cost — prefer ~50 lines of local code.
- **Dev deps** are fine when they only run in CI/tooling (Playwright, madge, tsx).
- **Never add** a payment processor client (`@stripe/stripe-js` is banned by `verify:prod`; SKUs are
  server-side only), an icon library (inline SVG lives in `src/game/MenuIcons.ts` / `Sunbird.ts`), a
  router, a UI component kit, or a state library.

### Rendering & graphics → `three` only
- Use `three` and the existing rigs (`CameraRig`, `Sky`, `TerrainSystem`, `Fx`, `ParticleFX`,
  `TrailRibbon`). Do not add a second 3D/scene-graph/animation library.
- New art ships as procedural geometry/SVG/canvas — no image assets, no glTF loader pipeline.
- Dispose GPU resources on teardown; `hud-dispose-leak` / `performance` tests guard this.

### Physics & simulation → local modules
- `src/game/constants.ts` holds tunables; `src/game/math.ts` holds `lerp`, `clamp`, `smoothstep`,
  `SeededRandom`, `hash01`, `fbm`.
- **Determinism rule:** anything that can affect a scored/replayed/replicated outcome uses the seeded
  RNG (`SeededRandom` / `dateSeed`) and fixed-step accumulation — never `Math.random()`, never
  `Date.now()`, never frame-delta. `Math.random()` is acceptable only for cosmetic effects
  (`ParticleFX`) and cosmetic name generation (`pilotNameGenerator`).
- `physics.test.ts` asserts bit-exact `Bird.step()` on seeded terrain; a change there fails tests
  loudly and that is intentional.

### UI → React for the shell, vanilla DOM for the game
- React renders the page shell and nothing else (`App.tsx` mounts `GameShell` and dynamically imports
  `./game/Game`). The game code-split is load-bearing — keep the `import type { Game }` pattern so
  Three.js stays out of the first chunk.
- Every in-game screen (HUD, menus, dialogs, leaderboard, shop, results) is built in
  `src/game/HUD.ts`-style modules with `document.createElement` / `innerHTML` + `t()` strings. Adding
  React components, portals or a reconciler inside the game layer is a regression.
- Style the shell with Tailwind utilities and tokens; style in-game surfaces with the semantic classes
  in `src/game/ui.css`. Do not inline layout that a media query must override (`audit:ui` fails it),
  and do not add inline styles to a control that needs a narrow-screen rule.

### Text → `src/i18n`
- Every player-visible string goes through `t("hud.ui.SomeKey", params, "English fallback")` from
  `src/i18n`. 36 locales ship from `translations.barrel.json`; `pnpm i18n:audit` is a ratchet that
  fails when untranslated strings grow. Never hard-code copy in markup.
- Add the key to the barrel, then regenerate packs (`node scripts/gen-i18n-packs.mjs`); the locale test
  fails on drift.

### Data & network → `src/game/resilience/`
- Game data calls (leaderboard, ghosts, directory, entitlements) go through `fetchJson` with a
  `breakerKeyFor` key. Never a bare `fetch` for them.
- Bare `fetch` is allowed only in transport/blob paths that have their own rules: i18n pack loading
  (`src/i18n`), AUDS (`src/sdk/auds.ts`), telemetry fire-and-forget (`src/game/Telemetry.ts`),
  room WebSocket handshakes (`Realtime`, `Squad`).
- Offline/queued writes use `OfflineOutbox`; retries use `retryWithBackoff` (full jitter) from
  `backoff.ts`. Do not hand-roll a retry loop.
- Saves are sealed with `resilience/crc.ts` (`sealPayload` / `openPayload`) and written through
  `Storage`; never touch `localStorage` directly outside `Storage.ts`.
- User-generated content (pilot names) must pass `pilotNameModeration.ts` before it is rendered or
  broadcast, and must be escaped — `innerHTML` is the norm here, so this is a real XSS boundary.

### Poki integration → `src/sdk/*` only
- `@poki/sdk` is imported in `src/sdk/poki-canon.ts` / `poki.ts` only; game code calls the adapter.
  `@poki/netlib` may be imported in `src/game/PokiNetlib.ts` only — `pnpm isolation:check` fails the
  build otherwise.
- Ad and gameplay events go through the wrapper + `GameplayEventSink`; breaks respect
  `src/game/ContinueOffer.ts` and `adGate.ts`. The honesty rule: anything simulated on-device is
  badged as local/practice in the UI.
- Cross-edition strings live in `edition{,.portal}.ts` / `legal.edition.ts`, compared as *constant*
  literals against `import.meta.env.VITE_PORTAL_TARGET` so Rollup folds the other portal out. A
  runtime object comparison leaks another portal's name into the zip and fails `verify:portals`.

### Assets, fonts & icons
- Fonts are self-hosted `.woff2` in `public/fonts/` and imported as resolved asset URLs in
  `src/index.css` — never a CDN or Google Fonts link (portal + CSP gate).
- Icons and the sunbird/bird art are generated inline SVG functions (`Sunbird.ts`, `MenuIcons.ts`).
  No sprite sheets, no icon font.

## Where code goes

- `src/App.tsx`, `src/GameShell.tsx` — React shell only.
- `src/game/*.ts` — engine, systems, HUD, tests in `src/game/__tests__/`.
- `src/game/resilience/` — network, storage, crash, retry primitives.
- `src/sdk/` — platform/portal adapters, no game logic.
- `src/i18n/` — locale plumbing and the translation barrel.
- `scripts/` — build/verify/audit tooling; `api/` — Vercel leaderboard functions.
- Keep dependency direction acyclic (`pnpm circular:check`) and keep `src/game/` free of React
  imports.

## Before you call it done

```bash
pnpm typecheck && pnpm test && pnpm lint && pnpm audit:ui
```

Touching the bundle, deps, portal strings or build config also requires
`pnpm verify:prod && pnpm build:poki && pnpm verify:portals && pnpm isolation:check`.
Never leave a `TODO`, placeholder or disabled test behind — the suite is the contract.

## Read next
`README.md` (product + build targets), `docs/HANDOFF.md` (standing decisions, contested traps),
`docs/README.md` (doc map), `PORTAL_PUBLISHING.md` (portal rules), `docs/poki/` (131 extracted Poki rules).
