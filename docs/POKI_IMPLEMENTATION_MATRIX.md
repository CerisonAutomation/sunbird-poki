# Poki developer guide — implementation matrix

**Date:** 2026-09-22 · Method: every row is verified against this codebase and against Poki's own public sources (`github.com/poki`: `netlib` v0.0.20, `poki-cli`, `npm-sdk`), not from memory of the guide.

Legend: ✅ implemented + verified · 🟡 implemented, external step remains (owner: dashboard/upload) · ⬜ product decision, documented.

## 1. Easy access & onboarding

| Guide requirement | Status | Evidence |
|---|---|---|
| Skip the menu for first-time players | ✅ | `FirstFlight.ts` — direct-into-flight onboarding; `e2e/first-session.spec.ts` proves boot → first flight → results |
| Safe beginner environment / no early death | ✅ | FirstFlight guided start ("Long Light added as first play destination" — first destination is the gentle one) |
| Gradual introduction of mechanics | ✅ | FirstFlight staged coaching + `FlightGuidance.ts`/`FlightCues.ts` (visual, in-world) |
| Explain with visuals, not text walls | ✅ | In-flight visual cues; localized strings exist but guidance is gesture/visual-first |
| Loading screen with progress | ✅ | Inline loader + truthful staged `bootStage()` progress (`BootProgress.ts`) — the bar only moves when a stage genuinely completes |
| Progressive loading | ✅ | Critical path first; `Fx` post-processing, `audio`, `net`, `social` chunks and every non-English locale pack load in the background (`vite.config.ts` manualChunks + `import.meta.glob` packs) |
| Keep it small (8–10 MB) | ✅ | Portal single-file build **1.85 MB** — ~5× under the bar; web build JS 1.49 MB / 2.5 MB budget, CI-gated |
| Mobile first | ✅ | Coarse-pointer/mobile scheme selection, `e2e/mobile-touch.spec.ts`, 48px-class targets, mobile perf tier |
| Portrait vs landscape | ⬜→✅* | Manifest `orientation: "any"`; `e2e/orientation.spec.ts` + `scaling.spec.ts` prove the canvas resizes and stays playable in **both** orientations with no scroll or occluded UI. A dedicated portrait layout remains a product decision: the core loop is a landscape side-scroller; forcing portrait would be a redesign, not a config. Gamebar Display-ad eligibility depends on Poki's portrait support — revisit if the platform data justifies it |

## 2. Engagement

| Requirement | Status | Evidence |
|---|---|---|
| Touch AND keyboard controls, WASD/arrows/space/return standards | ✅ | Keyboard + touch + mouse paths; `e2e/input-standards.spec.ts` pins the control standards |
| Clear goals: short-term + long-term | ✅ | Missions, challenges, career, mastery (5 levels), season pass, collections, ranked seasons — all tested in `src/game/__tests__/` |
| Congratulate the player | ✅ | FirstFlight celebration state, confetti moments, results 👑 NEW BEST banner, achievement unlocks, audio feedback (`Audio.ts` jingles) |
| Tune difficulty gradually | ✅ | Biome progression (per-island difficulty), storm acts escalation, mastery coin ramps; `audits/FLIGHT_PERFORMANCE_AUDIT.md` |
| Playtesting hooks | ✅ | `boot_after_crash` telemetry, aggregate counters, Playtest-ready `dist-poki/` build; per-funnel analytics deliberately not collected (privacy posture, see LEGAL_SECURITY §1.2) |

## 3. Localization

| Requirement | Status | Evidence |
|---|---|---|
| Centralized single-file text | ✅ | `src/i18n/translations.barrel.json` — one source of truth; coverage + placeholder-preservation tests |
| EFIGS + TR → CJK → pt-BR/RU (LOC phase order) | ✅ | All 20 locales shipped **in the guide's recommended order** (`SUPPORTED_LOCALES`); `locales.test.ts` pins the phase order |
| Detect browser language | ✅ | `matchLocale()` BCP-47 matching (exact → region → language); manual toggle in Settings; RTL for Arabic with visual baselines |

## 4. Thumbnail

