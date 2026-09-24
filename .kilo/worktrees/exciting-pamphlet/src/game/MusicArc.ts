/**
 * Music arc — the shape of a flight, as heard.
 *
 * The score already reacted to *events*: speed, altitude, fever, danger and
 * ring chains were summed into an intensity, and every comedy moment got its
 * own bounded gesture (`MusicMoments.ts`). What it never had was a shape over
 * the whole run. Two consequences were audible:
 *
 *   1. The take-off — the one beat every player feels — was the *quietest*
 *      moment of a flight, because at t=0 speed and altitude are both zero and
 *      the weighted sum collapses to nothing.
 *   2. The landing was a cut, not a resolve: the instant the run ended, the
 *      intensity went to 0 and the band disappeared mid-sentence.
 *
 * This module fixes both without touching the tuned energy formula. It adds an
 * *envelope* around that formula: a launch swell that guarantees the band
 * arrives with the player, hands the curve back to the flight as it develops,
 * and then smooths every change with a fast attack and a slow release, so a run
 * ends on a resolve instead of a cliff.
 *
 * Everything here is a pure function of scalars (run seconds, energy, dt) with
 * no audio graph, no DOM and no game state, so the whole feel of the soundtrack
 * can be unit-tested and re-tuned in one file — the same rule `SpeedFeel.ts`
 * follows for the visual side of speed.
 */

export const ARC = {
  /** Seconds the launch swell takes to arrive. */
  launchSeconds: 2.4,
  /** Intensity floor at take-off, so the first beat is never silence. It
   *  decays to nothing as the swell completes: after that the flight owns the
   *  curve and a quiet glide is allowed to be quiet. */
  launchFloor: 0.34,
  /** Attack time constant in seconds — the score leans in quickly. */
  attackSeconds: 0.35,
  /** Release time constant in seconds — and lets go slowly, so a run resolves. */
  releaseSeconds: 1.6,
  /** Dead band for writes to the audio parameter (see `arcShouldWrite`). */
  writeEpsilon: 0.02,
} as const;

const clamp01 = (v: number) => (v <= 0 ? 0 : v > 1 ? 1 : v);
const smoothstep01 = (t: number) => t * t * (3 - 2 * t);

/**
 * 0..1 progress of the launch swell. Smoothstepped rather than linear: a swell
 * that arrives evenly reads as a fade-in, and a fade-in is what a loading
 * screen does, not what a take-off does.
 */
export function launchSwell(runSeconds: number): number {
  if (!Number.isFinite(runSeconds) || runSeconds <= 0) return 0;
  return smoothstep01(clamp01(runSeconds / ARC.launchSeconds));
}

/**
 * The intensity the score should be heading towards right now.
 *
 * @param playing   false outside a flight — the target is silence, and the
 *                  *release* in `arcSmooth` is what makes that a resolve.
 * @param runSeconds seconds since the run started (drives the launch swell).
 * @param energy    the game's own 0..1 weighted sum (speed, altitude, fever,
 *                  danger, ring chain). This module shapes it; it never
 *                  re-tunes it.
 *
 * The floor *never scales the flight's own energy down* — it only lifts the
 * quiet start. Damping energy during the swell would lower the tempo floor for
 * the first two seconds of every run (intensity drives bpm in
 * `Music.applyIntensity`), and "a comedy beat may never make the flight feel
 * slower" is a standing rule this module inherits. So the two terms cross over
 * by max, not by mix: at take-off the floor dominates, and once the swell
 * completes it is gone and the flight owns the curve completely — a quiet glide
 * late in a run stays quiet.
 */
export function arcTarget(playing: boolean, runSeconds: number, energy: number): number {
  if (!playing) return 0;
  const e = Number.isFinite(energy) ? clamp01(energy) : 0;
  const floor = ARC.launchFloor * (1 - launchSwell(runSeconds));
  return clamp01(Math.max(floor, e));
}

/**
 * Moves the current intensity towards the target: fast attack, slow release.
 * Exponential approach rather than linear, so it never overshoots and never
 * needs a clamp of its own — and so a sudden drop (a crash, a run ending) is
 * heard as the band letting go, not as a fader being yanked.
 */
export function arcSmooth(prev: number, target: number, dtSeconds: number): number {
  if (!Number.isFinite(prev) || !Number.isFinite(target)) return 0;
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return prev;
  const tau = target > prev ? ARC.attackSeconds : ARC.releaseSeconds;
  return prev + (target - prev) * (1 - Math.exp(-dtSeconds / tau));
}

/**
 * Whether the smoothed value has moved enough to be worth writing.
 *
 * `Music.applyIntensity` already dead-bands at 0.01 and ramps with
 * `setTargetAtTime`, but that automation is scheduled per write: calling it
 * every frame for a value that has not moved grows the audio timeline for
 * nothing, which is a known cause of crackle on WebViews (the same reason
 * `Audio.update` guards its own parameter writes). The final write to silence
 * is always allowed through, so a run can never end stuck at 0.03.
 */
export function arcShouldWrite(lastWritten: number, next: number): boolean {
  if (!Number.isFinite(lastWritten) || !Number.isFinite(next)) return false;
  if (next === 0 && lastWritten !== 0) return true;
  return Math.abs(next - lastWritten) >= ARC.writeEpsilon;
}

/**
 * Pure: how hot the mix should be, from the parts the game loop already has.
 *
 * Lifted out of `Game.musicEnergy()` so the weighting is testable, and so the
 * progression term below is a decision someone can read rather than a constant
 * buried in the frame loop.
 *
 * `goalsDone` is the number of session goals completed *this run*. It is the only
 * term here that cannot go down: speed, altitude, fever and ring chain all fall
 * away when a flight goes badly, so a run that is achieving but slow used to sound
 * exactly like a run that is achieving nothing. Weighted last and smallest on
 * purpose — the clamp means it lifts quiet runs rather than pushing loud ones
 * louder, and progression should colour the score, not drive it.
 */
export function runEnergy(parts: {
  speed: number;
  alt: number;
  fever: boolean;
  danger: number;
  chain: number;
  goalsDone: number;
}): number {
  // Its own finite-guard rather than the module's clamp01, which passes NaN
  // through: a corrupt frame must not reach the audio graph as NaN energy.
  const finite01 = (v: number): number => (Number.isFinite(v) ? clamp01(v) : 0);
  const speed = finite01(parts.speed);
  const alt = finite01(parts.alt);
  const danger = finite01(parts.danger);
  const chain = finite01(parts.chain);
  const progress = finite01(parts.goalsDone / 6);
  return Math.min(
    1,
    speed * 0.35 + alt * 0.22 + (parts.fever ? 1 : 0) * 0.3 + danger * 0.12 + chain * 0.12 + progress * 0.12,
  );
}
