/**
 * Shared render kit: screen identifiers, headings, and the chrome helpers every
 * screen composes from.
 *
 * These were module-private functions in the middle of `HUD.ts`, which is why
 * a screen could not move out of that file without either importing the
 * controller back (a cycle `pnpm circular:check` fails on) or copying the
 * logic. This module is the leaf they all point at instead.
 */

import { destinationByKey } from "../MenuCatalog";
import { menuIcon, menuIconSm, backSvg, type MenuIconName, type SmIconName } from "../MenuIcons";
import { SELL_AD_REMOVAL } from "../edition";
import { t } from "../../i18n";

/** Stable screen identifiers used by automation, telemetry, and QA. */
export const SCREEN = {
  // `board` is the leaderboard's own screen and `savedScores` is the "Your
  // scores" one. They used to share a slot: `leaderboard` pointed at "scores",
  // which is the saved-scores screen's value, so the leaderboard rendered the
  // saved-scores heading and icon and vice versa.
  leaderboard: "board", savedScores: "scores",
  raceLobby: "live", aiPvp: "practice", challenges: "challenges",
  campaign: "campaign", squad: "squad", rivalRank: "rank", tournaments: "cups",
  gameModes: "modes", atlas: "atlas", shop: "shop", coinStore: "paywall",
  confirmUnlock: "checkout", highGlides: "progress", nestPass: "pass",
  trophyCase: "trophies", account: "account", loadout: "loadout",
} as const;

/**
 * The English heading for each screen key.
 *
 * These are the `defaultText` passed to `t()`, so the screen shows correct
 * English before a pack lands — and they are asserted word-for-word against the
 * barrel's `sourceText` by screen-titles.test.ts, which keeps the fallback from
 * drifting away from the thing translators are actually translating.
 */
export const SCREEN_HEADINGS: Readonly<Record<keyof typeof SCREEN, string>> = {
  leaderboard: "Leaderboard",
  savedScores: "Your scores",
  raceLobby: "Race Lobby",
  aiPvp: "AI PvP",
  challenges: "Challenges",
  campaign: "The Long Migration",
  squad: "Squad",
  rivalRank: "Rival Rank",
  tournaments: "Tournaments",
  gameModes: "Game modes",
  atlas: "Island Atlas",
  shop: "Shop",
  coinStore: "Coin Store",
  confirmUnlock: "Confirm Unlock",
  highGlides: "High glides",
  nestPass: "Nest Pass",
  trophyCase: "Trophy Case",
  account: "Account",
  loadout: "Customise",
};

/**
 * Screen id → its barrel key and English fallback.
 *
 * `en` used to be set to the camelCase *key* rather than the English heading,
 * which made the "fallback === sourceText" assertion in screen-titles.test.ts
 * compare "leaderboard" against "Leaderboard" and fail on every screen.
 */
export const SCREEN_TITLES: Readonly<Record<string, { key: string; en: string }>> = Object.fromEntries(
  Object.entries(SCREEN).map(([key, value]) => [
    value,
    { key: `hud.screen.${key}.title`, en: SCREEN_HEADINGS[key as keyof typeof SCREEN] ?? key },
  ]),
);

/** Icons for screens that exist but are not home destinations. */
const SCREEN_ICONS: Record<string, MenuIconName> = {
  raceLobby: "online",
  aiPvp: "online",
  coinStore: "shop",
  confirmUnlock: "shop",
  highGlides: "trophy",
};

/** Board names come from a network payload — always escape before injecting. */
export function escapeHtml(v: string): string {
  return v.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

export function head(key: string, backAction = "back", right = ""): string {
  const icon = destinationByKey(key)?.icon ?? SCREEN_ICONS[key];
  // Resolve the heading through SCREEN_TITLES, which is keyed by a screen's
  // VALUE ("scores") and carries the i18n key built from its KEY ("leaderboard").
  //
  // Looking SCREEN_HEADINGS up by the value missed on every screen whose key and
  // value differ, and no `hud.screen.*.title` key exists in the barrel, so the
  // fallback is what actually renders: 11 of 17 screens were showing their raw
  // internal id as the visible <h2> — "scores" instead of "Leaderboard", "pass"
  // instead of "Nest Pass", "paywall" instead of "Coin Store".
  //
  // SCREEN_TITLES existed for exactly this and was referenced only by
  // screen-titles.test.ts, which asserts the MAP is well-formed. Nothing
  // rendered from it, so the unit suite was green while the UI was wrong — which
  // is what the orphaned `pnpm test:policy` existed to catch.
  //
  // The two call sites that pass an already-localised string ("Your progress",
  // "Settings") are not screen ids, miss the map, and fall through unchanged.
  const entry = SCREEN_TITLES[key];
  const title = entry
    ? t(entry.key, undefined, entry.en)
    : t(`hud.screen.${key}.title`, undefined, SCREEN_HEADINGS[key as keyof typeof SCREEN] ?? key);
  const back = t("common.back", undefined, "Back");
  return `<div class="screen-head"><button class="back-btn" data-ui data-action="${backAction}" aria-label="${escapeHtml(back)}">${backSvg()}</button><h2>${icon ? `<span class="heading-art">${menuIcon(icon)}</span>` : ""}${escapeHtml(title)}</h2><span>${right}</span></div>`;
}

/**
 * A screen section heading: optional inline-SVG artwork, the title, and an
 * optional trailing note.
 *
 * The artwork used to be a leading emoji inside `main` (a trophy before
 * "Tournament Rank Prizes"), which read as a different typographic register
 * from the inline-SVG screen headings above it. It is now its own flex child of
 * `.section-title`, so the existing `gap` gives it a real spacing unit instead
 * of being glued into the text run — the same separation `head()` gets from
 * `.heading-art`.
 * `.heading-art` itself is NOT reused here: it is pinned to a 32×32 box by
 * `!important` in menu-polish.css for the 64px screen illustrations, which
 * would be three times the height of a 13px section title.
 */
export function sectionTitle(icon: SmIconName | null, main: string, sub?: string): string {
  return `<div class="section-title">${icon ? menuIconSm(icon) : ""}${main}${sub ? ` <small>${sub}</small>` : ""}</div>`;
}

export function upsellStrip(): string {
  if (!SELL_AD_REMOVAL) return "";
  return `<button class="upsell" data-ui data-action="open-paywall"><div><b>✦ Sunbird Gold &amp; VIP</b><span>2× coins · ad-free · Phoenix &amp; Aurora skins · Nest Pass</span></div><span class="mini-btn gold">Unlock · ● 500</span></button>`;
}