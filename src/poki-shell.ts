import { BANNER_HOST_ID, POKI_DISPLAY_AD_SIZE, hasDisplayAd } from "./sdk/banner";

/** The Poki game is DOM-over-canvas; its production shell needs no UI framework. */
export function mountPokiShell(root: HTMLElement): HTMLElement {
  const gameHost = document.createElement("div");
  gameHost.className = "game-root";
  gameHost.dataset.shell = "sunbird";
  root.replaceChildren(gameHost);

  if (hasDisplayAd()) {
    const banner = document.createElement("div");
    banner.id = BANNER_HOST_ID;
    banner.className = "portal-banner";
    banner.setAttribute("role", "complementary");
    banner.setAttribute("aria-label", "Advertisement");
    const size = /^(\d{2,4})x(\d{2,4})$/i.exec(POKI_DISPLAY_AD_SIZE);
    if (size) {
      banner.style.setProperty("--portal-banner-w", `${size[1]}px`);
      banner.style.setProperty("--portal-banner-h", `${size[2]}px`);
    }
    root.appendChild(banner);
  }
  return gameHost;
}

/** A failed boot must be readable, actionable, and safe for arbitrary errors. */
export function showPokiBootError(root: HTMLElement, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const chunkFailed = /fetch|import|module|chunk|network|load failed/i.test(message);
  const panel = document.createElement("main");
  panel.style.cssText = "position:fixed;inset:0;display:grid;place-items:center;background:#1a1430;color:#fff6e8;font-family:sans-serif;padding:24px;text-align:center";
  const content = document.createElement("div");
  const title = document.createElement("h1");
  title.textContent = chunkFailed ? "The flight download was interrupted" : "Sunbird can’t spread its wings here";
  const description = document.createElement("p");
  description.textContent = chunkFailed
    ? "Check your connection, then try again. A new game version may have arrived while this page was open."
    : "The game could not start. Try reloading, or check that your browser supports WebGL and hardware acceleration is enabled.";
  const button = document.createElement("button");
  button.textContent = "Try again";
  button.style.cssText = "font:inherit;border:0;border-radius:12px;padding:10px 18px;background:#ff7a45;color:#fff;font-weight:700;cursor:pointer";
  button.addEventListener("click", () => window.location.reload());
  content.append(title, description, button);
  panel.append(content);
  root.replaceChildren(panel);
}
