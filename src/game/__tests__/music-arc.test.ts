import { describe, expect, it } from "vitest";
import { ARC, arcShouldWrite, arcSmooth, arcTarget, launchSwell , runEnergy } from "../MusicArc";

/**
 * The score used to be a meter: a weighted sum of speed, altitude, fever,
 * danger and chain, written every frame. It reacted to events but had no shape
 * over a run, which made the take-off (speed 0, altitude 0) the quietest beat
 * of a flight and the landing a hard cut. These lock the envelope that fixes
 * both, and the rule that the envelope shapes the game's energy curve without
 * ever re-tuning it.
 */
describe("launchSwell", () => {
  it("starts at nothing and arrives by the end of the launch", () => {
    expect(launchSwell(0)).toBe(0);
    expect(launchSwell(ARC.launchSeconds)).toBe(1);
    expect(launchSwell(ARC.launchSeconds * 4)).toBe(1);
  });

  it("is monotonic and stays inside 0..1", () => {
    let prev = -1;
    for (let t = 0; t <= 6; t += 0.05) {
      const s = launchSwell(t);
      expect(s).toBeGreaterThanOrEqual(prev);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
      prev = s;
    }
  });

  it("fails safe on garbage and negative time", () => {
    expect(launchSwell(-3)).toBe(0);
    expect(launchSwell(Number.NaN)).toBe(0);
  });
});

describe("arcTarget", () => {
  it("is silence outside a flight", () => {
    expect(arcTarget(false, 0, 0.9)).toBe(0);
    expect(arcTarget(false, 40, 1)).toBe(0);
  });

  it("guarantees the band arrives with the take-off", () => {
    // t=0 with a dead energy sum (speed 0, altitude 0, no fever): the old code
    // wrote 0 here. The floor is the whole point of the module.
    expect(arcTarget(true, 0, 0)).toBeCloseTo(ARC.launchFloor, 5);
    expect(arcTarget(true, 0.4, 0.05)).toBeGreaterThan(0.2);
  });

  it("hands the curve back to the flight once the swell completes", () => {
    expect(arcTarget(true, ARC.launchSeconds, 0.8)).toBeCloseTo(0.8, 5);
    expect(arcTarget(true, 30, 0.42)).toBeCloseTo(0.42, 5);
  });

  it("lets a quiet glide be quiet late in a run", () => {
    expect(arcTarget(true, 30, 0.05)).toBeCloseTo(0.05, 5);
    expect(arcTarget(true, 30, 0)).toBe(0);
  });

  it("never exceeds 1, whatever the energy sum says", () => {
    expect(arcTarget(true, 1, 4)).toBe(1);
    expect(arcTarget(true, 0, 1)).toBe(1);
    expect(arcTarget(true, Number.NaN, Number.NaN)).toBeLessThanOrEqual(1);
    expect(arcTarget(true, Number.NaN, Number.NaN)).toBeGreaterThanOrEqual(0);
  });

  it("is continuous while flying — no frame-to-frame step the ear can catch", () => {
    // A plausible run, continuous by construction: energy climbs for 12 s,
    // eases off as daylight burns down, and bottoms out in a stall.
    const energyAt = (t: number) => (t < 12 ? (t / 12) * 0.9 : Math.max(0.1, 0.9 - (t - 12) * 0.066));
    // Frame granularity, because that is the cadence the audio param is
    // written at. The steepest legal slope in the module is the launch floor
    // decaying (~0.21/s at the swell's midpoint), so a per-frame step must stay
    // well under anything the ear can catch as a jump — and `arcSmooth` removes
    // even that.
    const dt = 1 / 60;
    let prev = arcTarget(true, 0, energyAt(0));
    for (let t = dt; t <= 30; t += dt) {
      const next = arcTarget(true, t, energyAt(t));
      expect(Math.abs(next - prev)).toBeLessThan(0.006);
      prev = next;
    }
  });
});

