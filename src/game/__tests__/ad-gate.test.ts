import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { adBreakAllowsAction, adBreakCanEnd } from "../adGate";

/**
 * The action inventory is taken from the SHIPPING HUD MARKUP, not from a list
 * written here. A hand-written list of "actions to check" would go stale the
 * moment someone adds a button, and would prove only that the actions someone
 * remembered are blocked — the exact shape of a self-authored gate that passes
 * while the real one leaks.
 */
const hudSource = readFileSync(resolve(__dirname, "../HUD.ts"), "utf8");
const HUD_ACTIONS = [...new Set([...hudSource.matchAll(/data-action="([^"]+)"/g)].map((m) => m[1]!))];

describe("ad break gate", () => {
  it("discovers the real action inventory from the HUD markup", () => {
    // A canary: if the markup ever stops being parsed (renamed attribute, moved
    // template) this test would vacuously pass over an empty list. Fail loudly.
    expect(HUD_ACTIONS.length).toBeGreaterThan(40);
    expect(HUD_ACTIONS).toContain("ad-skip");
    expect(HUD_ACTIONS).toContain("back");
    expect(HUD_ACTIONS).toContain("pause");
  });

  it("blocks every HUD action during a PORTAL break — including its own skip buttons", () => {
    // The reward on this path is granted by the SDK's completion callback. Any
    // game-side action that ends the break early pays out for an ad that did
    // not run.
    for (const action of HUD_ACTIONS) {
      expect(adBreakAllowsAction(action, true), `${action} must be inert on a portal break`).toBe(false);
    }
  });

  it("allows only the game-owned skip controls during a PLACEHOLDER break", () => {
    for (const action of HUD_ACTIONS) {
      const allowed = action === "ad-skip" || action === "ad-gold";
      expect(adBreakAllowsAction(action, false), action).toBe(allowed);
    }
  });

  it("cannot leave the break through navigation, pause or the menu", () => {
    // The historical hole: input.setEnabled only gated the Input class, so the
    // HUD's own DOM buttons stayed clickable and walked the player out of a
    // live break. These are the escape hatches that must never open.
    for (const escape of ["back", "pause", "menu", "resume", "play-free", "open-shop", "settings", "close", "quit"]) {
      expect(adBreakAllowsAction(escape, false), escape).toBe(false);
      expect(adBreakAllowsAction(escape, true), escape).toBe(false);
    }
  });

  it("never lets a portal break be ended by the game, whatever the timer reads", () => {
    // adTimer is left at 0 on the SDK path, so `adTimer <= 0` was already true
    // during a real portal ad — an unguarded check handed out the reward.
    for (const timer of [-5, 0, 0.001, 1, 4, 99]) {
      expect(adBreakCanEnd(true, timer), `portal timer=${timer}`).toBe(false);
    }
  });

  it("ends a placeholder break only after its countdown has run out", () => {
    expect(adBreakCanEnd(false, 3.9)).toBe(false);
    expect(adBreakCanEnd(false, 0.001)).toBe(false);
    expect(adBreakCanEnd(false, 0)).toBe(true);
    expect(adBreakCanEnd(false, -1)).toBe(true);
  });

  it("pays the reward exactly once, on the timer path only", () => {
    // The two conditions a reward-bearing action has to satisfy at once: the
    // action is permitted AND the break may end. Neither alone awards anything.
    const tile = (action: string, portalOwned: boolean, adTimer: number) =>
      adBreakAllowsAction(action, portalOwned) && adBreakCanEnd(portalOwned, adTimer);
    expect(tile("ad-skip", false, 2)).toBe(false); // mid-countdown
    expect(tile("ad-skip", false, 0)).toBe(true); // countdown finished
    expect(tile("ad-skip", true, 0)).toBe(false); // portal: SDK only
    expect(tile("ad-gold", true, 0)).toBe(false); // portal: SDK only
    expect(tile("back", false, 0)).toBe(false); // not an ending action
  });
});
