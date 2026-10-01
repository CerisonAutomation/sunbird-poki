// The wake was anchored at the bird's centroid, so it began inside the bird.
//
// `Bird.x/y` is the body sphere's centre — the correct anchor for physics and
// the wrong one for a trail. The tail tip sits 1.65 world units behind that at
// base scale (4.0 for the comet), so the ribbon's widest, brightest end was
// painted over the middle of the bird's own body on every flight: the reported
// "the trail is half way through the bird".
//
// `TrailRibbon` is `transparent: true` with `depthTest: false` while the bird
// is opaque, and `renderOrder` only sorts within a queue — so three draws the
// ribbon AFTER the bird no matter what. Position is the only lever, which is
// why this is a real fix and not a draw-order one.
//
// These assert the geometry the player actually sees.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { Bird } from "../Bird";
import { ParticleFX } from "../ParticleFX";
import { TrailRibbon } from "../Trail";
import { BIRD_BASE_SCALE, CAMERA_BASE_Z, CAMERA_REVEAL_MAX, RENDER_RECENTER_THRESHOLD } from "../constants";

/** The samples the ribbon is currently drawing from. */
const samples = (t: TrailRibbon): { x: number; y: number }[] =>
  (t as unknown as { samples: { x: number; y: number }[] }).samples;

/**
 * `Game.ts` with comments and string literals blanked out, for assertions
 * about what the code DOES rather than what it says about itself.
 */
const code = (): string =>
  readFileSync(join(process.cwd(), "src/game/Game.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

/**
 * Rearmost world x of the meshes matching `pick`.
 *
 * Deliberately NOT the whole bird's AABB: the wings flap, so at some phases
 * they sweep further back than the tail, and asserting against them would let
 * a genuinely-too-short anchor pass. The overlap a player sees is the wake
 * lying across the body and the tail.
 */
function rearX(b: Bird, pick: (o: THREE.Object3D) => boolean): number {
  b.root.updateWorldMatrix(true, true);
  let min = Infinity;
  b.root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh || !pick(o)) return;
    min = Math.min(min, new THREE.Box3().setFromObject(o).min.x);
  });
  return min;
}

