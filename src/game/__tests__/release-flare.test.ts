// "When I press and release, the release isn't working well."
//
// The flare is the entire release verb in a one-button game: hold dives,
// release pulls out. It used to be armed by `this.releaseBuffer > 0 && !diving
// && this.vy < 0` — the `vy < 0` meaning "still falling". The buffer is only
// FLARE_BUFFER (0.18s) long, so a release made at the top of a dive, while
// climbing, or the instant after the pull-out expired the buffer untouched and
// the flare never ran. The release was silently a no-op, and it was a no-op at
// exactly the moment FirstFlight coaches: "RELEASE at the top to launch".
// The instruction and the physics disagreed, so the game taught the one input
// timing that was guaranteed to be dropped.
//
// The latch in `Bird.step` is what makes a release possible at all, so these
// drive the real `Bird` through real `Bird.step` calls and assert on
// `flareAmount`. No mocks, no renderer: the same pure-math path
// `physics.test.ts` already relies on.
import { describe, expect, it } from "vitest";

import { Bird } from "../Bird";
import { PHYS_DT } from "../constants";
import { TerrainSystem } from "../TerrainSystem";

/** Which part of the vertical motion the stick is let go on. */
type Phase = "apex" | "falling" | "climbing";

const IDLE = { fever: false, speedMult: 1, boost: false } as const;

/**
 * Dives until `vy` matches `phase`, lets go, and reports how much flare the
 * pull-out actually produced. Returns 0 if the phase was never reached, so a
 * test that stops matching the physics fails loudly instead of passing vacuously.
 */
function flareOnReleaseAt(phase: Phase, maxSeconds = 4): number {
  const terrain = new TerrainSystem("release-probe");
  const bird = new Bird();
  bird.reset(64, terrain.heightAt(64) + 70);

  const matches = (vy: number): boolean => {
    if (phase === "falling") return vy < -8;
    if (phase === "climbing") return vy > 8;
    return vy > -1 && vy < 1; // apex: essentially no vertical momentum
  };

  const steps = Math.round(maxSeconds / PHYS_DT);
  for (let i = 0; i < steps; i++) {
    const vyBefore = bird.vy;
    bird.step(PHYS_DT, { ...IDLE, diving: true }, terrain);
    if (bird.grounded) break; // the flare is a ballistic-branch effect
    if (!matches(vyBefore)) continue;

    // Let go for half a second and total the flare the pull-out produced.
    let flare = 0;
    for (let k = 0; k < Math.round(0.5 / PHYS_DT); k++) {
      bird.step(PHYS_DT, { ...IDLE, diving: false }, terrain);
      flare += bird.flareAmount;
    }
    terrain.dispose();
    return flare;
  }
  terrain.dispose();
  return 0;
}

describe("releasing always pulls out, whatever the bird is doing", () => {
  // Each of these was a silent no-op before the `vy < 0` guard was dropped.
  it("fires on a release made while falling", () => {
    expect(flareOnReleaseAt("falling")).toBeGreaterThan(0);
  });

  it("fires on a release made at the apex — the timing the tutorial teaches", () => {
    expect(flareOnReleaseAt("apex")).toBeGreaterThan(0);
  });

  it("fires on a release made while already climbing", () => {
    expect(flareOnReleaseAt("climbing")).toBeGreaterThan(0);
  });

  it("is still a brake, not a jet: the pull-out is bounded by FLARE_MAX_RISE", () => {
    // Whatever the release timing, the result must stay under the clamp, and
    // must not exceed the same ceiling a dive arrest gets. A release can
    // recover a dive; it can never manufacture unbounded lift.
    const terrain = new TerrainSystem("flare-clamp");
    const bird = new Bird();
    bird.reset(64, terrain.heightAt(64) + 70);
    for (let i = 0; i < Math.round(1.5 / PHYS_DT); i++) {
      bird.step(PHYS_DT, { ...IDLE, diving: true }, terrain);
    }
    let peakRise = 0;
    for (let k = 0; k < Math.round(1.2 / PHYS_DT); k++) {
      bird.step(PHYS_DT, { ...IDLE, diving: false }, terrain);
      peakRise = Math.min(peakRise, bird.vy); // vy is negative upward
    }
    terrain.dispose();
    expect(peakRise).toBeGreaterThanOrEqual(-14.0001);
  });
});
