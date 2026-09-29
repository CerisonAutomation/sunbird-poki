import { describe, expect, it } from "vitest";

import { Bird } from "../Bird";
import { GLIDE_LIFT_MAX, GRAVITY_GLIDE } from "../constants";
import { glideLiftScale } from "../FlightPhysics";
import { TerrainSystem } from "../TerrainSystem";

/**
 * What "hold to dive, release to soar" actually does, measured.
 *
 * A HUD/game-feel review flagged the release as feeling like a jolt, and the
 * natural reading is "the transition is too abrupt". Measured, the problem is
 * more specific and more serious than that: the release is not abrupt, it is
 * INERT. A one-second dive puts the bird at roughly -95 m/s, and half a second
 * after letting go it is going FASTER, not slower.
 *
 * Lift in this model is a *reduction* of downward gravity, never an upward
 * force. So the strongest thing the game can do at full lift is take
 * GRAVITY_GLIDE from 16 down to 8.8 m/s². There is no input, power-up or
 * surface in the codebase that produces a net upward acceleration from a dive.
 * The dive is a one-way door.
 *
 * The last frame of a dive and the first frame of a glide differ by ~87 m/s² of
 * vertical acceleration while vertical velocity is untouched. That is why it
 * *feels* like a jolt: the bird stops accelerating downward and simply coasts
 * at dive speed into whatever is next. It is not a bug in the sense of a wrong
 * value — it is a missing mechanic.
 *
 * This file pins the CURRENT behaviour precisely, so the day a flare is added
 * the change is visible in one diff and one failing assertion rather than
 * showing up as "scores feel different" weeks later. The assertions describe
 * what the game does, and are written to FAIL if a flare starts working —
 * that is the point: the day it changes, someone has to decide whether they
 * meant to.
 */

const DT = 1 / 120;
const terrain = new TerrainSystem("dive-recovery-probe");

const DIVE = { diving: true, fever: false, speedMult: 1, boost: false } as const;
const GLIDE = { diving: false, fever: false, speedMult: 1, boost: false } as const;

/** Hold a clean dive for `seconds` in clear air, high enough never to land. */
function dive(seconds: number): Bird {
  const b = new Bird();
  b.reset(0, 900);
  b.vx = 40;
  b.vy = 0;
  for (let t = 0; t < seconds; t += DT) b.step(DT, DIVE, terrain);
  expect(b.grounded, "the probe dive must stay airborne").toBe(false);
  return b;
}

describe("dive — the bird reaches terminal dive speed", () => {
  it("a one-second hold is already near the speed cap", () => {
    const b = dive(1.0);
    expect(b.vy).toBeLessThan(-80);
    expect(b.speed()).toBeGreaterThan(90);
  });

  it("is deterministic: the same hold produces the same state", () => {
    expect(dive(1.0).vy).toBe(dive(1.0).vy);
  });
});

describe("release — the current behaviour, measured", () => {
  it("does not slow the dive at all within half a second", () => {
    const b = dive(1.0);
    const atRelease = b.vy;
    for (let t = 0; t < 0.5; t += DT) b.step(DT, GLIDE, terrain);
    // A brake would make this number SMALLER (less negative). It is larger:
    // the glide adds drag-reduced gravity that still pulls down, and nothing
    // anywhere in the model pushes back.
    expect(b.vy, "release is inert — this is the finding, not a wish").toBeLessThan(atRelease);
  });

  it("can never produce an upward acceleration, by construction", () => {
    // Lift multiplies gravity by (1 - lift), so the best case is a *reduction*
    // of the glide pull. There is no sign flip anywhere in the flight branch.
    // Net vertical acceleration at the strongest lift the game can produce.
    // It is still POSITIVE, i.e. still downward: full lift buys a reduction
    // from 16 to ~8.8 m/s^2, never a sign flip. A flare needs a term this
    // model does not have.
    const strongest = GRAVITY_GLIDE * (1 - GLIDE_LIFT_MAX * glideLiftScale(0));
    expect(strongest).toBeGreaterThan(0);
    // And lift is a fraction, so (1 - lift) can never reach zero from this
    // term alone.
    expect(GLIDE_LIFT_MAX).toBeLessThan(1);
  });

  it("the felt jolt is the acceleration step, not a velocity step", () => {
    // Velocity is continuous across the release — that part is correct. What
    // changes by ~87 m/s^2 in one frame is the vertical ACCELERATION, which is
    // what the eye reads as a snap.
    const b = dive(1.0);
    const vyBefore = b.vy;
    b.step(DT, DIVE, terrain);
    const diveAccel = (b.vy - vyBefore) / DT;
    const vyAfter = b.vy;
    b.step(DT, GLIDE, terrain);
    const glideAccel = (b.vy - vyAfter) / DT;
    expect(diveAccel).toBeLessThan(-80);
    // Glide is a small fraction of the dive pull. THAT is the jolt.
    expect(Math.abs(diveAccel - glideAccel)).toBeGreaterThan(60);
  });
});

describe("a flare, when one exists, must show up here", () => {
  it("documented: the assertions above will fail the day release brakes", () => {
    // Deliberate, and the reason this file exists. A flare that sheds, say,
    // 20 m/s over 0.3s breaks "does not slow the dive at all within half a
    // second" — correctly, because the behaviour it describes has changed.
    // Whoever adds it should update this file in the same commit and say what
    // the new number is, rather than re-tuning it away in a test.
    expect(true).toBe(true);
  });
});
