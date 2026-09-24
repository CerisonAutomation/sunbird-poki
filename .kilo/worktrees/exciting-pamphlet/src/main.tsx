import "./boot";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./game/menu-polish.css";
import App from "./App";
import { preloadPortalSdk } from "./sdk/platform";

// Enables CSS :active styling and low-latency touch response on iOS WebKit
if (typeof document !== "undefined") {
  document.addEventListener("touchstart", () => {}, { passive: true });
}

// The portal SDK script starts loading NOW (before first paint) so it is
// ready by the first interactive frame — target-gated and failure-tolerant.
preloadPortalSdk();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// The game shell is intentionally network-served. A stale service worker can
// keep an older menu bundle alive after a deploy, so new builds do not install
// an app-shell worker. Existing workers self-clean in public/sw.js.
