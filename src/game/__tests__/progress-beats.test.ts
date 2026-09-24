/**
 * Progress beats — the celebration a run earns, and only that.
 *
 * These cases are the argument in `ProgressBeats.ts` turned into assertions:
 * a run that moves nothing celebrates nothing, the rarest thing that happened
 * lands last, nothing a player earned is dropped on the floor, and the in-run
 * wings bar appears close enough to matter but not so often that it is noise.
 */
import { describe, expect, it } from "vitest";

import {
  beatView,
  celebrationView,
  LEDGER_CHIP_CAP,
  planCelebration,
  STAGGER_MS,
  STAGE_CAP,
  wingsProximity,
  type ProgressEvent,
} from "../ProgressBeats";

const trophy = (rarity: "bronze" | "silver" | "gold" | "platinum", id = `t_${rarity}`): ProgressEvent => ({
  kind: "trophy",
  id,
  title: `${rarity} trophy`,
  rarity,
});
const wings = (tierId = "gold"): ProgressEvent => ({ kind: "wings", tierId, icon: "🥇", name: "Gold Wings" });
const mastery = (maxed = false): ProgressEvent => ({
  kind: "mastery",
  icon: "🏔",
  mode: "Tempest",
  level: maxed ? 5 : 2,
  maxed,
  skill: maxed ? "Gale Launch" : "",
  coins: maxed ? 500 : 100,
});

/** A realistic good flight: four ladders moved at once. */
const busyRun: ProgressEvent[] = [
  { kind: "quest", count: 2, coins: 120 },
  mastery(false),
  { kind: "nest", level: 4, mult: 1.18 },
  trophy("platinum"),
  { kind: "record", metres: 4210 },
  wings("silver"),
  { kind: "pass", tier: 7 },
  { kind: "cosmetic", icon: "✨", label: "Stormline trail" },
  { kind: "challenge", variant: "gauntletStage", icon: "🌩", label: "Gauntlet stage 3", coins: 250 },
];

describe("celebration: nothing earned, nothing played", () => {
  it("is silent for a run that moved no ladder", () => {
    const plan = planCelebration([]);
    expect(plan.staged).toEqual([]);
    expect(plan.ledger).toEqual([]);
    expect(plan.peak).toBe(0);
    expect(plan.fanfare).toBe(false);
    expect(plan.chime).toBe(false);
    expect(plan.confetti).toBe(0);
  });
});

describe("celebration: loudness matches rarity", () => {
  it("gives a bronze trophy the quiet treatment", () => {
    const plan = planCelebration([trophy("bronze")]);
    expect(plan.staged).toHaveLength(1);
    expect(plan.fanfare).toBe(false);
    expect(plan.chime).toBe(false);
    expect(plan.confetti).toBe(0.25);
    expect(plan.peak).toBeLessThan(0.7);
  });

  it("chimes for a mastery level and a pass tier, but never fanfares", () => {
    for (const event of [mastery(false), { kind: "pass", tier: 3 } as ProgressEvent]) {
      const plan = planCelebration([event]);
      expect(plan.chime).toBe(true);
      expect(plan.fanfare).toBe(false);
      expect(plan.confetti).toBe(0.55);
    }
  });

  it("fanfares for the three career-defining beats", () => {
    for (const event of [wings("gold"), trophy("platinum"), { kind: "record", metres: 5000 } as ProgressEvent]) {
      const plan = planCelebration([event]);
      expect(plan.fanfare).toBe(true);
      expect(plan.confetti).toBe(1);
      expect(plan.peak).toBeGreaterThanOrEqual(0.9);
    }
  });

  it("wears the metal it just earned", () => {
    expect(planCelebration([wings("silver")]).staged[0]!.rarity).toBe("silver");
    expect(planCelebration([wings("aurora")]).staged[0]!.rarity).toBe("platinum");
    expect(planCelebration([wings("paper")]).staged[0]!.rarity).toBe("bronze");
    expect(planCelebration([mastery(true)]).staged[0]!.rarity).toBe("gold");
    expect(planCelebration([mastery(false)]).staged[0]!.rarity).toBe("silver");
  });

  it("keeps intensity inside 0..1 and monotonic in rarity", () => {
    const bronze = planCelebration([trophy("bronze")]).peak;
    const gold = planCelebration([trophy("gold")]).peak;
    const platinum = planCelebration([trophy("platinum")]).peak;
    expect(bronze).toBeLessThan(gold);
    expect(gold).toBeLessThan(platinum);
    expect(platinum).toBeLessThanOrEqual(1);
    for (const event of busyRun) {
      const beat = planCelebration([event]).staged[0]!;
      expect(beat.intensity).toBeGreaterThan(0);
      expect(beat.intensity).toBeLessThanOrEqual(1);
    }
  });
});

