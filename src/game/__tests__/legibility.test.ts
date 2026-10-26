import { describe, expect, it } from "vitest";
import {
  AVATAR_MIN_CONTRAST,
  TERRAIN_SKY_MIN_CONTRAST,
  channelFromLinear,
  channelToLinear,
  contrastRatio,
  enforceMinContrast,
  luminanceForContrast,
  nightFillIntensity,
  relativeLuminance,
  withLuminance,
  type Rgb,
} from "../legibility";

const hex = (h: number): Rgb => ({
  r: ((h >> 16) & 255) / 255,
  g: ((h >> 8) & 255) / 255,
  b: (h & 255) / 255,
});
const lum = (c: Rgb) => relativeLuminance(c.r, c.g, c.b);
const ratio = (a: Rgb, b: Rgb) => contrastRatio(lum(a), lum(b));

describe("sRGB transfer", () => {
  it("round-trips", () => {
    for (const v of [0, 0.02, 0.04045, 0.2, 0.5, 0.9, 1]) {
      expect(channelFromLinear(channelToLinear(v))).toBeCloseTo(v, 6);
    }
  });

  it("matches the WCAG anchors", () => {
    expect(relativeLuminance(0, 0, 0)).toBe(0);
    expect(relativeLuminance(1, 1, 1)).toBeCloseTo(1, 6);
    // Black on white is the canonical 21:1.
    expect(contrastRatio(0, 1)).toBeCloseTo(21, 3);
  });

  it("is symmetric and never below 1", () => {
    expect(contrastRatio(0.3, 0.7)).toBeCloseTo(contrastRatio(0.7, 0.3), 12);
    expect(contrastRatio(0.42, 0.42)).toBeCloseTo(1, 12);
  });
});

describe("luminanceForContrast", () => {
  it("solves exactly in both directions", () => {
    const darker = luminanceForContrast(0.5, 3, true);
    expect(darker).not.toBeNull();
    expect(contrastRatio(darker!, 0.5)).toBeCloseTo(3, 9);
    const lighter = luminanceForContrast(0.05, 3, false);
    expect(lighter).not.toBeNull();
    expect(contrastRatio(lighter!, 0.05)).toBeCloseTo(3, 9);
  });

  it("returns null rather than clamping when the direction has no headroom", () => {
    // Nothing darker than black can clear 5:1 against a near-black sky.
    expect(luminanceForContrast(0.01, 5, true)).toBeNull();
    // Nothing lighter than white can clear 5:1 against a near-white sky.
    expect(luminanceForContrast(0.95, 5, false)).toBeNull();
  });
});

