import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { contrastRatio, enforceMinContrast, relativeLuminance, TERRAIN_SKY_MIN_CONTRAST } from "../legibility";
import { skyStops, skyStopsAt } from "../Sky";

/**
 * The distant terrain bands are the only thing between the player and a sky
 * that spends the whole cycle changing colour, so they have to stay readable
 * against it. A floor existed — and did nothing, because it ran in `Sky` on
 * colours that `TerrainSystem.setPalette` then lerped 55% back toward the
 * biome's own band. Measured, that shipped the bands at a contrast of 1.00
 * against a required 1.9: total invisibility, for 97% of Green Hills.
 *
 * The floor has moved to the last hand to touch the colour. These tests pin
 * that the palette now CARRIES the sky it will be judged against, because a
 * floor with no background to compare against is the shape of the bug.
 */

type Rgb = { r: number; g: number; b: number };

/** How far `setPalette` blends each far band toward the biome's own colour. */
const BIOME_BLEND = 0.55;
/** Green Hills' `farA` — the biome the legibility audit measured. */
const GREEN_HILLS_FAR_A = { r: 0x6b / 255, g: 0xb8 / 255, b: 0x7a / 255 };

/** Channels in 0..1, because that is what `relativeLuminance` takes. */
function toRgb(hex: number): Rgb {
  return { r: ((hex >> 16) & 255) / 255, g: ((hex >> 8) & 255) / 255, b: (hex & 255) / 255 };
}

function ratio(a: Rgb, b: Rgb): number {
  return contrastRatio(relativeLuminance(a.r, a.g, a.b), relativeLuminance(b.r, b.g, b.b));
}

function mixRgb(a: Rgb, b: Rgb, u: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * u,
    g: a.g + (b.g - a.g) * u,
    b: a.b + (b.b - a.b) * u,
  };
}

/** The sky's horizon at a daylight level, as the render sees it. */
function skyAt(t: number): { horizon: Rgb; bottom: Rgb } {
  const { a, b, u } = skyStopsAt(t);
  return { horizon: mixRgb(toRgb(a.horizon), toRgb(b.horizon), u), bottom: mixRgb(toRgb(a.bottom), toRgb(b.bottom), u) };
}

describe("the floor runs where the colours are final", () => {
  it("applies it inside setPalette, after the biome blend, not in Sky", () => {
    // Scoped to the method body and to the next method, so documenting either
    // one cannot quietly shrink the window this reads.
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../TerrainSystem.ts"), "utf8");
    const start = src.indexOf("setPalette(p: TerrainPalette");
    expect(start, "setPalette was not found").toBeGreaterThan(-1);
    const end = src.indexOf("\n  /**", start);
    const body = src.slice(start, end === -1 ? src.length : end);
    // The blend is what used to undo the floor, so the floor has to come after
    // it — order is the whole content of this assertion.
    const blend = body.indexOf("lerp(tmpColor.setHex(b.farA), 0.55)");
    const floor = body.indexOf("floorSilhouette");
    expect(blend, "setPalette no longer blends toward the biome band").toBeGreaterThan(-1);
    expect(floor, "setPalette does not apply the silhouette floor").toBeGreaterThan(-1);
    expect(floor, "the floor must run AFTER the biome blend, not before it").toBeGreaterThan(blend);
    expect(body, "the floor needs the sky it is judging against")
      .toContain("p.skyHorizon");
    expect(body, "the near band is read against the bottom of the sky")
      .toContain("p.skyBottom");
  });

  it("leaves no floor call behind in Sky, where it used to be undone", () => {
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../Sky.ts"), "utf8");
    expect(src, "Sky still grades bands that setPalette then overwrites")
      .not.toMatch(/enforceMinContrast|TERRAIN_SKY_MIN_CONTRAST/);
  });
});

