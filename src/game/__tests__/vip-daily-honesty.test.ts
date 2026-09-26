/**
 * The VIP daily toast quotes what the wallet actually received.
 *
 * `claimVipDaily` credited the wallet through `addCoins()` — which applies the
 * coin multiplier — and then returned the raw nominal gift. For an owner of
 * `goldenfeather`, sold in the shop as "+10% coins forever", the wallet went up
 * by 110 while the toast said +100. One number announced, another delivered.
 *
 * The neighbouring `touchStreak` was never affected: it credits
 * `state.wallet` directly and bypasses `addCoins`, so its toast always matched
 * the credit. That asymmetry is why the bug survived — the two daily rewards
 * sit side by side and only one of them lies.
 *
 * Returning what `addCoins` returned is safe only if no caller treats the
 * return as the authoritative credit rather than as something to display, so
 * that is checked here too, at the source: all three call sites in `Game.ts`
 * either discard the value or interpolate it into a toast.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { COIN_MULTIPLIER_UPGRADES } from "../Economy";
import { VIP_DAILY_GIFT } from "../constants";
import { SaveData } from "../SaveData";

const FEATHER = COIN_MULTIPLIER_UPGRADES.goldenfeather;
const TODAY = "2026-09-26";
const YESTERDAY = "2026-09-25";

describe("the VIP daily gift reports what it paid", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("hands back the nominal gift when no multiplier is owned", () => {
    const s = new SaveData();
    s.grantVip();
    const before = s.state.wallet;
    expect(s.claimVipDaily(TODAY)).toBe(VIP_DAILY_GIFT);
    expect(s.state.wallet - before).toBe(VIP_DAILY_GIFT);
  });

  it("hands back the multiplied amount when the coin upgrade is owned", () => {
    // The whole defect. The wallet is credited the nominal gift times the
    // multiplier, and the number the player is told has to be that same
    // figure. The exact integer is the existing rounding rule's business
    // (1.1 x 100 lands a hair over 110 in binary floating point, so `ceil`
    // gives 111) — what this pins is that the two agree.
    const s = new SaveData();
    s.grantVip();
    expect(s.ownUpgrade("goldenfeather")).toBe(true);
    const before = s.state.wallet;
    const reported = s.claimVipDaily(TODAY);
    expect(s.coinMultiplier()).toBeCloseTo(FEATHER, 10);
    expect(reported).toBeGreaterThan(VIP_DAILY_GIFT);
    expect(s.state.wallet - before).toBe(Math.ceil(VIP_DAILY_GIFT * s.coinMultiplier()));
    expect(reported).toBe(s.state.wallet - before);
  });

  it("keeps the return and the credit equal with and without the upgrade", () => {
    for (const owned of [false, true]) {
      const s = new SaveData();
      s.grantVip();
      if (owned) s.ownUpgrade("goldenfeather");
      const before = s.state.wallet;
      expect(s.claimVipDaily(TODAY)).toBe(s.state.wallet - before);
    }
  });

  it("still returns nothing, and pays nothing, on a second claim the same day", () => {
    const s = new SaveData();
    s.grantVip();
    s.ownUpgrade("goldenfeather");
    s.claimVipDaily(TODAY);
    const after = s.state.wallet;
    expect(s.claimVipDaily(TODAY)).toBe(0);
    expect(s.state.wallet).toBe(after);
  });

  it("still returns nothing, and pays nothing, without VIP", () => {
    const s = new SaveData();
    const before = s.state.wallet;
    expect(s.claimVipDaily(TODAY)).toBe(0);
    expect(s.state.wallet).toBe(before);
  });

  it("leaves the login streak's toast honest by not going through addCoins", () => {
    // The clean neighbour, pinned so the asymmetry cannot quietly reverse: a
    // streak reward is credited straight to the wallet, so what it reports and
    // what it pays are the same value by construction.
    const s = new SaveData();
    s.ownUpgrade("goldenfeather");
    const before = s.state.wallet;
    expect(s.touchStreak(TODAY, YESTERDAY)).toBe(s.state.wallet - before);
  });
});

describe("no coin award credits one number and reports another", () => {
  const src = readFileSync(join(process.cwd(), "src", "game", "SaveData.ts"), "utf8");

  it("found the addCoins call sites rather than matching none of them", () => {
    // Vacuity guard: if the shape below stopped matching the source, the
    // assertion after it would be green while asserting nothing.
    expect(src.match(/this\.addCoins\(/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
  });

  it("has no addCoins statement immediately followed by a different return", () => {
    // The defect shape, exactly: credit through addCoins, then return a value
    // that is not what addCoins returned. `claimVipDaily` was the only site.
    const mismatches = [...src.matchAll(/this\.addCoins\([^;]*\);\s*\n\s*return\s+(?!this\.addCoins)/g)];
    expect(mismatches.map((m) => m[0].replace(/\s+/g, " "))).toEqual([]);
  });

  it("returns addCoins' result from claimVipDaily", () => {
    const from = src.indexOf("claimVipDaily(today: string): number {");
    expect(from).toBeGreaterThan(-1);
    const body = src.slice(from, src.indexOf("\n  }", from));
    expect(body).toMatch(/return this\.addCoins\(VIP_DAILY_GIFT\);/);
  });
});

describe("no caller treats the claim's return as the authoritative credit", () => {
  const game = readFileSync(join(process.cwd(), "src", "game", "Game.ts"), "utf8");
  const lines = game.split("\n");

  /** Each `claimVipDaily(...)` line in Game.ts, with the identifier it binds
   *  ("" when the result is discarded) and every line that mentions it. */
  function claimSites(): { bound: string; usedOn: string[] }[] {
    const out: { bound: string; usedOn: string[] }[] = [];
    lines.forEach((line, i) => {
      if (!line.includes("claimVipDaily(")) return;
      const m = /const\s+(\w+)\s*=\s*(?:this\.save\.)?claimVipDaily\(/.exec(line);
      if (!m) {
        out.push({ bound: "", usedOn: [] });
        return;
      }
      const uses = lines.filter((other) => new RegExp(`\\b${m[1]}\\b`).test(other));
      out.push({ bound: m[1], usedOn: uses.map((other, j) => (j === 0 && other === line ? other : other)) });
      void i;
    });
    return out;
  }

  it("finds all three call sites, two of which bind the value", () => {
    const sites = claimSites();
    expect(sites).toHaveLength(3);
    expect(sites.filter((s) => s.bound).length).toBe(2);
  });

  it("uses every bound value only in a presence check or a toast", () => {
    for (const { bound, usedOn } of claimSites()) {
      if (!bound) continue; // a discarded return cannot be treated as anything
      expect(usedOn.length).toBeGreaterThan(1); // the binding and at least one use
      for (const raw of usedOn) {
        // A template literal may legitimately interpolate the value, so note
        // that and then blank the literals out: the words inside a toast
        // string ("VIP daily gift") are prose, not uses of the variable.
        const interpolates = raw.includes("${");
        const code = raw.replace(/`[^`]*`/g, "``").replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");
        if (!new RegExp(`\\b${bound}\\b`).test(code)) continue; // prose only
        // Either the line that binds it, or a `> 0` presence check.
        // Arithmetic, or an assignment into save state, would mean something
        // treats the return as the credit — and a doubled credit would be the
        // price of this fix.
        const isBinding = new RegExp(`const\\s+${bound}\\s*=[^=]`).test(code);
        const isPresenceCheck = new RegExp(`${bound}\\s*>\\s*0`).test(code);
        expect(`${isBinding || isPresenceCheck || interpolates} :: ${raw.trim()}`).toMatch(/^true/);
      }
    }
  });
});
