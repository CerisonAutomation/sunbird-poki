import { describe, expect, it } from "vitest";
import {
  CALENDAR_DAYS,
  calendarReward,
  dailyChallenge,
  dailyDone,
  MODIFIERS,
  modsFor,
  stageDone,
  weeklyGauntlet,
} from "../Challenges";
import type { RunStats } from "../Missions";

const stats = (over: Partial<RunStats> = {}): RunStats => ({
  clouds: 0,
  island: 1,
  coins: 0,
  perfects: 0,
  distance: 0,
  fever: 0,
  zenith: 0,
  pickups: 0,
  ...over,
});

describe("dailyChallenge", () => {
  it("is deterministic per date", () => {
    expect(dailyChallenge("2026-09-11")).toEqual(dailyChallenge("2026-09-11"));
  });

  it("differs across dates (over a month)", () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 30; d++) {
      const c = dailyChallenge(`2026-09-${String(d).padStart(2, "0")}`);
      seen.add(`${c.mode}:${c.metric}:${c.target}:${c.modifier.id}`);
      expect(c.target).toBeGreaterThan(0);
      expect(c.reward).toBeGreaterThan(0);
    }
    expect(seen.size).toBeGreaterThan(5);
  });

  it("dailyDone respects the metric", () => {
    const c = dailyChallenge("2026-09-11");
    expect(dailyDone(stats(), c)).toBe(false);
    expect(dailyDone(stats({ [c.metric]: c.target } as Partial<RunStats>), c)).toBe(true);
  });
});

describe("modifiers", () => {
  it("every modifier maps to real mods", () => {
    for (const m of MODIFIERS) {
      const mods = modsFor(m.id);
      const differs =
        mods.daylightMult !== 1 || mods.coinMult !== 1 || mods.speedMult !== 1 || mods.noPowerups;
      expect(differs).toBe(true);
    }
  });
});

describe("weeklyGauntlet", () => {
  it("is deterministic per week and escalates", () => {
    const g = weeklyGauntlet("2026-W37");
    expect(g).toEqual(weeklyGauntlet("2026-W37"));
    expect(g.stages).toHaveLength(3);
    // No duplicate stage types within a week.
    expect(new Set(g.stages.map((s) => `${s.mode}:${s.metric}:${s.label}`)).size).toBe(3);
    expect(g.stages[2]!.reward).toBeGreaterThan(g.stages[0]!.reward);
  });

  it("stageDone respects targets", () => {
    const g = weeklyGauntlet("2026-W37");
    const st = g.stages[0]!;
    expect(stageDone(stats(), st)).toBe(false);
    expect(stageDone(stats({ [st.metric]: st.target } as Partial<RunStats>), st)).toBe(true);
  });
});

describe("calendar", () => {
  it("has milestones at 7/14/21/28 and coins elsewhere", () => {
    expect(calendarReward(7).kind).toBe("boost");
    expect(calendarReward(14)).toEqual({ kind: "coins", amount: 300 });
    expect(calendarReward(21).kind).toBe("boost");
    expect(calendarReward(28).kind).toBe("trail");
    for (const d of [1, 3, 12, 26]) expect(calendarReward(d).kind).toBe("coins");
  });

  it("cycles after 28 days", () => {
    expect(calendarReward(CALENDAR_DAYS + 1)).toEqual(calendarReward(1));
  });

  it("plain days escalate", () => {
    const a = calendarReward(2);
    const b = calendarReward(26);
    if (a.kind === "coins" && b.kind === "coins") expect(b.amount).toBeGreaterThan(a.amount);
  });
});
