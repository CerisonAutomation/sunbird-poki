/** Shared audio scheduler constants — single source of truth.
 *
 * Kept here rather than in either `Music.ts` or `SongbookPlayer.ts` so the
 * two schedulers cannot drift: a change to one that misses the other was
 * how the clock used to go out of phase. Both modules now import from
 * this file and nothing else for these values.
 *
 * The values are tuned by ear and by measurement (oscillator counts to
 * prove sound is being produced), not by formula — the numbers here are
 * the answer, not the derivation.
 */
export const TICK_MS = 25;
export const LOOKAHEAD = 0.16;
export const MAX_STEPS_PER_TICK = 8;
