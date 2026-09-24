import { installRejectionGuard } from "./rejection-guard";
import { bootStage } from "./game/BootProgress";
import { crashReporter } from "./game/resilience/CrashReporter";

// Order matters: the black box goes in before anything can throw. The
// rejection guard is installed immediately after so a rejection during
// module evaluation is captured, not just silenced.
crashReporter.install();
installRejectionGuard();

// Mirrors the TARGET check in sdk/platform.ts, but written here so the
// minifier can fully constant-fold it: vite inlines VITE_PORTAL_TARGET as a
// literal, and `"poki" !== "none"` folds to a constant — DCE then strips the
// whole retirement pass from portal bundles. Portals serve the game in
// iframes where workers are not allowed, and their scanners flag any
// service-worker API reference. (Builds only succeed with the lowercase
// values validated in vite.config.ts, so no toLowerCase is needed here.)
const IS_PORTAL = (import.meta.env.VITE_PORTAL_TARGET ?? "none") !== "none";

/** Retire only Sunbird's old worker/cache; don't erase other apps on portal origins. */
if (!IS_PORTAL && "serviceWorker" in navigator) {
  const workerUrl = new URL("./sw.js", location.href).href;
  void navigator.serviceWorker.getRegistrations().then(regs => {
    for (const reg of regs) {
      const script = (reg.active ?? reg.waiting ?? reg.installing)?.scriptURL;
      if (script === workerUrl) void reg.unregister();
    }
  }).catch(() => {});
}
if (!IS_PORTAL && "caches" in window) {
  void caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("sunbird-shell-")).map(k => caches.delete(k)))).catch(() => {});
}

// EA-04: the shell is the first boot stage, and it is already painted by the
// time this module runs (the loader is inline and needs no network) — so the
// progress bar starts from a truthful baseline instead of a fake timer.
// Static import on purpose: BootProgress has no dependencies, and a dynamic
// import here would add a round trip before the bar could move at all.
bootStage("shell");

const boot = document.getElementById("boot");
const copy = document.getElementById("boot-copy");
const retry = document.getElementById("boot-retry");
if (boot && copy && retry) {
  retry.addEventListener("click", () => location.reload());
  const timer = setTimeout(() => {
    if (!boot.isConnected) return;
    copy.textContent = "Still warming up. Slow connection? You can reload and try again.";
    retry.style.display = "block";
  }, 20000);
  window.addEventListener("sunbird-ready", () => clearTimeout(timer), { once: true });
  window.addEventListener("error", () => {
    if (!boot.isConnected) return;
    boot.classList.add("is-error");
    copy.textContent = "Sunbird could not start. Reload to try again.";
  }, { once: true });
}
