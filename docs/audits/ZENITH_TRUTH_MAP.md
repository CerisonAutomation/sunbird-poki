# ZENITH Phase Zero — Repository Truth Map

> **Status:** historical evidence — Phase Zero truth map, snapshot 2026-09-18 at commit `a9666a1`. Read for what was true then; [`ROADMAP.md`](../../ROADMAP.md) is the current real / written / fiction split.

**Snapshot date:** 2026-09-18  
**Repository:** `CerisonAutomation/sunbird`  
**Inspected commit baseline:** `a9666a1acb6d3d8002e2197682e7a30dd3bf2eb6`  
**Arena working branch:** `arena/01a0b229-sunbird` (the requested `feat/zenith-player-pull` branch cannot be used because this Arena session is branch-pinned)  
**Scope:** Static repository inspection plus the automated checks recorded in the final section. This document does not claim portal approval, real-device behavior, player preference, retention, revenue, or production service health.

## 1. Executive truth

Sunbird is a large, local-first Three.js arcade-flight game, not a small prototype. The browser client has a playable flight simulation, a first-flight coach, race finishes, AI fields, local and network ghosts, optional live multiplayer, portal adapters, persistence recovery, accessibility settings, adaptive rendering, extensive menus/economy/social surfaces, and broad automated coverage.

The central product risk is **concentration and feature breadth**, not missing systems:

- `src/game/Game.ts` is 6,430 lines and owns most orchestration.
- `src/game/HUD.ts` is 3,175 lines; `src/game/ui.css` is 5,007 lines.
- The save schema and HUD snapshot expose campaigns, currencies, shops, passes, trophies, cups, social, squads, events, prestige, wheel rewards, payments, multiple race formats, and other metagame systems.
- That breadth conflicts with ZENITH's desired immediate flight-first focus and creates a substantial comprehension/testing surface.
- Existing first-run, movement, finish, replay, ghost, AI-rival, and optional-network foundations should be simplified and strengthened before adding anything.

**Evidence label: VERIFIED_FROM_CODE**

## 2. Repository and toolchain

| Area | Repository truth | Evidence | Status |
|---|---|---|---|
| Package manager | pnpm 9.15.0; Node 22 (`.nvmrc`) | `package.json`, `pnpm-lock.yaml`, `.nvmrc` | VERIFIED_FROM_CODE |
| Browser stack | React 19.2.6, Three.js 0.186.x, TypeScript 5.9.x, Vite 7.3.x | `package.json` | VERIFIED_FROM_CODE |
| Styling | Tailwind Vite plugin plus substantial hand-written CSS | `vite.config.ts`, `src/index.css`, `src/game/ui.css` | VERIFIED_FROM_CODE |
| Test stack | Vitest/jsdom and Playwright | `vitest*.config.ts`, `playwright*.config.ts` | VERIFIED_FROM_CODE |
| Backend stacks | Vercel functions (`api/`), Cloudflare-style worker (`backend/`), TypeScript social service (`server/src/`), deprecated Node room reference, Rust authoritative room server | source tree, deployment files | VERIFIED_FROM_CODE |
| License | Repository root is MIT licensed | `LICENSE` | VERIFIED_FROM_CODE |
| Scale | 61,450 lines across inspected TS/TSX/Rust source roots; 88 client unit-test files, 18 browser specs, 4 TypeScript server test files | repository inventory commands | VERIFIED_FROM_CODE |

### Scripts

The script surface includes development, lint, client/server typechecks and tests, production builds, portal builds, Poki preflight, artifact browser tests, multiplayer smoke/load checks, deterministic physics checks, thumbnail generation, portal isolation, production verification, and upload-shape verification. The primary aggregate `verify` script is:

```text
pnpm typecheck && pnpm typecheck:server && pnpm test && pnpm test:server && pnpm build
```

Portal output is produced separately for Poki, CrazyGames, generic portals, and itch. Portal scripts intentionally blank multiplayer, leaderboard, Stripe, and social URLs. **VERIFIED_FROM_CODE**

## 3. Browser bootstrap and ownership map

```text
index.html
  -> src/main.tsx
  -> src/boot.ts / platform loading net
  -> src/App.tsx
  -> lazy import src/game/Game.ts
  -> Game creates Three.js world + Input + HUD + Audio + gameplay systems
```

