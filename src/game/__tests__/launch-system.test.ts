import { describe, expect, it } from "vitest";
import { LaunchSystem } from "../LaunchSystem";
import {
  COMBO_GRACE,
  LAUNCH_COMBO_MAX,
  LAUNCH_COMBO_STEP,
  LAUNCH_MIN_SPEED,
  LAUNCH_RELEASE_WINDOW,
  MAX_SPEED,
  RATING_GOOD,
} from "../constants";
import type { Bird } from "../Bird";
import type { TerrainSystem } from "../TerrainSystem";

/**
 * The launch rater. Its contract is that it is deterministic — the same
 * approach always earns the same rating, which is what makes GOOD/GREAT/PERFECT
 * learnable rather than luck. These tests hold that contract, and the three
 * ways a launch is refused.
 */

function fakeBird(over: Partial<{ launchSpeed: number; x: number; vx: number; vy: number }> = {}) {
  const b = { launchSpeed: 0, x: 100, vx: 40, vy: 25, speed: () => 40, ...over };
  return b as unknown as Bird;
}

/** Flat run-up: no ramp behind the bird. */
function flatTerrain() {
  return { slopeAt: () => 0, heightAt: () => 0 } as unknown as TerrainSystem;
}

/** A real ramp behind the bird, so the ramp term contributes. */
function rampedTerrain(slope = 0.72) {
  return { slopeAt: () => slope, heightAt: () => 0 } as unknown as TerrainSystem;
}

describe("LaunchSystem refusals", () => {
  it("awards nothing when the bird never reached launch speed", () => {
    const sys = new LaunchSystem();
    sys.observeInput(true, 0);
    sys.observeInput(false, 0);
    const r = sys.evaluate(fakeBird({ launchSpeed: LAUNCH_MIN_SPEED - 1 }), rampedTerrain(), 0);
    expect(r.rating).toBe("none");
    expect(r.boost).toBe(1);
    expect(r.score).toBe(0);
  });

  it("awards nothing when the outgoing arc is flat", () => {
    const sys = new LaunchSystem();
    sys.observeInput(true, 0);
    sys.observeInput(false, 0);
    const r = sys.evaluate(fakeBird({ launchSpeed: 80, vy: 0 }), rampedTerrain(), 0);
    expect(r.rating).toBe("none");
  });

  it("awards nothing when the player never released before the lip", () => {
    const sys = new LaunchSystem();
    // Still holding: observeInput never sees a diving -> not-diving edge.
    sys.observeInput(true, 0);
    const r = sys.evaluate(fakeBird({ launchSpeed: 90 }), rampedTerrain(), 0);
    expect(r.rating).toBe("none");
  });

  it("awards nothing when the release happened long before the lip", () => {
    const sys = new LaunchSystem();
    sys.observeInput(true, 0);
    sys.observeInput(false, 0); // released at t=0
    const late = LAUNCH_RELEASE_WINDOW + 1;
    const r = sys.evaluate(fakeBird({ launchSpeed: 90 }), rampedTerrain(), late);
    expect(r.rating).toBe("none");
  });

  it("clears the release marker so the same release cannot be spent twice", () => {
    const sys = new LaunchSystem();
    sys.observeInput(true, 0);
    sys.observeInput(false, 0);
    const bird = fakeBird({ launchSpeed: 90 });
    const first = sys.evaluate(bird, rampedTerrain(), 0);
    const second = sys.evaluate(bird, rampedTerrain(), 0);
    expect(first.rating).not.toBe("none");
    expect(second.rating).toBe("none");
  });
});

