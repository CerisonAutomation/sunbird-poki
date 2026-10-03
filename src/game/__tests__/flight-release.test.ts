// "The release doesn't work on the last ramp."
//
// THE BUG. One-button flight: hold commits you downward, release pulls you out.
// For a long stretch the release was a brake, and the brake engaged only while
// falling faster than `FLARE_MAX_RISE` (-14 m/s). Releasing from level or
// climbing flight therefore did *nothing*. A ramp crest IS a release from
// climbing flight, so "release at the end of a ramp" hit a dead branch — and it
// hit it almost every time, not occasionally: over 57 measured autopilot ramp
// launches the vertical-speed distribution was min -12.1, p50 +10.3, p90 +25.8,
// max +31.3, and 94.7% left the ground at `vy >= 0`. That is 94.7% of ramp
// releases doing nothing, against a tutorial that coaches "RELEASE at the top to
// launch".
//
// The regression came from cbf6950 ("a brake arrests a fall, not a climb"), which
// was fixing a real bug — a bare `vy = FLARE_MAX_RISE` clamp slammed a +30 m/s
// launch to -14 in a single frame, a 44 m/s discontinuity — but over-corrected
// from "the brake must not clamp a climb" to "the release must not lift".
//
// THE FIX, and why it is shaped this way. The release keeps its brake exactly
// as it was, for dives, because dive recovery already felt good and changing it
// is blast radius with no upside. Alongside it, a bounded one-shot kick handles
// everything else. The properties that matter, each pinned below:
//
//   1. A level or climbing release LAUNCHES. Not a nudge: the apex test demands
//      more than 15 m/s of climb out of a release that starts at vy = 0.
//   2. A ramp-crest release is never WEAKER than a flat one. Same kick either
//      way, and the ramp bird starts higher, so it lands higher.
//   3. A committed dive is bit-for-bit what it was.
//   4. A release can never REDUCE vertical speed. Structurally: the kick is
//      only ever added, and the ceiling is applied with `Math.min`.
//   5. The kick cannot be chained. The latch re-arms on every press, so without
//      a cooldown the kick is farmable to infinity.
//
// The physics decisions live in `FlightPhysics.ts` as pure functions
// (`releaseKick`, `applyReleaseKick`) precisely so they can be tested here
// without a canvas — `Game` does not boot under jsdom, and the numbers a player
// feels should not need a frame loop to pin.

import { describe, expect, it } from "vitest";

import { Bird } from "../Bird";
import { FLARE_MAX_RISE, GLIDE_LIFT_SPEED, GRAVITY_DIVE, GRAVITY_GLIDE, PHYS_DT } from "../constants";
import { applyReleaseKick, releaseKick, RELEASE_KICK, RELEASE_KICK_COOLDOWN, RELEASE_MAX_RISE } from "../FlightPhysics";
import { TerrainSystem } from "../TerrainSystem";

const IDLE = { fever: false, speedMult: 1, boost: false } as const;
const GLIDE = { ...IDLE, diving: false } as const;
const DIVE = { ...IDLE, diving: true } as const;

/**
 * Altitude for a probe that is testing the RELEASE.
 *
 * Below `ALT_CEILING` (230) on purpose. `dampClimbAtCeiling` scales any climb
 * to zero across the top 20 m, and that is correct behaviour for a bird at the
 * ceiling — but it means a probe started high measures the ceiling and reports
 * it as "the release does nothing". The bug being pinned here lives at ramp
 * height, so that is where it gets measured.
 */
const PROBE_HEIGHT = 120;

function probe(seed = "flight-release-probe"): { bird: Bird; terrain: TerrainSystem } {
  const terrain = new TerrainSystem(seed);
  const bird = new Bird();
  bird.reset(64, terrain.heightAt(64) + PROBE_HEIGHT);
  bird.vx = 45;
  return { bird, terrain };
}

