import "./boot";
import "./index.css";
import "./game/design-polish.css";
import { bootStage } from "./game/BootProgress";
import type { Game } from "./game/Game";
import { crashReporter } from "./game/resilience/CrashReporter";
import { mountPokiShell, showPokiBootError } from "./poki-shell";
import { preloadPortalSdk } from "./sdk/platform";

// Safari needs a touch listener for :active styling.
document.addEventListener("touchstart", () => {}, { passive: true });
preloadPortalSdk();
if (import.meta.env.DEV) void import("./game/DevPanelMount").then(m => m.installDevPanel());

const root = document.getElementById("root");
if (!root) throw new Error("Sunbird root element is missing");
const host = mountPokiShell(root);
let game: Game | null = null;
let cancelled = false;
let readyFrame = 0;

void (async () => {
  try {
    const { Game: GameCtor } = await import("./game/Game");
    if (cancelled) return;
    bootStage("chunk");
    game = new GameCtor(host);
    readyFrame = requestAnimationFrame(() => {
      if (cancelled) return;
      bootStage("ready");
      document.getElementById("boot-shell")?.remove();
      window.dispatchEvent(new Event("sunbird-ready"));
    });
  } catch (error) {
    if (cancelled) return;
    crashReporter.capture("error", error);
    document.getElementById("boot-shell")?.remove();
    window.dispatchEvent(new Event("sunbird-ready"));
    showPokiBootError(root, error);
  }
})();

// A full page navigation releases the scene. HMR needs explicit disposal.
if (import.meta.hot) import.meta.hot.dispose(() => {
  cancelled = true;
  cancelAnimationFrame(readyFrame);
  game?.dispose();
});
