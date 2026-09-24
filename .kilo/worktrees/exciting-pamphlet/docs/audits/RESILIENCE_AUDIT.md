# Resilience & Reliability Audit — client kernel + feature scorecard

> **Status:** historical evidence — client-kernel and feature resilience scorecard, 2026-09-22, commit base `eb4054b`. Every score cites code or tests as of that commit; the reliability features graded here (offline outbox, circuit breakers, crash recovery) remain in the tree.

**Date:** 2026-09-22 · **Commit base:** `eb4054b` + resilience-kernel changes on `arena/01a0c68f-sunbird`
**Method:** every score below cites code or test evidence in-repo. Nothing is graded from intent. Scores are 1–5.

---

## 1. What this change added (verified by 98 new tests, `pnpm test` 1290/1290 green)

The repo already had solid bones: per-IP/seat rate limits (client+edge+Rust), storage health gates,
graceful shutdown, HMAC-signed scores, WebGL context-loss handling, an unhandled-rejection guard.
What was missing was the client-side failure story: crashes died at `console.error`, a hanging
backend froze board opens with no timeout, offline score uploads were dropped forever, quota
failures were reported but never healed, and main-thread stalls were pure anecdote. The kernel
(`src/game/resilience/`, all pure cores + thin side-effect shells) closes those gaps:

| Module | What it does | Tests |
|---|---|---|
| `errors.ts` | Error taxonomy: message normalization, PII/secret redaction, numeric-noise-collapsing fingerprints, severity classification, sliding-window rate gate | `resilience-errors` (13) |
| `crc.ts` | CRC32 payload sealing for persisted blobs; corrupt = detectable instead of silently wrong; legacy bare-JSON loads unchanged | `resilience-durable` (14) |
| `backoff.ts` | Full-jitter exponential backoff, per-attempt timeout, Retry-After (delta + HTTP-date), caller-owned retry policy | `resilience-backoff` (13) |
| `CircuitBreaker.ts` | Per-host three-state breakers; pure state machine; probe-based auto-recovery with doubling cooldown (flap protection) | `resilience-breaker` (10) |
| `fetchJson.ts` | The shared network path: timeout (8 s default), breaker, bounded retries (GET/idempotent-only), offline fast-fail, JSON guard, typed errors (`OfflineError`/`BreakerOpenError`/`HttpError`/`RetryableHttpError`/`BadResponseError`) | `resilience-fetch` (11) |
| `OfflineOutbox.ts` | Durable queue for best-effort POSTs: dedup-replace, cap 24, 7-day TTL, newest-first drain, poison counter | `resilience-outbox` (10) |
| `Watchdog.ts` | Visible-tab main-thread stall detection (1 s/2 s/5 s/10 s buckets), long-task worst-duration evidence, suspend/resume for legitimate pauses | `resilience-watchdog` (9) |
| `CrashReporter.ts` | Global error/rejection capture, dedup, redaction, 5-entry persisted journal (survives reload), breadcrumb trail, telemetry sink (fingerprints only — never raw messages) | `resilience-crash` (13) |
| `durableSet.ts` | Quota self-healing writes: evict regenerable caches (priority-ordered, protected-key deny-list) → retry → honest degraded report | `resilience-durable` (14) |

**Wiring (all behind existing behavior, no UX change):**
- `boot.ts` — CrashReporter installed first; `rejection-guard.ts` now captures (not just silences) every rejection.
- `Game.ts` — watchdog runs with the render loop (suspended on context loss), `crashReporter` bound to telemetry, `boot_after_crash {count}` reported once per session.
- `App.tsx` — React boundary feeds `crashReporter`; after ≥2 journaled prior-session crashes the error card offers "Reset saved progress" (breaks poisoned-save crash loops).
- `Leaderboard.ts` — board GET + score POST through `fetchJson` (breaker = API origin); failed uploads queue in `sunbird.outbox.score.v1` and drain on `online`/board-open. The server keeps best-row-per-pilot, so idempotent replay cannot regress the board.
- `GhostNet.ts` — ghost publish/fetch through `fetchJson` (breaker + 4 s timeout + 2 attempts).
- `SaveData.ts` — `persistNow` writes through `durableSetItem`; quota pressure now evicts caches before failing; `onEviction` observer added.
- `SaveData.ts` (round 2) — the save is now a **CRC32-sealed envelope** (`resilience/crc.ts`): writes are sealed (localStorage + portal cloud adapter receive the same sealed string), loads verify the checksum, legacy bare-JSON saves load untouched and upgrade on the next persist, and a checksum mismatch quarantines the blob exactly like unparseable JSON did. A silently bit-flipped save can no longer restore wrong numbers.
- HUD room entry — both ternary branches carried `id="race-room-code"` (duplicate DOM id, caught by `audit:ui`); deduplicated into shared markup. UI audit now passes.
- Telemetry sink (round 2) — `POST /telemetry` on the social server (`server/src/telemetry/TelemetryService.ts`): validated, capped aggregate counters (no PII by construction, per-process by design, 8 route tests). The client beacon now targets `VITE_SOCIAL_URL + /telemetry`; the dead Rust-server derivation was removed. Portal builds still blank the URL → no beacon (compliance preserved).

