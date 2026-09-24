import { SeededRandom } from "./math";
import type { ModeId } from "./Modes";
import type { RunStats, StatKey } from "./Missions";

/**
 * Daily Challenge, Weekly Gauntlet and the 28-day Login Calendar.
 *
 * Everything is deterministic from the date / ISO week, so every player on
 * the same day faces the same challenge on the same hills — a shared daily
 * ritual that needs no server, in the same spirit as the daily seed.
 */

/* ------------------------------------------------------------ modifiers */

export type ModifierId = "pure_sky" | "short_day" | "heavy_wings" | "gold_rush";

export type Modifier = {
  id: ModifierId;
  label: string;
  desc: string;
  icon: string;
};

export const MODIFIERS: Modifier[] = [
  { id: "pure_sky", label: "Pure Sky", desc: "Power-ups are inert. Skill only.", icon: "🕊" },
  { id: "short_day", label: "Short Day", desc: "Only 65% of the usual daylight.", icon: "🌗" },
  { id: "heavy_wings", label: "Heavy Wings", desc: "Top speed cut by 5%.", icon: "⛰️" },
  { id: "gold_rush", label: "Gold Rush", desc: "Every coin counts double.", icon: "💰" },
];

export type ChallengeMods = {
  daylightMult: number;
  coinMult: number;
  speedMult: number;
  noPowerups: boolean;
};

export function modsFor(id: ModifierId): ChallengeMods {
  return {
    daylightMult: id === "short_day" ? 0.65 : 1,
    coinMult: id === "gold_rush" ? 2 : 1,
    speedMult: id === "heavy_wings" ? 0.95 : 1,
    noPowerups: id === "pure_sky",
  };
}

export const NO_MODS: ChallengeMods = { daylightMult: 1, coinMult: 1, speedMult: 1, noPowerups: false };

/* ------------------------------------------------------- daily challenge */

/** Metrics a challenge can score by — all present in RunStats. */
export type ChallengeMetric = Extract<StatKey, "distance" | "coins" | "perfects" | "zenith" | "clouds">;

export type DailyChallenge = {
  date: string;
  mode: ModeId;
  modifier: Modifier;
  metric: ChallengeMetric;
  target: number;
  reward: number;
  title: string;
};

const DAILY_TEMPLATES: { mode: ModeId; metric: ChallengeMetric; base: number; spread: number; title: string }[] = [
  { mode: "daytrip", metric: "distance", base: 900, spread: 700, title: "Long Light" },
  { mode: "distance", metric: "distance", base: 1100, spread: 900, title: "Far Shore" },
  { mode: "zenith", metric: "zenith", base: 1, spread: 2, title: "Skyward" },
  { mode: "coinrush", metric: "coins", base: 20, spread: 18, title: "Coin Fever" },
  { mode: "perfect", metric: "perfects", base: 4, spread: 4, title: "Clean Sheets" },
  { mode: "daytrip", metric: "clouds", base: 3, spread: 3, title: "Head in the Clouds" },
];

export function dailyChallenge(date: string): DailyChallenge {
  const rng = new SeededRandom(`daily:${date}`);
  const t = DAILY_TEMPLATES[Math.floor(rng.next() * DAILY_TEMPLATES.length)]!;
  const modifier = MODIFIERS[Math.floor(rng.next() * MODIFIERS.length)]!;
  const target = Math.round(t.base + rng.next() * t.spread);
  return {
    date,
    mode: t.mode,
    modifier,
    metric: t.metric,
    target: Math.max(1, target),
    reward: 150,
    title: t.title,
  };
}

export function dailyDone(stats: RunStats, c: DailyChallenge): boolean {
  return (stats[c.metric] ?? 0) >= c.target;
}

/* ------------------------------------------------------- weekly gauntlet */

export type GauntletStage = {
  index: number;
  mode: ModeId;
  metric: ChallengeMetric;
  target: number;
  reward: number;
  label: string;
};

export type Gauntlet = {
  week: string;
  stages: GauntletStage[];
  /** paid once when all three stages clear in the same week */
  clearBonus: number;
};

const GAUNTLET_POOL: { mode: ModeId; metric: ChallengeMetric; base: number; label: string }[] = [
  { mode: "distance", metric: "distance", base: 800, label: "Distance run" },
  { mode: "daytrip", metric: "coins", base: 14, label: "Coin sweep" },
  { mode: "perfect", metric: "perfects", base: 3, label: "Perfect chain" },
  { mode: "zenith", metric: "zenith", base: 1, label: "Skyline hunt" },
  { mode: "coinrush", metric: "coins", base: 18, label: "Rush hour" },
];

/** Three stages, difficulty ×1 → ×1.6 → ×2.4, deterministic per ISO week. */
export function weeklyGauntlet(week: string): Gauntlet {
  const rng = new SeededRandom(`gauntlet:${week}`);
  const picks: typeof GAUNTLET_POOL = [];
  const pool = [...GAUNTLET_POOL];
  while (picks.length < 3 && pool.length) {
    picks.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]!);
  }
  const mult = [1, 1.6, 2.4];
  const rewards = [80, 140, 260];
  return {
    week,
    stages: picks.map((p, i) => ({
      index: i,
      mode: p.mode,
      metric: p.metric,
      target: Math.max(1, Math.round(p.base * mult[i]!)),
      reward: rewards[i]!,
      label: p.label,
    })),
    clearBonus: 300,
  };
}

export function stageDone(stats: RunStats, s: GauntletStage): boolean {
  return (stats[s.metric] ?? 0) >= s.target;
}

/* --------------------------------------------------------- login calendar */

export type CalendarReward =
  | { kind: "coins"; amount: number }
  | { kind: "boost"; id: string }
  | { kind: "trail"; id: string };

export const CALENDAR_DAYS = 28;

/** Escalating 28-day cycle. Milestones at 7 / 14 / 21 / 28. */
export function calendarReward(day: number): CalendarReward {
  const d = ((Math.max(1, Math.floor(day)) - 1) % CALENDAR_DAYS) + 1;
  if (d === 28) return { kind: "trail", id: "trail_star" };
  if (d === 21) return { kind: "boost", id: "headstart" };
  if (d === 14) return { kind: "coins", amount: 300 };
  if (d === 7) return { kind: "boost", id: "sunflask" };
  return { kind: "coins", amount: 20 + d * 5 };
}

export function calendarRewardLabel(day: number): string {
  const r = calendarReward(day);
  if (r.kind === "coins") return `● ${r.amount}`;
  if (r.kind === "boost") return r.id === "headstart" ? "🚀 boost" : "☀ boost";
  return "✨ trail";
}
