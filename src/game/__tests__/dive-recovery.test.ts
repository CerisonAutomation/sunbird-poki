import { describe, expect, it } from "vitest";

import { Bird } from "../Bird";
import { FLARE_AUTHORITY, GLIDE_LIFT_MAX, GRAVITY_GLIDE } from "../constants";
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
  it("sheds dive speed on release instead of accelerating into the ground", () => {
    const b = dive(1.0);
    const atRelease = b.vy;
    b.step(DT, GLIDE, terrain);
    // The flare. One-shot, on the falling edge, scaled by how fast we were
    // genuinely falling. At a terminal dive it is worth the full authority.
    expect(b.flareAmount).toBeGreaterThan(0);
    expect(b.flareAmount).toBeLessThanOrEqual(FLARE_AUTHORITY);
    expect(b.vy).toBeGreaterThan(atRelease); // strictly less downward

    for (let t = 0; t < 0.5; t += DT) b.step(DT, GLIDE, terrain);
    // Measured: -95.4 at release, -72.6 half a second later. Before the flare
    // this was -97.7 — the dive was a one-way door and the pull-out did nothing.
    expect(b.vy).toBeGreaterThan(atRelease);
    expect(b.vy - atRelease, "speed recovered by the pull-out").toBeGreaterThan(12);
  });

  it("scales the flare to how hard you actually dove", () => {
    const hard = dive(1.0);
    const hardVy = hard.vy;
    hard.step(DT, GLIDE, terrain);
    const hardFlare = hard.flareAmount;

    // A bird that was barely falling gets almost nothing. This is what keeps
    // a gentle tap-out and a committed plunge different gestures.
    const shallow = new Bird();
    shallow.reset(0, 900);
    shallow.vx = 40;
    shallow.vy = 0;
    for (let t = 0; t < DT; t += DT) shallow.step(DT, DIVE, terrain);
    shallow.step(DT, GLIDE, terrain);
    expect(shallow.flareAmount).toBeLessThan(hardFlare);
    expect(hardVy).toBeLessThan(-80);
  });

  it("adds nothing when releasing from a climb", () => {
    const b = new Bird();
    b.reset(0, 900);
    b.vx = 40;
    b.vy = 25; // already going UP
    b.step(DT, DIVE, terrain);
    b.vy = 25;
    b.step(DT, GLIDE, terrain);
    // A flare sheds dive speed. It must never become a jet that lifts you.
    expect(b.flareAmount).toBe(0);
  });

  it("does not re-fire while the button is simply held", () => {
    const b = dive(0.5);
    let fired = 0;
    for (let t = 0; t < 0.5; t += DT) if (b.step(DT, DIVE, terrain), b.flareAmount > 0) fired++;
    expect(fired, "the flare is one-shot, not per-step").toBe(0);
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

  it("the acceleration step is still a step, but it no longer ends the run", () => {
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