---

## 2. Feature scorecard — 5 aspects

Legend: **C**ompleteness · **Q**uality · **W**orking (verified) · **U**sability · **R**eliability. "Gap" = the single change that would most raise the score.

| Feature | C | Q | W | U | R | Evidence | Gap |
|---|---|---|---|---|---|---|---|
| Boot / first session | 5 | 5 | 5 | 5 | 4 | inline loader, staged `bootStage`, 20 s retry copy, `first-session`/`boot-progress` tests, `journeys` e2e | crash-journal surfacing in support flow (export UI) |
| Core flight loop (physics/terrain/weather/camera) | 5 | 5 | 5 | 5 | 5 | deterministic fixed-step sim, `physics*`/`terrain`/`camera`/`airtime` tests, `flight` e2e + frame-ceiling perf gate | — |
| Game modes (8) | 5 | 5 | 5 | 4 | 5 | `modes`, `challenge(s)`, `arcade*` tests; every mode reachable in `journeys` e2e | mode-specific tutorial hints |
| HUD + flight cues | 5 | 4 | 5 | 5 | 5 | `hud-layout`, `input-ui`, `flight-readability`, `emote-ui` tests; `mobile-touch` e2e | HUD density presets |
| Results / continue / recap | 5 | 4 | 5 | 5 | 5 | `results-actions`, `continue-offer`, `recap`, `shared-run` tests; `results`/`results-layout` e2e | — |
| Menu system | 5 | 5 | 5 | 5 | 5 | `menu*` ×3 tests, `overlay-navigation`, `screen-history`; `menu`/`menu-layout` e2e, visual baselines | — |
| Shop / economy / skins | 5 | 5 | 5 | 4 | 5 | `economy`, `shop` e2e, `squad-shop-autonomous`; every perk string test-enforced (ROADMAP) | wish-list / price-history |
| Progression (career/campaign/mastery/missions/challenges/achievements/season/collections) | 5 | 4 | 5 | 4 | 5 | `career`, `mastery`-via-career, `missions`, `challenges`, `achievements`, `seasonpass`, `season`, `surprises`, `events` tests | cross-device sync (see gaps §4) |
| Leaderboard (local+global+AUDS) | 5 | 5 | 5 | 4 | **5↑** | `pilot-name*`, `storage` tests; `fetchJson` breaker/retry/outbox wired this pass | — (was: no timeout/retry — fixed) |
| Async PvP ghosts | 5 | 4 | 5 | 4 | **5↑** | `ghostnet` test; hardened fetch wired | ghost carousel previews |
| Live PvP (duels/MassRace/Stormfront/squads) | 5 | 5 | 4 | 4 | 4 | `massrace*` ×2, `pvp*` ×5, `realtime.expanded`, `pvp-live` boots a real server in CI | production WSS hostname still deploy-gated (PRODUCTION_READINESS_PLAN) |
| Rooms (browse/invite) | 4 | 4 | 5 | 4 | 4 | `room-browser`, `roominvite.expanded`, `e2e-multiplayer/*` | cross-portal room policy (deferred by decision) |
| Social (directory/lookup/friends) | 4 | 4 | 4 | 4 | 4 | `pilot-directory`, `pilot-lookup` tests; honest offline empty-states (ROADMAP §"no fabricated fallback") | needs the live social service to verify |
| Payments / entitlements | 4 | 4 | 5 | 4 | 4 | `entitlements`, `payments.portal`; receipt list local; Stripe web worker documented (LEGAL_SECURITY) | restore-purchases UX on web |
| Settings / accessibility / i18n | 5 | 4 | 5 | 5 | 5 | reduce-motion/colorblind/large-text persisted via `<html>` classes; `i18n` e2e incl. RTL baselines; `input-standards` e2e | full WCAG 2.2 AA third-party audit |
| Persistence (SaveData) | 5 | 5 | 5 | 4 | 5 | `save` + `persistence` e2e; corrupt-payload quarantine; quota self-heal + **CRC32-sealed save envelope with legacy migration** (save-seal tests) | — |
| Telemetry / experiments / anti-cheat | 5 | 4 | 5 | n/a | 5 | `telemetry`, `experiments/flags`, `anticheat` tests; crash capture + journal; **server aggregate sink live** (`POST /telemetry` + `/mp/v1/telemetry/summary`, 8 tests) | — |
| Portal builds (Poki/Crazy/generic) | 5 | 5 | 5 | 4 | 5 | `poki-pvp`, `portal-policy` e2e, `poki:preflight` gates, zip audits, compliance matrix in `POKI_COMPLIANCE_AUDIT.md` | portal live-multiplayer deferred by decision |
| **Resilience kernel (new)** | 5 | 5 | 5 | n/a | 5 | 98 tests; wired end-to-end; zero console changes (portal-safe) | journal export UI (support flow) |

