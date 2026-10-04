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
  menus and overlays are vanilla TS + direct DOM, split across `src/game/hud/` (screens + view
  model) and `src/game/HUD.ts` (the DOM controller), styled by `src/game/ui.css`.
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
- Every in-game screen (HUD, menus, dialogs, leaderboard, shop, results) is a **pure string
  builder** — `(snapshot) => html` — in its own module under `src/game/hud/`, composed with
  `document.createElement` / `innerHTML` + `t()` strings. Adding React components, portals or a
  reconciler inside the game layer is a regression.

### `src/game/hud/` is a layered DAG, not a folder of equals
Dependencies point one way only. A module may not import from a layer below it *and* be imported
by one — `pnpm circular:check` fails the build on a cycle, and the fix is to move a shared piece
down a layer, never to import sideways.

| Layer | Module | Holds |
|---|---|---|
| 0 | `types.ts` | `HudSnapshot` (227 fields) and the view-model types. Leaf — `import type` only, erases at build |
| 0 | `kit.ts` | Screen ids (`SCREEN`, `SCREEN_TITLES`) + chrome: `head`, `escapeHtml`, `sectionTitle`, `upsellStrip` |
| 1 | `parts.ts` | Fragments shared by 2+ screens: `renderMissions`, `renderGoalList`, `distanceText`, `aiRivalSection` |
| 2 | `shop.ts` | Commerce: hangar, coin store, checkout |
| 2 | `run.ts` | In-run: results card, continue, ad break, versus |
| 2 | `meta.ts` | Progression: high glides, pass, trophies, account, campaign, cups |
| 2 | `race.ts` | Competitive: lobby, ranked, squad, practice, modes |
| 3 | `../HUD.ts` | `class HUD` — the only module with DOM access. Wires the above and re-exports the public surface |

- **Tooling that scans `src/game` must recurse.** Splitting the HUD into `hud/` and the
  handlers into `actions/` silently broke `scripts/audit-ui.mjs`, which listed the directory
  flat. It saw 32 of 94 actions and reported 7 live buttons as dead, while saying nothing
  about the other 62. A refactor that moves code *out* of the top level has to update every
  script and test that enumerates the directory — a green audit is not proof it looked.
- `HudSnapshot` stays wide on purpose: it is the transport between `Game` and the renderer.
  **Every renderer narrows it in its own signature** — `Pick<HudSnapshot, "wallet" | "skins">`.
  No renderer in `src/game/hud/` may take a bare `HudSnapshot`; the declared contracts total 221
  fields against the type's 227, and the median screen declares 3. A screen that reads a field it
  did not declare is a compile error, which is the whole point.
- `HUD.ts` re-exports what `Game.ts` and the test suite import from it. Keep that public face
  stable: `wiring.test.ts` keys its dead-export registry by `module:Symbol`, and a re-export
  preserves the module id (`export { X } from "./y"` counts as an export of the re-exporting file).
- Style the shell with Tailwind utilities and tokens; style in-game surfaces with the semantic classes
  in `src/game/ui.css`. Do not inline layout that a media query must override (`audit:ui` fails it),
  and do not add inline styles to a control that needs a narrow-screen rule.

### Text → `src/i18n`
- Every player-visible string goes through `t("hud.ui.SomeKey", params, "English fallback")` from
  `src/i18n`. 36 locales ship from `translations.barrel.json`; `pnpm i18n:audit` is a ratchet that
  fails when untranslated strings grow. Never hard-code copy in markup.
- Add the key to the barrel, then regenerate packs (`node scripts/gen-i18n-packs.mjs`); the locale test
  fails on drift.
- **The i18n ratchet only counts what its categories match, so a new *kind* of copy is invisible
  until a category exists for it.** It watched `hud.toast()`, `head()`, `aria-label` and `<button>`
  labels — and said nothing about `sectionTitle()`, which was 31 hardcoded English headings across
  every menu sheet, nor about emoji-led buttons (`☀ FLY THE CHALLENGE`), which is this project's
  house style for every primary action and which the `buttonLabel` regex could not see because it
  demanded an ASCII letter first. When you add a new way for the UI to emit copy, add a category
  for it in the same change.
