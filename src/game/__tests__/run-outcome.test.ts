/**
 * Run-outcome semantics — the Poki game-events contract for no-finish-line
 * modes.
 *
 * The Player Fit funnel this feeds reads `run/<mode>` start → complete|fail.
 * Daytrip is the game's DEFAULT mode and has no finish line, so before this
 * rule existed every daytrip in history reported `fail`: a 0 % completion rate
 * on the main mode, produced by the game itself. These tests pin the honest
 * semantics: the flight is the goal.
 */
import { describe, expect, it } from "vitest";
import {
  outcomeForNaturalEnd,
  RUN_COMPLETE_MIN_DISTANCE,
  RUN_COMPLETE_MIN_TIME,
} from "../runOutcome";

describe("run outcome: natural ends in no-finish-line modes", () => {
  it("sunset after a real flight completes the day trip", () => {
    // The measured first-run audit: ~919 m in ~67 s of flight.
    expect(outcomeForNaturalEnd("daylight", { distance: 919, runTime: 67 })).toBe("complete");
  });

  it("choosing to land and rest completes the journey", () => {
    expect(outcomeForNaturalEnd("settled", { distance: 450, runTime: 40 })).toBe("complete");
  });

  it("a beginner's short-but-real flight still completes", () => {
    // The whole point of the rule: a 120 m first flight counts as the day
    // trip it was — a struggling beginner is not told they "failed".
    expect(outcomeForNaturalEnd("daylight", { distance: 120, runTime: 8 })).toBe("complete");
  });

  it("ditching in the sea is always a fail, however far the flight", () => {
    expect(outcomeForNaturalEnd("water", { distance: 2000, runTime: 90 })).toBe("fail");
  });

  it("a no-show launch never completes", () => {
    // AFK / instant abandon: the launch assist carried the bird 40 m for a
    // few seconds and it settled. Nothing was flown.
    expect(outcomeForNaturalEnd("settled", { distance: 40, runTime: 6 })).toBe("fail");
    expect(outcomeForNaturalEnd("daylight", { distance: 0, runTime: 0 })).toBe("fail");
  });

  it("either effort floor is enough — a slow short flight still counts", () => {
    // 60 m but 20 s in the air: the player was flying, the day simply went.
    expect(outcomeForNaturalEnd("daylight", { distance: 60, runTime: 20 })).toBe("complete");
  });

  it("the floors are what the docs say they are", () => {
    expect(RUN_COMPLETE_MIN_DISTANCE).toBe(100);
    expect(RUN_COMPLETE_MIN_TIME).toBe(15);
  });
});
