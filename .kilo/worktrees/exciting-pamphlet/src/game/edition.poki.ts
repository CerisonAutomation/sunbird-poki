/**
 * Portal edition strings — the Poki build.
 *
 * Swapped in for `edition.ts` by the portal-alias plugin in vite.config.ts.
 * See edition.ts for the contract (same exports, same signatures).
 */
export const PORTAL_DISPLAY_NAME = "Poki";

export const PORTAL_EDITION_NOTE = "Poki edition · portal rewards enabled";

export const LEADERBOARD_CLOUD_LABEL = "☁️ Poki cloud";

/** No cloud board is configured in this edition: say so in the portal's words. */
export const LEADERBOARD_LOCAL: { chip: string; sentence: string } = {
  chip: "Poki \u00b7 on-device",
  sentence: "This build keeps scores on your device.",
};

/** Poki's netlib transport handles multiplayer; other builds have no room API. */
export const POKI_MULTIPLAYER = true;

/** Poki forbids chat in multiplayer surfaces (REQ-31) — emotes only. */
export const SQUAD_CHAT = false;

/**
 * Generated pilot names only — no free-text field in this edition.
 *
 * Portal builds broadcast the pilot name to real players (netlib rooms,
 * rosters, name tags), so a keyboard here means player-authored text leaving a
 * device into other people's screens. That is what the platform's content and
 * player-safety rules are about, and it is why `scripts/portal-markers.mjs`
 * treats `data-ref="pilotName"` as a forbidden marker in ANY portal bundle:
 * with this true the input survives into the shipped file and the compliance
 * gate fails. The name is still the player's — it is generated from a curated
 * word list and rerolled with one tap on the dice — and `isPilotNameClean`
 * still guards any name that arrives from a portal identity.
 */
export const CUSTOM_PILOT_NAMES = false;

/** Poki owns ad scheduling and forbids in-app purchases (REQ-20).
 * Unconditionally false: this is the edition's policy, not a build toggle.
 * DCE of the IAP UI comes from vite.config's VITE_SELL_AD_REMOVAL define being
 * folded at the use sites, not from this export. */
export const SELL_AD_REMOVAL = false;

/**
 * Poki supplies real `commercialBreak` / `rewardedBreak` calls and owns
 * ad frequency (REQ-20): the game never rehearses a break it cannot serve.
 */
export const SIMULATED_BREAKS = false;
