import { clamp, lerp } from "./math";
import {
  ALT_CEILING,
  ALT_CEILING_FADE,
  FLARE_MAX_RISE,
  GLIDE_EXCHANGE,
  GLIDE_EXCHANGE_ALT_CAP,
  GLIDE_EXCHANGE_MAX,
  GLIDE_LIFT_SPEED,
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

/* ------------------------------------------------------- the energy exchange */

/**
 * Forward acceleration a descending glider earns by trading height for speed.
 *
 * THE GAP THIS FILLS. Lift in this model cancels gravity and nothing else, and
 * drag only ever removes speed, so before this existed a released bird was a
 * one-way street: it sank, and it decelerated, and the climb a release bought
 * was never converted into the distance it was supposed to be worth. Every
 * other number in the flight model was re-tuned around that hole; this is the
 * term that closes it.
 *
 * WHY IT IS SCALED BY THE HEIGHT BANK, NOT BY `vy` ALONE. The first version of
 * this was `GLIDE_EXCHANGE * -vy` and it measured a large, real ratio gain —
 * and it was WRONG, and the mistake is the most instructive one in this file.
 * "Stick released" and "gliding" are mechanically the same state, so a player
 * who NEVER touches the button is permanently released and collects the payout
 * on 100% of its airtime, while the expert policy is airborne only ~49% of the
 * time and collects it the rest. The change paid the COASTER more than the
 * expert, and it collapsed `mean(hold) > mean(coast) * 1.3` in
 * skill-ceiling.test.ts from 1.370x to 1.221x — i.e. it erased the proof that
 * the button does anything at all, while flattering the headline ratio. A
 * lever that improves the number and destroys the design is not a lever.
 *
 * Altitude fixes it, because altitude is what distinguishes the two. Measured
 * mean height while airborne, same seeds and policy: expert 27.7 m, coast
 * 11.2 m, hold 12.8 m. Height is precisely the resource a pilot must EARN — by
 * launching off crests and popping — and a bird that never presses the button
 * never accumulates one. So scaling by height pays the thing the skill gap is
 * made of and not the thing that ignores the game.
 *
 *   - `vy >= 0` returns exactly 0. A climbing or level bird is not descending
 *     and has no height to spend, so the apex of an arc is not a free launch.
 *   - `altitude <= 0` returns exactly 0. Nothing to trade.
 *   - Both factors are read at call time, so the dev panel's slider moves the
 *     very next frame with no re-import.
 *   - Capped at `GLIDE_EXCHANGE_MAX`, and `Bird.step` still clamps total speed
 *     to `cap`, so the exchange cannot push the bird past `MAX_SPEED`.
 *
 * Gated at the call site on `!diving`: a diving bird is already being paid in
 * `GROUND_G_DIVE` and is deliberately spending energy downward.
 */
export function glideExchangeAccel(vy: number, altitude: number): number {
  if (vy >= 0 || GLIDE_EXCHANGE <= 0) return 0;
  // The DEADBAND is the mechanic's real skill gate: below it there is no bank
  // to spend and a bird that never presses the button — which is permanently
  // released, and therefore collects a naive `!diving` payout on every step it
  // spends airborne — is paid nothing. See GLIDE_EXCHANGE_ALT_FLOOR for the
  // measurement that forced it.
  const bank = Math.min(altitude, GLIDE_EXCHANGE_ALT_CAP) - GLIDE_EXCHANGE_ALT_FLOOR;
  if (bank <= 0) return 0;
  return Math.min(GLIDE_EXCHANGE * -vy * bank, GLIDE_EXCHANGE_MAX);
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
export function releaseKick(vy: number, cooldownLeft: number, speed = Number.POSITIVE_INFINITY): number {
  if (cooldownLeft > 0) return 0;
  if (vy < FLARE_MAX_RISE) return 0; // a dive worth braking — the brake owns it
  if (vy >= RELEASE_MAX_RISE) return 0; // already past the ceiling; nothing to add
  let share = 1;
  if (vy < 0) {
    // Between the brake's ceiling and level: a drift. Fade from the full kick
    // at level to nothing where the brake takes over.
    share = clamp(1 + vy / -FLARE_MAX_RISE, 0, 1);
  }
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
};

/** Names `applyReleaseTune` accepts. */
export type ReleaseTunable = keyof typeof releaseApply;

/** Compiled defaults, captured before any override can reach them. */
export const RELEASE_TUNE_DEFAULTS: Record<ReleaseTunable, number> = {
  RELEASE_KICK, RELEASE_MAX_RISE, RELEASE_KICK_COOLDOWN,
};

/** Write one release tunable. */
export function applyReleaseTune(key: ReleaseTunable, value: number): void {
  releaseApply[key](value);
}