- `App.tsx` lazy-loads the game and presents a recoverable boot error UI if construction fails.
- `Game` is the dominant runtime owner: scene/renderer, state machine, run lifecycle, platform lifecycle, saves, audio, telemetry, input, camera, terrain, race systems, ghost systems, rivals, quality adaptation, and HUD snapshots.
- `HUD` owns HTML overlays and delegated UI actions. Overlay navigation is separated into `OverlayNavigation.ts` for focus/dialog behavior.
- Runtime states are `menu | playing | paused | continue | ad | gameover`; menu sub-screens are represented by a broad `UiScreen` union.

**Evidence label: VERIFIED_FROM_CODE**

## 4. First-session and primary loop

### Existing path

- The title/menu presentation exists before gameplay.
- Starting a run calls `Game.startRun()` and resets the run/world systems.
- `FirstFlight.ts` is a three-step, signal-driven coach: hold to dive, release to launch, remain airborne for 2.5 seconds.
- The coach only runs when the persisted `firstFlightDone` flag is false.
- Flight feedback includes launch ratings, near misses, combos, speed normalization, altitude zones, particles, audio, camera behavior, and HUD cues.
- Race modes use a visible `FinishGate`; non-race play uses daylight/run termination rules.
- Results expose a primary “Fly Again”/“Race again” action. Solo replay preserves the course so the just-recorded ghost can act as an opponent.

### Product uncertainty

Code proves that these paths are implemented, not that a new player understands or enjoys them. There is no real-player evidence in the repository establishing time-to-first-input, time-to-first-satisfying-launch, first-objective completion, replay intent, or confusion caused by menu breadth.

| Claim | Status |
|---|---|
| A signal-driven first-flight tutorial exists | VERIFIED_FROM_CODE |
| A visible finish and results/retry path exist | VERIFIED_FROM_CODE |
| First-time players enter gameplay immediately enough | REQUIRES_REAL_PLAYER_DATA |
| Movement feels satisfying within seconds | REQUIRES_REAL_PLAYER_DATA |
| The early objective is understood and completed | REQUIRES_REAL_PLAYER_DATA |
| Players voluntarily replay | REQUIRES_REAL_PLAYER_DATA |

## 5. Flight, camera, terrain, and world

- `FlightPhysics.ts` contains deterministic movement/ground interaction calculations; `Bird.ts` and `Racer.ts` render/drive player and rival entities.
- `Input.ts` centralizes keyboard, pointer, touch, and double-tap/boost signals.
- `CameraRig.ts` implements camera follow and movement response.
- `TerrainSystem.ts` generates and streams terrain; `Biomes.ts`, `Weather.ts`, `Sky.ts`, and `LivingBackground.ts` layer environment presentation.
- `LaunchSystem.ts`, `FlightCues.ts`, `FlightGuidance.ts`, `HudFeedback.ts`, `ParticleFX.ts`, `Fx.ts`, and `Audio.ts` form the movement-feedback stack.
- Physics/performance tests exist, but benchmark timings are machine-dependent and are not real-device frame-rate evidence.

**Implementation existence: VERIFIED_FROM_CODE**  
**Subjective feel and real-device performance: REQUIRES_MANUAL_VALIDATION**

## 6. Competition without online opponents

- `MassRace.ts` provides a field of AI/local rivals and consumes a common `NetTransport` when live peers exist.
- `Racer.ts` and `pvp.ts` implement rival simulation/rating logic.
- Local ghost recording/replay is seed-based (`Ghost.ts`).
- Network ghost retrieval/publishing is optional (`GhostNet.ts`).
- UI language distinguishes a solo/local field from live online pilots in relevant code paths.
- `Replay.ts` preserves the course for “Fly Again,” enabling an immediate self-ghost rematch.

This is a strong existing seam for ZENITH: competitive pressure does not require a network. Whether the AI/ghost presentation actually feels competitive rather than synthetic remains unmeasured.

**Implementation existence: VERIFIED_FROM_CODE**  
**Player-perceived tension: REQUIRES_REAL_PLAYER_DATA**

## 7. Multiplayer and service independence

### Transports

