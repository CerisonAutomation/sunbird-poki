import type { MenuIconName } from "./MenuIcons";
import { SQUAD_CHAT } from "./edition";
import { plural, t } from "../i18n";
import type { TournamentView } from "./Tournaments";

/**
 * Canonical home destinations: player-facing names explain what each page is
 * for. Native buttons keep standard Tab/Enter/Space behavior.
 *
 * Wording rule: a destination must name the thing it actually opens, and a
 * headline feature that only lives one level down is not reachable. Rivals are
 * therefore a single **PvP** tile that opens the race screen, and that screen
 * carries BOTH kinds of opponent — live humans and the offline AI flock — in two
 * labelled sections, so "who do I race" is answered one tap from home instead of
 * one tile per opponent. The rest of the root menu stays about choosing a kind of
 * play, not choosing an implementation detail.
 *
 * The rival tile reuses the canonical screen key (`raceLobby`) rather than
 * inventing a parallel name, so a destination and the screen it opens can never
 * drift apart in naming. The AI-only view (`aiPvp`) still exists as a screen —
 * the in-race "AI Practice" shortcut opens it — but it is deliberately not a
 * second home tile: two rival tiles on one menu made the player choose an
 * opponent *type* before they had chosen to race at all.
 *
 * `key` is the stable identity. It does three jobs that the display `title`
 * used to do badly:
 *
 *  • it addresses the barrel, so the copy is translated
 *    (`menu.dest.<key>.title` / `.detail`);
 *  • it is what `head()` in HUD.ts matches a screen title to its icon — the
 *    old code matched on the English `title` string, which silently loses its
 *    icon the moment the title is localized;
 *  • it is what tests pin, so renaming the copy cannot break navigation.
 *
 * The English strings stay inline as `t()` fallbacks: the menu renders correct
 * English before a pack lands, and a translator reading this file sees the
 * source text next to its key.
 */

/** The three home-menu tabs the catalog groups destinations into. */
export type MenuSection = "play" | "collection" | "progress";

export type MenuDestination = {
  action: string;
  key: string;
  title: string;
  detail: string;
  icon: MenuIconName;
  /** Which of the three home-menu tabs this destination lives under. */
  section: MenuSection;
  /**
   * Marks a destination as the one action that must never be more than a glance
   * away (currently PvP). The home menu orders Play first and leads it with
   * these. Not a sticky row: there is no tab strip and no derived list — the
   * array order IS the contract, and a caller that wants the set can filter on
   * this flag rather than reading a second export that can drift from it.
   */
  pinned?: true;
};

/** Resolve a destination's localized copy. */
function dest(
  key: string,
  action: string,
  icon: MenuIconName,
  title: string,
  detail: string,
  section: MenuSection,
  pinned?: true,
): MenuDestination {
  return {
    action,
    key,
    icon,
    section,
    ...(pinned ? { pinned } : {}),
    title: t(`menu.dest.${key}.title`, undefined, title),
    detail: t(`menu.dest.${key}.detail`, undefined, detail),
  };
}

export const PLAY_DESTINATIONS: MenuDestination[] = [
  // ONE rival tile, and it is `pinned` so it stays reachable above the
  // Play/Collection/Progress tabs. It opens the race screen, which carries both
  // the human lobby and the AI flock as two sections of the same page — so a
  // player picks an *opponent* (live or offline) rather than an opponent
  // *category* on the way to picking a race. The screen behind it keeps a
  // dedicated AI-only view for the in-race shortcut, but the home menu stays one
  // tile: a menu of one thing per destination, not two tiles for one destination.
  dest("raceLobby", "open-live", "online", "PvP · players & AI", "Live matchmaking, private rooms, or the offline flock", "play", true),
  dest("challenges", "open-challenges", "challenge", "Challenges", "Daily & weekly goals, auto-matched", "play"),
  dest("gameModes", "mode-select", "compass", "Circuits & Daily", "Long Light · Time Trial · Skyline · Coin Rush", "play"),
  dest("leaderboard", "open-board", "board", "Leaderboards", "All-time · weekly · today · you", "play"),
  dest("endless", "start-endless", "endless", "Endless", "No clock · growing challenge", "play"),
  dest("versus", "versus", "flight", "Same-screen 1v1", "Space / Enter · or touch your half", "play"),
];

export const COLLECTION_DESTINATIONS: MenuDestination[] = [
  dest("shop", "open-shop", "shop", "Shop", "Birds, trails & upgrades", "collection"),
  // The squad detail names chat only when chat exists — the copy is a promise
  // about what the screen does, and a promise the build cannot keep is worse
  // than a shorter line.
  dest("squad", "open-squad", "squad", "Squad", SQUAD_CHAT ? "Friends & club chat" : "Friends & clubs", "collection"),
  dest("settings", "open-settings", "settings", "Settings", "Sound, controls & display", "collection"),
];

export const PROGRESS_DESTINATIONS: MenuDestination[] = [
  dest("progress", "open-progress", "progress", "Your progress", "Missions, gifts & events", "progress"),
  dest("tournaments", "open-cups", "trophy", "Tournaments", "Weekly score challenges", "progress"),
  dest("campaign", "open-campaign", "story", "Story", "The Long Migration", "progress"),
  dest("rivalRank", "open-rank", "rank", "Rival rank", "Your local race rating", "progress"),
  dest("nestPass", "open-pass", "pass", "Nest Pass", "Season rewards", "progress"),
  dest("trophyCase", "open-trophies", "medal", "Trophies", "Achievements & mastery", "progress"),
  dest("atlas", "open-atlas", "atlas", "Island Atlas", "Islands & hazards", "progress"),
  dest("scores", "open-scores", "scores", "Your scores", "Saved flight records", "progress"),
  dest("account", "open-account", "account", "Account", "Name & save transfer", "progress"),
];

/** Every destination, in the order the home menu shows them. */
export const ALL_DESTINATIONS: readonly MenuDestination[] = [
  ...PLAY_DESTINATIONS,
  ...COLLECTION_DESTINATIONS,
  ...PROGRESS_DESTINATIONS,
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
