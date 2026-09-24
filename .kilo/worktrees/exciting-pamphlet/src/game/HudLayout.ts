/**
 * The vertical band a floating flight banner is allowed to occupy.
 *
 * The flight HUD's header and footer are flow lanes whose heights are measured at
 * runtime and published as `--hud-header-height` / `--hud-footer-height` (the
 * ResizeObserver in `HUD.ts`). Everything else that floats — the goal pill, the
 * hint, the launch banner — was moved *into* a lane precisely so it could not
 * overlap them.
 *
 * The rank-up / personal-best banner cannot live in a lane: the lane's children
 * share one arbitrated slot (`feedbackSlot`), and a rare earned moment must not be
 * able to lose that arbitration. So it floats, and a floating element positioned
 * by a hardcoded viewport percentage is an overlap waiting to happen — 40 % of a
 * 640 px portrait phone is clear of a one-row footer, and inside a four-row footer
 * on a 360 px landscape one.
 *
 * The fix is arithmetic rather than a constant: centre the banner in the band that
 * is left after the two measured lanes are subtracted. These functions are the
 * readable form of the `calc()` the stylesheet uses, so the two can be tested
 * against each other instead of against a hope.
 */

export type LaneHeights = {
  /** Measured header lane, px. Falls back to the stylesheet's own default. */
  header: number;
  /** Measured footer lane, px. */
  footer: number;
  /** The viewport's CSS height, px. */
  viewport: number;
};

/** The stylesheet's fallbacks, so tests and CSS disagree loudly if either moves. */
export const HEADER_FALLBACK_PX = 110;
export const FOOTER_FALLBACK_PX = 65;

const finite = (v: number, fallback: number): number => (Number.isFinite(v) && v >= 0 ? v : fallback);

/**
 * The free band between the two lanes: where it starts and how tall it is.
 *
 * Never negative — a viewport shorter than its own chrome (a 200 px embedded
 * iframe under a 110 px header and a 65 px footer) yields a zero-height band and
 * the caller shrinks the banner rather than drawing it over the lanes.
 */
export function freeBand(lanes: LaneHeights): { top: number; height: number } {
  const header = finite(lanes.header, HEADER_FALLBACK_PX);
  const footer = finite(lanes.footer, FOOTER_FALLBACK_PX);
  const viewport = finite(lanes.viewport, 0);
  const height = Math.max(0, viewport - header - footer);
  return { top: header, height };
}

/**
 * Where the banner's centre belongs: the middle of the free band.
 *
 * Mid-band rather than band-top because the banner is `translate(-50%, -50%)`'d,
 * and because the middle of the free band is as far as possible from both lanes —
 * the position with the most room to be wrong about a measurement.
 */
export function bannerCentre(lanes: LaneHeights): number {
  const band = freeBand(lanes);
  return band.top + band.height / 2;
}

/**
 * Whether a banner of this height still clears both lanes at this centre.
 *
 * Used to decide the shrink: on a short viewport the banner gets smaller type and
 * padding until it fits the band, rather than being hidden — hiding a moment is
 * the bug this whole area exists to prevent.
 */
export function bannerFits(lanes: LaneHeights, bannerHeight: number): boolean {
  const h = finite(bannerHeight, 0);
  return h <= freeBand(lanes).height;
}

/**
 * The tallest banner the band can take, which is what the short-viewport type
 * scale has to stay under. Zero when the viewport is shorter than its chrome.
 */
export function bannerBudget(lanes: LaneHeights): number {
  return freeBand(lanes).height;
}
