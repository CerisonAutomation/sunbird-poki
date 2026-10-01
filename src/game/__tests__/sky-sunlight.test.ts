import { describe, expect, it } from "vitest";

import { skyBodies, skyStops, skyStopsAt, type SkyStop } from "../Sky";

/**
 * The sun used to be a fixed `22 + t * 64` units up, which never set, a moon
 * that was up whenever `1 - t > 0.15` (most of a run), a key light frozen at
 * 72 units and shining all night, and a menu pinned at the single dead point of
 * a blue-to-cream gradient. Each of those is a claim about the sky's MODEL, and
 * the model is pure data — so it is tested as data, without a WebGL context.
 */

/** Where the sun disc sits at a given daylight level, in world units. */
function sunElevationAt(t: number): number {
  const { a, b, u } = skyStopsAt(t);
  return a.sunElev + (b.sunElev - a.sunElev) * u;
}

// Both gates are read out of `skyBodies` rather than restated here. A test that
// re-derives the rule it is testing is a test that keeps passing after the rule
// changes underneath it, which is how the eight-unit overlap this file exists to
// pin survived in the first place.
const sunIsUp = (t: number): boolean => skyBodies(sunElevationAt(t)).sun > 0;
const moonIsUp = (t: number): boolean => skyBodies(sunElevationAt(t)).moon > 0;

function sat(hex: number): number {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return mx === 0 ? 0 : ((mx - mn) / mx) * 100;
}

/** The horizon colour actually rendered at `t`, after the stop interpolation. */
function horizonAt(t: number): number {
  const { a, b, u } = skyStopsAt(t);
  const mix = (x: number, y: number): number => {
    const rx = (x >> 16) & 255;
    const gx = (x >> 8) & 255;
    const bx = x & 255;
    const ry = (y >> 16) & 255;
    const gy = (y >> 8) & 255;
    const by = y & 255;
    const ch = (p: number, q: number): number => Math.round(p + (q - p) * u);
    return (ch(rx, ry) << 16) | (ch(gx, gy) << 8) | ch(bx, by);
  };
  return mix(a.horizon, b.horizon);
}

/** Every stop the render can actually reach, by identity. */
function reachableStops(): Set<SkyStop> {
  const seen = new Set<SkyStop>();
  for (let t = 0; t <= 1.0001; t += 0.0005) {
    const { a, b } = skyStopsAt(t);
    seen.add(a);
    seen.add(b);
  }
  return seen;
}

describe("the sun sets", () => {
  it("is above the horizon when a run launches and below it when the run ends", () => {
    // A run spends its daylight meter, so t = 1 is the launch and t = 0 is the
    // instant the run ends for running out of light.
    expect(sunElevationAt(1), "the sun must be up at the start of a run").toBeGreaterThan(0);
    expect(sunElevationAt(0), "the sun must have SET by the end of a run").toBeLessThan(0);
  });

  it("is actually set over the last stretch of daylight, not just at zero", () => {
    // "Golden hour" is the last 22% of the clock. If the sun is still high
    // there, the run's most dramatic phase is lit like a flat noon.
    expect(sunElevationAt(0.22), "golden hour must be a low sun").toBeLessThan(26);
    expect(sunElevationAt(0.05), "the last of the light must be on the horizon")
      .toBeLessThan(6);
  });

  it("descends through the whole back half of a run", () => {
    // t falls 1 -> 0 in flight, so this is the order the player actually sees.
    const descent = [0.7, 0.6, 0.5, 0.4, 0.3, 0.22, 0.1, 0].map(sunElevationAt);
    for (let i = 1; i < descent.length; i++) {
      expect(descent[i]!, `the sun must keep setting (step ${i}: ${descent.join(" -> ")})`)
        .toBeLessThan(descent[i - 1]!);
    }
  });

  it("climbs to a high point at midday rather than sliding monotonically", () => {
    // The palette's own landmarks: t=0.7 is commented as midday blue and t=1
    // as late afternoon, so the arc has to peak between them. A sun that only
    // ever descends would be contradicting the stops it is stored in.
    expect(sunElevationAt(0.7), "midday is the high point of the arc")
      .toBeGreaterThan(60);
  });
});