describe("arcSmooth", () => {
  it("converges on the target", () => {
    let v = 0;
    for (let i = 0; i < 240; i += 1) v = arcSmooth(v, 0.7, 1 / 60);
    expect(v).toBeCloseTo(0.7, 3);
  });

  it("attacks faster than it releases — a crash resolves, it does not cut", () => {
    const stepsTo = (from: number, to: number, mid: number) => {
      let v = from;
      let n = 0;
      while ((to > from ? v < mid : v > mid) && n < 600) {
        v = arcSmooth(v, to, 1 / 60);
        n += 1;
      }
      return n;
    };
    const attack = stepsTo(0.1, 0.9, 0.5);
    const release = stepsTo(0.9, 0, 0.45);
    expect(attack).toBeLessThan(release);
    expect(release / attack).toBeGreaterThan(2);
  });

  it("keeps a run-ending drop audible for a beat instead of muting it", () => {
    let v = 0.85;
    for (let i = 0; i < 30; i += 1) v = arcSmooth(v, 0, 1 / 60);
    expect(v).toBeGreaterThan(0.2); // half a second in, the band is still there
    for (let i = 0; i < 600; i += 1) v = arcSmooth(v, 0, 1 / 60);
    expect(v).toBeLessThan(0.01);
  });

  it("holds still on a non-positive or garbage frame", () => {
    expect(arcSmooth(0.4, 0.9, 0)).toBe(0.4);
    expect(arcSmooth(0.4, 0.9, -1)).toBe(0.4);
    expect(arcSmooth(0.4, 0.9, Number.NaN)).toBe(0.4);
    expect(arcSmooth(Number.NaN, 0.9, 1 / 60)).toBe(0);
  });
});

describe("arcShouldWrite", () => {
  it("ignores movement inside the dead band", () => {
    expect(arcShouldWrite(0.5, 0.505)).toBe(false);
    expect(arcShouldWrite(0.5, 0.5 + ARC.writeEpsilon)).toBe(true);
    expect(arcShouldWrite(0.5, 0.9)).toBe(true);
  });

  it("always lets the final write to silence through", () => {
    expect(arcShouldWrite(0.03, 0)).toBe(true);
    expect(arcShouldWrite(0, 0)).toBe(false);
  });

  it("refuses to write garbage to the audio graph", () => {
    expect(arcShouldWrite(Number.NaN, 0.4)).toBe(false);
    expect(arcShouldWrite(0.4, Number.NaN)).toBe(false);
  });
});

describe("runEnergy — progression is part of the mix", () => {
  const quiet = { speed: 0.2, alt: 0.1, fever: false, danger: 0, chain: 0 };

  it("lifts a run that is achieving but slow, which used to sound like a run achieving nothing", () => {
    expect(runEnergy({ ...quiet, goalsDone: 3 })).toBeGreaterThan(runEnergy({ ...quiet, goalsDone: 0 }));
  });

  it("cannot push an already-maxed flight past 1 — the clamp makes it a floor-lifter", () => {
    expect(runEnergy({ speed: 1, alt: 1, fever: true, danger: 1, chain: 1, goalsDone: 6 })).toBe(1);
  });

  it("saturates at six goals, so a long run cannot outrun the arrangement", () => {
    expect(runEnergy({ ...quiet, goalsDone: 6 })).toBe(runEnergy({ ...quiet, goalsDone: 99 }));
  });

  it("is monotonic: completing a goal never makes the score quieter", () => {
    const energies = [0, 1, 2, 3, 4, 5, 6].map((n) => runEnergy({ ...quiet, goalsDone: n }));
    expect(energies).toEqual([...energies].sort((a, b) => a - b));
  });

  it("keeps the tuning it replaced — same weights, one term added", () => {
    // speed .35 + alt .22 + fever .3 + danger .12 + chain .12: the pre-progression mix.
    expect(runEnergy({ speed: 0.5, alt: 0.5, fever: false, danger: 0.5, chain: 0.5, goalsDone: 0 })).toBeCloseTo(
      0.5 * 0.35 + 0.5 * 0.22 + 0.5 * 0.12 + 0.5 * 0.12,
      10,
    );
    expect(runEnergy({ speed: 0.5, alt: 0.5, fever: true, danger: 0.5, chain: 0.5, goalsDone: 0 })).toBeCloseTo(
      0.5 * 0.35 + 0.5 * 0.22 + 0.3 + 0.5 * 0.12 + 0.5 * 0.12,
      10,
    );
  });

  it("reads a non-finite part as zero rather than poisoning the audio graph", () => {
    const broken = runEnergy({ speed: Number.NaN, alt: 0.5, fever: false, danger: 0, chain: 0, goalsDone: 1 });
    expect(broken).toBe(runEnergy({ speed: 0, alt: 0.5, fever: false, danger: 0, chain: 0, goalsDone: 1 }));
    expect(Number.isNaN(broken)).toBe(false);
  });
});