/**
 * Release from a chosen vertical speed and report the speed one step later.
 *
 * The dive step is not optional decoration. `Bird.step` edge-detects the
 * release (`if (this.wasDiving && !diving) this.releaseBuffer = FLARE_BUFFER`,
 * Bird.ts:600), so a bird that was never diving has nothing to release and the
 * kick correctly does not fire. A probe that sets `vy` and immediately glides
 * measures nothing at all — which is exactly what happened the first time this
 * file was written.
 *
 * `vy` is overwritten AFTER the dive step, so the probe controls the release
 * speed precisely while still arming the latch honestly.
 */
function releaseFrom(vy: number, seed?: string): number;
function releaseFrom(vy: number, seed: string | undefined, withKick: true): { after: number; kick: number };
function releaseFrom(vy: number, seed?: string, withKick?: true): number | { after: number; kick: number } {
  const { bird, terrain } = probe(seed);
  bird.step(PHYS_DT, DIVE, terrain); // arm the release edge
  bird.vy = vy;
  bird.step(PHYS_DT, GLIDE, terrain); // the release itself
  const after = bird.vy;
  const kick = bird.releaseKickAmount;
  terrain.dispose();
  return withKick ? { after, kick } : after;
}

/**
 * Fly the bird with the button in `diving` state until `vy` satisfies `ready`,
 * then release and report the strongest upward speed the release produced.
 *
 * Returns `null` if the precondition is never met, so a probe that stops
 * matching the physics fails loudly instead of passing vacuously.
 */
function releaseAt(ready: (vy: number) => boolean, maxSeconds = 4): { vyAtRelease: number; peakVy: number } | null {
  const { bird, terrain } = probe();
  const steps = Math.round(maxSeconds / PHYS_DT);
  for (let i = 0; i < steps; i++) {
    const vyBefore = bird.vy;
    bird.step(PHYS_DT, DIVE, terrain);
    if (bird.grounded || !ready(vyBefore)) continue;
    let peakVy = -Infinity;
    for (let k = 0; k < Math.round(0.5 / PHYS_DT); k++) {
      bird.step(PHYS_DT, GLIDE, terrain);
      peakVy = Math.max(peakVy, bird.vy);
    }
    terrain.dispose();
    return { vyAtRelease: vyBefore, peakVy };
  }
  terrain.dispose();
  return null;
}

