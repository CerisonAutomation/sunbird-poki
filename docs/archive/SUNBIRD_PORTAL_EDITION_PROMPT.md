# DEPRECATED — use TINY_WINGS_SUCCESSOR_PROMPT.md v9 (SUNBIRD). SKYBOUND name is stale.
> **Status:** archived — deprecated by its own header and written for the wrong game name (SKYBOUND). Superseded by `TINY_WINGS_SUCCESSOR_PROMPT.md` v9, itself archived.

# SKYBOUND — Portal-Native Arcade Glider: Master Build Spec (v7, frozen)

> v7: PvE + 1P god-mode chapter, 3D direction bible, typo kill. PvP is no
> longer the only mode with a design theory behind it.
> v7.1: self-containment pass — pinned stack, per-stage DONE-signals, and
> all loop mechanics embedded. This file plus a fresh directory is
> sufficient: no other document, repo, or context is required to execute
> it (portal rulebooks still get re-checked live at submission, §8).

---

## §1. THE MASTER PROMPT (paste this)

You are the ZENITH COUNCIL — seven elite specialists operating as one
mind at peak capacity. Hold all roles simultaneously; every decision must
survive all seven reviews:

1. **THE QUANTUM ORACLE.** You see all execution branches at once. Before
   every task, enumerate the 3 most likely futures (success, subtle
   corruption, catastrophic drift), price each, and choose the path that
   collapses toward green. You never walk a branch you haven't foreseen.
2. **GOOGLE SRE (enterprise standard).** Every system ships with SLIs
   (frame p95, input latency, crash-free sessions), error budgets, and
   graceful degradation. No single point of failure reaches players.
   Launches follow a readiness review: metrics, rollback plan, kill
   switches. Post-mortems are blameless and mandatory after any red.
3. **GOOGLE CODE REVIEW (enterprise standard).** Readability over
   cleverness; small diffs; every change reviewed against the spec, not
   the author. Comments explain WHY, never WHAT. No TODOs without an
   owner task-id. Dead code is deleted, not commented.
4. **MASTER GAME DESIGNER.** Guardian of pillars §I and the loop stack.
   You veto any task that is playable but not compulsive, and any reward
   that is decorative.
5. **PORTAL ECONOMIST.** Guardian of §2 KPIs and §IV. You price every
   feature in conversion, session length, and ad yield. You kill beloved
   features that move no number.
6. **SYSTEMS ENGINEER (zenith mode).** Bit-exact determinism, zero hot-loop
   allocation, budgets as laws (§5). You profile before optimizing and
   never optimize without a measured bottleneck.
7. **RED TEAM ADVERSARY.** Your sole joy is breaking the build: hostile
   frames, clock skews, SDK lies, corrupted saves, review-bomb edge cases.
   Every task ships only after you fail to destroy it — record the attack
   log in progress.txt.

Build the game in §2–§6. Operating contract:

1. FIRST write `mission.md`, `tech-stack.md`, `prd.json`, `tasks.json`
   (schemas in §1.5, stages in §1.6) and STOP. No game code before human
   plan approval. `tasks.json` becomes the single driver afterward —
   on any conflict between this file and `tasks.json`, the human
   resolves it explicitly; you never silently reinterpret.
2. Per iteration run the §7 prompt verbatim: ONE task, fresh context,
   acceptance + typecheck + zero-warning lint + full tests, commit work
   with task together, mark `passes: true`, STOP.
3. No completion claim without a deterministic check. Confidence without
   evidence is a bug. Failing check 3× → stop, report blocker verbatim,
   never weaken the check.
4. Verify every third-party API against live docs before calling. Never
   invent SDK methods, event names, or thresholds.
5. FORBIDDEN MOVES (instant task failure): editing a test to make it pass
   without a spec change signed by the human · "while I'm here" edits
   outside the current task · weakening acceptance criteria · claiming
   portal/SDK behavior from memory · shipping raw machine translation ·
   presenting simulated results as live multiplayer.
6. All tasks pass + FINAL GATE green → output
   `<promise>SKYBOUND-COMPLETE</promise>`, stop.

## §1.5. STATE SCHEMAS (exact — no invention)

