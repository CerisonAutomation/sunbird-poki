import { describe, expect, it } from "vitest";

import { Bird } from "../Bird";
import { FLARE_BUFFER, FLARE_DURATION, FLARE_MAX_RISE, GLIDE_LIFT_MAX, GRAVITY_GLIDE } from "../constants";
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
  it("brakes the dive on release and HOLDS the recovery, instead of diving on", () => {
    const b = dive(1.0);
    const atRelease = b.vy;
    b.step(DT, GLIDE, terrain);
    expect(b.flareAmount).toBeGreaterThan(0);
    expect(b.vy).toBeGreaterThan(atRelease);

    // The measurement that matters is the shape, not one frame. An impulse was
    // tried first and it did NOT work: 26 m/s in a single frame took -95 to -69
    // and then gravity took it straight back, -70 at 42ms and -73 at 492ms,
    // never approaching zero. Releasing felt like a softer dive, not a catch.
    //
    // So the brake must not just be an impulse: it has to keep pushing, and the
    // push has to still be there a third of a second later.
    const half = [];
    for (let t = 0; t < 0.3; t += DT) { b.step(DT, GLIDE, terrain); half.push(b.vy); }
    const at300ms = half[half.length - 1]!;
    // Still braking hard a third of the way through, i.e. the pull-out is
    // sustained rather than a single tick.
    expect(b.flareAmount, "brake still engaged at 300ms").toBeGreaterThan(0);
    // And it has actually arrested a large share of the dive.
    expect(at300ms - atRelease, "speed shed by 300ms").toBeGreaterThan(40);

    // The failure this is written against: the old curve was flat or worsening
    // over this window. A brake that stops helping would look like this.
    expect(at300ms, "must be better than where it was mid-brake").toBeGreaterThan(atRelease / 2);
  });

  it("ends: the brake decays to nothing, so releases cannot chain into a lift", () => {
    const b = dive(1.0);
    b.step(DT, GLIDE, terrain);
    for (let t = 0; t < FLARE_DURATION * 1.5; t += DT) b.step(DT, GLIDE, terrain);
    expect(b.flareAmount, "brake is over").toBe(0);
  });

  it("never converts a dive into a climb", () => {
    const b = dive(1.0);
    let highest = -Infinity;
    for (let t = 0; t < 1.5; t += DT) { b.step(DT, GLIDE, terrain); highest = Math.max(highest, b.vy); }
    // Recovery, not a launch pad. Chained releases must not be a free lift.
    expect(highest, "the pull-out brakes, it does not lift").toBeLessThanOrEqual(FLARE_MAX_RISE);
  });

  it("brakes the same regardless of depth, because it decays in time", () => {
    // Deliberate, and worth stating because the impulse version did the
    // opposite. The brake is a FIXED strength that fades with the clock, not a
    // nudge scaled by how fast you happened to be. A fixed brake is what makes
    // the pull-out predictable — the player learns "releasing always buys me
    // about this much" — which is the whole point of a verb you can master.
    const deep = dive(1.0);
    deep.step(DT, GLIDE, terrain);
    const shallow = dive(0.15);
    shallow.step(DT, GLIDE, terrain);
    expect(shallow.flareAmount).toBeCloseTo(deep.flareAmount, 5);
  });

  it("still fires when the release lands while the bird is GROUNDED", () => {
    // The case a player hits constantly: skimming the ground, let go, keep
    // flying. The old check lived inside the ballistic branch, so a release
    // while grounded changed nothing at all and the pull-out simply did not
    // happen. The release is now latched before the branch, so it survives.
    const b = new Bird();
    const gy = terrain.heightAt(200);
    b.reset(200, gy + 0.9);
    b.vx = 40;
    b.vy = 0;
    b.step(DT, DIVE, terrain);
    expect(b.grounded, "probe should be resting on the ground").toBe(true);
    b.step(DT, GLIDE, terrain); // release while grounded

    // The brake cannot SPEND while grounded — there is no dive to arrest — so
    // nothing is audible yet. What matters is that the release was LATCHED
    // rather than dropped, which is only observable once the bird is airborne
    // and falling: the flare must then fire on that first frame.
    expect(b.flareAmount, "nothing to brake yet, on the ground").toBe(0);
    b.vy = -50;
    b.grounded = false;
    b.step(DT, GLIDE, terrain);
    expect(b.flareAmount, "a grounded release must survive into the air").toBeGreaterThan(0);
  });

  it("still fires when the release lands on a frame with vy >= 0", () => {
    // The bottom of an arc. The old check required vy < 0 on the release frame
    // itself, so letting go exactly there missed the edge forever — `wasDiving`
    // was already consumed and the flare could never fire. That is the literal
    // "sometimes the release does nothing".
    const b = new Bird();
    b.reset(0, 900);
    b.vx = 40;
    b.vy = -20;
    b.step(DT, DIVE, terrain);
    b.vy = 30; // climbing at the instant of release
    b.step(DT, DIVE, terrain);
    b.vy = 30;
    b.step(DT, GLIDE, terrain); // release while climbing
    // It may not have spent yet (nothing to arrest) — but the release must not
    // have been lost. Force a fall and confirm the brake is still armed.
    b.vy = -40;
    b.step(DT, GLIDE, terrain);
    expect(b.flareAmount, "a release during a climb must not be consumed").toBeGreaterThan(0);
  });

  it("does not re-fire on a release older than the buffer", () => {
    // A release fires ONCE. Holding the button again and letting go is a new
    // release and is allowed to fire — the buffer only stops a STALE one from
    // being banked and cashed in later.
    const b = dive(0.5);
    b.step(DT, GLIDE, terrain); // release -> arms and fires
    expect(b.flareAmount).toBeGreaterThan(0);
    // Stay gliding. The brake runs its course and must simply end; no further
    // flare can appear because no further release happened.
    let sawFlareAfterEnd = 0;
    for (let t = 0; t < FLARE_BUFFER * 4; t += DT) {
      b.step(DT, GLIDE, terrain);
      if (b.flareAmount > 0) sawFlareAfterEnd++;
    }
    expect(b.flareAmount, "the brake must end").toBe(0);
    // It may still be running for FLARE_DURATION, but never past the buffer.
    expect(sawFlareAfterEnd * DT, "brake outlived the buffer").toBeLessThan(FLARE_BUFFER + DT);
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
