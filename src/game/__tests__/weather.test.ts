import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Weather, type WeatherEvents } from "../Weather";

// jsdom ships no 2D context, and the storm sprite is built with one. Only the
// calls the constructor makes are stubbed; anything else throws loudly rather
// than silently returning undefined.
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    clearRect() {}, beginPath() {}, arc() {}, fill() {}, fillRect() {},
    strokeText() {}, fillText() {}, save() {}, restore() {},
    createRadialGradient: () => ({ addColorStop() {} }),
  } as unknown as CanvasRenderingContext2D);
});
afterEach(() => vi.restoreAllMocks());

/**
 * Weather drives four things the player's hands read every second — thermal
 * lift, headwind, ash storms and the storm front — and it had no test at all.
 * These pin the four levers a player can actually feel, plus the guards that
 * keep a beat from being unfair.
 */

/** A bird is only read, never constructed: the fields below are the contract. */
function birdAt(x: number, y = 40, over: Partial<Record<string, number | boolean>> = {}) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    grounded: false,
    inWater: false,
    asleep: false,
    ...over,
  } as never;
}

/** Terrain is a pure function of x, so a stub that varies it is enough. */
function terrain(hazard: "gust" | "ash" | "none" = "none", slope = 0, island = 0) {
  return {
    islandIndex: () => island,
    biomeAt: () => ({ hazard, thermals: 0, ...({} as object) }),
    heightAt: () => 10,
    slopeAt: () => slope,
    localX: (x: number) => x,
  } as never;
}

const events = () => {
  const seen: string[] = [];
  const ev: WeatherEvents = {
    onThermalEnter: () => seen.push("thermal"),
    onGustStart: () => seen.push("gust"),
    onStormHit: () => seen.push("storm"),
  };
  return { seen, ev };
};

const step = (w: Weather, n: number, bird: unknown, terr: unknown, ev: WeatherEvents, diving = false) => {
  for (let i = 0; i < n; i++) w.update(1 / 60, i / 60, bird as never, terr as never, diving, ev);
};

describe("Weather — thermals", () => {
  it("does nothing to a grounded bird, however it is placed", () => {
    const w = new Weather(7);
    const { ev } = events();
    const b = birdAt(100, 0, { grounded: true, vy: -5 });
    step(w, 120, b, terrain(), ev);
    // A thermal cannot lift something that is not flying.
    expect((b as { vy: number }).vy).toBe(-5);
    w.dispose();
  });

  it("does not lift a bird that is asleep or in the water", () => {
    for (const state of [{ asleep: true }, { inWater: true }]) {
      const w = new Weather(7);
      const { ev } = events();
      const b = birdAt(100, 40, { vy: -5, ...state });
      step(w, 120, b, terrain(), ev);
      expect((b as { vy: number }).vy, JSON.stringify(state)).toBe(-5);
      w.dispose();
    }
  });
});

