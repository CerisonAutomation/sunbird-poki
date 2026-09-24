import { SeededRandom } from "./math";
import type { SaveData } from "./SaveData";

export type StatKey =
  | "clouds"
  | "island"
  | "coins"
  | "perfects"
  | "distance"
  | "fever"
  | "zenith"
  | "pickups";

export type RunStats = Record<StatKey, number>;

export type MissionDef = {
  id: string;
  title: string;
  desc: string;
  target: number;
  kind: StatKey;
};

export const MISSION_DEFS: MissionDef[] = [
  { id: "clouds5", title: "Sky Tickles", desc: "Touch 5 clouds in one run", target: 5, kind: "clouds" },
  { id: "island3", title: "Archipelago", desc: "Reach island 3", target: 3, kind: "island" },
  { id: "coins25", title: "Gold Rush", desc: "Collect 25 coins in one run", target: 25, kind: "coins" },
  { id: "perfects5", title: "Slide Poet", desc: "Land 5 perfect slides in one run", target: 5, kind: "perfects" },
  { id: "fever1", title: "Catch Fire", desc: "Enter fever mode", target: 1, kind: "fever" },
  { id: "zenith3", title: "Skyline Chaser", desc: "Hit 3 skyline moments in one run", target: 3, kind: "zenith" },
  { id: "distance2k", title: "Marathon Glide", desc: "Travel 2,000 m in one run", target: 2000, kind: "distance" },
  { id: "pickups6", title: "Forager", desc: "Grab 6 power-ups in one run", target: 6, kind: "pickups" },
  { id: "island5", title: "Far Horizon", desc: "Reach island 5", target: 5, kind: "island" },
  { id: "distance5k", title: "Sun Runner", desc: "Travel 5,000 m in one run", target: 5000, kind: "distance" },
];

export type MissionView = {
  def: MissionDef;
  progress: number;
  done: boolean;
  completedBefore: boolean;
};

export type QuestDef = {
  id: string;
  kind: StatKey;
  target: number;
  reward: number;
  /** Full sentence, for the menu list. */
  label: string;
  /** Two words, for the strip that flies with you. */
  title: string;
};

const QUEST_POOL: Omit<QuestDef, "id">[] = [
  { kind: "coins", target: 15, reward: 60, label: "Collect 15 coins in a run", title: "Coin Snapper" },
  { kind: "coins", target: 30, reward: 120, label: "Collect 30 coins in a run", title: "Gold Rush" },
  { kind: "clouds", target: 2, reward: 80, label: "Touch 2 clouds in a run", title: "Cloud Kiss" },
  { kind: "clouds", target: 4, reward: 150, label: "Touch 4 clouds in a run", title: "Sky Tickles" },
  { kind: "perfects", target: 3, reward: 80, label: "Land 3 perfect slides", title: "Silk Landing" },
  { kind: "perfects", target: 6, reward: 160, label: "Land 6 perfect slides", title: "Slide Poet" },
  { kind: "distance", target: 800, reward: 60, label: "Fly 800 m in a run", title: "Long Glide" },
  { kind: "distance", target: 1500, reward: 120, label: "Fly 1,500 m in a run", title: "Marathon" },
  { kind: "island", target: 2, reward: 100, label: "Reach island 2", title: "Island Hop" },
  { kind: "island", target: 3, reward: 200, label: "Reach island 3", title: "Archipelago" },
  { kind: "zenith", target: 1, reward: 80, label: "Hit a skyline moment", title: "Skyline Touch" },
  { kind: "zenith", target: 3, reward: 170, label: "Hit 3 skyline moments", title: "Skyline Chaser" },
  { kind: "fever", target: 1, reward: 100, label: "Enter fever mode", title: "Catch Fire" },
  { kind: "pickups", target: 3, reward: 90, label: "Grab 3 power-ups", title: "Forager" },
];

export type QuestView = {
  def: QuestDef;
  progress: number;
  done: boolean;
  claimed: boolean;
};

export type QuestReward = { id: string; reward: number; label: string };

export class Missions {
  private questCache = new Map<string, QuestDef[]>();

  constructor(private save: SaveData) {}

  view(stats: RunStats | null): MissionView[] {
    const completed = new Set(this.save.state.completedMissions);
    return MISSION_DEFS.map((def) => {
      const completedBefore = completed.has(def.id);
      const current = stats ? stats[def.kind] : 0;
      const progress = completedBefore ? def.target : Math.min(def.target, current);
      return { def, progress, done: completedBefore || progress >= def.target, completedBefore };
    });
  }

  applyRun(stats: RunStats): string[] {
    const newly: string[] = [];
    for (const def of MISSION_DEFS) {
      if (stats[def.kind] >= def.target && this.save.completeMission(def.id)) newly.push(def.id);
    }
    return newly;
  }

  /** VIP members receive a fourth (bonus) quest every day. */
  dailyQuests(date: string): QuestDef[] {
    const want = this.save.isVipActive() ? 4 : 3;
    const key = `${date}:${want}`;
    const cached = this.questCache.get(key);
    if (cached) return cached;
    const rng = new SeededRandom(`${date}:quests`);
    const picked: QuestDef[] = [];
    const kinds = new Set<StatKey>();
    let guard = 0;
    while (picked.length < want && guard++ < 80) {
      const q = QUEST_POOL[rng.int(0, QUEST_POOL.length)]!;
      if (kinds.has(q.kind)) continue;
      kinds.add(q.kind);
      picked.push({ ...q, id: `${date}:${q.kind}:${q.target}`, reward: picked.length === 3 ? Math.round(q.reward * 1.5) : q.reward });
    }
    this.questCache.set(key, picked);
    return picked;
  }

