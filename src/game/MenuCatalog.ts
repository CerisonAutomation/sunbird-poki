import type { MenuIconName } from "./MenuIcons";
import { SQUAD_CHAT } from "./edition";
import { plural, t } from "../i18n";
import type { TournamentView } from "./Tournaments";

/**
 * Canonical home destinations: player-facing names explain what each page is
 * for. Native buttons keep standard Tab/Enter/Space behavior.
 *
 * Wording rule: a destination must name the thing it actually opens, and a
 * headline feature that only lives one level down is not reachable.
 *
 * Rivals used to be ONE merged tile ("PvP · players & AI") on the reasoning
 * that asking "human or AI?" before the player has decided to race makes them
 * choose a category rather than an opponent. That reasoning holds, and it is
 * why the merged tile is gone rather than merely demoted: the fix was never to
 * remove a rival, it was to stop burying them. Both now sit at the top of
 * `QUICK_ACTIONS` — one row under the main button, side by side, so the choice
 * between them is made in the same glance and neither is hidden behind the
 * other. The race screen still carries both as labelled sections.
 *
 * Both keep their canonical screen keys (`raceLobby`, `aiPvp`) rather than
 * inventing parallel names, so a destination and the screen it opens cannot
 * drift apart in naming.
 */

/** The three home-menu tabs the catalog groups destinations into. */

export type MenuDestination = {
  action: string;
  key: string;
  title: string;
  detail: string;
  icon: MenuIconName;
  /** Which of the three home-menu tabs this destination lives under. */
  /**
   * Marks a destination as the one action that must never be more than a glance
   * away (currently PvP). The home menu orders Play first and leads it with
   * these. Not a sticky row: there is no tab strip and no derived list — the
   * array order IS the contract, and a caller that wants the set can filter on
   * this flag rather than reading a second export that can drift from it.
   */
};

/** Resolve a destination's localized copy. */
function dest(
  key: string,
  action: string,
  icon: MenuIconName,
  title: string,
  detail: string,
): MenuDestination {
  return {
    action,
    key,
    icon,
    title: t(`menu.dest.${key}.title`, undefined, title),
    detail: t(`menu.dest.${key}.detail`, undefined, detail),
  };
}

/**
 * The four things that sit directly under the main button.
 *
 * A rail, not four more tiles. The home menu had grown to three titled sections
 * and eighteen tiles, and the two actions a returning player reaches for most —
 * race someone, change something — were scrolled off the bottom of it. PvP and
 * AI PvP are separate entries on purpose: the race screen offers both, but they
 * are different decisions (find a person, or find a bird), and collapsing them
 * into one tile is what buried them in the first place.
 *
 * These are the same `MenuDestination` records the grids use, so the rail and
 * the catalog cannot drift: changing a title here changes it there.
 */
export const QUICK_ACTIONS: MenuDestination[] = [
  dest("raceLobby", "open-live", "online", "PvP", "Race a real pilot",),
  dest("aiPvp", "open-practice", "bird", "AI PvP", "Race the neural flock",),
  dest("shop", "open-shop", "shop", "Shop", "Birds & upgrades",),
  dest("settings", "open-settings", "settings", "Settings", "Sound & display",),
];

export const PLAY_DESTINATIONS: MenuDestination[] = [
  // The pre-flight screen: pick a bird, pick a trail, and buy or stage
  // boosters — all on one page. It lives here rather than in the four-tile
  // quick rail because that rail is a deliberate 2x2 block; a fifth tile
  // would strand an orphan in a third row.
  dest("loadout", "open-loadout", "trail", "Customise", "Bird, trail & boosters",),
  dest("challenges", "open-challenges", "challenge", "Challenges", "Daily & weekly goals, auto-matched",),
  dest("gameModes", "mode-select", "compass", "Circuits & Daily", "Long Light · Time Trial · Skyline · Coin Rush",),
  dest("endless", "start-endless", "endless", "Endless", "No clock · growing challenge",),
  dest("versus", "versus", "flight", "Same-screen 1v1", "Space / Enter · or touch your half",),
  // Squad moved here out of its own "Personalize" section: it is a way of
  // playing (friends and clubs), and a heading with exactly one tenant is a
  // heading looking for a second one. The detail names chat only when chat
  // exists — the copy is a promise about what the screen does, and a promise
  // the build cannot keep is worse than a shorter line.
  dest("squad", "open-squad", "squad", "Squad", SQUAD_CHAT ? "Friends & club chat" : "Friends & clubs"),
];

