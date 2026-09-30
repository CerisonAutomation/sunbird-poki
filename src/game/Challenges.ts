import { SeededRandom } from "./math";
import { iconGlyph } from "./MenuIcons";
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
  { id: "pure_sky",    label: "Pure Sky",    desc: "Power-ups are inert. Skill only.", icon: "bird"     },
  { id: "short_day",  label: "Short Day",   desc: "Only 65% of the usual daylight.", icon: "half_day"  },
  { id: "heavy_wings",label: "Heavy Wings", desc: "Top speed cut by 5%.",            icon: "weight"    },
  { id: "gold_rush",  label: "Gold Rush",   desc: "Every coin counts double.",        icon: "coin"      },
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
  { mode: "daytrip", metric: "zenith", base: 1, spread: 2, title: "Skyward" },
  { mode: "coinrush", metric: "coins", base: 20, spread: 18, title: "Coin Fever" },
  { mode: "perfect", metric: "perfects", base: 4, spread: 4, title: "Clean Sheets" },
  { mode: "daytrip", metric: "clouds", base: 3, spread: 3, title: "Head in the Clouds" },
];

/**
 * How much each modifier restricts play, scaled into a reward multiplier.
 * `gold_rush` is a buff (double coins), not a handicap, so it stays at the
 * base rate; `pure_sky` (no power-ups at all) is the strictest constraint
 * and pays the most for clearing the challenge under it.
 */
const MODIFIER_REWARD_SCALE: Record<ModifierId, number> = {
  gold_rush: 1,
  heavy_wings: 1.15,
  short_day: 1.3,
  pure_sky: 1.5,
};

const DAILY_BASE_REWARD = 150;

/**
 * Difficulty auto-tuning (Feature: Challenge Difficulty Auto-Tuning): two
 * missed dailies in a row scale the target down to 70% of what it would
 * otherwise be, so a target that has outpaced this player's skill twice gets
 * easier instead of teaching them to quit. Below two failures the target is
 * untouched — this only kicks in once a miss looks like a pattern, not bad
 * luck. Pure, so the same scaled target is what the player is shown AND what
 * their run is checked against (see `dailyChallenge`'s `failures` param).
 */
export function scaleTargetForFailures(target: number, failures: number): number {
  return failures >= 2 ? Math.max(1, Math.ceil(target * 0.7)) : target;
}

/**
 * @param failures consecutive missed-daily days going into today (0 when the
 * caller doesn't track it, or hasn't failed) — `SaveData.state.challenges
 * .dailyChallengeFailures`, updated once per day by
 * `SaveData.noteDailyChallengeRollover`. Scales `target` only; the mode and
 * modifier stay whatever the date's seed picked, so difficulty tuning never
 * changes what a player is asked to do — only how far.
 */
export function dailyChallenge(date: string, failures = 0): DailyChallenge {
  const rng = new SeededRandom(`daily:${date}`);
  const t = DAILY_TEMPLATES[Math.floor(rng.next() * DAILY_TEMPLATES.length)]!;
  const modifier = MODIFIERS[Math.floor(rng.next() * MODIFIERS.length)]!;
  const target = Math.round(t.base + rng.next() * t.spread);
  return {
    date,
    mode: t.mode,
    modifier,
    metric: t.metric,
    target: scaleTargetForFailures(Math.max(1, target), failures),
    reward: Math.round((DAILY_BASE_REWARD * MODIFIER_REWARD_SCALE[modifier.id]) / 5) * 5,
    title: t.title,
  };
}

export function dailyDone(stats: RunStats, c: DailyChallenge): boolean {
  return (stats[c.metric] ?? 0) >= c.target;
}

/* ------------------------------------------------- the mode a challenge needs */

/**
 * The mode a challenge run has to be flown in.
 *
 * The mode is a property of the CHALLENGE, never of the button the player
 * happened to press: a run is only *flagged* as a challenge
 * (`{ challenge: "daily" }`), and that flag reaches `startRun()` from a dozen
 * places — including "Fly again", which rebuilds it from saved run metadata
 * (`Replay.replayOptions`) and used to rebuild the flag without the mode. Any
 * caller that set the flag without re-applying the mode here opened a hole
 * where the reward is claimable in a mode the challenge never asked for.
 *
 * Returns "" when this is not a challenge run, or when the flag names a stage
 * that no longer exists in this week's gauntlet.
 */
export function challengeMode(challenge: string, today: string, week: string): ModeId | "" {
  if (challenge === "daily") return dailyChallenge(today).mode;
  const stage = /^gauntlet(\d+)$/.exec(challenge);
  if (!stage) return "";
  return weeklyGauntlet(week).stages[Number(stage[1])]?.mode ?? "";
}

/**
 * Why a finished run may or may not be claimed. `dailyDone`/`stageDone` only
 * ever compared a metric to a target, which is why the mode used to be
 * enforced in exactly one place (the journey card's click handler) and nowhere
 * else.
 *
 * The mode gate is checked FIRST and on its own: a run flown in the wrong mode
 * did not do the challenge, so whether it also cleared the target is beside
 * the point — and reporting "missed" for it would describe a run the player
 * never actually attempted.
 */
export type ChallengeVerdict = "claim" | "missed" | "wrong-mode";

export function dailyVerdict(stats: RunStats, c: DailyChallenge, runMode: string): ChallengeVerdict {
  if (runMode !== c.mode) return "wrong-mode";
  return dailyDone(stats, c) ? "claim" : "missed";
}

export function stageVerdict(stats: RunStats, s: GauntletStage, runMode: string): ChallengeVerdict {
  if (runMode !== s.mode) return "wrong-mode";
  return stageDone(stats, s) ? "claim" : "missed";
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
  { mode: "daytrip", metric: "zenith", base: 1, label: "Skyline hunt" },
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

/**
 * Whether this week's gauntlet is cleared.
 *
 * "Every stage of *this* gauntlet is done" — never "the done array has three
 * entries". The old rule counted the array, so a duplicated or stale stage index
 * (reachable through the unvalidated save parse, where `numArr` lets `[7,8,9]`
 * through) reported a clear that did not happen, and the HUD renders this flag
 * as "Gauntlet cleared this week · +N paid" while the payout counter increments
 * on top of it. It was found while writing tests over `Cards.buildGauntletCard`
 * and fixed only in that copy; the live call sites kept the wrong rule. This is
 * the one rule both call sites now share, so it cannot drift again.
 *
 * @param week       the week key the done list belongs to.
 * @param doneStages stage indices already cleared, as saved.
 */
export function gauntletCleared(week: string, doneStages: readonly number[]): boolean {
  const stages = weeklyGauntlet(week).stages;
  if (!stages.length) return false;
  const done = new Set(doneStages);
  return stages.every((st) => done.has(st.index));
}

export function stageDone(stats: RunStats, s: GauntletStage): boolean {  return (stats[s.metric] ?? 0) >= s.target;
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
  if (r.kind === "boost") return r.id === "headstart" ? `${iconGlyph("rocket")} boost` : `${iconGlyph("sun")} boost`;
  return `${iconGlyph("star")} trail`;
}
