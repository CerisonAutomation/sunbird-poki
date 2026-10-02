/**
 * Every SDK call must wait for `PokiSDK.init()`, not for the SDK object to
 * exist.
 *
 * The field evidence: a phone e2e run logged a page error "The Poki SDK was not
 * yet booted" and a console error "Requesting ad before PokiSDK.init() is done".
 * The cause is a boot-order fact, not a missing method — the CDN script
 * installs `window.PokiSDK` on its first line and only then starts init, so
 * `typeof PokiSDK.commercialBreak === "function"` is true for the whole window
 * in which a break is guaranteed to be refused.
 *
 * The HTML5 doc is explicit that init must complete first, and explicit that
 * "not every commercialBreak() triggers an ad" — so a break requested too early
 * must quietly do nothing, not throw into the player.
 *
 * The LIFECYCLE calls are the other half of that same window and need the
 * opposite treatment: a refused `gameplayStart` is not free, because that call
 * is what arms the core's `startAdsAfter` timer. So the ad entry points wait by
 * not asking, and the lifecycle entry points wait by asking later.
 *
 * The flag is module state that only ever moves forward, which is why these
 * cases live in their own file: `poki-breaks.test.ts` and
 * `poki-analytics.test.ts` mark the SDK booted up front because they pin the
 * break contract, not the boot order.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PokiAdapter, pokiSdkBooted } from "../poki";
import type { PlatformEvents } from "../platform";

const events = {} as unknown as PlatformEvents;

/** An SDK double wired to throw exactly what the live SDK throws pre-init. */
function unbootedSdk(calls: string[]): Record<string, unknown> {
  const refuse = (name: string) => async (): Promise<never> => {
    calls.push(name);
    throw new Error("The Poki SDK was not yet booted");
  };
  return {
    init: () => Promise.resolve(),
    commercialBreak: refuse("commercialBreak"),
    rewardedBreak: refuse("rewardedBreak"),
  };
}

describe("ad requests before PokiSDK.init() has resolved", () => {
  beforeEach(() => {
    (window as unknown as { PokiSDK?: unknown }).PokiSDK = unbootedSdk([]);
  });

  afterEach(() => {
    delete (window as unknown as { PokiSDK?: unknown }).PokiSDK;
    vi.unstubAllGlobals();
  });

  it("starts unbooted, so nothing can mistake a live global for a live SDK", () => {
    expect(pokiSdkBooted()).toBe(false);
  });

  it("skips the commercial break instead of asking a half-booted SDK for one", async () => {
    const calls: string[] = [];
    (window as unknown as { PokiSDK?: unknown }).PokiSDK = unbootedSdk(calls);

    // No rejection, no throw: the break simply does not happen, which is what
    // the doc's "not every commercialBreak() triggers an ad" already allows.
    await expect(new PokiAdapter(events).commercialBreak()).resolves.toBeUndefined();
    expect(calls, "the SDK must never be asked before init resolves").toEqual([]);
  });

  it("denies the reward without asking, so a decline is never paid for", async () => {
    const calls: string[] = [];
    (window as unknown as { PokiSDK?: unknown }).PokiSDK = unbootedSdk(calls);

    await expect(new PokiAdapter(events).rewardedBreak()).resolves.toBe(false);
    expect(calls).toEqual([]);
  });

  it("does not advertise an ad surface the SDK cannot yet serve", () => {
    // The method is right there and would still refuse, so the honest answer to
    // "can you show a break?" is no. Reporting yes is what let the game walk a
    // player into the ad state for a break that was never coming.
    expect(new PokiAdapter(events).capabilities()).not.toContain("ads");
  });
});

