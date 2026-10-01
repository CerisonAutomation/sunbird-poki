/** One priority slot for text that competes with flight/landing visibility. */
export function feedbackSlot(s: { countdown: number; finishRemaining: number; launchBannerT: number; goalPop: string; goHold?: number }): string {
  // `goHold` keeps the countdown slot alive for the length of the GO beat.
  // The frame that writes "GO!" is the FIRST frame where countdown <= 0, so
  // without this the slot flipped to "hint" in the same update that rendered
  // GO — and the stylesheet's
  // `.hud-root:not([data-feedback="countdown"]) .countdown { display: none }`
  // hid it on every single frame. Measured over a real launch: GO! sat in the
  // DOM for 86 frames and was visible for 0.
  return s.countdown > 0 || (s.goHold ?? 0) > 0 ? "countdown"
    : s.finishRemaining > 0 && s.finishRemaining < 900 ? "finish"
    : s.launchBannerT > 0 ? "launch"
    : s.goalPop ? "goal" : "hint";
}

/** One pill in the flight HUD, so a goal and a quest cannot both own it. */
export type PopMoment = { text: string; kind: "goal" | "quest" };

/**
 * Pure: queue a moment behind the pill that is showing.
 *
 * Two moments landing in the same frame used to be last-writer-wins — one of them
 * simply never appeared, which is how a completed quest ends up feeling like it
 * did not count. The cap drops the *newest* moment once the backlog is full:
 * three stale pops draining out after the player has landed is worse than losing
 * one, and the results card reports every quest honestly regardless.
 */
/**
 * Pure: queue one moment behind the ones already waiting, capped.
 *
 * Shared by the pill and the banner because both are single slots with the same
 * failure mode — two moments in one frame, one of them silently lost. The cap
 * drops the *newest*: stale moments draining out after the player has landed are
 * worse than losing one, and the results card reports everything honestly anyway.
 */
export function enqueue<T>(queue: readonly T[], moment: T, limit = 3): T[] {
  if (queue.length >= limit) return [...queue];
  return [...queue, moment];
}

export function enqueuePop(queue: readonly PopMoment[], moment: PopMoment, limit = 3): PopMoment[] {
  return enqueue(queue, moment, limit);
}

/** The banner's own vocabulary: a rung crossed, or a mark flown past. */
export type BannerMoment = { text: string; kind: BannerKind };
export type BannerKind = "rank" | "best";
