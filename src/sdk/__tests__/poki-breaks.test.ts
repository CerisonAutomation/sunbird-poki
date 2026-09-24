/**
 * Portal ad breaks, pinned against the official Poki SDK contract
 * (`@poki/sdk` v0.0.5 → `PokiSDK.commercialBreak(onStart?)` and
 * `PokiSDK.rewardedBreak(onStartOrArgs?)`, the typed surface of
 * `https://game-cdn.poki.com/scripts/v2/poki-sdk.js`).
 *
 * Two properties matter more than the happy path, and neither was covered
 * before:
 *
 *  1. **A break that never starts must not wedge the game.** The portal decides
 *     whether an ad is available: it may resolve the opportunity without ever
 *     calling `onStart` (no fill, offline, ad-blocked region) or reject it
 *     outright. Both have to resolve our promise — a hung `await` here freezes
 *     a restart, a continue or a menu transition with the player staring at a
 *     spinner.
 *  2. **`onAdOpened` / `onAdClosed` must stay a balanced pair.** The game wraps
 *     portal breaks in `beginPortalBreak(reason)` … `endPortalAd()`. Reporting a
 *     close for a break that never opened leaves that bookkeeping unbalanced, so
 *     the *next* real break can never end. Hence: `onAdClosed` only when
 *     `onStart` actually fired.
 *
 * Also pinned: the reward decision comes from the promise result, not from the
 * callback argument. The SDK's typings let `onStart` receive `{ rewarded }`, but
 * trusting that would hand out rewards for ads the player skipped.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { PokiAdapter } from "../poki";
import type { PlatformEvents } from "../platform";

type Log = string[];

/** Record the ad lifecycle the game sees, in order. */
function recorder(): { log: Log; events: PlatformEvents } {
  const log: Log = [];
  const events = {
    onAdOpened: () => log.push("opened"),
    onAdClosed: () => log.push("closed"),
  } as unknown as PlatformEvents;
  return { log, events };
}

/** Install a stand-in CDN SDK global and hand back an adapter bound to it. */
function mount(sdk: Record<string, unknown>, events: PlatformEvents): PokiAdapter {
  vi.stubGlobal("window", Object.assign(window, { PokiSDK: sdk }));
  return new PokiAdapter(events);
}

afterEach(() => {
  delete (window as unknown as { PokiSDK?: unknown }).PokiSDK;
  vi.unstubAllGlobals();
});

describe("commercialBreak — the interstitial contract", () => {
  it("plays a real break: onStart fires, the pair stays balanced, the game resumes", async () => {
    const { log, events } = recorder();
    const commercialBreak = vi.fn((onStart?: () => void) => {
      onStart?.();
      return Promise.resolve();
    });
    const adapter = mount({ commercialBreak }, events);

    await expect(adapter.commercialBreak()).resolves.toBeUndefined();

    // Official signature: the SDK is handed a start hook, not a duration guess.
    expect(commercialBreak).toHaveBeenCalledTimes(1);
    expect(typeof commercialBreak.mock.calls[0]?.[0]).toBe("function");
    expect(log).toEqual(["opened", "closed"]);
  });

  it("resolves on no fill without reporting a break that never happened", async () => {
    const { log, events } = recorder();
    // The portal resolves the opportunity but never calls onStart: no ad played.
    const adapter = mount({ commercialBreak: vi.fn(() => Promise.resolve()) }, events);

    await expect(adapter.commercialBreak()).resolves.toBeUndefined();

    // No open, and therefore no close — an unmatched close would unbalance the
    // game's begin/endPortalAd pair and wedge the next real break.
    expect(log).toEqual([]);
  });

  it("swallows a rejected opportunity so a restart is never blocked", async () => {
    const { log, events } = recorder();
    const adapter = mount(
      { commercialBreak: vi.fn(() => Promise.reject(new Error("no ad available"))) },
      events,
    );

    await expect(adapter.commercialBreak()).resolves.toBeUndefined();
    expect(log).toEqual([]);
  });

  it("shows nothing at all off the Poki CDN — no simulated break", async () => {
    const { log, events } = recorder();
    // SDK object present but without the ad members (blocked CDN, local preview).
    const adapter = mount({ init: vi.fn() }, events);

    await expect(adapter.commercialBreak()).resolves.toBeUndefined();
    expect(log).toEqual([]);
    // "ads" is reported from the live SDK, not the build target, so the UI never
    // offers a break that can only fail.
    expect(adapter.capabilities()).not.toContain("ads");
  });

  it("survives a missing SDK global entirely", async () => {
    const { log, events } = recorder();
    delete (window as unknown as { PokiSDK?: unknown }).PokiSDK;
    const adapter = new PokiAdapter(events);

    await expect(adapter.commercialBreak()).resolves.toBeUndefined();
    expect(log).toEqual([]);
  });
});

describe("rewardedBreak — the reward truth", () => {
  it("rewards a watched break and reports the balanced pair", async () => {
    const { log, events } = recorder();
    const rewardedBreak = vi.fn((onStart?: (args?: { rewarded?: boolean }) => void) => {
      onStart?.();
      return Promise.resolve(true);
    });
    const adapter = mount({ rewardedBreak }, events);

    await expect(adapter.rewardedBreak()).resolves.toBe(true);
    expect(log).toEqual(["opened", "closed"]);
  });

  it("returns false when the player skips (no reward, no phantom break)", async () => {
    const { log, events } = recorder();
    const adapter = mount({ rewardedBreak: vi.fn(() => Promise.resolve(false)) }, events);

    await expect(adapter.rewardedBreak()).resolves.toBe(false);
    expect(log).toEqual([]);
  });

  it("takes the reward decision from the promise, not the callback argument", async () => {
    const { events } = recorder();
    // The typings allow onStart({ rewarded: true }); the promise disagrees.
    // Poki's documented contract is the resolved value — trusting the argument
    // would pay out for an ad that was skipped.
    const adapter = mount(
      {
        rewardedBreak: vi.fn((onStart?: (args?: { rewarded?: boolean }) => void) => {
          onStart?.({ rewarded: true });
          return Promise.resolve(false);
        }),
      },
      events,
    );

    await expect(adapter.rewardedBreak()).resolves.toBe(false);
  });

  it("returns false on rejection instead of throwing into the run-end flow", async () => {
    const { log, events } = recorder();
    const adapter = mount(
      { rewardedBreak: vi.fn(() => Promise.reject(new Error("blocked"))) },
      events,
    );

    await expect(adapter.rewardedBreak()).resolves.toBe(false);
    expect(log).toEqual([]);
  });

  it("returns false when the SDK exposes no rewarded member", async () => {
    const { events } = recorder();
    const adapter = mount({ commercialBreak: vi.fn(() => Promise.resolve()) }, events);

    await expect(adapter.rewardedBreak()).resolves.toBe(false);
    // A commercial-only SDK still counts as an ad surface…
    expect(adapter.capabilities()).toContain("ads");
  });
});