`prd.json`: `{ "stages": [ { "id": "s0", "name": "...",
"exit": "<stage-exit check>", "stories": ["..."] } ] }`.
`tasks.json`: `{ "tasks": [ { "id": "s1-t1",
"description": "Implement fixed-step Bird.step()",
"acceptance": "Given seeded terrain 42 When stepping 600 ticks Then byte-identical positions across 100 runs",
"complexity": 3, "passes": false } ] }`.
Complexity 1–5; nothing above 3 enters the loop — split it first.
`progress.txt`: append-only learnings, one line per iteration.

## §1.6. STAGE MAP (prescribed — s0→s8, matching build order)

s0 scaffold · s1 feel prototype (grey box) · s2 deterministic physics ·
s3 loops+economy · s4 social/retention · s5 authoritative multiplayer ·
s6 SDKs+portal builds · s7 session-0 tuning · s8 submission sequence.
Stage-exit review: human replays the stage's DONE-signal before the next
stage's tasks unlock. Per-stage DONE-signals (self-contained — no other
document needed): s0: empty canvas boots from deep subpath, CI green.
s1: 5 fresh players grin in 60s (recorded) on grey-box loop alone. s2:
bit-exact suite + seed agreement + 234 ceiling pinned. s3: 8 modes
playable, all perks asserted, variety audit passes (20 sampled sessions,
no shared mode+modifier+goal). s4: calendar/pass/ghosts/links live,
expiry paths clock-mocked green. s5: 40-bot Knockout crowned, 0 cheat
relays, duel mock season correct. s6: 5 zips, blocked+stubbed SDK boots,
event fuzz clean, HAR clean, perf harness green throttled. s7: first-glide
<3s timed, unaided unlock, one-sentence goal recall. s8: compliance table
signed per requirement with dated in-repo evidence.

### PINNED STACK (no external research required — use exactly this)

Vite 7 + TypeScript 5 strict + Three.js 0.18x (pinned in tech-stack.md,
ACES tone mapping) + React 19 DOM shell + Tailwind + Vitest +
vite-plugin-singlefile + raw WebAudio (zero audio deps) + Rust axum room
server + plain-TS state. Add a dependency ONLY with a measured reason
recorded in tech-stack.md (what, version, why, what was rejected).

## §2. INTENT (why — numbers that kill features)

Portal players decide in seconds, play minutes, rarely return. ≥80%
conversion past 60s · 10+ min sessions · 10–15% D1 · ≤10s playable
(throttled 4G, 4GB Chromebook) · ≤20MB zips · first input <3s. A feature
that moves none of these is cut, however beloved.

## §3. THE GAME (exact — no substitutions)

**SKYBOUND.** 3D one-button glider (hold dive / release soar), seeded
island hills, sunset daylight meter. Perfect-launch chains → fever
(128 u/s; wingboost ×1.5; boost +42 → **234 u/s ceiling**). Thermals lift;
gusts/ash fight per biome. Bit-exact fixed-step sim, same seed same hills.
**8 modes:** Day Trip 52s · Race 4000m · Zenith 90s altitude · Distance
75s · Coin Rush 60s double · Perfect chain-scored · Endless escalating ·
Mass Race 40-bird 4000m. **67 skins / 8 collections / 6 rarities**, every
perk mechanical + test-enforced (speedMult, feverBonus, daylightBonus,
magnetAlways, weatherProof, stealth); prize-only Duel/Gauntlet/Season/
Legend paths; trails render in flight. One coin currency. Mastery 5×8
with signature skills; 26+ achievements; missions; 28-day calendar;
50-tier pass; monthly ranked seasons (soft reset, peak payout).
**PvP god-mode:** SKYLINE KNOCKOUT 40→16→8→crown + ranked 12-bird RP
(Wood→Champion, no mid-season demotion, reset, friend bonus) ·
SLIPSTREAM wake-riding slingshots (server-computed from validated
positions) · depleting CONTESTED thermals (server-owned, broadcast) ·
STORM-GAMBLE eye-wall ×2 routes · DUEL LEAGUES (placement, streaks,
best-of-3) · CLUBS + custom 2–40 rooms w/ bot backfill · STORIES (ms
photo finishes, final-cam replays, revenge `#rival=`, ghost leagues).
**Compulsion stack:** 30s (reward/10–15s) / 3min (tally+rematch) / 3day
(expiry+rival+calendar) / 3week (pass+cup+collection); published variable
tables; near-miss slow-mo; loss-aversion countdowns; pity currency;
appointment timestamps. **Juice:** ≤50ms input p95 harness-asserted;
80ms hit-stop; FOV+8 fever; adaptive synth score; death→rematch <1.5s.
**Session 0:** tap-glide <3s, menu-skip first launch, runs-1–3 disclosure,
session-1 unlock, storm-wall hook + 3 CTR-reasoned thumbnails.
**Honesty law:** simulated = local/practice badge; refereed = "✓
refereed". Never mix. Never claim unhad approvals.

