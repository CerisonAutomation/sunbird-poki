// Two species proportions were set once and then thrown away every frame.
//
// `setShape` scales the beak and the body bulk to make a wader long-beaked and
// an owl round. But `syncVisual` also writes both of those, every frame, to
// animate the beak opening with speed and the body stretching — and it wrote
// them as absolute values. So from the first rendered frame the species' beak
// and bulk were gone, and every bird flew as the same oval in different
// colours, while the shop preview showed the proportions it was selling.
//
// Only beak and bulk were affected: `wingL/R.scale` and `tail.scale` are never
// written per-frame, which is why wingspan and tail length did work.
//
// The two animations are exact functions of speed, which is what makes this
// testable rather than a matter of catching a lucky frame:
//   beakOpen    = clamp((speed - 35) / 55, 0, 0.35)   -> 0 at or below 35 m/s
//   speedStretch                                          -> 1 at low speed
// so below 35 m/s the drawn scale IS the species factor, exactly.
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { BIRD_SHAPE_PROPORTIONS, Bird } from "../Bird";

const FLAT = { heightAt: () => 0, slopeAt: () => 0 } as never;
const SHAPES = ["songbird", "raptor", "owl", "wader", "ember", "comet"] as const;
/** Slow enough that the beak is shut and the body is unstretched. */
const SLOW = 20;

function dress(shape: (typeof SHAPES)[number], speed: number): Bird {
  const b = new Bird();
  b.setShape(shape);
  b.x = 0;
  b.y = 0;
  b.rotation = 0;
  b.vx = speed;
  b.vy = 0;
  b.syncVisual(1 / 60, false, false, 0.5, FLAT, 0, 0);
  return b;
}

const beakScale = (b: Bird): THREE.Vector3 => (b as unknown as { beak: THREE.Mesh }).beak.scale;
const squashScale = (b: Bird): THREE.Vector3 => (b as unknown as { squash: THREE.Group }).squash.scale;

describe("species proportions survive the per-frame animation", () => {
  it("every species keeps its own beak and bulk", () => {
    for (const shape of SHAPES) {
      const p = BIRD_SHAPE_PROPORTIONS[shape];
      const b = dress(shape, SLOW);
      const beak = beakScale(b);
      const squash = squashScale(b);
      expect(beak.y, `${shape}: the ${p.beak}x beak was flattened back to 1`).toBeCloseTo(p.beak, 3);
      expect(beak.x, `${shape}: the ${p.beakWidth}x beak width was reset to 1`).toBeCloseTo(p.beakWidth, 3);
      expect(squash.y, `${shape}: the ${p.bulk}x bulk was reset to 1`).toBeCloseTo(p.bulk, 3);
      b.dispose();
    }
  });

  it("the wader's long beak is really longer than the songbird's", () => {
    // The reported symptom, as its own assertion: the shop drew 1.7x and the
    // run delivered 1.0x. Compare at the same point in the animation.
    const wader = dress("wader", SLOW);
    const songbird = dress("songbird", SLOW);
    expect(beakScale(wader).y).toBeGreaterThan(beakScale(songbird).y * 1.5);
    wader.dispose();
    songbird.dispose();
  });

  it("the owl really is rounder than the songbird", () => {
    const owl = dress("owl", SLOW);
    const songbird = dress("songbird", SLOW);
    expect(squashScale(owl).y).toBeGreaterThan(squashScale(songbird).y);
    owl.dispose();
    songbird.dispose();
  });

  it("the animations still play, on top of the species rather than over it", () => {
    // If the fix had been "stop writing these scales every frame", the bird
    // would have kept its proportions and lost its beak and its speed stretch.
    // At 90 m/s `beakOpen` clamps to 0.35, so the long axis of the beak must
    // be exactly 1 + 0.35*0.35 = 1.1225x its slow-frame value — the SAME
    // factor for every species, which is what "on top of" means.
    const BEAK_OPEN_AT_90 = 1 + 0.35 * 0.35;
    for (const shape of SHAPES) {
      const slow = dress(shape, SLOW);
      const fast = dress(shape, 90);
      expect(
        beakScale(fast).y / beakScale(slow).y,
        `${shape}: the beak is not animating by the same factor as every other species`,
      ).toBeCloseTo(BEAK_OPEN_AT_90, 4);
      // The stretch is on x only, and it must still be there.
      expect(squashScale(fast).x, `${shape}: the body stopped stretching with speed`).toBeGreaterThan(squashScale(fast).y);
      slow.dispose();
      fast.dispose();
    }
  });

  it("a reset puts the songbird proportions back", () => {
    const b = dress("comet", SLOW);
    b.reset(0, 0);
    b.vx = SLOW;
    b.vy = 0;
    b.syncVisual(1 / 60, false, false, 0.5, FLAT, 0, 0);
    expect(beakScale(b).y, "a reset bird kept the comet's beak").toBeCloseTo(1, 3);
    expect(squashScale(b).y, "a reset bird kept the comet's bulk").toBeCloseTo(1, 3);
    b.dispose();
  });
});
