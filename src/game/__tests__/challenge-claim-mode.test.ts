/**
 * A challenge reward is payable only in the mode the challenge advertises.
 *
 * The hole this file exists to prevent: the daily and gauntlet MODE was
 * applied in exactly one place — the journey card's click handler
 * (`Game.ts` handleJourneyEvent) — while the CLAIM tested only the metric
 * (`dailyDone`/`stageDone` compare `stats[metric] >= target`). A run is merely
 * *flagged* as a challenge, and that flag is rebuilt by "Fly again" from saved
 * run metadata (`Replay.replayOptions`) without the mode, so a daily could be
 * claimed by clearing its target in any mode at all, and the shop-sold promise
 * ("fly the Daily, in the mode it names") was unenforceable.
 *
 * Two gates now hold, and both are pinned here:
 *   1. the launch funnel re-applies the challenge's mode to every run
 *      (`challengeMode` in startRun), so the replay path cannot lose it, and
 *   2. the claim asks `dailyVerdict`/`stageVerdict`, which refuse a run flown
 *      in the wrong mode regardless of what it scored.
 *
 * The refusal is asserted against the wallet, and the wiring is pinned against
 * the source (the same technique as ad-honesty.test.ts): a unit test alone
 * cannot see a gate deleted from the claim, and a source pin alone cannot see
 * a gate that returns the wrong answer.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { challengeMode, dailyChallenge, dailyDone, dailyVerdict, stageDone, stageVerdict, weeklyGauntlet } from "../Challenges";
import { MODES, modeById, type ModeId } from "../Modes";
import type { RunStats } from "../Missions";
import { replayOptions } from "../Replay";
import { SaveData } from "../SaveData";
import { weekKey } from "../Tournaments";

/** A date/week pair with a known daily and gauntlet, so the assertions below
 *  are about the gate and not about which template the seed happened to pick. */
const DAY = "2026-09-26";
const WEEK = weekKey(new Date(`${DAY}T12:00:00Z`));

/** Any mode that is NOT `mode` — the wrong-mode run a cheat would submit. */
function otherMode(mode: ModeId): ModeId {
  const other = MODES.map((m) => m.id).find((id) => id !== mode);
  expect(other, `expected more than one mode in MODES (saw ${MODES.length})`).toBeDefined();
  return other as ModeId;
}

const stats = (over: Partial<RunStats> = {}): RunStats => ({
  clouds: 0,
  island: 1,
  coins: 0,
  perfects: 0,
  distance: 0,
  fever: 0,
  apex: 0,
  pickups: 0,
  ...over,
});

/** A run that beats the challenge's target and nothing else. */
const beatsTarget = (metric: string, target: number): RunStats => stats({ [metric]: target + 1 } as Partial<RunStats>);

describe("a challenge reward is only payable in its advertised mode", () => {
  beforeEach(() => localStorage.clear());

  it("refuses a daily that cleared its target in the wrong mode — the wallet never moves", () => {
    const save = new SaveData();
    const c = dailyChallenge(DAY);
    const run = beatsTarget(c.metric, c.target);
    const wrong = otherMode(c.mode);

    // The old gate, on its own, would have paid: the target WAS cleared.
    expect(dailyDone(run, c)).toBe(true);
    // The new gate refuses, and says why.
    expect(dailyVerdict(run, c, wrong)).toBe("wrong-mode");

    // The claim finishRun performs, gate included.
    const verdict = dailyVerdict(run, c, wrong);
    if (verdict === "claim" && save.completeDaily(DAY)) save.addCoins(c.reward);

    expect(save.state.wallet).toBe(0);
    expect(save.state.totalCoins).toBe(0);
    // A refused run must not burn the challenge either — it is still claimable
    // by a real run in the right mode, today.
    expect(save.isDailyDone(DAY)).toBe(false);
    expect(save.completeDaily(DAY)).toBe(true);
  });

  it("pays a daily cleared in its advertised mode", () => {
    const save = new SaveData();
    const c = dailyChallenge(DAY);
    const run = beatsTarget(c.metric, c.target);

    expect(dailyVerdict(run, c, c.mode)).toBe("claim");

    const verdict = dailyVerdict(run, c, c.mode);
    if (verdict === "claim" && save.completeDaily(DAY)) save.addCoins(c.reward);

    expect(save.state.wallet).toBe(c.reward);
    expect(save.isDailyDone(DAY)).toBe(true);
  });

  it("still reports a genuine miss in the right mode as a miss, not as a wrong mode", () => {
    const c = dailyChallenge(DAY);
    expect(dailyVerdict(stats(), c, c.mode)).toBe("missed");
    expect(dailyVerdict(stats(), c, otherMode(c.mode))).toBe("wrong-mode");
  });

  it("refuses a gauntlet stage cleared in the wrong mode, on every stage", () => {
    const g = weeklyGauntlet(WEEK);
    for (const st of g.stages) {
      const run = beatsTarget(st.metric, st.target);
      expect(stageDone(run, st), `stage ${st.index} target should be beaten`).toBe(true);
      expect(stageVerdict(run, st, otherMode(st.mode))).toBe("wrong-mode");
      expect(stageVerdict(run, st, st.mode)).toBe("claim");
      expect(stageVerdict(stats(), st, st.mode)).toBe("missed");
    }
  });

  it("keeps a refused gauntlet stage unclaimed", () => {
    const save = new SaveData();
    const g = weeklyGauntlet(WEEK);
    const st = g.stages[0]!;
    const wrong = otherMode(st.mode);

    const verdict = stageVerdict(beatsTarget(st.metric, st.target), st, wrong);
    if (verdict === "claim") {
      const res = save.completeGauntletStage(WEEK, 0);
      if (res) save.addCoins(st.reward);
    }

    expect(save.gauntletDone(WEEK)).toEqual([]);
    expect(save.completeGauntletStage(WEEK, 0)).toBe("stage");
  });
});

