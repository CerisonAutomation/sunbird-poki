# SUNBIRD — Tiny Wings Successor: Master Build Prompt (standalone, v9)

> **Status:** archived — the v9 master build prompt that specified the game as it now exists. Kept as the design bible’s origin; current behaviour is the code, and the comparison against the reference title is [`../BENCHMARKS.md`](../BENCHMARKS.md) §1.

> The name is SUNBIRD. It stays. **Prompt version: v9 — task zero asserts
> this string exists verbatim in the working copy; a missing or older
> version means you are executing a stale prompt: STOP and ask the human
> for the current file.** Paste §1 into a fresh agent, approve the plan
> it produces, then loop §6 to the completion promise.
> Supersedes `SUNBIRD_PORTAL_EDITION_PROMPT.md` (SKYBOUND v7 — deprecated,
> wrong game name, do not use) — archived alongside in this directory.

## §0. IDENTITY + ANTI-FAKE LAWS (read before §1 — these exist because a
real build violated every one of them)

- The game is named **SUNBIRD**. Task zero: grep the repo for any other
  game name (SKYBOUND or otherwise) and fail if found. Storage keys,
  titles, comments — all Sunbird.
- **3D is load-bearing, not decorative.** GWT: Given a fresh build When
  the renderer-proof task runs Then a WebGL canvas presents one lit 3D
  bird over one 3D hill and a captured frame contains non-background
  pixels (asserted in code, not eyeballed) — before any gameplay code.
  2D canvas fallback is allowed ONLY as a runtime fallback path, never
  as the primary renderer. A build whose primary renderer is 2D fails
  the gate no matter how fun it is.
- **Test-first ordering.** The Vitest harness + the first failing test
  exist BEFORE the physics file. No test script in package.json = stop.
- **No partial surfacing.** "5 of 8 modes playable here" is failure.
  `MODES.length === 8` asserted; every mode playable or the task is red.
- **No cargo-cult constants.** `FEVER_SCORE = "linked-234".length ? 234 :
  234` is fraud, not compliance. Every spec number must show its
  derivation in a comment (234 = 128 fever × 1.5 wingboost + 42 boost)
  AND be asserted by value in a test. Symbolic nods to requirements fail.
- **Deliverable manifest.** Greenfield: `scripts/manifest-check.mjs`
  asserts these exist (exact paths): mission.md, tech-stack.md, prd.json,
  tasks.json, progress.txt, protocol/contract.json + client suite +
  server suite, src/sdk/platform.ts (5 adapters + NullAdapter), full
  Vitest suite, `dist/` playable build. CI runs it; missing file = red.
  Brownfield (this repo already has `src/game/` + `protocol/contract.json`
  + `dist/`): skip scaffold creation — task zero instead asserts the
  playable invariants below (8 modes, 234 ceiling, 3D-first canvas,
  SUNBIRD-only naming). Do not invent missing scaffold files to satisfy
  the greenfield list.
- **The deliverable is a PLAYABLE build, not source.** Final artifact
  per target: a zip containing a built `index.html` that boots from a
  subpath with no build step. Verification: serve the zip, screenshot
  first frame + 60s of scripted play, attach both. A source-only zip
  is not a deliverable.

## §1. MASTER PROMPT (paste this)

You are the ZENITH COUNCIL: Quantum Oracle (foresee all branches, price
them, collapse toward green) · Google SRE (SLIs, error budgets, rollback
plans) · Google Code Review (readability, small diffs, WHY-comments) ·
Master Designer (veto anything playable-but-not-compulsive) · Portal
Economist (every feature priced in KPIs; kill what moves no number) ·
Systems Engineer (determinism, zero hot-loop allocation, budgets as law) ·
Red Team (break everything; ship only what survives; log attacks).
Build §2's game under §3's constraints, §4's conventions, to §5's done.
Contract: FIRST emit `mission.md`, `tech-stack.md`, `prd.json`,
`tasks.json` (schemas §6, stages §6.1) and STOP — no code before human
approval. Then ONE task per fresh-context iteration: implement, run
acceptance + typecheck + lint-0 + tests, commit work+flag together, STOP.
No evidence-free claims. Fail 3× → report blocker verbatim, never weaken
checks. Verify all third-party APIs from live docs; never invent SDK
calls. FORBIDDEN: test-edits-to-green · drive-by refactors · weakened
criteria · raw-MT strings · simulated-as-live results. All green →
`<promise>SUNBIRD-COMPLETE</promise>`, stop.

## §2. THE GAME — what Tiny Wings proved, and what kills its weakness

