// Onboarding step 02 promises "Birds, trails and boosts for your next flight"
// but used to route the player to the Shop — a screen where you *spend* coins,
// not the Loadout, which is where you actually stage a bird/trail/booster loadout.
// A pilot who followed the first-run plan was sent to the wrong screen to learn
// the core pre-flight mechanic, and the step's own copy did not match its target.
//
// This asserts against the real rendered DOM (the mountHud harness drives the
// actual HUD), not a source-text grep, so a comment or a nearby unrelated
// `open-shop` cannot make it pass. Each assertion has been mutation-checked.
import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";

import { mountHud } from "./hudHarness";

/** Step 02's button, located by the title its copy gives it. */
function stepTwo(root: HTMLElement): HTMLElement {
  const el = root.querySelector<HTMLElement>('.onboarding-route-step[data-action="open-loadout"]');
  if (!el) throw new Error("no onboarding step routing to open-loadout");
  return el;
}

function firstSteps(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { shop: false, loadout: false, pve: false, pvp: false, settings: false, ...over };
}

describe("onboarding step 02 routes to the Loadout", () => {
  let hud: { dispose: () => void } | null = null;

  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
    });
    document.body.innerHTML = "";
  });
  afterEach(() => {
    hud?.dispose();
    hud = null;
  });

  it("targets open-loadout, not open-shop", async () => {
    const m = await mountHud({ state: "menu", settings: { reduceMotion: false, dismissedOnboarding: false }, firstSteps: firstSteps() });
    hud = m.hud as never;
    // The step must be the one wired to Loadout. If it still pointed at the shop
    // the whole point of the change is lost, and a presence-only test elsewhere
    // would not notice.
    expect(stepTwo(m.root).getAttribute("data-action")).toBe("open-loadout");
  });

  it("is marked done by seenLoadout, and NOT by seenShop", async () => {
    // Opening the Shop is no longer this step. A pilot who wandered into the
    // shop first must still be shown the Loadout step, or the plan loses a step
    // they never actually completed.
    const notDone = await mountHud({ state: "menu", settings: { reduceMotion: false, dismissedOnboarding: false }, firstSteps: firstSteps({ shop: true, loadout: false }) });
    expect(stepTwo(notDone.root).hasAttribute("disabled"), "shop visit wrongly completed the loadout step").toBe(false);
    notDone.hud.dispose();

    const done = await mountHud({ state: "menu", settings: { reduceMotion: false, dismissedOnboarding: false }, firstSteps: firstSteps({ shop: false, loadout: true }) });
    expect(stepTwo(done.root).hasAttribute("disabled"), "opening the loadout did not complete the step").toBe(true);
    done.hud.dispose();
  });

  it("its button label reads Customise, not Shop", async () => {
    const m = await mountHud({ state: "menu", settings: { reduceMotion: false, dismissedOnboarding: false }, firstSteps: firstSteps() });
    hud = m.hud as never;
    const label = stepTwo(m.root).querySelector("i")?.textContent ?? "";
    // The `go` affordance is the "where does this go" cue. If it still said
    // "Shop ›" the button and the target would disagree on screen.
    expect(label).toMatch(/customis/i);
    expect(label).not.toMatch(/shop/i);
  });

  it("stays reachable — the Shop is still offered elsewhere in the plan", async () => {
    const m = await mountHud({ state: "menu", settings: { reduceMotion: false, dismissedOnboarding: false }, firstSteps: firstSteps() });
    hud = m.hud as never;
    // Repointing step 02 must not remove the Shop from the quick-action rail /
    // elsewhere; if a future edit routes every step away, this is the canary.
    const opensShop = m.root.querySelectorAll('[data-action="open-shop"]').length;
    expect(opensShop, "the Shop became unreachable from the home screen").toBeGreaterThan(0);
  });
});
