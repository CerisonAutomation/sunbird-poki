/**
 * Portal edition strings — the WEB/generic/itch flavour.
 *
 * `vite.config.ts` swaps this module for `edition.poki.ts` / `edition.crazy.ts`
 * at build time (same plugin that shims the portal adapters), so every bundle
 * contains exactly ONE edition's strings. That is deliberate: a shared ternary
 * on the runtime portal name embeds all three names in every build, and portal
 * scanners flag a competitor's name in a bundle even when the branch is dead.
 *
 * Keep this file and its siblings in lockstep — same exports, same signatures.
 */
export const PORTAL_DISPLAY_NAME = "Portal";

/** Shown on the menu when the build has portal rewards (hidden when "none"). */
export const PORTAL_EDITION_NOTE = "Portal edition";

/** Label for the leaderboard-backend chip. */
export const LEADERBOARD_CLOUD_LABEL = "☁️ cloud";

/**
 * Words for a leaderboard with no cloud backend in this edition.
 *
 * An edition export, not a runtime `portalName === "…"` ternary: a shared
 * ternary embeds EVERY portal's name in EVERY bundle, which fails the
 * cross-portal isolation gate (`scripts/portal-markers.mjs`) and tells a player
 * about a portal they are not on. Each build carries only its own sentence.
 */
export const LEADERBOARD_LOCAL: { chip: string; sentence: string } = {
  chip: "\u{1F4BE} local",
  sentence: "Rankings are stored on this device. Fly well to climb!",
};

/** True only in the Poki build (Poki's netlib multiplayer transport). */
export const POKI_MULTIPLAYER = false;

/**
 * Club chat. OFF in every portal edition: the platforms forbid chat in
 * multiplayer surfaces (Poki rule REQ-31 — emotes/quick-messages are the
 * sanctioned alternative), so the chat box is not merely disabled at runtime
 * there, it is not in the bundle at all. The direct/web/itch build owns its
 * own surfaces and keeps it.
 */
export const SQUAD_CHAT = true;

/**
 * Free-text pilot names. OFF in every portal edition: the name is broadcast to
 * real players (netlib rooms, race rosters, floating name tags), and Poki's
 * content & player-safety policy allows no unmoderated player-authored text and
 * no collection of personal data. Portal pilots pick a curated generated name
 * with 🎲 Random instead, so the text field is not in those bundles at all.
 * The direct/web/itch build owns its own surfaces and keeps free rename.
 */
export const CUSTOM_PILOT_NAMES = true;

/**
 * Selling ad removal. OFF in every portal edition: the platform owns ad
 * scheduling and forbids in-app purchases, including any "remove ads" offer
 * (Poki rule REQ-20). Portal builds never inject interstitials of their own, so
 * on a portal the claim would be non-compliant *and* untrue.
 */
// Read from the Vite define so cross-module usage is constant-folded by Rollup,
// enabling dead-code elimination of IAP UI (e.g. "Remove breaks" button) in
// portal builds. VITE_SELL_AD_REMOVAL is pinned in vite.config.ts to a boolean
// literal (`PORTAL === "none"`), so no cast is needed and the fold is exact;
// portal editions override this to false via their own export, but the define
// wins for DCE.
export const SELL_AD_REMOVAL: boolean = !!import.meta.env.VITE_SELL_AD_REMOVAL;

/**
 * Does this build rehearse sponsored breaks with `MockAdProvider`?
 *
 * DEFAULT FALSE — and that default is the fix for a long-standing honesty bug:
 * the direct build has no ad network, so a "simulated" break interrupted a run
 * to show "Your ad is loading… Skip in 3" that never became an ad, while the
 * Gold pitch ("No sponsored breaks, ever") sold the removal of that non-ad.
 * Turning this on brings the whole surface back together — the break overlay,
 * the continue card's second-wind offer, the Account screen's daily cap copy
 * and the Gold ad-removal bullet — so the pitch and the product can never
 * disagree. Portal editions are unaffected: Poki/Crazy supply real
 * `commercialBreak` / `rewardedBreak` calls and own ad frequency (REQ-20).
 *
 * Enable with `VITE_SIM_BREAKS=true` (ad-flow rehearsal, or wiring a real
 * provider later). Keep every use site gated on this flag rather than on
 * `SELL_AD_REMOVAL`: the latter also drives the paywall/VIP UI, which is a
 * direct-build feature whether or not breaks exist.
 */
export const SIMULATED_BREAKS: boolean = !!import.meta.env.VITE_SIM_BREAKS;