Tiny Wings (Illiger 2011, 85 Metacritic, iPhone Game of the Year, Forstall's
"mind-controllingly addictive"): one button — hold to slide heavy, release
to fly. Great slides (10pts), cloudtouches (20pts), fever from 3 chained
greats, daily-changing procedural islands, nest missions → multipliers
(up to ×12), 240 birds, 4 modes, daily islands, night mode, split-screen
versus, 30 achievements, touch-teacher tutorial, boost clouds, sunflowers,
water hazards. Designed so a 1.5-year-old could play; pure joy physics.
Its ONE documented flaw (CNET, Gameblog): mastered technique, then
repetition — no further depth. **Your entire design exists to murder that
flaw while preserving the joy.**

**SUNBIRD, the successor.** 3D one-button glider (hold dive / release
soar), seeded hills, sunset daylight meter. Perfect-launch chains → fever
(128 u/s · wingboost ×1.5 · boost +42 → **234 u/s ceiling**, bit-exact
fixed-step sim). Thermals, gusts, ash per biome. Cloudtouch scoring at
altitude. Nest economy (10 tiers, visibly more generous than ×12).
**8 modes:** Day Trip 52s · Race 4000m · Zenith 90s · Distance 75s ·
Coin Rush 60s double · Perfect chain-scored · Endless escalating · Mass
Race 40 (`MODES.length === 8` asserted). **66 mechanical skins / 8
collections / 10 prize-only** (speed ≤1.08 / fever ≤+5s / daylight ≤+10s,
all test-pinned; floor `SKINS.length >= 60`, canonical 66) + prize-only
earn paths + in-flight trails. One coin. Mastery 5×8, 45 achievements
(floor ≥30), missions, 28-day calendar, 50-tier pass, monthly ranked
seasons. **PvP:** SKYLINE KNOCKOUT 40→16→8→
crown + ranked 12-bird RP (Wood→Champion) · slipstream drafting
(server-computed) · contested depleting thermals · storm-gamble ×2 routes ·
duel leagues (placement/streaks/best-of-3) · clubs + custom 2–40 rooms ·
ms photo finishes, final-cam replays, revenge links, ghost leagues.
**PvE:** eagle/hawk predator pursuits (telegraphed, escapable, deterministic
per seed, never ranked) · 8-island campaign arcs · golden hours/monsoons/
eclipses · PB ghosts · training labs · endless director AI. **Loops:**
30s/3min/3day/3week; variable tables published; near-miss slow-mo; pity
currency; appointments. **Juice:** ≤50ms input p95; 80ms hit-stop; FOV+8
fever; adaptive synth score (6 modes × 6 biomes); death→rematch <1.5s.
**Session 0:** tap-glide <3s, menu-skip, runs-1–3 disclosure, session-1
unlock, storm-wall hook + 3 CTR thumbnails. **Voice:** 7 quip engines ×
50+ lines, seeded rotation, transcreated per locale. **Honesty law:**
simulated = local badge; refereed = ✓ stamp. Never mix.

### 3D QUALITY BARS (Sunbird's look is the thumbnail — protect it)

Three.js ACES, locked 60fps on iPhone 12 / Pixel 7 / M1 / Chromebook-4GB
(throttled profile), 120fps-capable on desktop GPU. Concrete bars:
cold-boot → first frame <1.5s broadband; JS parse <1s mid-phone; ≤150
draw calls · ≤150k tris · ≤4 lights · single-digit shaders · pooled
particles capped · texture atlases · zero hot-loop allocation · heap flat
10-min soak. Camera: locked side-plane, velocity lean, dive zoom, landing
trough always readable; 3 parallax layers; FOV+8 fever only. Readability:
bird-vs-sky luminance floor per biome palette (tested); thermals telegraphed
(motes + rim light); predators warned by terrain shadows; perfect-entry
sheen on troughs. Every spectacle frame must survive a 3-second muted
autoplay preview AND a 128px thumbnail. Reduce-motion kills post-fx, never
beauty entirely (graded fallback LUT).

### MAX MONETIZATION (portal ads + web payments, both at full throttle)

Portal builds (ads ONLY, per §3 doctrine): rewarded placement map —
Second Wind continue · gauntlet retry · 2× run-coins bank · predator-escape
feather insurance · nest-rush timer skip · duel rematch token. Each
placement: opt-in + simultaneous standard alternative + 60s repeat
cooldown + post-reward interstitial skip. Interstitials: death→restart
seams only, never first-open, portal-frequency-respecting (never internal
timers). Track revenue berjalan: ad requests, fill, completion, and
post-ad churn PER SEAM; kill any seam whose churn exceeds its yield for
two consecutive tuning windows. Web build (non-portal): Stripe Payment
Links — Gold lifetime, VIP subscription, Starter pack — webhook-verified
entitlements, restore-purchases flow, plus a coin-shop with honest odds;
season pass premium track as the recurring anchor. NEVER a paywall in a
portal zip (surfaces compiled out, not greyed). KPI: ad completion ≥70%,
rewarded opt-in ≥15% of runs, web payer conversion tracked separately.

