import { describe, expect, it } from "vitest";
import { hasIconGlyph, iconGlyph } from "../MenuIcons";
import { TOAST_MIN_VISIBLE_MS, TOAST_QUEUE_CAP, decideToast } from "../toastFloor";
import {
  LAUNCH_POP_COYOTE_S,
  LAUNCH_POP_FLOOR,
  LAUNCH_POP_WINDOW_S,
  launchPopQuality,
  withinPopCoyote,
} from "../launchPop";

/**
 * Four defects reported from a single screenshot and one sentence of play
 * notes. Each one shipped, each one is pinned here.
 */

describe("an icon name never reaches the screen as text", () => {
  /**
   * The results card read "egg Nest upgraded!", "badge Nest Pass Lv.2
   * unlocked", "trophy Trophy: Cloud Nine". `beatIcon` returns an icon NAME
   * — its own doc comment says so — and the renderer printed it raw. It
   * survived review because `iconGlyph` fell back to the name it was given,
   * which is indistinguishable from a successful lookup.
   */
  const BEAT_ICON_NAMES = [
    "feather", "trophy", "crown", "badge", "egg", "star", "flag", "medal",
  ];

  it("resolves every name beatIcon can return", () => {
    for (const name of BEAT_ICON_NAMES) {
      expect(hasIconGlyph(name), `beatIcon may return "${name}"`).toBe(true);
      expect(iconGlyph(name), name).not.toBe(name);
    }
  });

  it("degrades an unknown name to a marker, never to the name itself", () => {
    for (const junk of ["not_an_icon", "", "egg2", "Trophy", "undefined"]) {
      const glyph = iconGlyph(junk);
      expect(glyph, `"${junk}" must not leak`).not.toBe(junk);
      expect(glyph.length).toBeLessThanOrEqual(2);
    }
  });

  it("renders celebration beats as glyphs, not identifiers", async () => {
    const { renderCelebration } = await import("../hud/run");
    const html = renderCelebration({
      modeId: "endless",
      mastery: [],
      wings: null,
      celebration: {
        staged: [
          { key: "x", params: undefined, fallback: "Nest upgraded!", icon: "egg", rarity: "rare", delayMs: 0, banner: false },
          { key: "y", params: undefined, fallback: "Trophy: Cloud Nine", icon: "trophy", rarity: "epic", delayMs: 80, banner: false },
        ],
        ledger: [],
        folded: 0,
      },
    } as never);
    // The exact strings the player photographed.
    expect(html).not.toMatch(/>egg</);
    expect(html).not.toMatch(/>trophy</);
    expect(html).toContain("Nest upgraded!");
    expect(html).toContain(iconGlyph("egg"));
    expect(html).toContain(iconGlyph("trophy"));
  });
});

describe("a toast gets long enough on screen to be read", () => {
  /**
   * "The funny messages don't even show up." They all fired. The in-flight
   * cap is one pill and eviction was unconditional, so in a stream of system
   * messages a toast could be born and destroyed inside the same 100 ms.
   */
  it("shows immediately when there is room", () => {
    expect(decideToast(0, 1, Number.POSITIVE_INFINITY, 0)).toEqual({ action: "show" });
    expect(decideToast(1, 2, 10, 0)).toEqual({ action: "show" });
  });

  it("refuses to evict a pill that has not been readable yet", () => {
    for (const age of [0, 1, 100, TOAST_MIN_VISIBLE_MS - 1]) {
      const d = decideToast(1, 1, age, 0);
      expect(d.action, `age=${age}`).toBe("defer");
    }
  });

  it("evicts once the incumbent has had its look", () => {
    expect(decideToast(1, 1, TOAST_MIN_VISIBLE_MS, 0)).toEqual({ action: "show" });
    expect(decideToast(1, 1, TOAST_MIN_VISIBLE_MS + 5000, 0)).toEqual({ action: "show" });
  });

  it("waits exactly the remaining time, never longer", () => {
    const d = decideToast(1, 1, TOAST_MIN_VISIBLE_MS - 200, 0);
    expect(d.action).toBe("defer");
    if (d.action === "defer") {
      expect(d.waitMs).toBeLessThanOrEqual(200);
      expect(d.waitMs).toBeGreaterThan(0);
    }
  });

  it("bounds the backlog, because a stale joke is worse than no joke", () => {
    expect(decideToast(1, 1, 0, TOAST_QUEUE_CAP).action).toBe("drop");
    expect(decideToast(1, 1, 0, TOAST_QUEUE_CAP + 10).action).toBe("drop");
  });

  it("treats an unknown age as readable rather than deadlocking the layer", () => {
    expect(decideToast(1, 1, Number.POSITIVE_INFINITY, 0)).toEqual({ action: "show" });
  });

  it("drops everything when the surface is suppressed", () => {
    expect(decideToast(0, 0, 0, 0).action).toBe("drop");
  });
});

