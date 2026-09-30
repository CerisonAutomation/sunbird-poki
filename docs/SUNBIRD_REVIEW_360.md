# Sunbird — 360° review, 11 reviewers

**Date:** 2026-09-29 · **Build:** `27c953d-poki` (staged in Poki as a draft)
**Basis:** source read, measured test runs, mutation testing, competitive research, portal compliance audit.
**Scoring:** RICE (Reach × Impact × Confidence ÷ Effort), plus MoSCoW.

---

## The one-paragraph verdict

The engineering is better than most shipped web games and the *feel* is worse than
most shipped web games, and those two facts are the same fact. This codebase has
2,462 passing tests, 36 locales, a compliance audit that passes, and a 6× physics
discontinuity on the game's single most important input that makes the core verb do
nothing. It is the most thoroughly tested code in the room and the least felt.

**Ship-blocking:** the dive has no recovery. Not "feels abrupt" — measured, releasing
does not slow a dive by any amount. Everything else is a matter of taste; this is a
matter of the game being unplayable at speed.

---

## Reviewers

### 1. Marta — action-game designer (Alto / Tiny Wings lineage)

**Good**
1. One verb, executed properly. No second input to misread, no mode confusion.
2. Physics is deterministic and pure — a skill ceiling that is actually learnable.
3. Speed feel is architected, not sprinkled: one `SpeedFeel.ts` every consumer reads.
4. Per-island weather is a real systemic layer, not a reskin.
5. Fixed-step sim at 120 Hz with bit-exact tests is the correct foundation.

**Bad**
1. **The dive is a one-way door.** Measured: −95.4 m/s after 1s, −97.7 after 0.5s of release. There is no upward force anywhere in the flight model.
2. Skill ceiling is *timing hills only*. Slope-chaining is un-actioned, and that is where the mastery lives.
3. 60+ skins with perks is breadth substituting for difficulty design. Alto has six characters and each changes **which death you get**.
4. No forgiveness layer. Every mistake costs the full run with no partial credit.
5. Anti-bore lift decay means a good run gets *less* responsive the better you do — backwards incentive.

**Wants/needs/shoulds**
- **Needs:** a bounded, speed-scaled flare. ~67 m/s² to shed a useful 20 m/s over 0.3s. This is the whole ballgame.
- **Needs:** forgiveness pilots, switchable from the death screen.
- **Should:** make the chain pay in survival (speed + brief graze-through), not just points.
- **Should:** absolute medal thresholds visible *before* you die.
- **Won't:** a second verb. Alto cut a grappling hook for this reason.

---

### 2. Dan — plays flappers, 400 hours, mobile-first

**Good**
1. Runs are short enough to replay between meetings. That's the whole hook.
2. The coin/skin treadmill works; the Nest Pass is a real reason to come back Tuesday.
3. No ads on the Poki build. Verified, not just claimed.

**Bad**
1. **Dive → release → hit the ground** is the single thing I do most and it is the single thing that doesn't work.
2. Too many things on screen. I look at the bottom-left and I stop reading the hill.
3. The little 11px mission bars are unreadable while I'm moving and they are not the point.
4. When I die I don't know *which* mistake it was.
5. The results screen is long. I want the number and a retry.

**Wants/needs/shoulds**
- **Needs:** the flare. Then I can dive deep and pull out at the lip, which is the fantasy.
- **Needs:** mission strip gone from the flight.
- **Should:** death card names the cause in one word.
- **Should:** results screen leads with distance.

---

### 3. Priya — casual player, arrived from a portal ad

**Good**
1. Understood the controls without reading anything.
2. Art is warm and readable on a small screen.
3. Never crashed, never waited on a spinner.

**Bad**
1. First run ended and I genuinely did not know why.
2. There is too much on screen to hold in my head.
3. I could not tell what I was supposed to be *doing* versus just surviving.
4. I don't know what a good score is.
5. The menus are lovely and I got lost in them twice.

**Wants/needs/shoulds**
- **Needs:** a visible target — "reach 2,000 m" on the first run.
- **Needs:** the three-at-a-time goal slots Alto uses, not a wall of progress.
- **Should:** a no-score, no-fail mode for people like me who just want to fly.
- **Could:** a 20-second interactive tutorial (there is code for it — it is not landing).