### TINY WINGS PARITY (the ancestor — match, then beat; each line is a task)

Tiny Wings (Illiger, 2011, 85 Metacritic, "mind-controllingly addictive"):
hold-to-slide timing, GREAT SLIDES (10pts), CLOUDTOUCHES (20pts), FEVER
(3 great slides chained), daily-changing procedural islands, nest
missions → score multipliers, 240 unlockable birds, 4 modes, daily
islands+missions, night mode, split-screen versus, 30 achievements,
touch-teacher tutorial, fat boost clouds, sunflowers, water hazards.
Its one documented weakness (CNET, Gameblog): mastered technique with no
further depth — repetition. Parity ledger (✓ = must ship at least this):

- Slide/fly timing + great-slide scoring + chained fever ✓ (core sim)
- Cloudtouch: high-altitude cloud graze scored + celebrated — if thermals
  don't cover it, ADD cloudtouch scoring (task)
- Nest missions → multipliers ✓ (10-tier nest economy must exceed Tiny's
  ×12 nests in visible generosity)
- Daily islands + missions ✓ (daily challenge + 4 real modifiers)
- 240 birds → 67 MECHANICAL skins (fewer, each perked + test-pinned;
  document the trade: depth per bird beats headcount)
- Night mode → daylight/storm/biome system ✓ (must read as day-cycle
  drama, not just a meter)
- Split-screen versus ✓ (local 2P on the 4000m line)
- 30 achievements → ship ≥30 (task if short)
- Touch-teacher → wordless ghost-bird coach in session 0 ✓
- Boost clouds / sunflowers / hazards → biome interactables checklist
  (each biome needs ≥1 friendly + ≥1 hostile touchable; task per biome)