- **Wrapping copy in `t()` and adding the key to the barrel are ONE change, not two.** This is the
  invariant most easily got wrong, because the runtime is forgiving and the test is not: `t()` falls
  back through `pack[key] ?? EN[key] ?? defaultText`, so an unwrapped key renders its English
  fallback and looks completely healthy. But `locales.test.ts` asserts that **every literal key
  passed to `t()` exists in the barrel**, so a wrapper whose key was not added fails
  `pnpm test` — and adding that key needs a translation in all 36 locales *plus*
  `node scripts/gen-i18n-packs.mjs` (a second test regenerates the packs and compares them
  byte-for-byte). There is no shippable half: either a string gets its key, its 36 translations and
  regenerated packs in the same change, or it stays a literal. Do not add `t()` calls and defer.

### `Game.ts` is a god-object — extract it behind ports, one table at a time
`src/game/Game.ts` is one class, 182 methods, ~4,850 `this` references. Handlers are being moved
into `src/game/actions/*.ts` as **pure functions taking a port interface**, e.g.

```ts
export interface ShopActionContext { readonly save: SaveData; /* … */ }
export function shopAction(ctx: ShopActionContext, action: string, id: string): boolean
```

- **Drop `this` to force the dependency list.** Extract the body and replace `this.` with `ctx.`; the
  compiler then rejects anything the signature did not declare, so a forgotten field is a typecheck
  failure instead of a runtime `undefined`. Never pass `this` itself — `Game`'s members are private
  and a port typed as the whole class is not a port. `Game` builds the context in a `xContext()`
  method, which is where the table's blast radius is auditable.
- **Writable port members need accessors, not copies.** `modeId: this.modeId` typechecks perfectly
  and silently discards every `ctx.modeId = …`: the write lands on a throwaway object. Use
  `get`/`set` over `const self = this`. Plain members are safe **only** when the port member is
  `readonly` or the table mutates through a shared reference (`ctx.save.state.x`).
  This is the one hazard in this pattern the compiler will not catch — check the extracted body for
  `ctx.<x> =` and confirm each one is a live accessor.
- Members the table only *reads* are `readonly`; that is what keeps a table from quietly becoming a
  second god-object. Keep the `return false` default — `handleAction` dispatches on it.
- A port is only worth it if it is narrower than the thing it replaces. `journey.ts` is 14 members
  because the rules already live in `SaveData`; if a port approaches the size of `Game`, the seam is
  in the wrong place.

**State of the extraction (audited 2026-10-04).** `handleAction` dispatches six table handlers
before its own switch: `shopAction` (27 verbs, 9 members), `settingsAction` (17 verbs, 9 members),
`journeyAction` (8 verbs, 14 members), plus `handleSocialEvent`/`handleRoomEvent`/`handleContinueEvent`
which are still methods on `Game`. The inline `switch` still carries **55 cases spanning ~550
lines** — the bulk of it a block of `open-*` navigation verbs. Measured: **zero verbs are handled by
both a table and the switch**, so the extractions left no duplicated logic behind.

Every writable data member on every port already uses a `get`/`set` pair (`journeyContext` and
`settingsContext`; `shopContext` has none because all its data members are `readonly`). The next
table should follow that shape: data members `readonly` unless genuinely rewritten, and each
writable one an accessor pair — never a plain `modeId: this.modeId` copy.

**The multiplayer hexagon already exists and is separate from this pattern.** `NetTransport`
(`MassRace.ts`) is the port; `RealtimeClient` (`game/Realtime.ts`, WebSocket) and `PokiNetlibClient`
(`sdk/PokiNetlib.ts`, WebRTC P2P) are its two adapters. Their shared *domain* logic — the keyframe
vocabulary, the 15 Hz / 120 ms cadence constants, `newTrack`, `sampleTrack`, and the AI-fallback
lobby sequence — now lives once in `game/RoomSync.ts`, a pure leaf with no clocks, sockets, or DOM.
Only the wire stays in the adapters. **When adding shared multiplayer logic, put it in
`RoomSync.ts`, not in both transports** — the whole reason it exists is that two identical copies of
`poll()`'s interpolation had to be kept in sync by hand, and nothing in CI caught one being fixed
and not the other.

