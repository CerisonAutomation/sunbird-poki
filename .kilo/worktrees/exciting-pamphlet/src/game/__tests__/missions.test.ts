import { beforeEach, describe, expect, it } from "vitest";
import { MISSION_DEFS, Missions } from "../Missions";
import { SaveData } from "../SaveData";

describe("missions", () => {
  let save: SaveData;

  beforeEach(() => {
    localStorage.clear();
    save = new SaveData();
  });

  it("exposes a fixed mission catalogue with unique ids", () => {
    const ids = MISSION_DEFS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(MISSION_DEFS.length).toBeGreaterThan(0);
    for (const d of MISSION_DEFS) expect(d.target).toBeGreaterThan(0);
  });

  it("reports progress from run stats and completion on crossing the target", () => {
    const m = new Missions(save);
    const view = m.view({ clouds: 3, island: 0, coins: 0, perfects: 0, distance: 0, fever: 0, zenith: 0, pickups: 0 });
    const clouds5 = view.find((v) => v.def.id === "clouds5")!;
    expect(clouds5.progress).toBe(3);
    expect(clouds5.done).toBe(false);
  });

  it("applyRun completes missions and returns the new ids", () => {
    const m = new Missions(save);
    const stats = { clouds: 5, island: 5, coins: 0, perfects: 0, distance: 5000, fever: 0, zenith: 0, pickups: 6 };
    const newly = m.applyRun(stats);
    expect(newly).toContain("clouds5");
    expect(newly).toContain("island5");
    expect(newly).toContain("distance5k");
    // Already completed missions are not re-reported.
    expect(m.applyRun(stats)).toHaveLength(0);
  });

  it("marks previously completed missions as done even with no current stats", () => {
    save.state.completedMissions.push("clouds5");
    const view = new Missions(save).view(null);
    const clouds5 = view.find((v) => v.def.id === "clouds5")!;
    expect(clouds5.completedBefore).toBe(true);
    expect(clouds5.done).toBe(true);
    expect(clouds5.progress).toBe(clouds5.def.target);
  });

  it("daily quests are deterministic per day and scale with VIP", () => {
    const m = new Missions(save);
    const base = m.dailyQuests("2026-09-12");
    expect(base).toHaveLength(3);
    // Same day → same quests, all distinct kinds.
    expect(m.dailyQuests("2026-09-12")).toEqual(base);
    expect(new Set(base.map((q) => q.kind)).size).toBe(base.length);

    save.state.vip = true;
    const vip = m.dailyQuests("2026-09-12");
    expect(vip).toHaveLength(4);
  });

  it("claimQuests pays only unclaimed, reached quests", () => {
    const m = new Missions(save);
    const date = "2026-09-12";
    const before = save.state.wallet;
    const stats = { clouds: 100, island: 100, coins: 100, perfects: 100, distance: 10000, fever: 100, zenith: 100, pickups: 100 };
    const rewards = m.claimQuests(date, stats);
    expect(rewards.length).toBeGreaterThan(0);
    expect(save.state.wallet).toBeGreaterThan(before);
    // Second claim on the same day pays nothing more.
    expect(m.claimQuests(date, stats)).toHaveLength(0);
  });
});
