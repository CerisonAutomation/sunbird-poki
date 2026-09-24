import { describe, expect, it } from "vitest";
import { FUNNEL_STAGES, Funnel, daysBetween, visitKind, VIRAL_EVENT_NAMES, isViralEvent, viralCoefficient, viralEventProps } from "../Funnel";

/** A clock the test drives, so timings are exact and never flaky. */
class Clock {
  constructor(private now = 1_000) {}
  get t(): number {
    return this.now;
  }
  advance(ms: number): number {
    this.now += ms;
    return this.now;
  }
}

describe("Funnel", () => {
  it("starts empty and reports no drop-off", () => {
    const f = new Funnel();
    expect(f.last()).toBeNull();
    expect(f.path()).toEqual([]);
    expect(f.progress()).toBe(0);
    expect(f.dropOff()).toBeNull();
    expect(f.toJSON()).toEqual({});
  });

  it("emits an event exactly once per stage", () => {
    const f = new Funnel();
    const c = new Clock();
    const first = f.mark("boot", c.t);
    expect(first).not.toBeNull();
    expect(first?.stage).toBe("boot");
    expect(first?.ms).toBe(0);
    expect(first?.stepMs).toBe(0);
    c.advance(5_000);
    expect(f.mark("boot", c.t)).toBeNull();
    expect(f.at("boot")).toBe(0);
  });

  it("measures each stage from the funnel origin", () => {
    const f = new Funnel();
    const c = new Clock();
    f.start(c.t);
    f.mark("boot", c.advance(1_200));
    f.mark("first_input", c.advance(800));
    f.mark("first_flight", c.advance(2_000));
    expect(f.at("boot")).toBe(1_200);
    expect(f.at("first_input")).toBe(2_000);
    expect(f.at("first_flight")).toBe(4_000);
    expect(f.at("first_reward")).toBeNull();
  });

  it("reports the gap from the previous stage, which is the actionable number", () => {
    const f = new Funnel();
    const c = new Clock();
    f.start(c.t);
    f.mark("boot", c.advance(1_000));
    f.mark("first_input", c.advance(500));
    const flight = f.mark("first_flight", c.advance(250));
    const reward = f.mark("first_reward", c.advance(38_000));
    expect(flight?.stepMs).toBe(250);
    // 38 s between launching and earning anything is exactly the kind of gap a
    // funnel exists to surface.
    expect(reward?.stepMs).toBe(38_000);
    expect(reward?.progress).toBeCloseTo(4 / FUNNEL_STAGES.length);
  });

  it("starts the clock implicitly and never moves the origin", () => {
    const f = new Funnel();
    const c = new Clock(50_000);
    f.mark("first_input", c.t);
    expect(f.at("first_input")).toBe(0);
    f.start(c.advance(1_000));
    f.mark("first_flight", c.t);
    expect(f.at("first_flight")).toBe(1_000);
  });

  it("treats the furthest stage reached as the drop-off point", () => {
    const f = new Funnel();
    const c = new Clock();
    f.start(c.t);
    f.mark("boot", c.advance(900));
    f.mark("first_input", c.advance(300));
    f.mark("first_flight", c.advance(700));
    expect(f.last()).toBe("first_flight");
    expect(f.path()).toEqual(["boot", "first_input", "first_flight"]);
    c.advance(45_000);
    const drop = f.dropOff(c.t);
    expect(drop?.stage).toBe("first_flight");
    expect(drop?.afterMs).toBe(1_900);
    expect(drop?.stuckForMs).toBe(45_000);
  });

  it("keeps stage order rather than arrival order in the path", () => {
    const f = new Funnel();
    const c = new Clock();
    f.start(c.t);
    // A returning player can reach "second_run" long before anything else is
    // re-marked; the path must still read in funnel order.
    f.mark("second_run", c.advance(10));
    f.mark("boot", c.advance(10));
    expect(f.path()).toEqual(["boot", "second_run"]);
    expect(f.last()).toBe("second_run");
  });

  it("never produces negative timings", () => {
    const f = new Funnel();
    const c = new Clock();
    f.start(c.t);
    f.mark("boot", c.t - 5_000);
    expect(f.at("boot")).toBe(0);
  });

  it("clears on reset", () => {
    const f = new Funnel();
    f.mark("boot");
    f.mark("first_input");
    f.reset();
    expect(f.path()).toEqual([]);
    expect(f.reached("boot")).toBe(false);
    expect(f.mark("boot")).not.toBeNull();
  });

  it("serialises to a flat stage->ms map for one end-of-session beacon", () => {
    const f = new Funnel();
    const c = new Clock();
    f.start(c.t);
    f.mark("boot", c.advance(1_000));
    f.mark("first_death", c.advance(60_000));
    expect(f.toJSON()).toEqual({ boot: 1_000, first_death: 61_000 });
  });
});

describe("retention cohort", () => {
  it("counts whole calendar days between date keys", () => {
    expect(daysBetween("2026-09-01", "2026-09-02")).toBe(1);
    expect(daysBetween("2026-09-01", "2026-09-08")).toBe(7);
    expect(daysBetween("2026-08-31", "2026-09-01")).toBe(1);
    expect(daysBetween("2026-09-05", "2026-09-01")).toBe(0);
    expect(daysBetween("", "2026-09-01")).toBe(0);
    expect(daysBetween("nonsense", "2026-09-01")).toBe(0);
  });

  it("classifies a brand-new player", () => {
    expect(visitKind("", "2026-09-23")).toBe("new");
    expect(visitKind("2026-09-23", "2026-09-23")).toBe("new");
  });

  it("classifies day one, the fragile middle and a habit", () => {
    expect(visitKind("2026-09-22", "2026-09-23")).toBe("d1");
    expect(visitKind("2026-09-21", "2026-09-23")).toBe("d2_6");
    // Six days is still the fragile middle; seven is a habit.
    expect(visitKind("2026-09-17", "2026-09-23")).toBe("d2_6");
    expect(visitKind("2026-09-16", "2026-09-23")).toBe("d7plus");
    expect(visitKind("2026-01-01", "2026-09-23")).toBe("d7plus");
  });

  it("treats a clock that went backwards as a same-day visit", () => {
    expect(visitKind("2026-09-25", "2026-09-23")).toBe("new");
  });
});

describe("viral event schema", () => {
  it("is a closed set", () => {
    expect(VIRAL_EVENT_NAMES).toContain("challenge_share");
    expect(isViralEvent("challenge_share")).toBe(true);
    expect(isViralEvent("run_end")).toBe(false);
  });

  it("drops unknown keys and sanitises the rest", () => {
    const props = viralEventProps("clip_moment", {
      kind: "near_miss!",
      mode: "daytrip",
      distance: 1840.6,
      score: 77.2,
      // @ts-expect-error — proving extra keys never survive
      path: "/secret",
    });
    expect(props).toEqual({ kind: "near_miss", mode: "daytrip", distance: 1841, score: 77 });
    expect(props).not.toHaveProperty("path");
  });

  it("is 0 when nothing viral happened", () => {
    expect(viralCoefficient({})).toBe(0);
  });

  it("rises with shares and rematches, falls with unconverted opens", () => {
    const hot = viralCoefficient({ challenge_share: 4, ghost_rematch: 2, one_more_run: 6, challenge_open: 1 });
    const cold = viralCoefficient({ challenge_open: 8, challenge_share: 0 });
    expect(hot).toBeGreaterThan(cold);
    expect(hot).toBeGreaterThan(0);
    expect(hot).toBeLessThanOrEqual(3);
  });
});
