# Sunbird production gap analysis

> **Status:** superseded — production gap analysis of 2026-09-14 across web/Vercel, Poki, CrazyGames, generic portals, leaderboard storage and the Rust room server. The live gap register is [`PRODUCTION_READINESS_PLAN.md`](../../PRODUCTION_READINESS_PLAN.md); portal status is [`../poki/COMPLIANCE.md`](../poki/COMPLIANCE.md).

**Audit date:** 2026-09-14  
**Scope:** web/Vercel, Poki, CrazyGames, generic HTML5 portals, leaderboard storage, and the Rust room server.

## Verdict

Sunbird is a strong offline MVP and the three portal packages are technically buildable. It is not yet a production multiplayer product. The remaining work is mostly operational: make durable storage mandatory for production, put the room server behind a real TLS hostname, deploy the current Rust binary, and close the portal-specific account/room requirements before claiming live PvP.

| Area | Current state | Grade | Release meaning |
| --- | --- | --- | --- |
| Core flight and mobile controls | Deterministic client simulation, responsive camera/HUD, touch/keyboard/mouse paths | **A-** | Ready for focused QA on real phones |
| Solo/PvE content | Modes, seeded challenges, local progression and economy | **B+** | Shippable as an offline arcade game |
| Web deployment | Vercel build and hashed asset MIME fix are verified | **B+** | Ready after environment and browser smoke gates |
| Portal packaging | Relative, self-contained Poki/Crazy/generic zips; SDK lifecycle hooks | **B** | Uploadable, but each portal still needs manual review |
| Economy/monetization | Web Stripe; portal coin VIP and optional rewarded ads | **B-** | Economically coherent; portal policy review required |
| Leaderboard persistence | Upstash Redis adapter with local/in-memory fallback | **C+** | Preview-safe, production persistence is not enforced |
| Multiplayer protocol | Ready-gated Rust room flow, server-owned starts/finishes, smoke-tested locally and against old VM | **C+** | Code is close; current VM is stale and endpoint is plain `ws://` |
| Anti-cheat | Plausibility envelope and HMAC option | **C** | Casual abuse resistance only; no replay validation or rate limiting |
| Operations | Build/test scripts and deployment script exist | **C** | No health check, rollout proof, TLS runbook execution, or rollback evidence |

## P0 blockers before calling the game production-ready

1. **Deploy the current Rust server and prove the behavior.** The GCP VM previously answered with the old “start without ready” behavior. A live check must show two clients joining, both sending `ready`, and only then receiving `start`. Capture the binary version/commit, systemd status, and a two-client smoke result.
2. **Use WSS for every HTTPS build.** `ws://34.123.76.46:8080/ws` is a development probe, not a browser production endpoint. Point a hostname at the VM, terminate TLS with Caddy, restrict the origin, and set `VITE_MULTIPLAYER_URL=wss://...` in the web build. Keep portal builds solo until a portal-safe WSS endpoint is verified.
3. **Make production storage explicit.** `/api/board` and `/api/score` need `KV_REST_API_URL` and `KV_REST_API_TOKEN` (Upstash Redis) in the production environment. In-memory fallback must be preview-only and should surface a health failure rather than silently looking global.
4. **Add abuse controls.** Rate-limit score writes by device/IP, cap payload size, normalize names, and add an idempotency key. HMAC in a browser bundle is only a casual-spoof deterrent. Replay validation from `seed + input trace` is required for ranked seasons.
5. **Add operational health and rollback checks.** Provide a cheap health endpoint that reports storage connectivity and server build/version; add a deployment smoke script that checks status code, content type for current hashed assets, API read/write, and multiplayer readiness.

## Portal comparison and missing product work

### Poki

The current adapter covers loading, gameplay start/stop, commercial breaks at the death/restart seam, and explicit rewarded Second Wind. Poki's rules allow ads and rewarded ads, but do not allow in-app purchases or reward-gating core gameplay. Keep coin VIP as an earnable in-game progression path and never expose Stripe or a purchase prompt in the Poki build. The remaining gate is Inspector QA: mobile touch, audio during ads, no deceptive rewarded copy, and no ad before the first meaningful play session.

### CrazyGames

The current adapter covers SDK lifecycle, midgame/rewarded ads, mute propagation, and an optional banner slot. CrazyGames' full launch expectations additionally include a fast instant multiplayer flow, room information/invite handling, persistence across rounds, and account/data integration when those features are advertised. Sunbird currently has the client room UI and invite hash, but portal builds intentionally compile without a multiplayer URL and do not integrate Crazy account save data. Either ship the portal as a clearly solo build or complete the Full Launch integration before presenting live multiplayer.

### Generic portals

The generic zip is correctly conservative: no payment surface, no service worker, no external SDK dependency, relative assets, and local fallback state. It should remain the default for portals without a documented SDK. Yandex, GameDistribution, and similar hosts need their own adapters only when the portal review requires them; do not add speculative third-party requests.

### Web/Vercel

