/**
 * A bought coin multiplier pays on EVERY coin award, not nineteen out of twenty.
 *
 * `goldenfeather` is sold as "+10% coins forever" (Economy.ts), and
 * `addCoins()` is the only path that applies it. Five awards used to add
 * straight to `wallet`/`totalCoins` instead: the piggy bank, the ranked streak
 * bonus, the season rollover, the login streak, and the comeback bonus — so
 * the one unconditional claim in the economy was false for all five. The bug
 * was even self-documented: the run-end path (recordRun) carries a comment
 * saying it "used to add straight to wallet/totalCoins, silently bypassing
 * both" — the same class of bug, diagnosed and fixed at one call site out of
 * six.
 *
 * Each award is also checked for the second half of the contract: the number
 * it RETURNS is the number the player was credited, because every caller
 * toasts it as "+N coins". And a save written by an older build must still
 * load without gaining a coin it was not owed.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { COIN_MULTIPLIER_UPGRADES } from "../Economy";
import { seasonReward, streakBonus } from "../pvp";
import { SaveData } from "../SaveData";

/** The multiplier the shop actually sells, read from the data rather than
 *  restated here, so this file cannot quietly pass on a changed value. */
const FEATHER = COIN_MULTIPLIER_UPGRADES.goldenfeather!;
/** Rounded the same way addCoins rounds, so the expectation is the real one. */
const boosted = (amount: number): number => Math.ceil(amount * FEATHER);

/** A save that owns the permanent multiplier. */
function withFeather(): SaveData {
  const save = new SaveData();
  expect(save.ownUpgrade("goldenfeather")).toBe(true);
  expect(save.coinMultiplier()).toBeCloseTo(FEATHER, 10);
  return save;
}

describe("every coin award pays the bought multiplier", () => {
  beforeEach(() => localStorage.clear());

  it("pays it on the piggy bank, and reports what it credited", () => {
    const save = withFeather();
    save.state.piggyBank = { coins: 500, maxCoins: 1000 };
    const before = save.state.wallet;

    const smashed = save.smashPiggyBank();

    expect(smashed).toBe(boosted(500));
    expect(save.state.wallet - before).toBe(boosted(500));
    expect(save.state.totalCoins).toBe(save.state.wallet);
    // The bank is emptied either way — a bonus must not leave spendable coins
    // behind in the bank.
    expect(save.state.piggyBank.coins).toBe(0);
    // …and an empty bank still pays nothing rather than paying a bonus.
    expect(save.smashPiggyBank()).toBe(0);
  });

  it("pays it on the ranked streak bonus, and reports what it credited", () => {
    const save = withFeather();
    const before = save.state.wallet;
    // A win with a live streak: place 1 of 40 is a win, and streak 2 pays.
    save.state.rival.streak = 1;
    const res = save.recordRivalResult(1, 40, "massrace", "2026-09-26");

    const raw = streakBonus(2);
    expect(raw).toBeGreaterThan(0);
    expect(res.bonus).toBe(boosted(raw));
    expect(save.state.wallet - before).toBe(res.bonus);
    expect(save.state.totalCoins).toBe(save.state.wallet);
  });

  it("pays it on the season rollover, and reports what it credited", () => {
    const save = withFeather();
    // A season id that cannot be the current month forces the rollover.
    save.state.rankSeason = { id: "R1999-01", peak: 1400 };
    const before = save.state.wallet;

    const season = save.ensureRankSeason();

    expect(season).not.toBeNull();
    const raw = seasonReward(1400).coins;
    expect(season!.coins).toBe(boosted(raw));
    expect(save.state.wallet - before).toBe(season!.coins);
    expect(save.state.totalCoins).toBe(save.state.wallet);
    // Once per season, still.
    expect(save.ensureRankSeason()).toBeNull();
  });

  it("pays it on the login streak, and reports what it credited", () => {
    const save = withFeather();
    const before = save.state.wallet;

    const credited = save.touchStreak("2026-09-26", "2026-09-25");

    // First day of a streak pays the day-1 rate: 20 * min(7, 1).
    expect(credited).toBe(boosted(20));
    expect(save.state.wallet - before).toBe(credited);
    expect(save.state.totalCoins).toBe(save.state.wallet);
  });

  it("pays it on the comeback bonus as well as the streak", () => {
    const save = withFeather();
    // A live streak that skipped a day: the comeback branch is the one that
    // pays a flat 50 on top.
    save.state.streak = { last: "2026-09-20", days: 3, claimedDate: "" };
    const before = save.state.wallet;

    const credited = save.touchStreak("2026-09-26", "2026-09-25");

    const daily = 20 * Math.min(7, Math.max(1, save.state.streak.days));
    expect(credited).toBe(boosted(daily));
    expect(save.state.wallet - before).toBe(boosted(daily) + boosted(50));
    expect(save.state.totalCoins).toBe(save.state.wallet);
  });

  it("pays nothing extra to a player who bought nothing", () => {
    const save = new SaveData();
    save.state.piggyBank = { coins: 500, maxCoins: 1000 };

    expect(save.smashPiggyBank()).toBe(500);
    expect(save.touchStreak("2026-09-26", "2026-09-25")).toBe(20);
    // The whole point is that the multiplier is the only difference between
    // these two runs, so the un-bought wallet must be the raw amount.
    expect(save.state.wallet).toBe(520);
  });
});

