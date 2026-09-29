import { describe, expect, it } from "vitest";
import { SaveData } from "../SaveData";
import {
  atlas,
  calendarCard,
  dailyCard,
  gauntletCard,
  loadoutView,
  rivalCard,
  seasonCard,
  wingsCard,
} from "../gameCards";
import { CALENDAR_DAYS, weeklyGauntlet } from "../Challenges";
import { BIOMES, biomeForIsland } from "../Biomes";
import { skinById } from "../Economy";
import { weekKey } from "../Tournaments";

/**
 * The HUD card builders. Each one reads saved state and returns a plain object
 * the HUD draws; none of them mutate, schedule, or reach back into the running
 * game. That is what makes them testable without a Game instance, and these
 * tests hold that property in place.
 */

const TODAY = "2026-09-29";

describe("dailyCard", () => {
  it("reports the daily as not done on a fresh save", () => {
    const card = dailyCard(new SaveData(), TODAY);
    expect(card.done).toBe(false);
    expect(card.metric).toBeTruthy();
    expect(card.target).toBeGreaterThan(0);
  });

  it("carries the mode name and icon through to the card", () => {
    const card = dailyCard(new SaveData(), TODAY);
    expect(card.modeName).toBeTruthy();
    expect(card.modeIcon).toBeTruthy();
  });

  it("is a pure read: building the card twice returns the same result", () => {
    const save = new SaveData();
    expect(dailyCard(save, TODAY)).toEqual(dailyCard(save, TODAY));
  });
});

describe("gauntletCard", () => {
  it("renders a stage row per stage of this week's gauntlet", () => {
    const g = weeklyGauntlet(weekKey());
    const card = gauntletCard(new SaveData());
    expect(card.stages).toHaveLength(g.stages.length);
    expect(card.stages[0]!.done).toBe(false);
  });

  it("does not report a clear when the save holds stale stage indices", () => {
    // The regression this rule exists for: a save written against a different
    // week's gauntlet carries indices this week does not have. The old rule
    // counted the array length and paid out for a gauntlet never finished.
    const save = new SaveData();
    const c = save.state.challenges;
    c.gauntletWeek = weekKey();
    c.gauntletDone = [7, 8, 9];
    const card = gauntletCard(save);
    expect(card.stages.every((s) => s.done)).toBe(false);
  });

  it("reports a clear once every stage of this week is done", () => {
    const save = new SaveData();
    const c = save.state.challenges;
    c.gauntletWeek = weekKey();
    c.gauntletDone = weeklyGauntlet(weekKey()).stages.map((s) => s.index);
    expect(gauntletCard(save).stages.every((s) => s.done)).toBe(true);
  });

  it("ignores a done-list from a different week entirely", () => {
    const save = new SaveData();
    const c = save.state.challenges;
    c.gauntletWeek = "1999-01-01";
    c.gauntletDone = [0, 1, 2, 3];
    expect(gauntletCard(save).stages.every((s) => s.done)).toBe(false);
  });
});

describe("calendarCard", () => {
  it("lays out exactly CALENDAR_DAYS rows", () => {
    const card = calendarCard(new SaveData(), TODAY);
    expect(card.days).toHaveLength(CALENDAR_DAYS);
    expect(card.days[0]!.day).toBe(1);
    expect(card.days[CALENDAR_DAYS - 1]!.day).toBe(CALENDAR_DAYS);
  });

  it("claims every day up to cycleDay and no more", () => {
    const save = new SaveData();
    save.state.calendar.cycleDay = 5;
    save.state.calendar.lastClaim = "2026-09-28";
    const card = calendarCard(save, TODAY);
    expect(card.days.filter((d) => d.claimed).map((d) => d.day)).toEqual([1, 2, 3, 4, 5]);
  });

  it("marks today only when the claim has not already happened", () => {
    const save = new SaveData();
    save.state.calendar.cycleDay = 3;
    save.state.calendar.lastClaim = TODAY;
    const claimed = calendarCard(save, TODAY);
    expect(claimed.claimedToday).toBe(true);
    expect(claimed.days.filter((d) => d.today)).toHaveLength(0);

    const fresh = new SaveData();
    fresh.state.calendar.cycleDay = 3;
    fresh.state.calendar.lastClaim = "2026-09-28";
    const pending = calendarCard(fresh, TODAY);
    expect(pending.claimedToday).toBe(false);
    expect(pending.days.filter((d) => d.today)).toHaveLength(1);
  });

  it("flags every seventh day as a milestone", () => {
    const days = calendarCard(new SaveData(), TODAY).days;
    expect(days.filter((d) => d.milestone).map((d) => d.day)).toEqual([7, 14, 21, 28]);
  });
});

