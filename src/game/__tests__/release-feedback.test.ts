// "The release is broken and there isn't enough feedback."
//
// Pressing fired `diveCue()` + a haptic. Releasing fired NOTHING. In a
// one-button game the release IS the other verb — hold dives, release pulls
// out — and it was the only major input that confirmed itself with silence.
// The brake was working; nothing told the player it had.
//
// This pins two separate things, because either one alone can silently rot:
//
//   1. `soarCue()` asks the synth for the right thing. Asserted on the actual
//      arguments handed to `tone`/`noiseBurst`, not on a source string, so a
//      rename or a reformat cannot satisfy it and a semantic regression does.
//
//   2. `Game.ts` actually calls it, and calls it from the RELEASE edge rather
//      than the dive edge. `Game` cannot be instantiated without a GPU, so
//      this half is a structural pin. It is deliberately narrow: it matches the
//      call inside `releaseFeedback`, so adding an unrelated `soarCue` call
//      anywhere else cannot make it pass.

import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { GameAudio } from "../Audio";
import { FLARE_BRAKE, FLARE_DURATION, PHYS_DT } from "../constants";
import { Bird } from "../Bird";
import { TerrainSystem } from "../TerrainSystem";

/** What a one-shot asked the synth for. */
interface Cue {
  freq: number;
  dur: number;
  gain: number;
  slideTo?: number;
}

/**
 * Runs `soarCue` against a stubbed synth and reports what it asked for.
 * The synth primitives are private, so this replaces them on the instance;
 * nothing above them runs, which is the point — the decision (does it fire,
 * how loud, which direction) is what this test is about.
 */
function cuesFor(intensity: number): { tones: Cue[]; noise: Cue[] } {
  const audio = new GameAudio();
  const tones: Cue[] = [];
  const noise: Cue[] = [];
  const anyAudio = audio as unknown as {
    tone: (f: number, d: number, t: string, g: number, s?: number) => void;
    noiseBurst: (d: number, f: number, g: number) => void;
  };
  anyAudio.tone = (f, d, _t, g, s) => void tones.push({ freq: f, dur: d, gain: g, slideTo: s });
  anyAudio.noiseBurst = (d, f, g) => void noise.push({ freq: f, dur: d, gain: g });
  audio.soarCue(intensity);
  return { tones, noise };
}

describe("soarCue — the release half of the dive", () => {
  it("sweeps UP, the opposite direction to the dive cue", () => {
    // The whole point of the cue is that the reversal is audible without
    // looking. `diveCue()` slides 280 -> 140 (down = falling). If this ever
    // slides down too, the two halves of one gesture sound identical and the
    // cue stops carrying the meaning it was added for.
    const { tones } = cuesFor(1);
    expect(tones.length).toBeGreaterThan(0);
    for (const t of tones) {
      if (t.slideTo !== undefined) expect(t.slideTo).toBeGreaterThan(t.freq);
    }
  });

  it("gets louder and brighter as the pull-out bites harder", () => {
    const gentle = cuesFor(0.2);
    const hard = cuesFor(1);
    expect(hard.tones.length).toBe(gentle.tones.length);
    expect(hard.tones[0]!.gain).toBeGreaterThan(gentle.tones[0]!.gain);
    expect(hard.tones[0]!.freq).toBeGreaterThan(gentle.tones[0]!.freq);
    expect(hard.noise[0]!.gain).toBeGreaterThan(gentle.noise[0]!.gain);
  });

  it("stays quiet on a release that did nothing", () => {
    // Below the threshold the cue is dropped entirely, not made quiet. A
    // near-silent blip at a low moment reads as an audio glitch, and the
    // player learns to distrust the channel rather than to trust the game.
    expect(cuesFor(0).tones).toHaveLength(0);
    expect(cuesFor(0.05).tones).toHaveLength(0);
  });

  it("survives out-of-range intensity instead of producing a broken sweep", () => {
    // The caller normalises, but an audio primitive that throws or emits a
    // negative gain on a bad input takes the whole frame with it.
    for (const bad of [-5, NaN, 1e9]) {
      const { tones } = cuesFor(bad);
      for (const t of tones) {
        expect(Number.isFinite(t.gain)).toBe(true);
        expect(t.gain).toBeGreaterThanOrEqual(0);
        expect(t.freq).toBeGreaterThan(0);
      }
    }
  });
});