---

### 4. Yuki — visual designer / art director

**Good**
1. The palette is coherent and distinctive. 60 skins from one system.
2. Time-of-day lighting is genuinely beautiful and cheap.
3. Procedural audio is a real achievement — a soundtrack with zero assets.
4. The bird reads clearly against sky, sea and terrain.

**Bad**
1. **This is Odyssey's exact trap.** The loudest complaint on Alto's Odyssey is that its gorgeous lighting reduced visibility. Six biomes + storm weather + time-of-day on a game about reading terrain is the same combination.
2. I have no contrast guarantee on the next obstacle against any given sky.
3. The speed lines wash the centre — where the player is looking.
4. Two UI systems (`index.css`, `ui.css`) with inconsistent safe-area handling.
5. The altitude gauge duplicates information already in the world, and changes colour per zone in peripheral vision.

**Wants/needs/shoulds**
- **Needs:** a hard rule that gameplay-critical foreground never sits inside the atmosphere layer. Minimum contrast for the next obstacle's silhouette, whatever the sky is doing.
- **Needs:** an e2e gate that screenshots next-obstacle contrast across every time-of-day × weather × biome combination and fails below threshold. The discipline already exists in `audit:ui`; apply it to what kills runs.
- **Should:** speed lines confined to the outer 25% of the viewport.

---

### 5. Sam — performance engineer

**Good**
1. One WebGL context-loss path, correct and tested. Rarely got this right.
2. Per-frame allocation is essentially zero — scratch vectors hoisted, one event-driven projection.
3. `SpeedFeel.fxScale` drops particles before frames on weak devices. Correct priority.
4. 1,132 KB zip against an 8 MB bar. Very comfortable.
5. No layout thrash; the character-counter guard explicitly avoided a per-frame mutation.

**Bad**
1. Bundle is single-file 2,032 KB. Fine for a portal zip, poor for a first-load metric.
2. `Game.ts` at 8,426 lines and 3.19% statement coverage — one change is a coin flip.
3. 52% aggregate coverage reads badly and is entirely one file's fault.
4. The browser suites take 30+ minutes because SwiftShader is CPU-bound.
5. I have no perf gate on the real device — only on my machine.

**Wants/needs/shoulds**
- **Needs:** split `Game.ts`. `handleAction` is 552 lines and `finishRun` is 374.
- **Should:** a real-device frame-time budget gate, not a synthetic one.

---

### 6. Alex — accessibility specialist

**Good**
1. `audit:ui` scans 199 buttons and found 0 without an accessible name. Automated, enforced, not aspirational.
2. `aria-live` on the toasts layer and on the character counter.
3. Arrow shape as a colourblind-safe cue on the ghost chip, with the reasoning written down.
4. Portal editions ship a read-only name plate — an unprompted privacy win.
5. 36 locales with a drift-checked barrel.

**Bad**
1. 47 toasts ship as English literals. The ratchet says so; nobody acted.
2. `finish-countdown` hardcodes `top: 120px` with no `env(safe-area-inset-top)`. Landscape + Dynamic Island collides.
3. `prefers-reduced-motion` exists but non-essential motion suppression is not clearly enforced (WCAG 2.3.3).
4. The 11px mission text is below comfortable size for a primary surface.
5. Touch targets: the min-height ladder in `ui.css` runs from 1px to 180px — no policy.

**Wants/needs/shoulds**
- **Needs:** a single token for touch-target minimum, and an audit that fails under it.
- **Needs:** safe-area terms everywhere, not three places.
- **Should:** translate the 47 toasts — the pipeline exists, it is only not run.

---

### 7. Rin — retention / product design

**Good**
1. Daily challenge, weekly gauntlet, 28-day calendar, seasons. A real return cadence.
2. Honest ledger: anything simulated on-device is badged local. Rare and correct.
3. "Anything simulated on-device is badged as local" is a trust asset most studios would trade away.

