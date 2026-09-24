import { describe, expect, it } from "vitest";
import {
  SPEED_BANDS,
  WEE_ARM_BELOW,
  WEE_FIRE_ABOVE,
  WEE_MIN_DIVE,
  afterimageAlpha,
  diveKick,
  fxScale,
  streakOpacity,
  vignetteIntensity,
  warpLevel,
  warpT,
  weeCheck,
  whooshRate,
} from "../SpeedFeel";

/**
 * Speed feel is the difference between a game that *is* fast and one that
 * *reads* fast. These lock the shared curves: effects must ramp together
 * instead of popping at unrelated thresholds, the dive kick must only exist
 * when the player is actually falling, the celebration must be gated by
 * hysteresis, and a weak device must lose particles rather than frames.
 */
describe("warpT / warpLevel", () => {
  it("is silent below the cruise band", () => {
    expect(warpT(0)).toBe(0);
    expect(warpT(SPEED_BANDS.cruise)).toBe(0);
    expect(warpLevel(0.2)).toBe(0);
    expect(warpLevel(SPEED_BANDS.cruise - 0.01)).toBe(0);
  });

  it("ramps continuously and clamps at the warp band", () => {
    const mid = (SPEED_BANDS.cruise + SPEED_BANDS.warp) / 2;
    expect(warpT(mid)).toBeCloseTo(0.5, 5);
    expect(warpT(SPEED_BANDS.warp)).toBe(1);
    expect(warpT(1.2)).toBe(1);
  });

  it("is monotonic — effects never duck as the player accelerates", () => {
    let prev = -1;
    for (let s = 0; s <= 1.2; s += 0.02) {
      const t = warpT(s);
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });

  it("maps the bands to discrete levels", () => {
    expect(warpLevel(SPEED_BANDS.cruise)).toBe(1);
    expect(warpLevel(SPEED_BANDS.rush)).toBe(2);
    expect(warpLevel(SPEED_BANDS.warp)).toBe(3);
  });

  it("fails safe on garbage input: no FX rather than max FX", () => {
    expect(warpT(Number.NaN)).toBe(0);
    expect(warpLevel(Number.NaN)).toBe(0);
    expect(warpLevel(Number.POSITIVE_INFINITY)).toBe(0);
    expect(warpLevel(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(warpT(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("diveKick", () => {
  it("adds FOV only when falling fast above the rush band", () => {
    expect(diveKick(-30, 1)).toBeGreaterThan(4);
    expect(diveKick(-30, SPEED_BANDS.warp)).toBeLessThanOrEqual(6);
  });

  it("is zero when climbing, gliding flat or slow", () => {
    expect(diveKick(12, 1)).toBe(0);
    expect(diveKick(0, 1)).toBe(0);
    expect(diveKick(-30, 0.2)).toBeCloseTo(0, 5);
    expect(diveKick(-30, SPEED_BANDS.cruise)).toBe(0);
  });

  it("caps at the configured maximum however hard the dive", () => {
    expect(diveKick(-400, 1.2)).toBeLessThanOrEqual(6);
    expect(diveKick(Number.NaN, 1)).toBe(0);
  });

  it("grows monotonically with dive power", () => {
    let prev = -1;
    for (let vy = 0; vy >= -40; vy -= 2) {
      const k = diveKick(vy, 1);
      expect(k).toBeGreaterThanOrEqual(prev);
      prev = k;
    }
  });
});

describe("streakOpacity / vignetteIntensity / afterimageAlpha", () => {
  it("keeps the frame readable at rest", () => {
    expect(streakOpacity(0)).toBe(0);
    expect(streakOpacity(0.3)).toBe(0);
    expect(vignetteIntensity(0.4)).toBe(0);
    expect(afterimageAlpha(0.7)).toBe(0);
  });

  it("ramps in and saturates below full opacity", () => {
    expect(streakOpacity(0.8)).toBeGreaterThan(0.3);
    expect(streakOpacity(1)).toBeLessThanOrEqual(0.85);
    expect(vignetteIntensity(1)).toBeGreaterThan(0.2);
    expect(vignetteIntensity(1.2)).toBeLessThanOrEqual(0.55);
    expect(afterimageAlpha(1.1)).toBeCloseTo(0.3, 5);
    expect(afterimageAlpha(1.2)).toBeLessThanOrEqual(0.3);
  });

  it("never exceeds 1 or goes negative for any legal speed", () => {
    for (let s = -0.5; s <= 1.6; s += 0.05) {
      for (const v of [streakOpacity(s), vignetteIntensity(s), afterimageAlpha(s)]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("brings the vignette in after the streaks, so the tunnel builds in layers", () => {
    // Streaks start at 0.42, vignette at rush-0.06. With tuned bands (cruise 0.40/rush 0.65)
    // vignette must still be 0 at a point where streaks already read.
    const probe = SPEED_BANDS.cruise + 0.15; // 0.55 with new bands, 0.60 with old — always after streaks, before vignette
    expect(vignetteIntensity(probe)).toBe(0);
    expect(streakOpacity(probe)).toBeGreaterThan(0);
  });
});

describe("whooshRate", () => {
  it("idles at 1 and rises with the shared ramp", () => {
    expect(whooshRate(0)).toBe(1);
    expect(whooshRate(SPEED_BANDS.cruise)).toBe(1);
    expect(whooshRate(SPEED_BANDS.warp)).toBeCloseTo(2.2, 5);
    expect(whooshRate(1.2)).toBe(2.2);
  });
});

describe("fxScale", () => {
  it("keeps the full particle budget on a healthy frame time", () => {
    expect(fxScale(1 / 60)).toBe(1);
    expect(fxScale(1 / 120)).toBe(1);
  });

  it("sheds particles as frames get expensive", () => {
    expect(fxScale(1 / 50)).toBe(0.88);
    expect(fxScale(1 / 42)).toBe(0.7);
    expect(fxScale(1 / 30)).toBe(0.45);
    expect(fxScale(1 / 10)).toBe(0.45);
  });

  it("never returns a budget that would disable the layer outright", () => {
    expect(fxScale(1 / 5)).toBeGreaterThanOrEqual(0.2);
    expect(fxScale(0)).toBe(1);
    expect(fxScale(Number.NaN)).toBe(1);
    expect(fxScale(-1)).toBe(1);
  });
});

describe("weeCheck", () => {
  it("fires on warp speed while diving", () => {
    const out = weeCheck({ armed: true }, 1, -18);
    expect(out.fire).toBe(true);
    expect(out.state.armed).toBe(false);
  });

  it("stays quiet when fast but climbing, or diving but slow", () => {
    expect(weeCheck({ armed: true }, 1, 6).fire).toBe(false);
    expect(weeCheck({ armed: true }, 1, 0).fire).toBe(false);
    expect(weeCheck({ armed: true }, 0.6, -30).fire).toBe(false);
    expect(weeCheck({ armed: true }, WEE_FIRE_ABOVE, -(WEE_MIN_DIVE - 1)).fire).toBe(false);
  });

  it("fires exactly once per acceleration — hysteresis, not a machine gun", () => {
    let state = { armed: true };
    const fires: number[] = [];
    // A long dive that holds warp speed for 40 frames must fire once.
    for (let i = 0; i < 40; i += 1) {
      const out = weeCheck(state, 1.05, -22);
      state = out.state;
      if (out.fire) fires.push(i);
    }
    expect(fires).toEqual([0]);
    // Still held above the re-arm threshold: no second shot.
    expect(weeCheck(state, 0.9, -20).fire).toBe(false);
    expect(state.armed).toBe(false);
    // Slow back down below the arm band, then accelerate again: it re-arms.
    state = weeCheck(state, WEE_ARM_BELOW - 0.01, -4).state;
    expect(state.armed).toBe(true);
    expect(weeCheck(state, 1.1, -25).fire).toBe(true);
  });

  it("tolerates garbage without firing", () => {
    expect(weeCheck({ armed: true }, Number.NaN, -30).fire).toBe(false);
    expect(weeCheck({ armed: true }, 1.2, Number.NaN).fire).toBe(false);
  });
});
