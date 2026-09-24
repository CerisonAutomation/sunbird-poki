# Sunbird MVP-ready execution prompt (145/10)

> **Status:** archived — one-shot execution prompt for an earlier agent pass; it targets a path on the author’s laptop and reads like guidance while being an instruction. The live queue is [`../HANDOFF.md`](../HANDOFF.md).

Copy this prompt into the next implementation pass.

```text
You are the complete production team for Sunbird: principal game engineer, multiplayer backend engineer, security reviewer, HTML5 portal specialist, UX/UI lead, QA lead, and release engineer. Work in the existing /Users/cb/Downloads/sunbird repository. Preserve the React + Three.js + Vite stack and the supplied art direction. Do not rewrite the game in Unity or replace working systems without evidence.

MISSION
Make Sunbird a truthful, deployable MVP for standalone web/Vercel, Poki, CrazyGames, generic HTML5 portals, and a production Rust room server. “Ready” means a player can boot, understand the mode, play, persist progress, reconnect or recover from failure, and receive honest results. Never claim a backend, player, ad, purchase, or deployment is live without direct runtime proof.

PHASE 0 — TRUTH BASELINE
1. Read README.md, ROADMAP.md, DEPLOY.md, PORTAL_PUBLISHING.md, LEADERBOARD_API.md, rust/README.md, package scripts, and current git diff.
2. Run the existing typecheck, tests, builds, portal verification, Rust tests, and a browser smoke pass before editing.
3. Record the current commit, deployed URLs, environment variables, and every failed gate. Keep an explicit “wired / deployed / verified” table.

PHASE 1 — USER JOURNEYS
Verify with real clicks and refreshes: first boot; tutorial; every menu mode; pause/resume; death/restart; shop purchase/equip; coin reward; VIP extension; settings; share; daily/weekly seed; tournament claim; room create/join by code; room ready/unready; synchronized start; disconnect/reconnect; finish ordering; leaderboard submit/read; Stripe return/restore on web; rewarded ad success/cancel; tab hidden during play/ad. The pause Give Up/Exit Flight path must offer both Restart Flight and Return to Launch Pad. Restart Flight must create a clean run, reset transient state, preserve valid progression, and never strand the player or silently discard earned rewards. Test 320px portrait, 420px portrait, landscape mobile, 1280x720 desktop, keyboard, mouse, and touch. Fix the root cause of every broken journey.

PHASE 2 — STORAGE AND RULES
1. Browser storage is versioned, migration-safe, quota-safe, and clearly local/offline.
2. Production leaderboard requires Upstash Redis through KV_REST_API_URL and KV_REST_API_TOKEN. Add a health check and fail visibly as “local board” when storage is unavailable; never silently advertise a global board.
3. Score writes validate schema, payload size, mode/seed bounds, name length, rate limits, idempotency, and server timestamps. Keep HMAC as a casual-spoof deterrent and add replay validation from seed + input trace before ranked seasons.
4. Stripe entitlements are webhook-owned and restorable. Never grant real-money entitlements from a client-only success callback.
5. Portal builds have no external checkout or IAP. Coins and clearly disclosed optional rewarded ads are allowed only as in-game progression; do not gate core play behind an ad.
6. Ranked multiplayer normalizes cosmetic perks. Server owns room seed, ready gate, start countdown, finish order, and disconnect policy.

PHASE 3 — MULTIPLAYER
Ship the current Rust binary to a real host. Put it behind a DNS hostname with TLS/WSS, origin checks, connection limits, structured logs, health/version output, restart policy, and a rollback command. Verify that a room cannot start until all seated pilots are ready, that two real clients see one another, that late joins are handled honestly, and that a reconnect cannot duplicate a seat. Keep portal multiplayer disabled until the WSS endpoint and each host’s Full Launch review are complete.

PHASE 4 — PORTALS
Poki: use only Poki ads, fire loading/gameplay lifecycle events, pause and mute around ads, and keep rewarded benefits optional and explicit.
CrazyGames: use only the CrazyGames SDK, respect mute/settings, keep ad frequency natural, and if live multiplayer is advertised integrate room info, invite flow, round persistence, instant join, and the documented account/data APIs. Otherwise label the upload solo/local.
Generic: relative assets, no service worker, no payment, no speculative network requests, no downloads, and local fallback state.
Check initial payload size, mobile safe areas, fullscreen behavior, SDK failure fallback, and cross-origin iframe storage.

PHASE 5 — UX POLISH
Make the mode contract obvious before play: SOLO, LOCAL PRACTICE, LIVE ROOM, or RANKED. Add a short first-flight tutorial, visible ready/seat/region/room-code states, one-tap escape from every modal, readable touch targets, high contrast, reduced motion, and an honest post-run loop showing personal-best delta, coins, unlock progress, rematch, and share. The Give Up/Exit Flight confirmation must include a prominent Restart Flight action alongside Return to Launch Pad, with safe focus order, keyboard activation, touch activation, and a clear explanation of what is preserved. Keep the bird visible against gameplay on every viewport.

PHASE 6 — RELEASE GATES
All must pass on the final commit:
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

Directly verify production HTML, current hashed CSS and JS MIME types, API read/write persistence, storage health, WSS handshake, ready-gated start, and one browser journey from a clean profile. Save screenshots/logs or concise command output as evidence. Do not mark complete if any gate is skipped; report the exact blocker and next command.

DELIVERABLES
1. Code and migrations that fix the highest-severity gaps.
2. Updated README, deployment, portal, leaderboard, and roadmap docs that describe only verified behavior.
3. A short release report with wired/deployed/verified status, environment matrix, test results, known limitations, and rollback steps.
4. Deployment URLs and direct verification evidence. Never hide a stale VM, missing secret, disabled portal feature, or local fallback behind optimistic wording.

ONE-SHOT COMPLETION CONTRACT
Do not stop after analysis, a passing build, or a partial patch. Work through the full issue list in ../audits/PRODUCTION-GAP-ANALYSIS-2026-09.md, prioritize P0 then P1 then P2, and continue until every safe in-repository issue is fixed or has a documented external blocker. For every fix, add or update a regression test and verify the real user journey. Specifically prove Give Up -> Restart Flight, Give Up -> Return to Launch Pad, death -> restart, pause -> resume, refresh persistence, failed API fallback, multiplayer reconnect, and portal ad interruption. End with a concise release report containing only evidence-backed claims, exact remaining blockers, and the next externally required action. MVP complete is forbidden if Restart Flight is missing from Give Up/Exit Flight or if any required gate is skipped.
```

Research references used by this prompt:

- [Innersloth online flow](https://www.innersloth.com/a-match-made-in-update-16-0-0-emergency-meeting-40/)
- [Poki SDK overview](https://developers.poki.com/guide/sdk-overview), [Poki quality rules](https://developers.poki.com/guide/requirements-quality), and [Poki monetization](https://developers.poki.com/guide/how-monetization-works)
- [CrazyGames SDK](https://docs.crazygames.com/sdk/intro/), [technical requirements](https://docs.crazygames.com/requirements/technical/), [Full Launch requirements](https://docs.crazygames.com/requirements/intro/), and [ad rules](https://docs.crazygames.com/requirements/ads/)
```
