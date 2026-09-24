/**
 * Funnel — the honest answer to "where did they go?".
 *
 * A flight game only has a handful of seconds to convert a portal visitor into
 * somebody who flies a second time, and every one of those seconds is a stage
 * somebody can drop out of: the boot, the first touch, the first launch, the
 * first coin, the first laugh, the first death, the first retry. Without
 * timestamps per stage, "players don't come back" is a rumour; with them, it is
 * a number you can point at and fix.
 *
 * This module is deliberately dumb and dependency-free (no DOM, no SaveData, no
 * telemetry import): it records *when* each stage was first reached and answers
 * questions about the shape of the session. `Game.ts` owns sending the events,
 * so nothing here can fire twice or leak player data — there is no identifier
 * of any kind in a `Funnel`, only milliseconds.
 *
 * Stage order is fixed and meaningful: `FUNNEL_STAGES` is the path every
 * player walks, so "last stage reached" *is* the drop-off point.
 */

/** The retention path, in the order a new player meets it. */
export const FUNNEL_STAGES = [
  "boot",
  "first_input",
  "first_flight",
  "first_reward",
  "first_moment",
  "first_death",
  "first_retry",
  "second_run",
] as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[number];

/** One funnel event as sent to telemetry. */
export type FunnelEvent = {
  stage: FunnelStage;
  /** Index of `stage` in `FUNNEL_STAGES` (0-based). Travels with the coarse
   * telemetry beacon so a backend can order the funnel without keeping its own
   * copy of the stage list — the list is fixed, but a copy of it would drift. */
  step: number;
  /** Milliseconds since the funnel started (boot). */
  ms: number;
  /** Milliseconds since the previous stage was reached (0 for `boot`). */
  stepMs: number;
  /** How much of the path this stage completes, 0..1. */
  progress: number;
};

/** Which stage a session stalled at, and how long it sat there. */
export type DropOff = { stage: FunnelStage; step: number; afterMs: number; stuckForMs: number };

export class Funnel {
  private readonly marks = new Map<FunnelStage, number>();
  private startedAt = Number.NaN;

  /** Starts the clock. Idempotent: a second call never moves the origin. */
  start(now = Date.now()): void {
    if (Number.isNaN(this.startedAt)) this.startedAt = now;
  }

  /**
   * Records a stage. @returns an event the first time the stage is reached and
   * `null` afterwards, so callers can wire this straight into telemetry without
   * their own once-flags (and without ever double-counting a stage).
   */
  mark(stage: FunnelStage, now = Date.now()): FunnelEvent | null {
    this.start(now);
    if (this.marks.has(stage)) return null;
    const ms = Math.max(0, Math.round(now - this.startedAt));
    this.marks.set(stage, ms);
    const idx = FUNNEL_STAGES.indexOf(stage);
    const prev = idx > 0 ? this.marks.get(FUNNEL_STAGES[idx - 1]) : undefined;
    return {
      stage,
      step: idx < 0 ? 0 : idx,
      ms,
      stepMs: prev === undefined ? 0 : Math.max(0, ms - prev),
      progress: (idx + 1) / FUNNEL_STAGES.length,
    };
  }

  reached(stage: FunnelStage): boolean {
    return this.marks.has(stage);
  }

  /** Milliseconds since boot when `stage` was reached, or `null`. */
  at(stage: FunnelStage): number | null {
    return this.marks.get(stage) ?? null;
  }

  /** The furthest stage reached — `null` when nothing has been marked. */
  last(): FunnelStage | null {
    for (let i = FUNNEL_STAGES.length - 1; i >= 0; i -= 1) {
      const stage = FUNNEL_STAGES[i];
      if (this.marks.has(stage)) return stage;
    }
    return null;
  }

  /** Stages reached, in path order (a compact "how far did they get" string). */
  path(): FunnelStage[] {
    return FUNNEL_STAGES.filter((s) => this.marks.has(s));
  }

  /** 0..1 completion of the whole path. */
  progress(): number {
    return this.marks.size / FUNNEL_STAGES.length;
  }

