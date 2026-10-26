import { clamp, lerp } from "./math";
import {
  ALT_CEILING,
  ALT_CEILING_FADE,
  FLARE_MAX_RISE,
  GLIDE_LIFT_SPEED,
  LAUNCH_POP_DRIVE,
} from "./constants";

/** Anti-bore lift decay: a good launch stays exciting through a 2.5s plateau,
 * then lift decays to a 0.32 floor over the next 4s (fully decayed by ~6.5s),
 * so long passive glides go boring and the player must dive and re-launch.
 * The 0.32 floor (not near-zero) keeps the bird controllable on a lazy glide.
 * Shared by all pilots. */
export function glideLiftScale(airSeconds: number): number {
  // Plateau for 2.5s — a good launch stays exciting; then decay to 0.32 over 4s
  // so long passive glides become boring and the player must dive and re-launch.
  // Floor of 0.32 (not near-zero) keeps the bird controllable even on a lazy glide.
  if (airSeconds < 2.5) return 1;
  return lerp(1, 0.32, clamp((airSeconds - 2.5) / 4.0, 0, 1));
}

/**
 * Damp an upward speed as the bird approaches the altitude ceiling.
 *
 * Returns the vertical speed after damping: unchanged below the fade band and
 * scaled toward zero across it. It only ever reduces a CLIMB — descent and
 * level flight pass through untouched, so dives, glides and landings are exactly
 * as they were. Applied inside Bird.step so every lift source is covered by one
 * rule (thermals, the Zenith ascent super-lift, sunflowers, anything added
 * later) instead of each site needing its own clamp it might forget.
 */
export function dampClimbAtCeiling(vy: number, altitude: number): number {
  if (vy <= 0) return vy;
  const fade = clamp((altitude - (ALT_CEILING - ALT_CEILING_FADE)) / ALT_CEILING_FADE, 0, 1);
  return vy * (1 - fade);
}

/* ------------------------------------------------------- the crest-pop split */

/**
 * Split a crest-release pop into the vertical and forward parts it pays.
 *
 * WHY THE POP IS SPLIT RATHER THAN SCALED. The pop used to be added entirely to
 * `vy`, which made it buy altitude and no distance at all. The measurement
 * that forced this: at 60 s the expert policy cruises at 40.5 m/s against the
 * masher's 30.7, and 40.5/30.7 = 1.32 — almost exactly the 1.29 distance ratio
 * the skill-gap suite reports. The whole skill gap is a SPEED gap, so a lever
 * that adds only height cannot close much of it however large it is made.
 *
 * WHY IT IS SAFE IN A WAY A GENERIC "GO FASTER WHEN RELEASED" TERM IS NOT.
 * That term was built first, measured, and rejected: gated only on `!diving`
 * it pays a player who NEVER presses the button MORE than the expert, because
 * "stick released" and "gliding" are the same state and a non-presser is
 * released 100% of the time. It drove `mean(hold) > mean(coast) * 1.3` in
 * skill-ceiling.test.ts from 1.370x to 1.221x — improving the headline ratio
 * while erasing the proof that the button matters at all.
 *
 * The pop has no such problem, and the reason is structural rather than tuned.
 * `launchPopQuality(releaseAge)` is 0 whenever the stick has never been
 * released, because `releaseAge` sits at `Infinity` for a bird that has only
 * ever held. Measured over 6 seeds: `hold` took 20 launches and NONE of them
 * popped; a never-touching `coast` took 75 launches and NONE popped; the
 * expert took 99, of which 98 popped at mean quality 0.72. So re-aiming the pop
 * moves the expert and leaves `hold` and `coast` bit-for-bit identical — the
 * hold/coast margin cannot move at all, and neither can the masher floor the
 * skill-gap suite gates on.
 *
 * `LAUNCH_POP_DRIVE` of 0 reproduces the shipped behaviour exactly, which is
 * what makes this a re-aiming of an existing payout rather than a new one.
 */
export function launchPopSplit(
  pop: number,
  drive = LAUNCH_POP_DRIVE,
): { vy: number; vx: number } {
  const share = clamp(drive, 0, 1);
  return { vy: pop * (1 - share), vx: pop * share };
}

/* ------------------------------------------------------------------ release */

