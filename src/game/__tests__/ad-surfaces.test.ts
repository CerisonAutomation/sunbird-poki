import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HudSnapshot } from "../HUD";

/**
 * The ad surfaces, rendered and read back.
 *
 * The platform only ever shows a real ad on Poki, so what can be verified here
 * is the surface the player interacts with around one: what the break overlay
 * says and offers, whether the rewarded option is on the card at all, and
 * whether a break can be skipped or dismissed when it cannot be. Every
 * assertion below is a property of the DOM, which is the check available to us —
 * a screenshot of an ad is not, and the ad creative is Poki's to render.
 *
 * The rules these pin:
 *   • MON-12 — a rewarded option is only offered when an ad can actually run,
 *     and a failed break is handled without inventing one.
 *   • MON-19 — the rewarded offer is context-driven, and the copy matches the
 *     interaction event measured for the same placement.
 *   • REQ-20 — no "remove ads" upsell reaches a portal edition (REQ-31 is the
 *     no-chat rule and does not cover this).
 */

/** Any field the renderer asks for resolves to another stub, so a partial
 *  snapshot renders without pinning every field in the type. */
type LooseSnapshot = Record<string, unknown>;
function snapshotStub(): LooseSnapshot {
  const target = function () {} as unknown as LooseSnapshot;
  return new Proxy(target, {
    get(t, prop, recv) {
      if (Reflect.has(t, prop)) return Reflect.get(t, prop, recv);
      if (prop === Symbol.toPrimitive || prop === "toString" || prop === "valueOf") return () => "";
      if (prop === Symbol.iterator) return function* () {};
      if (prop === "length") return 0;
      if (prop === "then") return undefined;
      if (["map", "slice", "filter", "join", "flatMap"].includes(String(prop))) return () => [];
      return snapshotStub();
    },
    set(t, prop, value) {
      return Reflect.set(t, prop, value);
    },
  });
}

async function render(over: LooseSnapshot): Promise<HTMLElement> {
  const { HUD } = await import("../HUD");
  const hud = new HUD(document.body);
  const snap = snapshotStub();
  Object.assign(snap, {
    state: "ad",
    screen: "main",
    portalName: "poki",
    pilotName: "Skywing",
    settings: { reduceMotion: false, mute: false },
    ...over,
  });
  hud.update(snap as unknown as HudSnapshot);
  return document.querySelector<HTMLElement>(".hud-root")!;
}

