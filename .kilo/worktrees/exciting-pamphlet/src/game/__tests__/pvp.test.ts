import { describe, expect, it } from "vitest";
import {
  DIVISIONS,
  divisionFor,
  duelOpponent,
  duelSkillFor,
  featuredRivals,
  lobbyRivals,
  medalFor,
  nextDivision,
  ratingDelta,
  RIVAL_BASE_RATING,
  seasonReward,
  softResetRating,
  streakBonus,
} from "../pvp";

describe("divisions", () => {
  it("covers every rating with no gaps", () => {
    for (let r = 0; r <= 2000; r += 7) {
      const d = divisionFor(r);
      expect(r >= d.min && r <= d.max).toBe(true);
    }
  });

  it("orders divisions by ascending min", () => {
    for (let i = 1; i < DIVISIONS.length; i++) {
      expect(DIVISIONS[i]!.min).toBe(DIVISIONS[i - 1]!.max + 1);
    }
  });

  it("nextDivision returns null at the top", () => {
    expect(nextDivision(999999)).toBeNull();
    expect(nextDivision(0)?.div.id).toBe("glider");
  });
});

describe("ratingDelta", () => {
  it("pays winning and charges losing symmetrically", () => {
    expect(ratingDelta(1, 41)).toBeGreaterThan(0);
    expect(ratingDelta(41, 41)).toBeLessThan(0);
    expect(ratingDelta(1, 41)).toBe(-ratingDelta(41, 41));
  });

  it("mid-field finish is ~zero", () => {
    expect(Math.abs(ratingDelta(21, 41))).toBeLessThanOrEqual(1);
  });

  it("beating a bigger field is never worth less", () => {
    expect(ratingDelta(1, 41)).toBeGreaterThanOrEqual(ratingDelta(1, 8));
  });

  it("clamps out-of-range places", () => {
    expect(ratingDelta(0, 40)).toBe(ratingDelta(1, 40));
    expect(ratingDelta(99, 40)).toBe(ratingDelta(40, 40));
  });

  it("live fields scale the same math up, symmetrically", () => {
    expect(ratingDelta(1, 41, true)).toBe(Math.round(ratingDelta(1, 41) * 1.5));
    expect(ratingDelta(1, 41, true)).toBe(-ratingDelta(41, 41, true));
    expect(ratingDelta(1, 41, true)).toBeGreaterThan(ratingDelta(1, 41));
    expect(ratingDelta(41, 41, true)).toBeLessThan(ratingDelta(41, 41));
  });
});

describe("streakBonus", () => {
  it("pays nothing below 2 and caps at 60", () => {
    expect(streakBonus(0)).toBe(0);
    expect(streakBonus(1)).toBe(0);
    expect(streakBonus(2)).toBe(20);
    expect(streakBonus(100)).toBe(60);
  });
});

describe("seasons", () => {
  it("soft reset moves halfway to base", () => {
    expect(softResetRating(1600)).toBe((1600 + RIVAL_BASE_RATING) / 2);
    expect(softResetRating(RIVAL_BASE_RATING)).toBe(RIVAL_BASE_RATING);
  });

  it("higher peak pays a bigger season reward", () => {
    expect(seasonReward(1600).coins).toBeGreaterThan(seasonReward(1000).coins);
  });
});

describe("duels", () => {
  it("duel skill scales with rating and stays clamped", () => {
    expect(duelSkillFor(0)).toBeGreaterThanOrEqual(0.55);
    expect(duelSkillFor(3000)).toBeLessThanOrEqual(1.4);
    expect(duelSkillFor(1400)).toBeGreaterThan(duelSkillFor(1000));
  });

  it("duel opponent is deterministic per seed", () => {
    const a = duelOpponent("2026-09-11", 1200);
    const b = duelOpponent("2026-09-11", 1200);
    expect(a).toEqual(b);
    expect(a.rating).toBeGreaterThanOrEqual(0);
  });
});

describe("helpers", () => {
  it("featuredRivals is deterministic and unique", () => {
    const a = featuredRivals("seed-x");
    const b = featuredRivals("seed-x");
    expect(a).toEqual(b);
    expect(new Set(a.map((r) => r.name)).size).toBe(a.length);
  });

  it("medals", () => {
    expect(medalFor(1)).toBe("🥇");
    expect(medalFor(4)).toBe("#4");
  });

  // The lobby used to pad itself with deterministic name-pool "rivals" and
  // borrowed leaderboard names. Both were fiction. These pin the honest
  // version: real roster in, real rows out, nothing invented when empty.
  it("lobbyRivals shows only the pilots actually seated in the room", () => {
    const rows = lobbyRivals([
      { name: "Wren", ready: true, skin: "sunbird" },
      { name: "Bex", ready: false, skin: "kestrel" },
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Wren", "Bex"]);
    expect(rows.every((r) => r.tag.includes("live"))).toBe(true);
    expect(rows[0]).toMatchObject({ ready: true, skin: "sunbird" });
  });

  it("lobbyRivals invents nobody when the room is empty", () => {
    expect(lobbyRivals([])).toEqual([]);
  });

  it("lobbyRivals caps the list at one screen of pilots", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ name: `P${i}`, ready: false, skin: "s" }));
    const rows = lobbyRivals(many);
    expect(rows).toHaveLength(39);
    expect(rows[38]!.name).toBe("P38");
  });
});
