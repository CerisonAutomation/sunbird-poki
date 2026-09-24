# Music & HUD critique — the score was a loop, and the distance readout was invisible at night

> **Status:** current evidence — critique → implemented changes, 2026-09-24. Findings M-1…M-7 and H-1…H-2 are live; M-1/M-2/H-1 are fixed in this tree, the rest are recorded as deliberate deferrals with reasons. Cited by `src/game/__tests__/music-harmony.test.ts`, `src/game/__tests__/hud-contrast.test.ts` and the progression block in `src/game/Music.ts`.

Date: 2026-09-24, tree `arena/01a0cba9-sunbird` at `263c1a7` + the changes below.
Prompt: *"fix the music and make this million times better, make this more real
progression, and fix the text to be white for distance — critique everything brutally
and honestly."* Everything measured here was measured against source in this tree, not
memory. No claim below comes from listening: there is no browser and no audio device in
this environment, which is itself finding M-7.

## Part 1 — The 30-song engine that was pasted in

A standalone `SONGS`/`Engine` file: 30 named songs with chord bars, a lead array, a drum
string, per-song tempo/swing/delay-send/wet and an instrument matrix, plus a Web Audio
synth and a DOM transport. Brutally:

1. **It does not run.** `har.c.map(M)`, `M(har.b)`, `M(lead)` — the note-name→frequency
   function is referenced three times and defined nowhere in the file. The first bar of
   the first song throws `ReferenceError: M is not defined`. Every other observation
   below is downstream of a missing function. (The repo's engine has this as `mtof()`.)
2. **`setTimeout` is the clock, and the clock is the music.** One `setTimeout(tick,
   stepDur*1000)` per step, scheduling ~50 ms ahead. Browser timer jitter is ±5–30 ms
   normally, worse on mobile, and in a background tab timers throttle toward 1 Hz. At a
   170 ms 16th step (88 BPM) that is up to ±18% of the grid: the groove wanders, hats
   flam, and swing — added to the *scheduled time* but never compensated in the timer
   period — drifts against itself. The repo already does this correctly: a lookahead
   scheduler on `ctx.currentTime` with a re-anchor guard against the machine-gun failure
   mode (`Music.ts`, `nextTime`/`tick`, and `music-scheduler.test.ts` pins it).
3. **The bar cycle is misaligned with the step grid.** `cycle = steps === 7 ? 7 : steps
   === 10 ? 10 : Math.max(8, steps/2)` — for the 12-step (6/8) songs that is 8 steps, so
   a four-chord cycle spans 32 steps = 2⅔ bars: the chords slide against the melody and
   never land together the same way twice. For 16-step songs it is 8 steps, so a 16-step
   lead is re-harmonised every half-bar. Both cases are out of phase with themselves.
4. **No gain staging.** Six voices plus kit sum straight into one `out` gain (0.5) and a
   mild compressor (−18 dB, 2.4:1). Rhodes fires four notes per chord, pad up to four
   more, and one lead note can trigger `chip` + `voice` + `chime` on the same step. Peaks
   stack; the compressor is doing the mixing. The repo has per-family gain buses for
   exactly this reason (`music-mix.test.ts`).
5. **A fresh noise buffer per drum hit.** `noise()` allocates `sampleRate × dur` samples
   and fills them with `Math.random()` on every snare and hat — at 16 hats/second that is
   16 buffer allocations plus a filter and a gain node each, for a 40 ms sound. One shared
   noise buffer with per-hit filter/rate is the standard fix; this is GC churn and, on
   low-end Android, dropouts.
6. **`env()` is one refactor away from throwing.** `exponentialRampToValueAtTime` with a
   target ≤ 0 is a `RangeError`. It survives today only because of `Math.max()` clamps at
   three of the four ramp points; the release target is a bare `0.00008`.
7. **Stop does not stop.** `stop()` clears the timer; already-scheduled oscillators keep
   ringing to their own `stop(t+…)`, and the delay loop (feedback 0.22, wet up to 0.4)
   keeps bleeding for over a second. There is no master mute, no ramp-down, no cleanup.
8. **Hardcoded and wasted edges.** `setSong` clamps to `Math.min(29, …)` — a magic number
   that is `SONGS.length - 1` today and a bug the day a 31st song lands. `chime()` takes
   no duration and always releases over 1.0 s regardless of BPM. `applyFx(song)` runs
   every tick (two `setTargetAtTime` per step) when it only needs to run on a song change,
   and `parseDrums` re-allocates three padded strings per step for a value that never
   changes within a song.
9. **DOM-coupled, unpersisted, no resume path.** It assumes `#list/#meta/#play/#stop/
   #prev/#next/#vol` and a `.ghost` class from a host page that is not in the file; the
   selected song and volume reset on reload; there is no `visibilitychange` /
   `ctx.state === "suspended"` handling, which on iOS means silence after a tab switch.
10. **The songs themselves.** 30 titles with role-based BPM discipline (lullaby 46–64,
    intro 84–92, "fast" 88–100) is better metadata hygiene than most jam-code, and the
    per-song instrument matrix (`use:{bass,rhodes,uke,chip,chime,pad,voice}`) is a good
    idea worth stealing. Harmonically it has the same disease the repo had: nearly every
    `bars` array is a four-chord cycle with no cadence at the seam, no bridge, no
    modulation, and several songs sharing shapes (4/29/6 are all i–VI–III–VII families).
    A chord *cycle* is not a progression.

**Verdict:** do not ship it and do not port it wholesale — the repo's engine is ahead of
it on every axis that matters (clock, buses, arrangement, tested contracts). What is
worth taking is data and discipline, not architecture: 30 *named* songs, per-song
tempo/swing/delay-send/wet, the instrument matrix, and BPM-by-role. Porting that into
`TRACKS` + `MusicArrangement` is a day of work with a listening pass, not a patch.

## Part 2 — The repo's music, honestly

**What is genuinely good, and rare in a game this size:** a lookahead scheduler on the
audio clock; 30 tracks; per-family gain buses; arrangement phases that *remove*
instruments rather than only adding volume (`MusicArrangement.ts`, music pass 3); and a
melodic-contract harness that asks whether a tune is a tune at all — ≥18 sounding eighths
per 8-bar loop, no six-eighth silence, phrase arrivals consonant with the chord under
them, at least one leap wider than a second, a lift above the opening note. That harness
is the only reason the harmony rewrite below was safe to do without ears.

**What was wrong:**

* **M-1 — the harmony was a loop, not a progression.** Eleven of the twelve score
  progressions were a four-bar idea stated twice; `PROG_B` and `PROG_K` were
  byte-identical under two names; `PROG_A` ended IV–V (a half cadence into nothing),
  `PROG_D` ended on V, `PROG_G` ended on vi, `PROG_H/I/J` were literal repeats. An
  eight-minute flight was one four-bar cycle repeated ~120 times. **Fixed:** each
  progression is now an antecedent (bars 1–4 — deliberately untouched, because the
  melodies and their pinned arrivals were written against them) and a consequent (bars
  5–8) that departs and lands: ii–V–I, IV–I, or in the minor tracks the modal v–i /
  ♭VII–i. `PROG_CHIP_6` bar 8 moved F→C because the loop restarted IV→ii and never came
  home anywhere. `music-harmony.test.ts` (7 tests) enforces the theory from now on: a
  cadence must exist (in the bars or across the loop seam), the loop must come home, the
  tonic must be reached at least twice, the consequent must not copy the antecedent (chip
  loops exempt and documented — a stated-twice loop *is* the chiptune idiom), and the
  chord vocabulary must be closed and identical in all four places that list it.
* **M-2 — two tunes were written against the old harmony, and the harness caught both.**
  Moving bar 8 broke two phrase arrivals. Starfall landed on F over the new Am: that is an
  Am6, and the guard only allowed a *major* 6th (offset 9) while its own doc comment
  promised "a triad, 6th, 9th, or the sus-4" — so the test was incomplete and was fixed.
  Fever Dream landed on B5 over the new tonic C: a major-7th arrival that genuinely
  floats, so the *tune* was fixed — the leading tone now resolves up to C (D6→C6→C6, same
  rhythm, one semitone), which is what a V–I cadence always wanted. Two real clashes found
  without a listening pass is the harness earning its keep.
* **M-3 — the score cannot cadence in minor properly.** The chord table is `{C, G, Am, F,
  Em, Dm, Gm}`: no E major, so no G# leading tone, so the minor tracks cadence modally
  (v–i, ♭VII–i) rather than with a harmonic-minor V–i. That is a colour — flatter, colder,
  arguably right for a night flight — but it is a limitation and it is now pinned: a test
  fails if anyone adds `E` without also opening the melodic contract to G#, because the
  melodies are all diatonic-with-one-borrowed-Bb and a G# under the glockenspiel lead is a
  semitone clash, not a spice.
* **M-4 — no voice leading. Not fixed, on purpose.** Chords are played from fixed ukulele
  voicings (`UKE[chord]`), so every bar of every song is the same inversion and the pad
  jumps instead of moving; real arranging keeps common tones and moves the top voice the
  smallest interval. Those voicings feed four different instruments (uke strum, pad, arp,
  counter-melody), and re-voicing them with no way to listen is how a working score becomes
  mush. This is the first thing to do with ears.
* **M-5 — no song form.** Arrangement phases change *texture* (kit, hats, comping, pad
  gains); nothing changes *form*. No verse/chorus/bridge, no key lift for the last leg, no
  long-arc shape. A ten-minute flight and a forty-second flight hear the same eight bars.
* **M-6 — the music does not know the player.** Track choice follows biome and mood.
  Nothing in the score reflects meta progress — migration legs, trophies, upgrades, story
  stage — which is the cheapest *felt* progression signal a game has: "the music got bigger
  because I got further." The progression-feel pass did this for celebrations and the
  ledger; the score was left out. Highest value per hour of the four deferrals.
* **M-7 — no human has heard any of it.** No browser, no audio device, no ears in this
  environment. Every claim above about consonance and cadence comes from theory plus the
  test harness. That is better than nothing and worse than listening: the first playtest
  should be a three-minute flight checking that the new consequents land where the flight
  does, and that the two edited bar-8s (Fever Dream, Starfall) feel resolved rather than
  merely correct.

## Part 3 — The HUD's most-read number was invisible at night

* **H-1 — dark brown text on a dark sky. Fixed.** `.stat-value` (the distance readout) and
  `.stat-label` were painted `#2c1f14` and `#9a7b4e` by `menu-polish.css` — a parchment
  restyle written for menu cards — with `!important`, and `main.tsx` imports `index.css`
  *before* `menu-polish.css`, so the leak won the cascade. `.hud-header`, `.top-bar` and
  `.stat-block` are transparent: the text floats directly on the sky. Measured against the
  real zenith colours in `src/game/Sky.ts`:

  | ink | night `#12102c` | dusk `#3a2460` | day `#2e90e0` |
  | --- | --- | --- | --- |
  | `#2c1f14` (what shipped) | **1.2:1** | **0.8:1** | 5.7:1 |
  | `#9a7b4e` (the 8px label) | 2.6:1 | 1.7:1 | 2.2:1 |
  | `#fff` (now) | 18.9:1 | 13.1:1 | 3.4:1 |

  0.8:1 is not low contrast, it is *negative* contrast — darker than the sky behind it. So
  the single most-read number in the game was unreadable for exactly the flights where the
  sky is dark, and the parchment looked fine in a menu screenshot, which is presumably how
  it shipped. Fix: white with a three-layer dark halo (a tight 0.85-alpha 2px layer,
  because the bright-sky case is carried by the shadow, not by the ink), label 8px→10px,
  and the coin number white too — gold `#ffd76a` measured 1.6:1 on the golden-hour zenith
  `#58b8f0`, worse than the white it replaced, and the gold coin *glyph* in `index.css`
  already says "coins". `hud-contrast.test.ts` (10 tests) parses both stylesheets, computes
  WCAG luminance against the six skies the game actually paints, and asserts which sheet
  wins the cascade. Two notes on the test itself, because both were real: the first version
  parsed CSS without stripping comments, so a rule that follows a block comment never
  matched and the file "passed" while reading the wrong stylesheet; and the thresholds in
  it are the measured numbers, not round ones. It was verified to fail (4 tests) with the
  parchment colour put back.
* **H-2 — what was not fixed: white on a bright day sky is 2.2–2.8:1.** No foreground
  colour wins there, because dark ink loses to the night sky instead — so the halo is
  load-bearing and true WCAG AA (4.5:1) needs a scrim behind the stat block. That is a
  visible panel in a HUD that is currently all-sky: a design decision for someone with eyes
  on the game, not a drive-by. The measured numbers are pinned in the test so the trade-off
  is explicit instead of vibes.

## Part 4 — Deferred, with reasons

| Item | Why not now | What it needs |
| --- | --- | --- |
| M-4 voice leading | Voicings feed four instruments; unverifiable without listening | Ears, one pass, then a test that total voice motion per bar is minimised |
| M-5 song form | Form changes need the arrangement phases re-cut, which is a mix decision | A design pass: how many minutes before a chorus, and what the bridge does |
| M-6 progression-coupled score | Highest value, but it touches save/progress data and needs a "did it feel bigger" check | Wire migration legs/trophies into key, instrumentation density and form length |
| M-3 harmonic-minor V–i | Needs G# in the melodic contract = a key change | A listening pass; the test will fail until both sides move together |
| Part 1's 30 songs | The engine is behind the repo's; the data is worth having | Port data into `TRACKS`/`MusicArrangement`, keep the repo's clock and buses |
| H-2 stat-block scrim | Visual-design change to a HUD that is currently all-sky | A human looking at golden hour on a phone |
