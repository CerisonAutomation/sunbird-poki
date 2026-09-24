import { describe, expect, it } from "vitest";
import { clampSequencerTime } from "../Music";

/**
 * Regression guard for the music scheduler's catch-up burst.
 *
 * Browsers throttle timers in hidden/occluded tabs to >= 1 s. Without this
 * clamp the lookahead loop schedules every missed step at the same instant,
 * which the player hears as the music stuttering or repeating on return.
 */
describe("clampSequencerTime", () => {
  it("leaves an on-time sequencer untouched", () => {
    expect(clampSequencerTime(10, 10)).toBe(10);
    expect(clampSequencerTime(10.05, 10)).toBe(10.05);
  });

  it("leaves a sequencer that is only slightly behind untouched", () => {
    expect(clampSequencerTime(9.9, 10)).toBe(9.9);
    // 0.25s behind is inside the default 0.28s lag window.
    expect(clampSequencerTime(9.75, 10)).toBe(9.75);
  });

  it("re-anchors a sequencer that was throttled far behind the clock", () => {
    // A hidden tab: ~2s behind must skip forward, never replay the backlog.
    expect(clampSequencerTime(8, 10)).toBeCloseTo(10.05, 5);
    // A very long background stint must not produce a huge burst either.
    expect(clampSequencerTime(0, 600)).toBeCloseTo(600.05, 5);
  });

  it("honours custom lag and re-anchor windows", () => {
    expect(clampSequencerTime(9, 10, 0.5, 0.02)).toBeCloseTo(10.02, 5);
    expect(clampSequencerTime(9.6, 10, 0.5, 0.02)).toBe(9.6);
  });

  it("never moves the sequencer backwards", () => {
    const out = clampSequencerTime(8, 10);
    expect(out).toBeGreaterThan(10);
  });
});
