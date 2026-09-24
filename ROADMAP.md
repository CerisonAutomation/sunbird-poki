# Sunbird — Honest Roadmap

What actually works today, what is written but not deployed, and what is fiction
until proven otherwise. This file exists so the commit log can't overclaim.

## ✅ Real and shipped (playable right now)
- Dive-and-glide physics, 8 modes, fever, thermals/gusts/ash storms per biome
- 60+ skins with mechanical perks — **every perk string is implemented and
  test-enforced** (speed, daylight, fever, magnet, weatherproof, stealth)
- Per-mode mastery: 5 levels, coin ramp, level-5 signature skills wired into
  coin/lift/fever/daylight pipelines
- Prize skins gated on real achievements; season pass; campaign; daily/weekly
  challenges; weekly events with physics modifiers
- Local squads/duels/leaderboards (see next section for the caveat)
- Ranked seasons (monthly): peak tracking, coin payout, halfway soft-reset —
  now surfaced on the Rank screen with countdown + projected reward
- Stormfront Royale escalation: three storm phases at 1 km / 2.2 km (wind
  +25% each act, eye-wall pays coins ×2)
- Accessibility: reduce-motion, colorblind-assist, and large-text toggles in
  Settings, persisted and applied via `<html>` classes
- Telemetry: local `dataLayer` bus + anonymous aggregate counters beaconed to
  `/telemetry` on tab-hide (no PII, no retries, no-op without a backend)
- Server-refereed race placements carry a visible "✓ refereed" stamp on the
  results card — honesty is the trust brand

## 🟡 Written and tested, deployment verification still required
- `rust/` — `sunbird-server` (rooms, 15 Hz state, server-refereed finishes).
  **WIRED END-TO-END in dev**: `.env.example` + the Vite `/mp` proxy connect
  the client to the Rust `/ws` socket; two real sockets joining the same room
  and exchanging 15 Hz state is verified by test. The GCP VM rollout and a
  browser-safe WSS hostname still require direct production verification.
- `server/social/` — PGlite social layer (friends, squads, feed).
  **Verified live**: `pnpm pvp:check` boots the real server on a scratch port
  and runs the protocol smoke, the live two-client PvP suite and the
  pilot-directory contract against it (`scripts/pvp-check.mjs`); CI runs it on
  every push (`pvp-live` job).
- Without a configured URL there is **no fabricated fallback**: the squadron
  list, clubs and club chat start empty and the panel says the directory needs
  the online service. Pilot Lookup still works offline from real data — the
  pilots this device actually shared a room with (`src/game/pilots.ts`).

## ✅ Shipped in this round
- **Pilot Lookup** — a code lookup that resolves real pilots (name, presence,
  club, best distance, rank) through `GET /social/players/:code`, a real
  wingman request/accept flow (`/social/friends/requests|respond|cancel`), and
  a locally remembered "flew with" list. Unknown codes and offline builds are
  reported honestly; the invented wingmen, clubs and club chat
  (`DEFAULT_LOCAL_FRIENDS`, `DEFAULT_LOCAL_CLUBS`, `INITIAL_CLUB_CHAT`) are
  gone. See [docs/poki/REBUILD_REPORT.md](docs/poki/REBUILD_REPORT.md) §13.

## 🟡 Written and tested in CI, not yet exercised in production
- `protocol/contract.json` — the single machine-checked source of truth for the
  wire protocol. Asserted by **both** implementations:
  `src/game/__tests__/protocol-contract.test.ts` and
  `rust/crates/sunbird-protocol/tests/contract.rs`. This exists because the
  "Rust is the source of truth, TS mirrors it" comment had already gone false:
  `ServerMessage::Snapshot` shipped in Rust with no TypeScript counterpart, so
  the browser would have thrown on the first authoritative snapshot. The
  mirror is now fixed *and* pinned.
- `rust/crates/sunbird-server/src/validate.rs` — server-authoritative movement
  envelope. Client `state` frames are now checked for finiteness, world bounds,
  distance regression and a **time-aware** speed cap derived from the client's
  own physics ceiling (234 u/s = 128 fever × 1.5 wingboost + 42 boost), then
  canonicalised to wire precision. Rejections are dropped and counted as
  `sunbird_legacy_state_rejected_total{reason=…}`; the seat is never dropped.
