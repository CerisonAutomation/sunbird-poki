import { describe, expect, it } from "vitest";
import { iconGlyph, menuIconSm } from "../MenuIcons";
import {
  ALT_CEILING,
  ALT_CEILING_FADE,
  GROUND_G_DIVE,
  GROUND_G_GLIDE,
  GROUND_G_GLIDE_DOWN,
} from "../constants";
import { dampClimbAtCeiling } from "../FlightPhysics";
import { TOAST_MIN_VISIBLE_MS, TOAST_QUEUE_CAP, decideToast } from "../toastFloor";
import {
  LAUNCH_POP_COYOTE_S,
  LAUNCH_POP_FLOOR,
  LAUNCH_POP_WINDOW_S,
  launchPopQuality,
  shouldLeaveGround,
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
      // main's contract: a known name resolves to a glyph; an unknown one
      // returns "" (falsy is deliberate, so callers can supply their own
      // fallback). Either way it is never the identifier.
      expect(iconGlyph(name), `beatIcon may return "${name}"`).toBeTruthy();
      expect(iconGlyph(name), name).not.toBe(name);
    }
  });

  it("degrades an unknown name to a marker, never to the name itself", () => {
    // Under main's contract an unrecognised name returns "" — falsy on
    // purpose, so a caller can supply its own fallback (GrowthLedger relies
    // on exactly that). The invariant this test exists for is narrower and
    // survives the change: whatever comes back, it is never the identifier
    // that went in. "" is excluded because an empty name means "no icon",
    // not "unknown icon".
    for (const junk of ["not_an_icon", "egg2", "Trophy", "undefined", "constructor", "__proto__"]) {
      const glyph = iconGlyph(junk);
      expect(glyph, `"${junk}" must not leak`).not.toBe(junk);
      expect(glyph.length, `"${junk}"`).toBeLessThanOrEqual(2);
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
    // The card gets the authored miniature where one exists, and the text
    // glyph only as a fallback — either way, never the identifier.
    for (const name of ["egg", "trophy"]) {
      const art = menuIconSm(name);
      expect(html.includes(art) || html.includes(iconGlyph(name)), name).toBe(true);
    }
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

describe("the crest gate stopped vetoing real launches", () => {
  /**
   * Found by reading the FIRST commit in the repository (1aea134) rather than
   * by guessing:
   *
   *   ORIGINAL   if (curv > 0)                                  { ...launch }
   *   REGRESSED  if (curv > 0 && terrain.hasCrestProminence(x)) { ...launch }
   *
   * `hasCrestProminence` asks whether the terrain climbs 6 units behind AND
   * already descends 6 units ahead. On the last ramp of an island the far
   * side has not started descending, so the gate returns false and the launch
   * is vetoed — however fast the bird is going, however well the player
   * released. It is also why tuning the pop had no effect: the pop lives
   * inside the `launched` branch, downstream of a gate that never opened.
   */
  it("still refuses to launch a bird the surface can hold", () => {
    expect(shouldLeaveGround(10, 100, true)).toBe(false);
    expect(shouldLeaveGround(10, 100, false)).toBe(false);
    expect(shouldLeaveGround(100, 100, true)).toBe(false);
  });

  it("launches off a recognised lip exactly as the original did", () => {
    expect(shouldLeaveGround(101, 100, true)).toBe(true);
  });

  it("no longer lets a missing lip veto a decisive launch", () => {
    // The last-ramp case: physics says gone, prominence probe says no crest.
    expect(shouldLeaveGround(200, 100, false)).toBe(true);
    expect(shouldLeaveGround(131, 100, false)).toBe(true);
  });

  it("keeps the filter's real job — suppressing marginal, noise-driven pops", () => {
    // Barely over the line with no crest: still suppressed, which is the
    // whole reason the prominence check was introduced.
    expect(shouldLeaveGround(101, 100, false)).toBe(false);
    expect(shouldLeaveGround(129, 100, false)).toBe(false);
  });

  it("recovers most of what the gate destroyed, without going past the original", () => {
    // Swept over realistic ramp profiles: launch speed 30-95, curvature
    // 0.002-0.03, diving and gliding, with and without a recognised crest.
    let original = 0;
    let regressed = 0;
    let fixed = 0;
    for (let vt = 30; vt <= 95; vt += 5) {
      for (let curv = 0.002; curv <= 0.03; curv += 0.002) {
        for (const prominence of [true, false]) {
          for (const diving of [true, false]) {
            const needed = vt * vt * curv;
            const available = (diving ? 96 : 16) * 0.9 + (diving ? 190 : 13);
            if (needed > available) original++;
            if (prominence && needed > available) regressed++;
            if (shouldLeaveGround(needed, available, prominence)) fixed++;
          }
        }
      }
    }
    // The measurement that justifies the change: the gate halved launches.
    expect(regressed).toBeLessThan(original * 0.55);
    // The fix recovers most of the loss...
    expect(fixed).toBeGreaterThan(regressed * 1.7);
    // ...and is still strictly more conservative than the original, so the
    // anti-noise behaviour the gate was added for is retained.
    expect(fixed).toBeLessThan(original);
  });

  it("is safe against junk from a degenerate terrain probe", () => {
    expect(shouldLeaveGround(Number.NaN, 100, true)).toBe(false);
    expect(shouldLeaveGround(100, Number.NaN, true)).toBe(false);
    expect(shouldLeaveGround(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, true)).toBe(false);
  });
});

describe("the release response constants match the build the player remembers", () => {
  /**
   * "There used to be more of a response and the bird was more responsive."
   * Diffing constants.ts against the first commit (1aea134) turned up three
   * changes on the release path, none of them intended as a nerf:
   *
   *   GROUND_G_GLIDE   30 -> 14   with the comment "reduced: less
   *                               deceleration on uphill slopes"
   *   ALT_CEILING     260 -> 230
   *   ALT_CEILING_FADE 50 -> 20
   *
   * The first is a coupled-constant bug. One constant governed BOTH the
   * uphill penalty and the downhill acceleration, so softening uphill also
   * halved how fast a RELEASED bird builds speed running down a hill — which
   * is the single input the game has. Split in two: uphill stays forgiving,
   * downhill gets its response back.
   *
   * The other two made the ceiling a wall — 30 m lower with a fade band two
   * and a half times sharper, so a climb lost 50% at 220 m where it used to
   * lose 20%. The player's own screenshot shows them pinned at "229 m peak"
   * against a 230 m ceiling: the game was deleting the top of every good
   * launch. Restored to the first build's pairing.
   */
  it("gives a released bird its original downhill acceleration back", () => {
    expect(GROUND_G_GLIDE_DOWN).toBe(30);
  });

  it("keeps uphill forgiving — the tuning that lowered it was not wrong, just misapplied", () => {
    expect(GROUND_G_GLIDE).toBe(14);
    expect(GROUND_G_GLIDE_DOWN).toBeGreaterThan(GROUND_G_GLIDE);
  });

  it("still makes committing to a dive the stronger play", () => {
    // The skill ceiling from 457ff35 must survive this: diving has to beat
    // coasting downhill, or there is no reason to ever hold the button.
    expect(GROUND_G_DIVE).toBeGreaterThan(GROUND_G_GLIDE_DOWN);
  });

  it("restores a soft ceiling instead of a wall", () => {
    expect(ALT_CEILING).toBe(260);
    expect(ALT_CEILING_FADE).toBe(50);
    // At 220 m a climb keeps most of itself again (was 50% gone).
    expect(dampClimbAtCeiling(40, 220)).toBeGreaterThan(40 * 0.7);
    // And the screenshot's 229 m peak is no longer near the ceiling at all.
    expect(dampClimbAtCeiling(40, 229)).toBeGreaterThan(40 * 0.6);
  });

  it("keeps the damp band above the Star Wish band, as flight-ceiling requires", () => {
    expect(ALT_CEILING - ALT_CEILING_FADE).toBeGreaterThan(207);
  });
});
