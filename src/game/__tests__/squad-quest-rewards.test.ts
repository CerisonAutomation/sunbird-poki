/**
 * Squadron quest rewards: a claim guard scoped to the same window as the
 * condition it protects.
 *
 * This is a money bug, found by audit, not a hypothetical. Two of the three
 * squadron quests are measured against LIFETIME stats — `bestDistance` and
 * `runsPlayed`, both monotonic, neither ever reset — but the claim handler
 * guarded them ONCE PER DAY:
 *
 *     if (this.save.state.squadQuestsClaimed[questId] === this.today) ...
 *
 * So once a player had ever flown 2,667 m (4000 / 1.5) and completed 5 runs
 * (25 / 5), both quests read as permanently complete while the guard reset
 * every midnight. 150 + 120 = 270 coins, every day, forever — an infinite
 * faucet that got *wider* the more the player played.
 *
 * The general rule this file pins: **a reward's claim window must match the
 * window its condition is measured in.** A lifetime milestone is earned once
 * and paid once. A daily milestone resets, so it may be paid daily.
 */
import { describe, expect, it } from "vitest";
import {
  SQUAD_QUESTS,
  squadQuestClaimState,
  squadQuestProgress,
  squadQuestScope,
  type SquadQuest,
  type SquadQuestProgressInput,
} from "../Squad";

/** A pilot who has flown far and often — both lifetime stats are maxed out. */
const VETERAN: SquadQuestProgressInput = {
  bestDistance: 99_999,
  runsPlayed: 5_000,
  todayBest: 0,
};

const TODAY = "2026-09-30";
const YESTERDAY = "2026-09-29";

const quest = (id: string): SquadQuest => {
  const q = SQUAD_QUESTS.find((x) => x.id === id);
  if (!q) throw new Error(`no squad quest ${id}`);
  return q;
};

describe("squadron quest payout: the guard is as wide as the condition", () => {
  it("does not re-pay a lifetime quest that was claimed on an earlier day", () => {
    // THE BUG. Claimed yesterday, checked today, condition still satisfied
    // (lifetime stats never go down) — this must not be claimable again.
    for (const id of ["migration", "drafting"]) {
      const state = squadQuestClaimState(quest(id), VETERAN, { [id]: YESTERDAY }, TODAY);
      expect(state, `${id} is a lifetime goal and must pay exactly once`).toBe("already-claimed");
    }
  });

  it("still lets a DAILY quest reset and be claimed again tomorrow", () => {
    // The guard against over-fixing. If this regresses, the daily squadron
    // goal becomes a one-time award and the daily loop loses its reward.
    expect(quest("precision").measure, "precision must stay measured on todayBest").toBe("todayBest");
    const flown: SquadQuestProgressInput = { ...VETERAN, todayBest: 1_000 };
    expect(squadQuestClaimState(quest("precision"), flown, { precision: YESTERDAY }, TODAY)).toBe("claimable");
  });

  it("refuses a second claim on the same day for every quest", () => {
    for (const id of ["migration", "drafting", "precision"]) {
      const flown: SquadQuestProgressInput = { ...VETERAN, todayBest: 1_000 };
      expect(squadQuestClaimState(quest(id), flown, { [id]: TODAY }, TODAY), id).toBe("already-claimed");
    }
  });

  it("pays an unclaimed, satisfied quest", () => {
    for (const id of ["migration", "drafting"]) {
      expect(squadQuestClaimState(quest(id), VETERAN, {}, TODAY), id).toBe("claimable");
    }
  });

  it("refuses an incomplete quest even when the ledger is empty", () => {
    // The handler trusts this verdict, not the button being visible.
    const rookie: SquadQuestProgressInput = { bestDistance: 100, runsPlayed: 0, todayBest: 0 };
    for (const id of ["migration", "drafting"]) {
      expect(squadQuestClaimState(quest(id), rookie, {}, TODAY), id).toBe("not-complete");
    }
  });

  it("tolerates a missing ledger rather than throwing", () => {
    expect(squadQuestClaimState(quest("migration"), VETERAN, undefined, TODAY)).toBe("claimable");
  });
});

