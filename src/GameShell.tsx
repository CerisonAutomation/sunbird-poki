import { forwardRef } from "react";

type GameShellProps = { bannerId?: string };

/** Stable host for the renderer and portal surfaces. Keeping this boundary small
 * lets the game boot independently while React owns the page-level shell. */
export const GameShell = forwardRef<HTMLDivElement, GameShellProps>(function GameShell(
  { bannerId },
  ref,
) {
  return (
    <>
      <div ref={ref} className="game-root" data-shell="sunbird" />
      {bannerId ? <div id={bannerId} className="portal-banner" aria-hidden="true" /> : null}
    </>
  );
});
