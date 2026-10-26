import { describe, expect, it } from "vitest";
import { FirstFlight } from "../FirstFlight";

const DT = 1 / 60;

function feed(c: FirstFlight, frames: number, sig: Parameters<FirstFlight["update"]>[1]): void {
  for (let i = 0; i < frames; i++) c.update(DT, sig);
}

describe("FirstFlight coach", () => {
  it("never activates for players who already finished it", () => {
    const c = new FirstFlight(true);
    expect(c.view().step).toBe(-1);
    feed(c, 600, { diving: true, grounded: true, slope: -0.3, justLaunched: false, airborne: false, islandIndex: 0 });
    expect(c.done).toBe(false); // stays inert, never re-completes
  });

  it("walks dive -> launch -> soar, then hands off to the sun step", () => {
    const c = new FirstFlight(false);
    expect(c.view().text).toContain("HOLD");

    // Holding on flat ground does NOT count as a dive lesson.
    feed(c, 120, { diving: true, grounded: true, slope: 0, justLaunched: false, airborne: false, islandIndex: 0 });
    expect(c.view().step).toBe(0);

    // Holding down a real slope does.
    feed(c, 60, { diving: true, grounded: true, slope: -0.2, justLaunched: false, airborne: false, islandIndex: 0 });
    expect(c.view().step).toBe(1);
    expect(c.view().text).toContain("RELEASE");

    // Waiting does not pass the launch step — an actual launch does.
    feed(c, 300, { diving: false, grounded: true, slope: 0.2, justLaunched: false, airborne: false, islandIndex: 0 });
    expect(c.view().step).toBe(1);
    c.update(DT, { diving: false, grounded: false, slope: 0.2, justLaunched: true, airborne: true, islandIndex: 0 });
    expect(c.view().step).toBe(2);

    // Touching down resets the soar clock; sustained air passes the soar step
    // but the coach is NOT done — step 4 (the sun) still has to be earned.
    feed(c, 60, { diving: false, grounded: false, slope: 0, justLaunched: false, airborne: true, islandIndex: 0 });
    c.update(DT, { diving: false, grounded: true, slope: 0, justLaunched: false, airborne: false, islandIndex: 0 });
    feed(c, 60, { diving: false, grounded: false, slope: 0, justLaunched: false, airborne: true, islandIndex: 0 });
    expect(c.done).toBe(false);
    feed(c, 160, { diving: false, grounded: false, slope: 0, justLaunched: false, airborne: true, islandIndex: 0 });
    expect(c.done).toBe(false);
    expect(c.view().text).toContain("sun");
  });

  it("teaches the clock and completes only on reaching the NEXT island", () => {
    const c = new FirstFlight(false);
    // Fast-forward through dive -> launch -> soar.
    feed(c, 40, { diving: true, grounded: true, slope: -0.2, justLaunched: false, airborne: false, islandIndex: 0 });
    c.update(DT, { diving: false, grounded: false, slope: 0.2, justLaunched: true, airborne: true, islandIndex: 0 });
    feed(c, 160, { diving: false, grounded: false, slope: 0, justLaunched: false, airborne: true, islandIndex: 0 });
    expect(c.view().text).toContain("The sun is your clock");

    // Staying on the same island never completes the step — no timers.
    feed(c, 600, { diving: false, grounded: true, slope: 0, justLaunched: false, airborne: false, islandIndex: 0 });
    expect(c.done).toBe(false);

    // Crossing onto the next island does: real progression, not a countdown.
    c.update(DT, { diving: false, grounded: false, slope: 0, justLaunched: false, airborne: true, islandIndex: 1 });
    expect(c.done).toBe(true);
    expect(c.view().justCompleted).toBe(true);
  });
});
