# Progression feel — the systems were real, the player just could not see them

> **Status:** current evidence — research → diagnosis → implemented fix, 2026-09-24.
> Cited by `src/game/__tests__/flight-goal-strip.test.ts` and
> `src/game/__tests__/missions-live.test.ts`. The in-flight strip change carries one
> layout risk that cannot be closed in this environment; it is named in §5 rather
> than buried.

Date: 2026-09-24, tree `arena/01a0cba9-sunbird`.
Prompt: *"I DONT FEEL ENOUGH PROGRESSION WHEN I PLAY I DONT FEEL ACHIEVEMENT FEEL
GOALS … I FEEL THERE ACTUAL PROGRESSION ACTUAL REAL WINNING FEELING MAKE THIS A REAL
GAME RESEARCH HOW."*

## 1. What already existed — the problem is not missing systems

An inventory of the tree before this change, all of it real and mostly tested:

| Horizon | System | Where the player saw it |
| --- | --- | --- |
| this run | `SessionGoals` — 3 goals, skill-scaled by `FlowTuner`, **refilled the instant one completes** | one row in flight (the lead goal only) |
| this run | `goal-pop` — "Label ✓ +reward", 2.6 s | in flight |
| this run | `Moments` ledger, `ProgressBeats`, celebration strip | results card |
| today | `dailyQuests()` — 3 quests/day (4 for VIP), seeded, one per stat kind, coin rewards | **menu only** |
| today | calendar streak, daily flash bird | menu only |
| career | wings tiers + `wingsProximity()` | **in flight only when nearly complete** |
| career | rival rating/divisions, season, mastery, atlas islands, gauntlet, lifetime missions, prestige, nest level | menu only |

Nine ladders. The complaint is not that progression is absent — it is that almost
none of it is visible *while playing*, which is the only moment it can be felt.

## 2. What the research says, and the two numbers that settled it

- **Visible progress beats hidden progress.** "A progress bar, skill tree, map
  percentage, quest tracker, rank icon, or collection screen makes advancement
  visible. Without that feedback, the same underlying system can feel much
  weaker" — [Game Wisdom](https://game-wisdom.com/general/games-use-progression-systems-keep-players-motivated).
