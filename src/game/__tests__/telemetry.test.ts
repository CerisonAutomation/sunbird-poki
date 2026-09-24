import { describe, expect, it } from "vitest";
import { Telemetry, coarseEvent } from "../Telemetry";
import { BIG_LAUNCH_QUIPS, SLEEP_QUIPS, quip } from "../Surprises";

describe("telemetry", () => {
  it("buffers events and keeps only the last 100", () => {
    const t = new Telemetry();
    for (let i = 0; i < 120; i++) t.track("run_end", { mode: "daytrip", distance: i });
    expect(t.recent().length).toBe(100);
    expect(t.recent()[0]!.props.distance).toBe(20);
  });

  it("flush is a safe no-op with no backend configured", () => {
    const t = new Telemetry();
    t.bindDevice("d-test");
    t.track("run_end", { mode: "daytrip", distance: 1234 });
    // VITE_MP_URL is unset under vitest — flush must not throw or fetch.
    expect(() => t.flush()).not.toThrow();
  });

  it("records structured props verbatim on the local bus", () => {
    const t = new Telemetry();
    t.track("zenith", { alt: 812 });
    const last = t.recent().at(-1)!;
    expect(last.name).toBe("zenith");
    expect(last.props.alt).toBe(812);
  });
});

describe("comedy voice", () => {
  it("expanded quip pools stay deterministic", () => {
    expect(SLEEP_QUIPS.length).toBeGreaterThanOrEqual(8);
    expect(BIG_LAUNCH_QUIPS.length).toBeGreaterThanOrEqual(8);
    expect(quip(SLEEP_QUIPS, 7)).toBe(quip(SLEEP_QUIPS, 7));
    expect(new Set(SLEEP_QUIPS).size).toBe(SLEEP_QUIPS.length);
    expect(new Set(BIG_LAUNCH_QUIPS).size).toBe(BIG_LAUNCH_QUIPS.length);
  });
});

/**
 * The beacon's coarse projection — the privacy contract as a test.
 *
 * `track()` keeps the rich event locally (that is what the local bus and the
 * portal's own analytics are for); only what `coarseEvent` returns is allowed to
 * leave the device. So the assertions here are about *absence*: no timings, no
 * path strings, no stage-shaped text from an event that is not a funnel event.
 */
describe("coarseEvent: what is allowed to leave the device", () => {
  it("carries a funnel position, and only for the two funnel events", () => {
    expect(coarseEvent("funnel_stage", { stage: "first_flight", step: 2, ms: 41_200, stepMs: 9_800, progress: 0.38 })).toEqual({
      k: "funnel_stage",
      st: "first_flight",
      si: 2,
    });
    expect(coarseEvent("funnel_summary", {
      path: "boot>first_input>first_flight",
      stalledAt: "first_flight",
      step: 2,
      stalledAfterMs: 41_200,
      stuckForMs: 90_000,
    })).toEqual({ k: "funnel_summary", st: "first_flight", si: 2 });
    // Any other event keeps its stage-shaped prop at home, even if a future
    // caller passes one: the whitelist is by event name, not by prop name.
    expect(coarseEvent("run_end", { stage: "first_flight", step: 2 })).toEqual({ k: "run_end" });
  });

  it("keeps mode and whole kilometres, and nothing else", () => {
    expect(coarseEvent("run_end", { mode: "zenith", distance: 2_540 })).toEqual({ k: "run_end", mode: "zenith", km: 2 });
    expect(coarseEvent("run_end", { distance: 900 })).toEqual({ k: "run_end", km: 0 });
  });

  it("refuses a stage id that is not a lowercase word", () => {
    for (const bad of ["First Flight", "first-flight", "", "<script>", "a".repeat(40), "1st_input"]) {
      expect(coarseEvent("funnel_stage", { stage: bad, step: 1 }).st, bad).toBeUndefined();
    }
    expect(coarseEvent("funnel_stage", { step: 1 })).toEqual({ k: "funnel_stage", si: 1 });
  });

  it("clamps the stage index into the range the backend accepts", () => {
    expect(coarseEvent("funnel_stage", { stage: "boot", step: 999 }).si).toBe(31);
    expect(coarseEvent("funnel_stage", { stage: "boot", step: -4 }).si).toBe(0);
    expect(coarseEvent("funnel_stage", { stage: "boot", step: Number.NaN }).si).toBeUndefined();
    expect(coarseEvent("funnel_stage", { stage: "boot", step: 2.4 }).si).toBe(2);
  });
});
