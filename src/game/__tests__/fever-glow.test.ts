import { describe, expect, it } from "vitest";
import { PointLight } from "three";
import { Bird } from "../Bird";
import { TerrainSystem } from "../TerrainSystem";

/**
 * `Bird.glow` is hidden while its intensity is 0 (render.md 7 row 4), so every
 * MeshLambertMaterial in the game drops NUM_POINT_LIGHTS from 1 to 0. Fever is
 * player-facing feedback, so the thing to protect is not "the light stays on"
 * but "the light is on whenever it used to contribute anything" — which is
 * exactly `intensity > 0`. That equivalence is what these assert.
 *
 * The pulse is `0.85 + sin(glowPulse) * 0.2`, so the lowest fever intensity is
 * 0.65: there is no phase at which fever is on but the guard reads false.
 */
type BirdInternals = { glow: PointLight; bodyMat: { emissiveIntensity: number } };
const glowOf = (bird: Bird): PointLight => (bird as unknown as BirdInternals).glow;
const emissiveOf = (bird: Bird): number => (bird as unknown as BirdInternals).bodyMat.emissiveIntensity;

const SCENE = new TerrainSystem("fever-glow");
const surface = (bird: Bird) => SCENE.heightAt(bird.x) + 40;

function sync(bird: Bird, fever: boolean, time: number, dt = 1 / 60): void {
  bird.syncVisual(dt, false, fever, time, SCENE, bird.x, surface(bird));
}

describe("fever glow", () => {
  it("is hidden outside fever and lit during it, at every phase", () => {
    const bird = new Bird();
    bird.reset(0, surface(bird));

    sync(bird, false, 0);
    expect(glowOf(bird).intensity).toBe(0);
    expect(glowOf(bird).visible).toBe(false);

    // Sweep a whole pulse period. Fever must be visible at every phase, and
    // the intensity floor has to stay clear of the guard's threshold.
    for (let i = 0; i < 64; i++) {
      const time = (i / 64) * (Math.PI * 2);
      sync(bird, true, time);
      expect(glowOf(bird).visible).toBe(true);
      expect(glowOf(bird).intensity).toBeGreaterThan(0);
      expect(glowOf(bird).intensity).toBeGreaterThanOrEqual(0.65);
    }
    bird.dispose();
  });

  it("goes dark on the first non-fever frame after fever, and back on the next", () => {
    const bird = new Bird();
    bird.reset(0, surface(bird));

    sync(bird, true, 0.3);
    expect(glowOf(bird).visible).toBe(true);

    sync(bird, false, 0.316);
    expect(glowOf(bird).intensity).toBe(0);
    expect(glowOf(bird).visible).toBe(false);

    sync(bird, true, 0.333);
    expect(glowOf(bird).visible).toBe(true);
    bird.dispose();
  });

  it("keeps the fever emissive pop, which is the other half of the feedback", () => {
    const bird = new Bird();
    bird.reset(0, surface(bird));
    sync(bird, false, 0);
    expect(emissiveOf(bird)).toBe(0);

    sync(bird, true, 0.3);
    expect(emissiveOf(bird)).toBeGreaterThan(0);
    bird.dispose();
  });

  it("is a real PointLight parented into the scene graph, so hiding it is the only change", () => {
    const bird = new Bird();
    expect(glowOf(bird).isPointLight).toBe(true);
    // The guard must not swap or reparent the light — that would change what
    // it lights during fever. Position is relative to the bird root.
    expect(glowOf(bird).parent).toBe(bird.root);
    expect(glowOf(bird).position.toArray()).toEqual([0, 0.4, 1]);
    expect(glowOf(bird).distance).toBe(18);
    expect(glowOf(bird).decay).toBe(2);
    expect(glowOf(bird).color.getHex()).toBe(0xffe08a);
    bird.dispose();
  });
});