- **The genre's canonical "one more run" loop is three missions visible during the
  run.** Jetpack Joyride gives the player three active missions at all times, each
  worth 1–3 stars, and a fresh mission appears the moment one is completed; IGN
  singled out "the 'one more game' element of the three mission system"
  ([Wikipedia](https://en.wikipedia.org/wiki/Jetpack_Joyride)). Halfbrick's own
  postmortem framing: missions "create context around runs that would otherwise be
  pure score-chasing… micro-narratives within individual play sessions"
  ([Sam Lessin](https://wlessin.com/m/jet-pack-joyride)).
- **Goal gradient:** effort rises as the gap to a goal shrinks, and completion is
  never allowed to be terminal — the next bar appears immediately
  ([LogRocket](https://blog.logrocket.com/ux-design/goal-gradient-effect/),
  [Design Bootcamp](https://medium.com/design-bootcamp/goal-gradient-effect-and-the-psychology-of-progress-bars-df6fd889fd8e)).
- **Three horizons at once:** quick session rewards, mid-tier goals, long-term
  milestones, so every session feels productive
  ([Game of Nerds](https://thegameofnerds.com/2025-06-17/designing-progression-systems-that-keep-players-hooked/)).
- **Bars fail when advancement is arbitrary or updates too infrequently**, and the
  goal must always feel within reach
  ([31 Core Gamification Techniques](https://sa-liberty.medium.com/the-31-core-gamification-techniques-part-1-progress-achievement-mechanics-d81229732f07)).
- **Competence feedback (SDT):** seeing yourself progress *is* the reward, and
  "start small, end big"
  ([Eurogamer / Celia Hodent](https://www.eurogamer.net/my-obsession-with-progression-meters-and-the-art-of-shaping-the-player-experience)).
- **D7 retention is meta-progression or nothing:** hyper-casual benchmarks run
  20–30 % D1 and 5–10 % D7, and a high D1 with a low D7 means the mid-game lacks
  meta-progression ([Juego Studio](https://www.juegostudio.com/blog/how-to-increase-user-retention-and-increase-your-games-lifetime)).
- **Tiny Wings**, the reference this project already keeps: its islands are
  seeded per day rather than per run, so a course can be *learned* — the same
  hill layout every attempt
  ([GameDev.net](https://gamedev.net/forums/topic/632589-game-design-tiny-wings-jetpack-joyride/4989034/)).

## 3. The diagnosis, measured against source

1. **The HUD rendered one goal, not three.** `update()` picked the single closest
   `SessionGoal` and drew that. So a run where the lead goal was hopeless but
   another was 80 % done had nothing on screen to chase — two thirds of the
   genre's canonical loop, discarded at the render step.
2. **The strip was deleted on short viewports.** `src/index.css` carried
   `.flight-footer .goal-strip { display: none }` in **two** `max-height: 500px`
   queries. A phone in landscape is 360–430 px of CSS height, and a portal iframe
   is shorter still: **the only in-flight progress readout was hidden for most of
   a portal's audience.**
3. **The career ladder appeared only at the end.** `wingsProximity()` gates on
   `visible`, so the one number that only ever goes up was absent for almost the
   whole flight.
4. **Today's quests were never in flight at all** — computed from *finished* run
   stats, drawn in a menu.
5. **The results card listed everything and prioritised nothing:** three session
   goals, three daily quests, ten lifetime missions, side by side. Nine ladders
   with no hierarchy reads as no ladder.

## 4. What shipped

| Change | File | Guard |
| --- | --- | --- |
| Three live goals, **ranked closest-first**, each with its count and reward under the bar | `HUD.ts` | 10 render cases |
| The career rung rides along for the whole flight: `Fledgling → Sky Racer`, 42 %, "340 m to go"; dropped at the top rank rather than pinned full | `HUD.ts` | 3 cases |
| Short viewports **condense** to the lead row instead of hiding the strip | `index.css` (2 queries) | 1 CSS guard, negative-controlled |
| Versus races keep hiding it, by name and with a reason (place + gap already cover the flight), and the guard checks the readout that replaces it exists | test allowlist | 2 cases |
| Results card ends with **one next action**: near-miss framing ("12 short of Gold Rush · +120 coins — one more flight") or the nearest open goal, never a list | `HUD.ts`, `Game.ts` | 3 cases |
| **A career rung crossed mid-flight gets its own banner** — gold card, dark ink, `milestone()` sting, confetti at the bird, once per flight | `Career.ts` (`wingsCrossing`), `Game.ts`, `HUD.ts`, `ui.css` | 9 cases |
| **Today's quests complete mid-flight** — polled at 5 Hz against live counters, popping in the goal pill in the sky's ink with `+N on landing` (coins really are paid at landing) | `Missions.ts`, `Game.ts`, `HUD.ts` | 4 cases |
| Moments **queue** behind the single pill instead of overwriting each other, capped at three | `HudFeedback.ts` (`enqueuePop`) | covered above |
| The rank-up banner lives **outside** `lane("flight-messages")`, so the arbiter that hands one slot to the finish countdown cannot swallow it | `HUD.ts` markup | 1 structural case |
| **Progression is in the mix**: `runEnergy()` now takes `goalsDone`, so a run that is achieving but slow no longer sounds like a run achieving nothing. Weighted last and smallest — the clamp makes it lift quiet flights, not push loud ones louder | `MusicArc.ts`, `Game.ts` | 6 cases |
| The rank-up also gets one bounded **beat drop**, the same musical reaction the comedy moments get | `Game.ts` | by inspection |
| Shared jsdom HUD harness extracted rather than duplicated | `__tests__/hudHarness.ts` | — |
| Pure core: `missionRows()`, `newlyDone()`, `closestGoalLine()`, `nextActionLine()` — live rows from *partial* stats, a completion that fires exactly once, a gradient line that stays quiet when nothing is close | `Missions.ts` | 21 cases |
| Every daily quest gets a two-word title for a phone-sized strip | `Missions.ts` | covered above |

The quantization discipline is kept from the existing code: the strip rebuilds on a
5 % step or a row-set change and writes nothing on the frames between, which is
what the repo learned from name tags being rebuilt 60×/second.

`closestGoalLine()` returning `null` is deliberate. A permanent "you are 3 % of the
way there" nag is how a progress bar gets ignored — the research is explicit that
bars fail when advancement feels arbitrary or too slow to notice.

Deliberately **not** done: no tenth ladder, no new XP currency, no artificial
urgency timer — and **no tenth `MomentKind`**. The nine moments in `Moments.ts` are
the comedy/physics vocabulary: they feed `momentChips`/`headline` on the results
card, `momentNextAction()`'s CTA, and the `"first funny moment"` funnel stage whose
whole premise is that a first *laugh* predicts a second run. A career promotion is
neither a joke nor a physics event, so it gets the same bounded musical reaction
(`triggerBeatDrop`) without joining that ledger. The fix makes existing progression visible; it does not add another
system for the player to serve.

**Test count after this change: 134 files / 1,781 unit tests**, of which 35 cover
the strip and the moments, all negative-controlled (re-hiding the banner or making
the queue overwrite fails 3 of them).

## 5. The risk this environment cannot close

Four rows now sit in the flight footer where one used to sit, and a new banner
appears at 40 % of the viewport height (54 % on short viewports). The rule I deleted
existed for a reason — its neighbouring comment says a second transient pill "is
not worth covering the landing corridor on short embedded players" — and **I cannot
see whether the taller strip covers the bird on a 360×640 landscape phone.** The
mitigations are: the condense rules keep a single row under 500 px tall, the strip
is `pointer-events: none`, and it lives in the footer away from the header stats.
The verification is `e2e/layout.spec.ts`, `e2e/flight.spec.ts` and
`e2e/results-layout.spec.ts` in a real browser — the same 25 specs that have never
run here (`BRUTAL_REPO_AUDIT_2026-09-24.md` §2). **Run them before submitting.**

## 5b. "Can you beat this?" — marks as places, not totals (same day, later pass)

The numbers were all there: personal best, today's best, a rival's mark from a
shared link, the daily challenge target, the lead distance goal. Every one of them
was a **total** — read on a card, after the flight. A total tells you what
happened; a line in the world tells you what is *about to* happen, and flying past
a thing you could see is the only version that feels like winning.

- **`BeatLines.ts`** (pure): those numbers become at most three marks ahead of the
  bird (`BEAT_MAX_LINES`), ranked nearest-first, collapsed when two stand within
  `BEAT_MIN_GAP` (60 m) of each other — keeping the higher-priority one, where a
  rival's shared mark outranks your own best because it is the reason someone sent
  you a link. Marks already behind the bird are dropped; the crossing was the
  report. Labels and number formatting are injected, so the seam owns geometry and
  the caller owns vocabulary.
- **`BeatLine.ts`** (three.js): one pole, one flag, one additive beam — cheaper
  than `FinishGate`, whose material and lifecycle discipline it follows. The label
  texture is rebuilt only when the words change. A rival's flag carries the same
  amber tint as their ghost silhouette, so the flag and the bird you are chasing
  read as one opponent. The beam turns green the instant it is beaten.
- **Crossings** fire once per mark per run: a personal best gets the banner plus
  `triggerViralGlissando()` + `milestone()`; a rival's mark gets the flag turning
  green and confetti only, because `rivalBeatenToast` already says the words on the
  same threshold and a second celebration would compete with the first; the daily
  and goal marks pop in the pill queue with `+N on landing`, since that is when the
  coins are actually paid.
- **The countdown row** leads the goal strip, quantized to 25 m so a countdown
  cannot rebuild the strip 60x/second, and it exists only inside
  `BEAT_CUE_WINDOW` (400 m) — a mark 3 km away is scenery, and a permanent
  countdown trains the player to look past it. Leading the strip means a short
  viewport, which keeps only `:first-child`, shows the mark about to be flown past
  rather than a goal 40 % done.

### The overlap this forced, and the rule it produced

The banner floats outside the arbitrated message lane on purpose (section 4), and a
floating element positioned by a viewport percentage is an overlap waiting to
happen: 40 % of a 640 px portrait phone is clear of a one-row footer, and inside a
four-row footer on a 360 px landscape one. The HUD already *measures* both lanes
(`--hud-header-height` / `--hud-footer-height`, published by the ResizeObserver),
so the banner is centred in the band those measurements leave:

```css
top: calc(var(--hud-header-height, 110px) + (100vh - var(--hud-header-height, 110px) - var(--hud-footer-height, 65px)) / 2);
```

`HudLayout.ts` is the readable arithmetic (`freeBand`, `bannerCentre`, `bannerFits`,
`bannerBudget`) and `beat-lines.test.ts` asserts the stylesheet and the arithmetic
agree, plus the two cases that matter: a 56 px banner clears both lanes on a
portrait phone, and a 360 px landscape phone with four footer rows leaves a 110 px
band — enough for the shrunk banner, not enough for a full-size one, which is why
short viewports cut the type instead of hiding the moment. The beat row itself adds
no positioning of its own (guarded): it inherits the strip's slot in the footer
lane, so it is not a new overlap surface on any breakpoint.

### Honest limits

`BeatLine.ts` cannot be constructed in jsdom — no WebGL, and
`canvas.getContext("2d")` returns null — exactly as `FinishGate.ts` cannot. It is
therefore untested here and is the reason total coverage moved 49.8 % to 49.3 %
while every module floor still passes. Its behaviour (flag placement, the
green-on-crossing beam, texture rebuild only on a label change) is what
`e2e/flight.spec.ts` and `e2e/layout.spec.ts` should cover in a real browser, and
they still cannot run in this sandbox.

## 6. Next, in order

1. **Browser check of §5.** If the strip crowds the flight, drop the career rung on
   short viewports first (it is the least urgent row) — do not re-hide the goals.
2. ~~**Mid-run quest completion.**~~ **Done, same day.** `newlyDone()` is wired:
   today's quests are polled at 5 Hz against live counters and pop in the pill the
   instant they cross, with `+N on landing` because the coins genuinely are paid at
   landing. No `ProgressEvent` was added — the run-end claim already owns that, and
   a second event for one crossing would double-count the celebration plan.
3. ~~**Rank-up in flight.**~~ **Done, same day**, with one deliberate deviation from
   the plan: **no `happyTime` mid-flight.** The crossing fires the banner, the
   `milestone()` sting and confetti, but the portal signal stays where it was — the
   run-end `wingsPromotion` already sends `wings_promo` telemetry and the single
   `happyTime` peak for the whole landing, and Poki asks for that signal sparingly
   (`portalAchievement()` batches four trophy unlocks into one call for the same
   reason). Adding a second peak per flight would be a louder signal, not a truer
   one. The banner also sits outside the arbitrated message lane on purpose:
   `feedbackSlot()` hands its single slot to the finish countdown for the last
   900 m, and a long flight is exactly where a rank-up happens.
4. **First 30 seconds.** `STARTER_TARGETS` already exists so the first reward lands
   early — verify it actually does on a first session (`e2e/first-session.spec.ts`),
   because "start small and end big" is only true if the small start is reachable.
5. **Read the dashboard.** Poki reports the eight funnel stages this build already
   sends. No decision in this repo has ever cited a number from it; the next
   progression change should.
