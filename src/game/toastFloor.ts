/**
 * Why a toast is allowed to survive its successor.
 *
 * The flight HUD caps itself to ONE visible pill (`MAX_VISIBLE` is 2, but the
 * in-flight cap is 1), which is correct — the audit's whole complaint about
 * the flight corridor was that five notification channels were competing for
 * the one part of the screen the player is looking at.
 *
 * The bug was in how the cap was enforced. A new toast evicted the oldest
 * *unconditionally and immediately*, with no minimum on-screen time. In flight
 * the game emits a near-continuous stream of system messages — wind, thermals,
 * goals, coins, rival events — so any message could be born and destroyed
 * inside the same 100 ms. That is why the flavour lines never appeared: 211
 * quips, all of them firing correctly, almost none of them ever surviving long
 * enough to be read. The player's report was "the funny messages don't even
 * show up", and they were right; the toast call was not the thing that was
 * broken.
 *
 * So eviction is now conditional on the incumbent having had a fair look. A
 * toast that has not yet had `TOAST_MIN_VISIBLE_MS` on screen is not evicted;
 * the newcomer waits instead. The queue is bounded, because an unbounded one
 * would just move the problem into a backlog that plays out after the moment
 * has passed — a joke about a 1,000 m milestone is worthless at 1,400 m.
 *
 * Pure so the policy can be enumerated by a test rather than inferred from
 * a DOM race.
 */

/** The floor. Below roughly a third of a second nothing registers as having
 *  been on screen at all — it reads as a flicker, not a message. */
export const TOAST_MIN_VISIBLE_MS = 520;

/**
 * How many deferred toasts may wait.
 *
 * Started at 3 and that was too tight. With a one-pill cap in flight and a
 * 620 ms floor, throughput is about 1.6 messages a second; a busy stretch of
 * play emits more than that, so a cap of 3 traded the old failure (everything
 * flickers, nothing is readable) for a new one (a readable pill, and the rest
 * silently dropped). Measured in-browser: distinct toasts surviving a 30-cycle
 * run fell from 16 to 3.
 *
 * Six is roughly four seconds of backlog — long enough to ride out a burst
 * without letting a joke about a 1,000 m milestone surface at 1,400 m.
 */
export const TOAST_QUEUE_CAP = 6;

export type ToastDecision =
  /** Show it now; evict the incumbent if the layer is full. */
  | { action: "show" }
  /** The layer is full and the incumbent has not been readable yet. */
  | { action: "defer"; waitMs: number }
  /** The backlog is saturated; this message is not worth a queue slot. */
  | { action: "drop" };

/**
 * Should this toast display now, wait, or be abandoned?
 *
 * @param visibleCount how many pills are on screen
 * @param cap          how many are allowed (1 in flight, 2 on menus)
 * @param oldestAgeMs  age of the oldest visible pill; `Infinity` when none
 * @param queueLength  how many toasts are already deferred
 * @param holdMs       how long the INCUMBENT needs to stay readable. Defaults to
 *   the floor, which is right for a caller with nothing better to say, and wrong
 *   for the HUD: it has a per-message read time (`messageHoldMs`, 1.1s–6s) and
 *   must not evict a six-word message at 520ms because the constant happened to
 *   be the only requirement the signature knew about.
 */
export function decideToast(
  visibleCount: number,
  cap: number,
  oldestAgeMs: number,
  queueLength: number,
  holdMs: number = TOAST_MIN_VISIBLE_MS,
  mustShow = false,
): ToastDecision {
  // Room to spare: nothing to arbitrate.
  if (visibleCount < cap) return { action: "show" };
  // A cap of zero or less means the surface is suppressed entirely — even a
  // strategic message cannot show on a surface that is switched off (only the
  // mustShow caller decides that, and it never targets a suppressed surface).
  if (cap <= 0) return { action: "drop" };
  // Strategic, once-per-run messages (the golden-hour pre-cue and its payoff)
  // must never be dropped: they fire in the busiest late-run stretch — exactly
  // when the queue is most likely to be saturated — and losing one costs the
  // player the reason to fly to sundown. Evicting the incumbent early is the
  // lesser harm: routine traffic is replaceable, the once-per-run cue is not.
  if (mustShow) return { action: "show" };
  // The incumbent has had its look — the newcomer is more current, so it wins.
  const age = Number.isFinite(oldestAgeMs) ? oldestAgeMs : Number.POSITIVE_INFINITY;
  if (age >= holdMs) return { action: "show" };
  if (queueLength >= TOAST_QUEUE_CAP) return { action: "drop" };
  // Wait exactly as long as the incumbent still needs, never longer: the
  // backlog must drain as fast as the floor allows or it stops being a queue
  // and starts being a delay.
  return { action: "defer", waitMs: Math.max(1, Math.ceil(holdMs - age)) };
}