The web build can expose Stripe checkout and live leaderboard/multiplayer, but only when the corresponding environment variables are present. A production build with empty endpoints must label the experience local/practice and must not imply that a score is globally ranked.

## Storage and entitlement rules

| Data | Current owner | Production rule | Gap |
| --- | --- | --- | --- |
| Settings, inventory, runs | Browser localStorage | Safe offline fallback; version/migrate keys | Cross-device restore is absent |
| Global scores | Vercel Functions + Upstash Redis | Required in production; signed/rate-limited writes | No health gate, rate limit, or replay proof |
| Stripe entitlements | Stripe webhook worker | Server-authoritative grant keyed by device reference | Restore depends on worker deployment and secret setup |
| Portal progression | LocalStorage only | Coin VIP/rewarded ads; no real-money IAP | CrazyGames Data API/account integration absent |
| Room state | Rust process memory | Ephemeral room state is acceptable; server owns start/finish | No persistence/recovery, health endpoint, or TLS proof |

Rules to preserve:

- Ranked results use server time/finish order; never trust a client “win”.
- Ranked modes must normalize cosmetic perks so paid or unlocked cosmetics do not become pay-to-win.
- Portal ads are supplied only by the host SDK. A rewarded ad is optional and must grant a clearly stated, non-essential benefit.
- Device IDs are pseudonymous. Do not add PII, cookies, or account requirements to the generic build.
- A local board is labeled local. A live board is labeled live only after a successful API response.

## UX/product gaps worth fixing after P0

- Add a first-session tutorial that demonstrates hold/release, one safe restart, and the meaning of a perfect pass.
- Show a clear mode contract before launch: solo, local practice, live room, or ranked server-refereed.
- Give rooms a visible code, region, seat count, ready count, host marker, reconnect state, and a “leave room” escape hatch.
- Make ad/reward copy state the exact reward and never use a timer or hidden confirmation.
- Add a compact post-run loop: result, personal-best delta, coins earned, next unlock, rematch/share.
- Add reduced-motion and high-contrast options and test at 320px wide, landscape mobile, keyboard-only, and touch-only.
- Instrument only aggregate events needed for crashes, funnel drop-off, ad completion, and room failures; keep portal privacy rules intact.

## Release gates

The release candidate is ready only when all of these are evidenced in the same commit:

```text
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm build:portals
pnpm verify:portals
cargo fmt --check --manifest-path rust/Cargo.toml
cargo clippy --manifest-path rust/Cargo.toml --workspace -- -D warnings
cargo test --manifest-path rust/Cargo.toml --workspace
node scripts/mp-smoke.mjs wss://<production-host>/ws
```

Then perform a desktop and mobile browser pass, a fresh incognito pass, a refresh/persistence pass, and direct production checks for HTML, CSS/JS MIME types, `/api/board`, `/api/score`, and the WSS ready gate. Portal submission is a separate manual approval: Poki Inspector and CrazyGames Preview must show no console errors, correct SDK events, silent ads/background tabs, and working touch input.

## Research basis

The comparison follows the official portal guidance: Poki requires its own ad SDK and prohibits IAP; CrazyGames distinguishes Basic/Full Launch and expects room/account/data integration for advertised multiplayer; CrazyGames also caps initial download size and requires relative assets; Innersloth's current online flow makes create game, enter code, find game, region, capacity, and confirmation explicit. Sources are linked in the project prompt below.

## 2026-09-15 execution evidence

- `pnpm typecheck`, `pnpm test` (43 files, 752 tests), `pnpm lint`, `pnpm build`, `pnpm physcheck`, `pnpm verify:prod`, and `pnpm verify:portals` passed.
- Rust `cargo fmt --all --check`, clippy with `-D warnings`, and workspace tests passed from `rust/`.
- Real browser smoke on the local Vite server passed for branded cold load, menu expansion, Fly Now, flight HUD, pause/keep-flying, and mute/unmute; no console errors or warnings were captured.
- The legacy Rust room path now applies the tested motion envelope to inbound state frames, canonicalizes accepted values to wire precision, and records rejection reasons. This prevents invalid or implausibly fast client state from being rebroadcast.

Still unproven and therefore not release claims: deployed HTTPS/WSS, portal sandbox review, production storage configuration, load testing, and fresh mobile-device viewport testing.

## 2026-09-15 full skills pass

- Global ClawHub skills applied: game development, Three.js quality gates, multiplayer feature audit, accessible game development, QA, release management, UI/UX development, and design review.
- Fixed the 40-player harness default endpoint: it now targets the Rust room service at `ws://127.0.0.1:8080/ws` instead of an unrelated local service on port 8787.
- Fresh `--require-anticheat` run passed: 40/40 connected, roster 40/40, 9,539 state frames, 14 unique finishes, 4/4 reconnects, zero protocol errors, and zero cheat leaks.
- Added polite live announcements to flight hints and goal feedback for assistive technology without changing the visual HUD.
- Added and browser-verified `Pause -> Restart flight`; the action starts a clean run while preserving progression, alongside the existing `Exit flight -> launch pad` path.
