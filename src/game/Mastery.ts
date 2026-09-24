import { MODES } from "./Modes";
import type { SaveData } from "./SaveData";

/**
 * Per-mode mastery: every run in a mode banks progress toward five mastery
 * levels. Levels pay coins immediately AND grant a permanent in-mode perk —
 * +2% coins per level — capped by a named signature skill at level 5.
 * Nothing is decorative, and nothing needs a server.
 */

export const MASTERY_LEVELS = [3, 10, 25, 50, 100];
export const MASTERY_REWARDS = [40, 80, 150, 250, 400];

/** Coin bonus per mastery level while flying that mode (levels 1-4). */
export const MASTERY_COIN_PER_LEVEL = 0.02;

/** Signature skill unlocked at mastery level 5, unique per mode. */
export type MasterySkill = {
  name: string;
  desc: string;
  /** extra coin multiplier at max level (replaces the per-level bonus) */
  coinMult: number;
  /** flat daylight seconds added in this mode */
  daylightBonus: number;
  /** flat fever seconds added in this mode */
  feverBonus: number;
  /** glide lift multiplier in this mode */
  liftMult: number;
};

export const MASTERY_SKILLS: Record<string, MasterySkill> = {
  daytrip: { name: "Sunchaser", desc: "+6 s daylight · +10% coins", coinMult: 1.1, daylightBonus: 6, feverBonus: 0, liftMult: 1 },
  race: { name: "Slipstreamer", desc: "+3% glide lift · +10% coins", coinMult: 1.1, daylightBonus: 0, feverBonus: 0, liftMult: 1.03 },
  zenith: { name: "Skybreaker", desc: "+2 s fever · +10% coins", coinMult: 1.1, daylightBonus: 0, feverBonus: 2, liftMult: 1 },
  distance: { name: "Marathoner", desc: "+2% glide lift · +4 s daylight", coinMult: 1.08, daylightBonus: 4, feverBonus: 0, liftMult: 1.02 },
  coinrush: { name: "Goldfeather", desc: "+18% coins", coinMult: 1.18, daylightBonus: 0, feverBonus: 0, liftMult: 1 },
  perfect: { name: "Purist", desc: "+3 s fever · +8% coins", coinMult: 1.08, daylightBonus: 0, feverBonus: 3, liftMult: 1 },
  endless: { name: "Wanderer", desc: "+6 s daylight · +8% coins", coinMult: 1.08, daylightBonus: 6, feverBonus: 0, liftMult: 1 },
  massrace: { name: "Flockleader", desc: "+2% glide lift · +10% coins", coinMult: 1.1, daylightBonus: 0, feverBonus: 0, liftMult: 1.02 },
};

/** Aggregated mastery perks for one mode at the player's current level. */
export type MasteryPerks = {
  level: number;
  coinMult: number;
  daylightBonus: number;
  feverBonus: number;
  liftMult: number;
  /** Signature skill name when maxed, else "". */
  skillName: string;
};

export const NO_MASTERY_PERKS: MasteryPerks = { level: 0, coinMult: 1, daylightBonus: 0, feverBonus: 0, liftMult: 1, skillName: "" };

export function masteryPerks(save: SaveData, modeId: string): MasteryPerks {
  const level = masteryLevel(save.state.mastery[modeId] ?? 0);
  if (level <= 0) return NO_MASTERY_PERKS;
  const maxed = level >= MASTERY_LEVELS.length;
  const skill = MASTERY_SKILLS[modeId];
  if (maxed && skill) {
    return {
      level,
      coinMult: skill.coinMult,
      daylightBonus: skill.daylightBonus,
      feverBonus: skill.feverBonus,
      liftMult: skill.liftMult,
      skillName: skill.name,
    };
  }
  return { level, coinMult: 1 + level * MASTERY_COIN_PER_LEVEL, daylightBonus: 0, feverBonus: 0, liftMult: 1, skillName: "" };
}

export type MasteryView = {
  modeId: string;
  name: string;
  icon: string;
  runs: number;
  level: number;
  nextAt: number | null;
  progress: number;
  /** Current perk line ("+4% coins" / signature skill) for the mastery list. */
  perk: string;
  /** The level-5 signature skill this mode is building toward. */
  skillName: string;
  skillDesc: string;
  maxed: boolean;
};

export function masteryLevel(runs: number): number {
  let lvl = 0;
  for (const need of MASTERY_LEVELS) if (runs >= need) lvl++;
  return lvl;
}

export function masteryViews(save: SaveData): MasteryView[] {
  return MODES.map((m) => {
    const runs = save.state.mastery[m.id] ?? 0;
    const level = masteryLevel(runs);
    const nextAt = level < MASTERY_LEVELS.length ? MASTERY_LEVELS[level]! : null;
    const prevAt = level > 0 ? MASTERY_LEVELS[level - 1]! : 0;
    const progress = nextAt ? Math.min(1, (runs - prevAt) / (nextAt - prevAt)) : 1;
    const skill = MASTERY_SKILLS[m.id];
    const maxed = level >= MASTERY_LEVELS.length;
    const perk = maxed && skill ? `★ ${skill.name} — ${skill.desc}` : level > 0 ? `+${level * 2}% coins in this mode` : "";
    return {
      modeId: m.id,
      name: m.name,
      icon: m.icon,
      runs,
      level,
      nextAt,
      progress,
      perk,
      skillName: skill?.name ?? "",
      skillDesc: skill?.desc ?? "",
      maxed,
    };
  });
}

/** Called after a run: banks the run, returns a reward if a level was crossed. */
export function bankMasteryRun(save: SaveData, modeId: string): { level: number; coins: number; skill: MasterySkill | null } | null {
  const before = masteryLevel(save.state.mastery[modeId] ?? 0);
  const runs = save.addMasteryRun(modeId);
  const after = masteryLevel(runs);
  if (after <= before) return null;
  const coins = MASTERY_REWARDS[after - 1] ?? 100;
  save.addCoins(coins);
  const skill = after >= MASTERY_LEVELS.length ? (MASTERY_SKILLS[modeId] ?? null) : null;
  return { level: after, coins, skill };
}
