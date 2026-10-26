// `launchPopSplit` — the crest pop's energy split.
//
// A refactor moved the pop out of `Bird.step` (which used to do
// `this.vy += LAUNCH_POP_MAX * timing * speedFactor`) into this function so the
// payout could be re-aimed at forward speed without touching the launch code
// again. The load-bearing property is therefore NEGATIVE: at drive 0 the split
// must reproduce the old line exactly, or every seeded flight in physics.test.ts
// silently changes.
//
// That identity is asserted first, and on its own, because it is the one case
// that cannot be re-derived from the rest: the other cases describe what the
// drive share does, and would all still pass if the identity broke.
//
// Nothing here pins the SHIPPED value of `LAUNCH_POP_DRIVE`. It is a live tunable
// that has already been retuned once since this function was written, and a test
// that asserted the number would fail on every retune without saying anything
// about the split. The cases below assert the identity, the conservation law,
// the clamps and the live-read instead.

import { afterEach, describe, expect, it } from "vitest";
import { LAUNCH_POP_MAX, LIVE_TUNE_DEFAULTS, applyLiveTune, type LiveTunable } from "../constants";
import { launchPopSplit } from "../FlightPhysics";

/** Restore every tunable to its compiled default, so no case leaks into another. */
function resetAll(): void {
  for (const key of Object.keys(LIVE_TUNE_DEFAULTS) as LiveTunable[]) {
    applyLiveTune(key, LIVE_TUNE_DEFAULTS[key]);
  }
}

afterEach(resetAll);

describe("launchPopSplit", () => {
  it("at drive 0 reproduces the pre-refactor line exactly", () => {
    // `Bird.step` used to add the whole pop to `vy`. Drive 0 is passed
    // explicitly rather than relying on the default, so this case keeps testing
    // the pre-refactor behaviour no matter where the tunable currently sits.
    for (const pop of [0, 1, 13.5, LAUNCH_POP_MAX]) {
      const split = launchPopSplit(pop, 0);
      expect(split.vy, `pop = ${pop}`).toBeCloseTo(pop, 10);
      expect(split.vx, `pop = ${pop}`).toBeCloseTo(0, 10);
    }
  });

  it("conserves the payout: vy and vx always sum back to the pop", () => {
    // The premise is re-aiming one energy budget, not minting more of it. If
    // this drifts, raising `LAUNCH_POP_MAX` stops meaning what its comment says.
    const pop = LAUNCH_POP_MAX;
    for (const drive of [0, 0.1, 0.25, 0.5, 0.65, 0.75, 0.9, 1]) {
      const { vy, vx } = launchPopSplit(pop, drive);
      expect(vy + vx, `drive = ${drive}`).toBeCloseTo(pop, 10);
    }
  });

  it("pays nothing forward at drive 0 and nothing upward at drive 1", () => {
    expect(launchPopSplit(26, 0)).toEqual({ vy: 26, vx: 0 });
    expect(launchPopSplit(26, 1)).toEqual({ vy: 0, vx: 26 });
  });

  it("clamps a drive share outside 0..1", () => {
    // `AdminStore` sliders are bounded, but `applyLiveTune` is not, and a
    // negative drive would pay a launch OUT of upward speed — the pop would
    // fight the crest it is meant to reward.
    expect(launchPopSplit(26, -3)).toEqual({ vy: 26, vx: 0 });
    expect(launchPopSplit(26, 4)).toEqual({ vy: 0, vx: 26 });
  });

  it("reads LAUNCH_POP_DRIVE at call time, so the panel moves the next frame", () => {
    // The default parameter has to resolve per call. Captured at import time it
        // would silently ignore the live tuner and the knob would look broken.
        // Two different values, asserted against the default-argument call form.
        for (const drive of [0.2, 0.9]) {
          applyLiveTune("LAUNCH_POP_DRIVE", drive);
          expect(launchPopSplit(26).vx, `drive = ${drive}`).toBeCloseTo(26 * drive, 10);
          expect(launchPopSplit(26).vy, `drive = ${drive}`).toBeCloseTo(26 * (1 - drive), 10);
        }
  });

  it("is linear in the pop", () => {
    for (const drive of [0, 0.3, 1]) {
      expect(launchPopSplit(20, drive).vx, `drive = ${drive}`).toBeCloseTo(launchPopSplit(10, drive).vx * 2, 10);
    }
  });
});
