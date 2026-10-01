/**
 * Where the transient message lanes go, from measurements rather than guesses.
 *
 * The flight HUD stacks four things down the middle of the screen: the coaching
 * band, the coach hand, the toast column and the impact-popup reservation. For a
 * long time each one was anchored by its own hand-written `calc()` — each
 * restating the header offset, each with its own per-breakpoint override. Four
 * lanes, four independent guesses about the same band, and they drifted into each
 * other: at 1200x762 the messages band and the popup reservation overlapped by
 * 27,040px², and in portrait the band landed inside the goal strip by 10,012px².
 *
 * The fix is not a fifth better guess. It is one measurement, read three times.
 *
 * The arithmetic is separated from the DOM because the interesting part is the
 * orientation problem, and that is testable without a browser: in portrait the
 * footer is TOP-anchored (design-polish.css), so `--hud-footer-height` measures a
 * band downward from the header rather than a reservation upward from the
 * viewport bottom, and every expression that subtracts it from a `bottom` or a
 * `100%` is subtracting the wrong number. Nothing in CSS can know which edge the
 * footer actually sits against; this can, because it is handed the answer.
 */

export const LANE_GAP_PX = 10;

/** Where the band would sit if it only had to clear the header. The chain pills
 *  live in the header's 4px..66px band and the band cannot start among them. */
export const MESSAGES_CHAIN_CLEAR_PX = 66;

/** How much of the free band the floor term keeps in hand below the band, so the
 *  last coaching line never lands on the quip lane. */
export const MESSAGES_TAIL_PX = 60;

export interface MessageBandInput {
  /** Height of the play area, in px. */
  hudPx: number;
  /** Distance from the play area's top to the bottom of the header lane. */
  headerPx: number;
  /** Is the footer pinned to the TOP of the play area (the portrait override)? */
  anchoredTop: boolean;
  /** The footer's thickness measured from whichever edge it is anchored to. */
  footerPx: number;
  /** Top of the quip lane, in the same top-down coordinates. */
  quipY: number;
  /** Top of the slope-chain pill, the other bottom-anchored flight lane. */
  slopeY: number;
  /** Measured height of the coach hand; 0 while it is `display:none`. */
  handPx: number;
  /** The band's height with no ceiling applied, i.e. what its content needs. */
  naturalBandPx: number;
}

export interface MessageBand {
  /** `--hud-messages-top`: where the band starts. */
  top: number;
  /** `--hud-messages-max`: the ceiling on the band's height. */
  maxPx: number;
  /** `--hud-messages-bottom`: where the coach hand starts. */
  bottom: number;
  /** `--hud-stack-bottom`: where the toast and popup lanes start, i.e. the
   *  bottom of the coach hand when it is showing. */
  stackBottom: number;
  /** `--hud-lane-floor`: the lowest edge the band may reach. */
  laneFloor: number;
  /** `--hud-chain-clear`: the top of the free band, i.e. the lowest edge the
   *  ring-chain pill may not sit on. */
  chainClear: number;
  /** `--hud-footer-bottom`: the footer's reservation from the BOTTOM. */
  footerBottom: number;
}

export function messageBand(input: MessageBandInput): MessageBand {
  const { hudPx, headerPx, anchoredTop, footerPx, quipY, slopeY, handPx, naturalBandPx } = input;
  // Nothing may start above the header, and in portrait nothing may start above
  // the TOP-anchored footer either — the same obstruction, stacked under the
  // header instead of against the viewport bottom.
  const ceiling = anchoredTop ? Math.max(headerPx + 4, footerPx + 8) : headerPx + 4;
  const floorY = hudPx - (anchoredTop ? 0 : footerPx);
  // Both bottom-anchored flight lanes are obstructions. The popup lane is a
  // reservation that spans the whole corridor, so the lower of the two is what
  // bounds it. `Math.max(top, …)` keeps a floor that has collapsed above the
  // band from reporting a floor higher than the band, which is how the popup
  // lane used to invert to zero height and silently stop rendering.
  const obstruction = Math.min(quipY, slopeY);
  // Prefer clearing the chain pills, but never past the room actually left.
  // Anchoring on `obstruction - TAIL` rather than on the footer's edge is what
  // keeps the band from being pushed past the lanes it has to stay above: with
  // only 47px between the header and the quip lane, `floorY - 60` put the band
  // 10px BELOW the quip lane, and the band measured zero height.
  const room = Math.max(ceiling, obstruction - MESSAGES_TAIL_PX);
  const preferred = Math.max(ceiling, headerPx + MESSAGES_CHAIN_CLEAR_PX);
  const top = Math.max(ceiling, Math.min(preferred, room));
  const laneFloor = Math.min(floorY, Math.max(top, obstruction));
  const maxPx = Math.max(0, Math.min(naturalBandPx, laneFloor - top - LANE_GAP_PX));
  const bottom = top + maxPx;
  const stackBottom = bottom + LANE_GAP_PX + (handPx > 0 ? handPx + LANE_GAP_PX : 0);
  return { top, maxPx, bottom, stackBottom, laneFloor, chainClear: ceiling, footerBottom: anchoredTop ? 0 : footerPx };
}

/** How far below the header the top-anchored footer is parked. `design-polish.css`
 *  pins it at `calc(var(--hud-header-height) + 8px)`, so a few px of slack
 *  separates "parked under the header" from "pinned to the bottom". */
export const FOOTER_TOP_ANCHOR_SLACK_PX = 16;

export interface FooterAnchorInput {
  /** The footer's own top edge, in the same top-down coordinates as `hudTop`. */
  footerTop: number;
  /** The play area's top edge. */
  hudTop: number;
  /** The header's full offset from the play area's top. */
  headerPx: number;
}

/**
 * Is the footer pinned to the TOP of the play area (the portrait override)?
 *
 * The obvious test — "is the footer's top in the upper half of the screen?" —
 * is wrong whenever the header is tall, and the header is tall exactly where
 * this matters most. On a 320x568 phone the header runs 290px down a 568px
 * screen, so the portrait footer parked under it at y 310 sits BELOW the
 * midpoint at y 284. The test called it bottom-anchored, reserved 258px from
 * the bottom instead of 427px from the top, and the message band was placed at
 * 306 — inside the footer's own 310..427 box, overlapping it by 196x51px.
 *
 * What actually distinguishes the two is the footer's relationship to the
 * HEADER, not to the viewport: the top-anchored footer is parked a few px below
 * the header's bottom edge whatever the viewport is shaped like, while a
 * bottom-anchored footer is pinned to the viewport's bottom edge and sits far
 * below the header on any screen with room for both.
 */
export function footerAnchoredTop({ footerTop, hudTop, headerPx }: FooterAnchorInput): boolean {
  return footerTop - hudTop <= headerPx + FOOTER_TOP_ANCHOR_SLACK_PX;
}