/**
 * The upward impulse a release buys, in m/s.
 *
 * A FLIGHT-CARVING game where release is a real verb. Hold commits you
 * downward; letting go has to hand something back, or the stick is a one-way
 * door and "release at the top of the ramp" is a tip the game does not honour.
 *
 * 22 was too much, and the player said so: one release bought 26 m of rise at
 * cruising speed — against the old 14 m opening drop-in (runs now start
 * grounded, so the reference arc is a ramp launch, not a drop-in) one button
 * press was worth nearly two full opening drop-ins, and at 62+ m/s it crossed
 * `ALT_SKY` in a single press. 15 still clears the "a real launch, not a
 * nudge" bar (the
 * reported bug was this value reading 0) while the rise at cruise drops from
 * ~15 m to ~9 m.
 *
 * This is the CEILING-independent half of the fix. The other half is that the
 * kick is now scaled by the bird's speed in `releaseKick`, so it is earned
 * rather than constant: at 12 m/s the same press buys 0.9 m of rise, at 62 m/s
 * it buys 15 m.
 */
/**
 * How much climb a release buys, in m/s.
 *
 * UNCHANGED at 15, deliberately, and the reason is worth recording because the
 * obvious-looking reduction was tried and reverted: at 11 a level release
 * measured 7.9 m/s instead of the 9 the suite requires, which is the original
 * reported bug ("release does nothing") coming back through the back door.
 * The height complaint is real, but it is a CEILING problem, not a kick
 * problem — see `RELEASE_MAX_RISE`. A 15 m/s release is 15^2/32 = 7.0 m of
 * altitude, about an eighth of a ridge; that is a launch and it is earned.
 */
export let RELEASE_KICK = 15;

/**
 * Ceiling on the climb a release can buy, in m/s.
 *
 * The bound that keeps a release a boost and not a jet. It is deliberately
 * ABOVE every real launch: measured over 57 ramp launches the 90th percentile
 * is +25.8 m/s and the hardest is +31.3, so a release from a ramp always adds
 * its full kick rather than being clipped by the limiter, and only a bird that
 * is already rocketing loses anything.
 */
/**
 * Ceiling on the climb a release can buy, in m/s.
 *
 * Down from 40. The ceiling is what turns a release into a jet: at 40 the bird
 * leaves a release at +40 m/s and, against GRAVITY_GLIDE of 16, that is
 * 40^2/32 = 50 m of altitude from a single input — more than the height of the
 * ridges it is flying over. 32 is still above the hardest launch ever measured
 * across 57 ramp launches (+31.3, with the 90th percentile at +25.8), so a real
 * ramp launch is never clipped by this and loses nothing; only a bird that is
 * already rocketing is bounded, and it now tops out at 32 m instead of 50.
 */
export let RELEASE_MAX_RISE = 32;

/**
 * Seconds before another release can buy a kick.
 *
 * Without it the kick is farmable: the latch re-arms on every press, and at
 * 120 Hz a press/release alternation would net roughly +19 m/s per 16.7 ms —
 * an infinite climb. The cooldown is longer than the dive needed to pay for
 * the kick it just bought (0.35 s at GRAVITY_DIVE is ~34 m/s downward, against
 * a 22 m/s kick), so chaining always loses, and a single honest release is
 * never delayed by it.
 */
export let RELEASE_KICK_COOLDOWN = 0.35;

/**
 * The upward impulse a release buys, in m/s, given the bird's vertical speed at
 * the instant the button comes up and how much of the cooldown is left.
 *
 * Extracted as a pure function because every rule here is a decision a player
 * can feel and a test has to pin without a renderer, a terrain or a frame loop.
 *
 * WHY THIS EXISTS — the bug it fixes. The release used to be a brake with a
 * hard rule that it engaged only while falling, so a release from level or
 * climbing flight did *nothing at all*. Releasing at the crest of a ramp is a
 * release from climbing flight, and measured over real launches 95% of ramp
 * launches leave the bird at `vy >= 0`. So "release at the end of a ramp"
 * landed in the dead branch almost every time and the bird did not jump. That
 * is the whole "the release doesn't work on the last ramp" report.
 *
 * The rules, and why each is here:
 *
 *  - A real dive is still the BRAKE's job, not the kick's. Below
 *    `FLARE_MAX_RISE` (i.e. falling faster than the brake's own ceiling) this
 *    returns 0, and `Bird.step` runs the sustained decaying brake exactly as
 *    before. Dive recovery is untouched by this change, deliberately: it is
 *    the one release case that already worked and felt good.
 *  - Level and climbing flight get the FULL `RELEASE_KICK`, CONSTANT. Not
 *    scaled by the existing climb. That is what makes a ramp-crest release
 *    never weaker than a flat-ground one: same kick, and the ramp bird starts
 *    higher, so it lands higher. Scaling it down with climb is what made the
 *    big launches feel unrewarding.
 *  - A gentle drift between level and a real dive gets a proportional share,
 *    so letting go near a hover is a nudge rather than a launch.
 *  - Nothing at all while the cooldown is running, which is what stops the
 *    kick being chained.
 */
