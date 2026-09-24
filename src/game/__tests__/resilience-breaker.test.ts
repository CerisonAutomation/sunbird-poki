import { describe, expect, it } from "vitest";
import { allows, Breakers, DEFAULT_BREAKER, step, type BreakerSnapshot } from "../resilience/CircuitBreaker";

describe("breaker state machine", () => {
  const snap = (over: Partial<BreakerSnapshot> = {}): BreakerSnapshot => ({
    state: "closed",
    failures: 0,
    openedAt: 0,
    windowStart: -1,
    cooldownMs: DEFAULT_BREAKER.cooldownMs,
    ...over,
  });

  it("stays closed below the threshold", () => {
    let s = snap();
    for (let i = 1; i < DEFAULT_BREAKER.threshold; i++) s = step(s, "failure", i * 10);
    expect(s.state).toBe("closed");
    expect(s.failures).toBe(DEFAULT_BREAKER.threshold - 1);
  });

  it("trips open at the threshold", () => {
    let s = snap();
    for (let i = 0; i < DEFAULT_BREAKER.threshold; i++) s = step(s, "failure", i * 10);
    expect(s.state).toBe("open");
    expect(s.openedAt).toBe((DEFAULT_BREAKER.threshold - 1) * 10);
  });

  it("forgets old failures outside the sliding window", () => {
    let s = snap();
    const w = DEFAULT_BREAKER.windowMs;
    s = step(s, "failure", 0);
    s = step(s, "failure", 0);
    s = step(s, "failure", w + 1); // window restarted — count resets to 1
    expect(s.state).toBe("closed");
    expect(s.failures).toBe(1);
  });

  it("rejects while open, then admits a probe after cooldown", () => {
    let s = snap();
    for (let i = 0; i < DEFAULT_BREAKER.threshold; i++) s = step(s, "failure", i * 10);
    expect(s.state).toBe("open");
    expect(allows(s, s.openedAt + DEFAULT_BREAKER.cooldownMs - 1)).toBe(false);
    expect(allows(s, s.openedAt + DEFAULT_BREAKER.cooldownMs)).toBe(true);
    s = step(s, "probe-allowed", s.openedAt + DEFAULT_BREAKER.cooldownMs);
    expect(s.state).toBe("half-open");
  });

  it("a successful probe heals fully", () => {
    let s = snap({ state: "half-open", failures: 4, cooldownMs: 15_000 });
    s = step(s, "success", 1_000);
    expect(s).toEqual({ state: "closed", failures: 0, openedAt: 0, windowStart: -1, cooldownMs: DEFAULT_BREAKER.cooldownMs });
  });

  it("a failed probe re-opens with a DOUBLED cooldown (flap protection)", () => {
    let s = snap({ state: "half-open", failures: 4, cooldownMs: 15_000 });
    s = step(s, "failure", 16_000);
    expect(s.state).toBe("open");
    expect(s.cooldownMs).toBe(30_000);
  });

  it("cooldown doubling is capped", () => {
    let s = snap({ state: "half-open", failures: 9, cooldownMs: DEFAULT_BREAKER.maxCooldownMs });
    s = step(s, "failure", 1);
    expect(s.cooldownMs).toBe(DEFAULT_BREAKER.maxCooldownMs);
  });

  it("failures while open do not accumulate", () => {
    const s = step(snap({ state: "open", failures: 4 }), "failure", 5);
    expect(s.failures).toBe(4);
  });
});

describe("Breakers registry", () => {
  it("allows closed endpoints and counts failures to a trip", () => {
    const b = new Breakers();
    for (let i = 0; i < 3; i++) {
      expect(b.allow("api", 0)).toBe(true);
      b.record("api", "failure", i);
    }
    expect(b.allow("api", 100)).toBe(true);
    b.record("api", "failure", 100); // 4th → trips
    expect(b.allow("api", 200)).toBe(false);
    expect(b.tripped(200)).toEqual(["api"]);
  });

  it("recovers through a half-open probe", () => {
    const b = new Breakers();
    for (let i = 0; i < 4; i++) b.record("api", "failure", i); // trips open at t=3
    expect(b.allow("api", 5)).toBe(false);
    const probeAt = 3 + DEFAULT_BREAKER.cooldownMs; // openedAt was 3
    expect(b.allow("api", probeAt)).toBe(true); // probe
    b.record("api", "success", probeAt + 1);
    expect(b.allow("api", probeAt + 2)).toBe(true);
    expect(b.tripped(probeAt + 3)).toEqual([]);
  });

  it("keeps endpoints independent and supports reset", () => {
    const b = new Breakers();
    for (let i = 0; i < 4; i++) b.record("a", "failure", i);
    expect(b.allow("b", 10)).toBe(true);
    b.reset("a");
    expect(b.allow("a", 10)).toBe(true);
  });
});