describe("LaunchSystem scoring", () => {
  it("is deterministic: the same approach scores the same twice", () => {
    const run = () => {
      const sys = new LaunchSystem();
      sys.observeInput(true, 0);
      sys.observeInput(false, 0);
      return sys.evaluate(fakeBird({ launchSpeed: 60, vx: 50, vy: 31 }), rampedTerrain(0.5), 0);
    };
    expect(run()).toEqual(run());
  });

  it("keeps score inside 0..1 across the whole speed range", () => {
    for (const launchSpeed of [LAUNCH_MIN_SPEED, 40, 60, MAX_SPEED]) {
      const sys = new LaunchSystem();
      sys.observeInput(true, 0);
      sys.observeInput(false, 0);
      const r = sys.evaluate(fakeBird({ launchSpeed }), rampedTerrain(), 0);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });

  it("rewards speed: a faster run-up scores at least as well", () => {
    const scoreAt = (launchSpeed: number) => {
      const sys = new LaunchSystem();
      sys.observeInput(true, 0);
      sys.observeInput(false, 0);
      return sys.evaluate(fakeBird({ launchSpeed, vx: 50, vy: 31 }), rampedTerrain(0.5), 0).score;
    };
    expect(scoreAt(80)).toBeGreaterThan(scoreAt(LAUNCH_MIN_SPEED + 1));
  });

  it("rewards an immediate release over a late one", () => {
    const scoreAfter = (since: number) => {
      const sys = new LaunchSystem();
      sys.observeInput(true, 0);
      sys.observeInput(false, 0);
      return sys.evaluate(fakeBird({ launchSpeed: 70, vx: 50, vy: 31 }), rampedTerrain(0.5), since).score;
    };
    expect(scoreAfter(0)).toBeGreaterThan(scoreAfter(LAUNCH_RELEASE_WINDOW * 0.9));
  });

  it("records the raw speed and the ramp it read", () => {
    const sys = new LaunchSystem();
    sys.observeInput(true, 0);
    sys.observeInput(false, 0);
    const r = sys.evaluate(fakeBird({ launchSpeed: 70 }), rampedTerrain(0.4), 0);
    expect(r.speed).toBe(70);
    expect(r.slope).toBe(0.4);
  });

  it("scores a flat run-up below a ramped one at the same speed", () => {
    const scoreOver = (terrain: TerrainSystem) => {
      const sys = new LaunchSystem();
      sys.observeInput(true, 0);
      sys.observeInput(false, 0);
      return sys.evaluate(fakeBird({ launchSpeed: 70, vx: 50, vy: 31 }), terrain, 0).score;
    };
    expect(scoreOver(rampedTerrain(0.72))).toBeGreaterThan(scoreOver(flatTerrain()));
  });
});

describe("LaunchSystem combo", () => {
  const greatLaunch = (sys: LaunchSystem) => {
    sys.observeInput(true, sys.combo * 100);
    sys.observeInput(false, sys.combo * 100);
    return sys.evaluate(fakeBird({ launchSpeed: 90, vx: 55, vy: 34 }), rampedTerrain(), sys.combo * 100);
  };

  it("starts with no chain and no boost from it", () => {
    const sys = new LaunchSystem();
    expect(sys.combo).toBe(0);
    expect(sys.comboBoost()).toBe(0);
  });

  it("caps the chain boost so it cannot run away", () => {
    const sys = new LaunchSystem();
    sys.combo = 10_000;
    expect(sys.comboBoost()).toBe(LAUNCH_COMBO_MAX);
    expect(sys.comboBoost()).toBeLessThanOrEqual(LAUNCH_COMBO_MAX);
  });

  it("grows the boost one step per link and never past the cap", () => {
    const sys = new LaunchSystem();
    sys.combo = 1;
    expect(sys.comboBoost()).toBeCloseTo(LAUNCH_COMBO_STEP, 6);
    sys.combo = 999;
    expect(sys.comboBoost()).toBe(LAUNCH_COMBO_MAX);
  });

  it("expires the chain after the grace window", () => {
    const sys = new LaunchSystem();
    // Built through evaluate() rather than by assigning `combo`, because the
    // grace timer is private and is only armed by a real launch.
    expect(greatLaunch(sys).rating === "great" || greatLaunch(sys).rating === "perfect").toBe(true);
    expect(sys.combo).toBeGreaterThan(0);

    sys.tick(COMBO_GRACE - 0.1);
    expect(sys.combo).toBeGreaterThan(0);
    sys.tick(0.2);
    expect(sys.combo).toBe(0);
  });

  it("does not expire a chain that is already zero", () => {
    const sys = new LaunchSystem();
    sys.tick(1000);
    expect(sys.combo).toBe(0);
  });

  it("breaks the chain on demand and clears the timer with it", () => {
    const sys = new LaunchSystem();
    sys.combo = 5;
    sys.breakCombo();
    expect(sys.combo).toBe(0);
    expect(sys.comboBoost()).toBe(0);
  });

  it("tracks the best chain it ever reached, which survives a break", () => {
    const sys = new LaunchSystem();
    sys.combo = 7;
    sys.best = 7;
    sys.breakCombo();
    expect(sys.combo).toBe(0);
    expect(sys.best).toBe(7);
  });

  it("resets every counter", () => {
    const sys = new LaunchSystem();
    sys.combo = 4;
    sys.best = 4;
    sys.perfects = 2;
    sys.greats = 3;
    sys.goods = 5;
    sys.last = { rating: "good", score: RATING_GOOD, boost: 1, combo: 4, speed: 1, slope: 0 };
    sys.reset();
    expect(sys.combo).toBe(0);
    expect(sys.best).toBe(0);
    expect(sys.perfects).toBe(0);
    expect(sys.greats).toBe(0);
    expect(sys.goods).toBe(0);
    expect(sys.last).toBeNull();
  });
});

describe("LaunchSystem release detection", () => {
  it("only records a release on the diving -> not-diving edge", () => {
    const sys = new LaunchSystem();
    sys.observeInput(false, 0);
    sys.observeInput(false, 1);
    // Never dove, so a launch at t=1 must still be refused.
    expect(sys.evaluate(fakeBird({ launchSpeed: 90 }), rampedTerrain(), 1).rating).toBe("none");
  });

  it("treats a dive-then-release as a release at that instant", () => {
    const sys = new LaunchSystem();
    sys.observeInput(true, 5);
    sys.observeInput(false, 5);
    const r = sys.evaluate(fakeBird({ launchSpeed: 90 }), rampedTerrain(), 5);
    expect(r.rating).not.toBe("none");
  });
});
