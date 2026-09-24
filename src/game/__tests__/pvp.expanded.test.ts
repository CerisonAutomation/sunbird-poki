import { describe, expect, it } from "vitest";
import {
  RIVAL_BASE_RATING,
  divisionFor,
  nextDivision,
  ratingDelta,
  streakBonus,
  featuredRivals,
  medalFor,
  defaultRival,
  rankSeasonId,
  softResetRating,
  seasonReward,
  duelSkillFor,
  duelOpponent,
} from "../pvp";

// ── divisionFor (5 tests) ──────────────────────────────────────────────────────
describe("pvp: divisionFor", () => {
  it("returns Fledgling for rating 0", () => {
    expect(divisionFor(0).id).toBe("fledgling");
  });

  it("returns Glider for rating 1100", () => {
    expect(divisionFor(1100).id).toBe("glider");
  });

  it("returns Legend for rating 999999", () => {
    expect(divisionFor(999999).id).toBe("legend");
  });

  it("handles negative ratings (clamps to Fledgling)", () => {
    expect(divisionFor(-100).id).toBe("fledgling");
  });

  it("boundary at 1099 is Fledgling, 1100 is Glider", () => {
    expect(divisionFor(1099).id).toBe("fledgling");
    expect(divisionFor(1100).id).toBe("glider");
  });
});

// ── nextDivision (5 tests) ─────────────────────────────────────────────────────
describe("pvp: nextDivision", () => {
  it("returns Glider as next for rating 1050", () => {
    const next = nextDivision(1050);
    expect(next).not.toBeNull();
    expect(next!.div.id).toBe("glider");
    expect(next!.needed).toBe(50);
  });

  it("returns null for max rating", () => {
    expect(nextDivision(1_000_000)).toBeNull();
  });

  it("handles rating exactly at threshold", () => {
    const next = nextDivision(1100);
    expect(next).not.toBeNull();
    expect(next!.div.id).toBe("racer");
    expect(next!.needed).toBe(150);
  });

  it("fledgling to glider need 1100 - rating", () => {
    const next = nextDivision(500);
    expect(next).not.toBeNull();
    expect(next!.div.id).toBe("glider");
    expect(next!.needed).toBe(600);
  });

  it("clamps negative rating", () => {
    const next = nextDivision(-10);
    expect(next).not.toBeNull();
    expect(next!.div.id).toBe("glider");
    expect(next!.needed).toBe(1100);
  });
});

// ── ratingDelta (6 tests) ──────────────────────────────────────────────────────
describe("pvp: ratingDelta", () => {
  it("first place in field of 10 gives positive delta", () => {
    expect(ratingDelta(1, 10)).toBeGreaterThan(0);
  });

  it("last place in field of 10 gives negative delta", () => {
    expect(ratingDelta(10, 10)).toBeLessThan(0);
  });

  it("exactly last place delta calculation", () => {
    const delta = ratingDelta(10, 10);
    // score = (10-10)/(10-1) = 0, delta = 26 * (0 - 0.5) * 2 = -26
    expect(delta).toBe(-26);
  });

  it("exactly first place delta calculation", () => {
    const delta = ratingDelta(1, 10);
    // score = (10-1)/(10-1) = 1, delta = 26 * (1 - 0.5) * 2 = 26
    expect(delta).toBe(26);
  });

  it("place is clamped to 1..field", () => {
    const delta = ratingDelta(0, 10);
    // place 0 clamped to 1
    expect(delta).toBe(ratingDelta(1, 10));
  });

  it("field is clamped to minimum 2", () => {
    const delta = ratingDelta(1, 1);
    // field 1 clamped to 2
    expect(delta).toBe(ratingDelta(1, 2));
  });
});

// ── streakBonus (4 tests) ──────────────────────────────────────────────────────
describe("pvp: streakBonus", () => {
  it("returns 0 for streak < 2", () => {
    expect(streakBonus(0)).toBe(0);
    expect(streakBonus(1)).toBe(0);
  });

  it("returns 20 for streak 2", () => {
    expect(streakBonus(2)).toBe(20);
  });

  it("returns 60 for streak >= 6 (capped)", () => {
    expect(streakBonus(6)).toBe(60);
    expect(streakBonus(10)).toBe(60);
    expect(streakBonus(100)).toBe(60);
  });

  it("scales linearly up to cap", () => {
    expect(streakBonus(3)).toBe(30);
    expect(streakBonus(4)).toBe(40);
    expect(streakBonus(5)).toBe(50);
  });
});

// ── featuredRivals (6 tests) ───────────────────────────────────────────────────
describe("pvp: featuredRivals", () => {
  it("returns requested count", () => {
    expect(featuredRivals("seed", 3)).toHaveLength(3);
  });

  it("default count is 3", () => {
    expect(featuredRivals("seed")).toHaveLength(3);
  });

  it("returns objects with name and tag", () => {
    const rivals = featuredRivals("seed");
    for (const r of rivals) {
      expect(r).toHaveProperty("name");
      expect(r).toHaveProperty("tag");
      expect(typeof r.name).toBe("string");
      expect(typeof r.tag).toBe("string");
    }
  });

  it("no duplicate names in result", () => {
    const rivals = featuredRivals("seed", 8);
    const names = rivals.map((r) => r.name);
    expect(new Set(names).size).toBe(rivals.length);
  });

  it("is deterministic for same seed", () => {
    const a = featuredRivals("test", 3);
    const b = featuredRivals("test", 3);
    expect(a).toEqual(b);
  });

  it("different seeds produce different results", () => {
    const a = featuredRivals("seed1", 3);
    const b = featuredRivals("seed2", 3);
    const diffs = a.filter((r, i) => r.name !== b[i]!.name);
    expect(diffs.length).toBeGreaterThan(0);
  });
});

