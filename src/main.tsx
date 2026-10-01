import "./boot";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// Last sheet in the cascade, on purpose. An `@import` at the foot of
// index.css does not work: CSS hoists @import to the top of the file, which
// would put this first and lose every specificity tie. Importing it here,
// after index.css, is the only way a sheet with zero `!important`
// declarations can win — and adding none was the point.
import "./game/design-polish.css";
import App from "./App";
import { preloadPortalSdk } from "./sdk/platform";

// Enables CSS :active styling and low-latency touch response on iOS WebKit
if (typeof document !== "undefined") {
  document.addEventListener("touchstart", () => {}, { passive: true });
}

// The portal SDK script starts loading NOW (before first paint) so it is
// ready by the first interactive frame — target-gated and failure-tolerant.
preloadPortalSdk();

// The dev tuning panel, on `). `import.meta.env.DEV` is a build-time
// substitution: a production bundle replaces it with false, this branch is
// dropped and the panel chunk is never emitted. It has to stay a dynamic
// import — a static one would pull the panel into the entry chunk of every
// build, production included.
if (import.meta.env.DEV) void import("./game/DevPanelMount").then((m) => m.installDevPanel());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// The game shell is intentionally network-served. A stale service worker can
// keep an older menu bundle alive after a deploy, so new builds do not install
// an app-shell worker. Existing workers self-clean in public/sw.js.
