/**
 * Per-run medals — an absolute ladder, not a leaderboard rank.
 *
 * The problem this solves, concretely: a player finishes a run and sees "340 m,
 * best 340 m". That says where they are and nothing about what is next. Every
 * other number in the game is either lifetime (a trophy you get once) or
 * relative (a leaderboard you can lose a place on). Neither tells a new player
 * whether the run they just had was a good one.
 *
 * Flappy Bird solved this in four lines of data: bronze at 10 points, silver at
 * 20, gold at 30, platinum at 40. Absolute thresholds, published in advance.
 * Every player, forever, has a visible next rung — and a perfect run still
 * shows "gold" rather than "you are the best", so mastery is never the ceiling.
 * That is the whole trick, and it is why it is the cheapest high-retention idea
 * in the genre.
 *
 * Deliberately NOT derived from a percentile, a rival's score, or a saved
 * "best medal": all of those move when the player improves, which is exactly
 * the property that makes a ladder feel like a moving goalpost. These are
 * constants. A number the player has to beat stays beatable.
 *
 * Pure and side-effect free, so the thresholds can be tuned without touching a
 * save file, and the test can walk the whole ladder.
 */

export type Medal = "none" | "bronze" | "silver" | "gold" | "platinum";

export type MedalTier = {
  readonly medal: Exclude<Medal, "none">;
  /** Metres of distance that earn it. Absolute, published, never moving. */
  readonly at: number;
  /** Player-facing name, kept here so the ladder and its copy cannot drift. */
  readonly label: string;
};

/**
 * Ascending. `at` is the distance that earns the medal, so bronze is the floor
 * a first run can clear and platinum is a genuine stretch.
 *
 * Chosen against this game's own scale rather than copied from Flappy Bird's
 * pipe counts: a fresh run reaches roughly 100–200 m, a competent one a few
 * hundred, and the daily goal line is measured in kilometres.
 */
export const MEDAL_LADDER: readonly MedalTier[] = [
  { medal: "bronze", at: 250, label: "Bronze" },
  { medal: "silver", at: 600, label: "Silver" },
  { medal: "gold", at: 1200, label: "Gold" },
  { medal: "platinum", at: 2500, label: "Platinum" },
] as const;

/** The highest medal a run of `distance` earns. Below the first rung: none. */
export function medalFor(distance: number): Medal {
  if (!Number.isFinite(distance)) return "none";
  let best: Medal = "none";
  for (const tier of MEDAL_LADDER) if (distance >= tier.at) best = tier.medal;
  return best;
}

export type MedalStanding = {
  /** What this run earned. */
  earned: Medal;
  /** Metres still to fly for the NEXT rung, or null once the ladder is topped. */
  toNext: number | null;
  /** That next rung's medal, or null at the top. */
  next: Exclude<Medal, "none"> | null;
  /** Distance at which the next rung lands, or null at the top. */
  nextAt: number | null;
  /** True once every rung is cleared — the ladder is a floor, not a ceiling. */
  topped: boolean;
};

/**
 * Where a run sits on the ladder, and what would move it.
 *
 * Both halves matter and they do different jobs. `earned` is the payoff and it
 * only ever goes up within a run. `toNext` is the engine: it is the number a
 * player is actually steering by on the attempt after a near miss, and it is
 * the reason to fly a thirty-second run one more time.
 */
export function medalStanding(distance: number): MedalStanding {
  const earned = medalFor(distance);
  const beaten = MEDAL_LADDER.filter((t) => distance >= t.at);
  const nextTier = MEDAL_LADDER[beaten.length];
  return {
    earned,
    toNext: nextTier ? Math.max(0, Math.ceil(nextTier.at - distance)) : null,
    next: nextTier?.medal ?? null,
    nextAt: nextTier?.at ?? null,
    topped: !nextTier,
  };
}

/** Best medal the run reached, given the highest distance it hit. Used to
 *  decide whether to show the "new medal" flourish on the results card. */
export function bestMedalOf(distance: number): Medal {
  return medalFor(distance);
}
