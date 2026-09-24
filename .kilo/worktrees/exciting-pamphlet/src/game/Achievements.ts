import { BIOMES } from "./Biomes";
import { SKINS } from "./Economy";
import type { SaveData } from "./SaveData";

export type Rarity = "bronze" | "silver" | "gold" | "platinum";

export type AchievementDef = {
  id: string;
  title: string;
  desc: string;
  rarity: Rarity;
  target: number;
  metric: (s: SaveData) => number;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "flights_10", title: "Wingling", desc: "Complete 10 flights", rarity: "bronze", target: 10, metric: (s) => s.state.runsPlayed },
  { id: "dist_1k", title: "First Horizon", desc: "Fly 1,000 m lifetime", rarity: "bronze", target: 1000, metric: (s) => s.state.lifetime.distance },
  { id: "coins_200", title: "Piggy Bank", desc: "Earn 200 coins lifetime", rarity: "bronze", target: 200, metric: (s) => s.state.lifetime.coins },
  { id: "flights_25", title: "Frequent Flyer", desc: "Complete 25 flights", rarity: "silver", target: 25, metric: (s) => s.state.runsPlayed },
  { id: "dist_25k", title: "Horizon Chaser", desc: "Fly 25,000 m lifetime", rarity: "silver", target: 25000, metric: (s) => s.state.lifetime.distance },
  { id: "coins_1500", title: "Treasure Nest", desc: "Earn 1,500 coins lifetime", rarity: "silver", target: 1500, metric: (s) => s.state.lifetime.coins },
  { id: "zenith_20", title: "High Flyer", desc: "Hit 20 zenith moments lifetime", rarity: "silver", target: 20, metric: (s) => s.state.lifetime.zeniths },
  { id: "flights_100", title: "Sky Veteran", desc: "Complete 100 flights", rarity: "gold", target: 100, metric: (s) => s.state.runsPlayed },
  { id: "dist_100k", title: "World Wanderer", desc: "Fly 100,000 m lifetime", rarity: "gold", target: 100000, metric: (s) => s.state.lifetime.distance },
  { id: "coins_5000", title: "Golden Nest", desc: "Earn 5,000 coins lifetime", rarity: "gold", target: 5000, metric: (s) => s.state.lifetime.coins },
  { id: "skins_all", title: "Fashionista", desc: "Own every bird skin", rarity: "gold", target: SKINS.length, metric: (s) => s.state.ownedSkins.length },
  { id: "biomes_all", title: "Cartographer", desc: "Visit every island biome", rarity: "silver", target: BIOMES.length, metric: (s) => s.state.biomesSeen.length },
  { id: "island_10", title: "Beyond the Map", desc: "Reach island 10 in one flight", rarity: "gold", target: 10, metric: (s) => s.state.farthestIsland + 1 },
  { id: "ghost_10", title: "Self Rival", desc: "Beat your own ghost 10 times", rarity: "platinum", target: 10, metric: (s) => s.state.lifetime.ghostBeats },
  { id: "zenith_75", title: "Stratosphere", desc: "Hit 75 zenith moments lifetime", rarity: "platinum", target: 75, metric: (s) => s.state.lifetime.zeniths },
  { id: "prestige", title: "Sunbird Prestige", desc: "Own Gold and VIP", rarity: "platinum", target: 1, metric: (s) => (s.state.gold && s.state.vip ? 1 : 0) },
  { id: "duel_1", title: "First Blood", desc: "Win a ranked duel", rarity: "bronze", target: 1, metric: (s) => s.state.duel.wins },
  { id: "duel_10", title: "Duelist", desc: "Win 10 ranked duels", rarity: "silver", target: 10, metric: (s) => s.state.duel.wins },
  { id: "duel_50", title: "Blademaster of the Sky", desc: "Win 50 ranked duels", rarity: "gold", target: 50, metric: (s) => s.state.duel.wins },
  { id: "daily_5", title: "Regular", desc: "Complete 5 daily challenges", rarity: "bronze", target: 5, metric: (s) => s.state.challenges.dailiesDone },
  { id: "daily_30", title: "Rain or Shine", desc: "Complete 30 daily challenges", rarity: "gold", target: 30, metric: (s) => s.state.challenges.dailiesDone },
  { id: "gauntlet_1", title: "Storm Runner", desc: "Clear a weekly gauntlet", rarity: "silver", target: 1, metric: (s) => s.state.challenges.gauntletsCleared },
  { id: "gauntlet_5", title: "Eye of the Storm", desc: "Clear 5 weekly gauntlets", rarity: "platinum", target: 5, metric: (s) => s.state.challenges.gauntletsCleared },
  { id: "races_25", title: "Pack Animal", desc: "Fly 25 mass races", rarity: "silver", target: 25, metric: (s) => s.state.racesRun },
  { id: "mastery_15", title: "Journeyman of the Air", desc: "Earn 15 total mastery stars", rarity: "gold", target: 15, metric: (s) => totalMastery(s) },
  { id: "combo_5", title: "Chain Master", desc: "5x launch combo", rarity: "bronze", target: 5, metric: (s) => s.state.bestCombo || 0 },
  { id: "combo_10", title: "Combo King", desc: "10x launch combo", rarity: "silver", target: 10, metric: (s) => s.state.bestCombo || 0 },
  { id: "combo_20", title: "Combo Legend", desc: "20x launch combo", rarity: "gold", target: 20, metric: (s) => s.state.bestCombo || 0 },
  { id: "streak_3", title: "Hat Trick", desc: "3-day login streak", rarity: "bronze", target: 3, metric: (s) => s.state.streak.days },
  { id: "streak_7", title: "Weekly Warrior", desc: "7-day login streak", rarity: "silver", target: 7, metric: (s) => s.state.streak.days },
  { id: "streak_30", title: "Dedicated", desc: "30-day login streak", rarity: "platinum", target: 30, metric: (s) => s.state.streak.days },
  { id: "altitude_200", title: "Cloud Nine", desc: "Reach 200m altitude", rarity: "silver", target: 200, metric: (s) => s.state.bestAltitude || 0 },
  { id: "altitude_500", title: "Stratosphere Runner", desc: "Reach 500m altitude", rarity: "gold", target: 500, metric: (s) => s.state.bestAltitude || 0 },
  { id: "altitude_1k", title: "Edge of Space", desc: "Reach 1000m altitude", rarity: "platinum", target: 1000, metric: (s) => s.state.bestAltitude || 0 },
  { id: "distance_5k", title: "Marathoner", desc: "5,000 m in one flight", rarity: "silver", target: 5000, metric: (s) => s.state.bestDistance || 0 },
  { id: "distance_20k", title: "Ultra Marathoner", desc: "20,000 m in one flight", rarity: "gold", target: 20000, metric: (s) => s.state.bestDistance || 0 },
  { id: "skins_6", title: "Collector", desc: "Own 6 bird skins", rarity: "bronze", target: 6, metric: (s) => s.state.ownedSkins.length },
  { id: "skins_12", title: "Fashion Icon", desc: "Own 12 bird skins", rarity: "gold", target: 12, metric: (s) => s.state.ownedSkins.length },
  { id: "island_20", title: "Deep Explorer", desc: "Reach island 20", rarity: "platinum", target: 20, metric: (s) => s.state.farthestIsland + 1 },
  { id: "ghost_25", title: "Ghost Hunter", desc: "Beat your ghost 25 times", rarity: "platinum", target: 25, metric: (s) => s.state.lifetime.ghostBeats },
  { id: "races_50", title: "Racing Legend", desc: "Complete 50 races", rarity: "gold", target: 50, metric: (s) => s.state.runsPlayed },
  { id: "flights_200", title: "Sky Master", desc: "Complete 200 flights", rarity: "platinum", target: 200, metric: (s) => s.state.runsPlayed },
  { id: "sunflower_10", title: "Bloom Bouncer", desc: "Bounce off 10 sunflowers", rarity: "bronze", target: 10, metric: (s) => s.state.lifetime.sunflowers },
  { id: "sunflower_50", title: "Sun Worshipper", desc: "Bounce off 50 sunflowers", rarity: "silver", target: 50, metric: (s) => s.state.lifetime.sunflowers },
  { id: "sunflower_150", title: "Heliophile", desc: "Bounce off 150 sunflowers", rarity: "gold", target: 150, metric: (s) => s.state.lifetime.sunflowers },
];

