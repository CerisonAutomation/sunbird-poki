import { describe, expect, it } from "vitest";
import {
  adBreakAllowsAction,
  adBreakCanEnd,
  goldContinueAllowed,
} from "../adGate";
import { AD_SAFETY_SECONDS } from "../constants";

/**
 * The standing contract: a player must not be able to skip a sponsored break.
 *
 * Three vectors have now been found and closed, and each one shipped at some
 * point, so this file enumerates all three rather than testing the newest in
 * isolation:
 *
 *   1. `ad-gold` ("Remove breaks") once ended the break immediately and for
 *      free — the offer was never taken and the ad never ran.
 *   2. `ad-skip` rendered enabled during a portal ad, because `adTimer` is
 *      left at 0 on that path and an unguarded `adTimer <= 0` was already
 *      true. Clicking it skipped the break AND paid out.
 *   3. `ad-stuck` — a "return to flight" button on a portal break — let a
 *      single tap end a live portal ad once it armed. It is no longer a
 *      button at all: a portal break has no player-initiated exit, and the
 *      `ad-stuck` action is an explicit no-op in the handler.
 *
 * The invariant that catches all three, and any fourth: on a portal-owned
 * break there is no value of any game-side input that ends the break early.
 */

const PORTAL = true;
const PLACEHOLDER = false;

