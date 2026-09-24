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
    feed(c, 600, { diving: true, grounded: true, slope: -0.3, justLaunched: false, airborne: false });
    expect(c.done).toBe(false); // stays inert, never re-completes
  });

  it("walks dive -> launch -> soar and only completes on real play", () => {
    const c = new FirstFlight(false);
    expect(c.view().text).toContain("HOLD");

    // Holding on flat ground does NOT count as a dive lesson.
    feed(c, 120, { diving: true, grounded: true, slope: 0, justLaunched: false, airborne: false });
    expect(c.view().step).toBe(0);

    // Holding down a real slope does.
    feed(c, 60, { diving: true, grounded: true, slope: -0.2, justLaunched: false, airborne: false });
    expect(c.view().step).toBe(1);
    expect(c.view().text).toContain("RELEASE");

    // Waiting does not pass the launch step — an actual launch does.
    feed(c, 300, { diving: false, grounded: true, slope: 0.2, justLaunched: false, airborne: false });
    expect(c.view().step).toBe(1);
    c.update(DT, { diving: false, grounded: false, slope: 0.2, justLaunched: true, airborne: true });
    expect(c.view().step).toBe(2);

    // Touching down resets the soar clock; sustained air completes.
    feed(c, 60, { diving: false, grounded: false, slope: 0, justLaunched: false, airborne: true });
    c.update(DT, { diving: false, grounded: true, slope: 0, justLaunched: false, airborne: false });
    feed(c, 60, { diving: false, grounded: false, slope: 0, justLaunched: false, airborne: true });
    expect(c.done).toBe(false);
    feed(c, 160, { diving: false, grounded: false, slope: 0, justLaunched: false, airborne: true });
    expect(c.done).toBe(true);
    expect(c.view().justCompleted).toBe(true);
  });
});