describe("celebration: one shape, not a burst", () => {
  it("stages at most three beats and keeps the rest on screen", () => {
    const plan = planCelebration(busyRun);
    expect(plan.staged.length).toBeLessThanOrEqual(STAGE_CAP);
    expect(plan.staged.length).toBe(STAGE_CAP);
    expect(plan.ledger).toHaveLength(busyRun.length - STAGE_CAP);
    // Nothing the player earned disappears — this is the bug the module exists for.
    const keys = [...plan.staged, ...plan.ledger].map((b) => b.key).sort();
    expect(keys).toHaveLength(new Set(keys).size);
    expect(keys).toHaveLength(busyRun.length);
  });

  it("builds up: the rarest beat is revealed last", () => {
    const plan = planCelebration(busyRun);
    const weights = plan.staged.map((b) => b.weight);
    expect(weights).toEqual([...weights].sort((a, b) => a - b));
    expect(plan.staged.map((b) => b.event.kind)).toEqual(["wings", "trophy", "record"]);
    // The quiet half of the run is still on the card, in rarity order.
    expect(plan.ledger.map((b) => b.weight)).toEqual([...plan.ledger.map((b) => b.weight)].sort((a, b) => b - a));
  });

  it("a personal best outranks a gold trophy because it is about this player", () => {
    const plan = planCelebration([trophy("gold"), { kind: "record", metres: 3000 }]);
    expect(plan.staged.map((b) => b.event.kind)).toEqual(["trophy", "record"]);
  });

  it("stagger delays ascend and hand over to the ledger row", () => {
    const plan = planCelebration(busyRun);
    expect(plan.staged.map((b) => b.delayMs)).toEqual([0, STAGGER_MS, STAGGER_MS * 2]);
    for (const beat of plan.ledger) expect(beat.delayMs).toBe(STAGGER_MS * plan.staged.length);
  });

  it("takes one happyTime value from the peak, not one per event", () => {
    const plan = planCelebration(busyRun);
    expect(plan.peak).toBe(planCelebration([{ kind: "record", metres: 4210 }]).peak);
    expect(plan.peak).toBeGreaterThan(0);
    expect(plan.peak).toBeLessThanOrEqual(1);
  });

  it("keeps a personal best at the portal's full intensity", () => {
    // Poki's canonical PB signal has always been happyTime(1); folding the
    // celebration into one call must not quietly downgrade it to 0.94.
    expect(planCelebration([{ kind: "record", metres: 900 }]).peak).toBe(1);
    expect(planCelebration(busyRun).peak).toBe(1);
    expect(planCelebration([trophy("platinum")]).peak).toBeLessThan(1);
  });

  it("collapses duplicates to their rarest instance", () => {
    const plan = planCelebration([trophy("gold", "dist_100k"), trophy("gold", "dist_100k")]);
    expect(plan.staged).toHaveLength(1);
    expect(plan.ledger).toHaveLength(0);
  });

  it("is deterministic for the same run", () => {
    expect(planCelebration(busyRun)).toEqual(planCelebration(busyRun));
    expect(planCelebration([...busyRun].reverse()).staged.map((b) => b.key)).toEqual(
      planCelebration(busyRun).staged.map((b) => b.key),
    );
  });

  it("chimes for a daily clear, and stays quiet for a quest line", () => {
    const daily = planCelebration([{ kind: "challenge", variant: "daily", icon: "☀", label: "Daily challenge", coins: 80 }]);
    expect(daily.staged).toHaveLength(1);
    expect(daily.chime).toBe(true);
    expect(daily.fanfare).toBe(false);
    const quest = planCelebration([{ kind: "quest", count: 1, coins: 60 }]);
    expect(quest.chime).toBe(false);
    expect(quest.confetti).toBe(0.25);
  });
});

