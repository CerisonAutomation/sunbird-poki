# Engagement playbook — from 1 m 20 s to the 3-minute bar

**Date:** 2026-10-04 · **Inputs:** the 2026-10-04 Player Fit Test audit (500 plays,
1 m 20 s average, 5 % engaged), the game-events funnel from the same window, a
measured first-session audit (`scripts/first-session-audit.mjs`), and Poki's own
published bars (`SUB-16`, `SUB-17`, `EN-*`, `EA-*` in this corpus).

This is the action layer on top of the extracted guide: what the numbers say,
what psychology and game technique say about each number, what already changed,
and what to do next — in the order the data says pays.

---

## 1. Where Sunbird stands (2026-10-04 audit)

| Signal | Value | Poki's bar | Verdict |
|---|---|---|---|
| Average playtime | **1 m 20 s** | 3 m 0 s to advance (`SUB-16`); 5 m+ for successful games | **fail** |
| Plays > 3 min | **~5 %** | ≥ 25 % | **fail** |
| Loading completion | 96 % | — | healthy (file size/loading is NOT the problem) |
| Run start rate (daytrip) | 70 % of gameplays | — | healthy (the menu converts to play) |
| Daytrip "completed" | **0 %** | — | **broken by the game's own outcome semantics** (fixed today — §3.1) |
| Daytrip failed / left | 20 % / 9.2 % | — | runs end without payoff |
| New players → second run | 29 → 8 (**28 %**) | — | the loop is not holding players past one run |

A measured first-session walkthrough (phone viewport, real browser) matches the
average exactly: **boot 3.5 s → menu 8.6 s → flight 13 s → sunset ~80 s → retry
available 90 s → session ends after ONE run at ~95 s.** The average player never
sees a second run. Every minute of the missing playtime is in the gap between
run 1 and run 2.

## 2. What Poki's own diagnostic table says

