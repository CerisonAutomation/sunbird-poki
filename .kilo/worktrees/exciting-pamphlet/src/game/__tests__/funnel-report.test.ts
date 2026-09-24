/**
 * The funnel report renderer — the ops surface for "where do players drop off".
 *
 * The aggregation itself is tested against the real service in
 * `server/tests/telemetry-funnel.test.ts`; these cases pin the *reading* of it,
 * because a report that prints a dash where a rate belongs, or that hides the
 * worst step, is how a number nobody checked ends up in a design decision.
 */
import { describe, expect, it } from "vitest";

// @ts-expect-error — the script is plain ESM JS with no type declarations.
import { formatFunnel } from "../../../scripts/funnel-report.mjs";

const REPORT = {
  devices: 40,
  entered: 40,
  stalled: 40,
  worst: { stage: "first_death->first_retry", dropOff: 0.444, reached: 10, of: 18 },
  steps: [
    { stage: "boot", step: 0, reached: 40, conversion: null, dropOff: null, stalled: 6 },
    { stage: "first_input", step: 1, reached: 34, conversion: 0.85, dropOff: 0.15, stalled: 4 },
    { stage: "first_death", step: 5, reached: 18, conversion: 1, dropOff: 0, stalled: 8 },
    { stage: "first_retry", step: 6, reached: 10, conversion: 0.556, dropOff: 0.444, stalled: 0 },
  ],
};

describe("funnel report", () => {
  it("prints one row per stage, in order, with the rates beside them", () => {
    const text = formatFunnel(REPORT) as string;
    const rows = text.split("\n").filter((l: string) => /^\s+\d+\s+\S/.test(l));
    expect(rows).toHaveLength(4);
    expect(rows[0]).toContain("boot");
    expect(rows[0]).toContain("40");
    // The first stage has no previous stage, so it has no rate — and that must
    // read as "not measured", never as 0%.
    expect(rows[0]).toContain("—");
    expect(rows[0]).not.toContain("0.0%");
    expect(rows[3]).toContain("first_retry");
    expect(rows[3]).toContain("55.6%");
    expect(rows[3]).toContain("44.4%");
  });

  it("names the worst step with the numbers behind it", () => {
    const text = formatFunnel(REPORT) as string;
    expect(text).toContain("worst step: first_death->first_retry");
    expect(text).toContain("44.4% lost");
    expect(text).toContain("(10 of 18 continued)");
  });

  it("says so when there is nothing to report, instead of printing an empty table", () => {
    const empty = formatFunnel({ devices: 0, entered: 0, stalled: 0, worst: null, steps: [] }) as string;
    expect(empty).toContain("nothing to report");
    expect(empty).not.toContain("worst step");
  });

  it("says so when the sample is too small for a rate", () => {
    const thin = formatFunnel({
      devices: 3,
      entered: 3,
      stalled: 3,
      worst: null,
      steps: [
        { stage: "boot", step: 0, reached: 3, conversion: null, dropOff: null, stalled: 1 },
        { stage: "first_input", step: 1, reached: 2, conversion: null, dropOff: null, stalled: 2 },
      ],
    }) as string;
    expect(thin).toContain("no rate reported yet");
    expect(thin).toContain("below 5 sessions");
  });

  it("carries the two caveats a reader must not miss", () => {
    const text = formatFunnel(REPORT) as string;
    // Portal traffic never reaches this sink, and the counters are not durable.
    expect(text).toContain("Portal builds send no telemetry here");
    expect(text).toContain("Counters reset on restart");
    // A cohort behind one NAT under-reports: the reader has to know that
    // before quoting a session count.
    expect(text).toContain("rate-limited per IP");
  });
});
