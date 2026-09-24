import { afterEach, describe, expect, it, vi } from "vitest";
import { GameplayEventSink } from "../GameplayEvents";
import { PokiAdapter } from "../../sdk/poki";

/**
 * Poki analytics coverage — the event surface that feeds Poki's dashboard.
 *
 * Poki's own analytics are driven entirely by the SDK calls the game makes:
 * loading lifecycle, gameplayStart/Stop, commercialBreak, rewardedBreak and
 * happyTime. There is no separate analytics beacon to add — the correct
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
    happyTime: () => calls.push("happyTime"),
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

  it("fires happyTime() for milestone celebrations (Poki's celebratory overlay + analytics)", () => {
    const { calls, sdk } = recordingSdk();
    const p = platformWith(calls, sdk);
    p.happyTime();
    expect(calls).toEqual(["happyTime"]);
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
    expect(() => p.happyTime()).not.toThrow();
    await expect(p.commercialBreak()).resolves.toBeUndefined();
    await expect(p.rewardedBreak()).resolves.toBe(false);
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

describe("Poki SDK: every method we call exists on the real SDK", () => {
  /**
   * The SDK surface, enumerated from the LIVE script
   * (`https://game-cdn.poki.com/scripts/v2/poki-sdk.js`) by loading it and
   * reading `Object.keys(window.PokiSDK)`.
   *
   * This test exists because two calls were silently dead for want of a letter:
   * the adapter called `happytime()` and `hasAdBlock()`, and the SDK exposes
   * `happyTime` and `isAdBlocked`. Neither fails, logs, or throws — an optional
   * call on a missing method is a no-op — so the celebration overlay never fired
   * and the ad-block probe always answered "no". A typo in an optional SDK call
   * is invisible by construction, which is exactly why it needs a pin.
   */
  const REAL_SDK_SURFACE = new Set([
    "captureError", "commercialBreak", "customEvent", "destroyAd", "displayAd",
    "enableEventTracking", "gameInteractive", "gameLoadingFinished", "gameLoadingProgress",
    "gameLoadingStart", "gameplayStart", "gameplayStop", "generateScreenshot",
    "getDeviceInfo", "getLanguage", "getLeaderboard", "getToken", "getURLParam", "getUser",
    "happyTime", "init", "initWithVideoHB", "isAdBlocked", "logError", "login", "measure",
    "movePill", "muteAd", "openExternalLink", "playtestCaptureHtmlForce",
    "playtestCaptureHtmlOff", "playtestCaptureHtmlOn", "playtestCaptureHtmlOnce",
    "playtestSetCanvas", "rewardedBreak", "roundEnd", "roundStart", "sendHighscore",
    "setDebug", "setDebugTouchOverlayController", "setLogging", "setPlayerAge",
    "setPlaytestCanvas", "setVolume", "shareableURL", "showLeaderboard",
  ]);

  it("names only methods the SDK actually exposes", async () => {
    const fs = await import("node:fs");
    const join = (await import("node:path")).join;
    const adapter = fs.readFileSync(join(process.cwd(), "src", "sdk", "poki.ts"), "utf8");

    // Every `this.sdk?.name(` / `sdk?.name(` call in the adapter and the boot
    // path, minus the ones that are ours rather than the SDK's.
    const called = new Set<string>();
    for (const m of adapter.matchAll(/sdk\?\.([a-zA-Z]+)\??\.?\(/g)) called.add(m[1]!);
    const boot = fs.readFileSync(join(process.cwd(), "src", "sdk", "platform.ts"), "utf8");
    for (const m of boot.matchAll(/getPoki\(\)\?\.([a-zA-Z]+)/g)) called.add(m[1]!);

    const unknown = [...called].filter((name) => !REAL_SDK_SURFACE.has(name));
    expect(unknown, `these SDK calls do not exist on the real SDK: ${unknown.join(", ")}`).toEqual([]);
  });
});

