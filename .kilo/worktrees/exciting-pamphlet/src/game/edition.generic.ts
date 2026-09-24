/**
 * Portal edition strings — the portable "generic" build (GameDistribution,
 * Yandex, Newgrounds, GameMonetize, …).
 *
 * Swapped in for `edition.ts` by the portal-alias plugin in vite.config.ts.
 * See edition.ts for the contract (same exports, same signatures).
 *
 * It keeps the neutral branding (it is not tied to one portal) but follows the
 * portal surface rules: no chat, no external social surfaces.
 */
export const PORTAL_DISPLAY_NAME = "Portal";

export const PORTAL_EDITION_NOTE = "Portal edition";

export const LEADERBOARD_CLOUD_LABEL = "☁️ cloud";

/**
 * No cloud board and no portal to name: this bundle is uploaded to whichever
 * host takes it, so the copy stays about the device rather than about a brand.
 */
export const LEADERBOARD_LOCAL: { chip: string; sentence: string } = {
  chip: "\u{1F4BE} local",
  sentence: "Rankings are stored on this device. Fly well to climb!",
};

export const POKI_MULTIPLAYER = false;

/** Generic portal submissions ship no chat surface (Poki REQ-31 policy). */
export const SQUAD_CHAT = false;

/** No unmoderated player text or personal data (same policy as Poki). */
export const CUSTOM_PILOT_NAMES = false;

/** Portal ad scheduling belongs to the platform; no ad-removal purchase.
 * Unconditionally false: this is the edition's policy, not a build toggle.
 * DCE of the IAP UI comes from vite.config's VITE_SELL_AD_REMOVAL define being
 * folded at the use sites, not from this export. */
export const SELL_AD_REMOVAL = false;

/**
 * The portal adapter supplies real breaks and owns ad frequency: the
 * game never rehearses a break it cannot serve.
 */
export const SIMULATED_BREAKS = false;