describe("a portal-owned break cannot be ended by the game", () => {
  it("refuses every action while a portal break is live", () => {
    const everyAction = [
      "ad-skip",
      "ad-gold",
      "ad-stuck",
      "pause",
      "resume",
      "menu",
      "restart-flight",
      "continue-ad",
      "continue-gold",
      "continue-sleep",
      "open-shop",
      "open-settings",
      "toggle-fullscreen",
      "set-mute",
      "mode-select",
      "",
    ];
    for (const action of everyAction) {
      expect(adBreakAllowsAction(action, PORTAL), `"${action}" must be swallowed`).toBe(false);
    }
  });

  it("never reports the break as endable, at any timer value", () => {
    for (const t of [-1e6, -1, -0.001, 0, 0.001, 1, 60, 1e6, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(adBreakCanEnd(PORTAL, t), `adTimer=${t}`).toBe(false);
    }
  });
});

describe("a placeholder break plays to the end", () => {
  it("no longer admits ad-skip at all", () => {
    // Vector 4. A placeholder break had NO self-exit: the game never ended it,
    // so pressing `ad-skip` was the only way out and skipping was therefore
    // the intended exit from every break on a non-portal build. The break now
    // completes itself in fixedUpdate when the countdown lands, the panel
    // renders a read-only chip, and the action is an explicit no-op.
    expect(adBreakAllowsAction("ad-skip", PLACEHOLDER)).toBe(false);
    expect(adBreakAllowsAction("ad-skip", PORTAL)).toBe(false);
  });

  it("only lets the game run the upsell", () => {
    expect(adBreakAllowsAction("ad-gold", PLACEHOLDER)).toBe(true);
    for (const a of ["ad-skip", "ad-stuck", "pause", "menu", "resume", "continue-sleep"]) {
      expect(adBreakAllowsAction(a, PLACEHOLDER), a).toBe(false);
    }
  });

  it("cannot be ended before its countdown reaches zero", () => {
    for (const t of [30, 5, 1, 0.5, 0.0001]) {
      expect(adBreakCanEnd(PLACEHOLDER, t), `adTimer=${t}`).toBe(false);
    }
    expect(adBreakCanEnd(PLACEHOLDER, 0)).toBe(true);
    expect(adBreakCanEnd(PLACEHOLDER, -0.5)).toBe(true);
  });

  it("does not let the upsell double as a skip", () => {
    // `ad-gold` is allowed to *run*, but it is gated on the countdown, so
    // taking the offer still plays the ad out first.
    expect(adBreakAllowsAction("ad-gold", PLACEHOLDER)).toBe(true);
    expect(adBreakCanEnd(PLACEHOLDER, 4)).toBe(false);
  });

  it("exposes exactly one allowed action, so the set cannot quietly regrow", () => {
    const allowed = [
      "ad-skip", "ad-gold", "ad-stuck", "pause", "resume", "menu",
      "restart-flight", "continue-ad", "continue-gold", "continue-sleep",
      "open-shop", "open-settings", "mode-select", "set-mute",
    ].filter((a) => adBreakAllowsAction(a, PLACEHOLDER));
    expect(allowed).toEqual(["ad-gold"]);
  });
});

describe("a portal break has no player-initiated exit", () => {
  // The former "return to flight" escape hatch was a clickable way to end a
  // live portal ad early. It is now automatic: the fixedUpdate safety valve
  // recovers a break whose SDK promise never settles, and the `ad-stuck`
  // action is an explicit no-op in the handler. Nothing the player can press
  // ever ends the break.
  it("swallows ad-stuck on both break kinds, so a stray dispatch cannot skip", () => {
    expect(adBreakAllowsAction("ad-stuck", PORTAL)).toBe(false);
    expect(adBreakAllowsAction("ad-stuck", PLACEHOLDER)).toBe(false);
  });

  it("still has a bounded recovery window, so a dead SDK cannot trap the game", () => {
    expect(AD_SAFETY_SECONDS).toBeGreaterThan(0);
  });
});


describe("the ad-free Gold continue is not a portal skip", () => {
  // Vector 5, and the only one that needs no ad on screen at all: Gold is sold
  // as "Unlimited free second winds", so `continue-gold` grants a continue
  // that costs nothing and plays no break. The card already declines to DRAW it
  // on a portal; the handler was the part that was missing.
  it("refuses it outright on a portal, whatever the save says", () => {
    for (const gold of [true, false]) {
      expect(goldContinueAllowed(PORTAL, gold), "portal gold=" + gold).toBe(false);
    }
  });

  it("still grants it on a direct build, which is where Gold is sold", () => {
    expect(goldContinueAllowed(PLACEHOLDER, true)).toBe(true);
    expect(goldContinueAllowed(PLACEHOLDER, false)).toBe(false);
  });

  it("fails closed on a save that claims Gold on the Poki build", () => {
    // The exact bypass: `gold` is restored verbatim from the saved payload
    // (SaveData: `gold: Boolean(p.gold)`) and SELL_AD_REMOVAL is false here, so
    // no Gold surface is ever drawn for such a player - but the flag still
    // reached the case. A portal build must treat it as absent.
    expect(goldContinueAllowed(PORTAL, true)).toBe(false);
  });

  it("is not re-opened by a truthy non-boolean", () => {
    // Anything that reads as true must still lose to the portal check.
    expect(goldContinueAllowed(PORTAL, 1 as unknown as boolean)).toBe(false);
    expect(goldContinueAllowed(PORTAL, "yes" as unknown as boolean)).toBe(false);
    expect(goldContinueAllowed(PORTAL, {} as unknown as boolean)).toBe(false);
  });
});

/* ------------------------------------------------- the panel the player sees */

describe("the rendered break panel offers nothing that ends the break", () => {
  const base = {
    adReason: "continue" as const,
    gold: false,
    portalName: "poki" as const,
    adSafetySeconds: AD_SAFETY_SECONDS,
  };

  it("renders no ad-skip button on a placeholder break — it is a status chip", async () => {
    const { renderAd } = await import("../hud/run");
    const html = renderAd({ ...base, adSkippable: true, adTimer: 7, adElapsed: 0 });
    expect(html).not.toMatch(/<button[^>]*data-action="ad-skip"/);
    expect(html).toContain('class="ad-countdown"');
    expect(html).toContain('role="status"');
    // 2026-10-04: the chip now also states the contract — "plays in full" —
    // because a bare countdown reads like a loading state being waited out.
    expect(html).toMatch(/plays in full · continues in/i);
  });

  it("renders the portal escape hatch disabled for the whole safety window", async () => {
    const { renderAd } = await import("../hud/run");
    for (const elapsed of [0, 0.016, 1, 30, AD_SAFETY_SECONDS - 0.5, AD_SAFETY_SECONDS]) {
      const html = renderAd({ ...base, adSkippable: false, adTimer: 0, adElapsed: elapsed });
      // No button and no "Return to flight" affordance at any point in the
      // break's life — the only exits are the SDK promise and the safety valve.
      expect(html, `elapsed=${elapsed}`).not.toMatch(/<button[^>]*data-action="ad-stuck"/);
      expect(html).not.toContain("Return to flight");
    }
  });

  it("still draws a clock on the placeholder countdown it owns", async () => {
    const { renderAd } = await import("../hud/run");
    const placeholder = renderAd({ ...base, adSkippable: true, adTimer: 7, adElapsed: 0 });
    expect(placeholder).toContain("timer-glyph");
    expect(placeholder).toContain("<svg");
    // A bare hourglass emoji is exactly the glyph class that was caught
    // rendering as tofu; no timer may go back to one.
    expect(placeholder).not.toContain("\u23f3");
  });

  it("never draws a negative countdown", async () => {
    const { renderAd } = await import("../hud/run");
    const html = renderAd({ ...base, adSkippable: true, adTimer: -3, adElapsed: 0 });
    expect(html).toContain("<b>0</b>");
    expect(html).not.toMatch(/<b>-\d/);
  });
});
