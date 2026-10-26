/**
 * Run-outcome semantics for the Poki game-events contract.
 *
 * Poki's funnel contract (`docs/poki/12-game-events.md`) wants every run
 * attempt to end in exactly one `complete` or `fail`, where `complete` means
 * "the run reached its goal". For a mode with a finish line that is easy:
 * crossing the line is the goal. But five of Sunbird's modes have **no finish
 * line** — daytrip (the DEFAULT first mode), coin rush, perfect, endless and
 * zenith — and for those the old rule was "everything is a fail": the outcome
 * defaulted to `fail` at launch and nothing but a finish line could ever
 * change it. The player-facing recap called the same run a success story
 * ("flight recap", quests, coins) while the platform funnel said 0 % of
 * players ever complete the game's main mode — a number that reads as a
 * broken game in a Player Fit audit, and one the game itself produced.
 *
 * The honest semantics for a no-finish-line mode: the flight IS the goal.
 *
 *   • Sunset (`daylight`) after a real flight — the day trip ran its course —
 *     is the mode *completing*.
 *   • Choosing to land and rest (`settled`) is a completed journey.
 *   • Ditching in the sea (`water`) is a fail.
 *   • A no-show run (never got off the ground, AFK, instant abandon) stays a
 *     fail on both paths — a completion has to be earned by actually flying.
 *
 * Finish-line modes are untouched: ending short of the line is still a fail.
 */

/** The three ways a no-finish-line run can end. Mirrors `RunEndReason`. */
export type NaturalEndReason = "daylight" | "water" | "settled";

/**
 * A run this short (or this still) was not a flight: it was a launch, a
 * bounce and a stop. The floors are deliberately generous — they exist to
 * filter no-shows, not to gatekeep struggling beginners, because the whole
 * point of the natural-end rule is that a beginner's 120 m first flight
 * counts as the day trip it was.
 */
export const RUN_COMPLETE_MIN_DISTANCE = 100;
export const RUN_COMPLETE_MIN_TIME = 15;

/** What the player actually did with the run being judged. */
export type RunEffort = {
  /** Metres travelled from the launch point. */
  distance: number;
  /** Seconds from launch to the natural end. */
  runTime: number;
};

/**
 * The outcome a no-finish-line run earned. `alreadyComplete` short-circuits a
 * run that already recorded a completion (e.g. a finish line in a variant);
 * the caller passes its current outcome and keeps it when it is `complete`.
 */
export function outcomeForNaturalEnd(
  reason: NaturalEndReason,
  effort: RunEffort,
): "complete" | "fail" {
  if (reason === "water") return "fail";
  const flew =
    effort.distance >= RUN_COMPLETE_MIN_DISTANCE || effort.runTime >= RUN_COMPLETE_MIN_TIME;
  return flew ? "complete" : "fail";
}