describe("the release kick is a real launch off a ramp", () => {
  it("a level release LAUNCHES the bird — this is the reported bug", () => {
    // Before the fix this number was 0. The player let go and the bird carried
    // on exactly as if they had not. The bar is a LAUNCH, not "something
    // happened": an apex release that yields a couple of m/s would still read as
    // a broken input, because the tutorial promises a jump.
    const { bird, terrain } = probe();
    bird.step(PHYS_DT, DIVE, terrain); // arm the release edge
    bird.vy = 0;
    bird.step(PHYS_DT, GLIDE, terrain);
    // A LAUNCH, not "something happened" — the bar that matters is that this is
    // not 0 and not a nudge. The old assertion compared against `RELEASE_KICK`,
    // which was only true while the kick was a constant; it is now scaled by
    // the bird's speed, so the honest bar is a real single-frame impulse.
    expect(bird.vy, "releasing from level must hand back real climb").toBeGreaterThan(9);
    // And the kick must be a substantial fraction of the ceiling it is bounded
    // by, so this cannot pass with a token impulse.
    expect(bird.releaseKickAmount, "the kick itself was too small to be a launch")
      .toBeGreaterThan(RELEASE_KICK * 0.5);
    expect(bird.releaseKickAmount, "the kick must never exceed its own constant")
      .toBeLessThanOrEqual(RELEASE_KICK + 1e-9);
    terrain.dispose();
  });

  it("a release at the apex launches, measured through the real Bird", () => {
    // The exact timing FirstFlight coaches. Driven through real `Bird.step`
    // calls so the latch, the cooldown bookkeeping and the ceiling damp are all
    // in the loop, not stubbed out.
    const r = releaseAt((vy) => vy > -1 && vy < 1);
    expect(r, "the probe never reached an apex").not.toBeNull();
    expect(r!.vyAtRelease, "sanity: the release really was made at an apex").toBeLessThan(1);
    expect(r!.vyAtRelease).toBeGreaterThan(-1);
    // A launch, not a nudge. `RELEASE_KICK * 0.85` is the honest bar now that
    // the kick is speed-scaled: an apex release from a bird that has arrived
    // at speed lands just under the constant, and a nudge cannot clear it.
    // A launch, not a nudge — and a nudge cannot clear even half the constant.
    // It is deliberately NOT `RELEASE_KICK`: by the time this probe reaches an
    // apex it has bled horizontal speed to the dive, so the speed-scaled kick
    // is legitimately below the constant. The bar is "a real impulse", not
    // "the full impulse at a speed this bird no longer has".
    expect(r!.peakVy, "an apex release must be a launch, not a nudge")
      .toBeGreaterThan(RELEASE_KICK * 0.5);
  });

  it("a release at a ramp crest is never weaker than one on flat ground", () => {
    // The explicit requirement: "if the ramp release is now weaker than the
    // flat release, that is a bug".
    //
    // Flat means vy = 0, so "the kick" is measurable as the final vy. A ramp
    // crest means vy > 0, and the ramp bird must end up STRICTLY HIGHER still.
    // `vy > 0` is the real measured launch distribution (p50 +10.3, p90 +25.8
    // over 57 autopilot launches), not an invented number.
    const flat = probe();
    flat.bird.step(PHYS_DT, DIVE, flat.terrain); // arm the release edge
    flat.bird.vy = 0;
    flat.bird.step(PHYS_DT, GLIDE, flat.terrain);
    const flatVy = flat.bird.vy;
    const flatKick = flat.bird.releaseKickAmount;
    flat.terrain.dispose();

    for (const crestVy of [1, 5, 10.3, 20, 25.8]) {
      const ramp = probe("ramp-crest-probe");
      ramp.bird.step(PHYS_DT, DIVE, ramp.terrain);
      ramp.bird.vy = crestVy;
      ramp.bird.step(PHYS_DT, GLIDE, ramp.terrain);
      expect(
        ramp.bird.vy,
        `a release from a ${crestVy} m/s ramp crest must beat a flat release (${flatVy.toFixed(2)})`,
      ).toBeGreaterThan(flatVy);
      // The kick now scales with the bird's TOTAL speed, and a crest release
      // is strictly faster than a flat one, so it earns a slightly LARGER
      // kick. Asserted as ">=", not "==": the old identity was true only while
      // the kick ignored speed, and pinning equality would now forbid the very
      // thing that makes a ramp release feel better than a flat one.
      expect(ramp.bird.releaseKickAmount, "a crest release must not earn less than a flat one")
        .toBeGreaterThanOrEqual(flatKick - 1e-9);
      expect(ramp.bird.releaseKickAmount, "and must never exceed the constant")
        .toBeLessThanOrEqual(RELEASE_KICK + 1e-9);
      ramp.terrain.dispose();
    }
  });

  it("spends the same kick at every CLIMB, so a big launch is not discounted", () => {
    // Scaling the kick by the existing climb is what made the biggest, best
    // launches feel least rewarding. The kick is independent of `vy` up to the
    // ceiling: a release at the top of a big arc buys exactly as much as one
    // from level. Above the ceiling it is 0, because there is nothing left to
    // add — asserted separately below.
    //
    // This is about CLIMB, not speed. The kick IS scaled by speed now, which
    // is a different axis and is asserted on its own below; conflating the two
    // is what would let a speed regression hide behind this test.
    for (const vy of [0, 1, 10.3, 25.8, RELEASE_MAX_RISE - 1]) {
      expect(releaseKick(vy, 0), `at vy = ${vy}`).toBeCloseTo(RELEASE_KICK, 5);
    }
  });

  it("scales the kick with the bird's speed, so the jump is earned", () => {
    // The reported "the jump is too strong" defect was two problems. This is
    // the one a constant could not fix: the kick used to be `RELEASE_KICK` for
    // ANY vy >= 0, so a bird grinding along at 12 m/s bought the same impulse
    // as one at the 108 m/s cap. Measured, that was 18.0 m of rise at 12 m/s
    // against 29.7 m at 108 — nine times the speed for 1.4x the reward,
    // because the reward was connected to nothing.
    //
    // `speed = Infinity` is the documented "unspecified" case and must stay at
    // the full constant, because that is what every caller that does not know
    // the bird's speed gets.
    expect(releaseKick(0, 0, Number.POSITIVE_INFINITY), "unspecified speed keeps the full kick")
      .toBeCloseTo(RELEASE_KICK, 5);

    const slow = releaseKick(0, 0, 12);
    const fast = releaseKick(0, 0, GLIDE_LIFT_SPEED);
    expect(slow, "a ground-speed bird must not buy a full kick").toBeLessThan(RELEASE_KICK * 0.35);
    expect(fast, "a bird at lift speed buys the whole kick").toBeCloseTo(RELEASE_KICK, 5);
    expect(slow, "the kick must be monotonic in speed")
      .toBeLessThan(releaseKick(0, 0, 30));
    expect(releaseKick(0, 0, 30), "monotonic all the way up")
      .toBeLessThan(releaseKick(0, 0, 50));
    // And it saturates rather than growing without bound.
    expect(releaseKick(0, 0, 400), "the kick must not exceed its constant at any speed")
      .toBeCloseTo(RELEASE_KICK, 5);
  });
});

