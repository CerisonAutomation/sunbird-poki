/**
 * A timed coin bonus pays for the time it was actually live.
 *
 * A run's coins are accumulated in Game and paid in ONE award at the end
 * (`recordRun` -> addCoins), so the multiplier that used to be read there was
 * the one live at the instant the run ENDED: a `luckycoin` armed for 60s in
 * the middle of a 90s run contributed nothing to the whole run, and one armed
 * at second 85 was applied to all 90s of it. The player watched the bonus
 * appear and disappear and got one number, resolved once, at the end.
 *
 * The run is now weighted over its own duration: the payout uses the permanent
 * multiplier (it cannot change mid-run) times the timed multiplier averaged
 * across the run. Averaged by sweeping the windows the bonus was live in, so
 * two overlapping bonuses count once — the stronger one applies — instead of
 * stacking.
 *
 * The run window is session state, not save state: a save written by an older
 * build has no such fields and must keep loading, which the last block pins.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { COIN_MULTIPLIER_UPGRADES } from "../Economy";
import { openPayload } from "../resilience/crc";
import { SAVE_KEY } from "../constants";
import { SaveData } from "../SaveData";

const FEATHER = COIN_MULTIPLIER_UPGRADES.goldenfeather!;
const SECOND = 1000;
const COINS = 900; // a run's worth of coins, so rounding is visible but small

/** Fly a run of `seconds`, arming bonuses at the given offsets, and pay out.
 *  `arms` are [offsetSeconds, multiplier, durationSeconds] triples. */
function flyRun(save: SaveData, seconds: number, arms: [number, number, number][] = []): number {
  save.beginRun();
  for (const [at, mult, dur] of arms) {
    vi.advanceTimersByTime(at * SECOND);
    save.setCoinBonus(mult, dur);
  }
  vi.advanceTimersByTime((seconds - arms.reduce((t, [at]) => t + at, 0)) * SECOND);
  const before = save.state.wallet;
  save.recordRun(1000, COINS, 100, "2026-09-26");
  return save.state.wallet - before;
}

describe("a timed coin bonus pays only for the time it was live", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("pays a 60s luckycoin for the 60s of a 90s run it covered", () => {
    const save = new SaveData();
    // Armed 30s in, live for 60s: 2x for 60 of the run's 90 seconds.
    const credited = flyRun(save, 90, [[30, 2, 60]]);

    expect(credited).toBe(Math.ceil(COINS * (1 + 60 / 90)));
    // The old answer — whatever was live at the end — was the full 2x, and the
    // other old failure mode (bonus read as expired) was 1x. Neither is right.
    expect(credited).not.toBe(COINS * 2);
    expect(credited).not.toBe(COINS);
  });

  it("does not pay a whole run for a bonus armed in its last seconds", () => {
    const save = new SaveData();
    // Armed at second 85 of a 90s run: 2x for five seconds.
    const credited = flyRun(save, 90, [[85, 2, 60]]);

    expect(credited).toBe(Math.ceil(COINS * (1 + 5 / 90)));
    expect(credited).toBeLessThan(COINS * 1.1);
  });

  it("pays a bonus that was live for the whole run in full", () => {
    const save = new SaveData();
    // Armed before takeoff and still running at the payout.
    save.setCoinBonus(2, 600);
    const credited = flyRun(save, 90);

    expect(credited).toBe(COINS * 2);
  });

  it("pays a bonus for the short time it was live, then nothing", () => {
    const save = new SaveData();
    // Armed at takeoff, 10s long, 90s run: 2x for ten seconds only. The old
    // read at payout saw an expired bonus and paid nothing at all, so the ten
    // seconds the player actually had it were worth nothing.
    const credited = flyRun(save, 90, [[0, 2, 10]]);

    expect(credited).toBe(Math.ceil(COINS * (1 + 10 / 90)));
  });

  it("counts two overlapping bonuses once, at the stronger rate", () => {
    const save = new SaveData();
    // 2x over [10,70], then 3x over [20,80] of a 100s run.
    // Instantaneous would read 3x (it ends inside both); naive summing would
    // read far more than any instant saw.
    const credited = flyRun(save, 100, [[10, 2, 60], [10, 3, 60]]);

    // 1x for [0,10], 2x for [10,20], 3x for [20,80], 1x for [80,100]
    // = 10 + 20 + 180 + 20 = 230 of excess over 100s => 2.3x
    expect(credited).toBe(Math.ceil(COINS * 2.3));
  });

  it("stacks the permanent multiplier with a whole-run bonus", () => {
    const save = new SaveData();
    save.ownUpgrade("goldenfeather");
    save.setCoinBonus(2, 600);

    expect(flyRun(save, 90)).toBe(Math.ceil(COINS * FEATHER * 2));
  });

  it("still pays the permanent multiplier with no timed bonus at all", () => {
    const save = new SaveData();
    save.ownUpgrade("goldenfeather");

    expect(flyRun(save, 90)).toBe(Math.ceil(COINS * FEATHER));
  });

  it("cannot pay the same run twice", () => {
    const save = new SaveData();
    flyRun(save, 90, [[0, 2, 600]]);
    const afterFirst = save.state.wallet;
    // A second payout for the same run has no window left, so it gets the
    // plain instantaneous multiplier rather than the run's weighted one.
    save.recordRun(1000, COINS, 100, "2026-09-26");
    expect(save.state.wallet - afterFirst).toBe(COINS * 2);
  });

  it("keeps the old answer when no run window was opened", () => {
    // No beginRun(): there is no run to weight over, so the instantaneous
    // value is the only honest answer available. This is what any caller that
    // forgets to open a window gets, and it is deliberately today's behaviour.
    const save = new SaveData();
    save.setCoinBonus(2, 600);
    const before = save.state.wallet;
    save.recordRun(1000, COINS, 100, "2026-09-26");

    expect(save.state.wallet - before).toBe(COINS * 2);
  });

  it("opens the window in the game itself, not only in tests", () => {
    const game = readFileSync(join(process.cwd(), "src", "game", "Game.ts"), "utf8");
    const from = game.indexOf("private startRun(");
    const body = game.slice(from, game.indexOf("\n  private ", from + 1));
    expect(body).toContain("this.save.beginRun();");
  });
});

describe("the run window is not save state", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds no field to the persisted save, so an older build's save still loads", () => {
    const save = new SaveData();
    save.ownUpgrade("goldenfeather");
    save.beginRun();
    save.setCoinBonus(2, 60);
    save.recordRun(1000, COINS, 100, "2026-09-26");

    const persisted = JSON.stringify(openPayload(localStorage.getItem(SAVE_KEY)!).data);
    for (const key of ["runStartedAt", "runBonusWindows", "coinBonus", "coinBonusUntil"]) {
      expect(persisted, `a save must not carry ${key}`).not.toContain(key);
    }
  });

  it("loads a save written before any of this existed and pays a run normally", () => {
    // A v1-era save: no run fields anywhere, and no multiplier either.
    const first = new SaveData();
    first.state.wallet = 1_234;
    first.persist();

    const reloaded = new SaveData();
    expect(reloaded.state.wallet).toBe(1_234);
    expect(reloaded.coinMultiplier()).toBe(1);
    expect(flyRun(reloaded, 30)).toBe(COINS);
  });
});
