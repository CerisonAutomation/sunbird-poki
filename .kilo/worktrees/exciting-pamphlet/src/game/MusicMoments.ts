/**
 * What the score does when a comedy moment lands.
 *
 * The moment pipeline (`Moments.ts`) already wires eight beats to a shout, an
 * animation, a haptic pattern, a telemetry event, a result-card line and a next
 * action. Music was the one channel left out: the soundtrack played *under* a
 * BONK instead of *being* part of it. That is the difference between a game with
 * a soundtrack and a game with a band that is watching you play.
 *
 * The mapping is pure data over a closed set of operations, so:
 *
 *  - it is unit-testable with no WebAudio at all (`__tests__/music-moments.test.ts`);
 *  - every reaction is bounded (no unbounded transposes, no zero-length sweeps);
 *  - the engine stays free of moment knowledge — `Music` grows four primitives
 *    (`faceplant`, `underwater`, `sparkle`, `pushIntensity`) and never imports
 *    this file, so the audio graph has no dependency on gameplay semantics.
 *
 * Design rule behind every row: the reaction must never fight the feeling of
 * flying fast. Comedy beats get a *stop* or a *lift*, never a slow-down of the
 * underlying tempo; intensity pushes are short and decay on their own.
 */
import type { MomentKind } from "./Moments";

/** The operations a reaction may perform. Closed union: adding one is a design
 * decision, not a config change. */
export type MusicAction =
  /** Pull the whole score down for `release` seconds (space for an SFX). */
  | { op: "duck"; amount: number; release: number }
  /** One-beat sidechain pump — the "impact" bounce. */
  | { op: "pump"; amount: number; duration: number }
  /** Cartoon descending sag + hard duck: the score face-plants with you. */
  | { op: "faceplant" }
  /** Muffle the whole bus low, then surface again. */
  | { op: "underwater"; seconds: number }
  /** Rising glockenspiel run — a bright lift. */
  | { op: "sparkle"; seconds: number }
  /** Temporary intensity offset that decays back to the game-driven value. */
  | { op: "push"; delta: number; seconds: number }
  /** Sub-bass drop + pump: triumph, not tension. */
  | { op: "beatDrop"; intensityMult: number }
  /** Short upward transposition — the star-power glide. */
  | { op: "glissando" };

/** Per-kind reaction. Order matters: ducks and pumps land before lifts. */
export const MOMENT_MUSIC: Record<MomentKind, MusicAction[]> = {
  // BONK — the joke of the game. The band stops being impressed: one hard pump
  // to clear the mix, then the descending sag. Never a tempo change.
  bonk: [
    { op: "pump", amount: 0.55, duration: 0.28 },
    { op: "faceplant" },
  ],
  // SPLOSH — the world goes underwater, then the bird surfaces. A filter sweep
  // is the only honest way to say "you are in the sea" with a synth.
  splash: [
    { op: "duck", amount: 0.35, release: 0.5 },
    { op: "underwater", seconds: 0.9 },
  ],
  // BOING — launch. Transpose up, push intensity, one pump of launch energy.
  // This is the beat that must feel FAST, so it gets the biggest push.
  boing: [
    { op: "glissando" },
    { op: "pump", amount: 0.3, duration: 0.18 },
    { op: "push", delta: 0.35, seconds: 1.2 },
  ],
  // PHEW — the exhale after a near miss. Pull intensity down briefly and give
  // the SFX room; the score relaxes its shoulders.
  phew: [
    { op: "duck", amount: 0.3, release: 0.35 },
    { op: "push", delta: -0.2, seconds: 0.8 },
  ],
  // PERFECT — a bell lift. Small push so the player feels the run tighten.
  perfect: [
    { op: "sparkle", seconds: 0.55 },
    { op: "push", delta: 0.15, seconds: 0.9 },
  ],
  // PANIC — the heart-rate beat: push intensity hard and pump twice-worth of
  // bounce in one call. No transposition down; a panic that sounds sad reads as
  // defeat, and the run is still alive.
  panic: [
    { op: "push", delta: 0.45, seconds: 1.6 },
    { op: "pump", amount: 0.4, duration: 0.25 },
  ],
  // SLEEP — the mode switch to the music-box lullaby is the real change
  // (Game.ts sets `sleep`); this just clears the mix for it.
  sleep: [{ op: "duck", amount: 0.45, release: 0.8 }],
  // WEE — the speed beat. Everything rises: a short upward transposition, a
  // bell run and an intensity push, so the score leans into the dive the player
  // just enjoyed. No duck and no pump — this moment must never read as impact.
  wee: [
    { op: "glissando" },
    { op: "sparkle", seconds: 0.4 },
    { op: "push", delta: 0.3, seconds: 1.1 },
  ],
  // RECORD — the whole band: sub drop, star glide, bell run. The loudest thing
  // the score is allowed to do, because it only happens once per record.
  record: [
    { op: "beatDrop", intensityMult: 1.1 },
    { op: "glissando" },
    { op: "sparkle", seconds: 0.8 },
  ],
};

