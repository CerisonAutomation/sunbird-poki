# SUNBIRD Repository Truth Audit — Refreshed

> **Status:** archived — repository truth audit refreshed after M2 integration (Sep 2026), with counts from that tree (212 tests; the suite is now ~1,400). Superseded by [`ROADMAP.md`](../../ROADMAP.md) and `pnpm gate`.

> **Status**: Refreshed after M2 integration (Sep 2026). The original "M1 only" audit is obsolete — most "absent" items below now exist. This document records the *current* repository state with locally observed evidence. It does not claim staging, portal sandbox, load, Docker, or Stripe webhook verification (those gates are explicitly marked).

## Executive Status

| Subsystem | Status | Evidence |
| --- | --- | --- |
| Browser client | **PASS (local)** | `npm run verify` passes; typecheck, tests (212), lint, build all clean. |
| Core flight physics | **PASS** | Fixed-step client sim in `Bird.step()`, deterministic by construction (seeded terrain + bit-exact tests). `scripts/physcheck.ts` runs and passes. |
| Local 40-bird race | **PASS (local)** | `MassRace.ts` runs local physics pilots wired into `Game.ts`; `serve_socket` path uses deterministic sync. |
| Realtime client | **WIRING IN PROGRESS** | `Realtime.ts` speaks the simple WS protocol; the Rust `legacy.rs` room service implements it authoritatively. Start-sync + reconnect-gating are partially wired (see Multiplayer Fairness). |
| Authoritative Rust service | **EXISTS — HARDENING IN PROGRESS** | `rust/` workspace with `sunbird-protocol` (8 KiB max JSON payload, version gate, closed enums) + `sunbird-server` (Axum WS, metrics, signed seat tokens, graceful shutdown, origin + payload enforcement added Sep 2026). |
| Node realtime reference | **DEPRECATED / ARCHIVED** | `server/sunbird-server.mjs` is `@deprecated` (kept for protocol reference). Not in any deployment artifact. |
| Leaderboard | **PASS (client-honest)** | Local fallback works by design. HTTP submission wired in `backend/src/` (Cloudflare Workers). Server accepts scores after simple numeric caps; no session-auth in the open endpoint — see Fairness findings. |
| Tournaments and prizes | **PASS (local) / CLIENT-AUTHORITATIVE for online** | Cups and local prize claims work offline. Online reward claims mutate local state. |
| Save/profile/inventory | **PASS (client)** | Versioned localStorage state, migrations, cosmetics, boosts, quests, import/export. No server signing. |
| Portal adapters | **PASS (builds) / UNVERIFIED (sandbox)** | Poki + CrazyGames + generic builds compile; SDK lifecycle wired (`Game.ts:2052`); 3 zips produced. No sandbox QA evidence (see Deployment Blockers). |
| Direct payments | **PASS (webhook-authoritative)** | Stripe Payment Links configured; `backend/src/entitlements.ts` verifies `Stripe-Signature` (HMAC-SHA256, 5-min tolerance), maps `checkout.session.completed` amount to SKU, stores keyed by `client_reference_id` (deviceId). Game calls `GET /entitlements?device=…` for server-verified SKUs. Local `confirmManual()` is a labelled fallback that cannot grant in production without backend. |
| PWA/offline | **PASS** | Manifest + service worker present; all icon assets exist in `public/icons/` (apple-touch, favicon-32/64, icon-192, icon-512). Cache version is `sunbird-shell-v2`. |
| CI | **PASS** | `.github/workflows/ci.yml` (lint/typecheck/test/build + portal zips + production gate) + `rust.yml` (fmt+clippy+test+release). |
| Docker | **ABSENT** | No Dockerfiles in repo. Rust binary is cross-compiled via `cargo build --release`. |
| Metrics/ops | **PASS** | Rust server has `/health`, `/ready`, `/metrics` (Prometheus), structured tracing logs, graceful shutdown with drain. |
| Release readiness | **NOT RELEASE CANDIDATE READY** — see Deployment Blockers. |

## What Was Fixed vs. the Original Audit

