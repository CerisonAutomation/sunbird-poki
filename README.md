# Sunbird

> A one-button, side-scrolling arcade glider. Hold to dive, release to soar, chase the daylight across procedurally generated islands.

**This is the Poki fork.** This checkout ships the client and the Vercel leaderboard functions (`api/`) only. The self-hosted `rust/` room server, Cloudflare `backend/` workers, and `server/social/` PGlite layer referenced in older docs live in the parent monorepo, not here. Poki multiplayer in this fork uses Netlib P2P (with AUDS for player data where configured) — no Rust server is required.

> **No GitHub Actions.** CI workflows were removed (billing-blocked runs produced red noise). Local gates are the source of truth: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm audit:ui`, `pnpm docs:audit`, `pnpm verify:prod`, and the Poki verification chain below.

---

## Consolidated production & deployment (Poki CLI)

### Concrete goal
Deliver a **clean, polished, production-ready** repository and complete deployment through the **Poki CLI**.

### Acceptance criteria
- [x] **Clean code / polished repo:** debug leftovers removed (tracked junk, mixed lockfiles, agent/editor state untracked), merge conflicts resolved, no placeholder/TODO regressions introduced.
- [x] **No debug leftovers:** `inputprobe.tmp.mjs`, `audit-shots/`, `package-lock.json`, and `.github/context-mode/` session artifacts removed from tracking; local build artifacts remain gitignored.
- [x] **Lint / typecheck / tests pass:** `pnpm lint`, `pnpm typecheck` (or `tsc --noEmit`), `pnpm test`.
- [x] **Docs gate pass:** `pnpm docs:audit` (canonical claims and link/orphan/status checks).
- [x] **Prod-ready configuration:** `.env.example` uses placeholders only (no real secrets/IDs), Poki game IDs are sourced from `package.json` `build:poki` (single source of truth), `vercel.json` uses valid build/install commands, and portal isolation/marker gates remain intact.
- [x] **Builds pass:** `pnpm build` and `pnpm build:poki` produce valid artifacts (`dist/`, `dist-poki/`, `poki-upload/`, `sunbird-poki.zip`).
- [x] **Successful CLI deployment:** deploy via Poki CLI (`poki upload`) after verification.

### Deployment (Poki)
Prereqs: Node 22+ recommended, `pnpm` (see `packageManager`), Poki CLI installed and authenticated.

```bash
# 1) Install (clean, reproducible)
corepack enable
pnpm install --frozen-lockfile

# 2) Verify locally
pnpm lint
pnpm typecheck
pnpm test
pnpm docs:audit
pnpm audit:ui

# 3) Build & verify the Poki artifact
pnpm build:poki          # generates dist-poki/, poki-upload/, sunbird-poki.zip
pnpm verify:upload       # validates poki-upload/ shape
pnpm verify:portals      # portal/compliance gates
pnpm isolation:check

