import { describe, expect, it } from "vitest";

import { BIOMES, biomeForIsland } from "../Biomes";
import { GLIDE_LIFT_MAX } from "../constants";

/**
 * Per-biome lift is what makes one island feel different to FLY over another.
 *
 * The parent monorepo has these values; this fork had lost them, so every world
 * glided identically no matter what its hills and sky were doing. That is why
 * the islands read as reskins: the terrain changed and the flight did not.
 * Restored from the parent's tuned set.
 */
describe("per-biome lift", () => {
  it("every hand-tuned biome declares one", () => {
    for (const b of BIOMES) {
      expect(b.liftMult, `${b.id} has no liftMult`).toBeTypeOf("number");
      expect(Number.isFinite(b.liftMult), b.id).toBe(true);
    }
  });

  it("actually varies — a uniform value is the bug, not the feature", () => {
    const values = new Set(BIOMES.map((b) => b.liftMult));
    expect(values.size, "every biome has the same lift — nothing to feel").toBeGreaterThan(4);
  });

  it("stays in a band that reads as feel rather than as a different game", () => {
    for (const b of BIOMES) {
      // Too flat and the worlds feel identical; too wide and a biome is a
      // different control scheme wearing the same bird.
      expect(b.liftMult, `${b.id} = ${b.liftMult}`).toBeGreaterThan(0.85);
      expect(b.liftMult, `${b.id} = ${b.liftMult}`).toBeLessThan(1.2);
    }
  });

  it("has both floaty and heavy worlds, not a single direction of drift", () => {
    // A band of 1.02-1.12 everywhere would be "everything floats now", which is
    // as same-y as everything sinking.
    const floats = BIOMES.filter((b) => b.liftMult > 1.01);
    const sinks = BIOMES.filter((b) => b.liftMult < 0.99);
    expect(floats.length, "no world rewards a lazy glide").toBeGreaterThan(0);
    expect(sinks.length, "no world punishes one").toBeGreaterThan(0);
  });

  it("caps lift at the engine ceiling regardless of biome", () => {
    // The engine clamps lift to 0.85 so it can never exceed gravity and
    // produce free altitude. A biome must not be able to break that.
    for (const b of BIOMES) {
      expect(b.liftMult * GLIDE_LIFT_MAX, b.id).toBeLessThan(0.85);
    }
  });

  it("remixed islands drift lift per lap, deterministically", () => {
    // Past the hand-tuned set, `biomeForIsland` remixes. A remixed island that
    // only changes colour is a recolour; lift is what makes the lap a new place.
    const first = biomeForIsland(BIOMES.length);
    const again = biomeForIsland(BIOMES.length);
    expect(again.liftMult, "same island must be stable for a seed").toBe(first.liftMult);
    // A later lap should not be identical to the first.
    const later = biomeForIsland(BIOMES.length * 2);
    expect(later.liftMult).not.toBe(first.liftMult);
    expect(later.liftMult).toBeGreaterThan(0.8);
    expect(later.liftMult).toBeLessThan(1.25);
  });
});