No feature scored below 4 on any aspect. The two 4-R rows are deployment-gated (live WSS hostname, live social service), not code-gated — both are flagged as such in `PRODUCTION_READINESS_PLAN.md` rather than hidden.

## 3. Comparison to the genre bar

Versus **Tiny Wings** (the design predecessor): Sunbird matches the core one-button dive/glide loop and procedural-island feel, then exceeds it in determinism (bit-exact tested sim enables ghosts/replays), weather systems, mode count (8 vs 2), live-service pacing (daily/weekly/seasons), and accessibility toggles.
Versus **Alto's Odyssey**-class polish: art direction is stylized-3D vs hand-painted 2D — different medium; Sunbird leads on measurable performance gates (frame-ceiling CI) and honesty labeling (local/practice vs server-refereed), which Alto-class titles don't expose.
Versus the typical **Poki top-100 glider**: Sunbird ships portal-compliant builds with audited zip/SDK lifecycle gates, zero required backend, and offline-first — the common failure mode for portal games (network-dependent boot) is structurally absent.
Where the competition still leads: cloud save/account ecosystems (CrazyGames Data integration is built but portal-gated), and long-term live-ops dashboards (telemetry is aggregate-count only, by privacy design).

## 4. Known gaps register (honest)

1. ~~CRC sealing not yet on the live save envelope~~ **Closed**: saves are sealed end-to-end (write sealed, read sealed+legacy, quarantine on mismatch; 6 dedicated tests + full save/persistence suites green). Remaining slice: `exportCode` envelopes stay plain (by design — they are share codes, not storage).
2. ~~Rust server has no `/telemetry` route~~ **Closed differently**: the sink is the social server (`POST /telemetry`, `/mp/v1/telemetry`, `/social/telemetry` aliases + `GET /mp/v1/telemetry/summary`), and the client beacon now targets `VITE_SOCIAL_URL` exclusively. The dead Rust derivation was removed, so no beacon aims at a route that does not exist. (Rust got no route — cargo is unavailable in this workspace, and shipping uncompilable Rust would break CI; the social server is the tested, deployed sink.)
3. **Deployment gates remain**: WSS hostname for the Rust server, Upstash KV in production env, portal Inspector QA — all tracked in `PRODUCTION_READINESS_PLAN.md`, unchanged by this work.
4. **Bundle**: `Game` chunk 572 kB (177 kB gzip) — pre-existing; Three.js dominates. The kernel adds ~6 kB pre-gzip across lazy chunks. `verify:prod` budgets: JS total 1.49 MB / 2.50 MB — **PRODUCTION READY** per the gate. The kernel initially leaked two literals past the portal gates (`sunbird.receipts` marker via the hardcoded protected-key list; `https://localhost` via the breaker-key fallback) — both fixed (`BASE_PROTECTED_KEYS` + caller-owned protection; `about:blank` base), full `build:portals` → portal gate → zip audit → Poki rules → `verify:prod` chain green.
5. **Ranked-season replay validation** (server re-simulating input traces) remains deferred per the production plan — the movement envelope + HMAC + rate limits are the current anti-abuse stack.

## 5. Release-gate scorecard (user framework → repo state)

| Gate (ISO 25010 / OWASP / WCAG / CWV framing) | State | Evidence |
|---|---|---|
| Critical acceptance tests pass | ✅ 1290/1290 unit, e2e suites green in CI | `.github/workflows/ci.yml`, `pvp-live` job |
| 0 critical/high security findings; secrets out of source | ✅ no secrets in repo; HMAC signing; CSP/HSTS/XFO headers | `vercel.json` L69–93, `LEGAL_SECURITY.md` |
| WCAG 2.2 AA | 🟡 strong baseline (keyboard, RTL, reduced-motion, colorblind, large-text, semantic controls) | `input-standards`, `i18n`, visual baselines |
| Performance budgets in CI | ✅ frame-ceiling jank gate (max < ceiling), boot-time trend | `e2e/perf.spec.ts` |
| Reliability: retries/timeouts/backups/rollback | ✅ client: kernel. server: health gates + graceful drain. deploy: Vercel rollback + runbooks | `DEPLOY.md`, kernel |
| Observability | ✅ telemetry bus + crash journal + stall detection + server `/metrics` | this change, `rust/.../metrics.rs` |
| Reproducible reversible delivery | ✅ content-hashed assets, portal zips audited, `verify` chain | `scripts/verify-*` |
