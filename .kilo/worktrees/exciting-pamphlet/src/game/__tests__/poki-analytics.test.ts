import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import { GameplayEventSink } from "../GameplayEvents";
import { PokiAdapter } from "../../sdk/poki";

/**
 * Poki analytics coverage — the event surface that feeds Poki's dashboard.
 *
 * Poki's own analytics are driven entirely by the SDK calls the game makes:
 * loading lifecycle, gameplayStart/Stop, commercialBreak, rewardedBreak,
 * measure() and happyTime(). There is no separate analytics beacon to add — the correct
 * implementation is that every one of these calls forwards EXACTLY ONCE, in
 * an order the Inspector accepts (no consecutive duplicates), with ad-open /
 * ad-close bookkeeping that mutes and un-mutes the game around the break.
 *
 * These tests pin that contract at the adapter boundary with a recording SDK
 * double, and pin the sink's dedupe guarantees end to end.
 */

afterEach(() => {
  delete (window as unknown as { PokiSDK?: unknown }).PokiSDK;
});

type Calls = string[];
function recordingSdk() {
  const calls: Calls = [];
  const sdk = {
    gameLoadingFinished: () => calls.push("gameLoadingFinished"),
    gameplayStart: () => calls.push("gameplayStart"),
    gameplayStop: () => calls.push("gameplayStop"),
    // Canonical spelling and signature: PokiSDK.happyTime(intensity 0…1).
    happyTime: (intensity: number) => calls.push(`happyTime:${intensity}`),
    measure: (category: string, what: string, action: string) => calls.push(`measure:${category}/${what}/${action}`),
    commercialBreak: async (onStart?: () => void) => {
      calls.push("commercialBreak:open");
      onStart?.();
    },
    rewardedBreak: async (onStart?: () => void) => {
      calls.push("rewardedBreak:open");
      onStart?.();
      return true;
    },
  };
  return { calls, sdk };
}

function platformWith(calls: Calls, sdk: unknown): PokiAdapter {
  // The adapter reads the SDK off `window.PokiSDK` (the global the loader
  // script installs). Installing the double there is exactly what the real
  // boot path produces — no private-field surgery.
  (window as unknown as { PokiSDK?: unknown }).PokiSDK = sdk;
  return new PokiAdapter({
    onAdOpened: () => calls.push("ad:opened"),
    onAdClosed: () => calls.push("ad:closed"),
  });
}