describe("withLuminance", () => {
  it("hits the requested luminance", () => {
    for (const c of [0x2f6f4e, 0x8b2f1a, 0x123456, 0xffcc00]) {
      for (const target of [0.02, 0.18, 0.5, 0.86]) {
        expect(lum(withLuminance(hex(c), target))).toBeCloseTo(target, 3);
      }
    }
  });

  it("preserves hue order when there is headroom", () => {
    // A teal hill lifted stays teal: green still dominates red.
    const out = withLuminance(hex(0x14463f), 0.25);
    expect(out.g).toBeGreaterThan(out.r);
    expect(out.b).toBeGreaterThan(out.r);
  });

  it("handles pure black without dividing by zero", () => {
    const out = withLuminance({ r: 0, g: 0, b: 0 }, 0.4);
    expect(lum(out)).toBeCloseTo(0.4, 3);
    expect(out.r).toBeCloseTo(out.g, 9);
    expect(out.g).toBeCloseTo(out.b, 9);
  });

  it("stays inside gamut", () => {
    for (const c of [0x000000, 0xffffff, 0xff0000, 0x0000ff, 0x336699]) {
      for (const target of [0, 0.001, 0.5, 0.999, 1]) {
        const out = withLuminance(hex(c), target);
        for (const ch of [out.r, out.g, out.b]) {
          expect(ch).toBeGreaterThanOrEqual(0);
          expect(ch).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe("enforceMinContrast", () => {
  it("is the identity when the art already clears the floor", () => {
    const fg = hex(0x0d2a22);
    const bg = hex(0xbfe4ff);
    expect(ratio(fg, bg)).toBeGreaterThan(TERRAIN_SKY_MIN_CONTRAST);
    expect(enforceMinContrast(fg, bg, TERRAIN_SKY_MIN_CONTRAST)).toBe(fg);
  });

  it("rescues the captured dusk frame: dark teal hills on a maroon sky", () => {
    // Sampled from shots/g-gameover.png, the frame where the world stopped
    // being readable: these two were within a hair of each other.
    const hills = hex(0x123c3a);
    const sky = hex(0x2a1218);
    expect(ratio(hills, sky)).toBeLessThan(TERRAIN_SKY_MIN_CONTRAST);
    const fixed = enforceMinContrast(hills, sky, TERRAIN_SKY_MIN_CONTRAST);
    expect(ratio(fixed, sky)).toBeGreaterThanOrEqual(TERRAIN_SKY_MIN_CONTRAST - 1e-6);
    // Still a teal hill, not a grey one and not a white one.
    expect(fixed.g).toBeGreaterThan(fixed.r);
    expect(lum(fixed)).toBeLessThan(0.5);
  });

  it("darkens instead of lightening when the sky is the bright side", () => {
    const fg = hex(0x9fb8c4);
    const bg = hex(0xd9ecff);
    const fixed = enforceMinContrast(fg, bg, 2.4);
    expect(lum(fixed)).toBeLessThan(lum(fg));
    expect(ratio(fixed, bg)).toBeGreaterThanOrEqual(2.4 - 1e-6);
  });

  it("crosses over when the preferred direction cannot reach the floor", () => {
    // Near-black foreground on a near-black sky: darker is impossible, so it
    // must go lighter rather than quietly returning something illegible.
    const fg = hex(0x050505);
    const bg = hex(0x0a0a0a);
    const fixed = enforceMinContrast(fg, bg, 4);
    expect(lum(fixed)).toBeGreaterThan(lum(bg));
    expect(ratio(fixed, bg)).toBeGreaterThanOrEqual(4 - 1e-6);
  });

  it("holds the floor across the whole day cycle for a fixed hill colour", () => {
    const hill = hex(0x1d5140);
    const skies = [0xbfe4ff, 0x8fc4ee, 0xf0a06a, 0x6a3550, 0x2a1218, 0x0a1038];
    for (const s of skies) {
      const fixed = enforceMinContrast(hill, hex(s), TERRAIN_SKY_MIN_CONTRAST);
      expect(ratio(fixed, hex(s))).toBeGreaterThanOrEqual(TERRAIN_SKY_MIN_CONTRAST - 1e-6);
    }
  });

  it("gives the player avatar a stricter floor than scenery", () => {
    expect(AVATAR_MIN_CONTRAST).toBeGreaterThan(TERRAIN_SKY_MIN_CONTRAST);
  });

  it("is idempotent", () => {
    const once = enforceMinContrast(hex(0x123c3a), hex(0x2a1218), TERRAIN_SKY_MIN_CONTRAST);
    const twice = enforceMinContrast(once, hex(0x2a1218), TERRAIN_SKY_MIN_CONTRAST);
    expect(lum(twice)).toBeCloseTo(lum(once), 6);
  });
});

describe("nightFillIntensity", () => {
  it("never touches daylight", () => {
    expect(nightFillIntensity(1)).toBe(0);
    expect(nightFillIntensity(0.55)).toBe(0);
    expect(nightFillIntensity(0.8)).toBe(0);
  });

  it("peaks at midnight and stays inside its budget", () => {
    expect(nightFillIntensity(0)).toBeCloseTo(0.34, 6);
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const v = nightFillIntensity(t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0.34 + 1e-9);
    }
  });

  it("is monotonic as the light fails, with no pump during the transition", () => {
    let prev = -1;
    for (let t = 1; t >= -0.0001; t -= 0.01) {
      const v = nightFillIntensity(t);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });

  it("eases in and out rather than ramping linearly", () => {
    // A smoothstep's midpoint value equals half the peak, but its slope at the
    // ends is zero — that is what stops the fill reading as a light switch.
    expect(nightFillIntensity(0.275)).toBeCloseTo(0.17, 2);
    expect(nightFillIntensity(0.54)).toBeLessThan(0.002);
    expect(nightFillIntensity(0.01)).toBeGreaterThan(0.33);
  });

  it("tolerates junk input", () => {
    expect(nightFillIntensity(Number.NaN)).toBeCloseTo(0.34, 6);
    expect(nightFillIntensity(-5)).toBeCloseTo(0.34, 6);
    expect(nightFillIntensity(5)).toBe(0);
  });
});