- `rust/crates/sunbird-protocol/src/lib.rs` — `Limits` was the only type in the
  protocol missing `rename_all = "camelCase"`, so `GET /v1/hello` emitted
  `max_json_payload_bytes` and the browser client's parser threw. Fixed and
  pinned by `hello_limits_are_camel_case_on_the_wire`. Found by the contract
  suite, which is the only reason it was found.
- `scripts/botsim.mjs` — 40 headless pilots on the real wire protocol, seeded
  and reproducible. Gated in `.github/workflows/botsim.yml`: the Node reference
  job reports cheat containment, the Rust job **gates** on it
  (`--require-anticheat`). Measured locally against the reference server:
  40/40 connected in 42 ms, roster 40/40, broadcast cadence p95 66.8 ms, 13
  unique finish places, 4/4 mid-race resumes.

## 🔴 Aspirational (do not claim in commit messages)
- Server-side matchmaking is still aspirational; rooms are in-memory.
- Anti-cheat is **partial, not finished**. Movement plausibility is enforced
  (above), but identity, rate limiting and score-submission trust are not.
  Measured in CI for the record: the same 40 bots produce **16,082 relayed
  cheats** against the unvalidated Node reference server and **0** against the
  Rust one. Canonicalisation also cut per-client bandwidth 34.5%
  (79.56 → 52.11 KB/s) at identical cadence.

## Next (in order)
1. Retire `scripts/mp-smoke.mjs` once this PR has been green a while — botsim
   supersedes it (40 clients vs 2, and it is actually wired into CI)
2. Add score rate limiting, idempotency, and deterministic replay validation
   before ranked seasons accept public submissions.

## ✅ Shipped this pass (viral Poki loop, existing modules)
- Clip-worthy ledger + viral score + recap CTA in `Moments.ts`
- Casual-only adaptive pack / daylight / magnet / ridge skim in `Engagement.ts` + `MassRace.ts` + `Game.ts` (identity on rated)
- Clip-camera overlay on `CameraRig.pulseClip`
- Compact `sb1:` challenge tokens (`Challenge.ts`) for hash-stripping messengers
- Named experiment catalog + `clipWorthy` / `oneMoreRun` / `adaptiveDifficulty` flags
- FirstFlight coach tightened to ~15 s of required input
- Isolation gate forbids a second Viral/ECS/R3F stack

See `docs/archive/ARCHITECTURE_REVIEW-tmultiworlds-2026-09.md` for the full comparison against the proposed
Bevy/Replicon rewrite, including what was rejected and why.

## ✅ Formerly "Next" — shipped in-repo (merged from both lines)
1. ~~Deploy `sunbird-server`~~ / ~~deploy `backend/`~~ — both server stacks are
   code-complete and CI-verified; production deploy needs a host + account keys
   (external). Rust `sunbird-server` owns multiplayer `/ws`; the Vercel
   `api/` functions own the daily leaderboard; the optional Cloudflare
   `backend/` Workers stack adds ghost replays, telemetry beacons, and
   server-authoritative Stripe entitlements (`/ghost`, `/telemetry`,
   `/entitlements`, `/stripe/webhook` — signature-verified, test-pinned).
2. ~~Real-player ghost replays on the daily seed (async PvP)~~ — SHIPPED:
   `GhostNet.ts` publishes your best daily flight (`POST /ghost`, thinned to
   ≤1500 samples, best-per-pilot-per-seed) and fetches a chaseable rival
   ghost near your PB (`GET /ghost`, never your own). Amber silhouette,
   pass-them bonus, silent no-op without a backend.
3. ~~First-run dive tutorial~~ — shipped earlier as FirstFlight coach.
4. ~~Coin sinks~~ — shipped: armed boosts, Nest upgrades (×10 tiers),
   trail shop, skin catalogue, gauntlet retries.
5. ~~Trail catalogue~~ — trails live in TRAILS with palette-parity test.

## External-only (needs accounts/keys, not code)
- Host deploys: WebSocket host for `rust/sunbird-server`
  (`VITE_MULTIPLAYER_URL=wss://…`), Vercel project for `api/` +
  `VITE_LEADERBOARD_URL`, optional Cloudflare deploy of `backend/` via wrangler.
- Stripe live payment links + webhook secret (`wrangler secret put STRIPE_WEBHOOK_SECRET`)
  — the webhook route itself is CODE-COMPLETE (`backend/src/entitlements.ts`,
  signature-verified, test-pinned; setup steps in DEPLOY.md §5)
- Portal submissions (zips build ready: poki / crazy / generic)