| Original Claim | Current Reality | Commit |
| --- | --- | --- |
| Rust backend absent | `rust/` workspace with `sunbird-protocol` + `sunbird-server` | integration branch |
| No CI | `.github/workflows/ci.yml` + `rust.yml` | integration branch |
| `ws` absent from package.json | `ws: ^8.18.0` declared | integration branch |
| No typecheck script | `npm run typecheck` = `tsc --noEmit` | integration branch |
| No test runner | Vitest: 212 tests / 31 files | integration branch |
| No `physcheck` | `npm run physcheck` passes | integration branch |
| PWA manifest/ SW missing | Present and verified | integration branch |
| Manifest references missing icons | 5 icons present in `public/icons/` | integration branch |

## Current Multiplayer Fairness Findings

| Requirement | Status | Finding |
| --- | --- | --- |
| 40-player room cap | **PASS** | `CAPACITY = 40` enforced in both `rooms.rs` and `legacy.rs`. |
| Synchronized start enforcement | **PARTIAL** | Server sends `{ type: "start", at, seed }`. Client gates `Game.startRun()` on `startsInMs` but the gate may fire before the server signal in edge reconnects. |
| Reconnect seat ownership | **PARTIAL** | Signed seat tokens (`auth.rs`) exist + verified by tests, but are **not yet enforced on WS reconnect**. Token format is exercised but not enforced on the connect path. |
| Stale cleanup | **PASS** | Client 6 s removal; server `SEAT_TIMEOUT` (30 s) + sweeper task + empty-room teardown. No reconnect-grace seat reservation. |
| Bounded input validation | **PASS** (as of Sep 2026) | WS upgrade enforces `max_message_size` + `max_frame_size = 8 KiB` (matches `MAX_JSON_PAYLOAD_BYTES`). `parse_client_message` rejects oversize. No per-seat rate limit on frame arrival (a flooded client could consume CPU parsing). |
| Server-authoritative finish | **PASS** | Server assigns finish places; client `finish` is advisory. Finish distance/plausibility bounds enforced server-side in `rooms.rs`. |
| Server-authoritative rewards | **PASS** | Tournaments + entitlements: Stripe webhook (`backend/src/entitlements.ts`) verifies `checkout.session.completed`, maps amount→SKU, stores keyed by deviceId. Client `confirmManual()` is a labelled offline fallback only. |
| WS origin enforcement | **PASS (as of Sep 2026)** | Both `/ws` and `/v1/ws` validate `Origin` header against `SUNBIRD_PUBLIC_ORIGINS` at upgrade time; dev allows `*`. |

## Operational Safety Findings

| Control | Status | Finding |
| --- | --- | --- |
| Environment validation | **PASS** | `Config::from_env` validates all fields with bounds; fails fast on bad input. |
| Health endpoint | **PASS** | `/health` + `/ready` distinguish readiness from liveness. |
| Metrics | **PASS** | `/metrics` (Prometheus), `metrics::install()` in Rust, HTTP counters via `TraceLayer`. |
| Structured logs | **PASS** | `tracing` + `tracing-subscriber` with `EnvFilter`; JSON fields for bind/origins. |
| CORS/origin enforcement | **PASS (HTTP)** / **PASS (WS)** | HTTP CORS uses `public_origins`; WS origin checked at upgrade. `SUNBIRD_ENV=production` rejects wildcard origins and non-HTTPS origins. |
| Rate limiting | **ABSENT** | No HTTP, join, state-frame, finish, or emote limits. Relies on the 8 KiB frame cap + client-driven 15 Hz broadcast. A malicious client could spam small state frames; needs per-seat token-bucket. |
| Graceful shutdown | **PASS** | `shutdown_signal` + `with_graceful_shutdown` + drain grace period (`SUNBIRD_SHUTDOWN_GRACE_SECONDS`, default 5s). |
| Durable persistence | **ABSENT** | Rooms + leaderboard are process memory (rooms) / KV (backend leaderboard). Restart loses rooms. |
| Dependency reproducibility | **PASS** | `package-lock.json` + `rust/Cargo.lock` present. |
| CI/Docker | **CI PASS** / **Docker ABSENT** | CI builds Rust release + browser bundles. No container artifact; deploy via `cargo build --release` binary or Vercel for frontend. |

