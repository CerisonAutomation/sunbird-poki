/**
 * RivalGhost — a chase target for every solo flight.
 *
 * The audit's point was blunt: *rival ghosts must be unavoidable*. A flight
 * game with a rival in it is a race; the same flight without one is a commute.
 * The real-player ghost (`GhostNet.fetchRivalGhost`) is the best answer and it
 * already exists — but it needs a populated backend, and on a portal build, a
 * cold cache, or a dead network it returns nothing. A player whose very first
 * flights happen to be the ones with no population is exactly the player the
 * loop has to win.
 *
 * So this module builds the fallback: a **pace ghost**. It is a deterministic,
 * physically plausible flight over the *same hills*, generated from the seed,
 * aimed at a target distance. It dives, it soars, it loses speed in the climbs
 * and gains it in the drops, because that is what makes it readable as a bird
 * rather than a sliding icon.
 *
 * Two honesty rules, both load-bearing:
 *
 *   1. It is never presented as a person. The name is the pace label
 *      (`paceName`), the toast says "pace", and `isSynthetic` is exported so
 *      the UI cannot accidentally claim a real pilot flew it.
 *   2. It never changes what the player earned. A pace ghost is a reference
 *      line; ratings, leaderboards and duel results stay out of it.
 */
import { clamp, SeededRandom } from "./math";
import { GHOST_MAX_SAMPLES, GHOST_SAMPLE_DT } from "./constants";
import type { GhostRecord } from "./Ghost";

/** The slice of `TerrainSystem` this needs (kept structural so it stays testable). */
export type PaceTerrain = {
  heightAt(x: number): number;
  slopeAt(x: number): number;
};

export type PaceGhostOptions = {
  /** World seed — the same hills the player is about to fly. */
  seed: string;
  /** Where the run starts, in world metres. */
  startX: number;
  /** Target flight distance in metres; the ghost stops when it gets there. */
  distance: number;
  terrain: PaceTerrain;
  /**
   * 0..1 how clean the flying is. Low = sloppy hops and slow cruise, high =
   * tight dive/soar timing and a fast average. Defaults to a middling pilot so
   * the ghost is beatable but never trivially so.
   */
  skill?: number;
};

export type PaceGhost = {
  record: GhostRecord;
  /** Display name — always obviously a pace target, never a fake person. */
  name: string;
  /** Metres actually flown (may fall just short of the target). */
  distance: number;
  /** Seconds of flight, so the UI can say "catch it before 1:20". */
  seconds: number;
  /** Always true: this ghost was generated, not flown by somebody. */
  isSynthetic: true;
};

/** Cruise speeds by skill, in m/s — matches the player's own speed envelope. */
const CRUISE_MIN = 26;
const CRUISE_MAX = 46;
const MAX_TIME = 240;

/**
 * Generates the pace ghost.
 *
 * The model is one dive/soar oscillator with the same qualitative behaviour as
 * the real bird: diving trades altitude for speed, soaring trades speed for
 * altitude, and terrain slope feeds both. It is not the game's physics (that
 * would need the whole `Bird` + fixed-step loop); it only has to be *readable*
 * as a competent flight over these hills, at roughly this distance, in roughly
 * this time.
 */