# 4) Deploy via Poki CLI
poki whoami              # confirm authenticated session
poki upload --name "$(git rev-parse --short HEAD)" --notes "$(git log -1 --pretty=%B)"
# or: pnpm poki:upload
```

**Output:** `poki-upload/` (folder the Poki Inspector accepts) and `sunbird-poki.zip`.

### Rollback steps
1. **Identify last good build:** keep the previous `poki-upload/` folder and/or `sunbird-poki.zip` (or the git commit/tag that produced it).
2. **Rebuild from last good commit:** `git checkout <good-commit-or-tag> && pnpm install --frozen-lockfile && pnpm build:poki`.
3. **Redeploy:** run `poki upload --name "<good-ref>" --notes "Rollback to <good-ref>"`.
4. **Verify:** open the Poki Inspector preview for the uploaded version and confirm boot, gameplay start/stop, and ad/event sequences as applicable.
5. **If CLI upload is unavailable:** upload the `poki-upload/` folder manually via the Poki Inspector/Developer dashboard (folder upload, not a GitHub zip wrapper).

### Edge cases & operational notes
- **Missing environment variables:** all `VITE_*` runtime vars are optional for offline/local play. Poki builds set IDs/URLs in `package.json` `build:poki`; keep `.env.example` as placeholders only. If a required portal/dashboard ID changes, update `build:poki` (single source of truth), rebuild, and re-verify (`pnpm isolation:check`, `pnpm verify:portals`).
- **Secrets handling:** never commit real secrets, tokens, or private IDs in `.env*` tracked files. `.env`/`.env.local` are gitignored; only placeholders belong in `.env.example`. Poki/Vercel/Upstash credentials must be supplied via CLI auth or platform secret stores, not source control.
- **CLI permissions / auth:** `poki whoami` must succeed before upload; if unauthenticated, run the Poki CLI login flow for your account and retry. In CI/non-interactive environments, ensure the CLI is pre-authenticated with approved credentials. If `vercel` CLI is present but not used for this deployment, ignore Vercel auth; Poki is the deployment target.
- **Build/upload failures:** run `pnpm verify:upload` and `pnpm verify:portals` to catch shape/compliance issues before upload. If upload fails due to network/permissions, retry after auth/network checks; artifact remains in `poki-upload/`/`sunbird-poki.zip`.
- **Rollback safety:** prefer deploying from a clean commit; keep artifacts for the last known-good release. Do not rewrite history for rollback—deploy the prior known-good build.
- **Portal compliance constraints:** Poki builds must not include external payment processors, external links except approved platform APIs, or non-Poki portal markers; enforced by `verify:portals`, `audit:zips`, `isolation:check`, and `verify:upload`.

---

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
| Payments | Coin economy in every build — the client loads no payment processor (`@stripe/stripe-js` is not a dependency; `Payments.ts` returns `null` from every processor entry point). `backend/` ships an optional server-authoritative Stripe webhook in the parent monorepo ([DEPLOY.md §5](./DEPLOY.md)) |
| Multiplayer | Poki build: Netlib P2P rooms (WebRTC datachannels). Self-hosted authoritative server lives in the parent monorepo, not this checkout |
| Leaderboard | Vercel Functions ([api/](./api/)) + Upstash Redis, on-device fallback ([LEADERBOARD_API.md](./LEADERBOARD_API.md)) |
| Ghosts | Async PvP via ghost publish/chase ([src/game/GhostNet.ts](./src/game/GhostNet.ts)) |
| Caching | Content-hashed Vite assets + immutable HTTP caching; legacy service worker safely retired |
| Resilience | Client kernel ([src/game/resilience/](./src/game/resilience/)): crash capture + persisted journal, per-host circuit breakers, timeout/retry with full-jitter backoff, durable offline outbox for score uploads, main-thread stall watchdog, quota self-healing storage writes |

## Quick start

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev            # game on :5173
```

Open `http://localhost:5173`. **Multiplayer needs no server** in this Poki fork: races use Poki Netlib (WebRTC P2P).

## Environment variables

Copy `.env.example` → `.env.local`. All variables are optional — the game runs fully offline without any.

| Variable | Description |
|---|---|
| `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_STRIPE_GOLD_LINK`, `VITE_STRIPE_VIP_LINK`, `VITE_STRIPE_STARTER_LINK` | **Reserved and unused by the client.** Portal/client builds must not ship processor origins. Selling SKUs is a server-side path only ([DEPLOY.md §5](./DEPLOY.md)) |
| `VITE_PORTAL_TARGET` | `none` (default) \| `poki` \| `crazy` \| `generic` |
| `VITE_LEADERBOARD_URL` | HTTP base URL for the online leaderboard |
| `VITE_MULTIPLAYER_URL` | WebSocket URL for realtime multiplayer rooms |

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start Vite dev server |
| `pnpm build` | Production bundle → `dist/` |
| `pnpm build:poki` | Poki submission: `sunbird-poki.zip` + `poki-upload/` (see [PORTAL_PUBLISHING.md](./PORTAL_PUBLISHING.md)) |
| `pnpm typecheck` | TypeScript type-check without emit |
| `pnpm test` | Run the full Vitest suite |
| `pnpm lint` | ESLint over src, scripts, api (`--max-warnings 0`) |
| `pnpm audit:ui` | Static UX/UI audit |
| `pnpm i18n:audit` | Translation-debt ratchet |
| `pnpm docs:audit` | Docs link/orphan/status/claims gate |
| `pnpm verify` | typecheck + test + build |
| `pnpm verify:prod` | Production readiness checks |
| `pnpm poki:preflight` | Full pre-submission pass |
| `pnpm poki:audit` | Extracted Poki rule audit (regenerates compliance report with flags as applicable) |
| `pnpm verify:upload` | Validate `poki-upload/` folder shape |
| `pnpm verify:portals` | Portal compliance gate |
| `pnpm isolation:check` | Enforce Poki/Rust/Netlib source split |
| `pnpm poki:upload` | Build Poki artifact and upload via Poki CLI |