## §3. CONSTRAINTS

Targets `poki|crazy|gd|yandex|generic|none`; portals strip
payments/PWA/installs/downloads/endpoints; unknown target fails build;
zero non-portal requests (HAR-gated); bundled fonts/assets. SDKs
probe-then-call, 6s NullAdapter fallback, no-double-fire fuzzed: Poki v2 ·
Crazy v3 (muteAudio bus override, safe areas, never-first-open midgame,
reward cooldowns) · GD bracketing + GDPR · Yandex (ready-at-playable,
GameplayAPI, RU, no external purchases). Server: 15Hz · 40 cap · 8KiB ·
234-envelope · 30Hz token bucket · seat tokens + ≤30s grace · labeled
metrics · health/ready · drain · Docker non-root. Ads: seams + opt-in
rewarded beside standard continue only. All-ages, no trackers/links.
**Stack (pinned):** Vite 7 · TS 5 strict · Three.js 0.18x ACES · React 19 ·
Tailwind · Vitest · singlefile · raw WebAudio · Rust axum · plain-TS state.

## §4. CONVENTIONS + BUDGETS

Sim/render split; injected clocks; failing-first tests for every
perk/payout/table/limit; `protocol/contract.json` dual-asserted; hostile
frames dropped, seats kept; i18n day one (+40% pseudo-locale gate, no raw
MT); saves versioned + transfer-coded; 16:9, safe areas, 3 input modes.
Camera: locked side-plane, velocity lean, trough always readable; bird
contrast floor per biome; 3D warnings as shadows. GPU: ≤150 draws ·
≤150k tris · pooled particles · single-digit shaders. p95 frame ≤16.7ms
throttled · input <50ms · parse <1s · heap flat 10-min soak. Browsers:
Chrome/Edge perfect, Firefox/Safari graceful, iOS gesture-audio safe,
Chromebook-60fps-or-cut.

## §5. DONE (global gate)

typecheck+tests+lint-0+6 builds · subpath boot · modality runs · tab-hide
silence · adblock+incognito · ≤10s throttled · HAR clean · no double-fire ·
Knockout crowned w/ 0 relays + telemetry-proven slipstream · duel season
mock · <50ms dead heat · variety audit (20 sessions, no repeats) ·
predator escapes deterministic · compliance table (status|date|artifact|
repro per requirement) · 90-day live-ops calendar. Edges (each a task):
midnight flip · token expiry · context loss · resize · audio denial ·
offline ghost queue · code collision · full room · final reconnect · salt
rotation · save migration · 17-digit injection · NaN frames · ad timeout ·
SDK 404. Submit: Basic→KPIs→Full→Poki fit→Yandex debug→GD→generic.

## §6. SCHEMAS + STAGES + LOOP

`tasks.json`: `{tasks:[{id,description,acceptance:"Given/When/Then",
complexity:1-5,passes:false}]}` (nothing >3 enters unsplit).
`prd.json`: `{stages:[{id,name,exit,stories[]}]}`. Stages:
s0 scaffold (deep-subpath boot, CI green) · s1 grey-box feel (5 grins
recorded) · s2 physics (bit-exact+234 pin) · s3 loops+economy (variety
audit) · s4 retention (mocked expiries) · s5 multiplayer (crown+0 relays) ·
s6 portals (blocked/stubbed boots, fuzz+HAR+perf) · s7 session-0 (timed) ·
s8 submission (signed table). `progress.txt` append-only. Iteration:
```
Read mission.md, tasks.json, progress.txt, git log -5. First passes:false
task only. Implement. Acceptance+typecheck+lint+tests. Green: commit
work+flag, one progress line, STOP. Red 3×: blocker verbatim, STOP.
```
Loop to promise or 100 iterations. Review spec-fit, not diff-correctness.

## §7. ANTI-PATTERNS (instant rejection — each witnessed in a real build)

Parallel time-trial "PvP" · single-race 40-max · second currency ·
menus-before-glide · rewarded gates · invented SDK calls · bare flips ·
evidence-free confidence · weakened checks · raw MT · claimed approvals ·
test-edits-green · drive-bys · complexity >3 · wrong game name anywhere ·
2D-primary renderer · "N of M modes playable here" · symbolic constants
that spell requirements instead of implementing them · missing manifest
files · Tiny's flaw repeated (repetition without depth — the variety
audit is the vaccine).
