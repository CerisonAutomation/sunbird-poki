/**
 * The in-flight mission strip — the layer that makes progression *felt*.
 *
 * `dailyQuests()` has always been a three-mission system: seeded per day, one
 * quest per stat kind, coin rewards, a fourth for VIP. It was evaluated from
 * finished-run stats and drawn in a menu, so a player could bank three quests and
 * never see one fill. These cases pin the pure core that fixes it — live rows
 * from partial stats, a completion that fires exactly once, the goal-gradient
 * line, and a results footer that names one next action instead of nine ladders.
 *
 * Research grounding and the diagnosis are in
 * `docs/audits/PROGRESSION_FEEL_2026-09-24.md`.
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  closestGoalLine,
  MISSION_DEFS,
  missionRows,
  Missions,
  newlyDone,
  nextActionLine,
  type QuestDef,
  type RunStats,
} from "../Missions";
import { SaveData } from "../SaveData";

const stats = (over: Partial<RunStats> = {}): RunStats => ({
  clouds: 0,
  island: 0,
  coins: 0,
  perfects: 0,
  distance: 0,
  fever: 0,
  zenith: 0,
  pickups: 0,
  ...over,
});

function def(over: Partial<QuestDef> = {}): QuestDef {
  return { id: "d:coins:30", kind: "coins", target: 30, reward: 120, label: "Collect 30 coins in a run", title: "Gold Rush", ...over };
}

describe("missionRows — live progress from partial stats", () => {
  it("reads the matching stat and nothing else", () => {
    const rows = missionRows([def()], stats({ coins: 12, distance: 4000, perfects: 9 }));

    expect(rows[0]).toMatchObject({ title: "Gold Rush", progress: 12, target: 30, done: false, reward: 120 });
    expect(rows[0]!.pct).toBeCloseTo(0.4, 5);
  });

  it("clamps at the target, so a bar can never read past full", () => {
    const rows = missionRows([def()], stats({ coins: 999 }));

    expect(rows[0]!.progress).toBe(30);
    expect(rows[0]!.pct).toBe(1);
    expect(rows[0]!.done).toBe(true);
  });

  it("rounds fractional counters — distance is a float, a bar is not", () => {
    expect(missionRows([def({ kind: "distance", target: 800 })], stats({ distance: 400.4 }))[0]!.progress).toBe(400);
    expect(missionRows([def({ kind: "distance", target: 800 })], stats({ distance: 400.6 }))[0]!.progress).toBe(401);
  });

  it("shows nothing filled before the run has any stats", () => {
    const rows = missionRows([def(), def({ id: "b", kind: "clouds", target: 4, title: "Sky Tickles" })], null);

    expect(rows.every((r) => r.progress === 0 && r.pct === 0 && !r.done)).toBe(true);
  });

  it("pins a quest already banked today, so it cannot un-fill on the next run", () => {
    const rows = missionRows([def()], stats({ coins: 0 }), [def().id]);

    expect(rows[0]).toMatchObject({ progress: 30, done: true, pct: 1 });
  });

  it("marks justDone only for the ids it is told, and never for a banked one", () => {
    const rows = missionRows([def(), def({ id: "banked", kind: "fever", target: 1, title: "Catch Fire" })], stats({ coins: 30, fever: 1 }), ["banked"], [
      def().id,
      "banked",
    ]);

    expect(rows[0]!.justDone).toBe(true);
    expect(rows[1]!.justDone).toBe(false);
  });

  it("survives a zero target without dividing by it", () => {
    const rows = missionRows([def({ target: 0 })], stats());
    expect(rows[0]!.pct).toBe(1);
    expect(Number.isNaN(rows[0]!.pct)).toBe(false);
  });
});

describe("newlyDone — the mid-run moment fires once", () => {
  it("fires on the frame the row crosses, and never again", () => {
    const before = missionRows([def()], stats({ coins: 29 }));
    const crossing = missionRows([def()], stats({ coins: 30 }));
    const after = missionRows([def()], stats({ coins: 31 }));

    expect(newlyDone(before, crossing)).toHaveLength(1);
    expect(newlyDone(crossing, after)).toHaveLength(0);
  });

  it("reports two missions completing on the same frame", () => {
    const defs = [def(), def({ id: "clouds", kind: "clouds", target: 2, title: "Cloud Kiss", reward: 80 })];
    expect(newlyDone(missionRows(defs, stats()), missionRows(defs, stats({ coins: 30, clouds: 2 })))).toHaveLength(2);
  });

  it("does not re-celebrate a quest that was already banked today", () => {
    const d = def();
    const banked = missionRows([d], stats(), [d.id]);
    expect(newlyDone(banked, missionRows([d], stats({ coins: 40 }), [d.id]))).toHaveLength(0);
  });
});

describe("closestGoalLine — the goal gradient, and the discipline to stay quiet", () => {
  const three = () =>
    missionRows(
      [def(), def({ id: "b", kind: "clouds", target: 4, title: "Cloud Kiss", reward: 80 }), def({ id: "c", kind: "perfects", target: 3, title: "Slide Poet", reward: 160 })],
      stats({ coins: 24, clouds: 1, perfects: 0 }),
    );

  it("names the nearest unfinished mission with its exact gap", () => {
    expect(closestGoalLine(three())).toBe("6 to go · Gold Rush · +120");
  });

  it("says nothing when nothing is close — a permanent nag gets ignored", () => {
    expect(closestGoalLine(missionRows([def()], stats({ coins: 3 })))).toBeNull();
    expect(closestGoalLine(three(), 0.9)).toBeNull();
  });

  it("ignores missions already done", () => {
    const rows = missionRows([def(), def({ id: "b", kind: "clouds", target: 4, title: "Cloud Kiss", reward: 80 })], stats({ coins: 30, clouds: 3 }));
    expect(closestGoalLine(rows)).toBe("1 to go · Cloud Kiss · +80");
  });
});

describe("nextActionLine — one next action, not nine ladders", () => {
  const defs = [def(), def({ id: "b", kind: "clouds", target: 4, title: "Cloud Kiss", reward: 80 })];

  it("frames a near miss as a gap, because that is what pulls one more run", () => {
    expect(nextActionLine(missionRows(defs, stats({ coins: 29, clouds: 4 })), 1400)).toBe(
      "1 short of Gold Rush · +120 coins — one more flight",
    );
  });

  it("names the nearest open mission when the run fell well short", () => {
    expect(nextActionLine(missionRows(defs, stats({ coins: 5 })), 300)).toBe("Next: Gold Rush — 25 to go for +120 coins");
  });

  it("celebrates a clean sweep and points at tomorrow instead of inventing work", () => {
    expect(nextActionLine(missionRows(defs, stats({ coins: 30, clouds: 4 })), 2210.4)).toBe(
      "Every mission banked · 2210 m flown — new quests land tomorrow",
    );
  });

  it("still says something when there are no quests at all", () => {
    expect(nextActionLine([], 900)).toBe("Fly again — 900 m is the mark to beat");
  });
});

describe("the daily quest set itself", () => {
  let save: SaveData;
  let missions: Missions;

  beforeEach(() => {
    localStorage.clear();
    save = new SaveData();
    missions = new Missions(save);
  });

  it("gives three quests, one per stat kind, so a run has three ways to matter", () => {
    const q = missions.dailyQuests("2026-09-24");

    expect(q).toHaveLength(3);
    expect(new Set(q.map((x) => x.kind)).size).toBe(3);
    expect(q.every((x) => x.title.length > 0 && x.reward > 0)).toBe(true);
  });

  it("is the same set all day and a different set the next day", () => {
    const a = missions.dailyQuests("2026-09-24").map((q) => q.id);
    const b = missions.dailyQuests("2026-09-24").map((q) => q.id);
    const c = missions.dailyQuests("2026-09-25").map((q) => q.id);

    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("a whole run's worth of counters fills the strip monotonically", () => {
    // The property the flight HUD depends on: as the run's counters grow, no row
    // ever goes backwards, and each row completes at most once.
    const q = missions.dailyQuests("2026-09-24");
    let prev = missionRows(q, stats());
    const fired: string[] = [];
    for (let i = 1; i <= 60; i++) {
      const next = missionRows(
        q,
        stats({ coins: i, clouds: Math.floor(i / 8), perfects: Math.floor(i / 12), distance: i * 90, zenith: Math.floor(i / 20), pickups: Math.floor(i / 15), island: Math.floor(i / 10), fever: i > 40 ? 1 : 0 }),
      );
      for (const [k, row] of next.entries()) {
        expect(row.progress).toBeGreaterThanOrEqual(prev[k]!.progress);
        expect(row.pct).toBeGreaterThanOrEqual(prev[k]!.pct);
      }
      for (const row of newlyDone(prev, next)) fired.push(row.id);
      prev = next;
    }
    expect(new Set(fired).size).toBe(fired.length);
  });

  it("keeps the lifetime mission list intact beside the daily three", () => {
    expect(MISSION_DEFS.length).toBeGreaterThanOrEqual(10);
    expect(missions.view(stats({ coins: 30 })).some((m) => m.done)).toBe(true);
  });
});