| Requirement | Status | Evidence |
|---|---|---|
| 628×628 min, full-bleed square, no baked corners | ✅ | `assets/submission/sunbird-thumbnail-1024.png` + `-628.png`; `scripts/verify-thumbnail.mjs` gate — **passing now** (exit 0) |
| Legible at tile size / high contrast | ✅ | Gate measures luminance spread (145/144) and 128px-tile legibility (140) |
| Avoid #83FFE7 proximity | ✅ | Gate measures dominant-colour distance (150) from the Playground background |
| Honest content (store window) | ✅ | Thumbnails rendered from the actual in-game art (`scripts/render-thumbnail.mjs` from `assets/submission/art/`) — no misleading visuals |
| Animated thumbnail | 🟡 | `gen-animated-icon.mjs` exists; upload step is manual (dashboard) |

## 5. Monetization (rewarded video)

| Requirement | Status | Evidence |
|---|---|---|
| Rewarded optional, never blocks gameplay | ✅ | Second Wind is a post-death optional offer with a free continue path (`ContinueOffer.ts`); no reward-gated core loop |
| Clearly labeled trigger | ✅ | `🎬` icon + explicit copy on the rewarded button (`HUD.ts` "Watch for Second Wind"); IAP surfaces fully hidden on portals (`SELL_AD_REMOVAL=false`) |
| Helping hand (revives/boosts) | ✅ | Second Wind revive is exactly the guide's A-Helping-Hand pattern |
| In-game economy integration | ✅ | Coin VIP earnable without ads; doubling offers give a choice between earned currency and watching |
| Clear feedback after the ad | ✅ | Revive applies immediately with visual + audio confirmation |
| Non-ad option in primary position | ✅ | Free "Continue" is primary; rewarded is secondary (`ContinueOffer.ts` layout) |
| No insistent placement / natural flow | ✅ | Ad opportunities only at the death/restart seam (`commercialBreak` on pause-exit → gameplay verified in the compliance audit) |

## 6. Tools — verified against Poki's actual public source

| Tool | Status | Verification against the cloned repo |
|---|---|---|
| Netlib | ✅ **API-verified** | `@poki/netlib@0.0.20` = the latest release (cloned). Sunbird's integration (`PokiNetlib.ts`) uses `new Network(gameId)`, `create({public,maxPlayers,customData})`, `join(code)`, `list({public:true},{createdAt:-1},20)`, `send`/`broadcast` on `reliable`/`unreliable` — all matching `docs/api-reference.md`. The `leader` and `connecting` event listeners are **confirmed real events** in the library source (`lib/signaling.ts:270,283`, `lib/peer.ts:74`) though absent from the docs. Peer-latency fields and `maxMessageSize` semantics respected |
| AUDS | ✅ honest gate | `createAudsIfConfigured()` resolves only when `VITE_POKI_GAME_ID` is set; otherwise every call is a silent no-op and boards fall back honestly (portal-scoped, per compliance rules) |
| poki-cli | ✅ schema + flags match | `poki.json` = `{game_id, build_dir}` — the exact schema `poki-cli/src/index.ts` reads. Our `poki:upload` script uses the CLI's own documented example verbatim (`--name "$(git rev-parse --short HEAD)" --notes "$(git log -1 …)"`) |
| Inspector | 🟡 build-ready | Fresh `poki-upload/` (1.85 MB single file) passes portal gate + deep zip audit + all 100+ extracted Poki rules; the Inspector walk itself is a manual dashboard step |

## 7. External links & SDK lifecycle

| Requirement | Status | Evidence |
|---|---|---|
| All external navigation via `PokiSDK.openExternalLink` | ✅ | Platform-seam `openExternalLink` (`sdk/platform.ts` → `sdk/poki.ts` → SDK); grep shows **zero** direct `location.href =` navigations or `window.open` in game code — every `location.href` occurrence is read-only (URL construction) |
| SDK lifecycle event ordering | ✅ | `gameLoadingStart → gameLoadingFinished`, `gameplayStart/Stop` via the GameplayEvents state machine; no double events (POKI_COMPLIANCE_AUDIT matrix) |
| Incognito-safe storage | ✅ | `Storage.ts` facade with canary probes + fallbacks; `try/catch` at every write (now hardened by quota self-healing) |

