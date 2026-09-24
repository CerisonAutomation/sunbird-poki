import { clamp, lerp, SeededRandom } from "./math";
import type { SaveData } from "./SaveData";

/* ============================================================ flow tuning */

/**
 * Keeps challenge tracking skill (Csikszentmihalyi's flow band).
 *
 * Rather than a fixed difficulty curve, we hold a rolling estimate of how well
 * this particular player flies and nudge terrain scale toward the edge of their
 * ability: bored players get punchier hills, struggling players get gentler
 * ones. The adjustment is deliberately slow and tightly clamped so the world
 * never feels like it is playing itself.
 */
export class FlowTuner {
  /** 0 = brand new, 1 = expert. Persisted across sessions. */
  skill = 0.25;
  private samples = 0;

  load(save: SaveData): void {
    this.skill = clamp(save.state.skill ?? 0.25, 0, 1);
    this.samples = save.state.skillSamples ?? 0;
  }

  /** Rate a finished run and fold it into the estimate. */
  noteRun(distance: number, perfects: number, launches: number, save: SaveData): void {
    // Three independent signals, each saturating so one lucky run can't spike it.
    const fDist = clamp(distance / 2600, 0, 1);
    const fRate = launches > 0 ? clamp(perfects / Math.max(3, launches), 0, 1) : 0;
    const fVol = clamp(launches / 22, 0, 1);
    const observed = fDist * 0.45 + fRate * 0.35 + fVol * 0.2;

    // Early runs move the estimate faster so new players calibrate quickly.
    this.samples += 1;
    const rate = this.samples < 5 ? 0.34 : 0.12;
    this.skill = clamp(lerp(this.skill, observed, rate), 0, 1);
    save.state.skill = this.skill;
    save.state.skillSamples = this.samples;
    save.persist();
  }

  /**
   * Terrain scale multiplier. Beginners get slightly longer, gentler arches;
   * experts get tighter, steeper ones that demand real timing.
   */
  difficulty(): number {
    return lerp(0.86, 1.16, this.skill);
  }

  label(): string {
    if (this.skill < 0.2) return "Fledgling";
    if (this.skill < 0.4) return "Glider";
    if (this.skill < 0.6) return "Skyrider";
    if (this.skill < 0.8) return "Windmaster";
    return "Sunbird";
  }
}

/* ========================================================== session goals */

export type GoalKind = "distance" | "perfects" | "combo" | "altitude" | "coins" | "clouds" | "gems" | "sunflowers";

export type SessionGoal = {
  id: string;
  kind: GoalKind;
  target: number;
  label: string;
  reward: number;
  progress: number;
  done: boolean;
};

export type GoalProgress = Record<GoalKind, number>;

const GOAL_SHAPES: { kind: GoalKind; base: number; scale: number; word: (n: number) => string }[] = [
  { kind: "distance", base: 700, scale: 1400, word: (n) => `Fly ${Math.round(n)} m in one run` },
  { kind: "perfects", base: 2, scale: 6, word: (n) => `Land ${n} perfect launches` },
  { kind: "combo", base: 2, scale: 4, word: (n) => `Reach a ×${n} launch chain` },
  { kind: "altitude", base: 45, scale: 130, word: (n) => `Climb to ${Math.round(n)} m altitude` },
  { kind: "coins", base: 12, scale: 34, word: (n) => `Collect ${Math.round(n)} coins` },
  { kind: "clouds", base: 2, scale: 6, word: (n) => `Touch ${n} clouds` },
  { kind: "gems", base: 1, scale: 3, word: (n) => `Grab ${n} sky gems` },
  { kind: "sunflowers", base: 2, scale: 6, word: (n) => `Bounce off ${n} sunflowers` },
];

/**
 * Starter targets for a player with no measured history.
 *
 * The audit's number, not a vibe: the first reward has to land inside roughly
 * 30 seconds or the first session ends before the loop ever pays out. A fresh
 * player flies a few hundred metres and collects a handful of coins in that
 * time, so the skill-scaled table above (which starts at ~1,400 m even at the
 * default skill estimate) is the wrong table for them. These are winnable on
 * the very first flight, and `SessionGoals` stops using them as soon as the
 * player has real history.
 */
const STARTER_TARGETS: { kind: GoalKind; target: number }[] = [
  { kind: "distance", target: 250 },
  { kind: "perfects", target: 1 },
  { kind: "combo", target: 2 },
  { kind: "altitude", target: 40 },
  { kind: "coins", target: 6 },
  { kind: "clouds", target: 2 },
  { kind: "gems", target: 1 },
  { kind: "sunflowers", target: 1 },
];