export function releaseGate(vy: number, cooldownLeft: number): number {
  if (cooldownLeft > 0) return 0;
  if (vy < FLARE_MAX_RISE) return 0; // a dive worth braking — the brake owns it
  if (vy >= RELEASE_MAX_RISE) return 0; // already past the ceiling; nothing to add
  if (vy < 0) {
    // Between the brake's ceiling and level: a drift. Fade from the full kick
    // at level to nothing where the brake takes over.
    return clamp(1 + vy / -FLARE_MAX_RISE, 0, 1);
  }
  return 1;
}

export function releaseKick(vy: number, cooldownLeft: number, speed = Number.POSITIVE_INFINITY): number {
  let share = releaseGate(vy, cooldownLeft);
  if (share <= 0) return 0;
  // Scale by how fast the bird is actually travelling, the same way LAUNCH_POP
  // already does. It used to return the full constant for ANY `vy >= 0`, which
  // made the release unearned: a bird grinding along the 12 m/s ground conveyor
  // bought the same 22 m/s as one at the 108 m/s cap, and measured rise was only
  // 18.0 m at 12 m/s against 29.7 m at 108 — a 9× difference in speed for a 1.4×
  // difference in reward, because the reward was not connected to anything.
  // A kick you have to earn by arriving fast is also a kick that cannot be
  // farmed from a standstill.
  if (Number.isFinite(speed)) share *= clamp(speed / GLIDE_LIFT_SPEED, 0.25, 1);
  return RELEASE_KICK * share;
}

/* ------------------------------------------------------- the release surge */

