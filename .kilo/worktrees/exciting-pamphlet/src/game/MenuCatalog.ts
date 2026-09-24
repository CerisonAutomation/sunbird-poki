import type { MenuIconName } from "./MenuIcons";
import { SQUAD_CHAT } from "./edition";
/** Canonical home destinations: player-facing names explain what each page is
 * for. Native buttons keep standard Tab/Enter/Space behavior.
 *
 * Wording rule (audit, 2026-09-18): a destination must name the thing it
 * actually opens. "PvP" opens the PvP options (online rooms, ranked/casual
 * matchmaking, private rooms) — it must not start an AI race; offline racing
 * against the neural flock is its own destination, "AI PvP". */
export type MenuDestination = { action: string; title: string; detail: string; icon: MenuIconName };
export const PLAY_DESTINATIONS: MenuDestination[] = [
  { action: "play-daily", icon: "daily", title: "Long Light", detail: "Today's shared course · daily challenge" },
  { action: "open-live", icon: "online", title: "PvP", detail: "Online races, rooms & options" },
  { action: "open-practice", icon: "versus", title: "AI PvP", detail: "Offline race vs the AI flock" },
  { action: "open-board", icon: "board", title: "Leaderboards", detail: "All-time · weekly · today · you" },
  { action: "mode-select", icon: "compass", title: "Solo modes", detail: "Time Trial · Skyline · Coin Rush" },
  { action: "start-endless", icon: "endless", title: "Endless", detail: "No clock · growing challenge" },
];
export const COLLECTION_DESTINATIONS: MenuDestination[] = [
  { action: "open-shop", icon: "shop", title: "Shop", detail: "Birds, trails & upgrades" },
  { action: "open-squad", icon: "squad", title: "Squad", detail: SQUAD_CHAT ? "Friends & club chat" : "Friends & clubs" },
  { action: "open-settings", icon: "settings", title: "Settings", detail: "Sound, controls & display" },
];
export const PROGRESS_DESTINATIONS: MenuDestination[] = [
  { action: "open-challenges", icon: "challenge", title: "Challenges", detail: "Daily & weekly goals" },
  { action: "versus", icon: "flight", title: "Same-screen 1v1", detail: "Space / Enter · or touch your half" },
  { action: "open-progress", icon: "progress", title: "Your progress", detail: "Missions, gifts & events" },
  { action: "open-cups", icon: "trophy", title: "Tournaments", detail: "Weekly score challenges" },
  { action: "open-campaign", icon: "story", title: "Story", detail: "The Long Migration" },
  { action: "open-rank", icon: "rank", title: "Rival rank", detail: "Your local race rating" },
  { action: "open-pass", icon: "pass", title: "Nest Pass", detail: "Season rewards" },
  { action: "open-trophies", icon: "medal", title: "Trophies", detail: "Achievements & mastery" },
  { action: "open-atlas", icon: "atlas", title: "Island Atlas", detail: "Islands & hazards" },
  { action: "open-scores", icon: "scores", title: "Your scores", detail: "Saved flight records" },
  { action: "open-account", icon: "account", title: "Account", detail: "Name & save transfer" },
];
