/**
 * Loading-screen net — the adapter-independent last resort that releases a
 * portal's loading screen when no adapter was ever constructed: a crash
 * before `initPlatform()`, a blocked SDK script, or a headless WebGL failure.
 *
 * Why a registry instead of a direct call: the net's *body* is portal
 * specific (it can only call the raw SDK global), so it lives in the target
 * adapter module — `poki.ts` registers one. Shared code (this module and the
 * failsafe in platform.ts) therefore carries no portal SDK reference at all,
 * and a non-Poki bundle contains no `window.PokiSDK` text: `vite.config.ts`
 * aliases the other adapters to `_shim.ts`, so the registering module is not
 * even in their module graph.
 *
 * (This replaced an `if (TARGET !== "poki") return;` guard in shared code.
 * The minifier folds positive `TARGET === "poki"` branches — the poki CDN URL
 * is absent from every other bundle — but it does NOT fold the negative
 * early-return, so the raw-global text used to survive into the CrazyGames and
 * generic builds and trip their scanners.)
 */
type LoadingNet = () => void;

let net: LoadingNet | null = null;

/** Register the target adapter's net. Module-scope call from the adapter. */
export function setLoadingNet(fn: LoadingNet): void {
  net = fn;
}

/** Run the registered net, if any. Never throws — it is the last resort. */
export function runLoadingNet(): void {
  try {
    net?.();
  } catch {
    /* ignore */
  }
}
