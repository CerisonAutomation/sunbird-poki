# Comparative review — Sunbird vs multiplayer and mobile category standards

**Date:** 2026-09-22 · Scope: netcode, platform engineering, product loops · Method: measured evidence in this workspace + public industry reference points, stated as such.
**Companion:** [audits/RESILIENCE_AUDIT.md](audits/RESILIENCE_AUDIT.md) (reliability scorecard), [LEGAL_SECURITY.md](../LEGAL_SECURITY.md) (EU register), [audits/POKI_COMPLIANCE_AUDIT.md](audits/POKI_COMPLIANCE_AUDIT.md) (platform rules).

---

## 0. Evidence collected for this review (this session, this workspace)

| Check | Result |
|---|---|
| `pnpm pvp:check` — boots the real server; protocol smoke + two live `RealtimeClient`s + pilot-directory contract + public room list | **PASS** — server, wire protocol, two real clients, directory and room list agree; no identity fields leak into the public room list |
| `pnpm botsim:40` — 40 headless WebSocket pilots on the shipped frame vocabulary, one room, 12 s | **PASS 10/10 gates** — 40/40 seated in 111 ms; state frames flowing to every client (p50 223 received); broadcast tick p95 68 ms (target ≤300 ms); finish places unique; **4/4 dropped pilots re-seated with the same identity in the same room**; adversarial teleport/magnitude bots **contained by the server** (no impossible position relayed) |
| Live ops endpoints during the run | `/health` → `{"ok":true,"rooms":1,"pilots":40,"players":40}`; `/mp/v1/telemetry/summary` live; SIGTERM drained cleanly |
| Unit/protocol layer | 1,398 client tests + 38 server tests green, incl. bit-exact deterministic-sim, protocol contract pinned on both TS and Rust implementations |
| Browser e2e (Playwright) | **Not executable in this sandbox** — the Playwright browser CDN is unreachable from this workspace (TLS reset on download). CI runs the full matrix with `--with-deps` (`.github/workflows/ci.yml`, artifact pass included); the two projects (desktop 1280×800, Pixel 7) cover 25 spec files. This is an environment limitation, not a repo gap — stated plainly rather than skipped silently. |
| Rust server | Not compilable here (no cargo); its behavior is pinned indirectly by the protocol-contract suite and the TypeScript server mirror of the same contract |

---

## 1. Verdict summary

Scale: 1–5 where 3 = competent genre median, 4 = clearly above the published category bar, 5 = evidence of parity with the strongest titles in the class.

| Dimension | Score | One-line basis |
|---|---|---|
| Determinism & replay infrastructure | **5** | Bit-exact fixed-step sim, tested; ghosts/replays and *server-side re-simulation* are structurally possible — most web arcade games cannot do this at all |
| Netcode (casual real-time class) | **4** | 15 Hz state + client interpolation buffer, server-owned starts/finishes, seat tokens, resume verified live, envelope anti-cheat verified live; no latency-adaptive layer yet |
| Anti-cheat depth | **3.5** | Movement envelope + HMAC scores + rate limits + containment proven live; no full replay re-simulation in production (deferred by decision — the determinism makes it cheap to add later) |
| Delivery & footprint | **5** | 1.8 MB self-contained portal build (vs 30–150 MB typical for the category); zero required backend; full offline mode — structurally better than the mobile bar, not just equal |
| Device/platform engineering | **4.5** | Adaptive DPR + bloom budgeting, SwiftShader fallback, haptics, safe-area/orientation audits, 48px-class targets, visibility/ad-break suspend correctness |
| Reach & localization | **5** | 36 locales (the 34 the portal inspector offers + 2 legacy) × 103 barrel keys with 100% pack coverage, Arabic/Hebrew RTL with visual-baseline e2e, and an i18n debt ratchet on the strings still in English; portal matrix (Poki/Crazy/generic) fully gated |
| Retention/loop design | **3.5** | Daily/weekly/season/career breadth is real and tested; no server-side live-ops flags/events yet, no cross-device cloud save on web |
| Competitive integrity ceiling | **3** | Honest and well-protected for casual play; not yet at the ranked-esports bar (full server re-simulation) |
| Privacy/compliance | **4.5** | No PII by construction, EU register with roles/bases/rights mapping, portal builds make zero external calls |