describe("a Poki build whose SDK script never finishes init", () => {
  /**
   * The exact shape of the field failure, driven through the real boot path:
   * `initPlatform` races `bootstrapSdk()` against SDK_LOAD_TIMEOUT_MS, so on a
   * slow phone the game gets a working-looking adapter while init is still in
   * flight — and the pause-exit break then asked for an ad that was refused.
   */
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_PORTAL_TARGET", "poki");
    vi.resetModules();
    (window as unknown as { PokiSDK?: unknown }).PokiSDK = {
      // A slow handshake: the global is installed immediately, init lands much
      // later — precisely the window the field error came from. 30 s keeps it
      // well clear of the 4 s SDK load cap the game races it against.
      init: () => new Promise<void>((resolve) => { setTimeout(resolve, 30_000); }),
      gameLoadingStart: () => {},
      gameLoadingFinished: () => {},
      movePill: () => {},
      commercialBreak: () => {
        throw new Error("The Poki SDK was not yet booted");
      },
      rewardedBreak: () => {
        throw new Error("The Poki SDK was not yet booted");
      },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    delete (window as unknown as { PokiSDK?: unknown }).PokiSDK;
  });

  it("hands back an adapter that cannot ask for an ad while init is pending", async () => {
    const platform = await import("../platform");
    const { pokiSdkBooted: booted } = await import("../poki");

    // The SDK poll runs on a 100 ms interval; the 4 s load cap then releases
    // the game even though `init` has not resolved.
    const pending = platform.initPlatform(events);
    await vi.advanceTimersByTimeAsync(5_000);
    const adapter = await pending;

    expect(booted()).toBe(false);
    await expect(adapter.commercialBreak()).resolves.toBeUndefined();
    await expect(adapter.rewardedBreak()).resolves.toBe(false);
    expect(adapter.capabilities()).not.toContain("ads");
  });

  it("counts as booted once init resolves, and then the breaks go through", async () => {
    const platform = await import("../platform");
    const { pokiSdkBooted: booted } = await import("../poki");
    const asked: string[] = [];
    (window as unknown as { PokiSDK: Record<string, unknown> }).PokiSDK = {
      ...(window as unknown as { PokiSDK: Record<string, unknown> }).PokiSDK,
      commercialBreak: (onStart?: () => void) => { asked.push("commercialBreak"); onStart?.(); return Promise.resolve(); },
    };

    const pending = platform.initPlatform(events);
    await vi.advanceTimersByTimeAsync(5_000);
    await pending;
    expect(booted()).toBe(false);
    await expect((await pending).commercialBreak()).resolves.toBeUndefined();
    expect(asked, "still refused before init").toEqual([]);

    // init()'s own handshake timer is now due; fire it and let the boot path finish.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(booted()).toBe(true);
  });

  /**
   * The same boot window, but for the LIFECYCLE calls — and this one is the
   * field failure an e2e run reported as `The Poki SDK was not yet booted`.
   *
   * Unlike a break, a pre-boot lifecycle call is not a harmless no-op: the core
   * refuses it AND logs, and `gameplayStart` is what arms `startAdsAfter`, so
   * the refusal costs the session its automatic breaks. The calls therefore
   * have to be held and replayed, not merely skipped.
   */
  describe("lifecycle calls made while init is still in flight", () => {
    /** Lifecycle calls the live core receives, in order. */
    const sdkCalls = (calls: string[]): Record<string, unknown> => ({
      init: () => new Promise<void>((resolve) => { setTimeout(resolve, 30_000); }),
      gameLoadingStart: () => { calls.push("gameLoadingStart"); },
      gameLoadingFinished: () => { calls.push("gameLoadingFinished"); },
      gameplayStart: () => { calls.push("gameplayStart"); },
      gameplayStop: () => { calls.push("gameplayStop"); },
      movePill: () => {},
    });

    async function bootingAdapter(calls: string[]) {
      vi.resetModules();
      (window as unknown as { PokiSDK?: unknown }).PokiSDK = sdkCalls(calls);
      const platform = await import("../platform");
      const { pokiSdkBooted: booted, markPokiBooted } = await import("../poki");
      const pending = platform.initPlatform(events);
      await vi.advanceTimersByTimeAsync(5_000);
      const adapter = await pending;
      expect(booted(), "the 4 s load cap released the game before init resolved").toBe(false);
      return { adapter, markPokiBooted };
    }

    it("never asks the SDK for gameplay before init resolves", async () => {
      const calls: string[] = [];
      const { adapter } = await bootingAdapter(calls);

      // A pause and a resume inside the boot window — what a cold, slow-
      // network session actually does. The SDK double is the thing that has to
      // stay untouched: it is the call the real core answers with
      // "The Poki SDK was not yet booted".
      adapter.gameplayStop();
      adapter.gameplayStart();
      expect(calls, "pre-boot lifecycle calls are what the core refuses").toEqual([]);
    });

    it("delivers the deferred gameplayStart once init resolves, so breaks can arm", async () => {
      const calls: string[] = [];
      const { adapter, markPokiBooted: boot } = await bootingAdapter(calls);

      adapter.gameplayStart();
      expect(calls).toEqual([]);

      // The point of holding rather than dropping: without this replay the
      // core's `startAdsAfter` timer is never armed for the whole session.
      boot();
      expect(calls).toEqual(["gameplayStart"]);
    });

    it("collapses a pre-boot stop/start burst to the final gameplay state", async () => {
      const calls: string[] = [];
      const { adapter, markPokiBooted: boot } = await bootingAdapter(calls);

      adapter.gameplayStop();
      adapter.gameplayStart();
      boot();
      // Replaying both would tell the portal gameplay stopped and then started
      // again, arming an ad timer for a session that is already in flight.
      expect(calls).toEqual(["gameplayStart"]);
    });

    it("holds the loading phase markers too, and sends each exactly once", async () => {
      const calls: string[] = [];
      const { adapter, markPokiBooted: boot } = await bootingAdapter(calls);

      adapter.loadingStart();
      adapter.loadingFinished();
      adapter.loadingFinished();
      boot();
      expect(calls).toEqual(["gameLoadingStart", "gameLoadingFinished"]);
      // Re-sending a phase marker is what Poki's Inspector rejects.
      adapter.loadingFinished();
      expect(calls).toEqual(["gameLoadingStart", "gameLoadingFinished"]);
    });

    it("passes lifecycle calls straight through once the SDK has booted", async () => {
      const calls: string[] = [];
      const { adapter, markPokiBooted: boot } = await bootingAdapter(calls);

      boot();
      adapter.gameplayStart();
      adapter.gameplayStop();
      adapter.loadingStart();
      expect(calls).toEqual(["gameplayStart", "gameplayStop", "gameLoadingStart"]);
    });
  });
});