  /**
   * Where this session stalled: the last stage reached, how long after boot it
   * happened, and how long the session has been sitting there.
   *
   * The "stuck" number is what makes this actionable — `first_flight` reached
   * but no `first_reward` for 90 seconds is a different bug from no
   * `first_input` at all, and only the gap tells them apart.
   */
  dropOff(now = Date.now()): DropOff | null {
    const stage = this.last();
    if (!stage) return null;
    const afterMs = this.marks.get(stage) ?? 0;
    return {
      stage,
      step: Math.max(0, FUNNEL_STAGES.indexOf(stage)),
      afterMs,
      stuckForMs: Math.max(0, Math.round(now - this.startedAt) - afterMs),
    };
  }

  /** Flat `{ stage: ms }` for one end-of-session beacon. */
  toJSON(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [stage, ms] of this.marks) out[stage] = ms;
    return out;
  }

  /** Clears every mark (a fresh session, e.g. after a save reset). */
  reset(): void {
    this.marks.clear();
    this.startedAt = Number.NaN;
  }
}

/* ------------------------------------------------------------------ cohort */

export type VisitKind = "new" | "d1" | "d2_6" | "d7plus";

/** Whole days between two `YYYY-MM-DD` keys, clamped at zero. */
export function daysBetween(from: string, to: string): number {
  if (!from || !to) return 0;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/**
 * Retention cohort for today's visit.
 *
 * `"new"` = first ever session (no recorded first day, or first day is today),
 * `"d1"` = came back the next day (the number every portal dashboard cares
 * about), `"d2_6"` = the fragile middle, `"d7plus"` = a habit.
 *
 * Days are calendar days in the player's own timezone — the same clock the
 * streak and the login calendar already use — so a "day 1" here means the same
 * thing as a "day 1" everywhere else in the game.
 */
export function visitKind(firstPlayed: string, today: string): VisitKind {
  if (!firstPlayed) return "new";
  const days = daysBetween(firstPlayed, today);
  if (days <= 0) return "new";
  if (days === 1) return "d1";
  if (days < 7) return "d2_6";
  return "d7plus";
}

/* ============================================================ viral KPIs */

/**
 * Closed set of share / rematch / clip event names. Portal builds send no
 * telemetry of ours; the local bus and Poki `measure()` still need a closed
 * set so a dashboard query cannot be poisoned by a typo.
 */
export const VIRAL_EVENT_NAMES = [
  "clip_moment",
  "challenge_share",
  "challenge_open",
  "ghost_rematch",
  "clip_export",
  "one_more_run",
] as const;

export type ViralEventName = (typeof VIRAL_EVENT_NAMES)[number];

export type ViralEventProps = {
  kind?: string;
  mode?: string;
  distance?: number;
  score?: number;
};

const VIRAL_NAME_SET = new Set<string>(VIRAL_EVENT_NAMES);

export function isViralEvent(name: string): name is ViralEventName {
  return VIRAL_NAME_SET.has(name);
}

export function viralEventProps(name: ViralEventName, props: ViralEventProps = {}): ViralEventProps {
  const out: ViralEventProps = {};
  if (typeof props.kind === "string" && props.kind.length > 0 && props.kind.length <= 24) {
    out.kind = props.kind.replace(/[^a-z0-9_]/gi, "").slice(0, 24);
  }
  if (typeof props.mode === "string" && props.mode.length > 0 && props.mode.length <= 24) {
    out.mode = props.mode.replace(/[^a-z0-9-]/gi, "").slice(0, 24);
  }
  if (typeof props.distance === "number" && Number.isFinite(props.distance)) {
    out.distance = Math.max(0, Math.round(props.distance));
  }
  if (typeof props.score === "number" && Number.isFinite(props.score)) {
    out.score = Math.max(0, Math.min(100, Math.round(props.score)));
  }
  void name;
  return out;
}

export type ViralCounts = Partial<Record<ViralEventName, number>>;

/** On-device K-factor proxy for A/B-ing the share CTA. Not a real cohort K. */
export function viralCoefficient(counts: ViralCounts): number {
  const shares = (counts.challenge_share ?? 0) + (counts.clip_export ?? 0);
  const rematches = counts.ghost_rematch ?? 0;
  const opens = counts.challenge_open ?? 0;
  const retries = counts.one_more_run ?? 0;
  if (shares + rematches + opens + retries === 0) return 0;
  const k = (shares * 0.6 + rematches * 0.3 + retries * 0.1) / Math.max(1, opens + shares);
  if (!Number.isFinite(k) || k < 0) return 0;
  return Math.min(3, Math.round(k * 100) / 100);
}