// ── medalFor (4 tests) ─────────────────────────────────────────────────────────
describe("pvp: medalFor", () => {
  it("returns gold for 1st place", () => {
    expect(medalFor(1)).toBe("🥇");
  });

  it("returns silver for 2nd place", () => {
    expect(medalFor(2)).toBe("🥈");
  });

  it("returns bronze for 3rd place", () => {
    expect(medalFor(3)).toBe("🥉");
  });

  it("returns #N for places 4+", () => {
    expect(medalFor(4)).toBe("#4");
    expect(medalFor(10)).toBe("#10");
  });
});

// ── defaultRival (3 tests) ─────────────────────────────────────────────────────
describe("pvp: defaultRival", () => {
  it("returns base rating 1000", () => {
    expect(defaultRival().rating).toBe(RIVAL_BASE_RATING);
  });

  it("returns zeroed stats", () => {
    const r = defaultRival();
    expect(r.wins).toBe(0);
    expect(r.losses).toBe(0);
    expect(r.streak).toBe(0);
    expect(r.bestStreak).toBe(0);
    expect(r.matches).toHaveLength(0);
  });

  it("new instance each call", () => {
    const a = defaultRival();
    const b = defaultRival();
    expect(a).not.toBe(b);
    expect(a.matches).not.toBe(b.matches);
  });
});

// ── rankSeasonId (3 tests) ─────────────────────────────────────────────────────
describe("pvp: rankSeasonId", () => {
  it("produces RYYYY-MM format", () => {
    const d = new Date(2026, 9, 15);
    expect(rankSeasonId(d)).toBe("R2026-10");
  });

  it("pads month with zero", () => {
    const d = new Date(2026, 0, 5);
    expect(rankSeasonId(d)).toBe("R2026-01");
  });

  it("defaults to current date", () => {
    const id = rankSeasonId();
    expect(id).toMatch(/^R\d{4}-\d{2}$/);
  });
});

// ── softResetRating (5 tests) ──────────────────────────────────────────────────
describe("pvp: softResetRating", () => {
  it("averages rating with base", () => {
    expect(softResetRating(2000)).toBe(1500);
  });

  it("handles rating at base (returns base)", () => {
    expect(softResetRating(1000)).toBe(1000);
  });

  it("handles rating 0 (returns 500)", () => {
    expect(softResetRating(0)).toBe(500);
  });

  it("clamps negative to 0", () => {
    expect(softResetRating(-100)).toBe(500);
  });

  it("rounds to nearest integer", () => {
    expect(softResetRating(1005)).toBe(1003);
    expect(softResetRating(1008)).toBe(1004);
  });
});

// ── seasonReward (4 tests) ─────────────────────────────────────────────────────
describe("pvp: seasonReward", () => {
  it("Fledgling gives 60 coins", () => {
    expect(seasonReward(500).coins).toBe(60);
  });

  it("Glider gives 130 coins", () => {
    expect(seasonReward(1100).coins).toBe(130);
  });

  it("Legend gives 340 coins", () => {
    expect(seasonReward(2000).coins).toBe(340);
  });

  it("returns the division reached", () => {
    expect(seasonReward(1250).division.id).toBe("racer");
    expect(seasonReward(1500).division.id).toBe("ace");
    expect(seasonReward(2000).division.id).toBe("legend");
  });
});

// ── duelSkillFor (5 tests) ─────────────────────────────────────────────────────
describe("pvp: duelSkillFor", () => {
  it("returns 0.6 for base rating 1000", () => {
    expect(duelSkillFor(1000)).toBeCloseTo(0.6, 2);
  });

  it("returns 0.55 for rating 0 (minimum)", () => {
    expect(duelSkillFor(0)).toBeCloseTo(0.55, 2);
  });

  it("returns 1.4 for very high rating (maximum)", () => {
    expect(duelSkillFor(5000)).toBeCloseTo(1.4, 2);
  });

   it("scales linearly between 1000 and 1400 (before cap at 1.4)", () => {
    const s1000 = duelSkillFor(1000);
    const s1400 = duelSkillFor(1400);
    expect(s1400).toBeCloseTo(s1000 + (400 / 800), 2);
  });

  it("clamps negative rating to 0.55", () => {
    expect(duelSkillFor(-100)).toBeCloseTo(0.55, 2);
  });
});

// ── duelOpponent (6 tests) ─────────────────────────────────────────────────────
describe("pvp: duelOpponent", () => {
  it("returns object with name, tag, rating", () => {
    const opp = duelOpponent("seed", 1000);
    expect(opp).toHaveProperty("name");
    expect(opp).toHaveProperty("tag");
    expect(opp).toHaveProperty("rating");
  });

  it("rating is within ±60 of input", () => {
    const opp = duelOpponent("seed", 1000);
    expect(opp.rating).toBeGreaterThanOrEqual(940);
    expect(opp.rating).toBeLessThanOrEqual(1060);
  });

  it("is deterministic for same seed+rating", () => {
    const a = duelOpponent("seed", 1000);
    const b = duelOpponent("seed", 1000);
    expect(a).toEqual(b);
  });

  it("handles rating 0", () => {
    const opp = duelOpponent("seed", 0);
    expect(opp.rating).toBeGreaterThanOrEqual(0);
  });

  it("handles very high rating", () => {
    const opp = duelOpponent("seed", 10000);
    expect(opp.rating).toBeGreaterThan(9940);
  });

  it("rating is non-negative", () => {
    const opp = duelOpponent("seed", 0);
    expect(opp.rating).toBeGreaterThanOrEqual(0);
  });
});