## Testing & verification

- **Unit:** `pnpm test` (Vitest). Deterministic physics checks (e.g. `Bird.step()` on seeded terrain) are part of the suite.
- **Static gates:** `pnpm lint`, `pnpm typecheck`, `pnpm audit:ui`, `pnpm i18n:audit`, `pnpm docs:audit`, `pnpm circular:check`.
- **Prod/build gates:** `pnpm verify:prod`, `pnpm build`, `pnpm build:poki`, `pnpm verify:portals`, `pnpm verify:csp`, `pnpm audit:zips`, `pnpm verify:upload`, `pnpm verify:thumbnail`, `pnpm isolation:check`.
- **Poki deploy readiness:** `pnpm build:poki && pnpm verify:upload && pnpm verify:portals && pnpm isolation:check` then `poki whoami` and `poki upload ...`.

## Builds & portals

| Target | Upload to | Ads | Payments |
|---|---|---|---|
| `dist/` (default) | Vercel / self-host | None (own interstitial) | Coins only — no processor wired |
| `sunbird-poki.zip` / `poki-upload/` | Poki Inspector | Poki commercial + rewarded | Stripped |
| Other portal zips (`crazy`, `generic`) | Parent monorepo / other checkouts | Per target | Stripped |

This fork is **Poki-only**. See [PORTAL_PUBLISHING.md](./PORTAL_PUBLISHING.md) and [SUBMISSION_CHECKLIST.md](./SUBMISSION_CHECKLIST.md).

## Project structure

```
src/            React shell (App, main) + game/ (engine, HUD, systems)
api/            Vercel leaderboard functions (+ _lib)
scripts/        build/verify/audit/portal tooling
public/         icons, fonts, static assets
docs/           canonical, generated, and snapshot documentation
```

## Documentation (consolidated index)

**Primary:** this `README.md` (operations, deployment, acceptance, rollback).  
**Canonical/supporting:**
- [ROADMAP.md](./ROADMAP.md) — real vs wired-but-undeployed vs aspirational
- [docs/HANDOFF.md](./docs/HANDOFF.md) — current state, standing decisions, traps
- [docs/README.md](./docs/README.md) — doc map
- [DEPLOY.md](./DEPLOY.md) — hosting/env details
- [PORTAL_PUBLISHING.md](./PORTAL_PUBLISHING.md) — portal build/compliance matrix
- [SUBMISSION_CHECKLIST.md](./SUBMISSION_CHECKLIST.md) — Poki submission walkthrough
- [LEADERBOARD_API.md](./LEADERBOARD_API.md) — leaderboard/realtime contract
- [SOCIAL_API.md](./SOCIAL_API.md) — social API (parent/optional context)
- [LEGAL_SECURITY.md](./LEGAL_SECURITY.md) — legal/security register
- [PRODUCTION_READINESS_PLAN.md](./PRODUCTION_READINESS_PLAN.md) — ops gap register
- [docs/poki/](./docs/poki/) — extracted Poki rules, compliance artifacts, upload guidance
- [docs/audits/](./docs/audits/) and [docs/archive/](./docs/archive/) — snapshots/history

## License

[MIT](./LICENSE)
