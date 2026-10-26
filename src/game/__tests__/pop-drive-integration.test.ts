// "Re-aiming the crest pop at forward speed must not touch the floor."
//
// `launchPopSplit` (see FlightPhysics) routes a share of the crest-release pop
// into `vx` instead of `vy`. The point of that change is to raise the
// expert/masher ratio in skill-gap.test.ts. The risk is the opposite direction:
// a term that pays a RELEASED bird for going faster is a term that pays a bird
// which never touches the button, because "released" and "gliding" are the same
// state. That was not hypothetical — it is exactly what the first attempt at
// this lever did, and it drove `mean(hold) > mean(coast) * 1.3` in
// skill-ceiling.test.ts from 1.370x to 1.221x while the headline ratio went UP.
//
// This file is the guard that stops that regression from ever being invisible
// again. It is deliberately NOT a distance-ratio assertion: it asserts the
// FLOOR, by measuring the two policies the split must not be able to reach.

import { afterEach, describe, expect, it } from "vitest";

import { Bird } from "../Bird";
import { LAUNCH_POP_DRIVE, LIVE_TUNE_DEFAULTS, PHYS_DT, applyLiveTune, type LiveTunable } from "../constants";
import { TerrainSystem } from "../TerrainSystem";

/** Restore every tunable to its compiled default, so no case leaks into another. */
function resetAll(): void {
  for (const key of Object.keys(LIVE_TUNE_DEFAULTS) as LiveTunable[]) {
    applyLiveTune(key, LIVE_TUNE_DEFAULTS[key]);
  }
}

afterEach(resetAll);

type Policy = (bird: Bird, terrain: TerrainSystem, t: number) => boolean;

/** Holds the button for the whole run. */
const HOLD: Policy = () => true;
/** Never touches the button. The true floor of the game. */
const COAST: Policy = () => false;
/** The pop-only policy skill-gap.test.ts calls `expert`. */
const POP_EXPERT: Policy = (bird, terrain) => terrain.slopeAt(bird.x) < 0;

const SEEDS = ["a", "b", "c", "d", "e", "f"];

function distance(policy: Policy, seed: string, seconds = 60): number {
  const terrain = new TerrainSystem(seed);
  const bird = new Bird();
  bird.reset(64, terrain.heightAt(64) + 0.9);
  const steps = Math.round(seconds / PHYS_DT);
  for (let i = 0; i < steps; i++) {
    bird.step(PHYS_DT, {
      diving: policy(bird, terrain, (i + 1) * PHYS_DT),
      fever: false,
      speedMult: 1,
      boost: false,
    }, terrain);
  }
  const x = bird.x;
  terrain.dispose();
  return x;
}

function everySeed(policy: Policy): number[] {
  return SEEDS.map((s) => distance(policy, s));
}

describe("the pop split cannot reach a pilot who never presses the button", () => {
  it("holding the button flies identically at every drive share", () => {
    // EXACT equality, not "about the same". The whole safety argument for
    // re-aiming the pop is that it is structurally unreachable by a
    // never-releasing bird: `launchPopQuality` is 0 while `releaseAge` is
    // `Infinity`, and `releaseAge` only leaves `Infinity` on a release edge.
    // A tolerance here would let a slow leak back in, and the leak is exactly
    // the defect this file exists to catch — so the assertion is bit-for-bit.
    applyLiveTune("LAUNCH_POP_DRIVE", 0);
    const baseline = everySeed(HOLD);
    for (const drive of [0.25, 0.5, 0.75, 1]) {
      applyLiveTune("LAUNCH_POP_DRIVE", drive);
      expect(
        everySeed(HOLD),
        `holding the button moved at LAUNCH_POP_DRIVE = ${drive}; the pop is leaking onto a pilot who never releases`,
      ).toEqual(baseline);
    }
  });

  it("never touching the button flies identically at every drive share", () => {
    // The sharper of the two, and the one that killed the first attempt. A
    // policy that only ever releases is 100% "released" by the usual reading of
    // the input, so any term gated on `!diving` hands it the largest possible
    // share. The pop is gated on something stricter, and this proves it.
    applyLiveTune("LAUNCH_POP_DRIVE", 0);
    const baseline = everySeed(COAST);
    for (const drive of [0.25, 0.5, 0.75, 1]) {
      applyLiveTune("LAUNCH_POP_DRIVE", drive);
      expect(
        everySeed(COAST),
        `coasting moved at LAUNCH_POP_DRIVE = ${drive}; the pop is paying a pilot who ignores the game`,
      ).toEqual(baseline);
    }
  });

  it("DOES move the pilot who releases — otherwise the lever does nothing", () => {
    // The other direction, and the one that would make the two assertions above
    // vacuous. If a change to the split ever stopped affecting the expert, both
    // "cannot reach" tests would keep passing while the feature quietly died.
    applyLiveTune("LAUNCH_POP_DRIVE", 0);
    const baseline = everySeed(POP_EXPERT);
    applyLiveTune("LAUNCH_POP_DRIVE", 0.5);
    expect(
      everySeed(POP_EXPERT),
      "re-aiming the pop did not move the releasing pilot — the lever is inert",
    ).not.toEqual(baseline);
  });

  it("the shipped share leaves real climb in the pop, so it is still a launch", () => {
    // The bound that is not about distance at all. skill-ceiling.test.ts's
    // "a perfectly timed release pops harder than a late one" measures APEX,
    // and it starts failing around drive 0.75: past roughly two thirds, the pop
    // is nearly all forward speed, a well-timed release stops producing a
    // higher arc, and the mechanic is no longer a launch. This asserts the
    // shipped value stays clear of that, in one place, with the reason.
    expect(LAUNCH_POP_DRIVE, "the pop must keep a majority of its energy as climb").toBeLessThanOrEqual(0.6);
    expect(LAUNCH_POP_DRIVE, "and must actually be re-aimed, not left inert").toBeGreaterThan(0);
  });
});