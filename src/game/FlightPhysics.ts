import { clamp, lerp } from "./math";
import { ALT_CEILING, ALT_CEILING_FADE, FLARE_MAX_RISE } from "./constants";

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

/* ------------------------------------------------------------------ release */

/**
 * The upward impulse a release buys, in m/s.
 *
 * A FLIGHT-CARVING game where release is a real verb. Hold commits you
 * downward; letting go has to hand something back, or the stick is a one-way
 * door and "release at the top of the ramp" is a tip the game does not honour.
 */
export const RELEASE_KICK = 22;

/**
 * Ceiling on the climb a release can buy, in m/s.
 *
 * The bound that keeps a release a boost and not a jet. It is deliberately
 * ABOVE every real launch: measured over 57 ramp launches the 90th percentile
 * is +25.8 m/s and the hardest is +31.3, so a release from a ramp always adds
 * its full kick rather than being clipped by the limiter, and only a bird that
 * is already rocketing loses anything.
 */
export const RELEASE_MAX_RISE = 40;

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
export const RELEASE_KICK_COOLDOWN = 0.35;

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
export function releaseKick(vy: number, cooldownLeft: number): number {
  if (cooldownLeft > 0) return 0;
  if (vy < FLARE_MAX_RISE) return 0; // a dive worth braking — the brake owns it
  if (vy >= RELEASE_MAX_RISE) return 0; // already past the ceiling; nothing to add
  if (vy < 0) {
    // Between the brake's ceiling and level: a drift. Fade from the full kick
    // at level to nothing where the brake takes over.
    return RELEASE_KICK * clamp(1 + vy / -FLARE_MAX_RISE, 0, 1);
  }
  return RELEASE_KICK;
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
export function applyReleaseKick(vy: number, cooldownLeft: number): number {
  if (vy >= RELEASE_MAX_RISE) return vy;
  return Math.min(vy + releaseKick(vy, cooldownLeft), RELEASE_MAX_RISE);
}