describe("only one body is ever up", () => {
  it("never shows the sun and the moon together", () => {
    for (let t = 0; t <= 1.0001; t += 0.002) {
      expect(sunIsUp(t) && moonIsUp(t), `two bodies in the sky at t=${t.toFixed(3)}`).toBe(false);
    }
  });

  it("hands over rather than leaving a gap with nothing in the sky", () => {
    // The complement of the test above: a handoff that skipped a band would
    // leave the sky empty, which is its own kind of wrong.
    for (let t = 0; t <= 1.0001; t += 0.002) {
      expect(sunIsUp(t) || moonIsUp(t), `an empty sky at t=${t.toFixed(3)}`).toBe(true);
    }
  });
});

describe("the sky never goes grey between two stops", () => {
  it("keeps the horizon saturated across the whole cycle", () => {
    // Blue (t=0.7) to cream (t=1) are near-complements, so a direct lerp
    // between them measured 63.0% -> 10.4% saturation: a dead grey sky, and
    // the main menu was pinned at t=0.86, right inside it.
    let worst = Infinity;
    let worstAt = 0;
    for (let t = 0; t <= 1.0001; t += 0.002) {
      const s = sat(horizonAt(t));
      if (s < worst) {
        worst = s;
        worstAt = t;
      }
    }
    expect(worst, `the horizon desaturates to ${worst.toFixed(1)}% at t=${worstAt.toFixed(2)}`)
      .toBeGreaterThan(25);
  });

  it("keeps the zenith saturated too", () => {
    let worst = Infinity;
    let worstAt = 0;
    for (let t = 0; t <= 1.0001; t += 0.002) {
      const { a, b, u } = skyStopsAt(t);
      const r = Math.round(((a.top >> 16) & 255) + (((b.top >> 16) & 255) - ((a.top >> 16) & 255)) * u);
      const g = Math.round(((a.top >> 8) & 255) + (((b.top >> 8) & 255) - ((a.top >> 8) & 255)) * u);
      const bl = Math.round((a.top & 255) + ((b.top & 255) - (a.top & 255)) * u);
      const mx = Math.max(r, g, bl);
      const mn = Math.min(r, g, bl);
      const s = mx === 0 ? 0 : ((mx - mn) / mx) * 100;
      if (s < worst) {
        worst = s;
        worstAt = t;
      }
    }
    expect(worst, `the zenith desaturates to ${worst.toFixed(1)}% at t=${worstAt.toFixed(2)}`)
      .toBeGreaterThan(30);
  });
});

describe("every stop agrees with itself", () => {
  it("declares a sun height, so no stop can be added with a colour but no sun", () => {
    const stops = skyStops().map((e) => e.s);
    expect(stops.length, "expected several distinct palette stops").toBeGreaterThan(3);
    for (const s of stops) {
      expect(Number.isFinite(s.sunElev), "a stop is missing its sunElev").toBe(true);
    }
  });

  it("can actually reach every stop it declares", () => {
    // A stop that no bracket starts is a colour that is never rendered. This
    // is not hypothetical: the rose stop added to kill the grey band was
    // written after the t=1 entry, so the 0.7 -> 1.0 bracket swallowed its
    // whole range and the leg it was added to fix went back to being blue
    // straight into cream. `skyStopsAt(t).a` must BE the stop at `t`.
    const reachable = reachableStops();
    for (const { t, s } of skyStops()) {
      expect(reachable.has(s), `the stop at t=${t} is never sampled by the lookup`)
        .toBe(true);
    }
    const times = skyStops().map((e) => e.t);
    expect([...times].sort((x, y) => x - y), "palette stops must ascend in t")
      .toEqual(times);
  });

  it("has a night stop that is genuinely below the horizon", () => {
    const night = skyStopsAt(0).a;
    expect(night.sunElev, "the night stop must put the sun under the horizon")
      .toBeLessThan(0);
    expect(sat(night.horizon), "night must still be a colour, not black")
      .toBeGreaterThan(40);
  });
});
