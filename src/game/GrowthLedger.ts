/**
 * Growth ledger — the two lines that turn a result into progress.
 *
 * The results card was already good at selling the *next* flight: a lesson from
 * the run's dominant moment, the next bird's unlock distance, a shared-run code.
 * What it never said was what the flight the player just finished *grew*. That
 * matters more than it sounds — a reward that is visibly one step along a ladder
 * is worth more than the same reward as a bare number, and "feel like progress"
 * was the one thing the external audit said the game asserted but never showed
 * at the moment of reward.
 *
 * Two ladders already exist and are already computed for every HUD snapshot —
 * career wings (lifetime distance) and per-mode mastery — and both were only
 * ever rendered on the progress screen, one tap away from the flight that earned
 * them. This module decides what the card says; `HUD.ts` only renders it.
 *
 * Dependency-free by design (no HUD, no SaveData, no DOM): the inputs are
 * structural copies of the two snapshot shapes, so this can be unit-tested and
 * imported from anywhere without a cycle — the rule `Moments.ts` set and the one
 * `HANDOFF.md` §3 asks for while `Game.ts`/`HUD.ts` are still god objects.
 */

/** The career ladder: `HudSnapshot["wings"]`. */
export type WingsGrowth = {
  icon: string;
  name: string;
  /** 0..1 progress from the current tier to the next. */
  progress: number;
  /** Empty string once the last tier is reached. */
  nextName: string;
  /** Metres of lifetime distance still needed for `nextName`. */
  nextNeeded: number;
  lifetime: number;
};

/** One mode's mastery row: a structural subset of `MasteryRow`. */
export type MasteryGrowth = {
  name: string;
  icon: string;
  runs: number;
  level: number;
  /** Runs needed for the next level, or null when maxed. */
  nextAt: number | null;
  /** 0..1 progress towards the next level. */
  progress: number;
  perk: string;
  maxed: boolean;
};

export type GrowthLine = {
  /** Which ladder this line is, so the card can colour it. */
  kind: "wings" | "mastery";
  icon: string;
  label: string;
  /** The "what is left" clause. Kept numeric: numbers need no translation. */
  detail: string;
  /** 0..1 bar fill. */
  progress: number;
};

const clamp01 = (v: number) => (Number.isFinite(v) ? (v <= 0 ? 0 : v > 1 ? 1 : v) : 0);
const metres = (v: number) => Math.max(0, Math.round(Number.isFinite(v) ? v : 0)).toLocaleString("en-US");

/**
 * The card's growth ledger: at most two lines, wings first.
 *
 * Wings lead because it is the ladder every flight feeds (lifetime distance),
 * so it always has something true to say; mastery is per-mode and is dropped
 * entirely when the snapshot has no row for the mode just flown — a line that
 * cannot be filled in is worse than no line.
 *
 * @param wings   career wings from the snapshot.
 * @param mastery the flown mode's row, or null when there is none.
 */
export function growthLedger(wings: WingsGrowth | null, mastery: MasteryGrowth | null): GrowthLine[] {
  const lines: GrowthLine[] = [];

  if (wings && wings.name) {
    const done = !wings.nextName;
    lines.push({
      kind: "wings",
      icon: wings.icon || "\u{1FAB6}",
      label: wings.name,
      detail: done
        ? `Max rank · ${metres(wings.lifetime)} m flown`
        : `${metres(wings.nextNeeded)} m to ${wings.nextName}`,
      progress: done ? 1 : clamp01(wings.progress),
    });
  }

  if (mastery && mastery.name) {
    const level = Number.isFinite(mastery.level) ? Math.max(0, Math.round(mastery.level)) : 0;
    lines.push({
      kind: "mastery",
      icon: mastery.icon || "\u{1F396}",
      label: `${mastery.name} · Lv.${level}`,
      detail:
        mastery.maxed || mastery.nextAt === null
          ? mastery.perk || "Maxed"
          : `${Math.max(0, Math.round(mastery.runs))}/${Math.round(mastery.nextAt)} runs`,
      progress: mastery.maxed ? 1 : clamp01(mastery.progress),
    });
  }

  return lines;
}
