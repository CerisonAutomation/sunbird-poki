# 🐦 Sunbird

> A one-button, side-scrolling arcade glider. Hold to dive, release to soar, chase the daylight across procedurally generated islands.

[![CI](https://github.com/CerisonAutomation/sunbird/actions/workflows/ci.yml/badge.svg)](https://github.com/CerisonAutomation/sunbird/actions/workflows/ci.yml)

## What it is

Sunbird is a complete HTML5 arcade game: 8 flight modes, 40-pilot races, daily/weekly PvE, tournaments, 60+ skins with real mechanical perks, a season pass, ghost replays, and portal-ready builds — all running fully offline with zero required backend.

- **1P** — daytrip / zenith / distance / coin rush / perfect / endless, plus campaign, mastery, missions, collections
- **PvP** — 40-pilot mass race (live pilots + time-shifted leaderboard ghosts), ranked duels, Stormfront Royale, `#rival=` zero-server challenge links
- **PvE** — seeded daily challenge, weekly gauntlet, storm weather, login calendar
- **Honesty rule** — anything simulated on-device is badged as local/practice in the UI; server-owned results only where a backend actually referees (see [ROADMAP.md](./ROADMAP.md))
- **Review** — 360° comparative review vs multiplayer/mobile category standards: [docs/COMPARATIVE_REVIEW_360.md](./docs/COMPARATIVE_REVIEW_360.md)
- **Poki** — developer-guide implementation matrix, verified against Poki's public sources: [docs/POKI_IMPLEMENTATION_MATRIX.md](./docs/POKI_IMPLEMENTATION_MATRIX.md)

## Tech stack

| Layer | Choice |
|---|---|
| Renderer | Three.js r186 (WebGL, ACES tone mapping) |
| UI / HUD | React 19 + TypeScript 5.9 (strict) |
| Bundler / style | Vite 7 + Tailwind CSS v4 |
| Physics | Fixed-step deterministic client sim (`Bird.step()`, bit-exact tested) |
| Audio | Zero-asset procedural WebAudio synth (SFX + adaptive score, portal-safe) |
| Payments | Coin economy in every build — the client loads no payment processor (`@stripe/stripe-js` is not a dependency; `Payments.ts` returns `null` from every processor entry point). `backend/` ships an optional server-authoritative Stripe webhook so a deployment that sells SKUs can grant them ([DEPLOY.md §5](./DEPLOY.md)) |
| Multiplayer | Self-hosted Rust room server ([rust/](./rust/)) — lobby, seats, synchronized starts, server-authoritative finish order and a movement envelope that rejects impossible client positions |
| Leaderboard | Vercel Functions ([api/](./api/)) + Upstash Redis, on-device fallback ([LEADERBOARD_API.md](./LEADERBOARD_API.md)) |
| Ghosts | Async PvP via ghost publish/chase ([src/game/GhostNet.ts](./src/game/GhostNet.ts)) |
| Caching | Content-hashed Vite assets + immutable HTTP caching; legacy service worker safely retired |
| Resilience | Client kernel ([src/game/resilience/](./src/game/resilience/)): crash capture + persisted journal, per-host circuit breakers, timeout/retry with full-jitter backoff, durable offline outbox for score uploads, main-thread stall watchdog, quota self-healing storage writes |

## Quick start

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev            # game on :5173
cargo run --release -p sunbird-server   # optional: multiplayer rooms on :8080
```

Open `http://localhost:5173`. The dev server proxies `/mp` to the Rust room server.

## Environment variables

Copy `.env.example` → `.env.local`. All variables are optional — the game runs fully offline without any.

| Variable | Description |
|---|---|
| `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_STRIPE_GOLD_LINK`, `VITE_STRIPE_VIP_LINK`, `VITE_STRIPE_STARTER_LINK` | **Reserved and unused by the client.** Every build script blanks them and no code reads a processor origin; `scripts/verify-portal.mjs` fails a zip that contains `js.stripe.com`, `api.stripe.com`, `hooks.stripe.com`, `upstash` or a `pk_live_`/`pk_test_` key. Selling SKUs is a server-side path only ([DEPLOY.md §5](./DEPLOY.md)) |
| `VITE_PORTAL_TARGET` | `none` (default) \| `poki` \| `crazy` \| `generic` |
| `VITE_LEADERBOARD_URL` | HTTP base URL for the online leaderboard |
| `VITE_MULTIPLAYER_URL` | WebSocket URL for realtime multiplayer rooms |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production bundle (chunked; Vercel/PWA) |
| `npm run build:vercel` | Same as `build` (explicit CDN target) |
| `npm run build:itch` | Single-file bundle → `dist-itch/` |
| `npm run build:poki` / `build:crazy` / `build:generic` | Portal zips (see [PORTAL_PUBLISHING.md](./PORTAL_PUBLISHING.md)) |
| `npm run build:portals` | All three portal zips |
| `npm run test:mp` | Multiplayer protocol smoke against a running server |
| `npm run isolation:check` | Source-level split: the Rust stack stays platform-agnostic, the Poki edition stays Netlib P2P + AUDS, and neither leaks into the other |
| `npm run typecheck` | TypeScript type-check without emit |
| `npm test` | Run the full Vitest suite |
| `npm run pvp:check` | **Online stack, proven end to end**: boots the real room server on a scratch port and runs the protocol smoke, the live two-client PvP suite, the pilot-directory contract and the public room list against it |
| `npm run audit:ui` | Static UX/UI audit: dead buttons, null element refs, unlabelled controls, inline layout that media queries cannot override, unstyled classes and missing narrow-screen rules |
| `npm run test:pvp` / `test:lookup` | The same live suites against an already-running server (`VITE_MULTIPLAYER_URL=ws://127.0.0.1:8790/mp`) |
| `npm run test:server` | Social-backend suite (routes, storage, rooms) |
| `npm run verify` | typecheck + test + build |
| `npm run poki:audit` | Run every extracted Poki rule check, rewrite `docs/poki/COMPLIANCE.md` (add `-- --run` to execute the build/zip/thumbnail gates too) |
| `npm run poki:preflight` | The full pre-submission pass: build portals → gates → thumbnail check → audit |
| `npm run verify:thumbnail` | Thumbnail gate (square, ≥628px, full-bleed, contrast, playground-colour distance, weight) |
| `npm run render:thumbnail` | Regenerate the submission thumbnails from `assets/submission/art/` |
| `npm run lint` | ESLint over src, scripts (`--max-warnings 0`) |
| `npm run test:e2e` | Production-browser smoke tests using desktop/phone Page Objects (`pnpm exec playwright install chromium` once) |
| `npm run test:mp` | Two-client multiplayer smoke test — needs `npm run dev` **and** the room server running |
| `npm run botsim` | Headless load test: N real WebSocket pilots on the wire protocol |
| `npm run botsim:40` | 40-pilot load + anti-cheat + resume run (the CI gate) |
| `npm run physcheck` | Physics determinism harness |
| `npm run gen-icons` | Regenerate PWA icons |

## Testing

For the flight/performance changes and measurement limits, see [Flight & performance audit](docs/audits/FLIGHT_PERFORMANCE_AUDIT.md).

- **Unit** — `npm test`: pure-function coverage across PvP rating, challenges, mastery, economy, ghost codecs, protocol parsing, and bit-exact `Bird.step()` determinism on seeded terrain.
- **Stability** — the suite is loop-safe: 100 consecutive runs green with zero flakes (each run is independent; no shared state, no wall-clock dependence — season/week tests are timezone-independent).
- **Multiplayer smoke** — `npm run test:mp` joins two real WebSocket clients to the same room through the dev proxy and asserts roster visibility plus live state frames (`peers-visible=true`, 5+ frames in 4 s).
- **Load** — `npm run botsim:40`: 40 real WebSocket pilots on the shipped protocol. Gated in `.github/workflows/botsim.yml`; the Rust job requires cheat containment (`--require-anticheat`), so a regression that lets a teleport through fails the build. The same harness runs against the Node reference server (`server/sunbird-server.mjs`), where both implementations must agree: a dropped pilot has to come back to the *same room* it was racing in, and finish places must stay unique per race.
- **Rust** — `cargo fmt --check`, `cargo clippy`, `cargo test` in [rust/](./rust/).

## Builds & portals

| Target | Upload to | Ads | Payments |
|---|---|---|---|
| `dist/` (default) | Vercel / self-host | None (own interstitial) | Coins only — no processor wired |
| `sunbird-poki.zip` | Poki Inspector | Poki commercial + rewarded | Stripped |
| `sunbird-crazy.zip` | CrazyGames portal | CrazyGames midgame + rewarded (+ banner slot) | Stripped |
| `sunbird-generic.zip` | GameDistribution, Yandex, itch.io, Newgrounds, GameMonetize, Lagged, Coolmath, Kongregate, Armor, GamePix, Famobi, SoftGames | None (host injects) | Stripped |
| `dist-itch/` | Direct-host / itch.io raw HTML | None | As configured |

Every portal zip is self-contained (`index.html` + `icons/` + `fonts/`), uses only relative paths, boots from any CDN subpath, mutes on tab-hide/ads, fires `gameplayStart/Stop` + loading signals, and degrades to local ghosts/boards with no backend. Full compliance matrix and QA checklist: [PORTAL_PUBLISHING.md](./PORTAL_PUBLISHING.md).

### Multiplayer: two transports, one interface

| Build | Transport | Backend |
|---|---|---|
| Poki | **Netlib P2P** (`@poki/netlib` over WebRTC datachannels, code-split + dynamically imported) | none of ours — signalling is Poki's; player data uses **AUDS** (boards, ghost shares, run share codes, the pilot directory behind Pilot Lookup) |
| Direct / CrazyGames / generic | Self-hosted **authoritative WebSocket room server** (`VITE_MULTIPLAYER_URL` → TS `server/` or the Rust `rust/` workspace) | ours |
| Any build without WebRTC / a backend | Local AI flock (the UI says so) | none |

The split is enforced, not assumed: `pnpm isolation:check` fails if the Rust stack names
a platform integration, if `@poki/netlib` is imported outside `src/game/PokiNetlib.ts`, or
if the self-hosted client reaches the Poki transport at runtime; the portal markers
(`verify:portals`, `audit:zips`, `verify:upload`) do the same for the shipped bundles — no
`auds.poki.io` outside Poki, and no `/mp/v1/`, `sunbird-social` or `ws://` anywhere in a
portal edition. `pnpm pvp:check` then proves the self-hosted path works end to end with two
real clients against a real server.

## Project structure

```
src/            React shell (App, main) + game/ (engine, HUD, systems)
rust/           Cargo workspace: sunbird-protocol + sunbird-server (Axum WS)
api/            Vercel leaderboard functions (+ _lib)
backend/        Optional Cloudflare Workers: ghosts, telemetry, Stripe webhook entitlements (server-side only)
server/social/  Optional PGlite social layer (friends, squads, feed)
scripts/        verify-prod, mp-smoke, physcheck, portal packaging, icon gen
public/         PWA manifest, service worker, icons, self-hosted fonts
```

## Docs index

**Start at [`docs/README.md`](./docs/README.md)** — the canonical map: one doc per
topic, generated artefacts marked, snapshots dated and statused. `pnpm docs:audit`
fails the build on a broken link, an orphan doc, or a snapshot without a status.

- [docs/README.md](./docs/README.md) — "I want to…" navigation, canonical vs generated vs snapshot
- [docs/HANDOFF.md](./docs/HANDOFF.md) — current state, standing decisions, traps, next queue
- [docs/BENCHMARKS.md](./docs/BENCHMARKS.md) — Sunbird vs the best games in the class, mechanic by mechanic
- [ROADMAP.md](./ROADMAP.md) — what works, what's wired-but-undeployed, what's aspirational (the anti-overclaim file)
- [docs/poki/](./docs/poki/) — **the Poki developer guide, extracted into 131 numbered rules** plus the machine-readable `requirements.json`. `pnpm poki:audit` executes them and regenerates [COMPLIANCE.md](./docs/poki/COMPLIANCE.md); [REBUILD_REPORT.md](./docs/poki/REBUILD_REPORT.md) records what the extraction changed and the evidence for each change; [CSP_REQUEST.md](./docs/poki/CSP_REQUEST.md) is the paste-ready CSP submission
- [PORTAL_PUBLISHING.md](./PORTAL_PUBLISHING.md) — the four build targets + monetization matrix
- [SUBMISSION_CHECKLIST.md](./SUBMISSION_CHECKLIST.md) — the human walkthrough of a portal submission
- [LEADERBOARD_API.md](./LEADERBOARD_API.md) — leaderboard + realtime wire contract
- [SOCIAL_API.md](./SOCIAL_API.md) — social layer API
- [DEPLOY.md](./DEPLOY.md) — hosting, env, Stripe webhook setup
- [LEGAL_SECURITY.md](./LEGAL_SECURITY.md) — legal + security evidence register
- [docs/audits/](./docs/audits/) — dated evidence snapshots, each with a status line
- [docs/archive/](./docs/archive/) — superseded docs (history, not guidance)

## Deployment

- **Frontend** — Vercel: `vercel deploy --prod` (config in `vercel.json`). See [DEPLOY.md](./DEPLOY.md).
- **Leaderboard** — Vercel Functions in `api/`, persisted in Upstash Redis (required for production; in-memory fallback for previews).
- **Multiplayer** — Self-hosted Rust: `docker compose up -d --build` (Rust server + TS social backend, see [DEPLOY.md](./DEPLOY.md)) or `cargo build --release -p sunbird-server`. In-memory rooms cost nothing while empty. See [rust/README.md](./rust/README.md).
- **Portals** — `npm run build:portals` produces submission-ready zips for Poki, CrazyGames, and 10+ generic HTML5 portals.

## Game systems

1 Player (daytrip / zenith / distance / coin rush / perfect / endless) · PvP (40-pilot mass race with live pilots + time-shifted leaderboard ghosts, ranked duels, Stormfront Royale) · PvE (daily challenge, weekly gauntlet, storm weather) · Tournaments (weekly cups) · Rival challenge links (`#rival=` URLs — zero-server async duels) · Room invites (`#room=` URLs — private race rooms) · Share cards (flight image + referral + beat-me link in one tap) · Mastery, missions, collections, season pass, nest economy.

## License

[MIT](./LICENSE)

### Current UX and multiplayer consolidation

The home dropdown has been replaced with visible play/navigation choices.
**Same-screen 1v1** is on Home (P1: A/Space, P2: L/Enter; touch your own half).
**Play online** opens Create/Join room; practice settings are on a separate page.

`pnpm test:e2e:multiplayer` runs two real browser clients against isolated room
and Squad services. First install the social service dependency with
`npm ci --prefix server/social --ignore-scripts`. For local Squad preview, run
`node server/social/social-server.mjs` on port 8788 alongside Vite. The dev proxy
uses `/social`; deployed builds need `VITE_SOCIAL_URL` and a reachable service.

See [the consolidation audit](docs/audits/CONSOLIDATION_AUDIT.md) for findings, tests,
canonical modules and **mandatory Squad credential migration/deployment limits**.
The reference Node race server is for preview/protocol testing, not a replacement
for the production Rust service.