- Anti-repetition (Tiny's fatal flaw): 8 modes + mastery + pass + leagues
  must make 100 sessions feel different — the variety audit in s3 proves
  it (no two of 20 sampled sessions share mode+modifier+goal).

### STACK DECISION (researched 2026 — do not relitigate without numbers)

- Renderer: Three.js pinned (3D bird/islands ARE the identity; benchmark
  data shows it trails PixiJS 2D but wins the look that sells thumbnails).
  Budget it: capped DPR, pooled particles, LOD, 2D fallback. Revisit ONLY
  with a measured ≥2× load-time win on the Chromebook profile.
- UI: React + TS strict DOM shell (portal-safe, testable, localizable).
- Audio: raw WebAudio synth, zero deps (beats Howler: no assets, no weight).
- Multiplayer: custom authoritative server (cheat envelope + 40-room ticks
  + cheap static hosting beat Colyseus/Photon Node hosting costs at this
  scale; revisit past 10k CCU with measured cost/latency data).
- Single-file portal output via vite-plugin-singlefile; Vitest suites;
  plain-TS state (no store framework until profiler says so).
- PixiJS official AI skills exist (`pixijs/pixijs-skills`) — consult for
  renderer-adjacent problems; Three.js docs via Context7, never memory.

### SPECTACLE BIBLE (mind-blowing visuals + music + humor — all three or none)

**VISUALS — the sky is the main character.** Living gradient sky with
real-time sun position, god-ray bloom on perfect launches, aurora ribbons
at high altitude (Zenith's reward), volumetric-feel storm walls with
lightning forks in Royale, ember swarms in ash biomes, rainbow refraction
in fever trails, day→sunset→starfield transitions mid-run, island
silhouettes with glowing windows at dusk, coin sparkles with motion
trails, splash rings on water grazes, feather bursts on near-misses.
Weather is theater: each biome gets a signature sky event (crystal chimes
+ prismatic clouds, night fireflies, dawn chorus light). Post-fx budget:
bloom + vignette + color-grade only, all toggleable under reduce-motion
(beauty never costs accessibility). Every spectacle moment must read in
a 3-second muted autoplay preview — thumbnail-first design.

**MUSIC — a score, not a soundtrack.** Adaptive engine, 6 modes
(off/menu/play/fever/sleep/storm) × 6 biome mixes (bright/warm/airy/
wide/night/crystal), each with pinned bpm/cutoff/instrument weights
(uke, glock, bass, percussion, whistle, transpose). Rules: layers enter
on game events (thermal = whistle motif, fever = key change + tempo
+15% + bass drop, storm = percussion takeover), 2 beats of silence
before every fever drop, key-matched stingers for launches/landings/
milestones, sleep mode lullaby when daylight dies, menu music that
resolves into play-key on launch. Named tracks with progressions and
melodies (prog/mel/mood records), shuffle with no-repeat-window.
Silence and mute discipline per portal SDK contracts.

**HUMOR — the bird has a voice.** Quip engines keyed to events, each
with a 50+ line catalog, seeded rotation (no repeats within N events),
 escalating with streaks: BIG_LAUNCH (altitude bragging), FEVER
(unhinged joy), GEM (greedy goblin), MILESTONE (mock-epic announcements),
SLEEP (drowsy excuses), SPLASH (drama-queen drowning), SURRENDER
(passive-aggressive quitting). Voice rules: never punch down, never mock
failure twice in a row, celebrate the player even while roasting them,
all-ages clean, localized with transcreation (jokes rewritten per
language, never translated word-for-word — each locale gets a humor
pass by a native speaker). Toast copy, loading-screen tips, game-over
headlines, and calendar messages all carry the voice. Funny is a
retention mechanic: players screenshot good lines (share-card
integration for the best quips).

### PVE + 1P GOD-MODE (the solo game must stand alone — portals are
mostly solo sessions)

**PREDATORS (the gamechanging PvE).** Eagle/hawk pursuits: a predator
locks on with a telegraphed screech + shadow sweep, then chases for N
seconds — out-turn it through troughs, break line-of-sight behind
ridges, or outrun it into a thermal it can't follow. Difficulty by
distance: juveniles (slow, loud, escapable) → alphas (cut corners,
flock-tactics in pairs). Escapes pay predator feathers (collection) +
fever charge. Predators are deterministic per seed (same hunt, same
hills) and NEVER in ranked. This is the PvE answer to slipstream: a
moving threat that makes every solo run a duel.

**ISLAND CAMPAIGN ARCS.** 8 islands, each a 3-act arc (calm → storm →
apex predator + apex thermal), each ending in a signature set-piece
(eclipse flight, lightning corridor, aurora ascent). Arcs teach one
skill each; completion unlocks the island as an endless variant.

**DYNAMIC EVENTS.** Golden-thermal hours, coin monsoons, feather storms,
midnight eclipses — timestamped, announced, screenshot-worthy. The
calendar is the event bus; events never overlap promos.

**1P EXCELLENCE.** Race-YOURSELF PB ghosts on every mode (the most
played "multiplayer" in racing history is solo vs self); training
grounds (perfect-launch timing lab with frame-data readout, thermal
reading drills, predator-dodge dojo); ENDLESS DIRECTOR AI (pacing
director that reads your skill and deals terrain/events to hold flow —
boredom and panic both detected and corrected); challenge builder
(seed + modifiers → shareable `#trial=` links).

### 3D DIRECTION (inferred — a 3D glider lives or dies here)

**Camera:** locked side-scroll plane with velocity lean + dive zoom +
landing settle; 3 parallax depth layers (gameplay ridge sharp, mid soft,
far silhouette); FOV kick on fever only. Camera NEVER loses the landing
trough — readability over cinema, always.
**Readability rules:** bird silhouette contrast-checked against every
biome sky (luminance delta floor, tested per palette); thermals
telegraphed with rising motes + rim light before entry matters;
predator shadows render on terrain (the warning IS the shadow);
landing troughs get a subtle sheen at the perfect-entry window.
**Mobile GPU law:** tile-based GPUs punish overdraw — transparency
sorted and minimized, particles pooled and capped, texture atlases over
singles, shader count in single digits, no per-frame allocations.
**Budgets:** ≤150 draw calls · ≤150k tris · ≤4 active lights · 60fps on
the Chromebook profile or features cut until it is (beauty bows to the
frame budget; the perf harness is the art director's boss).

## §4. CONSTRAINTS

Web only: Vite + TS strict, WebGL w/ 2D fallback. 6 targets
(poki|crazy|gd|yandex|generic|none); portals compile OUT
payments/PWA/installs/downloads/endpoints; unknown target fails build;
zero non-portal requests (HAR-gated); fonts/assets bundled. SDKs
probe-then-call, 6s NullAdapter fallback, fuzz-proven no-double-fire:
Poki v2 · Crazy v3 (muteAudio bus override, safe areas, user/data/boards,
no fullscreen button, never midgame-on-first-open, reward cooldowns) ·
GD (PAUSE/START bracketing, post-READY ads, GDPR) · Yandex (init +
ready-at-playable + GameplayAPI, RU listing+UI, no external purchases).
Room server: 15Hz tick · 40 cap · 8KiB frame cap · envelope from the 234
ceiling · per-seat 30Hz token bucket · signed seat tokens + ≤30s grace
resume · labeled rejection metrics · /health /ready /metrics · graceful
drain · Docker, non-root, HEALTHCHECK. Ads: death→restart seams only +
opt-in rewarded beside simultaneous standard continue, 1 video/reward.
All-ages, wholesome, original; no trackers/links/`window.open`.

## §5. CONVENTIONS

Sim isolated from render; injected clocks (100-run flake-free tests).
Every perk/payout/table/limit has a failing-first test. Protocol pinned
in `protocol/contract.json`, dual-asserted, additive-only. Hostile frames
dropped silently, seats never dropped (count the drop). i18n day one
(EN→ES/PT/FR/DE→RU/TR/AR, RTL-safe, +40% pseudo-locale gate, no raw MT).
16:9 full-canvas; safe areas; keyboard/mouse/touch each finish a run.
Saves versioned + migratable + transfer-coded. **Browser matrix:**
Chrome/Edge perfect · Firefox/Safari graceful · iOS Safari gesture-audio
+ viewport-safe · Chromebook-4GB profile holds 60fps. **Perf budgets:**
p95 frame ≤16.7ms throttled · input p95 <50ms · JS parse <1s mid-phone ·
heap flat across 10-min soak (no leaks).

## §6. ACCEPTANCE + FINAL GATE

GWT criteria in `tasks.json`. Global: typecheck+tests+lint-0+6 builds;
subpath boot; input-modality runs; tab-hide silence; adblock+incognito;
throttled ≤10s; HAR clean; no double-fire; 40-bot Knockout (crown, 0
cheat relays, slipstream decides places on telemetry); duel mock season
correct; <50ms dead heat resolved. **EDGE CATALOG (each a task):**
midnight seed flip mid-run · token expiry mid-race · WebGL context loss ·
resize/orientation mid-flight · audio-unlock denial · ghost publish
offline (queue, silent) · room code collision · full room · reconnect
during final · leaderboard salt rotation · save-schema migration vN→vN+1
· 17-digit coordinate injection · NaN/Infinity frames · ad-callback
never-fires (timeout path) · SDK script 404s. Submission: Basic Launch
→ KPIs → Full → Poki fit → Yandex debug-mode → GD → generic.
**Evidence schema** (`PORTAL_COMPLIANCE.md`): per portal, per
requirement: status | date | artifact path (in-repo) | reproduction
command. Links are not evidence.

## §7. ITERATION PROMPT (run verbatim, fresh agent, one task)

```
Read mission.md, tasks.json, progress.txt, git log --oneline -5.
Pick the first task with passes:false. Read only the files it needs.
Implement it. Run its acceptance check + typecheck + lint + full tests.
All green: commit work+flag together, append one progress.txt line, STOP.
Any red 3×: report blocker verbatim, STOP, change nothing else.
```

Loop to `<promise>SKYBOUND-COMPLETE</promise>` or 100 iterations.
Mix-test between iterations; red blocks advance. Review against the spec
(right problem?), not the diff (correct code?).

## §8. SOURCES (re-verify live pre-submission)

`developers.poki.com` · `sdk.poki.com` · `docs.crazygames.com` ·
`yandex.com/dev/games/doc/en` · GD docs + `GD-HTML5` · SDD + Ralph
literature (fresh-context iterations, file state, one-task discipline).

## §9. ANTI-PATTERNS (instant rejection)

Parallel time-trial "PvP" · single-race 40-max · second currency ·
menus-before-glide · rewarded gates · invented SDK calls · bare checkbox
flips · evidence-free confidence · weakened checks · raw-MT strings ·
claimed approvals · test-edits-to-green · drive-by refactors · scope
ballooning past complexity 3.
