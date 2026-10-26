/**
 * Dev-only bootstrap for the tuning panel. Mounted from src/main.tsx behind
 * `import.meta.env.DEV` — that is the ONLY gate, and it is a build-time
 * substitution, so a production bundle neither references this module nor emits
 * a chunk for it.
 *
 * The panel gets its own React root on `document.body` instead of a slot in the
 * app tree. Game.ts owns that tree, and a tool that forces a merge into it is a
 * tool that stops working the next time the game re-renders.
 */
import type { Root } from "react-dom/client";

/**
 * `Backquote` — the key the panel opens on.
 *
 * Taken by the game (Input.ts, unless a conflicting test says otherwise):
 * Space, W, A, S, D, ArrowUp, ArrowDown (dive); Enter, NumpadEnter,
 * ShiftRight, L (player 2); P, Escape (pause); R (restart); M (mute);
 * F (fullscreen); Tab, Enter, Space (OverlayNavigation focus handling); the
 * ArrowUp/Down/Left/Right + b,a Konami sequence (Game.ts). HudFeedback and
 * OverlayNavigation add nothing further.
 *
 * Backquote is free, sits next to Escape in every layout, and has no browser
 * default on the platforms this ships to.
 */
export const DEV_PANEL_KEY = "Backquote";

const HOST_ID = "sunbird-dev-panel-host";

export function installDevPanel(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  document.body.appendChild(host);

  let root: Root | null = null;
  let open = false;

  const render = (next: boolean): void => {
    open = next;
    void (async () => {
      const [{ createRoot }, { default: DevPanel }] = await Promise.all([
        import("react-dom/client"),
        import("./DevPanel"),
      ]);
      root ??= createRoot(host);
      root.render(open ? <DevPanel onClose={() => render(false)} /> : null);
    })();
  };

  window.addEventListener(
    "keydown",
    (e) => {
      if (e.code !== DEV_PANEL_KEY || e.repeat || e.isComposing) return;
      // Stops the host page's own quick-find / back-navigation chords.
      e.preventDefault();
      render(!open);
    },
    { capture: true },
  );
}