- `Realtime.ts`: WebSocket client, fixed 15 Hz outbound state, interpolation buffer, stale-peer cleanup, capped reconnect backoff, public room listing, and offline/autonomous fallback.
- `PokiNetlib.ts`: Poki WebRTC/P2P transport conforming to the same gameplay-facing transport surface.
- `MassRace.ts`: shared race-field abstraction for local AI and remote snapshots.
- Rust server: authoritative room/finish implementation under `rust/crates/sunbird-server`.
- TypeScript `server/src/`: social, saves, rooms, friends, squads, leaderboards, moderation, tournaments, and realtime services.
- `server/sunbird-server.mjs`: retained Node protocol reference.

### Friction and fallback properties

- Production multiplayer is opt-in through configuration; portal scripts clear relay URLs.
- If a realtime connection is absent/fails, the client can continue with local AI/autonomous behavior.
- Login is not required for first play.
- Leaderboards and social services have local/offline presentation paths.
- Multiplayer menus and systems are extensive; this creates optional-feature complexity even though networking is not a first-run dependency.

### Security cautions found in current code/docs

- Client state must not be treated as authoritative security evidence.
- P2P host coordination is inherently less authoritative than the Rust service.
- Existing repository audits identify rate limiting/reconnect enforcement as areas requiring scrutiny; those statements must be revalidated against the current server before release.
- No live deployment, internet path, NAT traversal matrix, reconnect under adverse networks, or portal P2P sandbox was exercised in this phase.

**Optional/offline architecture: VERIFIED_FROM_CODE**  
**End-to-end multiplayer stability: REQUIRES_MANUAL_VALIDATION**  
**Production capacity/latency: BLOCKED (no production environment or real network test in this phase)**

## 8. Platform and portal integration

- `src/sdk/platform.ts` defines a strict adapter interface for lifecycle, ads, cloud data, identity, scores, account link, invites/rooms, measurement, sharing, and settings.
- Adapters exist for local/direct, Poki, and CrazyGames.
- Vite compile-time targeting substitutes non-target adapters with `_shim.ts`, reducing competitor SDK markers in portal artifacts.
- Portal builds are single-file, use relative paths, omit source maps, replace direct payment code, and package through `scripts/package-portal.mjs`.
- Poki lifecycle methods (`loadingFinished`, `signalGameReady`, `gameplayStart`, `gameplayStop`) and ad calls are represented in the adapter.
- A six-second SDK load timeout and loading-finish safety net are coded so SDK failure should not permanently block boot.
- Structural validators and a Playwright Poki-artifact config exist.

No repository script can establish portal acceptance. Compliance documents are internal evidence, not approval.

**Adapter/build safeguards: VERIFIED_FROM_CODE**  
**Portal sandbox behavior and acceptance: REQUIRES_MANUAL_VALIDATION**

## 9. Save data, migration, and failure recovery

- `SaveData.ts` defines a versioned, broad save model and merges older/partial state into defaults.
- It supports the current save key, a v1 migration source, corrupt-blob parking, export/import, and write-error observation.
- `Storage.ts` probes storage and selects `localStorage -> sessionStorage -> memory`; accessors and writes are guarded for sandbox/security/quota failures.
- Unit tests cover healthy load, first boot, malformed JSON recovery without deleting the bad blob, v1 migration, failed writes, export/import, hostile payload sanitation, blocked local storage, and fully unavailable storage.
- Cloud save is adapter-mediated and optional.

### Important exception

Not every auxiliary subsystem uses the safe facade. `src/game/Squad.ts` and parts of `src/sdk/auds.ts` access raw `localStorage` (usually inside try/catch); `RoomBrowser.ts` also exposes a raw-storage path. These do not appear to own the core flight save, but they should be audited before asserting that *all* blocked-storage flows are safe.

**Core save recovery design: VERIFIED_FROM_CODE**  
**Covered recovery behavior after tests run in this phase: see §15**  
**All auxiliary storage paths safe in every sandbox: REQUIRES_MANUAL_VALIDATION**

## 10. HUD, menus, overlay and input ownership

