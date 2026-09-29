import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RAMP_START } from "../constants";
import { TerrainSystem } from "../TerrainSystem";
import { Weather } from "../Weather";

/**
 * The opening of a run is the whole onboarding.
 *
 * Island 0 used to push its first thermal out to x >= 330. A new player
 * launches, discovers the one verb the game has — hold — and then holds, for
 * three hundred metres, before the verb the game is built around has any
 * reason to fire. Two independent reviews converged on this as the 30-second
 * quit. So island 0 now gets one guaranteed thermal just past the ramp.
 *
 * These pin the properties that make it ONBOARDING rather than a gift: it is
 * reachable, it is past the ramp, and it rewards a good launch.
 */
// jsdom ships no 2D context and the storm sprite is built with one. Same stub
// as collectibles.test.ts / weather.test.ts; only the calls the constructor
// makes are provided, so anything else fails loudly instead of silently
// returning undefined.
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    clearRect() {}, beginPath() {}, arc() {}, fill() {}, fillRect() {},
    strokeText() {}, fillText() {}, save() {}, restore() {},
    createRadialGradient: () => ({ addColorStop() {} }),
  } as unknown as CanvasRenderingContext2D);
});
afterEach(() => vi.restoreAllMocks());

describe("the opening thermal", () => {
  const setup = (seed = "opening-lift") => {
    const terrain = new TerrainSystem(seed);
    const w = new Weather(terrain.seedN);
    return { terrain, w };
  };
  // run the same warm-up the game does
  const warm = (w: Weather, t: TerrainSystem) => {
    w.update(1 / 60, 0, { x: 64, y: 40, vx: 0, vy: 0, grounded: true, inWater: false, asleep: false } as never, t as never, false, {
      onThermalEnter() {}, onGustStart() {}, onStormHit() {},
    });
  };

  it("exists on island 0, and is the first thing the player can meet", () => {
    const { terrain, w } = setup();
    warm(w, terrain);
    // Only thermals past the ramp count. A run slides GROUNDED from x=64 to
    // RAMP_START (1470), so a column at x=434 exists but the bird is not in
    // the air to meet it — those are scenery until launch. What the player
    // needs is the first column they can reach while flying.
    const xs = w.activeThermals.filter((t) => t.x > RAMP_START).map((t) => t.x).sort((a, b) => a - b);
    expect(xs.length, "island 0 must open with a reachable thermal").toBeGreaterThan(0);
    expect(xs[0], "the first flyable thermal must come soon after the ramp")
      .toBeLessThan(RAMP_START + 220);
  });

  it("sits past the launch ramp, so it cannot be reached on the ground", () => {
    const { terrain, w } = setup();
    warm(w, terrain);
    const first = w.activeThermals.filter((t) => t.x > RAMP_START).map((t) => t.x).sort((a, b) => a - b)[0]!;
    expect(first).toBeGreaterThan(RAMP_START);
  });

  it("reaches high enough above the ground to be worth riding", () => {
    const { terrain, w } = setup();
    warm(w, terrain);
    const t = w.activeThermals.filter((t) => t.x > RAMP_START).sort((a, b) => a.x - b.x)[0]!;
    // A column you cannot gain height from is a visual, not a mechanic.
    // `Thermal` carries {x, w, top} — no ground — so the ground comes from the
    // terrain, which is the same authority the physics samples.
    expect(t.top - terrain.heightAt(t.x)).toBeGreaterThan(30);
  });

  it("is deterministic for a seed, like every other thermal", () => {
    const a = setup("same-seed");
    const b = setup("same-seed");
    warm(a.w, a.terrain);
    warm(b.w, b.terrain);
    expect(a.w.activeThermals.map((t) => t.x))
      .toEqual(b.w.activeThermals.map((t) => t.x));
  });

  it("lifts an airborne bird that lets go inside it", () => {
    // The actual payoff: release is now the thing that works, immediately.
    const { terrain, w } = setup();
    warm(w, terrain);
    const t = w.activeThermals.filter((t) => t.x > RAMP_START).sort((a, b) => a.x - b.x)[0]!;
    const g = terrain.heightAt(t.x);
    const bird = { x: t.x, y: g + 8, vx: 30, vy: -12, grounded: false, inWater: false, asleep: false } as never;
    for (let i = 0; i < 30; i++) {
      w.update(1 / 60, i / 60, bird, terrain as never, false, { onThermalEnter() {}, onGustStart() {}, onStormHit() {} });
    }
    expect((bird as { vy: number }).vy, "letting go in the opening column gains height")
      .toBeGreaterThan(0);
  });
});