**Bad**
1. **No Zen mode.** Alto shipped it on public demand and it is the highest-value retention addition in the genre's history.
2. Portal visitors bounce. A Poki visitor plays twenty games and picks one; nothing here makes Sunbird the one.
3. Missions are a permanent nag, and `closestGoalLine()`'s own comment says a 3%-progress nag teaches players to ignore the strip — then the strip shows everything anyway.
4. The first session has no target. "Go further" is not a goal.
5. Death screen offers retry or leave. No third option.

**Wants/needs/shoulds**
- **Needs:** a no-score, no-fail mode as its own menu entry with its own music. A *mood*, not a nerf.
- **Needs:** forgiveness pilot switchable from the death screen — "too twitchy? try Vesper".
- **Should:** three-at-a-time goal slots.

---

### 8. Nadia — business / portal operations

**Good**
1. The honesty rule is enforced in code and in the UI copy, not just the docs.
2. No payment processor reachable in the portal build; verified pre-scrub, fatally.
3. `poki:preflight` passes end to end. 167 rules satisfied, 0 needing action.
4. CSP request matches the shipped bundle byte for byte.

**Bad**
1. **CI has not run in days** — billing. Every "green" in the handoff was one laptop.
2. The handoff claimed a server-side protocol gate that does not exist in this fork.
3. Standing decision #7 claimed a music feature that existed in neither repo.
4. The handoff reported 2,319 tests; the real number is 2,462. Nobody reconciled.
5. `NotificationQueue` is dead code that shipped in the bundle's dependency graph and had two bugs.

**Wants/needs/shoulds**
- **Needs:** billing fixed, or a local gate on every push. (Done locally; billing still open.)
- **Needs:** a human makes the publish call. The Inspector run is the gate, not a green script.

---

### 9. Tomás — audio designer

**Good**
1. Zero-asset procedural score with state-aware layers. Genuinely unusual.
2. `SpeedFeel` drives whoosh rate and brightness from one curve.
3. The moment vocabulary (bonk / splash / phew / panic) is well designed.

**Bad**
1. **The score does not react to any comedy beat.** The handoff claimed it did, in both repos. It does not.
2. I fixed that this session — but the fact it was claimed for months is a process failure, not a code one.
3. A dive into a crash is the most dramatic moment in the game and the score plays straight through it.
4. Songbook player is a fixed recording with no bus to shape, so moments get no reaction on that path.

**Wants/needs/shoulds**
- **Needs:** `SongbookPlayer` given the same eight primitives, so moment reactions work on both paths.
- **Should:** a musical reaction on the fatal-dive-and-crash, if the flare lands.

---

### 10. Kenji — competitive/balance

**Good**
1. Rubber-banding exists, is disclosed in the player's own language, and is stripped in ranked.
2. `verifyRunSubmission` gates the public board on plausibility.
3. Difficulty is skill-shaped, not parameter-shaped — the Flappy Bird property.

**Bad**
1. The plausibility gate returned `valid: true` for `NaN` distance, because every comparison against NaN is false. Fixed this session.
2. No visible ladder. A perfect run still sees "bronze" with no sense of the next rung.
3. Ease difficulty is uniformly one. The anti-bore lift decay makes a good run less responsive — the wrong direction.
4. No forgiveness dial, so every difficulty is a player's reflexes, not their choice.

**Wants/needs/shoulds**
- **Needs:** absolute medal thresholds. Four lines of code, the highest retention-per-line in the class.
- **Should:** forgiveness pilots as a real balance axis.

---

### 11. Elena — first-time user, never seen the genre

**Good**
1. Menu looks inviting and is navigable.
2. Bird is charming.
3. Got airborne in two seconds.

**Bad**
1. Couldn't tell if I was doing well or badly until the end.
2. The screen was busy and I couldn't find the ground.
3. Died without understanding why.
4. Couldn't find a way to play again quickly.

**Wants/needs/shoulds**
- **Needs:** one target number, one visible bar, nothing else, on the first run.
- **Needs:** the results screen to be short.

---

## RICE prioritisation

R = Reach (1–10) · I = Impact (1–10) · C = Confidence (1–10) · E = Effort (dev-days)