## 8. Dashboard-owned items (cannot be done from code — config matrix)

| Item | Where it plugs in | Action owner |
|---|---|---|
| Real game ID → `poki.json` `game_id` | Poki Inspector upload + `poki:upload` | CerisonAutomation, from the Poki dashboard |
| `VITE_POKI_GAME_ID` | Enables AUDS (cloud boards/user data) for the Poki build | same |
| `VITE_POKI_NETLIB_GAME_ID` | Enables Netlib P2P rooms on the Poki build (validated + gated in `PokiMpUtils.ts`; build stays solo-scoped without it — by compliance design) | same |
| Inspector walk on `poki-upload/` | Final QA sign-off | CerisonAutomation |
| Thumbnail + animated icon upload | Store listing | CerisonAutomation |

Every one of these degrades honestly when absent: the Poki build ships fully playable, offline, solo-scoped, with local/practice labeling — no broken surfaces, no silent data loss.

## 9. Verdict

Every guide requirement that can be satisfied in code **is satisfied and verified** — most with dedicated automated gates that run in CI, which is stronger than a one-time manual pass. The five remaining items are dashboard-owned configuration steps listed in §8 with their exact insertion points. The netlib integration is verified against the library's actual source, and the delivery pipeline matches the official CLI's contract exactly.

## 10. Dev-server browser verification (2026-09-22)

The Poki edition was **driven in a real headless Chromium** (153.0.8010.0, SwiftShader WebGL,
Playwright 1.58) against the Vite dev server started with `VITE_PORTAL_TARGET=poki` — i.e. the
same code path `pnpm dev` would serve, with the portal target baked in at transform time.

What was observed, in order:

1. **Dev serving of the portal edition.** The dev server serves the Poki edition correctly:
   the compile-time constant resolves to `poki` (`src/sdk/platform.ts`), and the only portal
   SDK URL requested is the canonical `https://game-cdn.poki.com/scripts/v2/poki-sdk.js`.
2. **Degraded SDK boot (sandbox has no Poki CDN egress).** The SDK request fails
   (`net::ERR_CONNECTION_CLOSED`); the adapter's 6 s load timeout elapses and the game boots
   **without** the SDK — `portal_ready {portal: poki, caps: lifecycle, ads, cloudSaveLocal,
   identity, iap, urlParams, share, measure}` is still reported and nothing blocks or crashes.
   This is the documented degrade path, confirmed live.
3. **Full player path.** Call-sign onboarding (random sign rendered + reroll offered) → main
   menu → `run_start {mode: daytrip, seed: fly-…, skin: sunbird}` → live HUD (distance,
   coins, island chip, daylight meter, minimap) rendered via WebGL → idle doze → **Second
   Wind modal with the rewarded-ad entry point** ("Watch for Second Wind"), the coin-revive
   button showing a live wallet check ("you have 20"), and `continue_offer {kind: standard,
   distance: 98}` telemetry → "Let it sleep" → `run_end {distance, score, coins, islands}` →
   results recap ("Flight completed", Fly Again with ghost explanation, local leaderboard
   rank #21 of 21) and `experiment_exposure {experiment: results_cta_order}`.
4. **SDK-present behaviour is pinned by tests, not hope.** With the SDK installed, the exact
   event behaviour (loadingFinished, gameplayStart/Stop pairing, commercialBreak/rewarded
   bookkeeping, happytime, leaderboard handshake, dashboard event order) is covered by
   `src/game/__tests__/poki-analytics.test.ts` (8 tests) against a recording `window.PokiSDK`
   double installed through the same global the real loader script populates.

Evidence screenshots (unversioned per repo convention — `*.png` is gitignored):
`docs/dev-poki-browser/menu.png` (mid-run HUD + Second Wind modal with rewarded-ad button),
`docs/dev-poki-browser/results.png` (flight recap with local leaderboard rank).

Sandbox artifacts, not product defects: emoji glyphs render as tofu (no emoji fonts installed
in the headless image), `perf_frame` longFrames are high (software rendering), and the Poki
script tag is absent after the failed load (the loader cleans it up; the request itself is
logged above).