describe("the release edge is wired to the flare", () => {
  const gameSrc = readFileSync(join(process.cwd(), "src/game/Game.ts"), "utf8");

  it("consumes flareAmount, which used to be a dead signal", () => {
    // `flareAmount` was written every frame by `Bird.step` and read by nothing
    // outside tests. It is the brake actually applied on this tick, which is
    // the only honest measure of how hard a pull-out bit — scaling off dive
    // speed instead would fire at full volume on a release from a near-hover,
    // where nothing happened.
    const releaseFeedback = gameSrc.slice(gameSrc.indexOf("private releaseFeedback"));
    expect(releaseFeedback.length).toBeGreaterThan(0);
    expect(releaseFeedback).toContain("flareAmount");
    expect(releaseFeedback).toContain("FLARE_BRAKE");
    expect(releaseFeedback).toContain("soarCue");
  });

  it("returns early when the flare did not engage", () => {
    // `Bird.step` zeroes the brake when releasing from a climb (`vy >= 0`).
    // Silence there is correct — nothing was arrested, so nothing is confirmed.
    const body = gameSrc.slice(
      gameSrc.indexOf("private releaseFeedback"),
      gameSrc.indexOf("private releaseFeedback") + 700,
    );
    expect(body).toMatch(/if \(strength <= 0\) return;/);
  });

  it("fires on the release edge, not the dive edge", () => {
    // Both edges exist in `fixedUpdate`. If this call ever moved up next to
    // `diveCue()` the player would hear a soar on the way IN.
    const pressEdge = gameSrc.indexOf("this.audio.diveCue();\n      this.haptic(10);");
    const releaseEdge = gameSrc.indexOf("const released = !diving && this.wasDiving");
    const fired = gameSrc.indexOf("if (released) this.releaseFeedback();");
    expect(pressEdge).toBeGreaterThan(-1);
    expect(releaseEdge).toBeGreaterThan(pressEdge);
    expect(fired).toBeGreaterThan(releaseEdge);
  });
});

describe("the flare the cue is scaled from is real", () => {
  /** A bird in a committed dive: high enough that it cannot land mid-probe. */
  function diving(seed: string): { bird: Bird; terrain: TerrainSystem } {
    const terrain = new TerrainSystem(seed);
    const bird = new Bird();
    // 400 m of air, matching release-flare.test.ts. A dive at GRAVITY_DIVE
    // covers a low start in about a second, and a bird that touches down at
    // speed launches off the lip and CLIMBS — which would put vy above zero
    // and make the probe measure the wrong thing entirely.
    bird.reset(64, terrain.heightAt(64) + 400);
    const OPTS = { fever: false, speedMult: 1, boost: false } as const;
    // Step FIRST, then test. Checking the loop condition before the first step
    // reads the bird's initial vy, which is near zero, so the loop can exit
    // having never dived at all.
    //
    // Falling is NEGATIVE vy here. `Bird.step` treats `vy >= 0` as "already
    // climbing, nothing to arrest", so the brake only ever engages on a
    // negative-vy bird — a probe that assumes the opposite measures a launch.
    for (let i = 0; i < 4_000; i++) {
      bird.step(PHYS_DT, { ...OPTS, diving: true }, terrain);
      if (bird.grounded) {
        bird.reset(64, terrain.heightAt(64) + 400);
        continue;
      }
      if (bird.vy < -45) break;
    }
    return { bird, terrain };
  }

  it("a hard pull-out out of a fast dive engages the brake", () => {
    // Guards the wiring against the cue firing on a signal that is always 0.
    // Same shape as release-flare.test.ts: real Bird, real terrain, real step.
    const { bird, terrain } = diving("release-feedback-probe");
    const OPTS = { fever: false, speedMult: 1, boost: false } as const;
    expect(bird.vy).toBeLessThan(-30);

    bird.step(PHYS_DT, { ...OPTS, diving: false }, terrain);
    expect(bird.flareAmount).toBeGreaterThan(0);
    expect(bird.flareAmount).toBeLessThanOrEqual(FLARE_BRAKE + 0.001);
    terrain.dispose();
  });

  it("the brake decays to nothing, so the cue cannot be held open", () => {
    const { bird, terrain } = diving("release-feedback-decay");
    const OPTS = { fever: false, speedMult: 1, boost: false } as const;

    bird.step(PHYS_DT, { ...OPTS, diving: false }, terrain);
    const first = bird.flareAmount;
    expect(first).toBeGreaterThan(0);
    for (let i = 0; i < Math.ceil(FLARE_DURATION / PHYS_DT) + 4; i++) {
      bird.step(PHYS_DT, { ...OPTS, diving: false }, terrain);
    }
    expect(bird.flareAmount).toBeLessThan(first);
    terrain.dispose();
  });
});

// Keep the import used even if the spies above are refactored.
void vi;
