import { describe, expect, it } from "vitest";
import { BIOMES, biomeForIsland } from "../Biomes";
import type { BiomeMusicStyle } from "../Music";

// Every island in the base set must have a distinct musicMode — the whole
// point of assigning styles is that each world sounds different.
describe("island music uniqueness", () => {
  it("every hand-authored biome has a unique musicMode", () => {
    const modes = BIOMES.map((b) => b.musicMode);
    const unique = new Set(modes);
    expect(unique.size).toBe(modes.length);
  });

  it("biomeForIsland returns the correct hand-authored mode for islands 0–9", () => {
    const expected: BiomeMusicStyle[] = [
      "bright",   // 0 Green Hills
      "airy",     // 1 Tropical Atoll
      "reef",     // 2 Coral Reach
      "warm",     // 3 Sunset Ridge
      "wide",     // 4 Dune Sea
      "night",    // 5 Midnight Coast
      "crystal",  // 6 Aurora Peaks
      "ember",    // 7 Cinder Forge
      "canyon",   // 8 Skyreach Canyon
      "amethyst", // 9 Amethyst Hollow
    ];
    for (let i = 0; i < expected.length; i++) {
      expect(biomeForIsland(i).musicMode).toBe(expected[i]);
    }
  });

  it("wild islands beyond the base set inherit a valid musicMode", () => {
    const valid: BiomeMusicStyle[] = [
      "bright", "warm", "airy", "wide", "night", "crystal", "reef", "ember", "canyon", "amethyst",
    ];
    for (const idx of [10, 11, 19, 20, 29]) {
      expect(valid).toContain(biomeForIsland(idx).musicMode);
    }
  });

  it("all ten styles are represented in the first 30 islands", () => {
    const modes = new Set<BiomeMusicStyle>();
    for (let i = 0; i < 30; i++) modes.add(biomeForIsland(i).musicMode as BiomeMusicStyle);
    // All 10 base styles appear within 3 full laps.
    expect(modes.size).toBe(10);
  });
});