`reading-results` (Poki's guide): *players quit in the first minute and the
histogram leans left → **onboarding**; healthy start with mid-histogram drop-off
→ **content depth / hook**.* Sunbird's shape is the second: loading and run
start are healthy, and the loss is *inside and just after* run 1 — sunset dead
time, failure framing, and no visible reason to fly again.

## 3. What changed today (this branch)

### 3.1 Run-outcome honesty — the 0 % completion fix

Daytrip (the **default** mode) has no finish line, and the outcome defaulted to
`fail` at launch with nothing to ever change it: every daytrip in history was
reported to the platform funnel as a failure — while the recap screen
celebrated the same flight with quests, coins and "flight recap" framing. The
Player Fit funnel therefore read "0 % of players ever complete the main mode",
which reads as a broken game in an audit.

New rule (`src/game/runOutcome.ts`, unit-tested): in no-finish-line modes,
**the flight is the goal** — sunset after a real flight or landing to rest is a
`complete`; ditching in the sea or a no-show launch is a `fail`. Expected
effect: daytrip completions move from 0 % to the large majority of real runs,
the funnel becomes readable, and the platform's completion statistic finally
matches the experience the recap screen already sells.

### 3.2 Second-wind countdown: 15 s → 10 s

The continue offer held the player for up to 15 s at the exact moment they
choose between "one more run" and leaving. The measured average session is
~95 s; five seconds of forced waiting is ~5 % of the average player's entire
stay. "Let it sleep" skips it, but a countdown nobody reads is a countdown
nobody skips. Now 10 s (`CONTINUE_TIMEOUT`), in line with standard revive
windows.

### 3.3 PvP actually works (see `docs/audits/PVP_TRANSPORT_INCIDENT_2026-10-04.md`)

The Race Lobby previously dialled a dead WebSocket relay — live PvP was
unreachable in the shipped build. Live rooms are a major session-length lever
(40-pilot mass races, rival duels): they are now wired to Netlib P2P, proven on
the shipping artifact in a real browser.

## 4. The playbook — psychological and game-technique levers, ranked

Each lever names the mechanism (why it works), the hook in this codebase, and
the evidence bar. Work top-down; each is small.

| # | Lever | Mechanism | Where |
|---|---|---|---|
| 1 | **Near-miss framing on the recap** — "412 m — 88 m short of your best" | The near-miss effect is the strongest documented retry driver in arcade games; loss felt as *almost* converts to "one more" | `nearMiss` already flows to `renderGameOver`; make the delta the headline, not a sub-line |
| 2 | **First-flight goal strip the player can beat** — a 500 m "Reach the first island" target with a progress bar | Visible, close goals (goal-gradient effect) hold attention through the first sunset | `sessionGoals` + `FlightGuidance`; target derived from 0.6 × first-run cohort median |
| 3 | **Instant-restart muscle memory** — Space/Enter/tap restarts from the recap within one frame, no pointer hunting | Friction between runs is where sessions die; the retry already exists (`data-action="retry"`) | `OverlayNavigation` primary action on the recap card |
| 4 | **Streak save** — "Day 2: your streak is live" chip on the menu | Loss aversion + endowed progress: a streak the player *owns* is a reason to return tomorrow | `streakDays` already tracked (`SaveData`), surface it on the home hero |
| 5 | **Second-run bonus** — coin multiplier visibly armed on the recap ("Next flight: ×1.5 coins") | The Zeigarnik effect: an open, armed reward pulls the next run | `runCoinMultiplier` plumbing exists (`SaveData.beginRun`) |
| 6 | **Golden hour telegraph** — at 75 % daylight a soft cue "Golden hour soon — coins ×2" | Anticipation (dopamine prospect) outperforms surprise for holding attention to the end of a run | `goldenHour` already fires; add the pre-cue |
| 7 | **Personal-best ghost on the FIRST run** — a faint marker at the beginner's median distance | Social comparison without another human; gives the empty first sky a shape | `Ghost`/`RivalGhost`; seed from benchmark rows (`benchmarkRows()`) |
| 8 | **Recap length discipline** — the recap card is rich (quests, pass, atlas, shop, share…); on phone it scrolls well past the fold | Cognitive load at the decision moment; the ONE thing the player must see is "fly again + why" | Fold order: near-miss → armed bonus → retry; everything else below |
| 9 | **Session cadence after run 2** — the "Ready for the social sky?" toast fires after run 2; consider a daily-challenge CTA instead | A concrete, time-limited next goal beats a vague social nudge for new players | `sessionRuns === 2` toast in `finishRun()` |
| 10 | **Portrait-first polish** — portrait averages +6 % engagement and unlocks Gamebar ads (`EA-10`) | Platform-measured, not theory | Verify the default preview orientation is portrait |

### 3.4 The recap psychology pass — levers shipped (same day)

The ranked levers below were implemented the same day the playbook was
written; nothing here is aspirational.

* **Outcome-aware recap headline** — the headline used to shame every run
  ("The sun beat you") including completed day trips. `runOutcome` (the same
  contract the Poki funnel reports, §3.1) now flows into `HudSnapshot` and the
  headline celebrates a completed run ("You flew to sundown" / "Flight
  complete — landed clean"); only genuine fails get coaching copy.
* **Near-miss promoted to the emotional peak** (lever 1) — the `nearMiss`
  strip moved from below eight folds to directly after the tagline, before
  the Fly Again button, where the retry decision actually forms.
* **Armed bonus + next flight above the fold** (levers 5 + 8) — the 3× coin
  card and the "take this into your next flight" lesson moved up to directly
  after the Distance/Score/Coins summary; shop/pass/atlas links and the
  details fold stay below.
* **Golden-hour pre-cue** (lever 6) — one soft toast at 35 % daylight
  ("Golden hour soon — coins ×2 while the sun sets"), once per run; the
  payoff toast at 22 % is unchanged.
* **Streak chip on the home hero** (lever 4) — a `streakDays ≥ 2` pill on the
  title screen ("3-day streak — one flight keeps it alive"): endowed progress
  exactly where the return decision happens.
* **Run-2 CTA made concrete** (lever 9) — "Ready for the social sky?" became
  "Today's Daily Challenge is live — bonus coins on the daily course".

Locked by `src/game/__tests__/recap-engagement.test.ts` (9 tests: headline
framing, fold order, no duplicate cards, streak chip presence/absence) and
proven on the running artifact by `scripts/first-session-audit.mjs`, which
now asserts the headline and samples for the golden-hour cues mid-run
(headline PASS, pre-cue PASS on the 2026-10-04 run).

**Lever status:** 1, 4, 5, 6, 8, 9 **shipped** (above) · 2 **already existed**
(starter session-goals with a 40-coin reward floor — verified) · 3 **verified,
no change needed** (Fly Again is the first control in the card; Space is the
EN-02 two-step primary; the button already carries full gold-CTA styling) ·
7 **deferred with reason** (a first-run ghost needs real cohort seed data —
`benchmarkRows()` is empty until the game has live runs; revisit after the
next fit test) · 10 **verified** (phone-shaped preview is the default).

## 5. What NOT to do (the guide is explicit)

- **Never gate the first flight** — no name entry, no menu between boot and
  `gameplayStart()` (`EA-03`; the boot path already accepts the generated call
  sign silently).
- **Never block or nag with rewarded video** (`MON-*`): the second wind stays
  optional with a plain decline, which it is.
- **Don't pad playtime with forced waiting** — the 15 s countdown was exactly
  this; watch for the same pattern anywhere else time is the cost.

## 6. Measurement plan for the next Player Fit Test

1. **Daytrip completions** should jump from 0 % to the majority — if not, the
   outcome rule is not firing (check `runOutcome.ts` tests first).
2. **`player/second_run` vs `player/first_death`** — the retry conversion. The
   funnel stages exist (`FUNNEL_STAGES`); this ratio is the single number that
   should move with levers 1–5.
3. **Average playtime** — expect the countdown + PvP + outcome changes to move
   it toward ~2 m. Levers 1–5 are what carry it past 3 m.
4. **Watch 10 playtest recordings** before changing anything else — Poki's
   guide is explicit that recordings answer *why* when the histogram answers
   *how much*.
