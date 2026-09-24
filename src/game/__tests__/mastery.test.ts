import { beforeEach, describe, expect, it } from "vitest";
import {
  MASTERY_COIN_PER_LEVEL,
  MASTERY_LEVELS,
  MASTERY_REWARDS,
  MASTERY_SKILLS,
  NO_MASTERY_PERKS,
  bankMasteryRun,
  masteryLevel,
  masteryPerks,
  masteryViews,
} from "../Mastery";
import { MODES } from "../Modes";
import { SaveData } from "../SaveData";

describe("masteryLevel", () => {
  it("starts at 0 and reaches 5 at 100 runs", () => {
    expect(masteryLevel(0)).toBe(0);
    expect(masteryLevel(2)).toBe(0);
    expect(masteryLevel(3)).toBe(1);
    expect(masteryLevel(100)).toBe(5);
    expect(masteryLevel(9999)).toBe(5);
  });

  it("levels and rewards line up and escalate", () => {
    expect(MASTERY_REWARDS).toHaveLength(MASTERY_LEVELS.length);
    for (let i = 1; i < MASTERY_REWARDS.length; i++) {
      expect(MASTERY_REWARDS[i]!).toBeGreaterThan(MASTERY_REWARDS[i - 1]!);
      expect(MASTERY_LEVELS[i]!).toBeGreaterThan(MASTERY_LEVELS[i - 1]!);
    }
  });
});

describe("mastery signature skills", () => {
  it("every mode has a level-5 signature skill with a name and description", () => {
    for (const m of MODES) {
      const skill = MASTERY_SKILLS[m.id];
      expect(skill, `mode ${m.id} is missing a signature skill`).toBeDefined();
      expect(skill!.name.length).toBeGreaterThan(3);
      expect(skill!.desc.length).toBeGreaterThan(5);
    }
  });

  it("skill names are unique across modes", () => {
    const names = Object.values(MASTERY_SKILLS).map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("max-level perks stay within fair-play caps", () => {
    for (const [id, skill] of Object.entries(MASTERY_SKILLS)) {
      expect(skill.coinMult, `${id} coinMult`).toBeGreaterThanOrEqual(1 + 4 * MASTERY_COIN_PER_LEVEL);
      expect(skill.coinMult, `${id} coinMult`).toBeLessThanOrEqual(1.2);
      expect(skill.liftMult, `${id} liftMult`).toBeGreaterThanOrEqual(1);
      expect(skill.liftMult, `${id} liftMult`).toBeLessThanOrEqual(1.03);
      expect(skill.daylightBonus, `${id} daylight`).toBeGreaterThanOrEqual(0);
      expect(skill.daylightBonus, `${id} daylight`).toBeLessThanOrEqual(6);
      expect(skill.feverBonus, `${id} fever`).toBeGreaterThanOrEqual(0);
      expect(skill.feverBonus, `${id} fever`).toBeLessThanOrEqual(3);
    }
  });

  it("every skill grants something real", () => {
    for (const [id, s] of Object.entries(MASTERY_SKILLS)) {
      const potency = (s.coinMult - 1) + (s.liftMult - 1) + s.daylightBonus + s.feverBonus;
      expect(potency, `${id} skill is decorative`).toBeGreaterThan(0.05);
    }
  });
});

describe("mastery progression", () => {
  let save: SaveData;

  beforeEach(() => {
    localStorage.clear();
    save = new SaveData();
  });

  it("masteryPerks returns neutral perks at zero runs", () => {
    expect(masteryPerks(save, "daytrip")).toEqual(NO_MASTERY_PERKS);
  });

  it("masteryPerks scales coin bonus with level", () => {
    save.state.mastery.daytrip = 3; // level 1
    const perks = masteryPerks(save, "daytrip");
    expect(perks.level).toBe(1);
    expect(perks.coinMult).toBeCloseTo(1.02, 4);
    expect(perks.skillName).toBe("");
  });

  it("masteryPerks grants the signature skill at max level", () => {
    save.state.mastery.daytrip = 100; // level 5
    const perks = masteryPerks(save, "daytrip");
    expect(perks.level).toBe(5);
    expect(perks.skillName).toBe("Sunchaser");
    expect(perks.daylightBonus).toBe(6);
  });

  it("masteryViews covers every mode with sane progress", () => {
    save.state.mastery.race = 3;
    const views = masteryViews(save);
    expect(views).toHaveLength(8);
    const race = views.find((v) => v.modeId === "race")!;
    expect(race.level).toBe(1);
    expect(race.progress).toBeGreaterThanOrEqual(0);
    expect(race.progress).toBeLessThanOrEqual(1);
    const untouched = views.find((v) => v.modeId === "zenith")!;
    expect(untouched.level).toBe(0);
    expect(untouched.progress).toBe(0);
  });

  it("bankMasteryRun banks a run and pays on a level crossing", () => {
    save.state.mastery.daytrip = 2; // one short of level 1
    const before = save.state.wallet;
    const result = bankMasteryRun(save, "daytrip");
    expect(result).not.toBeNull();
    expect(result!.level).toBe(1);
    expect(result!.coins).toBeGreaterThan(0);
    expect(save.state.wallet).toBe(before + result!.coins);
  });

  it("bankMasteryRun returns null when no level is crossed", () => {
    save.state.mastery.daytrip = 3; // already level 1
    const result = bankMasteryRun(save, "daytrip"); // 4 runs → still level 1
    expect(result).toBeNull();
  });

  it("bankMasteryRun grants the signature skill at max level", () => {
    save.state.mastery.daytrip = 99;
    const result = bankMasteryRun(save, "daytrip"); // → 100 → level 5
    expect(result!.level).toBe(5);
    expect(result!.skill?.name).toBe("Sunchaser");
  });
});
