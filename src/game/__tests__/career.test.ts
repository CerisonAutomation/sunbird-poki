import { describe, expect, it } from "vitest";
import { WINGS, nextWings, wingsFor, wingsProgress, wingsPromotion } from "../Career";

describe("career wings", () => {
  it("ladder is ordered and starts at zero", () => {
    expect(WINGS[0]!.min).toBe(0);
    for (let i = 1; i < WINGS.length; i++) {
      expect(WINGS[i]!.min).toBeGreaterThan(WINGS[i - 1]!.min);
    }
  });

  it("maps lifetime distance to the right tier", () => {
    expect(wingsFor(0).id).toBe("paper");
    expect(wingsFor(24_999).id).toBe("paper");
    expect(wingsFor(25_000).id).toBe("bronze");
    expect(wingsFor(999_999).id).toBe("gold");
    expect(wingsFor(99_000_000).id).toBe("aurora");
    expect(wingsFor(-50).id).toBe("paper");
  });

  it("nextWings reports the next rung and null at the top", () => {
    const n = nextWings(0)!;
    expect(n.tier.id).toBe("bronze");
    expect(n.needed).toBe(25_000);
    expect(nextWings(2_500_000)).toBeNull();
  });

  it("progress is 0..1 within a tier and 1 at the summit", () => {
    expect(wingsProgress(0)).toBe(0);
    expect(wingsProgress(12_500)).toBeCloseTo(0.5);
    expect(wingsProgress(3_000_000)).toBe(1);
  });

  it("promotion fires exactly on crossing a threshold", () => {
    expect(wingsPromotion(24_000, 26_000)!.id).toBe("bronze");
    expect(wingsPromotion(26_000, 30_000)).toBeNull();
    expect(wingsPromotion(0, 5_000)).toBeNull();
    // A monster flight can jump two rungs — the reported tier is the final one.
    expect(wingsPromotion(0, 150_000)!.id).toBe("silver");
  });
});
