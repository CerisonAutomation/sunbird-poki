/**
 * How long a transient message must stay up to actually be read.
 *
 * This lived as a private formula inside `HUD.scheduleToastOut`, and a second,
 * different, flat 3000 ms lived in `NotificationQueue` beside it. Two layers,
 * two answers to the same question, neither derived from anything — which is
 * how a median six-word quip ended up on screen for 1.73 s, roughly how long six
 * words take to read with nothing left for finding the text first.
 *
 * So: one model, exported, used by both.
 *
 *   need = ACQUIRE + words x MS_PER_WORD
 *
 * ACQUIRE_MS is the cost of a PERIPHERAL novel target on a moving background.
 * The fovea — the only region with reading acuity — is 1.5-2 degrees of visual
 * field, and a one-button game pins gaze to the bird, so anything off the bird
 * is read at a discount. MS_PER_WORD is 470 ms: Brysbaert's 2019 meta-analysis
 * (190 studies) puts silent reading at 238 wpm (415 ms/word); raised for the
 * 2026-10-04 directive, because Poki's audience is global and much of it
 * reads the game's English as a second language, where reading rates run
 * 30-50% under the meta-analytic mean. Peripheral placement and divided
 * attention are priced on top of that.
 *
 * WORDS, not characters, because a character is the wrong unit — a two-letter
 * word costs more per character than a seven-letter one, so a character model
 * misprices both ends.
 */
export const TOAST_ACQUIRE_MS = 450;
export const TOAST_MS_PER_WORD = 470;
export const TOAST_FLOOR_MS = 1400;
/** The layer can be occupied; an unbounded hold deadlocks it. */
export const TOAST_CEIL_MS = 7500;

/**
 * Extra wall-clock a message may be WAITED while its lane is closed, on top of
 * the read window it has already earned.
 *
 * `messageHoldMs` prices reading. It says nothing about the lane being visible,
 * and in this HUD the two are independent: the countdown, the launch banner and
 * the finish counter each set `visibility:hidden` on the toast lane, so a quip
 * fired in those windows is unreadable for the whole of its nominal hold.
 *
 * Without a wait budget the message is removed having been seen for zero
 * milliseconds, which is the "the funny messages don't show up" report. With an
 * unbounded wait the lane could deadlock — a message raised at the tail of a long
 * countdown would still be pending minutes later — so the wait is itself
 * bounded, and bounded generously enough to cover the longest real occlusion
 * (a 3 s start countdown) with room to spare.
 */
export const TOAST_OBSCURE_WAIT_MS = 3000;

/** How often a waiting toast re-checks whether its lane has opened. */
export const TOAST_OBSCURE_POLL_MS = 100;

/** Word count that skips leading/trailing/collapsed whitespace. */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Milliseconds a message needs on screen to be read, bounded at both ends. */
export function messageHoldMs(text: string): number {
  return Math.min(TOAST_CEIL_MS, Math.max(TOAST_FLOOR_MS, TOAST_ACQUIRE_MS + wordCount(text) * TOAST_MS_PER_WORD));
}