describe("the dive brake is left exactly as it was", () => {
  it("a committed dive release gets no kick at all — the brake owns it", () => {
    // Dive recovery is the one release case that already worked and felt good.
    // The kick must not double up on it, or a pull-out from a fast dive would
    // suddenly be a jet and the brake's own `FLARE_MAX_RISE` bound would become
    // meaningless.
    //
    // `FLARE_MAX_RISE` itself is the interesting sample. It is the exact
    // boundary where the two guards in `releaseKick` meet — the explicit dive
    // check fires, and the drift band's `clamp` also floors to 0 — so a test
    // that only probed deeper dives (say -30 and below) would pass even with
    // one guard deleted entirely, and the redundancy would be invisible. The
    // values just past the boundary are what make each guard load-bearing.
    for (const vy of [FLARE_MAX_RISE, FLARE_MAX_RISE - 0.01, -20, -30, -60, -95, -108]) {
      expect(releaseKick(vy, 0), `at vy = ${vy}`).toBe(0);
    }
    // And symmetrically, just above the boundary the kick is a sliver, not zero
    // — the band has to hand over cleanly rather than jumping to the full kick.
    expect(releaseKick(FLARE_MAX_RISE + 0.01, 0), "just above the brake the kick starts").toBeGreaterThan(0);
    expect(releaseKick(FLARE_MAX_RISE + 0.01, 0), "but it starts from nothing").toBeLessThan(RELEASE_KICK * 0.01);
  });

  it("a real dive still brakes, and still cannot become a climb", () => {
    const r = releaseAt((vy) => vy < -30);
    expect(r, "the probe never reached a committed dive").not.toBeNull();
    expect(r!.peakVy, "the brake arrests a fall").toBeGreaterThan(r!.vyAtRelease);
    expect(r!.peakVy, "but a brake never converts a dive into a climb").toBeLessThanOrEqual(FLARE_MAX_RISE);
  });

  it("a gentle drift gets a proportional share — a nudge, not a launch", () => {
    // Between level and a real dive the kick fades out, so letting go near a
    // hover is not a launch. It is still never a slowdown. The fade is sampled
    // strictly INSIDE the band (`vy > FLARE_MAX_RISE`): at and below
    // `FLARE_MAX_RISE` the brake owns the release and the kick is 0 by design,
    // which is asserted separately above.
    let previous = RELEASE_KICK;
    for (const vy of [-1, -3, -7, -10, -13]) {
      const kick = releaseKick(vy, 0);
      expect(kick, `at vy = ${vy}`).toBeGreaterThan(0);
      expect(kick, `the kick must fade monotonically as the fall steepens (vy = ${vy})`).toBeLessThan(previous);
      previous = kick;
    }
    expect(releaseKick(-13, 0), "just short of the brake it is already a sliver").toBeLessThan(RELEASE_KICK * 0.1);
    expect(applyReleaseKick(-7, 0), "and it never turns a drift into a fall").toBeGreaterThan(-7);
  });
});