/**
 * A rolling set of three short goals.
 *
 * The Zeigarnik effect says unfinished tasks stay mentally "open" — so the list
 * is never allowed to empty. The instant one is completed it is replaced, which
 * means the player always leaves a run with something still in progress.
 * Targets scale with measured skill so they sit just past current ability.
 */
export class SessionGoals {
  goals: SessionGoal[] = [];
  private seq = 0;
  /** While true, targets come from `STARTER_TARGETS` instead of the skill curve. */
  private starter = false;

  constructor(private readonly tuner: FlowTuner) {}

  /**
   * @param opts.starter first-session mode: small, winnable targets so the
   * first reward lands inside the first 30 seconds of play.
   */
  reset(seed: string, opts: { starter?: boolean } = {}): void {
    this.seq = 0;
    this.starter = Boolean(opts.starter);
    this.goals = [];
    const rng = new SeededRandom(`${seed}:goals`);
    const used = new Set<GoalKind>();
    while (this.goals.length < 3) this.goals.push(this.make(rng, used));
  }

  private make(rng: SeededRandom, used: Set<GoalKind>): SessionGoal {
    let shape = GOAL_SHAPES[rng.int(0, GOAL_SHAPES.length)]!;
    let guard = 0;
    while (used.has(shape.kind) && guard++ < 24) shape = GOAL_SHAPES[rng.int(0, GOAL_SHAPES.length)]!;
    used.add(shape.kind);
    // First sessions get the starter table: same kinds, same words, targets a
    // brand-new player can actually reach on the flight they are on right now.
    const starterTarget = this.starter ? STARTER_TARGETS.find((x) => x.kind === shape.kind)?.target : undefined;
    const s = this.tuner.skill;
    // Target lands a little beyond what this player usually manages.
    const raw = shape.base + shape.scale * (0.35 + s * 0.75) * rng.range(0.85, 1.15);
    const target = starterTarget
      ? starterTarget
      : shape.kind === "distance" || shape.kind === "altitude" || shape.kind === "coins"
        ? Math.round(raw / 5) * 5
        : Math.max(1, Math.round(raw));
    const reward = Math.round(25 + target * (shape.kind === "distance" ? 0.03 : shape.kind === "altitude" ? 0.25 : 8));
    return {
      id: `g${this.seq++}`,
      kind: shape.kind,
      target,
      label: shape.word(target),
      // A first reward that reads "3 coins" teaches nothing; the floor keeps the
      // opening payout worth noticing without inflating the economy later.
      reward: this.starter ? Math.max(40, reward) : reward,
      progress: 0,
      done: false,
    };
  }

  /** @returns goals completed by this update (already replaced in the list). */
  update(p: GoalProgress): SessionGoal[] {
    const finished: SessionGoal[] = [];
    const rng = new SeededRandom(`${Date.now()}:${this.seq}`);
    for (let i = 0; i < this.goals.length; i++) {
      const g = this.goals[i]!;
      if (g.done) continue;
      g.progress = p[g.kind] ?? 0;
      if (g.progress >= g.target) {
        g.done = true;
        finished.push(g);
        // Refill immediately — the list must never be empty.
        const used = new Set(this.goals.map((x) => x.kind));
        used.delete(g.kind);
        this.goals[i] = this.make(rng, used);
      }
    }
    return finished;
  }

  /** The goal closest to completion, for the "almost there" nudge. */
  closest(): SessionGoal | null {
    let best: SessionGoal | null = null;
    let bestFrac = -1;
    for (const g of this.goals) {
      if (g.done) continue;
      const f = g.progress / g.target;
      if (f > bestFrac) {
        bestFrac = f;
        best = g;
      }
    }
    return bestFrac >= 0.55 ? best : null;
  }

  /** Skip a goal for coins (Jetpack Joyride-style): pay to replace with new goal */
  skip(id: string, seed: string): SessionGoal | null {
    const idx = this.goals.findIndex((g) => g.id === id);
    if (idx === -1) return null;
    const old = this.goals[idx]!;
    const rng = new SeededRandom(`${seed}:skip:${id}:${Date.now()}`);
    const used = new Set(this.goals.map((x) => x.kind));
    used.delete(old.kind);
    const replacement = this.make(rng, used);
    this.goals[idx] = replacement;
    return replacement;
  }

  /** Cost to skip a goal — scales with reward */
  skipCost(goal: SessionGoal): number {
    return Math.max(80, Math.round(goal.reward * 1.5));
  }
}

/* ============================================================== near miss */

export type NearMiss = { kind: "distance" | "altitude" | "combo" | "none"; gap: number; text: string };

/**
 * The single most reliable "one more go" trigger in the literature: showing the
 * player how *close* they came. We only fire it when the shortfall is genuinely
 * small, so it reads as honest feedback rather than manufactured tension.
 */