Overall: **strong casual-multiplayer arcade, unusually well engineered for its class, with a clearly identified ceiling in ranked integrity and live-ops** — both are known, tracked, and cheap to close *because of* the deterministic core.

---

## 2. Netcode vs the reference class

Reference points (public knowledge of published architectures): **Rocket League** (server-authoritative physics with client prediction/reconciliation), **Brawl Stars** (client prediction + server validation, ~10 Hz-class updates), **Trackmania** (historically client-trusted timing with server checks), **Mario Kart Tour** (async ghosts + server-validated results), **GGPO-style rollback** (fighting games).

| Capability | Category best practice | Sunbird | Assessment |
|---|---|---|---|
| State model | Server authority or client-trusted + validation | **Client-trusted movement + server plausibility envelope** (derived from the sim's own physics ceiling: 234 u/s); server owns starts and finish order | Right trade for casual co-op racing; wrong ceiling for ranked esports (see §5 G1) |
| Remote smoothing | Snapshot interpolation / rollback | 2-sample interpolation buffer, rendered deliberately in the past, +1 keyframe dead-reckoning, buffer reset on gap (`Realtime.ts`) | Standard pattern, correctly implemented for 15 Hz |
| Local input latency | Prediction makes control instant | Control is local by construction (client sim) — best-case latency | Parity with best; no reconciliation needed because the server does not own positions |
| Resume / reconnect | Seat reclaim, session tokens | Seat tokens with expiry + one-socket-one-seat + reconnect tokens; **4/4 live resume**; tunnel-drop is free | Matches the mobile bar (interruption-tolerance is a mobile mandate) |
| Capacity | Sharded rooms, interest management | Single-process rooms; 40-pilot mass race verified; sweep cadence 15 s; rate-limited frames | Adequate to launch scale; no multi-region/sharding story yet (G6) |
| Matchmaking | Code/private rooms + public list vs skill/regional MM | Room codes, invite links, browserable public list with honest "racing, not joinable" state; **no skill/latency matchmaking** | Fine for friends-play; a gap vs global-title expectations (G5) |
| Fairness signaling | Referee/connection indicators | "✓ refereed" stamp on server-owned placements | Better than category norm; no connection-quality meter yet (G3) |
| Anti-cheat layers | Server sim > envelope > rate limits > signing | Four layers live + containment proven by adversarial bots; replay re-sim possible but not deployed | Casual-grade strong, ranked-grade incomplete (G1) |

**What the comparison actually shows:** Sunbird's architecture is the *correct* point on the cost/complexity curve for a cross-portal, offline-first arcade racer. What it deliberately does not have — server physics authority, rollback, SBMM — is what the esport-class titles spend whole teams on. The unique asset is the bit-exact deterministic sim: it makes the *strongest* anti-cheat (server re-simulation of input traces) an incremental feature instead of a rewrite.

## 3. Mobile & platform standards vs the global bar

Reference points: Google Play Core Vitals (user-perceived crash rate ≤ 1.09%, ANR ≤ 0.47% — public thresholds), Material 48dp / HIG 44pt touch targets, sub-100 ms touch-to-photon expectations, Poki/CrazyGames platform requirements (in-repo, pinned).

| Standard | Global bar | Sunbird | Assessment |
|---|---|---|---|
| Delivery size | Instant-play portals want small; stores tolerate 100 MB+ | **1.8 MB** single-file portal build; ~1.5 MB total JS for the web build (budgeted 2.5 MB, gated in CI) | Exceeds the bar by ~1–2 orders of magnitude |
| Cold start | < 3 s to interactive on mid devices | Inline loader, staged truthful progress (`bootStage`), software-GL fallback so **no-GPU devices still boot**; CI-trended boot time | Meets the bar; SwiftShader fallback is beyond the common practice |
| Frame stability | 60 fps target, no long jank | Frame-ceiling e2e gate (max frame < ceiling) + adaptive DPR stepping + bloom earn-in/shed logic + watchdog stall telemetry now measuring real devices | Meets the bar **with a regression gate**, which most titles lack |
| Touch | 48dp targets, low latency, interruptible | 48px-class audited (`mobile-touch` e2e), press-and-hold one-button core, haptic events on key moments | Meets the bar |
| Interruption handling | Calls/notifications/tab switches must not corrupt state | Visibility-aware pause/mute, ad-break suspend (watchdog + audio), server resume proven live | Meets the bar |
| Offline | Expected for casual arcade | Full offline play; honest "local/practice" labeling instead of fake online | Meets the bar; honesty labeling is above norm |
| Accessibility | WCAG-class | Reduce-motion, colorblind-assist, large-text (persisted, applied), keyboard paths, RTL, `input-standards` e2e | Above category norm |
| Localization | Top titles ship 10–20 locales | **36 locales** incl. Arabic + Hebrew RTL with layout baselines, generated from one barrel | Above the bar |
| Crash/health telemetry | Store vitals pipelines | Device-local redacted crash journal + `boot_after_crash` counts + aggregate server sink (no PII) | Works within the privacy posture; no store-integrated vitals yet (web-first product) |
| Battery/thermal | Throttle gracefully | Adaptive quality loop (DPR floor/ceiling, cooldowns), low-power GPU preference on mobile, shadows shed on lite tier | Meets the bar |

## 4. Product loops vs category leaders

Vs **Tiny Wings** (the design ancestor): the one-button glide loop is faithfully evolved (fever, thermals, storms, biome variety); Sunbird adds everything Tiny Wings never had — async rivals, 40-pilot races, seasons, mastery. Vs **Mario Kart Tour**: ghost-racing parity exists; MKT's global ranked + events pipeline is larger (G4/G5). Vs **Subway Surfers-class** runners: leaderboard + daily-seed structure matches; run-length and interruption design match. Vs **Brawl Stars-class**: social depth (clubs, squads, presence) is structurally present but intentionally shallower — portal policy forbids chat surfaces, and that is a compliance choice, not an oversight.

FTUE: first-session is e2e-tested (tutorial → first flight → first results), name generation pre-seeds identity, and the menu is playable before any network call. Monetization: Stripe on web only, coin-VIP on portals, no reward-gated core gameplay (Poki-required). Retention instrumentation: aggregate counters exist; **per-funnel metrics are intentionally not collected** under the no-PII posture — a product decision that trades growth-analytics depth for compliance simplicity, documented rather than hidden.

## 5. Gap register — ranked by impact, each with its concrete close-out

| # | Gap | Impact | Close-out (concrete) |
|---|---|---|---|
| G1 | **No production replay re-simulation** | Ranked seasons can be pushed within envelope bounds by a determined cheat | The sim is bit-exact: add `POST /v1/validate {seed, inputTrace}` to the server, re-run `Bird.step` server-side (WASM or TS), score only matching traces. Determinism makes this a bounded task, not a research project |
| G2 | **No latency-adaptive netcode layer** | Degraded feel on high-RTT players; no visible connection quality | Adaptive send-rate/jitter-buffer keyed on measured RTT; connection meter from existing `lastSeen` cadence |
| G3 | **No connection-quality display** | Players attribute lag to the game | Expose frame-drift stats already collected in `Realtime` as a HUD chip |
| G4 | **No server-driven live-ops** | Events/flags are client-side only; ops cannot tune without a release | Config endpoint on the social server (signed, cached, offline-tolerant), consumed by the existing `Flags`/`Experiments` layer |
| G5 | **No matchmaking/regions** | Friends-play only; global-title expectation unmet | Queue-based matchmake on the room service (seat-count + envelope ping), multi-region later — single-region first is honest for current scale |
| G6 | **Single-process scale ceiling** | One VM hosts all rooms | Room-service sharding with the existing `/v1/rooms` stats as the routing signal; not needed at launch scale |
| G7 | **No web cloud-save** | Cross-device continuity on web only via manual save code | Adopt the existing platform-adapter seam: a keyed blob endpoint on the social server (entitlements-gated), respecting the EU register |
| G8 | **Browser e2e not runnable in restricted sandboxes** | Local verification depends on CI | Self-contained: pin a Playwright browser mirror (`PLAYWRIGHT_DOWNLOAD_HOST`) or vendor the chromium build in artifact storage |

## 6. Bottom line

Against the best **multiplayer** arcade racers, Sunbird holds an above-median position with one structural advantage none of the reference titles have in this weight class: a provably deterministic simulation, which converts the hardest problems in the genre (replays, ghosts, ranked validation) into incremental engineering. Against **mobile platform standards**, it is at or above the bar on delivery size, boot, frame discipline, touch, interruption handling, offline, and accessibility — with regression gates where most products have only good intentions. The honest ceiling is competitive integrity (G1) and live-ops (G4/G5); both are tracked here with concrete, bounded close-outs, and neither blocks the casual/portal product that actually ships today.


---

## 7. Gameplay feel vs the class — critique pass (2026-09-22, this session)

Playing the loop against its reference class honestly:

| Feel dimension | Tiny Wings | Alto's Odyssey | Subway Surfers-class | Sunbird | Critique |
|---|---|---|---|---|---|
| Core tactile loop | The gold standard — hill physics as instrument | Momentum + grind flow | Swipe rhythm | Dive-and-glide with fever escalation | Sunbird's ceiling is high (thermals, storms, boost economy) but the *learned skill* is mostly timing hills; Tiny Wings' mastery of slope-chaining runs deeper |
| Score expression | Distance + landing perfection | Combo chains | Multipliers | Perfects, coins, altitude, fever uptime, refereed race places | Broad; good board density for competition |
| Sound as gameplay | Reactive but sparse | Adaptive ambience | Constant pop | **State-aware score: menu/play/fever/storm/sleep layers, 10 arcade bangers + 18 cinematic tracks, biome orchestration, beat drops** | Strongest in class by construction — the music *is* the pace meter |
| Humor/voice | Whimsical art only | Serene | None | Deadpan quip engine on every failure/launch/sleep event, surprise events, surrender/bop/splash/sleep/launch/fever pools | Distinct personality — nobody else in the class talks back |
| One-more-run hook | Great crash-restart flow | Instant restart | Instant restart | Restart seam + Second Wind + daily seed + `#rival=` links | On par; rival links are the virality carrier |

Critique acted on this pass:

1. **Music depth** — the arcade family grew from 6 to **10 original chiptune bangers** (Sugar Rush, Neon Tail, Turbo Finch, Moon Arcade), all schedule-verified against the same contract (64-step melodies, valid chords, arcade instrumentation, 150 BPM family tempo), shuffle-integrated, picker-listed, save-clamped. The shuffle-first experience now rotates 10 distinct hooks before touching the cinematic family.
2. **Comedy density** — every quip pool expanded (+10 lines each for splash/sleep/launch/fever, +5 each for thud/bop onomatopoeia). Failure states — the moment casual players actually notice writing — now rotate ~30 distinct lines each instead of ~20, and the rotation test guarantees no immediate repeats.
3. **Leaderboard contract proven live** — `pnpm board:check` boots the reference server and drives the real client class through the documented HTTP contract (submit → sorted board → rank/total → best-row-keeps). The virality carrier (`#rival=` challenge links → chase ghosts) now has its data path verified end to end.

What would move feel *further* (not acted on here — sized honestly): slope-chain scoring (rewarding multi-hill flow lines like Tiny Wings' landing chains), and a ghost-playback "photo finish" moment on razor-thin race wins. Both are Game.ts-scale changes deserving their own reviewable diff, not a rider on this pass.