describe("a release can never hurt the bird", () => {
  // This is the invariant cbf6950 was right to introduce, kept intact. Its bug
  // was not the invariant, it was treating the invariant as the whole feature.
  it("applyReleaseKick only ever raises vy, at every input in range", () => {
    for (let vy = -120; vy <= 60; vy += 0.5) {
      for (const cd of [0, 0.1, RELEASE_KICK_COOLDOWN]) {
        expect(applyReleaseKick(vy, cd), `vy = ${vy}, cooldown = ${cd}`).toBeGreaterThanOrEqual(vy);
      }
    }
  });

  it("never exceeds the ceiling, from any starting speed below it", () => {
    // Scoped to inputs at or below `RELEASE_MAX_RISE`. A bird ALREADY above the
    // ceiling is passed through untouched, and that is deliberate: clamping it
    // down to the ceiling would be the same single-frame downward slam this
    // whole change exists to remove, just from the other direction.
    for (let vy = -120; vy <= RELEASE_MAX_RISE; vy += 0.5) {
      const after = applyReleaseKick(vy, 0);
      expect(after, `vy = ${vy}`).toBeLessThanOrEqual(RELEASE_MAX_RISE);
      expect(after, `vy = ${vy}`).toBeGreaterThanOrEqual(vy);
    }
  });

  it("a release mid-climb is additive, never a clamp downward", () => {
    // The exact failure of the pre-cbf6950 code, pinned as a regression: a bird
    // launched off a lip at +30 and released at the top of its arc used to be
    // slammed to -14 in one frame. A 44 m/s discontinuity in a single 8.3 ms
    // step. The kick adds to it instead.
    //
    // +30 + kick overshoots `RELEASE_MAX_RISE` (32), so the result is the ceiling
    // — but note the SHAPE of that clip. The old code clipped DOWNWARD, to a
    // value below where the bird already was. This clips upward, to a value
    // above it. That asymmetry is the entire fix, so both halves are asserted.
    const after = releaseFrom(30, "mid-climb-probe");
    expect(after, "a rising bird must not be slammed downward").toBeGreaterThan(30);
    expect(after, "clipped to the ceiling, not down to the brake's bound").toBeLessThanOrEqual(RELEASE_MAX_RISE);
    // Was `> 35`, an absolute number that only meant anything while the ceiling
    // was 40; it silently became a ceiling test rather than a launch test, and
    // capping the launch to 32 failed it for the right reason at the wrong
    // altitude. What actually needs pinning is that the overshoot clips ONTO
    // the ceiling — not up to somewhere in between, and certainly not down.
    expect(after, "the overshoot must clip onto the ceiling itself")
      .toBeCloseTo(RELEASE_MAX_RISE, 0);

    // Below the ceiling the kick is added in full, with nothing clipped.
    // Below the ceiling the kick is added in full, with nothing clipped. Stated
    // as an EXACT equality against the kick the bird actually earned, because
    // the kick is now speed-scaled and the old `10 + RELEASE_KICK - 2` proxy
    // would have been asserting a number the code deliberately no longer
    // produces. An equality is also strictly stronger than the old inequality:
    // it fails both when too little was added and when too much was.
    const { after: clear, kick } = releaseFrom(10, "mid-climb-clear", true);
    expect(kick, "a launch this far under the ceiling must earn a real kick")
      .toBeGreaterThan(0);
    // The kick lands, then the SAME step still charges this tick's gravity, so
    // `clear` sits just under `10 + kick` — by design, not by clipping. So the
    // ceiling test is a bracket, not an equality: the ceiling took nothing (the
    // gap is only gravity), and gravity took nothing beyond one step (the gap
    // is at most one step). A clip by the ceiling would widen the gap beyond
    // `GRAVITY_GLIDE * PHYS_DT`, which is what makes this falsifiable.
    const owed = GRAVITY_GLIDE * PHYS_DT;
    expect(clear, "the ceiling must clip nothing when the bird fits under it")
      .toBeLessThan(10 + kick);
    expect(clear, "only this step's own gravity may be missing from the launch")
      .toBeGreaterThan(10 + kick - owed);
  });

  it("is a no-op above the ceiling — nothing left to add", () => {
    expect(applyReleaseKick(RELEASE_MAX_RISE, 0)).toBe(RELEASE_MAX_RISE);
    expect(applyReleaseKick(RELEASE_MAX_RISE + 20, 0)).toBe(RELEASE_MAX_RISE + 20);
    expect(releaseKick(RELEASE_MAX_RISE, 0)).toBe(0);
  });
});

