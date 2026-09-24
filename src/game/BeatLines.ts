/**
 * "Can you beat this?" — the marks worth flying at, as places in the world.
 *
 * The game already had every one of these numbers: a personal best, today's best,
 * a rival's mark from a shared link, the daily challenge target, the lead session
 * goal. All of them were *totals* — read on a card, or on a menu, after the fact.
 * A total tells you what happened; a line in the world tells you what is about to
 * happen, and flying past a thing you could see is the only version of that which
 * feels like winning.
 *
 * So this module turns those numbers into at most three marks ahead of the bird,
 * ranked by how close they are, collapsed when two of them would stand on top of
 * each other, and reduced to the single nearest one when the HUD wants a cue.
 *
 * Pure and total: no Date, no save file, no scene graph, and every input is
 * clamped, so a corrupt frame cannot place a flag behind the player or NaN one
 * into the terrain. Labels and number formatting are injected — the caller owns
 * the words (and their translation), this owns the geometry.
 */

export type BeatLineKind = "rival" | "best" | "daily" | "today" | "goal";

/** One mark to fly at: where it stands, and what to call it. */
export type BeatTarget = {
  kind: BeatLineKind;
  /** Metres from the start of this run. */
  at: number;
  /** The words on the flag — supplied by the caller, already localized. */
  label: string;
  /** The number under the words, already formatted by the caller. */
  metres: string;
};

export type BeatLineInput = {
  /** Metres flown so far this run. */
  distance: number;
  /** Personal best distance, 0 when there is none yet. */
  best: number;
  /** Best distance today, 0 when there is none yet. */
  todayBest: number;
  /** A rival's mark from a shared challenge link, when this run is flying it. */
  rival: { name: string; distance: number } | null;
  /** The daily challenge target, when this run is flying a distance-metric daily. */
  dailyTarget: number | null;
  /** The nearest open distance goal's target, when there is one. */
  goalTarget: number | null;
  /** Caller-supplied words per kind. A kind with no label is dropped. */
  labels: Partial<Record<BeatLineKind, string>>;
  /** Caller-supplied number formatting, so this module never owns a locale. */
  format: (metres: number) => string;
};

/**
 * Which mark wins when two of them stand within `BEAT_MIN_GAP` of each other.
 *
 * A rival's shared mark outranks your own best because it is the social one — it
 * is the reason someone sent you a link — and the daily outranks today's best
 * because it pays out. Two flags twenty metres apart read as one blurry flag and
 * fire two moments in the same frame, which feels like a stutter, not a win.
 */
export const BEAT_PRIORITY: readonly BeatLineKind[] = ["rival", "best", "daily", "today", "goal"];

/** Never more than this many marks in the world at once: clutter and draw calls. */
export const BEAT_MAX_LINES = 3;

/** Marks closer together than this collapse into the higher-priority one. */
export const BEAT_MIN_GAP = 60;

/**
 * How far ahead the HUD starts counting down to the nearest mark.
 *
 * Same discipline as the wings proximity bar and `closestGoalLine()`: a target
 * 3 km away is scenery, and a permanent countdown trains the player to look past
 * it. Under 400 m it is a thing about to happen.
 */
export const BEAT_CUE_WINDOW = 400;

const finite = (v: number, fallback = 0): number => (Number.isFinite(v) ? v : fallback);

/**
 * The marks ahead of the bird, nearest first, at most `BEAT_MAX_LINES` of them.
 *
 * Marks already behind the bird are dropped rather than shown as passed: the
 * crossing moment is the report, and a flag in the rear-view is scenery the
 * terrain is about to hide anyway.
 */
export function beatTargets(input: BeatLineInput): BeatTarget[] {
  const distance = Math.max(0, finite(input.distance));
  const format = typeof input.format === "function" ? input.format : (n: number) => String(Math.round(n));
  const label = (kind: BeatLineKind): string | null => {
    const l = input.labels?.[kind];
    return typeof l === "string" && l.trim() ? l.trim() : null;
  };

  const candidates: BeatTarget[] = [];
  const push = (kind: BeatLineKind, at: number): void => {
    const metres = Math.round(finite(at));
    const text = label(kind);
    // A mark at or behind the bird has already been flown past, and a mark of
    // zero means the player has no such record yet — nothing to beat.
    if (!text || metres <= 0 || metres <= distance) return;
    candidates.push({ kind, at: metres, label: text, metres: format(metres) });
  };

  push("rival", input.rival ? finite(input.rival.distance) : 0);
  push("best", finite(input.best));
  push("daily", finite(input.dailyTarget ?? 0));
  push("today", finite(input.todayBest));
  push("goal", finite(input.goalTarget ?? 0));

  // Nearest first; ties broken by priority so the social mark wins the slot.
  candidates.sort((a, b) => a.at - b.at || BEAT_PRIORITY.indexOf(a.kind) - BEAT_PRIORITY.indexOf(b.kind));

  const kept: BeatTarget[] = [];
  for (const c of candidates) {
    // Collapse a mark that stands on top of one already kept, unless the new one
    // outranks it — in which case it replaces it, keeping the nearer ordering.
    const clash = kept.findIndex((k) => Math.abs(k.at - c.at) < BEAT_MIN_GAP);
    if (clash === -1) {
      kept.push(c);
      continue;
    }
    const incumbent = kept[clash]!;
    if (BEAT_PRIORITY.indexOf(c.kind) < BEAT_PRIORITY.indexOf(incumbent.kind)) kept[clash] = c;
  }
  return kept.slice(0, BEAT_MAX_LINES);
}

/**
 * The one mark the HUD should count down to, or null when nothing is close enough
 * to be worth saying. Deliberately silent rather than always on.
 */
export function nearestBeatLine(targets: readonly BeatTarget[], distance: number, cueWindow = BEAT_CUE_WINDOW): BeatTarget | null {
  const d = Math.max(0, finite(distance));
  const window = Math.max(0, finite(cueWindow, BEAT_CUE_WINDOW));
  let best: BeatTarget | null = null;
  for (const t of targets) {
    const gap = t.at - d;
    if (gap <= 0 || gap > window) continue;
    if (!best || gap < best.at - d) best = t;
  }
  return best;
}

/**
 * The marks this frame flew past — the exact set that should fire a moment.
 *
 * Compares against the marks that were ahead on the previous frame, so a target
 * that appears *already behind* the bird (a personal best shorter than the run
 * you are mid-way through, or a goal that refilled to a small number) never
 * fires: it was never something you were about to beat.
 */
export function crossedBeatLines(previousAhead: readonly BeatTarget[], distance: number): BeatTarget[] {
  const d = Math.max(0, finite(distance));
  return previousAhead.filter((t) => t.at <= d);
}
