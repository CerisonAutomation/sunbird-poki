import { beforeEach, describe, expect, it } from "vitest";
import { FlowTuner, SessionGoals, evaluateNearMiss, IDENTITY_TUNE, paceSkillFor, tuneDifficulty, type DifficultySignals } from "../Engagement";
import { SaveData } from "../SaveData";

describe("FlowTuner", () => {
  let save: SaveData;

  beforeEach(() => {
    localStorage.clear();
    save = new SaveData();
  });

  it("loads persisted skill clamped to [0,1]", () => {
    save.state.skill = 2.5;
    save.state.skillSamples = 7;
    const t = new FlowTuner();
    t.load(save);
    expect(t.skill).toBe(1);
    expect(t.difficulty()).toBeCloseTo(1.16, 2);
  });

  it("starts at the default and persists after a run", () => {
    const t = new FlowTuner();
    t.load(save);
    expect(t.skill).toBe(0.25);
    t.noteRun(2000, 5, 10, save);
    expect(save.state.skill).toBe(t.skill);
    expect(save.state.skillSamples).toBe(1);
    expect(t.difficulty()).toBeGreaterThanOrEqual(0.86);
    expect(t.difficulty()).toBeLessThanOrEqual(1.16);
  });

  it("labels skill bands monotonically", () => {
    const t = new FlowTuner();
    const labels = [0, 0.19, 0.2, 0.39, 0.4, 0.59, 0.6, 0.79, 0.8].map((s) => {
      t.skill = s;
      return t.label();
    });
    expect(labels).toEqual([
      "Fledgling", "Fledgling",
      "Glider", "Glider",
      "Skyrider", "Skyrider",
      "Windmaster", "Windmaster",
      "Sunbird",
    ]);
  });
});

describe("SessionGoals", () => {
  it("always produces three goals with distinct kinds", () => {
    const tuner = new FlowTuner();
    tuner.skill = 0.5;
    const g = new SessionGoals(tuner);
    g.reset("seed");
    expect(g.goals).toHaveLength(3);
    expect(new Set(g.goals.map((x) => x.kind)).size).toBe(3);
    for (const goal of g.goals) {
      expect(goal.target).toBeGreaterThan(0);
      expect(goal.label.length).toBeGreaterThan(0);
    }
  });

  it("refills a completed goal immediately (list never empties)", () => {
    const tuner = new FlowTuner();
    tuner.skill = 0.5;
    const g = new SessionGoals(tuner);
    g.reset("seed");
    const first = g.goals[0]!;
    const finished = g.update({ [first.kind]: first.target + 100 } as never);
    expect(finished).toHaveLength(1);
    expect(g.goals).toHaveLength(3);
    // The completed goal was swapped out for a fresh, uncompleted one.
    expect(g.goals.every((x) => !x.done)).toBe(true);
  });

  it("closest() returns a nearly-done goal and null when none is close", () => {
    const tuner = new FlowTuner();
    tuner.skill = 0.5;
    const g = new SessionGoals(tuner);
    g.reset("seed");
    expect(g.closest()).toBeNull();
    const goal = g.goals[0]!;
    goal.progress = Math.ceil(goal.target * 0.6);
    expect(g.closest()?.kind).toBe(goal.kind);
  });
});

describe("evaluateNearMiss", () => {
  it("fires distance near-miss only within 12%", () => {
    const near = evaluateNearMiss(950, 1000, 0, 0, 0, 0);
    expect(near.kind).toBe("distance");
    const far = evaluateNearMiss(500, 1000, 0, 0, 0, 0);
    expect(far.kind).toBe("none");
  });

  it("fires altitude near-miss only within 10%", () => {
    expect(evaluateNearMiss(0, 0, 95, 100, 0, 0).kind).toBe("altitude");
    expect(evaluateNearMiss(0, 0, 50, 100, 0, 0).kind).toBe("none");
  });

  it("fires combo near-miss one short of the record", () => {
    expect(evaluateNearMiss(0, 0, 0, 0, 4, 5).kind).toBe("combo");
    expect(evaluateNearMiss(0, 0, 0, 0, 3, 5).kind).toBe("none");
  });

  it("returns none when there is no record to chase", () => {
    expect(evaluateNearMiss(500, 0, 0, 0, 0, 0).kind).toBe("none");
  });
});