describe("squadron quest scope is derived from the measure, not stored beside it", () => {
  it("classifies by which stat is measured", () => {
    expect(squadQuestScope(quest("migration"))).toBe("lifetime");
    expect(squadQuestScope(quest("drafting"))).toBe("lifetime");
    expect(squadQuestScope(quest("precision"))).toBe("daily");
  });

  it("makes it impossible for a lifetime quest to be marked daily", () => {
    // This is the structural half of the fix. `scope` is computed from
    // `measure`, so there is no second field to set wrong. If someone adds a
    // quest measured on a lifetime stat, it is once-ever by construction; if
    // they measure a daily stat, it resets by construction.
    for (const q of SQUAD_QUESTS) {
      const expected = q.measure === "todayBest" ? "daily" : "lifetime";
      expect(squadQuestScope(q), `${q.id} is measured on ${q.measure}`).toBe(expected);
    }
  });

  it("carries no free-standing scope field that could drift", () => {
    for (const q of SQUAD_QUESTS) {
      expect(Object.prototype.hasOwnProperty.call(q, "scope"), `${q.id} stores its own scope`).toBe(false);
    }
  });
});

describe("squadron quest progress is one shared implementation", () => {
  it("matches the arithmetic the descriptions promise", () => {
    // migration: 4,000 m at 1.5x. drafting: 5 runs at 5 points.
    // precision: 800 m in a day at 1 point per 100 m.
    expect(squadQuestProgress(quest("migration"), { bestDistance: 1_000, runsPlayed: 0, todayBest: 0 })).toBe(1_500);
    expect(squadQuestProgress(quest("drafting"), { bestDistance: 0, runsPlayed: 3, todayBest: 0 })).toBe(15);
    expect(squadQuestProgress(quest("precision"), { bestDistance: 0, runsPlayed: 0, todayBest: 800 })).toBe(8);
  });

  it("caps at the target so a huge stat cannot overshoot the bar", () => {
    expect(squadQuestProgress(quest("migration"), VETERAN)).toBe(quest("migration").target);
    expect(squadQuestProgress(quest("drafting"), VETERAN)).toBe(quest("drafting").target);
  });

  it("clamps a negative stat to zero instead of reporting negative progress", () => {
    const broken: SquadQuestProgressInput = { bestDistance: -500, runsPlayed: -5, todayBest: -10 };
    expect(squadQuestProgress(quest("migration"), broken)).toBe(0);
    expect(squadQuestProgress(quest("drafting"), broken)).toBe(0);
  });
});

describe("the payout amount has exactly one home", () => {
  it("reads the reward off the quest def, not a duplicated map in the handler", async () => {
    // The handler used to carry its own `{migration:150, drafting:120,
    // precision:100}` literal while the panel rendered `q.rewardCoins`. Two
    // sources of truth, no compiler link — bumping a reward in Squad.ts would
    // have changed the button and not the money. A source check is the honest
    // way to pin that the second copy is gone.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "src/game/Game.ts"), "utf8");
    const claimBlock = /case "claim-squad-quest": \{[\s\S]*?\n      \}/.exec(src)?.[0] ?? "";
    expect(claimBlock, "the claim-squad-quest case vanished; this test is now vacuous").not.toBe("");
    expect(claimBlock, "the handler still hardcodes a rewards map").not.toMatch(/rewards\s*:/);
    expect(claimBlock, "the handler pays a hardcoded amount").not.toMatch(/addCoins\(\s*\d/);
    // It pays the def's amount, and it re-validates before doing so.
    expect(claimBlock, "the handler must pay quest.rewardCoins").toMatch(/addCoins\(\s*quest\.rewardCoins\s*\)/);
    expect(claimBlock, "the handler must re-check the claim state").toMatch(/squadQuestClaimState\(/);
  });
});
