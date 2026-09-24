import { describe, expect, it } from "vitest";
import { CAMPAIGN, campaignProgress, campaignViews } from "../Campaign";
import { emptyEventProgress, monthKey, monthlyTheme, rollEventProgress, THEME_TRAIL_CLEARS, weeklyEvent } from "../Events";
import { TRAILS } from "../Tournaments";
import type { SaveData } from "../SaveData";

describe("weekly events", () => {
  it("is deterministic for a given date", () => {
    const d = new Date(2026, 8, 11);
    const a = weeklyEvent(d);
    const b = weeklyEvent(new Date(2026, 8, 11));
    expect(a.id).toBe(b.id);
    expect(a.name).toBe(b.name);
    expect(a.id.startsWith("evt-")).toBe(true);
  });

  it("has sane modifiers and a reachable target", () => {
    for (let m = 0; m < 12; m++) {
      const ev = weeklyEvent(new Date(2026, m, 3));
      expect(ev.mods.coinMult).toBeGreaterThanOrEqual(1);
      expect(ev.mods.gravityMult).toBeGreaterThan(0.5);
      expect(ev.mods.gravityMult).toBeLessThan(1.5);
      expect(ev.target).toBeGreaterThan(500);
      expect(ev.reward).toBeGreaterThan(0);
    }
  });

  it("monthly theme prize trails all exist", () => {
    for (let m = 0; m < 12; m++) {
      const th = monthlyTheme(new Date(2027, m, 15));
      expect(TRAILS[th.prizeTrail], th.prizeTrail).toBeDefined();
    }
  });

  it("rolls progress windows forward and resets counters", () => {
    const d1 = new Date(2026, 0, 5);
    const p = rollEventProgress(emptyEventProgress(), d1);
    p.clearsThisWeek = 2;
    p.clearsThisMonth = 2;
    // same week: nothing resets
    const same = rollEventProgress(p, new Date(2026, 0, 6));
    expect(same.clearsThisWeek).toBe(2);
    // next month: both reset (new ISO week + new month)
    const later = rollEventProgress(p, new Date(2026, 1, 9));
    expect(later.clearsThisWeek).toBe(0);
    expect(later.clearsThisMonth).toBe(0);
    expect(later.month).toBe(monthKey(new Date(2026, 1, 9)));
    expect(THEME_TRAIL_CLEARS).toBeGreaterThan(0);
  });
});

function fakeSave(overrides: Record<string, unknown> = {}): SaveData {
  return {
    state: {
      lifetime: { distance: 0, coins: 0, zeniths: 0, ghostBeats: 0 },
      bestDistance: 0,
      bestAltitude: 0,
      bestCombo: 0,
      runsPlayed: 0,
      racesRun: 0,
      bestPlace: 0,
      farthestIsland: 0,
      biomesSeen: [],
      ownedSkins: ["sunbird"],
      duel: { wins: 0, losses: 0, streak: 0, bestStreak: 0 },
      challenges: { dailiesDone: 0, gauntletsCleared: 0 },
      ...overrides,
    },
  } as unknown as SaveData;
}

describe("campaign", () => {
  it("has 8 sequential chapters of 3 goals each", () => {
    expect(CAMPAIGN.length).toBe(8);
    for (const ch of CAMPAIGN) expect(ch.goals.length).toBe(3);
    // rewards escalate
    for (let i = 1; i < CAMPAIGN.length; i++) {
      expect(CAMPAIGN[i]!.rewardCoins).toBeGreaterThan(CAMPAIGN[i - 1]!.rewardCoins);
    }
  });

  it("only chapter 1 unlocks for a fresh save", () => {
    const views = campaignViews(fakeSave(), []);
    expect(views[0]!.unlocked).toBe(true);
    expect(views[1]!.unlocked).toBe(false);
    expect(views.every((v) => !v.complete)).toBe(true);
  });

  it("completing chapter 1 goals unlocks chapter 2", () => {
    const save = fakeSave({
      lifetime: { distance: 1200, coins: 80, zeniths: 0, ghostBeats: 0 },
      runsPlayed: 4,
    });
    const views = campaignViews(save, []);
    expect(views[0]!.complete).toBe(true);
    expect(views[1]!.unlocked).toBe(true);
    expect(views[2]!.unlocked).toBe(false);
  });

  it("tracks claim progress", () => {
    expect(campaignProgress([]).done).toBe(0);
    expect(campaignProgress(["ch1", "ch2", "bogus"]).done).toBe(2);
    expect(campaignProgress([]).total).toBe(8);
  });

  it("goal progress clamps at target", () => {
    const save = fakeSave({ lifetime: { distance: 999999, coins: 99999, zeniths: 0, ghostBeats: 0 }, runsPlayed: 500 });
    const v = campaignViews(save, [])[0]!;
    for (const g of v.goals) expect(g.progress).toBeLessThanOrEqual(g.def.target);
  });
});
