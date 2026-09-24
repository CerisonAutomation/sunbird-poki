/**
 * The comedy-moment score: what the band does when a beat lands.
 *
 * These are design contracts, not implementation details. Three of them exist
 * because the failure mode is audible and embarrassing:
 *
 *  - a moment with no reaction is a silent gap in the comedy language;
 *  - an unbounded parameter (a 30-second underwater sweep, a transpose into
 *    sub-audio) turns one splash into a broken speaker;
 *  - a reaction that slows the music down fights the one feeling the game is
 *    not allowed to lose: flying fast.
 */
import { describe, expect, it } from "vitest";

import { MOMENT_KINDS, type MomentKind } from "../Moments";
import {
  MUSIC_MOMENT_COOLDOWN_MS,
  MUSIC_MOMENT_GLOBAL_COOLDOWN_MS,
  MOMENT_MUSIC,
  MusicMomentGate,
  applyMusicActions,
  momentMusic,
  type MusicAction,
  type MusicReactionTarget,
} from "../MusicMoments";

/** Records calls instead of making sound. */
function recorder(): { calls: string[]; target: MusicReactionTarget } {
  const calls: string[] = [];
  const target: MusicReactionTarget = {
    duck: (amount, release) => calls.push(`duck(${amount},${release})`),
    sidechainPump: (amount, duration) => calls.push(`pump(${amount},${duration})`),
    faceplant: () => calls.push("faceplant"),
    underwater: (seconds) => calls.push(`underwater(${seconds})`),
    sparkle: (seconds) => calls.push(`sparkle(${seconds})`),
    pushIntensity: (delta, seconds) => calls.push(`push(${delta},${seconds})`),
    triggerBeatDrop: (mult) => calls.push(`beatDrop(${mult})`),
    triggerViralGlissando: () => calls.push("glissando"),
  };
  return { calls, target };
}

const ops = (kind: MomentKind): string[] => momentMusic(kind).map((a) => a.op);

describe("moment → music coverage", () => {
  it("gives every moment kind a reaction", () => {
    for (const kind of MOMENT_KINDS) {
      expect(momentMusic(kind).length, `${kind} must not be silent`).toBeGreaterThan(0);
      expect(MOMENT_MUSIC[kind]).toBeDefined();
    }
  });

  it("uses only operations the engine actually implements", () => {
    const allowed = new Set([
      "duck", "pump", "faceplant", "underwater", "sparkle", "push", "beatDrop", "glissando",
    ]);
    for (const kind of MOMENT_KINDS) {
      for (const action of momentMusic(kind)) expect(allowed.has(action.op), action.op).toBe(true);
    }
  });

  it.each([
    ["bonk", "faceplant"],
    ["splash", "underwater"],
    ["boing", "glissando"],
    ["perfect", "sparkle"],
    ["panic", "push"],
    ["sleep", "duck"],
    ["phew", "duck"],
  ] as const)("%s carries its signature gesture (%s)", (kind, op) => {
    expect(ops(kind)).toContain(op);
  });

  it("gives RECORD the full band: drop + glide + bells", () => {
    expect(ops("record")).toEqual(["beatDrop", "glissando", "sparkle"]);
  });
});