describe("the kick cannot be farmed", () => {
  it("a second release inside the cooldown buys nothing", () => {
    expect(releaseKick(0, RELEASE_KICK_COOLDOWN)).toBe(0);
    expect(releaseKick(0, 0.0001)).toBe(0);
    expect(applyReleaseKick(0, RELEASE_KICK_COOLDOWN)).toBe(0);
  });

  it("chaining releases forever loses to gravity, so the climb is not a jet", () => {
    // The latch re-arms on every press, so at 120 Hz a press/release alternation
    // would net roughly +19 m/s per 16.7 ms — an infinite climb. The cooldown is
    // tuned to be longer than the dive needed to pay back the kick it bought.
    const { bird, terrain } = probe("chaining-probe");
    bird.vy = 0;
    let peak = -Infinity;
    // Alternate press/release for 3 s at the fastest a player could manage.
    for (let i = 0; i < Math.round(3 / PHYS_DT); i++) {
      const diving = i % 2 === 0;
      bird.step(PHYS_DT, { ...IDLE, diving }, terrain);
      peak = Math.max(peak, bird.vy);
    }
    terrain.dispose();
    // A single honest release reaches ~22 m/s. Spamming must not beat that by a
    // meaningful margin, or the cooldown is doing nothing.
    expect(peak, "tap-spamming must not outperform an honest release").toBeLessThan(RELEASE_MAX_RISE);
  });

  it("the cooldown is longer than the dive that pays for a kick", () => {
    // The reason for the number. If the cooldown were shorter than this, the
    // kick would compound into a free climb and the constant above would pass
    // only by luck.
    const diveCost = GRAVITY_DIVE * RELEASE_KICK_COOLDOWN;
    expect(diveCost, "gravity must out-cost a kick over the cooldown").toBeGreaterThan(RELEASE_KICK);
  });
});

describe("the kick is bounded, so it stays a boost and not a jet", () => {
  it("RELEASE_MAX_RISE sits above every launch the game actually produces", () => {
    // Measured: p90 of real ramp launches is +25.8, hardest observed +31.3.
    // The ceiling must clear the hardest of them or the best launches get
    // silently clipped, which reads as the release being weak.
    expect(RELEASE_MAX_RISE).toBeGreaterThan(31.3);
    // The invariant is "a release is a boost, not a jet": ONE kick must not be
    // able to reach the ceiling by itself. It used to be written as
    // `RELEASE_MAX_RISE < RELEASE_KICK * 2`, which is a proxy that silently
    // couples the ceiling to the kick constant — lowering the kick (the fix for
    // the reported over-strong jump) broke it without either number becoming
    // wrong. The direct form states the actual property and is what should be
    // pinned: a single kick lands well short of the ceiling.
    expect(RELEASE_KICK, "one kick must not reach the climb ceiling on its own")
      .toBeLessThan(RELEASE_MAX_RISE);
  });

  it("a single release cannot exceed the ceiling even from a standing start", () => {
    expect(applyReleaseKick(0, 0)).toBe(RELEASE_KICK);
    expect(RELEASE_KICK).toBeLessThan(RELEASE_MAX_RISE);
  });
});