beforeEach(() => {
  // jsdom has no ResizeObserver; the HUD constructs one to watch its flow
  // containers (test-environment shim, not a product double).
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("the break overlay", () => {
  it("tells the player an advertisement is on the way, on the portal's own break", async () => {
    const root = await render({ state: "ad", portalName: "poki", adSkippable: false, adTimer: 0, adTotal: 4 });
    const card = root.querySelector('[data-ref="adCard"]');
    expect(card, "the break card must render").not.toBeNull();
    // Two disclosures, two jobs: the label says WHICH break this is, and the
    // card's header tells the player an advertisement is what they are waiting
    // for (a spinner with no explanation reads as a crash).
    expect(card!.querySelector(".ad-label")?.textContent ?? "", "the label names the break").toMatch(/break/i);
    expect(card!.querySelector(".portal-ad-wait h3")?.textContent ?? "", "the card says what it is waiting for").toMatch(/advert/i);
    // The portal serves this one and ends it; the game must not draw a progress
    // bar of its own or offer a way out of it (MON-12 / ad integrity).
    expect(card!.querySelector('[data-action="ad-skip"]'), "a portal break must not be skippable").toBeNull();
  });

  it("gives the direct build a real countdown — and no way to cut it short", async () => {
    // Was: "our own break has to end somehow", asserting an `ad-skip` button.
    // It did have to end somehow, and the somehow was the player skipping it,
    // because the game never ended a placeholder break by itself. It does now
    // (Game.fixedUpdate, the moment adTimer lands), so the panel shows a
    // read-only countdown chip and there is no control to press.
    const root = await render({ state: "ad", portalName: "none", adSkippable: true, adTimer: 3, adTotal: 4 });
    const card = root.querySelector('[data-ref="adCard"]')!;
    expect(card.querySelector('[data-action="ad-skip"]'), "a placeholder break must not be skippable either").toBeNull();
    const chip = card.querySelector(".ad-countdown");
    expect(chip, "the player still gets to see how long is left").not.toBeNull();
    expect(chip?.getAttribute("role")).toBe("status");
    expect(chip?.querySelector("svg"), "every countdown wears a clock").not.toBeNull();
    expect(chip?.innerHTML ?? "", "and it is the shared timer glyph").toContain("timer-glyph");
    expect(card.textContent ?? "").toMatch(/Continues in/i);
  });

  it("does not get stuck saying 'loading' with an empty bar once our own break finishes", async () => {
    // The reported bug: the header/spinner/label were painted once from the
    // initial template and never touched again, and the bar's own formula
    // reset to 0% the instant the timer hit zero — so a finished placeholder
    // break looked identical to one that had just started, forever, even
    // though the skip button underneath had already gone live. `update()` is
    // called twice here, same as two animation frames of the real game: the
    // first establishes the card (adTimer still running), the second lands
    // after the timer reaches zero and exercises the live-sync path alone,
    // exactly like the real per-frame HUD update does.
    const { HUD } = await import("../HUD");
    const hud = new HUD(document.body);
    const snap = snapshotStub();
    Object.assign(snap, {
      state: "ad", screen: "main", portalName: "none", pilotName: "Skywing",
      settings: { reduceMotion: false, mute: false },
      adReason: "continue", adSkippable: true, adTimer: 3, adTotal: 4,
    });
    hud.update(snap as unknown as HudSnapshot);
    const root = document.querySelector<HTMLElement>(".hud-root")!;
    const card = root.querySelector('[data-ref="adCard"]')!;
    expect(card.querySelector(".portal-ad-wait h3")?.textContent ?? "").toMatch(/loading/i);

    Object.assign(snap, { adTimer: 0 });
    hud.update(snap as unknown as HudSnapshot);
    expect(card.querySelector('[data-live="adBar"]')?.getAttribute("style") ?? "", "a finished break is a full bar, not an empty one").toMatch(/width:\s*100%/);
    expect(card.querySelector(".portal-ad-wait h3")?.textContent ?? "", "the header must stop claiming the ad is still loading").not.toMatch(/loading/i);
    // There is no longer a "way out" to enable: the break ends itself the
    // moment the countdown lands. What must still be true is that the chip
    // stops counting and says so, and that it keeps its clock through the
    // live-sync path — which is where the icon was being wiped, because the
    // updater rewrote the element's whole textContent every frame.
    const chip = card.querySelector('[data-live="adSkip"]')!;
    expect(chip.tagName, "the countdown is a status chip, not a control").not.toBe("BUTTON");
    expect(chip.classList.contains("done"), "a finished break says so").toBe(true);
    expect(chip.querySelector("b")?.textContent, "the countdown lands on zero, never negative").toBe("0");
    expect(chip.querySelector("svg"), "the clock survives the live update").not.toBeNull();
  });

  it("never offers to remove breaks on the portal edition (REQ-20)", async () => {
    const root = await render({ state: "ad", portalName: "poki", adSkippable: false, adTimer: 0, canRemoveBreaks: true });
    expect(
      root.querySelector('[data-action="ad-gold"]'),
      "Poki forbids selling ad removal, whatever the caller passes",
    ).toBeNull();
  });

  // REQ-20 throughout: a variant row that offers to sell Gold is an
  // offer of premium currency, which the portal both forbids and cannot
  // honour. This render site is the one the e2e policy walk reaches through
  // `open-shop`, so a guard that held at every other site did not protect it.
  //
  // Asserted on `skinAction` directly rather than through a rendered screen:
  // the shop's rows come from a stubbed collection that renders no locked
  // variants, so a screen-level assertion passes whether or not the branch is
  // reachable — which is exactly how this shipped past the unit suite and was
  // only caught by the browser walk.
  const lockedGold = {
    locked: true,
    lockReason: "gold",
    owned: false,
    equipped: false,
    affordable: true,
    def: { id: "test-skin", price: 400 },
  } as never;

  it("never turns a Gold-locked variant into a paywall on the portal edition", async () => {
    const { skinAction } = await import("../HUD");
    const html = skinAction(lockedGold, true, 9999);
    expect(html, "a portal build offered premium currency from a shop row").not.toMatch(/data-action="(open-paywall|gold-buy|vip-buy)"/);
    expect(html, "the row must still say why the item is locked").toMatch(/portal-lock/);
  });
});

describe("the rewarded offer on the results card", () => {
  const continueScreen = (adAvailable: boolean, portalName = "poki") => ({
    state: "continue",
    screen: "main",
    portalName,
    adAvailable,
    continueKind: "record",
    continueReason: "A personal best was on the line",
    wallet: 300,
    continueCost: 150,
    gives: { coins: 120, distance: 900 },
    sleepSeconds: 8,
  });

  it("offers the rewarded second wind when an ad can run", async () => {
    const root = await render(continueScreen(true));
    expect(root.querySelector('[data-action="continue-ad"]'), "the ad path must be on the card").not.toBeNull();
  });

  it("leaves it off the card when no ad can run, rather than showing an inert tap", async () => {
    // This is the bug the surface had: the offer was gated on the build target
    // while the action required a live ad surface, so a blocked script or an
    // ad-blocked browser got a button that did nothing at all.
    const root = await render(continueScreen(false));
    expect(root.querySelector('[data-action="continue-ad"]'), "no ad surface means no ad button").toBeNull();
  });

  it("keeps the non-ad ways back into the run on the card (MON-05..08)", async () => {
    const root = await render(continueScreen(false));
    expect(root.querySelector('[data-action="continue-sleep"]'), "rest is always offered").not.toBeNull();
  });
});
