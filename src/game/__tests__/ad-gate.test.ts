import { describe, expect, it } from "vitest";
import { adBreakAllowsAction, adBreakCanEnd } from "../adGate";
import { HUD_ACTIONS } from "./hudSource";

/**
 * The action inventory is taken from the SHIPPING HUD MARKUP, not from a list
 * written here. A hand-written list of "actions to check" would go stale the
 * moment someone adds a button, and would prove only that the actions someone
 * remembered are blocked — the exact shape of a self-authored gate that passes
 * while the real one leaks.
 */

describe("ad break gate", () => {
  it("discovers the real action inventory from the HUD markup", () => {
    // A canary: if the markup ever stops being parsed (renamed attribute, moved
    // template) this test would vacuously pass over an empty list. Fail loudly.
    expect(HUD_ACTIONS.length).toBeGreaterThan(40);
    // `ad-skip` deliberately no longer appears in the markup: the placeholder
    // panel renders a read-only countdown chip and the break ends itself.
    expect(HUD_ACTIONS).not.toContain("ad-skip");
    expect(HUD_ACTIONS).toContain("ad-gold");
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

  it("allows only the upsell during a PLACEHOLDER break", () => {
    // Was `ad-skip || ad-gold`. `ad-skip` is gone: a placeholder break had no
    // self-exit, so pressing skip was the only way out of it and skipping was
    // therefore the intended exit from every break on a non-portal build. The
    // break now completes itself in fixedUpdate when the countdown lands.
    for (const action of HUD_ACTIONS) {
      expect(adBreakAllowsAction(action, false), action).toBe(action === "ad-gold");
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
    expect(tile("ad-skip", false, 2)).toBe(false); // gone: never permitted
    expect(tile("ad-skip", false, 0)).toBe(false); // gone: the break self-ends
    expect(tile("ad-skip", true, 0)).toBe(false); // portal: SDK only
    expect(tile("ad-gold", false, 2)).toBe(false); // upsell, mid-countdown
    expect(tile("ad-gold", false, 0)).toBe(true); // upsell, countdown done
    expect(tile("ad-gold", true, 0)).toBe(false); // portal: SDK only
    expect(tile("back", false, 0)).toBe(false); // not an ending action
  });
});
