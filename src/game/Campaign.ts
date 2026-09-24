/**
 * Campaign — "The Long Migration": structured PvE progression.
 *
 * Eight chapters, three goals each. Goals check lifetime + best-run stats
 * from SaveData, so progress accrues from ordinary play — no separate
 * campaign mode to grind. Chapters unlock in order; each pays a chunky
 * one-time reward and the finale grants the Condor prize skin path.
 *
 * Pure functions + tiny state (claimed chapter ids) → trivially testable.
 */

import type { SaveData } from "./SaveData";

export type CampaignGoal = {
  id: string;
  label: string;
  target: number;
  /** Reads current progress from the save. */
  metric: (s: SaveData) => number;
};

export type CampaignChapter = {
  id: string;
  title: string;
  story: string;
  icon: string;
  goals: CampaignGoal[];
  rewardCoins: number;
  /** Optional extra grant on chapter completion. */
  rewardLabel: string;
};

export const CAMPAIGN: CampaignChapter[] = [
  {
    id: "ch1",
    title: "Leaving the Nest",
    story: "Every migration starts with one brave hop. Yours was mostly falling — but stylish falling.",
    icon: "🥚",
    goals: [
      { id: "ch1-fly", label: "Fly 1,000 m lifetime", target: 1000, metric: (s) => s.state.lifetime.distance },
      { id: "ch1-coin", label: "Collect 50 coins lifetime", target: 50, metric: (s) => s.state.lifetime.coins },
      { id: "ch1-run", label: "Finish 3 flights", target: 3, metric: (s) => s.state.runsPlayed },
    ],
    rewardCoins: 60,
    rewardLabel: "Fledgling banner",
  },
  {
    id: "ch2",
    title: "The First Ridge",
    story: "The hills whisper a rhythm: dive, release, rise. The birds who listen go far.",
    icon: "⛰",
    goals: [
      { id: "ch2-best", label: "Fly 1,500 m in one run", target: 1500, metric: (s) => s.state.bestDistance },
      { id: "ch2-perf", label: "Land a perfect slide", target: 1, metric: (s) => (s.state.bestCombo >= 1 ? 1 : 0) },
      { id: "ch2-isl", label: "Reach island 3", target: 3, metric: (s) => s.state.farthestIsland + 1 },
    ],
    rewardCoins: 90,
    rewardLabel: "Ridge-runner title",
  },
  {
    id: "ch3",
    title: "Songs of the Reef",
    story: "Pastel lagoons, updrafts warm as soup. The locals are shellfish but welcoming.",
    icon: "🐚",
    goals: [
      { id: "ch3-alt", label: "Reach 80 m altitude", target: 80, metric: (s) => s.state.bestAltitude },
      { id: "ch3-dist", label: "Fly 10,000 m lifetime", target: 10_000, metric: (s) => s.state.lifetime.distance },
      { id: "ch3-skin", label: "Own 3 bird skins", target: 3, metric: (s) => s.state.ownedSkins.length },
    ],
    rewardCoins: 120,
    rewardLabel: "Reef charts",
  },
  {
    id: "ch4",
    title: "Race the Flock",
    story: "Forty wings, one gate. Draft, dive, and remember: the photo finish flatters no one.",
    icon: "🏁",
    goals: [
      { id: "ch4-race", label: "Fly 5 mass races", target: 5, metric: (s) => s.state.racesRun },
      { id: "ch4-place", label: "Finish top 10 in a race", target: 1, metric: (s) => (s.state.bestPlace > 0 && s.state.bestPlace <= 10 ? 1 : 0) },
      { id: "ch4-combo", label: "Chain a 3x launch combo", target: 3, metric: (s) => s.state.bestCombo },
    ],
    rewardCoins: 160,
    rewardLabel: "Flock feathers",
  },
  {
    id: "ch5",
    title: "Night over Midnight Coast",
    story: "The moon keeps score too. Glowing coins, quiet ocean, zero refunds on splashdowns.",
    icon: "🌙",
    goals: [
      { id: "ch5-zen", label: "Hit 10 zeniths lifetime", target: 10, metric: (s) => s.state.lifetime.zeniths },
      { id: "ch5-biome", label: "Visit 5 biomes", target: 5, metric: (s) => s.state.biomesSeen.length },
      { id: "ch5-best", label: "Fly 4,000 m in one run", target: 4000, metric: (s) => s.state.bestDistance },
    ],
    rewardCoins: 200,
    rewardLabel: "Moonlit compass",
  },
  {
    id: "ch6",
    title: "The Cinder Gauntlet",
    story: "Ash in the air, springs in the slopes. The forge respects only momentum.",
    icon: "🌋",
    goals: [
      { id: "ch6-duel", label: "Win 2 ranked duels", target: 2, metric: (s) => s.state.duel.wins },
      { id: "ch6-daily", label: "Complete 3 daily challenges", target: 3, metric: (s) => s.state.challenges.dailiesDone },
      { id: "ch6-alt", label: "Reach 150 m altitude", target: 150, metric: (s) => s.state.bestAltitude },
    ],
    rewardCoins: 260,
    rewardLabel: "Forge-tempered wings",
  },
  {
    id: "ch7",
    title: "Skyreach",
    story: "Canyon walls like cathedral doors. Ramps the size of legends. Send it.",
    icon: "🏜",
    goals: [
      { id: "ch7-ghost", label: "Beat your ghost 3 times", target: 3, metric: (s) => s.state.lifetime.ghostBeats },
      { id: "ch7-dist", label: "Fly 50,000 m lifetime", target: 50_000, metric: (s) => s.state.lifetime.distance },
      { id: "ch7-isl", label: "Reach island 8", target: 8, metric: (s) => s.state.farthestIsland + 1 },
    ],
    rewardCoins: 340,
    rewardLabel: "Canyon key",
  },
  {
    id: "ch8",
    title: "The Sun Itself",
    story: "There is no finish line. There is only how gloriously you chase it.",
    icon: "☀",
    goals: [
      { id: "ch8-gaunt", label: "Clear a weekly gauntlet", target: 1, metric: (s) => s.state.challenges.gauntletsCleared },
      { id: "ch8-coin", label: "Earn 2,000 coins lifetime", target: 2000, metric: (s) => s.state.lifetime.coins },
      { id: "ch8-best", label: "Fly 8,000 m in one run", target: 8000, metric: (s) => s.state.bestDistance },
    ],
    rewardCoins: 500,
    rewardLabel: "Legend of the Migration",
  },
];

export type CampaignChapterView = {
  def: CampaignChapter;
  index: number;
  unlocked: boolean;
  complete: boolean;
  claimed: boolean;
  goals: { def: CampaignGoal; progress: number; done: boolean }[];
};

export function campaignViews(save: SaveData, claimed: string[]): CampaignChapterView[] {
  const views: CampaignChapterView[] = [];
  let prevComplete = true; // chapter 1 always unlocked
  for (let i = 0; i < CAMPAIGN.length; i++) {
    const def = CAMPAIGN[i]!;
    const goals = def.goals.map((g) => {
      const progress = Math.min(g.target, g.metric(save));
      return { def: g, progress, done: progress >= g.target };
    });
    const complete = goals.every((g) => g.done);
    views.push({
      def,
      index: i,
      unlocked: prevComplete,
      complete,
      claimed: claimed.includes(def.id),
      goals,
    });
    prevComplete = complete;
  }
  return views;
}

/** Total chapters claimed → campaign completion for profile display. */
export function campaignProgress(claimed: string[]): { done: number; total: number } {
  return { done: claimed.filter((id) => CAMPAIGN.some((c) => c.id === id)).length, total: CAMPAIGN.length };
}
