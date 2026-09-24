/**
 * Portal edition strings — the CrazyGames build.
 *
 * Swapped in for `edition.ts` by the portal-alias plugin in vite.config.ts.
 * See edition.ts for the contract (same exports, same signatures).
 */
export const PORTAL_DISPLAY_NAME = "CrazyGames";

export const PORTAL_EDITION_NOTE = "CrazyGames edition · portal rewards enabled";

export const LEADERBOARD_CLOUD_LABEL = "☁️ cloud";

/** No cloud board is configured in this edition: say so in the portal's words. */
export const LEADERBOARD_LOCAL: { chip: string; sentence: string } = {
  chip: "CrazyGames \u00b7 on-device",
  sentence: "This build keeps scores on your device.",
};

/** CrazyGames multiplayer is its own instant-multiplayer module, not netlib. */
export const POKI_MULTIPLAYER = false;

/** Portal submissions ship no chat surface (Poki REQ-31, same policy everywhere). */
export const SQUAD_CHAT = false;

/** No unmoderated player text or personal data (same policy as Poki). */
export const CUSTOM_PILOT_NAMES = false;

/** Portal ad scheduling belongs to the platform; no ad-removal purchase.
 * Unconditionally false: this is the edition's policy, not a build toggle.
 * DCE of the IAP UI comes from vite.config's VITE_SELL_AD_REMOVAL define being
 * folded at the use sites, not from this export. */
export const SELL_AD_REMOVAL = false;

/**
 * CrazyGames supplies real interstitial/rewarded calls and owns ad
 * frequency: the game never rehearses a break it cannot serve.
 */
export const SIMULATED_BREAKS = false;