export function synthesizePaceGhost(opts: PaceGhostOptions): PaceGhost {
  const skill = clamp(opts.skill ?? 0.55, 0, 1);
  const rng = new SeededRandom(`${opts.seed}:pace`);
  const target = Math.max(120, opts.distance);

  // Per-seed personality: hop rhythm, how aggressively it dives, and how high
  // it likes to fly. Same seed → same ghost, so two players racing "today's
  // hills" chase the identical pace line (and can compare honestly).
  const flapFreq = 0.55 + rng.next() * 0.5 + skill * 0.35;
  const diveGain = 16 + rng.next() * 8 + skill * 10;
  const soarGain = 8 + rng.next() * 5 + skill * 6;
  const cruise = CRUISE_MIN + (CRUISE_MAX - CRUISE_MIN) * skill + rng.next() * 4;
  const preferredAlt = 5 + rng.next() * 6 + skill * 8;
  const phase = rng.next() * Math.PI * 2;

  const samples: [number, number, number, number][] = [];
  let x = opts.startX;
  let v = cruise * 0.7;
  let alt = 4;
  let t = 0;

  while (x - opts.startX < target && t < MAX_TIME && samples.length < GHOST_MAX_SAMPLES) {
    // One sample per GHOST_SAMPLE_DT, exactly like GhostRecorder.
    samples.push([
      Math.round(t * 100) / 100,
      Math.round(x * 10) / 10,
      Math.round((opts.terrain.heightAt(x) + alt) * 10) / 10,
      Math.round(clamp(-v * 0.006 - opts.terrain.slopeAt(x) * 0.25, -0.7, 0.7) * 100) / 100,
    ]);

    // Dive/soar control: a skilled ghost dives when it is high and slow, soars
    // when it is low and fast — the actual rule players learn.
    const osc = Math.sin(t * flapFreq * Math.PI + phase);
    const wantDive = alt > preferredAlt ? 1 : alt < 2.5 ? -1 : osc;
    const slope = opts.terrain.slopeAt(x);
    if (wantDive > 0) {
      v += diveGain * GHOST_SAMPLE_DT;
      // Downhill diving is the jackpot; the ghost knows it.
      v += Math.max(0, -slope) * 26 * GHOST_SAMPLE_DT;
      alt -= Math.max(2, v * 0.22) * GHOST_SAMPLE_DT;
    } else {
      v -= soarGain * GHOST_SAMPLE_DT * 0.6;
      v += Math.max(0, -slope) * 12 * GHOST_SAMPLE_DT;
      alt += Math.max(1.5, v * 0.16) * GHOST_SAMPLE_DT;
    }

    // Speed bleeds toward cruise so a long flight neither stalls nor runs away.
    v += (cruise - v) * 0.35 * GHOST_SAMPLE_DT;
    v = clamp(v, 18, 78);
    alt = clamp(alt, 1.2, 46);
    x += v * GHOST_SAMPLE_DT;
    t += GHOST_SAMPLE_DT;
  }

  // A trailing sample at the finish keeps the ghost visible at the moment the
  // player overtakes it, instead of popping out of existence early.
  if (samples.length > 1) {
    const last = samples[samples.length - 1]!;
    samples.push([
      Math.round((last[0] + GHOST_SAMPLE_DT) * 100) / 100,
      Math.round(x * 10) / 10,
      Math.round((opts.terrain.heightAt(x) + alt) * 10) / 10,
      last[3],
    ]);
  }

  const distance = Math.max(0, Math.round(x - opts.startX));
  return {
    record: { seed: opts.seed, distance, samples },
    name: paceName(distance),
    distance,
    seconds: Math.round(t),
    isSynthetic: true,
  };
}

/**
 * The pace label. Deliberately not a person's name: a generated rival that
 * claims to be "Mika from Berlin" is a lie the player will eventually catch,
 * and the day they do, every rival in the game becomes suspect.
 */
export function paceName(distance: number): string {
  return `Pace \u00b7 ${distance.toLocaleString("en-US")} m`;
}

/**
 * Which target distance to aim the pace ghost at, from the player's own record.
 *
 * Just ahead of personal best is the motivating band: close enough to catch,
 * far enough to matter. A brand-new player (no record) gets a short, winnable
 * first race — the first flight should end with the player *ahead*, because
 * that is the feeling that makes somebody tap Fly Again.
 */
export function paceTargetDistance(personalBest: number, rng: () => number = Math.random): number {
  if (personalBest <= 0) return 320 + Math.round(rng() * 120);
  // 102%..112% of best: beatable with one clean run, never a walkover.
  const stretch = 1.02 + rng() * 0.1;
  return Math.round(personalBest * stretch);
}
