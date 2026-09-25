import type { MenuIconName } from "./MenuIcons";
import { SQUAD_CHAT } from "./edition";
import { t } from "../i18n";

/**
 * Canonical home destinations: player-facing names explain what each page is
 * for. Native buttons keep standard Tab/Enter/Space behavior.
 *
 * Wording rule: a destination must name the thing it actually opens. PvP
 * worlds, AI races, and challenge rules now have one home — Challenges — so
 * the root menu stays about choosing a kind of play, not choosing an
 * implementation detail.
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
export type MenuDestination = {
  action: string;
  key: string;
  title: string;
  detail: string;
  icon: MenuIconName;
};

/** Resolve a destination's localized copy. */
function dest(key: string, action: string, icon: MenuIconName, title: string, detail: string): MenuDestination {
  return {
    action,
    key,
    icon,
    title: t(`menu.dest.${key}.title`, undefined, title),
    detail: t(`menu.dest.${key}.detail`, undefined, detail),
  };
}

export const PLAY_DESTINATIONS: MenuDestination[] = [
  dest("daily", "play-daily", "daily", "Long Light", "Today’s shared course · daily challenge"),
  dest("challenges", "open-challenges", "challenge", "Race the flock", "Online or AI · choose a world"),
  dest("leaderboard", "open-board", "board", "Leaderboards", "All-time · weekly · today · you"),
  dest("gameModes", "mode-select", "compass", "Solo modes", "Time Trial · Skyline · Coin Rush"),
  dest("endless", "start-endless", "endless", "Endless", "No clock · growing challenge"),
  dest("versus", "versus", "flight", "Same-screen 1v1", "Space / Enter · or touch your half"),
];

export const COLLECTION_DESTINATIONS: MenuDestination[] = [
  dest("shop", "open-shop", "shop", "Shop", "Birds, trails & upgrades"),
  // The squad detail names chat only when chat exists — the copy is a promise
  // about what the screen does, and a promise the build cannot keep is worse
  // than a shorter line.
  dest("squad", "open-squad", "squad", "Squad", SQUAD_CHAT ? "Friends & club chat" : "Friends & clubs"),
  dest("settings", "open-settings", "settings", "Settings", "Sound, controls & display"),
];

export const PROGRESS_DESTINATIONS: MenuDestination[] = [
  dest("progress", "open-progress", "progress", "Your progress", "Missions, gifts & events"),
  dest("tournaments", "open-cups", "trophy", "Tournaments", "Weekly score challenges"),
  dest("campaign", "open-campaign", "story", "Story", "The Long Migration"),
  dest("rivalRank", "open-rank", "rank", "Rival rank", "Your local race rating"),
  dest("nestPass", "open-pass", "pass", "Nest Pass", "Season rewards"),
  dest("trophyCase", "open-trophies", "medal", "Trophies", "Achievements & mastery"),
  dest("atlas", "open-atlas", "atlas", "Island Atlas", "Islands & hazards"),
  dest("scores", "open-scores", "scores", "Your scores", "Saved flight records"),
  dest("account", "open-account", "account", "Account", "Name & save transfer"),
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