describe("no award site can bypass the multiplier again", () => {
  /** Read a repo source file (vitest runs from the workspace root). */
  const src = (...parts: string[]): string => readFileSync(join(process.cwd(), "src", ...parts), "utf8");

  it("leaves one award path as the only place in src/ that moves the wallet", () => {
    // Pinned by grep because a sixth bypass would compile, pass every
    // behavioural test, and quietly make the shop copy false again.
    const saveData = src("game", "SaveData.ts");
    expect(saveData.match(/wallet \+=/g) ?? []).toHaveLength(1);
    expect(saveData.match(/totalCoins \+=/g) ?? []).toHaveLength(1);
    // …and both are inside the single award path, not merely somewhere in the
    // file. addCoins() is that path for every ordinary award; the run payout
    // passes its own time-weighted multiplier to the same private method.
    const award = saveData.slice(saveData.indexOf("private awardCoins("));
    const awardBody = award.slice(0, award.indexOf("\n  /**", 1) === -1 ? undefined : award.indexOf("\n  /**", 1));
    expect(awardBody).toContain("this.state.wallet += awarded;");
    expect(awardBody).toContain("this.state.totalCoins += awarded;");
    const addCoins = saveData.slice(saveData.indexOf("addCoins(amount: number): number {"));
    expect(addCoins.slice(0, addCoins.indexOf("}"))).toContain("this.awardCoins(amount, this.coinMultiplier())");
  });

  it("keeps the run-end path on the same award path, with its own multiplier", () => {
    const saveData = src("game", "SaveData.ts");
    const recordRun = saveData.slice(saveData.indexOf("recordRun("), saveData.indexOf("smashPiggyBank("));
    // A run's coins are timed-weighted over the run rather than read at the
    // payout — but they still go through the one award path.
    expect(recordRun).toContain("this.awardCoins(totalRunCoins, this.runCoinMultiplier())");
    expect(recordRun).not.toMatch(/wallet \+=|totalCoins \+=/);
  });
});

describe("a save from an older build still loads, and gains nothing", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips an export/import without minting a coin", () => {
    const save = withFeather();
    save.state.wallet = 1234;
    save.state.totalCoins = 5678;
    const code = save.exportCode();
    const walletBefore = save.state.wallet;

    expect(save.importCode(code)).toBe(true);

    // Loading is not an award: the multiplier is applied when coins are
    // earned, never when a save is read.
    expect(save.state.wallet).toBe(walletBefore);
    expect(save.state.totalCoins).toBe(5678);
  });

  it("takes a save at face value and tops nothing up", () => {
    // A save code is a legitimate transfer of a state the player already had,
    // so a lower wallet must land lower — a multiplier applied at load time
    // would mint coins out of a read.
    const save = withFeather();
    save.state.wallet = 400;
    save.state.totalCoins = 400;
    const code = save.exportCode();
    save.state.wallet = 5_000;

    expect(save.importCode(code)).toBe(true);

    expect(save.state.wallet).toBe(400);
  });

  it("rejects a hand-edited save with negative currency", () => {
    const save = withFeather();
    const before = save.state.wallet;
    const code = btoa(unescape(encodeURIComponent(JSON.stringify({ ...save.state, deviceId: "spoof", wallet: -500 }))));

    expect(save.importCode(code)).toBe(false);
    expect(save.state.wallet).toBe(before);
  });

  it("re-applies a multiplier to a save that reloads mid-session", () => {
    const save = withFeather();
    save.smashPiggyBank();
    const afterPayout = save.state.wallet;
    // Reload from storage (new instance, same storage) — the multiplier is
    // still owned, so the next award pays it again.
    const reloaded = new SaveData();
    reloaded.state.piggyBank = { coins: 100, maxCoins: 1000 };
    expect(reloaded.smashPiggyBank()).toBe(boosted(100));
    expect(reloaded.state.wallet).toBe(afterPayout + boosted(100));
  });
});