describe("releasing at a ramp always does something", () => {
  /**
   * "The release doesn't work on the last ramp — when I release after a ramp
   * the bird doesn't jump." The window was 0.45 s measured from the release
   * to the moment the bird left the ground, i.e. "the lip must arrive within
   * 0.45 s of your release". Any ramp longer than that scored exactly zero.
   */
  it("pays full credit for a release right at the lip", () => {
    expect(launchPopQuality(0)).toBe(1);
  });

  it("no longer pays ZERO for a correct release on a long ramp", () => {
    // The regression, stated as a number: a ramp taking 0.6 s to climb.
    expect(launchPopQuality(0.6)).toBeGreaterThan(0);
    // And one taking two full seconds — still a release, still worth having.
    expect(launchPopQuality(2)).toBeGreaterThanOrEqual(LAUNCH_POP_FLOOR);
  });

  it("keeps timing a real skill — precision is worth ~2.5x a lazy release", () => {
    const precise = launchPopQuality(0.02);
    const lazy = launchPopQuality(3);
    expect(precise / lazy).toBeGreaterThan(2);
    expect(precise).toBeGreaterThan(lazy);
  });

  it("pays a held stick nothing at all, so releasing stays worth doing", () => {
    expect(launchPopQuality(Number.POSITIVE_INFINITY)).toBe(0);
    expect(launchPopQuality(Number.NaN)).toBe(0);
    expect(launchPopQuality(-1)).toBe(0);
  });

  it("decreases monotonically and never exceeds one", () => {
    let prev = Number.POSITIVE_INFINITY;
    for (let t = 0; t <= 3; t += 0.02) {
      const q = launchPopQuality(t);
      expect(q).toBeLessThanOrEqual(1);
      expect(q).toBeGreaterThanOrEqual(0);
      expect(q).toBeLessThanOrEqual(prev + 1e-9);
      prev = q;
    }
  });

  it("is continuous at the window edge — no cliff the hand can feel", () => {
    const inside = launchPopQuality(LAUNCH_POP_WINDOW_S - 0.001);
    const outside = launchPopQuality(LAUNCH_POP_WINDOW_S + 0.001);
    expect(Math.abs(inside - outside)).toBeLessThan(0.01);
  });

  it("fits a realistic ramp inside the window", () => {
    // The original 0.45 s did not, which is the whole bug.
    expect(LAUNCH_POP_WINDOW_S).toBeGreaterThan(0.45);
    expect(launchPopQuality(0.45)).toBeGreaterThan(LAUNCH_POP_FLOOR);
  });

  it("gives coyote grace to a release just after the lip", () => {
    // "Release at the top to launch" is what the coach teaches; leaving the
    // ground still holding used to forfeit the pop entirely.
    expect(withinPopCoyote(0)).toBe(true);
    expect(withinPopCoyote(LAUNCH_POP_COYOTE_S)).toBe(true);
    expect(withinPopCoyote(LAUNCH_POP_COYOTE_S + 0.001)).toBe(false);
    expect(withinPopCoyote(-0.1)).toBe(false);
    expect(withinPopCoyote(Number.NaN)).toBe(false);
  });

  it("keeps the coyote grace short enough to be a grace, not a second input", () => {
    expect(LAUNCH_POP_COYOTE_S).toBeGreaterThan(0.05);
    expect(LAUNCH_POP_COYOTE_S).toBeLessThanOrEqual(0.25);
  });
});