**Where the hexagon stops.** Each adapter keeps its own `autonomousLobbyPorts()` — ~25 lines that
bind its `tracks`/`localReady`/`autoReadyTimer`/`startsAt`/`pendingEvents` fields to
`runAutonomousReady`. That looks like the duplication this module was built to kill, and it is not:
those lines *are* the adapter's half of the port. Removing them means moving the lobby state onto a
shared base class, which is an architecture change, not a cleanup — don't do it to chase a line
count. The rule is that *logic* is shared and *wiring* is per-adapter. `runAutonomousReady` takes
`window.setTimeout` and `Date.now()` as injected callbacks (`schedule`, `onAllReady`) precisely so
the module stays clock-free and DOM-free; keep it that way.

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
  `@poki/netlib` may be imported in `src/sdk/PokiNetlib.ts` only — `pnpm isolation:check` fails the
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

### Styling: the design system is fenced on purpose
`src/game/__tests__/css-tokens.test.ts` is a **ratchet with a ceiling, not a budget**. Measured
2026-09-24, the headroom is essentially gone — do not plan a visual change around it:

| Budget | Cap | Current |
|---|---|---|
| `!important` — `index.css` / `ui.css` / `menu-polish.css` | 11 / 13 / 1491 | **11 / 13** / 1475 |
| Raw `color: #` literals — `index.css` / `ui.css` / `menu-polish.css` | 54 / 210 / 168 | 35 / **203** / 150 |
| Unique hex colours across all three sheets | 915 | 913 |
| Total hex declarations across all three sheets | 1500 | 1496 |

- **Never add a raw colour.** Paint with an existing token (`--coral`, `--ink`, `--text-on-sky`…).
  A new hex is a test failure, and that is the mechanism that once shipped a distance readout at
  0.8:1 against the dusk sky.
- **Never add `!important` to `index.css` or `ui.css`** — both are at cap. `menu-polish.css` is
  imported last, so it wins the cascade by default; that is the recorded debt.
- Every `var(--x)` must be defined in a sheet, carry a fallback, or be in the test's runtime
  allowlist. Each token is defined exactly once across all three sheets.
- Motion already exists in depth (56 `@keyframes`, 71 `transition` declarations). Check before
  adding more.
- **The `font` shorthand silently resets `font-variant-numeric`.** Any live number needs tabular
  figures, and a `font:` shorthand *after* the `tabular-nums` declaration puts it back to
  `normal` — and when the shorthand is `!important` (as `.stat-value` is in `menu-polish.css`),
  every longhand it resets inherits that importance, so a plain `tabular-nums` loses to it. This
  is why distance and coins were the only per-frame readouts still jittering. Declare
  `font-variant-numeric` *after* any `font` shorthand that can reach the element.
- **The flight lane belongs to the bird.** The centre 50% × 50% of the viewport is where the
  character and the immediate threat are rendered; persistent HUD furniture stays out of it. A
  full-width `> i` progress bar counts as a painted band, not a readout — `.wings-near` drew a
  340px rule through the middle of the screen until it became a chip in the altitude gauge's
  column. Check with painted width, not container width: a transparent full-width flex wrapper
  paints nothing.
- **Reduce motion reaches the flight HUD in two layers, and they fail differently.** The Settings
  toggle (`sb-reduce-motion` on `documentElement`, set in `HUD.ts`) is a *CSS* mechanism, so it
  cannot touch anything Three.js draws. The DOM half is `html.sb-reduce-motion .play-hud *` in
  `menu-polish.css` (impact popups, gauges); the WebGL half is a `settings.reduceMotion` check
  in `Game.ts` (`emitTrail`, `updateTrailRibbon`) and `CameraRig.setReduceMotion` (shake, punch,
  roll, speed lines). **A new FX system is reachable from neither until you add the check
  yourself** — `CSS cannot stop a particle emitter` is the whole trap. Speed lines are the
  deliberate exception: reduce-motion lowers their amplitude (18 → 4) rather than zeroing it, so
  velocity stays legible without the motion.

## Where code goes

- `src/App.tsx`, `src/GameShell.tsx` — React shell only.
- `src/game/hud/` — the view model (`types.ts`), shared chrome (`kit.ts`), shared fragments
  (`parts.ts`) and one module per screen group. Pure functions; no DOM.
- `src/game/HUD.ts` — the DOM controller. The only HUD module that touches the DOM.
- `src/game/actions/` — action tables extracted from `Game` behind port interfaces (`shop.ts`,
  `journey.ts`). Pure functions; they mutate only through the port, never through a `Game`.
- `src/game/*.ts` — engine, systems, tests in `src/game/__tests__/`.
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
