/**
 * The in-game display-ad slot — one home for the container id and for whether
 * this build can actually fill it.
 *
 * Two things used to disagree, which is why display ads never shipped:
 *
 *  • `App.tsx` and `src/sdk/platform.ts` each read `VITE_PORTAL_BANNER_ID`
 *    independently. It is an optional CrazyGames-era placement id, it was never
 *    set for the Poki build, and nothing documented it — so React never
 *    rendered the host div and `Game` never found one to mount into.
 *
 *  • `PokiAdapter.mountBanner` reads `VITE_POKI_DISPLAY_AD_SIZE`, because
 *    Poki's `displayAd(container, size)` needs a per-game format the game
 *    cannot infer. That variable was declared nowhere outside the adapter, so
 *    it was never configured either, and the adapter returned early.
 *
 * Both halves are keyed off one predicate now: a Poki build with a configured
 * size gets a host element and a mounted ad; anything else renders nothing and
 * requests nothing, which is what keeps an unfilled slot from leaving a hole in
 * the layout.
 */

/** Element id of the container the portal renders a display ad into. */
export const BANNER_HOST_ID = "sunbird-portal-banner";

/**
 * Poki display-ad format for this game, or "" to leave the slot empty.
 *
 * The format is chosen per game on the Poki side and handed to the developer,
 * so it is configuration, not something the code can guess. Without it,
 * `displayAd()` is never called.
 */
export const POKI_DISPLAY_AD_SIZE = (
  (import.meta.env.VITE_POKI_DISPLAY_AD_SIZE as string | undefined) ?? ""
).trim();

/** True when this build can fill the banner slot. */
export function hasDisplayAd(): boolean {
  return POKI_DISPLAY_AD_SIZE !== "";
}