describe("SessionGoals first-session mode", () => {
  const build = (starter: boolean, skill = 0.5): SessionGoals => {
    const tuner = new FlowTuner();
    tuner.skill = skill;
    const g = new SessionGoals(tuner);
    // Same seed => same three goal kinds in the same order, so the two tables
    // can be compared goal by goal.
    g.reset("seed", { starter });
    return g;
  };

  it("targets a first-timer can reach on the flight they are on", () => {
    for (const goal of build(true).goals) {
      expect(goal.target).toBeGreaterThan(0);
      // Nothing on the starter table asks for more than a short first flight.
      expect(goal.target).toBeLessThanOrEqual(250);
      expect(goal.label.length).toBeGreaterThan(4);
    }
  });

  it("pays a first reward worth noticing", () => {
    for (const goal of build(true).goals) expect(goal.reward).toBeGreaterThanOrEqual(40);
  });

  it("keeps refilling at starter difficulty for the whole first session", () => {
    const g = build(true);
    for (let i = 0; i < 6; i += 1) {
      const first = g.goals[0]!;
      g.update({ [first.kind]: first.target + 1 } as never);
    }
    expect(g.goals).toHaveLength(3);
    expect(g.goals.every((x) => !x.done)).toBe(true);
    expect(g.goals.every((x) => x.reward >= 40)).toBe(true);
  });

  it("asks strictly more of a player with history, goal for goal", () => {
    const starter = build(true).goals;
    const normal = build(false).goals;
    expect(normal).toHaveLength(starter.length);
    for (let i = 0; i < normal.length; i += 1) {
      expect(normal[i].kind).toBe(starter[i].kind);
      expect(normal[i].target).toBeGreaterThan(starter[i].target);
    }
  });

  it("still scales with measured skill once history exists", () => {
    const rookie = build(false, 0.1).goals[0]!;
    const ace = build(false, 0.95).goals[0]!;
    expect(ace.target).toBeGreaterThan(rookie.target);
  });
});

describe("tuneDifficulty", () => {
  const base = (over: Partial<DifficultySignals> = {}): DifficultySignals => ({
    runsPlayed: 10,
    skill: 0.5,
    lastDistance: 900,
    lastDurationSec: 40,
    recentPlaces: [],
    ...over,
  });

  it("returns the identity tune for any rated race", () => {
    const struggling = base({ runsPlayed: 0, skill: 0.05, lastDistance: 80 });
    expect(tuneDifficulty(struggling, true)).toEqual(IDENTITY_TUNE);
  });

  it("eases the first three flights so the hook is a joke, not a bounce", () => {
    const tune = tuneDifficulty(base({ runsPlayed: 0, skill: 0.1 }), false);
    expect(tune.reason).toBe("ease");
    expect(tune.daylightMult).toBeLessThan(1);
    expect(tune.packCatchupMult).toBeGreaterThan(1);
    expect(tune.ridgeForgiveness).toBeGreaterThan(0);
  });

  it("eases a struggling casual pilot", () => {
    const tune = tuneDifficulty(base({ skill: 0.15, lastDistance: 220, recentPlaces: [12, 11, 14] }), false);
    expect(tune.reason).toBe("ease");
    expect(tune.packCatchupMult).toBeGreaterThan(IDENTITY_TUNE.packCatchupMult);
  });

  it("spices a bored expert without touching ranked identity", () => {
    const signals = base({ skill: 0.9, lastDistance: 2400, lastDurationSec: 70, recentPlaces: [2, 1, 3] });
    const casual = tuneDifficulty(signals, false);
    expect(casual.reason).toBe("spice");
    expect(casual.packCatchupMult).toBeLessThan(1);
    expect(tuneDifficulty(signals, true)).toEqual(IDENTITY_TUNE);
  });

  it("aims a pace ghost slightly above the player", () => {
    expect(paceSkillFor(0)).toBeGreaterThan(0.2);
    expect(paceSkillFor(1)).toBeLessThan(0.9);
    expect(paceSkillFor(0.5)).toBeGreaterThan(0.5);
  });
});