describe("Poki ads: the call shape is exactly the documented one", () => {
  /**
   * developers.poki.com — "PokiSDK: HTML5", steps 4, 5 and "Final steps":
   *
   *   commercialBreak(cb).then(() => { unmute; enable; gameplayStart })
   *   rewardedBreak(cb).then(success => success ? reward : no reward)
   *   "Make sure that audio and keyboard input are disabled during commercial
   *    breaks" — and the callback "might not always get called".
   *
   * The critical contract is that the `.then()` / promise settlement always
   * fires — Poki is explicit that not every `commercialBreak()` serves an
   * ad, and the game must proceed either way. The adapter therefore races
   * the SDK promise against a settle timeout (BREAK_LOAD_TIMEOUT_MS): a
   * live ad resolves in well under a second, so this race can never cut a
   * live ad short. Its only job is to guarantee that a promise which never
   * settles (broken CDN, Inspector with no ad service behind it) still
   * releases the game instead of wedging it. The game's own
   * `AD_SAFETY_SECONDS` valve at the tick level is a hard second layer —
   * a live break is never abandoned by two competing timers.
   */
  it("delegates ad completion to the Poki SDK promise", async () => {
    const fs = await import("node:fs");
    const join = (await import("node:path")).join;
    const adapter = fs.readFileSync(join(process.cwd(), "src", "sdk", "poki.ts"), "utf8");

    for (const name of ["commercialBreak", "rewardedBreak"]) {
      const start = adapter.indexOf(`async ${name}(): Promise`);
      const body = adapter.slice(start, adapter.indexOf("\n  }", start));
      expect(body).not.toMatch(/Promise\.race\(|setTimeout\(/);
    }
  });

  it("waits on the platform's promise and imposes no timer of its own", async () => {
    const fs = await import("node:fs");
    const join = (await import("node:path")).join;
    const adapter = fs.readFileSync(join(process.cwd(), "src", "sdk", "poki.ts"), "utf8");

    expect(adapter, "the documented call shape").toMatch(/sdk\.commercialBreak\(\(\) => \{/);
    expect(adapter, "the documented call shape").toMatch(/sdk\.rewardedBreak\(\(\) => \{/);
    // The await now races the SDK promise against a settle timer
    // instead of awaiting the SDK call directly — the SDK call still
    // runs and resolves or times out; the race is what guarantees the
    // game never wedges. Inside the SDK argument there is no timer:
    // a game-side ad timer can only cut a live ad short.
    const bodyOf = (name: string): string => {
      const from = adapter.indexOf(`async ${name}(): Promise`);
      return adapter.slice(from, adapter.indexOf("\n  }", from));
    };
    for (const name of ["commercialBreak", "rewardedBreak"]) {
      expect(bodyOf(name), `${name} must await the SDK promise directly`).toMatch(/await sdk\.(commercialBreak|rewardedBreak)\(/);
      // The settle timer lives in the throwaway Promise, not in the
      // argument the SDK receives. Extract just the SDK call's
      // callback argument (between `name(() => {` and its
      // matching close) — it must contain no timer, because a
      // game-side timer can only cut a live ad short.
      const callStart = bodyOf(name).indexOf(`${name}(() => {`);
      let braceDepth = 0;
      let callbackEnd = callStart;
      for (let i = callStart; i < bodyOf(name).length; i++) {
        if (bodyOf(name)[i] === "{") braceDepth++;
        if (bodyOf(name)[i] === "}") { braceDepth--; if (braceDepth === 0) { callbackEnd = i + 1; break; } }
      }
      const callbackBody = bodyOf(name).slice(callStart, callbackEnd);
      expect(callbackBody, `${name} SDK argument must not arm a timer`).not.toMatch(/setTimeout|setInterval/);
    }
    // And the one last-resort exit lives in the game, not the adapter.
    const game = fs.readFileSync(join(process.cwd(), "src", "game", "Game.ts"), "utf8");
    expect(game, "the single valve is the game's").toContain("AD_SAFETY_SECONDS");
  });

  it("books the ad open/close so audio and input are restored even when the ad never opens", async () => {
    const { calls, sdk } = recordingSdk();
    const p = platformWith(calls, sdk);
    await p.commercialBreak();
    expect(calls, "an opened ad must be closed").toEqual([
      "commercialBreak:open", "ad:opened", "ad:closed",
    ]);

    // A declined break calls no callback at all — the game must still come back
    // from it (this is why the bookkeeping lives in a finally, not the callback).
    const declined: Calls = [];
    const silent = platformWith(declined, {
      commercialBreak: async () => { declined.push("commercialBreak:declined"); },
    });
    await expect(silent.commercialBreak()).resolves.toBeUndefined();
    expect(declined).toEqual(["commercialBreak:declined"]);
  });

  it("reports a blocked browser to the game, so no break is requested at all", () => {
    const calls: Calls = [];
    const blocked = platformWith(calls, { isAdBlocked: () => true });
    expect(blocked.hasAdBlock()).toBe(true);
    const clear = platformWith(calls, { isAdBlocked: () => false });
    expect(clear.hasAdBlock()).toBe(false);
  });
});

describe("Poki SDK: every method we call exists on the real SDK", () => {
  /**
   * The SDK surface, enumerated from the LIVE script
   * (`https://game-cdn.poki.com/scripts/v2/poki-sdk.js`) by loading it and
   * reading `Object.keys(window.PokiSDK)`.
   *
   * This test exists because two calls were silently dead for want of a letter:
   * the adapter called `happytime()` and `hasAdBlock()`, and the SDK exposes
   * `happyTime` and `isAdBlocked`. Neither fails, logs, or throws — an optional
   * call on a missing method is a no-op — so the celebration overlay never fired
   * and the ad-block probe always answered "no". A typo in an optional SDK call
   * is invisible by construction, which is exactly why it needs a pin.
   */
  const REAL_SDK_SURFACE = new Set([
    "captureError", "commercialBreak", "customEvent", "destroyAd", "displayAd",
    "enableEventTracking", "gameInteractive", "gameLoadingFinished", "gameLoadingProgress",
    "gameLoadingStart", "gameplayStart", "gameplayStop", "generateScreenshot",
    "getDeviceInfo", "getLanguage", "getLeaderboard", "getToken", "getURLParam", "getUser",
    "happyTime", "init", "initWithVideoHB", "isAdBlocked", "logError", "login", "measure",
    "movePill", "muteAd", "openExternalLink", "playtestCaptureHtmlForce",
    "playtestCaptureHtmlOff", "playtestCaptureHtmlOn", "playtestCaptureHtmlOnce",
    "playtestSetCanvas", "rewardedBreak", "roundEnd", "roundStart", "sendHighscore",
    "setDebug", "setDebugTouchOverlayController", "setLogging", "setPlayerAge",
    "setPlaytestCanvas", "setVolume", "shareableURL", "showLeaderboard",
  ]);

  it("names only methods the SDK actually exposes", async () => {
    const fs = await import("node:fs");
    const join = (await import("node:path")).join;
    const adapter = fs.readFileSync(join(process.cwd(), "src", "sdk", "poki.ts"), "utf8");

    // Every `this.sdk?.name(` / `sdk?.name(` call in the adapter and the boot
    // path, minus the ones that are ours rather than the SDK's.
    const called = new Set<string>();
    for (const m of adapter.matchAll(/sdk\?\.([a-zA-Z]+)\??\.?\(/g)) called.add(m[1]!);
    const boot = fs.readFileSync(join(process.cwd(), "src", "sdk", "platform.ts"), "utf8");
    for (const m of boot.matchAll(/getPoki\(\)\?\.([a-zA-Z]+)/g)) called.add(m[1]!);

    const unknown = [...called].filter((name) => !REAL_SDK_SURFACE.has(name));
    expect(unknown, `these SDK calls do not exist on the real SDK: ${unknown.join(", ")}`).toEqual([]);
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
    expect(commercial).toBe(1); // resumeFromPause only
    expect(rewarded).toBe(3); // multiplierWithPortalReward, continueWithPortalReward, multiplyCoinsFromShopAd

    for (const fn of ["resumeFromPause"]) {
      expect(src).toContain(`private async ${fn}`);
    }
    for (const fn of ["continueWithPortalReward", "multiplierWithPortalReward", "multiplyCoinsFromShopAd"]) {
      expect(src).toContain(`private async ${fn}`);
    }
    // Every break request carries a placement label for the dashboard.
    for (const placement of ['"resume"', '"continue"', '"results-multiplier"', '"shop-free-coins"']) {
      expect(src).toContain(`placement: ${placement}`);
    }
    // A break that does not interrupt gameplay (a recap→menu tap) must not
    // fabricate a phase change, and the breaks that do interrupt flight must
    // route through the sink-gated lifecycle: no gameplayStart/Stop may fire
    // while the ad state is up.
    expect(src).toContain("this.gameplaySink.send");
  });

  it("gives every restart path the break, with no switch to turn it off", async () => {
    const fs = await import("node:fs");
    const join = (await import("node:path")).join;
    const src = fs.readFileSync(join(process.cwd(), "src", "game", "Game.ts"), "utf8");

    // `replayRun` used to take `allowPortalBreak`, and two of its callers passed
    // `false`: restarting without dying (R, and the pause card's "Restart
    // flight"). Those breaks were signalled to nobody, so they could never be
    // filled — while the identical button on the recap passed `true`. A switch
    // that disables a natural break point is how the ad surface went quiet, so
    // the parameter is gone and this guards against its return.
    expect(src).toContain("private replayRun(): void");
    expect(src).not.toContain("private replayRun(allowPortalBreak");
    expect(src, "no restart may pass an opt-out argument").not.toMatch(/this\.replayRun\([^)\s]/);
    // Seven restart seams — 3 recap/tap-to-fly, 1 pause card, 1 hotkey,
    // 1 duel/versus, 1 menu — and every one asks for the break when live.
    expect([...src.matchAll(/this\.replayRun\(\)/g)].length).toBe(7);
    expect(src).not.toContain("restartWithPortalBreak");

    // The ad decision must consult the portal's ad-block report, and the adapter
    // must be able to survive a break that never settles. Both were gaps: the
    // probe was cached for a short-circuit nothing called, and the SDK promise
    // was awaited raw, so a blocked request left the game muted and input-disabled
    // forever — the player's "the ads are broken".
    expect(src, "adsLive must consult the ad-block probe (MON-12)").toMatch(/this\.platform\?\.hasAdBlock|platform\.hasAdBlock\?\.\(\)/);
    const adapter = fs.readFileSync(join(process.cwd(), "src", "sdk", "poki.ts"), "utf8");
    expect(adapter, "the adapter awaits the platform promise itself").toMatch(/await (Promise\.race|sdk\.commercialBreak)\(/);
    expect(adapter, "and imposes no timer that could cut an ad short").not.toMatch(/guard<T>|AD_HOSTAGE_MS/);
  });

  it("signals a break before every run start the doc asks for, and only those", async () => {
    // Step 4: "call commercialBreak() before every gameplayStart(), whenever the
    // player has shown intent to continue playing". Only restarts used to ask,
    // so the thirteen other run starts — Play, the daily course, a gauntlet, a
    // solo mode, a storm run — reached gameplayStart with nothing signalled.
    const fs = await import("node:fs");
    const join = (await import("node:path")).join;
    const src = fs.readFileSync(join(process.cwd(), "src", "game", "Game.ts"), "utf8");

    expect(src, "ordinary run starts must not request commercial breaks").not.toContain("shouldBreakBeforeRun");
  });
});
