import { beforeEach, describe, expect, it } from "vitest";
import { SEASON_TIER_DEFS, SeasonPass } from "../SeasonPass";
import { SaveData } from "../SaveData";
import { seasonId } from "../season";

describe("season pass", () => {
  let save: SaveData;
  let sp: SeasonPass;

  beforeEach(() => {
    localStorage.clear();
    save = new SaveData();
    // Pin the save to the current season so ensureFresh() is a no-op.
    save.state.season.id = seasonId();
    sp = new SeasonPass(save);
  });

  it("builds a full tier table with monotonic xp and both tracks", () => {
    expect(SEASON_TIER_DEFS.length).toBeGreaterThan(0);
    for (let i = 1; i < SEASON_TIER_DEFS.length; i++) {
      expect(SEASON_TIER_DEFS[i]!.xpNeeded).toBeGreaterThan(SEASON_TIER_DEFS[i - 1]!.xpNeeded);
    }
    for (const t of SEASON_TIER_DEFS) {
      expect(t.free.kind).toBeTruthy();
      expect(t.premium.kind).toBeTruthy();
    }
  });

  it("maps xp to tier and in-tier progress", () => {
    expect(sp.tier()).toBe(0);
    const xpPerTier = SEASON_TIER_DEFS[0]!.xpNeeded; // = 1 tier worth
    sp.addXp(xpPerTier);
    expect(sp.tier()).toBe(1);
    const prog = sp.progressInTier();
    expect(prog.have).toBe(0);
    expect(prog.need).toBe(xpPerTier);
  });

  it("claims a free tier once and grants its reward", () => {
    const xpPerTier = SEASON_TIER_DEFS[0]!.xpNeeded;
    sp.addXp(xpPerTier); // reach tier 1
    const before = save.state.wallet;
    const reward = sp.claim(1, "free");
    expect(reward).not.toBeNull();
    expect(sp.claim(1, "free")).toBeNull(); // no double-claim
    if (reward!.kind === "coins") expect(save.state.wallet).toBe(before + reward!.amount);
  });

  it("refuses to claim a tier above the reached one", () => {
    expect(sp.claim(5, "free")).toBeNull();
  });

  it("gates the premium track behind gold", () => {
    sp.addXp(SEASON_TIER_DEFS[0]!.xpNeeded);
    expect(sp.claim(1, "premium")).toBeNull(); // not gold yet
    save.state.gold = true;
    const reward = sp.claim(1, "premium");
    expect(reward).not.toBeNull();
    // Premium is also single-claim.
    expect(sp.claim(1, "premium")).toBeNull();
  });

  it("view reflects unlocked/claimed/locked state", () => {
    sp.addXp(SEASON_TIER_DEFS[0]!.xpNeeded);
    const view = sp.view();
    expect(view[0]!.unlocked).toBe(true); // tier 1 reached
    expect(view[1]!.unlocked).toBe(false); // tier 2 not reached
    expect(view[0]!.premiumLocked).toBe(true); // not gold
  });
});