- `HUD.ts` renders the game HUD, title/menu hierarchy, pause, ad, continue, matchmaking, and results overlays.
- `OverlayNavigation.ts` manages active dialog semantics/focus behavior.
- `Input.ts` owns gameplay keyboard/pointer/touch input; HUD interactions are marked with `data-ui` and delegated so gameplay input can distinguish UI interaction.
- Pointer/touch affordances, split-screen/two-player controls, keyboard controls, and pause handling are represented.
- The results primary CTA is prominent and replays the same solo course.
- The menu/screen union is very broad: practice, shop, payments, settings, scores, pass, trophies, account, atlas, modes, board, cups, live, rank, challenges, campaign, squad, and more.

**Ownership and implemented controls: VERIFIED_FROM_CODE**  
**No input conflict across devices/browsers: REQUIRES_MANUAL_VALIDATION**  
**ZENITH concern:** menu breadth is direct evidence of a “feature museum” risk and should be evaluated against first-flight/replay priorities before new work. **VERIFIED_FROM_CODE**

## 11. Audio and accessibility

- `Audio.ts` and `Music.ts` synthesize/manage music and effects; audio activation is designed around browser gesture constraints.
- Settings include mute, separate music/SFX volume, haptics, reduced motion, color assist, large text, and quality.
- Decorative menu motion checks `prefers-reduced-motion`; runtime classes propagate accessibility settings.
- Dialog semantics, labels, focus navigation, button aria labels, and a hyperlegible bundled font are present.
- Tests inspect portions of ARIA, overlay navigation, audio graph/budget, and input UI.

No automated source test proves screen-reader usability, switch access, cognitive accessibility, contrast in rendered scenes, or mobile haptic behavior.

**Accessibility settings and semantic mechanisms: VERIFIED_FROM_CODE**  
**Assistive-technology and real-device usability: REQUIRES_MANUAL_VALIDATION**

## 12. Performance and quality system

- Device probing and tier selection live under `src/sdk/device-report.ts`.
- Player quality options are `auto | high | low`.
- `Game.ts` tracks frame timing, adjusts device pixel ratio with cooldown/floors, controls bloom, shadows, and particle budget, and emits quality-step telemetry.
- Geometry/material disposal exists in systems such as `FinishGate`; buffer update helpers and mass-race allocation/performance tests exist.
- Production Vite builds split Three.js, React, audio, network, and social chunks for direct web; portal builds inline output.
- Production verification and portal zip auditing scripts encode budgets/marker checks.

Benchmark and bundle scripts are useful regressions, but this phase does not establish FPS, input latency, memory stability, thermal behavior, or download/startup times on representative devices.

**Adaptive mechanisms: VERIFIED_FROM_CODE**  
**Measured device targets: REQUIRES_MANUAL_VALIDATION**

## 13. Analytics and evidence collection

- `Telemetry.ts`, `GameplayEvents.ts`, `Experiments.ts`, platform `measure()`, and device-report payloads provide instrumentation seams.
- Portal adapters send measurement only when supported; direct/local measurement can be a no-op.
- Code contains events for gameplay progression and quality changes.
- Repository tests validate event shape/behavior in places, not real ingestion.
- There is no repository evidence of a connected trustworthy dashboard, event delivery rate, consent review, session funnel values, replay rate, retention, or player cohorts.

The next product pass should define a minimal evidence schema around: boot shown, first playable, first input, first dive, first launch, first objective, run complete/fail, result shown, retry chosen, retry started, and optional multiplayer intent/outcome. Existing abstractions should be reused; no fake events or numbers should be generated.

**Instrumentation seams: VERIFIED_FROM_CODE**  
**Live analytics delivery and player metrics: REQUIRES_REAL_PLAYER_DATA**

## 14. CI, release, packaging, and supply chain

- GitHub Actions run lint, UI audit, typechecks, unit/server tests, direct build, portal builds/audits, artifact browser tests, multiplayer checks, bot simulations, and Rust fmt/clippy/test/build jobs.
- Lockfiles exist for pnpm, Rust, and the nested social package.
- GitHub actions are pinned to major tags (`@v4`), not immutable commit SHAs.
- npm dependencies use a mixture of exact and caret ranges; the frozen pnpm lockfile makes CI resolution reproducible when honored.
- Build IDs use `Date.now()`, so byte-for-byte output is not inherently reproducible unless verification normalizes/controls that field.
- Build outputs are excluded from this truth map and should not be committed.
- Dockerfiles and compose configuration exist for service deployment; deployment is outside this task.
- Portal scripts produce upload artifacts but do not upload them.