  questView(date: string, stats: RunStats | null): QuestView[] {
    const claimed = this.save.questsClaimed(date);
    return this.dailyQuests(date).map((def) => {
      const isClaimed = claimed.includes(def.id);
      const progress = isClaimed ? def.target : Math.min(def.target, stats ? stats[def.kind] : 0);
      return { def, progress, done: isClaimed || progress >= def.target, claimed: isClaimed };
    });
  }

  claimQuests(date: string, stats: RunStats): QuestReward[] {
    const out: QuestReward[] = [];
    const claimed = this.save.questsClaimed(date);
    for (const def of this.dailyQuests(date)) {
      if (stats[def.kind] >= def.target && !claimed.includes(def.id)) {
        this.save.claimQuest(date, def.id);
        this.save.addCoins(def.reward);
        out.push({ id: def.id, reward: def.reward, label: def.label });
      }
    }
    return out;
  }
}

/* ------------------------------------------------------------------ in flight */

/**
 * One line of the mission strip that flies with the player.
 *
 * This is the piece the game was missing. `dailyQuests()` has always been a
 * three-mission system in the Jetpack Joyride sense — seeded per day, distinct
 * stat kinds, coin rewards — but it was evaluated from *finished* run stats and
 * rendered in a menu, so the player never saw a mission fill, never got the hit
 * mid-flight, and never saw the reason to fly once more. Progression that is
 * invisible during play does not feel like progression, however real it is.
 */
export type MissionRow = {
  id: string;
  /** Two-word title, sized for a strip on a phone. */
  title: string;
  progress: number;
  target: number;
  /** 0..1 — the bar fill, already clamped. */
  pct: number;
  done: boolean;
  /** Coins paid when the run lands. */
  reward: number;
  /** True only on the frame the row crossed the line, so juice fires once. */
  justDone: boolean;
};

/**
 * Pure: today's quest defs + a *possibly partial* run stat block → strip rows.
 *
 * `stats` is the same `RunStats` shape the run-end claim uses, so passing the
 * live counters costs nothing and needs no second source of truth. `claimed`
 * pins rows already banked today, so a finished quest cannot un-fill on the next
 * run of the same day.
 */
export function missionRows(
  defs: QuestDef[],
  stats: RunStats | null,
  claimed: readonly string[] = [],
  justDone: readonly string[] = [],
): MissionRow[] {
  const banked = new Set(claimed);
  const crossed = new Set(justDone);
  return defs.map((def) => {
    const live = stats ? stats[def.kind] : 0;
    const isClaimed = banked.has(def.id);
    const progress = isClaimed ? def.target : Math.max(0, Math.min(def.target, Math.round(live)));
    const done = isClaimed || progress >= def.target;
    return {
      id: def.id,
      title: def.title,
      progress,
      target: def.target,
      pct: def.target > 0 ? Math.max(0, Math.min(1, progress / def.target)) : 1,
      done,
      reward: def.reward,
      justDone: crossed.has(def.id) && !isClaimed,
    };
  });
}

/**
 * The rows that crossed the line between two frames — the mid-run moment.
 * Diffing two snapshots keeps the caller honest: a row fires once, on the frame
 * it completed, and never again for the rest of the run.
 */
export function newlyDone(prev: MissionRow[], next: MissionRow[]): MissionRow[] {
  const wasDone = new Set(prev.filter((r) => r.done).map((r) => r.id));
  return next.filter((r) => r.done && !wasDone.has(r.id));
}

/**
 * The goal-gradient line: the single nearest thing the player is about to get.
 *
 * Effort rises as the gap to a goal shrinks, and a bar that is 80 % full is
 * worth more motivation than one that is 20 % full — so the strip's footer names
 * the closest unfinished mission and its exact gap, and says nothing at all when
 * nothing is close. Returning `null` is a feature: a permanent "you are 3 % of
 * the way there" nag teaches the player to ignore the strip.
 */
export function closestGoalLine(rows: MissionRow[], minPct = 0.5): string | null {
  const open = rows.filter((r) => !r.done && r.pct >= minPct);
  if (!open.length) return null;
  const best = open.reduce((a, b) => (b.pct > a.pct ? b : a));
  const gap = Math.max(1, best.target - best.progress);
  return `${gap} to go · ${best.title} · +${best.reward}`;
}

/**
 * What the results card ends with. One action, never a list: nine ladders is why
 * progression stopped reading as progression, and "here are eight things you
 * could do next" is the same problem wearing a card.
 */
export function nextActionLine(rows: MissionRow[], bestDistance: number): string {
  const done = rows.filter((r) => r.done).length;
  if (done === rows.length && rows.length > 0) {
    return `Every mission banked · ${Math.round(bestDistance)} m flown — new quests land tomorrow`;
  }
  const open = rows.filter((r) => !r.done).sort((a, b) => b.pct - a.pct)[0];
  if (!open) return `Fly again — ${Math.round(bestDistance)} m is the mark to beat`;
  const gap = Math.max(1, open.target - open.progress);
  if (open.pct >= 0.75) return `${gap} short of ${open.title} · +${open.reward} coins — one more flight`;
  return `Next: ${open.title} — ${gap} to go for +${open.reward} coins`;
}
