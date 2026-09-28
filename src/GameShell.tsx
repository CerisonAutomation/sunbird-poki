import { forwardRef } from "react";
import { POKI_DISPLAY_AD_SIZE } from "./sdk/banner";

type GameShellProps = { bannerId?: string };

/**
 * Parse Poki's "WxH" display-ad format into CSS lengths.
 *
 * The SDK sizes its inner slot from this same string in px, so the host has to
 * match it exactly — a fixed-size host either clips the creative or leaves dead
 * space beside it. Returns null for anything that is not a plain WxH pair, in
 * which case the CSS fallbacks apply and the SDK's own parsing is the only thing
 * that can go wrong (a symbolic name would become NaN px inside the SDK).
 */
function bannerSize(format: string): { w: string; h: string } | null {
  const m = /^(\d{2,4})x(\d{2,4})$/i.exec(format.trim());
  return m ? { w: `${m[1]}px`, h: `${m[2]}px` } : null;
}

/** Stable host for the renderer and portal surfaces. Keeping this boundary small
 * lets the game boot independently while React owns the page-level shell. */
export const GameShell = forwardRef<HTMLDivElement, GameShellProps>(function GameShell(
  { bannerId },
  ref,
) {
  const size = bannerId ? bannerSize(POKI_DISPLAY_AD_SIZE) : null;
  return (
    <>
      <div ref={ref} className="game-root" data-shell="sunbird" />
      {bannerId ? (
        // Not aria-hidden. The slot carries a served advertisement — a
        // third-party creative with its own links — so hiding the whole subtree
        // from assistive tech hides content the player is entitled to reach.
        // It is a link, not decoration, so it is focusable and labelled.
        <div
          id={bannerId}
          className="portal-banner"
          role="complementary"
          aria-label="Advertisement"
          style={
            size
              ? ({ "--portal-banner-w": size.w, "--portal-banner-h": size.h } as React.CSSProperties)
              : undefined
          }
        />
      ) : null}
    </>
  );
});
