import { SEASON_TIERS, SEASON_XP_PER_TIER } from "./constants";
import type { SaveData } from "./SaveData";
import { seasonId } from "./season";
export { seasonId, seasonLabel } from "./season";

export type SeasonReward =
  | { kind: "coins"; amount: number }
  | { kind: "skin"; id: string }
  | { kind: "boost"; id: string }
  | { kind: "trail"; id: string };

export type TierDef = {
  tier: number;
  xpNeeded: number;
  free: SeasonReward;
  premium: SeasonReward;
};

function buildTiers(): TierDef[] {
  const tiers: TierDef[] = [];
  for (let i = 1; i <= SEASON_TIERS; i++) {
    // Free track: coins every tier, a boost every 5th, the Starfall trail at 25,
    // and the Bird of Paradise at 30 — free players earn a real exclusive.
    const free: SeasonReward =
      i === 25
        ? { kind: "trail", id: "trail_star" }
        : i === 30
          ? { kind: "skin", id: "paradise" }
          : i % 5 === 0
            ? { kind: "boost", id: i % 10 === 0 ? "headstart" : "sunflask" }
            : { kind: "coins", amount: 30 + i * 4 };
    // Premium track: earlier skins, the Prism trail, and a Raven capstone at 50.
    const premium: SeasonReward =
      i === 10
        ? { kind: "skin", id: "owl" }
        : i === 20
          ? { kind: "skin", id: "ember" }
          : i === 35
            ? { kind: "trail", id: "trail_prism" }
            : i === 50
              ? { kind: "skin", id: "raven" }
              : { kind: "coins", amount: 70 + i * 10 };
    tiers.push({ tier: i, xpNeeded: i * SEASON_XP_PER_TIER, free, premium });
  }
  return tiers;
}

export const SEASON_TIER_DEFS = buildTiers();





/** XP is granted live from gameplay events (coins, clouds, perfects, islands, zeniths, distance). */
export const XP_RULES = {
  coin: 1,
  cloud: 4,
  perfect: 6,
  island: 25,
  zenith: 15,
  ghostBeat: 20,
  perMetre: 1 / 12,
} as const;

export type TierView = TierDef & {
  unlocked: boolean;
  freeClaimed: boolean;
  premiumClaimed: boolean;
  premiumLocked: boolean;
};

export class SeasonPass {
  constructor(private save: SaveData) {}

  private ensureFresh(): void {
    const id = seasonId();
    if (this.save.state.season.id !== id) {
      this.save.state.season = { id, xp: 0, claimedFree: [], claimedPremium: [] };
      this.save.persist();
    }
  }

  xp(): number {
    this.ensureFresh();
    return this.save.state.season.xp;
  }

  tier(): number {
    return Math.min(SEASON_TIERS, Math.floor(this.xp() / SEASON_XP_PER_TIER));
  }

  progressInTier(): { have: number; need: number } {
    const t = this.tier();
    const have = this.xp() - t * SEASON_XP_PER_TIER;
    return { have, need: SEASON_XP_PER_TIER };
  }

  addXp(amount: number): number {
    this.ensureFresh();
    this.save.state.season.xp += amount;
    this.save.persist();
    return this.save.state.season.xp;
  }

  view(): TierView[] {
    this.ensureFresh();
    const s = this.save.state.season;
    const reached = this.tier();
    return SEASON_TIER_DEFS.map((def) => ({
      ...def,
      unlocked: def.tier <= reached,
      freeClaimed: s.claimedFree.includes(def.tier),
      premiumClaimed: s.claimedPremium.includes(def.tier),
      premiumLocked: !this.save.state.gold,
    }));
  }

  claim(tier: number, track: "free" | "premium"): SeasonReward | null {
    this.ensureFresh();
    const def = SEASON_TIER_DEFS.find((d) => d.tier === tier);
    if (!def || tier > this.tier()) return null;
    const s = this.save.state.season;
    if (track === "premium") {
      if (!this.save.state.gold || s.claimedPremium.includes(tier)) return null;
      s.claimedPremium.push(tier);
    } else {
      if (s.claimedFree.includes(tier)) return null;
      s.claimedFree.push(tier);
    }
    this.grant(track === "premium" ? def.premium : def.free);
    this.save.persist();
    return track === "premium" ? def.premium : def.free;
  }

  private grant(reward: SeasonReward): void {
    if (reward.kind === "coins") this.save.addCoins(reward.amount);
    else if (reward.kind === "skin") this.save.ownSkin(reward.id);
    else if (reward.kind === "trail") this.save.ownTrail(reward.id);
    else this.save.armBoost(reward.id);
  }
}