describe("seasonCard", () => {
  it("always leaves at least one day, and never a negative or fractional one", () => {
    const card = seasonCard(new SaveData());
    expect(card.daysLeft).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(card.daysLeft)).toBe(true);
  });

  it("floors the peak to a whole number for the HUD", () => {
    const save = new SaveData();
    save.state.rankSeason.peak = 1234.87;
    expect(seasonCard(save).peak).toBe(1234);
  });

  it("carries a division and a coin reward for the peak", () => {
    const card = seasonCard(new SaveData());
    expect(card.peakDivision).toBeTruthy();
    expect(card.rewardCoins).toBeGreaterThan(0);
  });
});

describe("wingsCard", () => {
  it("starts on the first tier with a next rung named", () => {
    const card = wingsCard(new SaveData());
    expect(card.name).toBeTruthy();
    expect(card.nextName).toBeTruthy();
    expect(card.nextNeeded).toBeGreaterThan(0);
  });

  it("reports no next rung at the top of the ladder", () => {
    const save = new SaveData();
    save.state.lifetime.distance = 99_000_000;
    const card = wingsCard(save);
    expect(card.nextName).toBe("");
    expect(card.nextNeeded).toBe(0);
  });

  it("keeps progress inside 0..1", () => {
    const save = new SaveData();
    for (const d of [0, 1, 12_500, 3_000_000]) {
      save.state.lifetime.distance = d;
      const p = wingsCard(save).progress;
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});

describe("rivalCard", () => {
  it("passes the season footer through to the card", () => {
    const card = rivalCard(new SaveData());
    expect(card.season.daysLeft).toBeGreaterThanOrEqual(1);
  });
});

describe("atlas", () => {
  it("returns at least two full biome cycles", () => {
    const rows = atlas(new SaveData(), 0);
    expect(rows.length).toBeGreaterThanOrEqual(BIOMES.length * 2);
  });

  it("grows to cover an island the player has reached", () => {
    const save = new SaveData();
    save.state.farthestIsland = 40;
    const rows = atlas(save, 0);
    expect(rows.length).toBeGreaterThan(40);
    expect(rows.some((r) => r.island === 40)).toBe(true);
  });

  it("marks an entry reached only when the island is reached and the biome is seen", () => {
    const save = new SaveData();
    save.state.farthestIsland = 10;
    expect(atlas(save, 0)[0]!.reached).toBe(false); // island reached, biome not recorded

    save.state.biomesSeen = [biomeForIsland(0).id];
    expect(atlas(save, 0)[0]!.reached).toBe(true);
  });

  it("colours every row as a 6-digit hex string", () => {
    for (const row of atlas(new SaveData(), 0)) {
      expect(row.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("loadoutView", () => {
  it("falls back to a default trail label when none is active", () => {
    const save = new SaveData();
    save.state.activeTrail = "";
    expect(loadoutView(save, skinById("paper")).trail).toBe("Default trail");
  });

  it("uses the trail's own label when one is equipped", () => {
    const save = new SaveData();
    save.state.activeTrail = "aurora";
    const view = loadoutView(save, skinById("paper"));
    expect(view.trail).not.toBe("Default trail");
  });

  it("falls back to the raw id for a trail it does not recognise", () => {
    const save = new SaveData();
    save.state.activeTrail = "not-a-real-trail";
    expect(loadoutView(save, skinById("paper")).trail).toBe("not-a-real-trail");
  });

  it("counts armed boosts and names the equipped bird", () => {
    const save = new SaveData();
    save.state.armedBoosts = ["boost-a", "boost-b", "boost-c"];
    const view = loadoutView(save, skinById("paper"));
    expect(view.boosts).toBe(3);
    expect(view.bird).toBeTruthy();
    expect(typeof view.rankedNote).toBe("string");
  });
});
