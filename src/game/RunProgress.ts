/**
 * Run progress — the bridge between a finished run and the results card.
 *
 * `ProgressBeats.ts` decides how loud a run's progress should be, and
 * `GrowthLedger.ts` decides which two ladders the card names. Neither of them
 * can *see* a run. Something has to notice, in the one place where every ladder
 * is first observable, that this flight moved six things at once — and that
 * something used to be missing, which is why the game shipped a results card
 * with a hardcoded `celebration: { staged: [], ledger: [], folded: 0, peak: 0 }`
 * and a `nextAction: ""` that `HUD.ts` then rendered as nothing at all.
 *
 * This module is that "something", with no `this` in it. `Game.finishRun()`
 * passes the facts it just computed; this returns `ProgressEvent[]`. Pure, so
 * the wiring is unit-testable at all — `Game.ts` is a 7,700-line class at 0.52 %
 * statement coverage, and a mapping rule that lives only there is a rule nothing
 * can check. Same seam `Cards.ts` cut and `GrowthLedger.ts`/`Missions.ts` follow.
 *
 * Two rules the shape encodes:
 *
 *  - **One fact, one event.** The card is ranked by rarity, so a ladder that
 *    fires twice in a run (two trophies, a gauntlet clear *and* a stage clear)
 *    contributes its own events and nothing else. Ranking is `planCelebration`'s
 *    job; duplicating or merging is not this module's.
 *  - **A missing fact is a missing beat, never a broken one.** Every field is
 *    optional and every value is validated, because the caller is a god object
 *    and a `NaN` reaching `t()` renders the word "NaN" to a player.
 */
import type { ProgressEvent, Rarity } from "./ProgressBeats";

/** A trophy this run unlocked. Structurally `AchievementDef` minus the metric. */
export type RunTrophy = { id: string; title: string; rarity: Rarity };

/** A career rank-up. Structurally the `WingsTier` that was just promoted into. */
export type RunWings = { tierId: string; icon: string; name: string };

/** A mastery level-up, or the signature skill at max. */
export type RunMastery = {
  icon: string;
  mode: string;
  level: number;
  maxed: boolean;
  /** Signature skill name at max; empty otherwise. */
  skill: string;
  coins: number;
};

/** A live-ops surface this run cleared. `gauntlet` is the whole-week clear. */
export type RunChallenge = {
  variant: "daily" | "gauntlet" | "gauntletStage" | "event";
  icon: string;
  label: string;
  coins: number;
};

export type RunProgressFacts = {
  /** This flight beat the player's own previous best. */
  newBest: boolean;
  /** The frozen results distance, so a `record` beat can name the number. */
  distance: number;
  /** The career rank this run promoted into, or null. */
  wings: RunWings | null;
  trophies: readonly RunTrophy[];
  mastery: RunMastery | null;
  /** The Nest Pass tier this run unlocked, or null. */
  passTier: number | null;
  /** Daily quests banked by this run; only the reward total is spoken. */
  quests: readonly { reward: number }[];
  /** The Nest level this run upgraded to, or null. */
  nest: { level: number; mult: number } | null;
  challenges: readonly RunChallenge[];
};

const finite = (v: number): boolean => Number.isFinite(v);
const coins = (v: number): number => (finite(v) ? Math.max(0, Math.round(v)) : 0);
const level = (v: number): number => (finite(v) ? Math.max(0, Math.round(v)) : 0);

/**
 * Everything this run moved, ranked nowhere — `planCelebration` does the
 * ranking, and `celebrationView` the rendering. This only answers "what
 * happened", so the two halves stay independently testable.
 *
 * Order is the order a player reads the card top to bottom, and is otherwise
 * irrelevant: `planCelebration` sorts by rarity weight.
 */
export function runProgressEvents(facts: RunProgressFacts): ProgressEvent[] {
  const out: ProgressEvent[] = [];

  if (facts.newBest && finite(facts.distance) && facts.distance > 0) {
    out.push({ kind: "record", metres: facts.distance });
  }

  if (facts.wings && facts.wings.name) {
    out.push({ kind: "wings", tierId: facts.wings.tierId || "gold", icon: facts.wings.icon, name: facts.wings.name });
  }

  for (const trophy of facts.trophies) {
    if (trophy.id && trophy.title) out.push({ kind: "trophy", id: trophy.id, title: trophy.title, rarity: trophy.rarity });
  }

  const m = facts.mastery;
  if (m && m.mode && finite(m.level)) {
    out.push({ kind: "mastery", icon: m.icon, mode: m.mode, level: level(m.level), maxed: m.maxed, skill: m.skill, coins: coins(m.coins) });
  }

  if (facts.passTier !== null && finite(facts.passTier) && facts.passTier > 0) {
    out.push({ kind: "pass", tier: level(facts.passTier) });
  }

  for (const c of facts.challenges) {
    if (c.label) out.push({ kind: "challenge", variant: c.variant, icon: c.icon, label: c.label, coins: coins(c.coins) });
  }

  const questCoins = facts.quests.reduce((sum, q) => sum + coins(q.reward), 0);
  if (facts.quests.length > 0 && questCoins > 0) {
    out.push({ kind: "quest", count: facts.quests.length, coins: questCoins });
  }

  if (facts.nest && finite(facts.nest.level)) {
    out.push({ kind: "nest", level: level(facts.nest.level), mult: finite(facts.nest.mult) ? facts.nest.mult : 1 });
  }

  return out;
}

/** An empty fact set — what a run that moved nothing looks like. */
export const NO_RUN_PROGRESS: RunProgressFacts = {
  newBest: false,
  distance: 0,
  wings: null,
  trophies: [],
  mastery: null,
  passTier: null,
  quests: [],
  nest: null,
  challenges: [],
};
