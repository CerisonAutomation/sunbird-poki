import { beforeEach, describe, expect, it } from "vitest";
import { ACHIEVEMENTS, Achievements } from "../Achievements";
import { SaveData } from "../SaveData";

describe("achievements", () => {
  let save: SaveData;

  beforeEach(() => {
    localStorage.clear();
    save = new SaveData();
  });

  it("starts with nothing unlocked", () => {
    const a = new Achievements(save);
    expect(a.counts().unlocked).toBe(0);
    expect(a.counts().total).toBe(ACHIEVEMENTS.length);
  });

  it("reports progress and unlocks once a metric crosses its target", () => {
    const a = new Achievements(save);
    save.state.runsPlayed = 10; // flights_10 target
    const newly = a.checkNew();
    expect(newly.some((d) => d.id === "flights_10")).toBe(true);
    // Checking again must not double-report.
    expect(a.checkNew().filter((d) => d.id === "flights_10")).toHaveLength(0);
    expect(a.counts().unlocked).toBeGreaterThanOrEqual(1);
  });

  it("clamps progress at the target (no over-100% bars)", () => {
    save.state.runsPlayed = 999;
    const view = new Achievements(save).view();
    const flights10 = view.find((v) => v.def.id === "flights_10")!;
    expect(flights10.progress).toBe(flights10.def.target);
    expect(flights10.unlocked).toBe(true);
  });

  it("treats an already-unlocked achievement as unlocked regardless of metric", () => {
    save.state.achievements.push("flights_100");
    save.state.runsPlayed = 0;
    const a = new Achievements(save);
    expect(a.view().find((v) => v.def.id === "flights_100")!.unlocked).toBe(true);
    expect(a.counts().unlocked).toBeGreaterThanOrEqual(1);
  });

  it("every achievement has a positive target and a metric", () => {
    for (const def of ACHIEVEMENTS) {
      expect(def.target).toBeGreaterThan(0);
      expect(typeof def.metric).toBe("function");
      expect(def.rarity).toMatch(/^(bronze|silver|gold|platinum)$/);
    }
  });

  it("prestige requires both gold and VIP", () => {
    const a = new Achievements(save);
    expect(a.view().find((v) => v.def.id === "prestige")!.unlocked).toBe(false);
    save.state.gold = true;
    save.state.vip = true;
    expect(a.view().find((v) => v.def.id === "prestige")!.unlocked).toBe(true);
  });
});