describe("in-run wings proximity", () => {
  // window for a 25 km rung = min(600, max(120, 1500)) = 600 m
  const base = { flownMetres: 0, nextName: "Silver Wings", nextNeeded: 5000, tierSpan: 25_000 };

  it("stays hidden until the last stretch of the rung", () => {
    // window = min(600, max(120, 25000 * 0.06 = 1500)) = 600
    expect(wingsProximity({ ...base, flownMetres: 0 }).visible).toBe(false);
    expect(wingsProximity({ ...base, flownMetres: 4000 }).visible).toBe(false);
    expect(wingsProximity({ ...base, flownMetres: 4500 }).visible).toBe(true);
  });

  it("fills as the rung approaches and stops at the promotion", () => {
    const far = wingsProximity({ ...base, flownMetres: 4400 });
    const near = wingsProximity({ ...base, flownMetres: 4950 });
    const done = wingsProximity({ ...base, flownMetres: 5000 });
    expect(far.fill).toBeLessThan(near.fill);
    expect(near.fill).toBeLessThanOrEqual(1);
    expect(near.remaining).toBe(50);
    expect(done.visible).toBe(false);
    expect(done.remaining).toBe(0);
    expect(near.imminence).toBe(near.fill);
    expect(near.imminence).toBeGreaterThan(0.85);
  });

  it("scales the window with the rung, but never below a readable distance", () => {
    const short = wingsProximity({ ...base, nextNeeded: 100, tierSpan: 1000 });
    expect(short.visible).toBe(true); // window floors at 120 m
    const huge = wingsProximity({ ...base, nextNeeded: 900, tierSpan: 1_000_000, flownMetres: 400 });
    expect(huge.visible).toBe(true); // window caps at 600 m
    expect(wingsProximity({ ...base, nextNeeded: 900, tierSpan: 1_000_000 }).visible).toBe(false);
  });

  it("says nothing at max rank or with a broken input", () => {
    expect(wingsProximity({ ...base, nextName: "", nextNeeded: 0 }).visible).toBe(false);
    expect(wingsProximity({ ...base, nextNeeded: Number.NaN }).visible).toBe(false);
    expect(wingsProximity({ ...base, flownMetres: Number.NaN }).visible).toBe(false);
    expect(wingsProximity({ ...base, flownMetres: -500 }).visible).toBe(false);
    expect(wingsProximity({ ...base, nextNeeded: 100, tierSpan: -1 }).visible).toBe(true); // window floors at 120 m
  });
});

describe("celebration: what the card renders", () => {
  it("carries a barrel key, params and an English fallback per beat", () => {
    const view = beatView(planCelebration([wings("gold")]).staged[0]!);
    expect(view.key).toBe("hud.progress.wings");
    expect(view.params).toEqual({ name: "Gold Wings" });
    expect(view.fallback).toBe("Lifetime rank earned · {{name}}");
    expect(view.icon).toBe("🥇");
    expect(view.rarity).toBe("gold");
    expect(view.banner).toBe(true);
  });

  it("reuses the keys the toasts already had, so no copy is translated twice", () => {
    const cases: [ProgressEvent, string][] = [
      [trophy("gold"), "hud.toast.trophy"],
      [{ kind: "record", metres: 1200 }, "hud.toast.newRecord"],
      [{ kind: "pass", tier: 4 }, "hud.toast.nestPassUnlock"],
      [{ kind: "quest", count: 1, coins: 60 }, "hud.toast.questComplete"],
      [{ kind: "nest", level: 3, mult: 1.12 }, "hud.toast.nestUpgraded"],
      [{ kind: "challenge", variant: "gauntlet", icon: "🌩", label: "Gauntlet", coins: 300 }, "hud.toast.gauntletCleared"],
    ];
    for (const [event, key] of cases) expect(beatView(planCelebration([event]).staged[0]!).key).toBe(key);
  });

  it("folds the overflow into a count instead of a wall of chips", () => {
    const view = celebrationView(planCelebration(busyRun));
    expect(view.staged).toHaveLength(STAGE_CAP);
    expect(view.ledger).toHaveLength(LEDGER_CHIP_CAP);
    expect(view.folded).toBe(busyRun.length - STAGE_CAP - LEDGER_CHIP_CAP);
    expect(view.peak).toBe(1);
  });

  it("renders nothing at all for a run that earned nothing", () => {
    expect(celebrationView(planCelebration([]))).toEqual({ staged: [], ledger: [], folded: 0, peak: 0 });
  });
});