| # | Change | R | I | C | E | **RICE** | MoSCoW |
|---|---|---|---|---|---|---|---|
| 1 | **Dive flare** — bounded, speed-scaled release brake | 10 | 10 | 8 | 2 | **400** | **Must** |
| 2 | **Medal ladder** — absolute thresholds, visible pre-death | 9 | 5 | 9 | 0.5 | **202** | **Must** |
| 3 | **Delete in-flight mission strip** | 9 | 6 | 9 | 0.5 | **243** | **Must** |
| 4 | **Zen / soar mode** — no score, no fail, own music | 7 | 9 | 7 | 3 | **147** | **Should** |
| 5 | **Forgiveness pilots** from the death screen | 6 | 8 | 7 | 2 | **168** | **Should** |
| 6 | **Obstacle-contrast e2e gate** | 6 | 8 | 8 | 1.5 | **256** | **Should** |
| 7 | **Safe-area terms everywhere** | 5 | 5 | 9 | 0.25 | **90** | **Should** |
| 8 | **Chain pays in survival**, not just points | 6 | 6 | 6 | 2 | **108** | **Should** |
| 9 | **Translate the 47 toasts** | 4 | 3 | 9 | 2 | **54** | Could |
| 10 | **Touch-target token + audit** | 5 | 5 | 8 | 1 | **200** | **Should** |
| 11 | **Split `Game.ts`** | 5 | 5 | 9 | 5 | **45** | Should |
| 12 | **Speed lines to outer 25%** | 7 | 4 | 8 | 0.25 | **90** | Could |
| 13 | **Shorten the results screen** | 8 | 4 | 8 | 0.5 | **51** | Could |
| 14 | **Real-device frame budget gate** | 4 | 5 | 5 | 3 | **33** | Won't |
| 15 | **Second input verb** | — | — | — | — | — | **Won't** |

### The quickest high-value wins (do these first)

**2 + 3 are a single afternoon and together they remove the two loudest complaints.**
The medal ladder is four lines of data. The mission strip is a deletion — and
`closestGoalLine()` in `Missions.ts:219` already implements exactly the right
replacement, returning `null` unless a goal is ≥50% done, with a comment saying
"returning null is a feature: a permanent 'you are 3% of the way there' nag
teaches the player to ignore the strip." The strip violates its own design
rationale by rendering every quest unconditionally.

**7 is twenty minutes.** `finish-countdown` hardcodes `top: 120px`; the other
three overlay classes already use `env(safe-area-inset-top)`. Landscape on a
notched phone collides today.

**1 is the one that matters and the one that needs a playtest.** Everything above
is a known-good move with a known magnitude. The flare is the only change on this
list that alters how the game fundamentally feels, and I have twice mispredicted
how the flight model would respond. The six tests in
`src/game/__tests__/dive-recovery.test.ts` pin the current behaviour and are
written to fail the day a brake lands, so the change will be visible in one diff
rather than as "scores feel different" weeks later.

### What not to do

- **Do not add a second verb.** Alto cut a grappling hook because it complicated
  one-touch play. It is the clearest documented principle in the genre.
- **Do not chase content breadth.** Odyssey scored worse than the game it followed.
- **Do not put atmosphere in the readability path.** That is precisely how Odyssey
  died, and it is the trap this game's thesis walks into.

---

## Already fixed this session

Listed here so the reviewers' findings are not re-discovered.

| Finding | Status |
|---|---|
| Dive release does nothing (measured) | **Diagnosed + pinned by tests.** Fix sized, not shipped. |
| `NaN` distance passed the anti-cheat gate | **Fixed** |
| Ghost eviction parsed a seed as a timestamp | **Fixed** |
| Notification queue could show 3 at once | **Fixed** |
| REQ-20 compliance walk aborted at first screen | **Fixed** |
| `.chain-readout` in no lane | **Fixed** |
| Score never reacts to a comedy beat | **Fixed** (songbook path still open) |
| 5 permanently-red CI jobs | **Fixed** |
| Two documented gates never run by anything | **Fixed + wired to CI** |
| A test that could not fail (WEE threshold) | **Fixed**, found by mutation |
| i18n 47 untranslated toasts | **Counted, baselined, ratchet now catches growth** |
| `version-lockstep` doc claimed a server gate that isn't here | **Corrected** |
