/**
 * Poki SDK integration contract — pinned against the official wrapper
 * (`@poki/sdk`, github.com/poki/npm-sdk v0.0.5), which is the typed surface of
 * `https://game-cdn.poki.com/scripts/v2/poki-sdk.js`.
 *
 * These are the calls the platform actually observes, so a rename or a dropped
 * optional-chain here is a silent integration break on Poki:
 *
 *   • `init({ submitScore })` — the leaderboard handshake. The SDK hands back a
 *     submitter; without passing the option the portal leaderboards stay
 *     unwired and nothing fails loudly.
 *   • `showLeaderboard()` — Poki's own leaderboard overlay.
 *   • `playtestSetCanvas()` — Level-2 playtest recordings capture the canvas we
 *     register; without it the recordings come back with no gameplay in them.
 *   • `captureError()` — the only crash signal a portal build ever gets.
 *   • `getDeviceInfo()` / `openExternalLink()` — device class and the required
 *     broker for external navigation.
 *
 * Every SDK member is optional at runtime, so each case is asserted twice:
 * forwarding when present, and a silent no-op when absent.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PokiAdapter, pokiInitOptions, pokiLeaderboardReady, pokiSubmitScore } from "../poki";
import type { PlatformEvents } from "../platform";

type Call = { name: string; args: unknown[] };

/** A recording stand-in for the CDN SDK global. */
function stubSdk(present: string[]): { calls: Call[]; sdk: Record<string, unknown> } {
  const calls: Call[] = [];
  const sdk: Record<string, unknown> = {};
  for (const name of present) {
    sdk[name] = (...args: unknown[]) => {
      calls.push({ name, args });
      if (name === "getDeviceInfo") return { category: "tablet" };
      return undefined;
    };
  }
  return { calls, sdk };
}

const events = {} as unknown as PlatformEvents;

/** Register Poki's submitter the way the real SDK does during init(). */
function handshake(submit: (leaderboard: string, score: number) => void): void {
  pokiInitOptions().submitScore?.(submit);
}

/** Drop the submitter again so cases do not leak into each other. */
function dropHandshake(): void {
  pokiInitOptions().submitScore?.(undefined as unknown as (l: string, s: number) => void);
}

beforeEach(() => {
  dropHandshake();
});

afterEach(() => {
  dropHandshake();
  delete (window as unknown as { PokiSDK?: unknown }).PokiSDK;
  vi.unstubAllGlobals();
});

describe("leaderboard handshake (init({ submitScore }))", () => {
  it("hands the boot path an init option that captures Poki's submitter", () => {
    const submit = vi.fn();
    expect(pokiLeaderboardReady()).toBe(false);

    handshake(submit);

    expect(pokiLeaderboardReady()).toBe(true);
    expect(pokiSubmitScore(1234.6)).toBe(true);
    expect(submit).toHaveBeenCalledWith("distance", 1235); // rounded, named board
  });

  it("refuses to submit before the handshake and never throws without it", async () => {
    expect(pokiSubmitScore(900)).toBe(false);
    await expect(new PokiAdapter(events).submitPlatformScore(900)).resolves.toBeUndefined();
  });

  it("routes adapter score submissions through Poki's submitter", async () => {
    const submit = vi.fn();
    handshake(submit);

    await new PokiAdapter(events).submitPlatformScore(2480.4);

    expect(submit).toHaveBeenCalledWith("distance", 2480);
  });

  it("survives a submitter that throws (portal boards are a bonus surface)", async () => {
    handshake(() => {
      throw new Error("board unavailable");
    });
    expect(pokiSubmitScore(100)).toBe(false);
    await expect(new PokiAdapter(events).submitPlatformScore(100)).resolves.toBeUndefined();
  });

  it("ignores non-finite scores", () => {
    const submit = vi.fn();
    handshake(submit);
    expect(pokiSubmitScore(Number.NaN)).toBe(false);
    expect(submit).not.toHaveBeenCalled();
  });
});

describe("portal surfaces", () => {
  it("forwards showLeaderboard / captureError / playtestSetCanvas / openExternalLink", () => {
    const { calls, sdk } = stubSdk([
      "showLeaderboard",
      "captureError",
      "playtestSetCanvas",
      "openExternalLink",
      "getDeviceInfo",
    ]);
    vi.stubGlobal("window", Object.assign(window, { PokiSDK: sdk }));
    const adapter = new PokiAdapter(events);
    const canvas = document.createElement("canvas");
    const err = new Error("frame blew up");

    adapter.showLeaderboard();
    adapter.captureError(err);
    adapter.playtestSetCanvas(canvas);
    adapter.openExternalLink("https://example.org");

    expect(calls.map((c) => c.name)).toEqual([
      "showLeaderboard",
      "captureError",
      "playtestSetCanvas",
      "openExternalLink",
    ]);
    expect(calls[0]!.args).toEqual([null]); // no id → the portal's default board
    expect(calls[1]!.args[0]).toBe(err);
    expect(calls[2]!.args[0]).toBe(canvas);
    expect(calls[3]!.args[0]).toBe("https://example.org");
  });

  it("reports the portal's device class, so tablets are not forced onto the phone scheme", () => {
    const { sdk } = stubSdk(["getDeviceInfo"]);
    vi.stubGlobal("window", Object.assign(window, { PokiSDK: sdk }));
    expect(new PokiAdapter(events).deviceCategory()).toBe("tablet");
  });

  it("is inert when the deployed SDK lacks these methods", () => {
    vi.stubGlobal("window", Object.assign(window, { PokiSDK: {} }));
    const adapter = new PokiAdapter(events);

    expect(() => {
      adapter.showLeaderboard();
      adapter.captureError("x");
      adapter.playtestSetCanvas(null);
      adapter.openExternalLink("https://example.org");
    }).not.toThrow();
    expect(adapter.deviceCategory()).toBeNull();
  });

  it("only advertises the leaderboard capability when the SDK offers one", () => {
    const withBoard = stubSdk(["showLeaderboard", "playtestSetCanvas"]).sdk;
    vi.stubGlobal("window", Object.assign(window, { PokiSDK: withBoard }));
    const caps = new PokiAdapter(events).capabilities();
    expect(caps).toContain("leaderboard");
    expect(caps).toContain("playtestCanvas");

    vi.stubGlobal("window", Object.assign(window, { PokiSDK: {} }));
    const bare = new PokiAdapter(events).capabilities();
    expect(bare).not.toContain("leaderboard");
    expect(bare).not.toContain("playtestCanvas");
  });

  it("counts the handshake alone as a leaderboard capability", () => {
    vi.stubGlobal("window", Object.assign(window, { PokiSDK: {} }));
    handshake(() => undefined);
    expect(new PokiAdapter(events).capabilities()).toContain("leaderboard");
  });
});
