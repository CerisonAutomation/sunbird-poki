/**
 * Two of `Game.ts`'s 153 methods, lifted out whole.
 *
 * `Game.ts` is 7,662 lines in one class at 0.52 % statement coverage, and
 * nothing constructs it — so every rule it computes is verified by nothing
 * (`docs/audits/BRUTAL_REPO_AUDIT_2026-09-24.md` §1). Only 5 of its methods
 * touch no `this.` at all, so there is nothing to lift mechanically; a seam has
 * to be *made*. This is the first one, and it is the pattern for the rest:
 *
 *   - take a method that turns saved state plus content constants into a view
 *     object for the HUD,
 *   - pass the state in as arguments instead of reading `this`,
 *   - pass the clock-derived value (the week key) in too, so the function is
 *     deterministic and a test can pin a date,
 *   - leave a one-line delegation behind in `Game.ts`.
 *
 * Both builders here are pure: no DOM, no `SaveData`, no `Date.now()`. The
 * rules they carry are real and were previously untested — the gauntlet's
 * clear threshold, the division progress clamp, the top-division edge case, and
 * the exact field set a match row may expose to the HUD.
 */
import { weeklyGauntlet } from "./Challenges";
import type { GauntletCard, RivalCard } from "./HUD";
import { modeById } from "./Modes";
import { divisionFor, nextDivision, type RivalState } from "./pvp";

/**
 * The week's three-stage gauntlet as the HUD draws it.
 *
 * @param week           the week key (`weekKey()`), passed in so the caller owns
 *                       the clock and a test can pin one
 * @param doneStages     stage indices already cleared this week
 * @param lifetimeClears full gauntlets cleared ever, for the career line
 */
export function buildGauntletCard(week: string, doneStages: number[], lifetimeClears: number): GauntletCard {
  const g = weeklyGauntlet(week);
  const stages = g.stages.map((st) => {
    const mode = modeById(st.mode);
    return {
      index: st.index,
      label: st.label,
      modeName: mode.name,
      modeIcon: mode.icon,
      metric: st.metric,
      target: st.target,
      reward: st.reward,
      done: doneStages.includes(st.index),
    };
  });
  return {
    week: g.week,
    stages,
    clearBonus: g.clearBonus,
    // Changed from `doneStages.length >= 3` while writing the first test over
    // this code: the old rule counted the *array*, so a duplicated or stale
    // stage index (a save written against a different week's gauntlet) reported
    // a clear that did not happen — and the HUD renders this flag as
    // "🏆 Gauntlet cleared this week · +N paid". Every stage of *this* gauntlet
    // done is the claim the text makes, so that is what is computed. Stage
    // indices are 0-based (`weeklyGauntlet` maps with `index: i`).
    cleared: stages.every((st) => st.done),
    lifetimeClears,
  };
}

/**
 * The ranked-rival card: rating, division, streak and the season footer.
 *
 * @param rival  the saved rival state (rating, record, recent matches)
 * @param season the season footer, built by the caller — it is clock-derived,
 *               so keeping it out of here keeps this function pure
 */
export function buildRivalCard(rival: RivalState, season: RivalCard["season"]): RivalCard {
  const div = divisionFor(rival.rating);
  const next = nextDivision(rival.rating);
  const span = div.max - div.min;
  return {
    rating: Math.floor(rival.rating),
    division: div.name,
    divisionIcon: div.icon,
    wins: rival.wins,
    losses: rival.losses,
    streak: rival.streak,
    bestStreak: rival.bestStreak,
    nextName: next ? next.div.name : "",
    nextNeeded: next ? next.needed : 0,
    // Clamped, because a soft-reset or a bonus can leave the rating outside the
    // division's own band for a frame; a progress bar past 100 % is a visible lie.
    progress: span > 0 ? Math.max(0, Math.min(1, (rival.rating - div.min) / span)) : 1,
    matches: rival.matches.map((m) => ({ place: m.place, field: m.field, mode: m.mode, date: m.date, won: m.won })),
    season,
  };
}