describe("moment → music parameters are bounded", () => {
  it("keeps every number inside what the Music primitives clamp to", () => {
    for (const kind of MOMENT_KINDS) {
      for (const a of momentMusic(kind)) {
        switch (a.op) {
          case "duck":
            expect(a.amount, `${kind} duck amount`).toBeGreaterThan(0);
            expect(a.amount).toBeLessThanOrEqual(0.9);
            expect(a.release).toBeGreaterThanOrEqual(0.05);
            expect(a.release).toBeLessThanOrEqual(3);
            break;
          case "pump":
            expect(a.amount, `${kind} pump amount`).toBeGreaterThan(0);
            expect(a.amount).toBeLessThanOrEqual(0.9);
            expect(a.duration).toBeGreaterThanOrEqual(0.02);
            expect(a.duration).toBeLessThanOrEqual(1);
            break;
          case "underwater":
            expect(a.seconds, `${kind} underwater`).toBeGreaterThanOrEqual(0.25);
            expect(a.seconds).toBeLessThanOrEqual(2.5);
            break;
          case "sparkle":
            expect(a.seconds, `${kind} sparkle`).toBeGreaterThanOrEqual(0.2);
            expect(a.seconds).toBeLessThanOrEqual(1.6);
            break;
          case "push":
            expect(a.delta, `${kind} push delta`).toBeGreaterThanOrEqual(-0.5);
            expect(a.delta).toBeLessThanOrEqual(0.6);
            expect(a.seconds).toBeGreaterThanOrEqual(0.2);
            expect(a.seconds).toBeLessThanOrEqual(4);
            break;
          case "beatDrop":
            expect(a.intensityMult, `${kind} beatDrop`).toBeGreaterThanOrEqual(0.5);
            expect(a.intensityMult).toBeLessThanOrEqual(2);
            break;
        }
      }
    }
  });

  it("never slows the flight down: only PHEW may pull intensity, and gently", () => {
    // The design rule from MusicMoments.ts. A comedy beat may stop the band for
    // a gesture, but the tempo/intensity floor belongs to the flight.
    for (const kind of MOMENT_KINDS) {
      const pushes = momentMusic(kind).filter((a): a is Extract<MusicAction, { op: "push" }> => a.op === "push");
      for (const p of pushes) {
        if (p.delta < 0) {
          expect(kind, "only PHEW exhales").toBe("phew");
          expect(p.delta).toBeGreaterThanOrEqual(-0.25);
          expect(p.seconds).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("keeps every recipe to three gestures or fewer", () => {
    // More than three simultaneous bus automations on one frame is a mix, not a
    // reaction — and it is what makes a moment sound like a crash.
    for (const kind of MOMENT_KINDS) expect(momentMusic(kind).length).toBeLessThanOrEqual(3);
  });
});

describe("applyMusicActions", () => {
  it("dispatches each operation to the matching engine method, in order", () => {
    const { calls, target } = recorder();
    applyMusicActions(target, [
      { op: "duck", amount: 0.35, release: 0.5 },
      { op: "pump", amount: 0.3, duration: 0.18 },
      { op: "faceplant" },
      { op: "underwater", seconds: 0.9 },
      { op: "sparkle", seconds: 0.55 },
      { op: "push", delta: 0.35, seconds: 1.2 },
      { op: "beatDrop", intensityMult: 1.1 },
      { op: "glissando" },
    ]);
    expect(calls).toEqual([
      "duck(0.35,0.5)",
      "pump(0.3,0.18)",
      "faceplant",
      "underwater(0.9)",
      "sparkle(0.55)",
      "push(0.35,1.2)",
      "beatDrop(1.1)",
      "glissando",
    ]);
  });

  it("plays the real BONK recipe as a pump then a face-plant", () => {
    const { calls, target } = recorder();
    applyMusicActions(target, momentMusic("bonk"));
    expect(calls).toEqual(["pump(0.55,0.28)", "faceplant"]);
  });

  it("does nothing for an empty recipe", () => {
    const { calls, target } = recorder();
    applyMusicActions(target, []);
    expect(calls).toEqual([]);
  });
});

describe("MusicMomentGate", () => {
  it("blocks a second gesture inside the global cooldown", () => {
    const gate = new MusicMomentGate();
    expect(gate.allow("bonk", 1000)).toBe(true);
    gate.mark("bonk", 1000);
    expect(gate.allow("splash", 1000 + MUSIC_MOMENT_GLOBAL_COOLDOWN_MS - 1)).toBe(false);
  });

  it("blocks the same kind inside its own cooldown, even after the global window", () => {
    const gate = new MusicMomentGate();
    gate.mark("panic", 1000);
    const afterGlobal = 1000 + MUSIC_MOMENT_GLOBAL_COOLDOWN_MS;
    expect(gate.allow("panic", afterGlobal)).toBe(false);
    expect(gate.allow("panic", 1000 + MUSIC_MOMENT_COOLDOWN_MS)).toBe(true);
  });

  it("lets a different kind react once the global window has passed", () => {
    const gate = new MusicMomentGate();
    gate.mark("bonk", 1000);
    expect(gate.allow("perfect", 1000 + MUSIC_MOMENT_GLOBAL_COOLDOWN_MS)).toBe(true);
  });

  it("rejects a non-finite clock", () => {
    const gate = new MusicMomentGate();
    expect(gate.allow("bonk", Number.NaN)).toBe(false);
    expect(gate.allow("bonk", Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("reset() clears both windows", () => {
    const gate = new MusicMomentGate();
    gate.mark("bonk", 5000);
    gate.reset();
    expect(gate.allow("bonk", 5001)).toBe(true);
  });

  it("is permissive enough that a real run's moments are all heard", () => {
    // Moments.ts already throttles reaction cadence (0.3/0.9/2.2/5 s per kind),
    // so the music gate must be the *cheaper* of the two guards: nothing that
    // survives the ledger should be silenced here.
    expect(MUSIC_MOMENT_GLOBAL_COOLDOWN_MS).toBeLessThanOrEqual(200);
    expect(MUSIC_MOMENT_COOLDOWN_MS).toBeLessThanOrEqual(500);
  });
});