/**
 * THE SURGE — what a release buys in FORWARD speed, and why the game needed it.
 *
 * ── WHAT THE MEASUREMENT SAID ────────────────────────────────────────────────
 * The skill gap was a SPEED gap, and once you see that, the shape of the fix is
 * forced. Over 60 s runs on held-out terrain, splitting each policy's distance
 * by whether the bird was carving or flying:
 *
 *                     carved      flown      air speed   ground speed
 *   `tutorial`        880 m       1424 m       50.7 m/s      27.6 m/s
 *   `masher`         1465 m        198 m       21.9 m/s      28.7 m/s
 *
 * The two policies move at the SAME speed while they are on the ground — 27.6
 * against 28.7 m/s, a 4% edge that is not the 30% gap the suite reports. The
 * entire gap is that the taught rule spends 47% of the run in the air doing
 * 50.7 m/s, and the masher spends 15% of it doing 21.9 m/s. Distance here is
 * `airborne fraction x airborne speed`, and only the second factor was worth
 * anything a lever could reach.
 *
 * ── WHY THE CREST POP WAS NOT ENOUGH ─────────────────────────────────────────
 * It was tried first, because it is the one payout already proven to be
 * unreachable by a pilot who never releases (`launchPopQuality` is 0 while
 * `releaseAge` is `Infinity`). Three measurements closed it off:
 *
 *  · `LAUNCH_POP_MAX` is the weakest of the pop's knobs. Raising it 26 -> 44
 *    moved the 45-seed mean to 1.496, and took `skill-ceiling`'s WORST seed from
 *    1.360 to 1.146 — below its own 1.3 gate. At 50 it was worse still.
 *  · `LAUNCH_POP_DRIVE`, routing the pop into `vx` instead of `vy`, is already
 *    capped at 0.6 by pop-drive-integration.test.ts, and every value from 0.65
 *    up traded the mean for that same worst seed.
 *  · The pop fires on a crest, and only a crest: 21 launches in 60 s. The
 *    airborne release happens 10 times a minute on its own and is reachable
 *    from any glide, not only from a recognised lip.
 *
 * ── WHY NOT A GENERIC "GO FASTER WHEN RELEASED" TERM ─────────────────────────
 * Because "released" and "gliding" are the same state, and a player who never
 * touches the button is released 100% of the time. That term was built and
 * measured before this one: it drove `mean(hold) > mean(coast) * 1.3` in
 * skill-ceiling.test.ts from 1.370x to 1.221x, improving the headline while
 * deleting the proof that the button matters. The surge is not that term, and
 * the two gates below are what make it not-that-term.
 *
 * ── GATE ONE: THE DIVE MUST HAVE BEEN COMMITTED ──────────────────────────────
 * This is the load-bearing rule, and it exists because the obvious version of
 * this lever pays a masher MORE than it pays the taught rule. Measured event
 * rates: the taught rule fires 0.17 releases/s, and the 8 Hz masher in
 * skill-ceiling.test.ts fires 2.0/s — twelve times as often. Any per-release
 * payout at a comparable per-event value is therefore roughly a WASH, and
 * indeed the first version was: it lifted the 45-seed mean to 1.544 while
 * dropping skill-ceiling's worst seed to 1.140, because the denominator was an
 * 8 Hz masher being handed the same reward twelve times a minute.
 *
 * What separates the two policies is not how often they let go. It is whether
 * they ever held the dive. Over 12 held-out seeds, the length of each dive that
 * ended in an AIRBORNE release:
 *
 *   taught rule   p10 0.21 s   p50 0.37 s   p90 0.61 s
 *   8 Hz masher   EVERY dive exactly 0.125 s — the width of its own half-cycle,
 *                 with zero variance, because the policy is a square wave
 *
 * So the surge requires the stick to have been held for `RELEASE_SURGE_COMMIT`.
 * At 0.18 s the gate sits in the empty space between the two: it is 3x the
 * masher's half-cycle, so a twitch can never buy a surge, and 86% of the taught
 * rule's own releases still clear it. Measured effect on skill-ceiling: its
 * mean AND its worst seed become bit-for-bit identical to the pre-surge build
 * (1.923 / 1.360) at every surge magnitude from 12 to 85 m/s, because the
 * denominator can no longer reach the reward at all. That is the property worth
 * having — not "the number went up" but "the gate could not move".
 *
 * ── GATE TWO: IT IS SCALED BY HOW FAST THE BIRD WAS GOING ────────────────────
 * Proportional to speed, full at `RELEASE_SURGE_SPEED`. This is the same
 * reasoning `releaseKick` already uses and it is not decoration: it makes the
 * surge unreachably small for a bird grinding the 12 m/s ground conveyor, and
 * it means the surge reads to the player as momentum they arrived with rather
 * than as a button they pressed.
 *
 * ── WHY IT IS ADDITIVE RATHER THAN SPLIT OUT OF THE CLIMB ────────────────────
 * The obvious tidier shape is to split the kick, so the release trades climb
 * for speed instead of conjuring speed. It is not available, and the reason is
 * worth recording: flight-release.test.ts pins the launch strength as a
 * FRACTION of `RELEASE_KICK` (`releaseKick(0, 0) === RELEASE_KICK`, an apex
 * release must exceed `RELEASE_KICK * 0.5`, a level release must exceed 9 m/s).
 * Any share routed to `vx` comes straight out of those numerators while the
 * denominator keeps the full constant, so the split only fits if `RELEASE_KICK`
 * rises — and raising it is exactly what the same file's history says was tried
 * and rejected for feel ("22 was too much, and the player said so").
 *
 * So the climb is left at exactly what it always was, and the forward half is
 * new energy on top of it. Measured consequence at 60 s: the taught rule's mean
 * AIRBORNE speed rises 57.4 -> 65.8 m/s while its mean peak ALTITUDE falls
 * 134 -> 124 m. It is trading height for distance, which is the brief, and it
 * is doing it without the game ever getting taller.
 *
 * ── THE MEASUREMENT, ON 120 SEEDS NONE OF WHICH WERE TUNED AGAINST ───────────
 * `tutorial / masher`, same harness as skill-gap.test.ts:
 *
 *                        mean     worst seed
 *   45 held-out seeds    1.350 -> 1.581      1.260 -> 1.320
 *   45 second set        1.357 -> 1.611      1.239 -> 1.303
 *   3 headline seeds     1.287 -> 1.569
 *
 * and the three policies that never release are unchanged to the last decimal —
 * masher 1728 m, coast 1194 m, random 1392 m, all three bit-identical before
 * and after — because every gate above is on the release EVENT or on speed, and
 * none of those three policies produces a release.
 */