/** Every kind must have a reaction; an empty array would be a silent gap in the
 * comedy language. Exported so the test can assert coverage over `MOMENT_KINDS`. */
export function momentMusic(kind: MomentKind): MusicAction[] {
  return MOMENT_MUSIC[kind] ?? [];
}

/**
 * Per-kind cooldown. `Moments.ts` already throttles whether a beat reacts at
 * all; this is the second, cheaper guard so a burst of moments cannot stack
 * six filter sweeps on the same audio bus. Deliberately shorter than the moment
 * cadence: the music may react to every moment that survives the ledger.
 */
export const MUSIC_MOMENT_COOLDOWN_MS = 450;
/** Global floor between any two reactions, so two kinds firing on the same
 * frame produce one musical gesture rather than a chord of gestures. */
export const MUSIC_MOMENT_GLOBAL_COOLDOWN_MS = 180;

/**
 * Throttle for musical reactions.
 *
 * `Moments.ts` decides whether a beat reacts at all (shout, popup, haptic,
 * telemetry). This is the second, cheaper guard on the audio bus: a beached bird
 * can fire PANIC on consecutive frames, and six stacked filter sweeps sound like
 * a broken speaker rather than like panic. A class rather than module state so
 * two audio engines (tests, a future editor) cannot share a clock.
 */
export class MusicMomentGate {
  private lastAt = Number.NEGATIVE_INFINITY;
  private readonly byKind = new Map<MomentKind, number>();

  /** True when this kind may react at `now` (ms on any monotonic clock). */
  allow(kind: MomentKind, now: number): boolean {
    if (!Number.isFinite(now)) return false;
    if (now - this.lastAt < MUSIC_MOMENT_GLOBAL_COOLDOWN_MS) return false;
    const last = this.byKind.get(kind);
    if (last !== undefined && now - last < MUSIC_MOMENT_COOLDOWN_MS) return false;
    return true;
  }

  /** Record a reaction that actually played. Separate from `allow` so a caller
   * that decides to stay quiet (muted, no music engine) does not burn the slot. */
  mark(kind: MomentKind, now: number): void {
    this.lastAt = now;
    this.byKind.set(kind, now);
  }

  reset(): void {
    this.lastAt = Number.NEGATIVE_INFINITY;
    this.byKind.clear();
  }
}

/** The slice of the music engine a reaction may touch. `Music` satisfies this
 * structurally; tests supply a recorder. */
export interface MusicReactionTarget {
  duck(amount?: number, release?: number): void;
  sidechainPump(duckAmount?: number, duration?: number): void;
  faceplant(): void;
  underwater(seconds?: number): void;
  sparkle(seconds?: number): void;
  pushIntensity(delta: number, seconds: number): void;
  triggerBeatDrop(intensityMult?: number): void;
  triggerViralGlissando(): void;
}

/** Apply a recipe. Pure dispatch — no timing, no state, nothing to mock beyond
 * the target itself. */
export function applyMusicActions(target: MusicReactionTarget, actions: MusicAction[]): void {
  for (const a of actions) {
    switch (a.op) {
      case "duck":
        target.duck(a.amount, a.release);
        break;
      case "pump":
        target.sidechainPump(a.amount, a.duration);
        break;
      case "faceplant":
        target.faceplant();
        break;
      case "underwater":
        target.underwater(a.seconds);
        break;
      case "sparkle":
        target.sparkle(a.seconds);
        break;
      case "push":
        target.pushIntensity(a.delta, a.seconds);
        break;
      case "beatDrop":
        target.triggerBeatDrop(a.intensityMult);
        break;
      case "glissando":
        target.triggerViralGlissando();
        break;
    }
  }
}
