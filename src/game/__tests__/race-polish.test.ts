import { describe, expect, it } from "vitest";
import { gradeStateCadence, photoFinishMessage } from "../Racer";

describe("race polish", () => {
  it("keeps link quality unknown until cadence has evidence", () => {
    expect(gradeStateCadence([])).toBe("unknown");
    expect(gradeStateCadence([0.07, 0.07])).toBe("unknown");
    expect(gradeStateCadence([0.067, 0.07, 0.065])).toBe("good");
    expect(gradeStateCadence([0.12, 0.14, 0.13])).toBe("fair");
    expect(gradeStateCadence([0.25, 0.3, 0.24])).toBe("poor");
  });
  it("formats a readable metre margin and strips name control whitespace", () => {
    expect(photoFinishMessage(true, "Ace\nPilot", 0.34)).toBe("Photo finish — you edged Ace Pilot by 0.3 m");
    expect(photoFinishMessage(false, "Kite", 4.6)).toBe("Photo finish — Kite pipped you by 5 m");
  });
});