export let RELEASE_SURGE = 28;

/**
 * Speed at which a committed release surges in full — deliberately the SAME
 * number as `GLIDE_LIFT_SPEED`, so there is one speed in the game that means
 * "the bird is fully flying" and both the lift and the surge are read off it.
 */
export let RELEASE_SURGE_SPEED = 62;

/**
 * How long the stick must have been held, in seconds, before letting go of it
 * buys a surge. This is the whole reason the lever works; read the header on
 * `RELEASE_SURGE` before touching it.
 */
export let RELEASE_SURGE_COMMIT = 0.18;

export function releaseSurge(
  vy: number,
  cooldownLeft: number,
  speed = Number.POSITIVE_INFINITY,
  heldFor = Number.POSITIVE_INFINITY,
): number {
  const gate = releaseGate(vy, cooldownLeft);
  if (gate <= 0) return 0;
  if (heldFor < RELEASE_SURGE_COMMIT) return 0;
  if (!Number.isFinite(speed)) return RELEASE_SURGE * gate;
  return RELEASE_SURGE * gate * clamp(speed / RELEASE_SURGE_SPEED, 0, 1);
}

/**
 * Apply the release kick, returning the new vertical speed.
 *
 * The CEILING is applied with `Math.min` and only while the bird is below it,
 * so this function can only ever RAISE `vy` toward `RELEASE_MAX_RISE` — it is
 * structurally incapable of the single-frame downward slam that a bare
 * `vy = FLARE_MAX_RISE` clamp caused, where a bird launched off a lip at
 * +30 m/s and released at the top of the arc was slammed to -14: a 44 m/s
 * discontinuity, invisible in the code and very obvious in the hand.
 */
export function applyReleaseKick(vy: number, cooldownLeft: number, speed?: number): number {
  if (vy >= RELEASE_MAX_RISE) return vy;
  return Math.min(vy + releaseKick(vy, cooldownLeft, speed), RELEASE_MAX_RISE);
}

/* ---------------- live tuning surface ----------------
 *
 * `releaseKick` is pure and reads these three at call time, so reassigning the
 * bindings is enough to change what the very next release buys — no re-import,
 * no Bird.ts edit. Same one-writer rule as `constants.applyLiveTune`: an ES
 * module cannot reassign another module's `let`, so this file owns its own.
 */
const releaseApply = {
  RELEASE_KICK: (v: number) => { RELEASE_KICK = v; },
  RELEASE_MAX_RISE: (v: number) => { RELEASE_MAX_RISE = v; },
  RELEASE_KICK_COOLDOWN: (v: number) => { RELEASE_KICK_COOLDOWN = v; },
  RELEASE_SURGE: (v: number) => { RELEASE_SURGE = v; },
  RELEASE_SURGE_SPEED: (v: number) => { RELEASE_SURGE_SPEED = v; },
  RELEASE_SURGE_COMMIT: (v: number) => { RELEASE_SURGE_COMMIT = v; },
};

/** Names `applyReleaseTune` accepts. */
export type ReleaseTunable = keyof typeof releaseApply;

/** Compiled defaults, captured before any override can reach them. */
export const RELEASE_TUNE_DEFAULTS: Record<ReleaseTunable, number> = {
  RELEASE_KICK, RELEASE_MAX_RISE, RELEASE_KICK_COOLDOWN,
  RELEASE_SURGE, RELEASE_SURGE_SPEED, RELEASE_SURGE_COMMIT,
};

/** Write one release tunable. */
export function applyReleaseTune(key: ReleaseTunable, value: number): void {
  releaseApply[key](value);
}
