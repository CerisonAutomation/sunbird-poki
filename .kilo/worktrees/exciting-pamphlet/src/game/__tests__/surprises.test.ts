import { describe, expect, it } from "vitest";
import { BIG_LAUNCH_QUIPS, BOP_QUIPS, SLEEP_QUIPS, SPLASH_QUIPS, THUD_QUIPS, SurpriseEngine, pickSurprise, quip } from "../Surprises";

describe("surprise engine", () => {
  it("never fires early in a run", () => {
    const e = new SurpriseEngine();
    e.reset();
    for (let t = 0; t < 200; t++) {
      expect(e.tick(0.5, 100, true, () => 0)).toBeNull(); // rng=0 would always fire if allowed
    }
  });

  it("fires at most once per cooldown window even with a hot rng", () => {
    const e = new SurpriseEngine();
    e.reset();
    let fired = 0;
    for (let t = 0; t < 240; t++) {
      if (e.tick(0.25, 5000, true, () => 0)) fired++;
    }
    // 60s simulated: warm-up (18s) + one fire + 67.5s cooldown → exactly 1
    expect(fired).toBe(1);
  });

  it("never fires while grounded or swimming", () => {
    const e = new SurpriseEngine();
    e.reset();
    for (let t = 0; t < 400; t++) expect(e.tick(0.5, 9999, false, () => 0)).toBeNull();
  });

  it("every surprise in the pool is positive or neutral", () => {
    for (let i = 0; i < 50; i++) {
      const s = pickSurprise(() => i / 50);
      expect(s.coins).toBeGreaterThanOrEqual(0);
      expect(s.feverSeconds).toBeGreaterThanOrEqual(0);
      expect(s.toast.length).toBeGreaterThan(4);
    }
  });

  it("quips are deterministic and in-pool", () => {
    expect(quip(SPLASH_QUIPS, 4)).toBe(quip(SPLASH_QUIPS, 4));
    expect(SPLASH_QUIPS).toContain(quip(SPLASH_QUIPS, 7));
    expect(SLEEP_QUIPS).toContain(quip(SLEEP_QUIPS, 123));
    expect(BIG_LAUNCH_QUIPS).toContain(quip(BIG_LAUNCH_QUIPS, 999));
  });

  it("thud/bop pools rotate without repeating until exhausted", () => {
    for (const pool of [THUD_QUIPS, BOP_QUIPS]) {
      expect(pool.length).toBeGreaterThan(0);
      for (const w of pool) expect(w).toMatch(/!$/);
      const seen = new Set(pool.map((_, i) => quip(pool, i)));
      expect(seen.size).toBe(pool.length);
      // rotation wraps cleanly back to the start
      expect(quip(pool, pool.length)).toBe(quip(pool, 0));
    }
    expect(THUD_QUIPS).toContain(quip(THUD_QUIPS, 1)); // THUNK! follows THUD!
    expect(BOP_QUIPS[0]).toBe("BOP!");
  });
});

describe("first-flight guarantee", () => {
  it("delivers a surprise inside the first 20 seconds for a new pilot", () => {
    const e = new SurpriseEngine();
    e.reset({ warm: true });
    let fired = 0;
    let t = 0;
    // 0.25 s steps, airborne, past the warm distance gate, unlucky-ish rng.
    while (t < 20 && fired === 0) {
      t += 0.25;
      if (e.tick(0.25, 400, true, () => 0.01)) fired += 1;
    }
    expect(fired).toBe(1);
    expect(t).toBeLessThanOrEqual(20);
  });

  it("still respects a short warm-up so the opening seconds stay readable", () => {
    const e = new SurpriseEngine();
    e.reset({ warm: true });
    for (let i = 0; i < 20; i += 1) expect(e.tick(0.25, 900, true, () => 0)).toBeNull();
  });

  it("waits for real airspeed: nothing fires below the warm distance gate", () => {
    const e = new SurpriseEngine();
    e.reset({ warm: true });
    for (let i = 0; i < 200; i += 1) expect(e.tick(0.25, 120, true, () => 0)).toBeNull();
  });

  it("hands the run back to normal rarity after the guaranteed one", () => {
    const e = new SurpriseEngine();
    e.reset({ warm: true });
    let fired = 0;
    for (let i = 0; i < 400 && fired === 0; i += 1) if (e.tick(0.25, 400, true, () => 0.01)) fired += 1;
    expect(fired).toBe(1);
    // After the guarantee is paid, the normal 320 m gate and 45 s cooldown apply:
    // a short hop past the gate must not fire immediately.
    let extra = 0;
    for (let i = 0; i < 40; i += 1) if (e.tick(0.25, 150, true, () => 0)) extra += 1;
    expect(extra).toBe(0);
  });

  it("leaves the default contract untouched for returning players", () => {
    const cold = new SurpriseEngine();
    cold.reset();
    const warm = new SurpriseEngine();
    warm.reset({ warm: true });
    // Same flight, same rng: the returning player waits out the 18 s warm-up
    // while the first-timer's fuse is 6 s. That gap IS the feature.
    let coldAt = -1;
    let warmAt = -1;
    for (let i = 1; i <= 120; i += 1) {
      const t = i * 0.25;
      if (coldAt < 0 && cold.tick(0.25, 400, true, () => 0.01)) coldAt = t;
      if (warmAt < 0 && warm.tick(0.25, 400, true, () => 0.01)) warmAt = t;
    }
    expect(warmAt).toBeGreaterThan(0);
    expect(warmAt).toBeLessThanOrEqual(20);
    expect(coldAt).toBeGreaterThan(warmAt);
    expect(coldAt).toBeGreaterThanOrEqual(18);
  });
});
