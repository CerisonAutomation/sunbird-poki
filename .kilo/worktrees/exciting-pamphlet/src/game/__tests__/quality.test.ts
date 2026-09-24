import { describe, expect, it } from "vitest";
import { DPR_FLOOR, DPR_STEP, nextDpr } from "../quality";

/**
 * The adaptive resolution loop used to only ever step down, so one bad moment
 * permanently degraded the rest of the session. These lock in the two-way
 * behaviour and the anti-oscillation guards.
 */
describe("nextDpr", () => {
  it("holds steady while the cooldown is active", () => {
    expect(nextDpr(1.5, 2, 1 / 20, 5)).toBe(1.5);
    expect(nextDpr(1.5, 2, 1 / 120, 0.1)).toBe(1.5);
  });

  it("steps down when the frame budget is blown", () => {
    expect(nextDpr(2, 2, 1 / 20, 0)).toBe(2 - DPR_STEP);
    expect(nextDpr(1.25, 2, 1 / 10, 0)).toBe(DPR_FLOOR);
  });

  it("never drops below the floor", () => {
    expect(nextDpr(1, 2, 1 / 10, 0)).toBe(DPR_FLOOR);
    expect(nextDpr(0.5, 2, 1 / 10, 0)).toBe(DPR_FLOOR);
  });

  it("steps back up when there is sustained headroom", () => {
    expect(nextDpr(1, 2, 1 / 120, 0)).toBe(1 + DPR_STEP);
    expect(nextDpr(1.75, 2, 1 / 120, 0)).toBe(2);
  });

  it("never exceeds the target ceiling", () => {
    expect(nextDpr(2, 2, 1 / 120, 0)).toBe(2);
    expect(nextDpr(3, 2, 1 / 120, 0)).toBe(2);
  });

  it("follows a lowered target down when the player changes quality", () => {
    // preferredDpr() returns 1 for "low"; the loop must snap to it.
    expect(nextDpr(2, 1, 1 / 120, 0)).toBe(1);
  });

  it("does nothing inside the dead band", () => {
    // 1/50 sits between the step-up and step-down thresholds.
    expect(nextDpr(1.5, 2, 1 / 50, 0)).toBe(1.5);
  });
});
