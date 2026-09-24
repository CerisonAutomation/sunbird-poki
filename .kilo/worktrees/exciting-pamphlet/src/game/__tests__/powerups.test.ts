import { beforeEach, describe, expect, it } from "vitest";
import { PowerUps } from "../PowerUps";

describe("PowerUps", () => {
  let p: PowerUps;

  beforeEach(() => {
    p = new PowerUps();
  });

  it("starts empty with neutral multipliers", () => {
    expect(p.view()).toHaveLength(0);
    expect(p.dragMult()).toBe(1);
    expect(p.liftMult()).toBe(1);
    expect(p.coinMult()).toBe(1);
    expect(p.magnetOn()).toBe(false);
    expect(p.featherOn()).toBe(false);
    expect(p.boostOn()).toBe(false);
    expect(p.cloudBoostOn()).toBe(false);
  });

  it("grants a timed power and decays it", () => {
    const d = p.add("longglide");
    expect(d).toBeGreaterThan(0);
    expect(p.has("longglide")).toBe(true);
    expect(p.dragMult()).toBeCloseTo(0.42, 2);
    p.tick(d / 2);
    expect(p.timeLeft("longglide")).toBeCloseTo(d / 2, 5);
    p.tick(d);
    expect(p.has("longglide")).toBe(false);
    expect(p.dragMult()).toBe(1);
  });

  it("caps a repeated pickup at 1.8x its duration", () => {
    const d = p.add("wingboost");
    p.add("wingboost");
    p.add("wingboost");
    expect(p.timeLeft("wingboost")).toBeCloseTo(d * 1.8, 5);
  });

  it("golden wings implies its lesser effects", () => {
    p.add("goldenwings");
    expect(p.has("longglide")).toBe(true);
    expect(p.has("magnet")).toBe(true);
    expect(p.magnetOn()).toBe(true);
    expect(p.featherOn()).toBe(true);
    expect(p.coinMult()).toBe(2);
    expect(p.dragMult()).toBeLessThan(0.5);
    expect(p.liftMult()).toBeGreaterThan(1);
  });

  it("unknown pickups are ignored", () => {
    expect(p.add("boost" as never)).toBe(0);
    expect(p.view()).toHaveLength(0);
  });

  it("view returns active powers sorted by time remaining", () => {
    p.add("magnet");
    p.add("longglide");
    p.add("rocket");
    p.add("feather");
    p.add("wingboost");
    p.add("cloudboost");
    const view = p.view();
    expect(view.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < view.length; i++) {
      expect(view[i - 1]!.time).toBeGreaterThanOrEqual(view[i]!.time);
    }
    expect(view[0]!.label.length).toBeGreaterThan(0);
  });

  describe("overcharge (tier II)", () => {
    it("second pickup while live promotes to level 2", () => {
      p.add("wingboost");
      expect(p.level("wingboost")).toBe(1);
      p.add("wingboost");
      expect(p.level("wingboost")).toBe(2);
    });

    it("tier II strengthens the effect", () => {
      const p1 = new PowerUps();
      p1.add("wingboost");
      const p2 = new PowerUps();
      p2.add("wingboost");
      p2.add("wingboost");
      expect(p2.liftMult()).toBeGreaterThan(p1.liftMult());

      const g1 = new PowerUps();
      g1.add("longglide");
      const g2 = new PowerUps();
      g2.add("longglide");
      g2.add("longglide");
      expect(g2.dragMult()).toBeLessThan(g1.dragMult());

      const m = new PowerUps();
      m.add("magnet");
      expect(m.magnetScale()).toBe(1);
      m.add("magnet");
      expect(m.magnetScale()).toBeGreaterThan(1);
    });

    it("overcharged golden wings pays triple coins", () => {
      p.add("goldenwings");
      p.add("goldenwings");
      expect(p.coinMult()).toBe(3);
    });

    it("level resets to 0 when the timer expires", () => {
      p.add("feather");
      p.add("feather");
      expect(p.level("feather")).toBe(2);
      p.tick(1000);
      expect(p.level("feather")).toBe(0);
      // A fresh pickup after expiry starts back at tier 1.
      p.add("feather");
      expect(p.level("feather")).toBe(1);
    });

    it("view() reports the level for the HUD badge", () => {
      p.add("magnet");
      p.add("magnet");
      const v = p.view().find((x) => x.kind === "magnet")!;
      expect(v.level).toBe(2);
    });
  });

  it("reset clears levels along with timers", () => {
    p.add("magnet");
    p.add("magnet");
    p.reset();
    p.add("magnet");
    expect(p.level("magnet")).toBe(1);
  });
});