### Supply-chain/release findings

1. Review why Stripe and Upstash client package dependencies are in the root browser package and confirm tree-shaking/portal isolation from actual artifacts.
2. Consider immutable SHA pinning for Actions for stronger supply-chain guarantees.
3. Treat any dependency vulnerability report as unknown until `pnpm audit` (or an approved equivalent) is run and interpreted; it is not part of the aggregate `verify` script.
4. Never equate a successful structural portal audit with portal approval.

**Build/release controls present: VERIFIED_FROM_CODE**  
**Third-party vulnerability status: REQUIRES_MANUAL_VALIDATION**  
**Portal acceptance/release readiness: REQUIRES_MANUAL_VALIDATION**

## 15. Automated verification performed for this truth map

The following commands are the only fresh execution evidence for this document:

```text
pnpm typecheck
pnpm typecheck:server
pnpm test
pnpm test:server
pnpm build
```

Results are recorded after execution below. A passing build only proves compilation/bundling in this environment. Vitest/jsdom does not prove a browser flow. No E2E suite, portal sandbox, real device, production backend, deployment, upload, or player study is implied.

**Fresh result: VERIFIED_FROM_AUTOMATED_TEST**

- `pnpm typecheck`: passed with no TypeScript errors.
- `pnpm typecheck:server`: passed with no TypeScript errors.
- Client Vitest: **87 files passed, 1 file skipped; 1,127 tests passed, 8 tests skipped**. The skipped file is the separately configured live PvP suite. jsdom emitted expected canvas-not-implemented diagnostics in tests that do not install a native canvas implementation.
- TypeScript server Vitest: **4 files passed; 23 tests passed**.
- Vite production build: passed; 149 modules transformed.
- Build output included Vite's chunk-size warning: `Game` was 526.43 kB minified and the Three.js chunk was 565.93 kB minified (161.12 kB and 142.44 kB gzip respectively). These are build-machine artifact measurements, not network transfer or startup measurements on a player device.
- The aggregate command exited with status 0.

Additional fresh gates:

- **VERIFIED_FROM_AUTOMATED_TEST** — `pnpm lint` passed with zero warnings/errors under its configured `--max-warnings 0` policy.
- **VERIFIED_FROM_AUTOMATED_TEST** — `pnpm audit:ui` passed. It scanned 166 buttons and reported no unnamed controls, dead buttons, or null references; it also reported 17 non-failing maintainability/layout warnings (16 unused/dynamic-reference findings and 15 inline layout declarations summarized by the script).
- **VERIFIED_FROM_AUTOMATED_TEST** — all Poki, CrazyGames, and generic portal bundles built; portal isolation, zip audit, Poki upload-shape verification, thumbnail verification, and the non-interactive Poki compliance audit passed.
- **VERIFIED_FROM_AUTOMATED_TEST** — generated portal zip sizes were 837 KB (Poki), 828 KB (CrazyGames), and 826 KB (generic). Poki's single-file HTML was 1,752 KB. These are local generated-artifact sizes, not download timing or portal acceptance evidence.
- **REQUIRES_MANUAL_VALIDATION** — the Poki audit reported 99/113 rules verified, with 4 action items and 10 informational rules. A passing internal audit is not portal approval.
- **BLOCKED** — focused Playwright execution could not launch because the expected Chromium executable was absent. Installing Playwright Chromium retried five downloads and failed with `ECONNRESET` before TLS establishment. The resulting 42 launch failures are environment failures, not game-flow failures and not evidence that any browser scenario passed or failed.

Further fresh gates:

- **VERIFIED_FROM_AUTOMATED_TEST** — `pnpm verify:prod` exited successfully. Its configured lint, unit-test/coverage, deterministic-simulation, production-build, debug-artifact, coverage-floor, and JavaScript-budget gates passed. It measured 1.44 MB total JavaScript against its 2.50 MB limit and 0.57 MB largest JavaScript chunk against its 1.50 MB limit. This internal script's “production ready” banner is not treated as release, portal, browser, or operational proof.
- **VERIFIED_FROM_AUTOMATED_TEST** — `pnpm physcheck` passed and produced deterministic strategy outputs; this proves the scripted physics guard, not subjective movement quality.
- **VERIFIED_FROM_AUTOMATED_TEST** — `pnpm audit --audit-level moderate` reported no known vulnerabilities from the pnpm dependency graph at execution time. This is registry/advisory evidence only, not a complete supply-chain audit.
- **VERIFIED_FROM_AUTOMATED_TEST** — `pnpm pvp:check` passed against an ephemeral local TypeScript service: raw two-socket protocol smoke, 7 live `RealtimeClient` tests, 17 pilot-directory checks, and 13 public-room-list checks.
- **VERIFIED_FROM_AUTOMATED_TEST** — a seeded 40-client botsim against that same TypeScript service passed all configured gates over 15 seconds: 40/40 connected and visible, 8,899 state frames, 67.9 ms p95 broadcast interval, four unique finish places, 4/4 reconnects returning to the same room, and no protocol/socket errors. These are local synthetic measurements, not production capacity or player-network evidence. The run did not use the Rust service.
- **BLOCKED** — Rust formatting, Clippy, and tests could not start because `cargo` is not installed in this environment. No Rust gate is claimed.

Still not successfully run: Playwright/E2E, Rust checks, authoritative-Rust botsim, portal sandbox review, production-service checks, or real-device tests.

Environment exhaustion notes:

- **BLOCKED** — no system Chromium/Chrome executable was found under the standard command/path locations, so Playwright cannot be redirected to a preinstalled browser.
- **BLOCKED** — no `cargo` executable or populated user Cargo toolchain was found, so the Rust gates cannot be recovered locally without provisioning a toolchain.
- **VERIFIED_FROM_CODE** — GitHub authentication is available, but there are no workflow runs and no pull request for `arena/01a0b229-sunbird` at the time checked. Therefore no remote CI result can substitute for the blocked local browser/Rust checks.
- **REQUIRES_MANUAL_VALIDATION** — generated portal artifacts live in ignored output paths and are not retained as source changes. Their successful checks above describe the fresh execution that produced them; a release operator must rebuild and reverify rather than rely on workspace persistence.

## 16. Highest-priority ZENITH questions

| Priority | Question | Current evidence | Required next evidence |
|---:|---|---|---|
| P0 | How many interactions and seconds until a new player controls the bird? | Route exists; no timing evidence | Browser trace + real-player observation |
| P0 | Does the player understand “dive, release, soar” without reading a menu? | Signal coach exists | First-session usability sessions |
| P0 | Is the first meaningful objective visible and achievable early? | Coach and race/run objectives exist | Instrumented completion funnel + observation |
| P0 | Does “Fly Again” produce an immediate, credible improvement challenge? | Same-course replay and ghost exist | Browser validation + retry data |
| P1 | Does AI/ghost opposition feel competitive and honestly labeled? | AI/local/ghost systems exist | Player interviews and behavior data |
| P1 | Can every first run complete with network, cloud, board, ads, login, and payments unavailable? | Architecture is local-first | Automated offline browser journey |
| P1 | Are touch, keyboard, and pointer conflict-free on representative devices? | Unified input code/tests exist | Browser/device matrix |
| P1 | Does portal SDK failure leave a playable artifact? | timeout/fallback code exists | Artifact browser test with blocked SDK |
| P1 | Do malformed/blocked saves preserve play and recover safely? | implementation and unit tests exist | Browser tests in sandbox/storage-denied contexts |
| P2 | Which menu/metagame surfaces actively reduce first-run comprehension? | extensive surface verified | moderated player study and funnel data |

## 17. Recommended next action (no new feature)

Create an evidence-first baseline before gameplay changes:

1. Run the full aggregate verification and focused offline/save/first-flight tests.
2. Run a real browser first-session journey at desktop and mobile viewport with network services blocked.
3. Record objective timestamps/events without inventing player outcomes.
4. Audit the initial menu-to-flight interaction count and results-to-retry interaction count.
5. Make the smallest change that removes the largest observed first-session friction.
6. Re-run unit, browser, artifact, and portal structural checks.
7. Seek real-player data before claiming improved pull or replay intent.

**Recommendation basis: VERIFIED_FROM_CODE**  
**Which change will improve player behavior: REQUIRES_REAL_PLAYER_DATA**