function totalMastery(s: SaveData): number {
  const LEVELS = [3, 10, 25, 50, 100];
  let stars = 0;
  for (const runs of Object.values(s.state.mastery)) for (const need of LEVELS) if (runs >= need) stars++;
  return stars;
}

export type AchievementView = {
  def: AchievementDef;
  progress: number;
  unlocked: boolean;
};

export class Achievements {
  constructor(private save: SaveData) {}

  view(): AchievementView[] {
    const unlocked = new Set(this.save.state.achievements);
    return ACHIEVEMENTS.map((def) => {
      const current = Math.min(def.target, def.metric(this.save));
      return { def, progress: current, unlocked: unlocked.has(def.id) || current >= def.target };
    });
  }

  checkNew(): AchievementDef[] {
    const out: AchievementDef[] = [];
    for (const def of ACHIEVEMENTS) {
      if (def.metric(this.save) >= def.target && this.save.unlockAchievement(def.id)) out.push(def);
    }
    return out;
  }

  counts(): { unlocked: number; total: number } {
    const unlocked = new Set(this.save.state.achievements);
    let n = 0;
    for (const def of ACHIEVEMENTS) if (unlocked.has(def.id) || def.metric(this.save) >= def.target) n++;
    return { unlocked: n, total: ACHIEVEMENTS.length };
  }
}
