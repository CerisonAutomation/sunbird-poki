/**
 * The first behavioural tests over rules that used to live inside `Game.ts`.
 *
 * `Game.ts` is 7,662 lines at 0.52 % statement coverage and no test constructs
 * it, so everything it computed was verified by nothing
 * (`docs/audits/BRUTAL_REPO_AUDIT_2026-09-24.md` §1). `Cards.ts` is the first
 * seam: two of its methods lifted out whole, taking their state as arguments.
 * These cases are the point of the exercise — the gauntlet's clear threshold,
 * the division progress clamp, the top-division edge, and the exact field set a
 * match row may hand to the HUD's `innerHTML` surface (§3).
 *
 * Everything here is deterministic: the week key is built from a pinned date and
 * no builder reads a clock.
 */
import { describe, expect, it } from "vitest";

import { buildGauntletCard, buildRivalCard } from "../Cards";
import { weeklyGauntlet } from "../Challenges";
import { modeById } from "../Modes";
import { defaultRival, divisionFor, nextDivision, type RivalState } from "../pvp";
import { weekKey } from "../Tournaments";

/** A pinned Thursday, so `weekKey` cannot drift with the run date. */
const WEEK = weekKey(new Date("2026-09-24T12:00:00Z"));

const SEASON = { daysLeft: 9, peak: 1410, peakDivision: "Silver", peakIcon: "🥈", rewardCoins: 250 };

function rival(over: Partial<RivalState> = {}): RivalState {
  return { ...defaultRival(), ...over };
}

describe("gauntlet card", () => {
  it("echoes the week and lays its stages out from the mode registry", () => {
    const card = buildGauntletCard(WEEK, [], 0);
    const source = weeklyGauntlet(WEEK);

    expect(card.week).toBe(source.week);
    expect(card.stages).toHaveLength(source.stages.length);
    card.stages.forEach((stage, i) => {
      const def = modeById(source.stages[i].mode);
      expect(stage.index).toBe(source.stages[i].index);
      expect(stage.modeName).toBe(def.name);
      expect(stage.modeIcon).toBe(def.icon);
      expect(stage.target).toBe(source.stages[i].target);
      expect(stage.reward).toBe(source.stages[i].reward);
    });
    expect(card.clearBonus).toBe(source.clearBonus);
  });

  it("marks only the stages the player actually cleared", () => {
    // Stage indices are 0-based: weeklyGauntlet maps its picks with `index: i`.
    const card = buildGauntletCard(WEEK, [0, 2], 0);

    expect(card.stages.filter((s) => s.done).map((s) => s.index)).toEqual([0, 2]);
    expect(card.stages.filter((s) => !s.done).map((s) => s.index)).toEqual([1]);
  });

  it("awards the clear when every stage is done, never before", () => {
    const all = weeklyGauntlet(WEEK).stages.map((s) => s.index);
    expect(buildGauntletCard(WEEK, [], 0).cleared).toBe(false);
    expect(buildGauntletCard(WEEK, all.slice(0, 2), 0).cleared).toBe(false);
    expect(buildGauntletCard(WEEK, all, 0).cleared).toBe(true);
  });

  it("does not report a clear — or a paid bonus — for indices this week does not have", () => {
    // The rule this replaced counted the array (`done.length >= 3`), so three
    // entries of any kind claimed "cleared · +N paid" on the results card.
    const all = weeklyGauntlet(WEEK).stages.map((s) => s.index);
    expect(buildGauntletCard(WEEK, [...all.slice(0, 2), 99], 0).cleared).toBe(false);
    expect(buildGauntletCard(WEEK, [...all.slice(0, 2), all[0]!], 0).cleared).toBe(false);
  });

  it("carries the career total through untouched", () => {
    expect(buildGauntletCard(WEEK, [], 7).lifetimeClears).toBe(7);
  });

  it("ignores a stage index that is not in this week's gauntlet", () => {
    // A save from a previous week can hold indices this gauntlet does not have;
    // they must not silently count toward the clear bonus.
    const card = buildGauntletCard(WEEK, [1, 2, 99], 0);
    expect(card.stages.filter((s) => s.done)).toHaveLength(2);
  });
});

