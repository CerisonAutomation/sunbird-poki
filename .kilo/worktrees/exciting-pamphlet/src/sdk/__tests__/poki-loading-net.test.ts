import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The last-resort loading-screen net, target side (sdk/net.ts + sdk/poki.ts).
 *
 * `platform.ts` used to hold the raw `window.PokiSDK` fallback behind an
 * `if (TARGET !== "poki") return;` guard. The minifier folds positive
 * `TARGET === "poki"` branches but NOT that negative early-return, so the
 * "PokiSDK" text leaked into the CrazyGames and generic bundles — portal
 * scanners flag that. The body now lives in poki.ts, and only the registering
 * module names the global.
 *
 * These tests pin both halves:
 *   1. importing the real poki adapter registers a net that talks to the raw
 *      global (the crash path: no adapter was ever constructed), and
 *   2. the net is inert and silent when the SDK is absent.
 *
 * (Under vitest this file imports the REAL poki module: the portal shim is a
 * vite/build alias, and its importer-directory check does not apply here.
 * See platform-failsafe.test.ts for the adapter-path guard.)
 */
const calls: string[] = [];
/** Every member the net reached for on the global, canonical or not. */
const accessed: string[] = [];

describe("poki loading net", () => {
  beforeEach(() => {
    calls.length = 0;
    accessed.length = 0;
    vi.resetModules();
    // A recording Proxy rather than a hand-written double: the old double
    // declared `signalGameReady`, a member Poki's SDK does not have, so the net
    // "worked" in the test and silently did nothing in production. The Proxy
    // logs every member the code reaches for, canonical or not, and only really
    // implements the documented one.
    const real = { gameLoadingFinished: () => calls.push("gameLoadingFinished") };
    (window as unknown as { PokiSDK: unknown }).PokiSDK = new Proxy(real, {
      get(target, key) {
        accessed.push(String(key));
        return (target as unknown as Record<string | symbol, unknown>)[key];
      },
    });
  });

  afterEach(() => {
    delete (window as unknown as { PokiSDK?: unknown }).PokiSDK;
  });

  it("registers a net that releases the loading screen via the raw SDK global", async () => {
    // Importing the adapter is what registers the net (module-scope call).
    await import("../poki");
    const { runLoadingNet } = await import("../net");

    runLoadingNet();
    runLoadingNet(); // idempotent calls are allowed; the adapter dedupes its own

    expect(calls.filter((c) => c === "gameLoadingFinished")).toHaveLength(2);
    // The net touches exactly one member, and it is the documented conversion
    // marker. Anything else in `accessed` would be an invented SDK method.
    expect(new Set(accessed)).toEqual(new Set(["gameLoadingFinished"]));
  });

  it("never throws when the SDK never arrived (blocked script, CSP)", async () => {
    delete (window as unknown as { PokiSDK?: unknown }).PokiSDK;
    await import("../poki");
    const { runLoadingNet } = await import("../net");

    expect(() => runLoadingNet()).not.toThrow();
    expect(calls).toHaveLength(0);
  });

  it("is a no-op when nothing registered a net (non-portal builds)", async () => {
    const { runLoadingNet } = await import("../net");
    expect(() => runLoadingNet()).not.toThrow();
    expect(calls).toHaveLength(0);
  });
});