export function evaluateNearMiss(
  distance: number,
  bestDistance: number,
  altitude: number,
  bestAltitude: number,
  combo: number,
  bestCombo: number,
): NearMiss {
  if (bestDistance > 100 && distance < bestDistance) {
    const gap = bestDistance - distance;
    if (gap / bestDistance <= 0.12) return { kind: "distance", gap, text: `${Math.ceil(gap)} m short of your best!` };
  }
  if (bestAltitude > 40 && altitude < bestAltitude) {
    const gap = bestAltitude - altitude;
    if (gap / bestAltitude <= 0.1) return { kind: "altitude", gap, text: `${Math.ceil(gap)} m below your altitude record!` };
  }
  if (bestCombo >= 3 && combo === bestCombo - 1) {
    return { kind: "combo", gap: 1, text: "One launch away from your best chain!" };
  }
  return { kind: "none", gap: 0, text: "" };
}

/* ================================================= adaptive contest feel */

/**
 * Casual-only helping hand / spice. FlowTuner already bends *terrain*;
 * this bends the *feel of the contest* (daylight, pack catch-up, skim
 * forgiveness). Rated / duel / live races always get the identity tune —
 * hidden assistance that touches a ranked outcome is the trust failure
 * this game cannot survive.
 */
export type DifficultySignals = {
  runsPlayed: number;
  skill: number;
  lastDistance: number;
  lastDurationSec: number;
  recentPlaces: number[];
};

export type DifficultyReason = "ease" | "neutral" | "spice";

export type DifficultyTune = {
  daylightMult: number;
  packCatchupMult: number;
  ridgeForgiveness: number;
  magnetBonus: number;
  reason: DifficultyReason;
};

export const IDENTITY_TUNE: DifficultyTune = {
  daylightMult: 1,
  packCatchupMult: 1,
  ridgeForgiveness: 0,
  magnetBonus: 0,
  reason: "neutral",
};

const EASE: DifficultyTune = {
  daylightMult: 0.9,
  packCatchupMult: 1.28,
  ridgeForgiveness: 2.4,
  magnetBonus: 0.18,
  reason: "ease",
};

const SPICE: DifficultyTune = {
  daylightMult: 1.06,
  packCatchupMult: 0.82,
  ridgeForgiveness: 0,
  magnetBonus: 0,
  reason: "spice",
};

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function mixTune(a: DifficultyTune, b: DifficultyTune, t: number): DifficultyTune {
  const k = clamp(t, 0, 1);
  return {
    daylightMult: lerp(a.daylightMult, b.daylightMult, k),
    packCatchupMult: lerp(a.packCatchupMult, b.packCatchupMult, k),
    ridgeForgiveness: lerp(a.ridgeForgiveness, b.ridgeForgiveness, k),
    magnetBonus: lerp(a.magnetBonus, b.magnetBonus, k),
    reason: k <= 0 ? a.reason : b.reason,
  };
}

export function tuneDifficulty(signals: DifficultySignals, rated: boolean): DifficultyTune {
  if (rated) return IDENTITY_TUNE;

  const runs = Math.max(0, Math.floor(Number(signals.runsPlayed) || 0));
  const skill = clamp(Number(signals.skill) || 0, 0, 1);
  const lastDist = Math.max(0, Number(signals.lastDistance) || 0);
  const lastDur = Math.max(0, Number(signals.lastDurationSec) || 0);
  const places = (signals.recentPlaces ?? []).filter((n) => Number.isFinite(n) && n > 0);
  const placeMean = mean(places);

  if (runs < 3) return EASE;

  const velocity = lastDur > 0.5 ? lastDist / lastDur : 0;
  const struggling = skill < 0.32 || lastDist < 400 || (places.length >= 2 && placeMean > 8);
  const bored = skill > 0.74 && lastDist > 1400 && velocity > 18 && (places.length === 0 || placeMean <= 4);

  if (struggling && !bored) {
    const t = clamp(0.45 + (0.32 - skill) * 0.8, 0.35, 1);
    return mixTune(IDENTITY_TUNE, EASE, t);
  }
  if (bored) {
    const t = clamp((skill - 0.74) * 2.2, 0.25, 0.85);
    return mixTune(IDENTITY_TUNE, SPICE, t);
  }
  return IDENTITY_TUNE;
}

/** Pace-ghost skill: slightly above the player, never a humiliation. */
export function paceSkillFor(playerSkill: number): number {
  const s = clamp(Number(playerSkill) || 0, 0, 1);
  return clamp(s * 0.72 + 0.22, 0.22, 0.88);
}