describe("Poki analytics coverage (SDK event surface)", () => {
  it("forwards gameplayStart/Stop and loadingFinished exactly once each", () => {
    const { calls, sdk } = recordingSdk();
    const p = platformWith(calls, sdk);
    p.gameplayStart();
    p.gameplayStop();
    p.signalGameReady();
    expect(calls).toEqual(["gameplayStart", "gameplayStop", "gameLoadingFinished"]);
  });

  // The sink is the primary dedupe; the adapter is the boundary the portal
  // actually observes. Both must hold, because a future call path (visibility
  // handler, late SDK landing, defensive resend) should not be able to put a
  // duplicate into the Inspector's Event Log.
  it("the adapter itself refuses consecutive duplicates, whatever the caller does", () => {
    const { calls, sdk } = recordingSdk();
    const p = platformWith(calls, sdk);
    p.gameplayStart();
    p.gameplayStart();
    p.gameplayStop();
    p.gameplayStop();
    p.gameplayStop();
    p.gameplayStart();
    expect(calls).toEqual(["gameplayStart", "gameplayStop", "gameplayStart"]);
  });

  it("never tells the portal to stop a session it was never told began", () => {
    const { calls, sdk } = recordingSdk();
    const p = platformWith(calls, sdk);
    expect(p.gameplayIsRunning).toBe(false);
    p.gameplayStop();
    expect(calls).toEqual([]);
    p.gameplayStart();
    expect(calls).toEqual(["gameplayStart"]);
    expect(p.gameplayIsRunning).toBe(true);
  });

  it("fires happyTime(intensity) for milestone celebrations, clamped to Poki's 0…1 range", () => {
    const { calls, sdk } = recordingSdk();
    const p = platformWith(calls, sdk);
    p.happyTime(1);
    expect(calls).toEqual(["happyTime:1"]);
    // Out-of-range intensities are clamped, never forwarded raw: the Defold
    // guide documents the argument as "between 0 and 1".
    p.happyTime(4.2);
    p.happyTime(-3);
    p.happyTime(Number.NaN);
    expect(calls.slice(1)).toEqual(["happyTime:1", "happyTime:0", "happyTime:0"]);
  });

  it("forwards measure() as Poki's Game Events checkpoint, verbatim", () => {
    const { calls, sdk } = recordingSdk();
    const p = platformWith(calls, sdk);
    p.measure("round", "daytrip", "complete");
    expect(calls).toEqual(["measure:round/daytrip/complete"]);
  });

  it("commercialBreak forwards with ad-open/close bookkeeping, never throws into gameplay", async () => {
    const { calls, sdk } = recordingSdk();
    const p = platformWith(calls, sdk);
    await p.commercialBreak();
    expect(calls).toEqual(["commercialBreak:open", "ad:opened", "ad:closed"]);
  });

  it("rewardedBreak returns the SDK's verdict and books the ad lifecycle", async () => {
    const { calls, sdk } = recordingSdk();
    const p = platformWith(calls, sdk);
    await expect(p.rewardedBreak()).resolves.toBe(true);
    expect(calls).toEqual(["rewardedBreak:open", "ad:opened", "ad:closed"]);
  });

  it("a missing SDK is a silent no-op (off-portal preview stays analytics-free)", async () => {
    const p = platformWith([], undefined);
    expect(() => p.gameplayStart()).not.toThrow();
    expect(() => p.gameplayStop()).not.toThrow();
    expect(() => p.happyTime(1)).not.toThrow();
    expect(() => p.measure("round", "daytrip", "start")).not.toThrow();
    await expect(p.commercialBreak()).resolves.toBeUndefined();
    await expect(p.rewardedBreak()).resolves.toBe(false);
  });

  /**
   * Source contract for the mid-ad `gameplayStart` guard.
   *
   * The behaviour itself belongs to `Game`, which needs WebGL and is therefore
   * proven in a real browser by `e2e/poki-artifact.spec.ts`. What is pinned here
   * is the wiring that makes the guarantee structural, because it is the part
   * that silently rots: a new break placement added without the lock, or an
   * `endPortalAd()` that releases the lock after the caller's transition.
   */
  it("locks the state machine for the whole of every portal break", () => {
    const game = readFileSync(join(process.cwd(), "src", "game", "Game.ts"), "utf8");
    // The guard sits at the top of setState, before any state is mutated.
    expect(game).toMatch(/if \(this\.adInFlight && previous === "ad" && s !== "ad"\) return;/);
    // The lock is released first thing in endPortalAd, so the awaiting caller's
    // own transition (startRun / resume / menu / continue) is the way back in.
    const endAd = game.slice(game.indexOf("private endPortalAd(): void {"));
    expect(endAd.slice(0, 400)).toMatch(/this\.adInFlight = false;[\s\S]{0,200}setAdMuted\(false\)/);
    // Every portal placement enters through the one helper…
    expect(game.match(/this\.beginPortalBreak\("/g) ?? []).toHaveLength(5); // the five portal placements
    for (const placement of ["restart", "resume", "to-menu", "results-multiplier", "continue"]) {
      expect(game, `placement "${placement}" must take the lock`).toContain(`beginPortalBreak("${placement}")`);
    }
    // …and no portal break is left setting the ad state by hand.
    const manual = game.match(/this\.setState\("ad"\);/g) ?? [];
    expect(manual, "only the two self-served interstitials may set the ad state directly").toHaveLength(3);
  });

  it("the canonical death → break → restart lifecycle emits the exact dashboard order", async () => {
    const { calls, sdk } = recordingSdk();
    const p = platformWith(calls, sdk);
    const sink = new GameplayEventSink((phase) => (phase === "start" ? p.gameplayStart() : p.gameplayStop()));

    sink.send("start"); // player launches a run
    sink.send("stop"); // death
    sink.send("stop"); // defensive resend before the break — must be suppressed
    const brk = p.commercialBreak(); // the ad seam
    await brk; // the ad lifecycle completes before gameplay resumes
    sink.send("start"); // restart

    expect(calls).toEqual(["gameplayStart", "gameplayStop", "commercialBreak:open", "ad:opened", "ad:closed", "gameplayStart"]);
    // Poki's hard rule, asserted structurally: no two consecutive identical
    // gameplay events ever reach the SDK (ad bookkeeping entries excluded).
    const gameplay = calls.filter((c) => c === "gameplayStart" || c === "gameplayStop");
    for (let i = 1; i < gameplay.length; i++) {
      expect(gameplay[i], gameplay.join(",")).not.toBe(gameplay[i - 1]);
    }
  });

  it("a rewarded Second Wind books: stop is already sent, rewarded opens+closes, start returns", async () => {
    const { calls, sdk } = recordingSdk();
    const p = platformWith(calls, sdk);
    const sink = new GameplayEventSink((phase) => (phase === "start" ? p.gameplayStart() : p.gameplayStop()));

    sink.send("start");
    sink.send("stop"); // death — gameplay events stop before any ad
    const rewarded = await p.rewardedBreak();
    sink.send("start"); // Second Wind revives the run
    expect(rewarded).toBe(true);
    expect(calls).toEqual(["gameplayStart", "gameplayStop", "rewardedBreak:open", "ad:opened", "ad:closed", "gameplayStart"]);
  });

  it("sink dedupe is enforced even with a hot resend loop (Inspector's duplicate trap)", () => {
    const emit = vi.fn();
    const sink = new GameplayEventSink(emit);
    for (let i = 0; i < 50; i++) sink.send("start");
    for (let i = 0; i < 50; i++) sink.send("stop");
    sink.send("stop");
    expect(emit.mock.calls.map((c) => c[0])).toEqual(["start", "stop"]);
  });
});

describe("Poki ad-placement canon (guideline: breaks only at natural break points)", () => {
  // Reads the live source so a new call site can never ship unreviewed: every
  // commercial break must sit in a named placement method, and the placement
  // set must match Poki's documented break points exactly — restart, resume
  // from pause, back-to-menu for commercial breaks; Second-Wind continue and
  // the results 3× bonus for rewarded breaks. Mid-gameplay breaks are banned.
  it("routes every break through exactly the canonical placement methods", async () => {
    const fs = await import("node:fs");
    const join = (await import("node:path")).join;
    const src = fs.readFileSync(join(process.cwd(), "src", "game", "Game.ts"), "utf8");

    const commercial = [...src.matchAll(/await platform\.commercialBreak\(\)/g)].length
      + [...src.matchAll(/await this\.platform\?\.commercialBreak\(\)/g)].length;
    const rewarded = [...src.matchAll(/await platform\.rewardedBreak\(\)/g)].length;
    expect(commercial).toBe(3); // restartWithPortalBreak, resumeFromPause, menuAfterPortalBreak
    expect(rewarded).toBe(3); // multiplierWithPortalReward, continueWithPortalReward, multiplyCoinsFromShopAd

    for (const fn of ["restartWithPortalBreak", "resumeFromPause", "menuAfterPortalBreak"]) {
      expect(src).toContain(`private async ${fn}`);
    }
    for (const fn of ["continueWithPortalReward", "multiplierWithPortalReward", "multiplyCoinsFromShopAd"]) {
      expect(src).toContain(`private async ${fn}`);
    }
    // Every break request carries a placement label for the dashboard. The five
    // portal placements go through beginPortalBreak(placement) — one helper, so
    // the state lock and the telemetry cannot be added at one site and missed at
    // another; the shop's free-coin break is the exception that deliberately does
    // NOT bookend gameplay, so it tracks its own request.
    for (const placement of ["restart", "resume", "to-menu", "continue", "results-multiplier"]) {
      expect(src, `placement "${placement}" must enter through the shared helper`).toContain(`beginPortalBreak("${placement}")`);
    }
    expect(src).toContain('placement: "shop-free-coins"');
    // One request event per break: no placement may be tracked twice.
    const tracked = [...src.matchAll(/placement: "([a-z-]+)"/g)].map((m) => m[1]);
    expect(tracked.filter((p) => p === "to-menu")).toHaveLength(0);
  });
});
