import { describe, expect, it } from "vitest";

import { MEDAL_LADDER, medalFor, medalStanding } from "../RunMedals";

/**
 * The ladder is pure data with no persistence behind it, which is the point:
 * a threshold a player has to beat must not move when the player improves. So
 * these tests are mostly about the ladder staying absolute and monotonic, and
 * about the gap arithmetic a player steers by being correct.
 */
describe("medalFor", () => {
  it("earns nothing below the first rung", () => {
    expect(medalFor(0)).toBe("none");
    expect(medalFor(249)).toBe("none");
  });

  it("earns exactly the rung whose threshold it reached", () => {
    expect(medalFor(250)).toBe("bronze");
    expect(medalFor(600)).toBe("silver");
    expect(medalFor(1200)).toBe("gold");
    expect(medalFor(2500)).toBe("platinum");
  });

  it("holds the higher medal well past its threshold rather than flickering", () => {
    expect(medalFor(599)).toBe("bronze");
    expect(medalFor(601)).toBe("silver");
    expect(medalFor(100_000)).toBe("platinum");
  });

  it("treats nonsense as nothing rather than throwing or winning", () => {
    expect(medalFor(Number.NaN)).toBe("none");
    expect(medalFor(Number.POSITIVE_INFINITY)).toBe("none");
    expect(medalFor(-1)).toBe("none");
  });
});

describe("medalStanding — the gap a player steers by", () => {
  it("counts down the metres to the next rung", () => {
    expect(medalStanding(100).toNext).toBe(150); // 250 - 100
    expect(medalStanding(250).toNext).toBe(350); // to silver at 600
    expect(medalStanding(600).toNext).toBe(600); // to gold at 1200
  });

  it("rounds the gap UP, never to zero — a whole metre is still a metre", () => {
    // 250.5 is past bronze; to silver it is 349.5m, which must read 350.
    expect(medalStanding(250.5).toNext).toBe(350);
    // 249.9 is just short of bronze; the gap to bronze is 0.1m and must read 1,
    // not 0, or the UI would show a rung it is already "at".
    expect(medalStanding(249.9).toNext).toBe(1);
  });

  it("never reports a negative gap", () => {
    for (let d = 0; d < 3000; d += 37) {
      const s = medalStanding(d);
      expect(s.toNext ?? 0, `distance ${d}`).toBeGreaterThanOrEqual(0);
    }
  });

  it("names the next rung so the target is unambiguous", () => {
    expect(medalStanding(300).next).toBe("silver");
    expect(medalStanding(300).nextAt).toBe(600);
    expect(medalStanding(2000).next).toBe("platinum");
  });

  it("reports a topped ladder rather than a null next", () => {
    const top = medalStanding(99_999);
    expect(top.earned).toBe("platinum");
    expect(top.topped).toBe(true);
    expect(top.toNext).toBeNull();
    expect(top.next).toBeNull();
  });

  it("is a floor, not a ceiling — topping out does not beat the ladder", () => {
    // A perfect run still shows platinum, never "mastered". That is the Flappy
    // Bird property worth keeping: the ladder stays visible at the top instead
    // of turning into a rank you can lose.
    expect(medalStanding(1e9).earned).toBe("platinum");
    expect(medalStanding(1e9).topped).toBe(true);
  });
});

describe("the ladder itself", () => {
  it("is strictly ascending, so `beaten.length` indexes the next rung", () => {
    for (let i = 1; i < MEDAL_LADDER.length; i++) {
      expect(MEDAL_LADDER[i]!.at, `${MEDAL_LADDER[i]!.medal} vs ${MEDAL_LADDER[i - 1]!.medal}`)
        .toBeGreaterThan(MEDAL_LADDER[i - 1]!.at);
    }
  });

  it("has a unique medal per rung", () => {
    expect(new Set(MEDAL_LADDER.map((t) => t.medal)).size).toBe(MEDAL_LADDER.length);
  });

  it("keeps a human-readable label for every rung — no raw ids in the UI", () => {
    for (const tier of MEDAL_LADDER) {
      expect(tier.label, tier.medal).toBe(tier.label[0]!.toUpperCase() + tier.label.slice(1));
    }
  });

  it("starts low enough that a first run can clear it", () => {
    // A first run in the shipped build reaches roughly 100-200m. If bronze
    // sat above that, nobody would ever see a medal and the whole thing is
    // invisible. Pinned so moving the first rung up is a deliberate act.
    expect(MEDAL_LADDER[0]!.at).toBeLessThanOrEqual(250);
  });
});