describe("rival card", () => {
  it("floors the rating and names the division it sits in", () => {
    const card = buildRivalCard(rival({ rating: 1234.78 }), SEASON);

    expect(card.rating).toBe(1234);
    expect(card.division).toBe(divisionFor(1234.78).name);
    expect(card.divisionIcon).toBe(divisionFor(1234.78).icon);
  });

  it("reads 0 at the bottom of a division and 1 at its top", () => {
    const div = divisionFor(1200); // Glider, 1100…1249 inclusive
    const span = div.max - div.min;
    expect(span).toBeGreaterThan(0);

    expect(buildRivalCard(rival({ rating: div.min }), SEASON).progress).toBe(0);
    expect(buildRivalCard(rival({ rating: div.max }), SEASON).progress).toBe(1);
    expect(buildRivalCard(rival({ rating: div.min + span / 2 }), SEASON).progress).toBeCloseTo(0.5, 5);
  });

  it("keeps progress inside 0…1 for every rating a save can hold", () => {
    // divisionFor() always returns the band that contains the (floored, non-
    // negative) rating, so the clamp in buildRivalCard is defensive — a rating
    // 500 below Glider simply reads as 55 % of Fledgling, not as a clamped 0.
    // What must hold everywhere is the invariant a progress bar needs: never
    // NaN, never negative, never past full.
    for (const rating of [-500, -1, 0, 1, 999, 1099, 1100, 1249, 1250, 1549, 1550, 999_999, 1e6, 1e9, 1234.5678]) {
      const p = buildRivalCard(rival({ rating }), SEASON).progress;
      expect(Number.isNaN(p), `rating ${rating}`).toBe(false);
      expect(p, `rating ${rating}`).toBeGreaterThanOrEqual(0);
      expect(p, `rating ${rating}`).toBeLessThanOrEqual(1);
    }
  });

  it("agrees with the closed form for the division it lands in", () => {
    for (const rating of [0, 1100, 1249, 1400, 1550, 500_000]) {
      const div = divisionFor(rating);
      const want = div.max > div.min ? (Math.floor(rating) - div.min) / (div.max - div.min) : 1;
      expect(buildRivalCard(rival({ rating }), SEASON).progress).toBeCloseTo(Math.max(0, Math.min(1, want)), 10);
    }
  });

  it("says there is nothing next at the top division", () => {
    const top = 1e6;
    expect(nextDivision(top)).toBeNull();

    const card = buildRivalCard(rival({ rating: top }), SEASON);
    expect(card.nextName).toBe("");
    expect(card.nextNeeded).toBe(0);
    expect(card.progress).toBe(1);
  });

  it("names the next division and the rating it needs below the top", () => {
    const rating = 1200;
    const next = nextDivision(rating);
    if (!next) return;

    const card = buildRivalCard(rival({ rating }), SEASON);
    expect(card.nextName).toBe(next.div.name);
    expect(card.nextNeeded).toBe(next.needed);
  });

  it("copies the record through exactly", () => {
    const card = buildRivalCard(rival({ wins: 12, losses: 5, streak: 3, bestStreak: 7 }), SEASON);

    expect([card.wins, card.losses, card.streak, card.bestStreak]).toEqual([12, 5, 3, 7]);
  });

  it("hands the HUD exactly five match fields, and nothing else", () => {
    // Match rows are rendered into an innerHTML sink, so the projection is the
    // boundary: a new field on RivalMatch must be added here on purpose, not
    // leak into markup by way of a spread (audit §3).
    const card = buildRivalCard(
      rival({ matches: [{ place: 2, field: 41, mode: "sprint", date: "2026-09-24", won: true }] }),
      SEASON,
    );

    expect(card.matches).toHaveLength(1);
    expect(Object.keys(card.matches[0]).sort()).toEqual(["date", "field", "mode", "place", "won"]);
    expect(card.matches[0]).toEqual({ place: 2, field: 41, mode: "sprint", date: "2026-09-24", won: true });
  });

  it("passes the season footer through by identity — the clock stays with the caller", () => {
    expect(buildRivalCard(rival(), SEASON).season).toBe(SEASON);
  });
});