/**
 * Formerly the "Personalize" grid (Shop, Squad, Settings).
 *
 * Removed as a section. Shop and Settings are in `QUICK_ACTIONS` — one tap
 * below the main button instead of a scrolled heading — and Squad moved into
 * `PLAY_DESTINATIONS`, where a one-tile heading had no business existing.
 * Keeping duplicate `dest()` records here would give Shop and Settings two
 * identities and, because they share a `key`, break uniqueness for
 * `destinationByKey`.
 */
export const PROGRESS_DESTINATIONS: MenuDestination[] = [
  dest("progress", "open-progress", "progress", "Your progress", "Missions, gifts & events",),
  dest("campaign", "open-campaign", "story", "Story", "The Long Migration",),
  dest("trophyCase", "open-trophies", "medal", "Trophies", "Achievements & mastery",),
  dest("atlas", "open-atlas", "atlas", "Island Atlas", "Islands & hazards",),
  dest("scores", "open-scores", "scores", "Your scores", "Saved flight records",),
  dest("account", "open-account", "account", "Account", "Name & save transfer",),
];

/**
 * Destinations the home screen reaches through a route OTHER than a grid tile.
 *
 * They are deliberately NOT in the grids above: `rivalRank` and `nestPass` both
 * open from inside the Your-progress hub (Nest Pass has a third entry in the
 * home record bar), `tournaments` opens from the countdown strip, and
 * `leaderboard` is opened by the board strip's own button. As tiles they were a
 * second route to a screen you could already reach from the same screen — and
 * "Leaderboards" under a "Play now" heading was always the wrong question
 * ("how am I doing?" is not "what shall I play?"). They stay here, and out of
 * the grids, so `destinationByKey` still resolves them.
 */
export const SECONDARY_DESTINATIONS: MenuDestination[] = [
  dest("rivalRank", "open-rank", "rank", "Rival rank", "Your local race rating",),
  dest("nestPass", "open-pass", "pass", "Nest Pass", "Season rewards",),
  dest("tournaments", "open-cups", "trophy", "Tournaments", "Weekly score challenges",),
  dest("leaderboard", "open-board", "board", "Leaderboards", "All-time · weekly · today · you",),
];

/**
 * Every destination, however it is reached — rail, grid, or a second route
 * from inside another screen.
 *
 * `QUICK_ACTIONS` is included because omitting it made `destinationByKey`
 * unable to resolve `raceLobby` and `aiPvp` once they left the grids, which is
 * a lookup failure rather than a cosmetic one.
 */
export const ALL_DESTINATIONS: readonly MenuDestination[] = [
  ...QUICK_ACTIONS,
  ...PLAY_DESTINATIONS,
  ...PROGRESS_DESTINATIONS,
  ...SECONDARY_DESTINATIONS,
];

/** Look up a destination by its stable key (never by display title). */
export function destinationByKey(key: string): MenuDestination | undefined {
  return ALL_DESTINATIONS.find((d) => d.key === key);
}

/* ================================================ tournament countdown card */

export type TournamentCountdownCard = {
  /** "<cup name> ends in N day(s) — You're currently <tier>!" */
  text: string;
  daysLeft: number;
  cupId: string;
  /** "" when there is no tier left to climb toward (already Diamond). */
  nextTierLabel: string;
};

function titleCase(word: string): string {
  return word ? word[0]!.toUpperCase() + word.slice(1) : word;
}

/**
 * Home-menu tournament countdown (Feature: Tournament Countdown Urgency).
 * Surfaces the soonest-ending of this week's two cups — that is the one
 * worth a player's attention right now — phrased as personal urgency
 * ("You're currently Silver!") rather than a bare timer. Returns null only
 * when no cup is running at all (two run every week; an empty list would
 * mean a save mid-migration or an empty test fixture).
 */
export function tournamentCountdownCard(cups: readonly TournamentView[]): TournamentCountdownCard | null {
  if (!cups.length) return null;
  const cup = cups.reduce((soonest, c) => (c.endsInMs < soonest.endsInMs ? c : soonest));
  const daysLeft = Math.max(0, Math.ceil(cup.endsInMs / 86_400_000));
  const tierLabel = cup.tier ? titleCase(cup.tier) : "Unranked";
  return {
    // Pluralised by the locale, not assembled in English. See `plural` in
    // ./i18n: a card that says "ends in 2 day" in every language that is
    // not English — and that a three-form locale cannot express at all —
    // is the one place on the home screen a player is guaranteed to read.
    text: t(
      "hud.cup.endsIn",
      { cup: cup.def.name, n: daysLeft, count: daysLeft, forms: "day|days", tier: tierLabel },
      `${cup.def.name} ends in ${daysLeft} ${plural(daysLeft, "day|days")} — You're currently ${tierLabel}!`,
    ),
    daysLeft,
    cupId: cup.def.id,
    nextTierLabel: cup.nextTier ? titleCase(cup.nextTier) : "",
  };
}