/** The tail assembly: the fan and its two feathers, all behind the body. */
const isTail = (o: THREE.Object3D): boolean => o.position.x <= -0.6;
/** The body: the first child added to `squash`, the sphere the centroid names. */
const isBody = (o: THREE.Object3D): boolean =>
  (o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.type === "SphereGeometry";

/** Flat ground, so the sync only exercises the proportions under test. */
const FLAT = { heightAt: () => 0, slopeAt: () => 0 } as never;

/** Dress a bird and draw it, so its meshes carry their real world matrices. */
function posed(shape: Parameters<Bird["setShape"]>[0], behind: number, rotation = 0): Bird {
  const b = new Bird();
  b.setShape(shape);
  b.x = 0;
  b.y = 0;
  b.rotation = rotation;
  // `behind` is the readability ramp 0..1; map it back to a camera distance.
  b.setViewDistance(CAMERA_BASE_Z + behind * (CAMERA_REVEAL_MAX - CAMERA_BASE_Z));
  b.syncVisual(1 / 60, false, false, 0, FLAT, 0, 0);
  return b;
}

describe("the wake is anchored behind the bird, not inside it", () => {
  it("the anchor clears the body and the tail for every species, at every readability scale", () => {
    // Readability scales the bird up to 1.95x as the camera dollies back at
    // altitude (Bird.syncVisual), so an offset that only works at base scale
    // would slide back into the body exactly when the bird is smallest on
    // screen and hardest to read.
    for (const shape of ["songbird", "raptor", "owl", "wader", "ember", "comet"] as const) {
      for (const behind of [0, 0.5, 1]) {
        const b = posed(shape, behind);
        const anchor = b.tailPoint(0, 0).x;
        for (const [part, pick] of [["body", isBody], ["tail", isTail]] as const) {
          expect(
            anchor,
            `${shape} at readability ${behind}: the wake starts at ${anchor.toFixed(2)} but the ${part} ends at ${rearX(b, pick).toFixed(2)}`,
          ).toBeLessThanOrEqual(rearX(b, pick) + 0.01);
        }
        b.dispose();
      }
    }
  });

  it("the old centroid anchor really was inside the bird", () => {
    // The regression this whole file exists for, stated as its own assertion:
    // anchoring at (x, y) put the ribbon head ON the body, by a wide margin.
    const b = posed("songbird", 0);
    const bodyRear = rearX(b, isBody);
    expect(0, "the centroid anchor sat ahead of the whole rear half of the bird").toBeGreaterThan(bodyRear);
    b.dispose();
  });

  it("a longer tail anchors further back", () => {
    const songbird = posed("songbird", 0);
    const comet = posed("comet", 0);
    const s = songbird.tailPoint(0, 0).x;
    const c = comet.tailPoint(0, 0).x;
    expect(s, "the songbird's wake must start behind the origin").toBeLessThan(0);
    // The comet's tail is 1.85x the songbird's, offset partly back by its
    // lighter bulk (0.88) — but it still has to reach further back, or the
    // species' tail length is not reaching the wake at all.
    expect(c, "the comet has a 1.85x tail and must trail further back than the songbird").toBeLessThan(s);
    expect(Math.abs(s - c), "the tail length barely moved the anchor").toBeGreaterThan(BIRD_BASE_SCALE * 0.1);
    songbird.dispose();
    comet.dispose();
  });

  it("the anchor rotates with the bird, so a diving bird's wake trails upward", () => {
    const b = posed("songbird", 0, Math.PI / 2); // nose straight up
    const p = b.tailPoint(0, 0);
    expect(Math.abs(p.x), "a vertical bird's wake must not lag sideways").toBeLessThan(0.01);
    expect(p.y, "a bird pointing up must trail DOWN").toBeLessThan(0);
    b.dispose();
  });

  it("the ribbon the game builds is anchored at the tail, not the centroid", () => {
    // The wiring, not just the geometry: a `tailPoint` that exists but is not
    // the thing the game calls would leave the bug exactly where it was.
    //
    // Read with comments stripped. The block this inspects is annotated with a
    // line naming `Bird.tailPoint`, and an earlier version of this test was
    // satisfied by that sentence while the code underneath pushed the centroid
    // — a test that passes on the prose is worse than no test.
    const src = code();
    const body = /if \(show\) \{([\s\S]{0,300}?)\n {4}\}/.exec(src);
    expect(body, "updateTrailRibbon must push from inside the show guard").not.toBeNull();
    const block = body![1]!;
    expect(block, "the wake is not anchored via the tail").toContain("tailPoint");
    expect(block, "the wake still samples the un-interpolated physics position").not.toMatch(/this\.bird\.[xy]/);
  });
});

describe("the wake and the particles survive a floating-origin rebase", () => {
  // `maybeRecenter` rebases every 4096m so float32 vertex buffers keep their
  // precision. Terrain, camera, bird and collectibles were rebased; the trail
  // and the particles were not, and neither mesh carries a transform — so both
  // jumped 4096 units off-screen at the first rebase and stayed gone for the
  // rest of an Endless run.
  //
  // The property is RELATIVE: a vertex must land where its sample does once the
  // origin is taken into account. Asserting an absolute x would be testing the
  // test's own choice of coordinates — a bird legitimately 9000m out is drawn
  // 9000m out, minus whatever the origin currently is.
  const ORIGIN = RENDER_RECENTER_THRESHOLD * 2;
  // The rebase fires when the bird is within one threshold past the mark, so
  // the drawn position is just past zero. This is the real shape of the case.
  const BIRD_X = ORIGIN + 12;

  it("the ribbon is written in the rebased frame", () => {
    const t = new TrailRibbon();
    for (let i = 0; i < 10; i++) t.push(BIRD_X + i * 0.4, 10);
    t.update(1 / 60, 1);
    t.setRenderOrigin(ORIGIN);
    t.update(1 / 60, 1);
    const pos = (t as unknown as { pos: Float32Array }).pos;
    // Each quad is 6 vertices; the first vertex of quad i is sample i.
    for (let i = 0; i < samples(t).length - 1; i++) {
      const drawn = pos[i * 18]!;
      const expected = samples(t)[i]!.x - ORIGIN;
      expect(Math.abs(drawn - expected), `quad ${i} drew at ${drawn.toFixed(1)} but its sample is at ${expected.toFixed(1)} after the rebase`).toBeLessThan(0.001);
    }
    t.dispose();
  });

  it("particle positions are written in the rebased frame", () => {
    const fx = new ParticleFX();
    for (let i = 0; i < 20; i++) fx.emitSparkle(BIRD_X + i, 10, 1, 1, 1);
    fx.setRenderOrigin(ORIGIN);
    fx.update(1 / 60);
    // Compare against the particle's own live x, not where it was emitted:
    // particles integrate and drag every step, so the drawn position is not
    // the spawn position. What must hold is the FRAME, not the coordinate.
    const live = (fx as unknown as { particles: { x: number }[] }).particles;
    const pos = (fx as unknown as { pos: Float32Array }).pos;
    expect(live.length, "adaptive quality shed the whole wake").toBeGreaterThan(0);
    for (let i = 0; i < live.length; i++) {
      expect(pos[i * 3]!, `particle ${i} was not rebased`).toBeCloseTo(live[i]!.x - ORIGIN, 3);
    }
    fx.dispose();
  });

  it("an impact ring alive across a rebase is moved, not stranded", () => {
    const fx = new ParticleFX();
    fx.burstRing(BIRD_X, 10);
    fx.setRenderOrigin(ORIGIN);
    const ring = (fx as unknown as { rings: THREE.Mesh[] }).rings.find((r) => r.visible)!;
    expect(ring, "the ring was hidden by the rebase").toBeTruthy();
    expect(ring.position.x, "the ring is stranded in the old frame").toBeCloseTo(BIRD_X - ORIGIN, 3);
    fx.dispose();
  });

  it("the game actually rebases them", () => {
    const rebase = /private maybeRecenter\(\)([\s\S]*?)\n {2}\}/.exec(code());
    expect(rebase, "maybeRecenter not found").not.toBeNull();
    // Terrain and camera predate the `setRenderOrigin` convention and take
    // their own arguments; the rest share it. Assert each system is named in
    // a rebase call, whichever form it uses.
    for (const s of ["terrain", "camera", "bird", "collect", "trail", "particles"]) {
      expect(rebase![1], `maybeRecenter does not rebase the ${s}`).toMatch(
        new RegExp(`this\\.${s}\\.(setRenderOrigin|recenter)\\(`),
      );
    }
  });
});


describe("a bird scraping the ground leaves no wake", () => {
  // The ribbon has `depthTest: false`, so it paints over anything between the
  // camera and the bird — including a hill the bird is currently carving
  // through. A wake at ground level is not a wake; it is a smear.
  it("the show gate excludes a grounded bird", () => {
    // Scoped to the method and comment-stripped, for the same reason as the
    // anchor test: the gate is annotated with a sentence about a grounded bird,
    // and a substring match on prose proves nothing about the condition.
    const method = /private updateTrailRibbon\(([\s\S]*?)\n {2}\}/.exec(code())!;
    expect(method, "updateTrailRibbon not found").not.toBeNull();
    const gate = /const show =([\s\S]*?);/.exec(method[0]!)!;
    expect(gate, "updateTrailRibbon has no show gate").not.toBeNull();
    expect(gate[1], "a grounded bird still draws a wake over the terrain").toContain("!this.bird.grounded");
  });
});