describe("the mode is a property of the challenge, not of the button", () => {
  it("resolves the daily's own mode from the challenge flag alone", () => {
    expect(challengeMode("daily", DAY, WEEK)).toBe(dailyChallenge(DAY).mode);
  });

  it("resolves each gauntlet stage's mode from the flag alone", () => {
    const g = weeklyGauntlet(WEEK);
    g.stages.forEach((st, i) => {
      expect(challengeMode(`gauntlet${i}`, DAY, WEEK)).toBe(st.mode);
    });
  });

  it("has no mode for a run that is not a challenge, or a stage that no longer exists", () => {
    expect(challengeMode("", DAY, WEEK)).toBe("");
    expect(challengeMode("gauntlet9", DAY, WEEK)).toBe("");
    expect(challengeMode("somethingElse", DAY, WEEK)).toBe("");
  });

  it("re-applies the mode 'Fly again' loses, because the replay flag cannot carry it", () => {
    // replayOptions rebuilds the challenge from saved run metadata. It has no
    // mode to give, which is exactly why the launch funnel re-derives it.
    const opts = replayOptions({
      duel: false,
      challenge: "daily",
      dailyDone: false,
      gauntletDone: [],
      event: false,
      storm: false,
    });
    expect(opts).toEqual({ challenge: "daily" });
    expect(challengeMode(opts.challenge ?? "", DAY, WEEK)).toBe(dailyChallenge(DAY).mode);
  });

  it("names the mode the player has to use, so a refusal can tell them", () => {
    const c = dailyChallenge(DAY);
    expect(modeById(c.mode).name).toBeTruthy();
  });
});

describe("the two gates are wired into the game, not just into the helpers", () => {
  /** Read a repo source file (vitest runs from the workspace root). */
  const src = (): string => readFileSync(join(process.cwd(), "src", "game", "Game.ts"), "utf8");

  it("re-applies the challenge mode at the single launch funnel every run passes through", () => {
    const game = src();
    const from = game.indexOf("private startRun(");
    expect(from).toBeGreaterThan(-1);
    // Up to the next method declaration — the slice starts with "private ", so
    // the search has to begin past it.
    const body = game.slice(from, game.indexOf("\n  private ", from + 1));
    // The flag is set, and the mode is re-derived from it right there.
    expect(body).toContain("this.challengeRun = opts?.challenge ?? \"\";");
    expect(body).toContain("challengeMode(this.challengeRun");
    expect(body).toContain("this.modeId = challengeModeId;");
  });

  it("gates the daily claim on the mode, not only on the metric", () => {
    const game = src();
    const claim = game.slice(game.indexOf('if (this.challengeRun === "daily")'));
    expect(claim).toContain("dailyVerdict(stats, c, this.modeId)");
    // The metric-only predicate is no longer the thing that authorises a payout.
    expect(claim.slice(0, claim.indexOf('} else if (this.challengeRun.startsWith("gauntlet"))'))).not.toMatch(
      /if \(dailyDone\(/,
    );
  });

  it("gates the gauntlet claim on the mode too", () => {
    const game = src();
    const claim = game.slice(game.indexOf('this.challengeRun.startsWith("gauntlet")'));
    expect(claim).toContain("stageVerdict(stats, st, this.modeId)");
  });

  it("leaves no other claim site paying a challenge reward", () => {
    // Every award of c.reward / st.reward / g.clearBonus has to sit behind a
    // verdict, so a future claim path cannot ship ungated.
    const game = src();
    for (const marker of ["addCoins(c.reward)", "addCoins(st.reward)", "addCoins(g.clearBonus)"]) {
      const sites = game.split(marker).length - 1;
      expect(sites, `${marker} should appear exactly once`).toBe(1);
    }
    const dailyClaim = game.indexOf("addCoins(c.reward)");
    const dailyGate = game.lastIndexOf('dailyVerdict(stats, c, this.modeId)', dailyClaim);
    expect(dailyGate).toBeGreaterThan(-1);
    // …and it is in the same statement block, not 300 lines earlier.
    expect(dailyClaim - dailyGate).toBeLessThan(400);
  });
});
