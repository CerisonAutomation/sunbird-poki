/**
 * How much "pop" a release earns at the lip — and, more importantly, why a
 * release used to earn none at all.
 *
 * The reported symptom: *"the release doesn't work on the last ramp — when I
 * release after a ramp the bird doesn't jump."* Three things combined to make
 * that true, and only the third is a matter of taste:
 *
 *  1. THE WINDOW MEASURED FROM THE WRONG END. `popQuality` was
 *     `1 - releaseAge / LAUNCH_POP_WINDOW` with a 0.45 s window, evaluated at
 *     the moment the bird actually leaves the ground. So the window is not
 *     "release within 0.45 s of the lip", it is "the lip must arrive within
 *     0.45 s of your release". On any ramp longer than about half a second of
 *     travel — which is most of them, because a ramp you can see is a ramp
 *     that takes time to climb — the correct input produced a timing of
 *     EXACTLY ZERO and therefore no pop whatsoever. The player released, the
 *     bird left the ground, and nothing happened. Not a nerf: a dead input.
 *
 *  2. THERE WAS NO FLOOR. Timing decayed linearly to zero, so a release that
 *     was merely early rather than wrong paid nothing. An input that
 *     sometimes does nothing is indistinguishable, in the hand, from an input
 *     that is broken — and it teaches the player to stop using it.
 *
 *  3. RELEASING JUST AFTER THE LIP PAID NOTHING EITHER. Leave the ground
 *     while still holding and the pop is gone for good; all that remains is
 *     the flare, which is deliberately clamped to arrest a fall and never to
 *     climb. Yet "release as you come off the top" is precisely what the
 *     coach line teaches, and it is what the hand wants to do, because the
 *     lip is easier to see than to anticipate.
 *
 * The fix keeps timing a real skill — a late, committed release is still
 * worth roughly two and a half times a lazy early one — while guaranteeing
 * the input always does something visible:
 *
 *  · the window is widened so a normal ramp fits inside it;
 *  · a floor means any release during the run-up pops at least a bit;
 *  · a short coyote grace after the lip lets "release at the top" land,
 *    exactly as the tutorial promises.
 *
 * Pure, so the curve can be asserted rather than felt for.
 */

/** Seconds before the lip within which a release still counts.
 *  Was 0.45, which most ramps do not fit inside. */
export const LAUNCH_POP_WINDOW_S = 0.9;

/**
 * Fraction of the pop paid for a release that happened during the run-up but
 * outside the precise window. The input is never worth nothing.
 */
export const LAUNCH_POP_FLOOR = 0.4;

/**
 * Grace after leaving the ground during which a release still counts as a
 * lip release — the same affordance a platformer's coyote time provides, for
 * the same reason: the player's intent was formed before the frame that
 * invalidated it.
 */
export const LAUNCH_POP_COYOTE_S = 0.2;

/**
 * Timing quality in 0..1 for a release made `releaseAge` seconds before the
 * bird left the ground.
 *
 * `Infinity` (the sentinel for "still holding the stick") is 0: a held stick
 * pays nothing, which is the property that keeps releasing worth doing.
 */
export function launchPopQuality(
  releaseAge: number,
  window = LAUNCH_POP_WINDOW_S,
  floor = LAUNCH_POP_FLOOR,
): number {
  if (!Number.isFinite(releaseAge) || releaseAge < 0) return 0;
  if (window <= 0) return 0;
  const precise = 1 - releaseAge / window;
  if (precise >= 1) return 1;
  // Inside the window: interpolate between the floor and full credit, so the
  // curve is continuous and a slightly-early release is slightly worse rather
  // than a cliff. Outside it: the floor, because the player did release.
  if (precise > 0) return Math.min(1, floor + (1 - floor) * precise);
  return floor;
}

/**
 * Did this release happen close enough to the lip to count at all?
 *
 * Separate from the quality curve because "you released during the run-up"
 * and "you released half a minute ago and have been coasting" are different
 * facts, and only the first should pay.
 */
export function launchPopEligible(releaseAge: number, runUpSeconds: number): boolean {
  if (!Number.isFinite(releaseAge) || releaseAge < 0) return false;
  // A release older than the entire grounded run-up belongs to a previous
  // launch and has already been spent.
  return releaseAge <= Math.max(LAUNCH_POP_WINDOW_S, runUpSeconds);
}

/**
 * Is a release made `sinceLaunch` seconds AFTER leaving the ground still
 * inside the coyote grace?
 */
export function withinPopCoyote(sinceLaunch: number, grace = LAUNCH_POP_COYOTE_S): boolean {
  return Number.isFinite(sinceLaunch) && sinceLaunch >= 0 && sinceLaunch <= grace;
}

/* ------------------------------------------------------------------ the gate */

/**
 * How decisively the physics must exceed the surface's hold before a launch
 * is allowed WITHOUT a recognised crest under the bird.
 *
 * 1.0 would disable the prominence filter entirely and bring back the
 * noise-driven micro-launches it was added to stop. Much above ~1.5 and the
 * filter is still effectively a veto on real ramps. This is the margin at
 * which "the bird has left the surface" stops being ambiguous.
 */
export const CREST_BYPASS_RATIO = 1.3;

/**
 * Should the bird leave the ground this step?
 *
 * The regression this exists to fix, found by reading the first commit in
 * the repository rather than by guessing:
 *
 *   ORIGINAL (1aea134)    `if (curv > 0) { ...if (needed > available) launched = true }`
 *   CURRENT               `if (curv > 0 && terrain.hasCrestProminence(this.x))`
 *
 * `hasCrestProminence` was added for the AI's crest cache, and it asks a
 * strict question: is the terrain climbing 6 units BEHIND me and already
 * descending 6 units AHEAD of me? On the last ramp of an island — where the
 * far side runs out into the ocean gap, or where the crest is simply broad —
 * the second half is false, so the gate returns false and the launch is
 * VETOED. Not weakened: vetoed. The centripetal test could say the bird has
 * unambiguously left the surface and the bird would stay glued to it anyway.
 *
 * That is the reported bug exactly — "the release doesn't work on the last
 * ramp, the bird doesn't jump" — and it is also why tuning the pop had no
 * effect: the pop is applied inside the `launched` branch, downstream of a
 * gate that never opened.
 *
 * Prominence is an ANTI-NOISE FILTER, not a physics authority. It keeps its
 * veto over marginal cases, which is all it was ever for; it loses its veto
 * over decisive ones, because the surface cannot hold a bird that the maths
 * says it is no longer touching.
 *
 * @param needed        centripetal acceleration required to stay glued
 * @param available     what gravity plus stick can actually supply
 * @param hasProminence does a recognised crest sit under the bird?
 */
export function shouldLeaveGround(
  needed: number,
  available: number,
  hasProminence: boolean,
  bypassRatio = CREST_BYPASS_RATIO,
): boolean {
  if (!Number.isFinite(needed) || !Number.isFinite(available)) return false;
  // Still glued: no amount of crest makes a launch happen.
  if (needed <= available) return false;
  // A real lip: the original behaviour, unchanged.
  if (hasProminence) return true;
  // No recognised lip, but the surface demonstrably cannot hold on.
  return needed > available * bypassRatio;
}
