import { describe, expect, it } from "vitest";
import {
  adBreakAllowsAction,
  adBreakCanEnd,
  adEscapeArmed,
  adEscapeCountdown,
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
 *   3. `ad-stuck` — the escape hatch for a break whose SDK promise never
 *      settles — rendered enabled from the FIRST FRAME of every portal break,
 *      with a flat "Return to flight" label (again because `adTimer` is 0 on
 *      that path). One click, at t = 0, on a real ad.
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

describe("the escape hatch is a failure valve, never a skip button", () => {
  it("is disarmed for the whole break on a healthy SDK", () => {
    // Every real break resolves long before the safety window; across that
    // entire span the hatch must be inert.
    for (let t = 0; t < AD_SAFETY_SECONDS; t += 0.5) {
      expect(adEscapeArmed(t, AD_SAFETY_SECONDS), `elapsed=${t}`).toBe(false);
    }
  });

  it("is disarmed at frame one — the exact bug that shipped", () => {
    expect(adEscapeArmed(0, AD_SAFETY_SECONDS)).toBe(false);
    expect(adEscapeArmed(0.016, AD_SAFETY_SECONDS)).toBe(false);
  });

  it("arms only once the break has demonstrably failed", () => {
    expect(adEscapeArmed(AD_SAFETY_SECONDS - 0.001, AD_SAFETY_SECONDS)).toBe(false);
    expect(adEscapeArmed(AD_SAFETY_SECONDS, AD_SAFETY_SECONDS)).toBe(true);
    expect(adEscapeArmed(AD_SAFETY_SECONDS + 10, AD_SAFETY_SECONDS)).toBe(true);
  });

  it("uses the same window as the automatic valve, so the two cannot disagree", () => {
    // If the hatch armed later than the valve it would be unreachable; if it
    // armed earlier it would be a skip. They must be the same number.
    expect(AD_SAFETY_SECONDS).toBeGreaterThan(0);
    expect(adEscapeArmed(AD_SAFETY_SECONDS, AD_SAFETY_SECONDS)).toBe(true);
  });

  it("counts down honestly so the control is never dead without saying why", () => {
    expect(adEscapeCountdown(0, 60)).toBe(60);
    expect(adEscapeCountdown(59.2, 60)).toBe(1);
    expect(adEscapeCountdown(60, 60)).toBe(0);
    expect(adEscapeCountdown(120, 60)).toBe(0);
    // Always a whole number of seconds, never negative, never fractional.
    for (let t = 0; t <= 70; t += 0.37) {
      const left = adEscapeCountdown(t, 60);
      expect(Number.isInteger(left)).toBe(true);
      expect(left).toBeGreaterThanOrEqual(0);
    }
  });

  it("monotonically decreases — the label can never count back up", () => {
    let prev = Number.POSITIVE_INFINITY;
    for (let t = 0; t <= 60; t += 0.1) {
      const left = adEscapeCountdown(t, 60);
      expect(left).toBeLessThanOrEqual(prev);
      prev = left;
    }
  });

  it("fails closed on junk input rather than opening the hatch", () => {
    // A NaN elapsed time must not read as "the break has been open forever".
    expect(adEscapeArmed(Number.NaN, 60)).toBe(false);
    expect(adEscapeArmed(60, Number.NaN)).toBe(false);
    expect(adEscapeArmed(Number.POSITIVE_INFINITY, Number.NaN)).toBe(false);
    expect(adEscapeCountdown(Number.NaN, 60)).toBe(0);
  });
});

describe("the guard lives in the action handler, not only in the view", () => {
  it("keeps the hatch's arming rule in a pure module both layers import", () => {
    // Regression in shape rather than behaviour: the previous version of this
    // control was gated only by what the renderer chose to draw, so anything
    // that dispatched the action directly bypassed it entirely. Both
    // hud/run.ts and Game.handleAction now call adEscapeArmed.
    expect(typeof adEscapeArmed).toBe("function");
    expect(adEscapeArmed.length).toBe(2);
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
    for (const elapsed of [0, 0.016, 1, 30, AD_SAFETY_SECONDS - 0.5]) {
      const html = renderAd({ ...base, adSkippable: false, adTimer: 0, adElapsed: elapsed });
      const button = html.match(/<button[^>]*data-action="ad-stuck"[^>]*>/)?.[0] ?? "";
      expect(button, `elapsed=${elapsed}`).toContain("disabled");
      expect(html).not.toContain(">Return to flight<");
    }
  });

  it("arms the hatch only at the safety window, and drops the countdown then", async () => {
    const { renderAd } = await import("../hud/run");
    const html = renderAd({ ...base, adSkippable: false, adTimer: 0, adElapsed: AD_SAFETY_SECONDS });
    const button = html.match(/<button[^>]*data-action="ad-stuck"[^>]*>/)?.[0] ?? "";
    expect(button).not.toContain("disabled");
    expect(html).toContain("Return to flight");
  });

  it("puts a clock on every countdown it draws", async () => {
    const { renderAd } = await import("../hud/run");
    const placeholder = renderAd({ ...base, adSkippable: true, adTimer: 7, adElapsed: 0 });
    const portalWaiting = renderAd({ ...base, adSkippable: false, adTimer: 0, adElapsed: 5 });
    for (const html of [placeholder, portalWaiting]) {
      expect(html).toContain("timer-glyph");
      expect(html).toContain("<svg");
    }
    // A bare hourglass emoji is exactly the glyph class that was caught
    // rendering as tofu; no timer may go back to one.
    expect(placeholder).not.toContain("\u23f3");
    expect(portalWaiting).not.toContain("\u23f3");
  });

  it("never draws a negative countdown", async () => {
    const { renderAd } = await import("../hud/run");
    const html = renderAd({ ...base, adSkippable: true, adTimer: -3, adElapsed: 0 });
    expect(html).toContain("<b>0</b>");
    expect(html).not.toMatch(/<b>-\d/);
  });
});