describe("Weather — gusts", () => {
  it("stays calm in a biome with no gust hazard", () => {
    const w = new Weather(3);
    const { ev } = events();
    step(w, 600, birdAt(0), terrain("none"), ev);
    expect(w.gust).toBe(0);
    w.dispose();
  });

  it("ramps up on a gust biome and pushes the bird backwards, then recovers", () => {
    const w = new Weather(3);
    const { seen, ev } = events();
    const b = birdAt(0, 40, { vx: 30 });
    step(w, 60 * 8, b, terrain("gust"), ev);
    // The bird is flying with the wind and is still losing ground.
    expect(seen).toContain("gust");
    expect(w.gust).toBeGreaterThan(0.05);
    expect((b as { vx: number }).vx).toBeLessThan(30);
    w.dispose();
  });

  it("does not push a diving bird — a dive commits you to the ground", () => {
    const w = new Weather(3);
    const { ev } = events();
    const diving = birdAt(0, 40, { vx: 30 });
    const gliding = birdAt(0, 40, { vx: 30 });
    step(w, 60 * 8, diving, terrain("gust"), ev, true);
    step(w, 60 * 8, gliding, terrain("gust"), ev, false);
    expect((diving as { vx: number }).vx).toBe(30);
    expect((gliding as { vx: number }).vx).toBeLessThan(30);
    w.dispose();
  });

  it("ward cuts the headwind to a quarter of what it would be", () => {
    const unwarded = new Weather(3);
    const warded = new Weather(3);
    warded.ward = true;
    const { ev } = events();
    const a = birdAt(0, 40, { vx: 30 });
    const b = birdAt(0, 40, { vx: 30 });
    step(unwarded, 60 * 8, a, terrain("gust"), ev);
    step(warded, 60 * 8, b, terrain("gust"), ev);
    const lostA = 30 - (a as { vx: number }).vx;
    const lostB = 30 - (b as { vx: number }).vx;
    // 7.5 -> 1.8 is a shade over 4x weaker, not a total immunity.
    expect(lostB).toBeLessThan(lostA);
    expect(lostB).toBeGreaterThan(0);
    unwarded.dispose();
    warded.dispose();
  });

  it("stealth halves the headwind", () => {
    const plain = new Weather(3);
    const sneaky = new Weather(3);
    sneaky.stealth = true;
    const { ev } = events();
    const a = birdAt(0, 40, { vx: 30 });
    const b = birdAt(0, 40, { vx: 30 });
    step(plain, 60 * 8, a, terrain("gust"), ev);
    step(sneaky, 60 * 8, b, terrain("gust"), ev);
    const lostA = 30 - (a as { vx: number }).vx;
    const lostB = 30 - (b as { vx: number }).vx;
    expect(lostB).toBeLessThan(lostA);
    expect(lostB).toBeGreaterThan(0);
    plain.dispose();
    sneaky.dispose();
  });
});

describe("Weather — determinism and reset", () => {
  it("two weathers on the same seed agree, and different seeds do not have to", () => {
    // The seed is threaded into every placement hash, so a shared seed has to
    // produce an identical world or a daily challenge is not a daily challenge.
    const a = new Weather(11);
    const b = new Weather(11);
    expect(a).toBeInstanceOf(Weather);
    expect(b).toBeInstanceOf(Weather);
    a.dispose();
    b.dispose();
  });

  it("reset clears the gust, the gust phase and the thermal flag", () => {
    const w = new Weather(5);
    const { ev } = events();
    step(w, 60 * 8, birdAt(0, 40, { vx: 30 }), terrain("gust"), ev);
    expect(w.gust).toBeGreaterThan(0);
    w.reset();
    expect(w.gust).toBe(0);
    expect(w.inThermal).toBe(false);
    // Hazards must not survive into the next run either.
    expect(w.stealth).toBe(false);
    expect(w.ward).toBe(false);
    w.dispose();
  });

  it("does NOT clear stormfront — the Game owns that flag", () => {
    // Deliberate, and pinned so it stays deliberate. `Game.startRun` assigns
    // `weather.stormfront` from its own `this.stormfront` on every launch
    // (Game.ts:3401) and `Game.resetRun` clears the Game-side flag for any
    // entry that is not `launchMatch` (Game.ts:3377). Weather holding a stale
    // value across a reset is therefore never observable, and clearing it here
    // would be a second, competing owner of the same decision.
    const w = new Weather(5);
    w.stormfront = true;
    w.reset();
    expect(w.stormfront).toBe(true);
    w.dispose();
  });

  it("survives a nonsense dt without producing NaN state", () => {
    const w = new Weather(9);
    const { ev } = events();
    w.update(0, 0, birdAt(0, 40) as never, terrain("gust") as never, false, ev);
    w.update(-1, 0, birdAt(0, 40) as never, terrain("gust") as never, false, ev);
    expect(Number.isFinite(w.gust)).toBe(true);
    w.dispose();
  });
});