## Product Integrity Findings

- Local bots are labeled "solo field" / squadron pilots: **good and preserved**.
- Online leaderboard UI degrades to explicitly local board: **good and preserved**.
- Portal build runtime suppresses direct paywall behavior: **wired** (`Game.ts:3207`, `:3243`, `:3266`, `:2883`, `:2887`); portal sandbox QA not yet done.
- PWA assets verified complete: 5 icons present.

## Verification Executed In This Refresh

### Repository inventory
- File inventory via repo tools: TypeScript client, Rust workspace (`sunbird-protocol`, `sunbird-server`), Cloudflare Workers (`backend/`), PGlite social server (`server/social/`), legacy Node prototype (`server/sunbird-server.mjs`), scripts, docs.
- Cargo workspace: `rust/Cargo.toml` + 2 crate manifests.
- Dockerfile: **0 files**.
- CI workflow: 2 files (`ci.yml`, `rust.yml`).
- Lockfiles: `package-lock.json`, `rust/Cargo.lock`.

### Frontend install
- `npm ci` is runnable from `package-lock.json`; used for all local verification.

### Typecheck
- `npm run typecheck` (`tsc --noEmit`): **PASS**, no errors.

### Lint
- `npm run lint` (ESLint `--max-warnings 0` on `src scripts api`): **PASS**, zero warnings.

### Test suite
- `npm test` (Vitest): **212/212 pass** across 31 files. 100× stability loop: 100/100 runs pass, zero flakes.

### Production build
- `npm run build` (Vite production): **PASS** → `dist/` (bundle ≈1.19 MB JS).
- `npm run build:itch` (single-file): **PASS** → `dist-itch/index.html` inline.
- `npm run build:portals`: **PASS** → 3 zips (`sunbird-poki/crazy/generic.zip`).
- `npm run verify:prod`: **PASS** — debug artifacts clean, determinism enforced, JS budgets OK, module coverage floors met.

### Rust gates
- `cargo fmt --all --check`: **PASS**.
- `cargo clippy --workspace --all-targets -- -D warnings`: **PASS**.
- `cargo test --workspace`: **PASS** (24 tests total: 5 protocol + 19 server).
- `cargo build --workspace --release`: **PASS** (binary built).

### Backend execution / load test
- **NOT EXECUTED IN THIS REFRESH** — would require provisioning a host + `SUNBIRD_PUBLIC_ORIGINS` + `SUNBIRD_RECONNECT_HMAC_SECRET` in a non-dev env. `ws://` localhost works with `SUNBIRD_ENV=development`.

## Deployment Blockers

Priority order:

1. **Docker artifact is absent.** No container for the Rust server or Cloudflare Workers backend. Deploy requires manual `cargo build --release` binary + env setup, or Vercel for frontend.
2. **No load test committed.** 40-player capacity is enforced in code but not verified under synthetic load.
3. **Reconnect seat ownership**: signed tokens exist but are not enforced on the WS connect path (token format only exercised by tests).
4. **No per-seat WebSocket rate limiting**: frame-rate throttle absent; relies on the 8 KiB frame cap.
5. **No reconnect-grace seat reservation** — a reconnecting pilot may lose their seat if another client claims the ID.
6. **Portal sandbox QA not done.** Builds compile and meet structural requirements (no external scripts, relative paths, no `window.open` outside Stripe-tab), but no Poki/CrazyGames review results are committed.

## M2 Release Verdict

**NOT RELEASE CANDIDATE READY.**

The repository contains a buildable, tested, linted TypeScript client + a verified Rust authoritative WS server + CI + portal packaging + webhook-authoritative Stripe entitlements. The remaining blockers are operational (Docker, load test, portal sandbox QA) and two protocol gaps (per-seat rate limiting, reconnect seat-token enforcement). The browser client and Rust server compile, test, lint, and build clean; 100× test stability confirmed with zero flakes.
