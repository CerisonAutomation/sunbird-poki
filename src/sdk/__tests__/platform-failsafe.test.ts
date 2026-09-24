import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression guard for the Poki loading-screen failsafe (platform.ts).
 *
 * The failsafe exists so a crash or a headless WebGL failure can never leave
 * Poki's loading screen up. It used to call the raw `window.PokiSDK` global, so
 * on a HEALTHY boot it still fired `gameLoadingFinished()` a second time —
 * 1.5 s after window load — and Poki's Inspector flags a repeated loading
 * phase as an invalid event sequence. It now routes through the live adapter,
 * whose `loadingFinished()` is one-shot, and falls back to the target's
 * registered net (sdk/net.ts) only when no adapter exists — see
 * poki-loading-net.test.ts for that side.
 *
 * Found by e2e/poki-artifact.spec.ts, which recorded the duplicate in a real
 * browser; this test keeps it fixed without needing one.
 */
const calls: string[] = [];

type Events = Parameters<typeof import("../platform").initPlatform>[0];

const events = {
  onPortalMute: () => {},
  onPause: () => {},
  onResume: () => {},
} as unknown as Events;

describe("portal loading failsafe", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_PORTAL_TARGET", "poki");
    // The platform module keeps per-session state (the live adapter handle);
    // each test gets its own module instance so the two scenarios are
    // independent.
    vi.resetModules();
    calls.length = 0;
    (window as unknown as { PokiSDK: unknown }).PokiSDK = {
      init: () => {
        calls.push("init");
        return Promise.resolve();
      },
      gameLoadingStart: () => calls.push("gameLoadingStart"),
      gameLoadingFinished: () => calls.push("gameLoadingFinished"),
      movePill: () => {},
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    delete (window as unknown as { PokiSDK?: unknown }).PokiSDK;
  });

  it("does not re-send gameLoadingFinished after the adapter already finished", async () => {
    const platform = await import("../platform");
    // SDK bootstrap polls for window.PokiSDK every 100 ms; with fake timers
    // that poll only resolves when the clock is advanced.
    const pending = platform.initPlatform(events);
    await vi.advanceTimersByTimeAsync(200);
    const adapter = await pending;

    // Healthy boot: the game mounts and dismisses the loader itself.
    adapter.loadingFinished();
    expect(calls.filter((c) => c === "gameLoadingFinished")).toHaveLength(1);

    // The entry-point failsafe is scheduled on SDK bootstrap and used to fire
    // unconditionally 1.5 s after window load.
    platform.preloadPortalSdk();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(calls.filter((c) => c === "gameLoadingFinished")).toHaveLength(1);
  });

  it("still releases the loading screen when no game ever mounted", async () => {
    const platform = await import("../platform");

    // No adapter and no loadingFinished(): exactly the crash the net is for.
    platform.preloadPortalSdk();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(calls.filter((c) => c === "gameLoadingFinished")).toHaveLength(1);
  });
});
