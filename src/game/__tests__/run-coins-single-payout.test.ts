// A run's coins are accumulated in `Game.runCoins` during flight and paid
// exactly once, in a single `recordRun()` call from `finishRun()`. That is the
// contract: `runCoins` is a *tally*, not a wallet, and `SaveData.awardCoins`
// is the only thing that moves the wallet.
//
// The bug this file exists to prevent: `specialEffects()` credited a surprise
// payout to BOTH —
//
//     this.runCoins += surprise.coins;      // paid at finishRun()
//     this.save.addCoins(surprise.coins);   // paid immediately
//
// so those coins were handed out twice. The player saw the wallet jump while
// still flying, then the results card paid the identical amount again. It is
// the kind of bug that survives because it is a *ratio* nobody audits: the
// numbers are plausible at every individual step, only the sum is wrong, and
// `Surprises` tests only ever cover which surprise fires — never how its
// coins are credited.
//
// This is a source-level guard rather than a behavioural one on purpose.
// `specialEffects` is private and needs a live renderer plus terrain to run, so
// a unit test of it would be mostly mocks. The invariant, though, is purely
// lexical and it is the invariant that broke: inside `Game.ts`, no site may
// credit an in-flight coin gain to both the tally and the wallet. Grepping the
// source is what actually pins the rule.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const GAME = join(process.cwd(), "src/game/Game.ts");
const game = readFileSync(GAME, "utf8");

/**
 * Every `runCoins += …` site, plus the handful of lines that follow it, so we
 * can see whether the same block also reaches into the wallet.
 */
function coinGainBlocks(): { line: number; text: string }[] {
  const lines = game.split("\n");
  const out: { line: number; text: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/\brunCoins\s*\+=/.test(lines[i])) continue;
    // A narrow window: the statement plus the next couple of lines, which is
    // where a same-block `addCoins` would sit.
    const text = lines.slice(i, i + 3).join("\n");
    out.push({ line: i + 1, text });
  }
  return out;
}

describe("run coins are tallied in flight and paid once", () => {
  it("credits every in-flight coin gain to the tally only", () => {
    // `finishRun` legitimately pays: that is the single settlement call.
    const settlements = game.match(/this\.save\.recordRun\(/g) ?? [];
    expect(settlements, "there should be exactly one run settlement").toHaveLength(1);

    const offenders = coinGainBlocks().filter((b) => /save\.addCoins\(/.test(b.text));
    expect(
      offenders.map((b) => `Game.ts:${b.line} — ${b.text.trim().replace(/\s+/g, " ")}`),
      "an in-flight coin gain must only touch `runCoins`: the wallet is paid once, at finishRun()",
    ).toEqual([]);
  });

  it("still tallies the surprise payout, so the player is not shortchanged", () => {
    // The guard above would also pass if someone "fixed" the double-credit by
    // deleting the line outright. The surprise must still reach the tally.
    expect(game).toMatch(/this\.runCoins\s*\+=\s*surprise\.coins;/);
    expect(game).not.toMatch(/this\.runCoins\s*\+=\s*surprise\.coins;[\s\S]{0,160}?this\.save\.addCoins\(\s*surprise\.coins\s*\)/);
  });
});