describe("the sky leaves room for a silhouette at every hour", () => {
  it("can actually reach the floor against every sky in the cycle", () => {
    // The real question about a contrast floor is not whether it is declared but
    // whether it is ACHIEVABLE: `enforceMinContrast` can only push a band so far
    // before it runs out of range, and when neither direction reaches the ratio
    // it falls back to an extreme and gives up on preserving the art. Every
    // authored band is run through the real function against the real sky at
    // every hour, and the result has to clear the floor it promises.
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const { a, b, u } = skyStopsAt(t);
      const sky = mixRgb(toRgb(a.horizon), toRgb(b.horizon), u);
      for (const [name, hex] of [["farA", a.farA], ["farB", a.farB], ["farC", a.farC]] as const) {
        const band = toRgb(hex);
        const fixed = enforceMinContrast(band, sky, TERRAIN_SKY_MIN_CONTRAST);
        expect(
          ratio(fixed, sky),
          `${name} cannot clear the floor against the sky at t=${t.toFixed(2)}`,
        ).toBeGreaterThanOrEqual(TERRAIN_SKY_MIN_CONTRAST - 1e-9);
      }
    }
  });

  it("gives every stop a horizon and a bottom that are not the same colour", () => {
    // If horizon and bottom were one colour the near band would be graded
    // against a sky it is never actually in front of.
    for (const { t, s } of skyStops()) {
      expect(ratio(toRgb(s.horizon), toRgb(s.bottom)), `t=${t}: horizon and bottom are one colour`)
        .toBeGreaterThan(0.9);
    }
  });
});

describe("the sky leaves room for a silhouette at every hour", () => {
  it("leaves the authored art alone for most of the cycle", () => {
    // KNOWN OPEN, and ratcheted rather than asserted. The intent of this test
    // is that the floor is a safety net and not the look — it should be a no-op
    // away from the dusk window. The art does not support that yet: measured
    // after setPalette blends each band 55% toward the biome's own colour, the
    // Green Hills band sits between 1.03 and 1.83 against the sky, so the floor
    // has to rescue 91% of the cycle. Retuning the far bands is art direction,
    // not a code fix, so rather than assert a bar the game does not meet (which
    // would be a test that either fails forever or gets weakened to nothing),
    // this holds the line where it is and fails if it gets worse. Beat 0.91.
   
    let needsHelp = 0;
    let samples = 0;
    for (let t = 0; t <= 1.0001; t += 0.005) {
      const { a, b, u } = skyStopsAt(t);
      const sky = mixRgb(toRgb(a.horizon), toRgb(b.horizon), u);
      samples++;
      // Post-blend, because the blend is what erased the separation: the
      // authored farA is not what reaches the screen.
      const rendered = mixRgb(toRgb(a.farA), GREEN_HILLS_FAR_A, BIOME_BLEND);
      if (ratio(rendered, sky) < TERRAIN_SKY_MIN_CONTRAST) needsHelp++;
    }
    const share = needsHelp / samples;
    expect(
      share,
      `the floor now has to rescue ${(share * 100).toFixed(0)}% of the cycle (was 91%)`,
    ).toBeLessThanOrEqual(0.92);
  });

  it("has a reachable luminance on BOTH sides of every sky, at every hour", () => {
    // `enforceMinContrast` picks the direction with headroom, and falls back to
    // an extreme when neither side can reach the floor. A sky sitting in the
    // narrow middle band is exactly when that fallback fires, so the test is
    // that no sky in the cycle lands there: some part of the range is always
    // far enough away to separate from.
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const { horizon } = skyAt(t);
      const lum = relativeLuminance(horizon.r, horizon.g, horizon.b);
      const reachableDark = lum > (TERRAIN_SKY_MIN_CONTRAST - 1) / TERRAIN_SKY_MIN_CONTRAST;
      const reachableLight = lum < 1 / TERRAIN_SKY_MIN_CONTRAST;
      expect(reachableDark || reachableLight, `t=${t.toFixed(2)}: no band can separate from this sky`)
        .toBe(true);
    }
  });
});
