/**
 * ContinueOffer — the context-driven rewarded placement (Poki MON-19).
 *
 * The monetization guide asks for "dynamic rewarded video opportunities, such
 * as time-limited offers or context-specific triggers, rather than static
 * buttons", while the surrounding rules (MON-03…) are equally clear that the
 * offer must stay optional, never blocking, and always paired with standard
 * alternatives. This module is the decision half of that: it looks at what just
 * happened in the run and chooses *whether* the offer is worth showing and
 * *what to call it*.
 *
 * Hard boundaries kept here on purpose:
 *   • It never talks to the SDK and never grants anything — it only picks copy.
 *     The single grant site remains in `Game.doContinue()` (MON-10, MON-11).
 *   • It cannot turn an ad-less surface into an ad surface (MON-22): if the
 *     continue screen is shown at all, that is a real rewarded break.
 *   • It never blocks: a `null` result just means the continue screen shows its
 *     neutral framing ("Second Wind"), which is exactly what it showed before.
 *   • Copy rules: standard options stay in the primary position, the rewarded
 *     button is never green (style layer), and every rewarded label carries the
 *     🎬 clapperboard icon (added by the HUD where the button is rendered).
 */

export type ContinueContext = {
  /** Metres flown in the run that just ended. */
  distance: number;
  /** Coins banked in that run before any revive. */
  runCoins: number;
  /** Best distance before this run. */
  personalBest: number;
  /** Player's current daily streak, in days. */
  streakDays: number;
  /** True when the run ended within 15 % of the personal best. */
  nearBest: boolean;
  /** True when the run was already longer than the personal best. */
  isRecord: boolean;
  /** Current altitude when the crash happened (metres). */
  altitude: number;
  /** Whether the platform reported a rewarded break as available. */
  adAvailable: boolean;
};

export type ContinueOffer = {
  /** Short reward framing used on the continue card. */
  title: string;
  /** One-line reason shown under the title. */
  reason: string;
  /**
   * The reward is worth surfacing prominently (still optional, still beside a
   * standard option) — false means keep the card neutral and quiet.
   */
  highlight: boolean;
  /** Stable id for telemetry + tests. */
  kind: "record" | "near-best" | "streak" | "momentum" | "standard";
};

export const CONTINUE_OFFER_KINDS: ContinueOffer["kind"][] = [
  "record",
  "near-best",
  "streak",
  "momentum",
  "standard",
];

/** Distance that makes a run "worth saving" in its own right. */
const MOMENTUM_METRES = 1200;

/**
 * Choose the offer framing. Pure and total: every input combination returns a
 * valid offer, and when nothing about the context stands out the neutral
 * "standard" kind is returned so the card looks exactly as it always did.
 */
export function continueOffer(context: ContinueContext): ContinueOffer {
  if (!context.adAvailable) {
    // No rewarded break was offered by the platform: never imply one exists
    // (MON-12 — handle the unavailable case silently, with no ad language).
    return {
      kind: "standard",
      title: "Second Wind",
      reason: "Pick up where you left off.",
      highlight: false,
    };
  }

  if (context.isRecord) {
    return {
      kind: "record",
      title: "Second Wind",
      reason: "That was your best flight yet — keep it going.",
      highlight: true,
    };
  }

  if (context.nearBest && context.personalBest > 0) {
    return {
      kind: "near-best",
      title: "Second Wind",
      reason: `${Math.max(0, Math.round(context.personalBest - context.distance))} m from your record.`,
      highlight: true,
    };
  }

  if (context.streakDays >= 3) {
    return {
      kind: "streak",
      title: "Second Wind",
      reason: `Day ${context.streakDays} streak is on the line.`,
      highlight: true,
    };
  }

  if (context.distance >= MOMENTUM_METRES) {
    return {
      kind: "momentum",
      title: "Second Wind",
      reason: "You had a good run going.",
      highlight: false,
    };
  }

  return {
    kind: "standard",
    title: "Second Wind",
    reason: "Pick up where you left off.",
    highlight: false,
  };
}

/**
 * Placement analytics payload (REQ-14): the guide wants `visible` when the
 * offer appears and `interact` when it is chosen, so placement usage can be
 * measured per context.
 */
export function continuePlacementLabel(kind: ContinueOffer["kind"]): string {
  return `continue-ad-${kind}`;
}
