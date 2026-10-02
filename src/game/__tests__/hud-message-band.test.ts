/**
 * The message lanes stack off one measurement, and this is what stops them
 * drifting apart again.
 *
 * Four transient surfaces run down the middle of the flight HUD — the coaching
 * band, the coach hand, the toast column and the impact-popup reservation — plus
 * the quip lane and the two chain pills underneath them. For a long time each
 * was anchored by its own `calc()`, each restating the header offset, each with
 * its own per-breakpoint override. They drifted into each other:
 *
 *   · 1200x762  messages band × popup reservation   27,040px²
 *   ·  390x844  messages band × goal strip           10,012px²
 *   ·  320x568  popup reservation measured ZERO pixels tall, so `HUD.popup`'s
 *               height guard returned early and no popup rendered at all
 *   · 844x390   same: zero-height reservation, no popup
 *
 * The cause of the first two is the same and is not a typo: in portrait the
 * footer is TOP-anchored (`design-polish.css`), so `--hud-footer-height`
 * measures a band *downward from the header* and every expression that
 * subtracts it from a `bottom` or a `100%` is subtracting the wrong number. No
 * amount of correct CSS arithmetic recovers from that, because CSS cannot know
 * which edge the footer is on. `messageBand()` is handed the answer.
 *
 * The arithmetic is a pure function precisely so this can be asserted without a
 * browser: jsdom performs no layout, so a box cannot be measured here — but the
 * number every box is placed FROM can be. The four viewports below are the real
 * measured shapes of the frozen `e2e/SunbirdPage.layoutFixture(true)` clone, so
 * the failures below are the failures that frame produces.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { FOOTER_TOP_ANCHOR_SLACK_PX, LANE_GAP_PX, footerAnchoredTop, footerBottomReservation, messageBand, type MessageBandInput } from "../hud/messageBand";
import { messageHoldMs } from "../MessageTiming";
import { TOAST_MIN_VISIBLE_MS, decideToast } from "../toastFloor";

const css = readFileSync(join(process.cwd(), "src/index.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** Every rule whose selector list ends in `sel`, with the selector it was
 *  written under so a caller can ask for the bare base rule and not a gate. */
function rulesFor(sel: string): { media: string | null; selector: string; body: string }[] {
  const out: { media: string | null; selector: string; body: string }[] = [];
  const scan = (text: string, media: string | null): void => {
    let i = 0;
    while (i < text.length) {
      const brace = text.indexOf("{", i);
      if (brace === -1) return;
      const prelude = text.slice(i, brace).trim();
      let depth = 1;
      let j = brace + 1;
      while (j < text.length && depth > 0) {
        if (text[j] === "{") depth++;
        else if (text[j] === "}") depth--;
        j++;
      }
      const body = text.slice(brace + 1, j - 1);
      if (prelude.startsWith("@media")) scan(body, prelude.slice(6).replace(/\s+/g, " ").trim());
      else if (!prelude.startsWith("@") && prelude) {
        if (prelude.split(",").some((s) => s.trim().endsWith(sel))) out.push({ media, selector: prelude, body });
      }
      i = j;
    }
  };
  scan(css, null);
  return out;
}

const decl = (body: string, prop: string): string | null =>
  new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+);`).exec(body)?.[1]?.trim() ?? null;

/** The rule that actually renders: the last top-level rule to set `top`. */
const effective = (sel: string, prop: string): string | null => {
  const hits = rulesFor(sel)
    .filter((r) => r.media === null)
    .map((r) => decl(r.body, prop))
    .filter((v): v is string => v !== null);
  return hits.at(-1) ?? null;
};

/** The frozen `layoutFixture(true)` measurements, per viewport. */
const FRAMES: Record<string, MessageBandInput> = {
  // Portrait: the footer is 346px tall and pinned to the TOP.
  "390x844": {
    hudPx: 844, headerPx: 188, anchoredTop: true, footerPx: 346,
    quipY: 785.5, slopeY: 810, handPx: 67.6, naturalBandPx: 50,
  },
  // Landscape: footer bottom-anchored, 162px.
  "1200x762": {
    hudPx: 762, headerPx: 168.2, anchoredTop: false, footerPx: 162,
    quipY: 533.6, slopeY: 566, handPx: 67.6, naturalBandPx: 74,
  },
  // Portrait on a small phone, and the frame the audit named: the popup
  // reservation used to measure y 314..314 — zero pixels.
  "320x568": {
    hudPx: 568, headerPx: 220, anchoredTop: true, footerPx: 378,
    quipY: 510.2, slopeY: 534, handPx: 67.6, naturalBandPx: 50,
  },
  // The 844x390 landscape frame Poki embeds. Same zero-height reservation.
  "844x390": {
    hudPx: 390, headerPx: 124, anchoredTop: false, footerPx: 150,
    quipY: 174.8, slopeY: 206, handPx: 0, naturalBandPx: 31,
  },
};

describe("the band clears whatever the footer is doing", () => {
  it("in portrait it starts below the TOP-anchored footer, not 10,012px² inside it", () => {
    // Before: `--hud-footer-height` = 346 was subtracted from a `100%`, giving
    // 438, which lost to the `H+82` floor and put the band at 270..310 — inside
    // the footer's 196..346.
    const band = messageBand(FRAMES["390x844"]!);
    expect(band.top, "the band must start below the top-anchored footer").toBeGreaterThanOrEqual(346 + 8);
    expect(band.top).toBeLessThan(346 + 8 + LANE_GAP_PX * 4);
  });

  it("and it is above the header in the same frame", () => {
    const band = messageBand(FRAMES["390x844"]!);
    expect(band.top).toBeGreaterThan(FRAMES["390x844"]!.headerPx);
  });

  it("it has a real height, not the 0px the 64px child cap produced", () => {
    for (const [vp, frame] of Object.entries(FRAMES)) {
      const band = messageBand(frame);
      expect(band.maxPx, `${vp}: the band has no height`).toBeGreaterThan(0);
      expect(band.maxPx).toBeLessThanOrEqual(frame.naturalBandPx);
    }
  });

  it("the floor is never above the band and never past the free area", () => {
    for (const [vp, frame] of Object.entries(FRAMES)) {
      const band = messageBand(frame);
      expect(band.laneFloor, `${vp}: the floor is above the band`).toBeGreaterThanOrEqual(band.top);
      expect(band.laneFloor, `${vp}: the floor is past the free area`).toBeLessThanOrEqual(
        frame.hudPx - (frame.anchoredTop ? 0 : frame.footerPx),
      );
    }
  });
});

describe("the popup reservation has a lane tall enough to hold a popup", () => {
  /**
   * The defect in one assertion. `HUD.popup()` bails when the reservation is
   * shorter than one popup, and the reservation was `top: H+94` against
   * `bottom: 100% - footer - 90`. In portrait those two crossed — the top came
   * out BELOW the bottom — so the box inverted to zero height, the guard
   * returned early, and no impact popup rendered on the two frames Poki embeds
   * most. The guard's old threshold was a flat 70px matching neither the popup's
   * height nor the placement clamps' margins; the lanes below are measured
   * against the same requirement instead.
   */
  // The 13px floor of `clamp(13px, 2.2vw, 17px)`, plus the 8px edge the
  // placement clamps keep, plus 1px of rounding.
  const MIN_LANE_PX = 22;

  it("is tall enough to hold a popup in every frame, once the CSS floor is counted", () => {
    // The reservation is `top: --hud-stack-bottom` against
    // `bottom: calc(100% - --hud-lane-floor + 8px)`, so its bottom edge sits at
    // `--hud-lane-floor - 8`. Where the two cross, the declared `min-height` is
    // what keeps the lane usable — which is the point of it: 844x390 leaves 2px
    // between the stack and the quip lane, and without the floor the guard in
    // `HUD.popup` would return early and drop every popup.
    const floorPx = Number.parseFloat(decl(rulesFor(".impact-popups")[0]!.body, "min-height") ?? "0");
    expect(floorPx, "the popup lane has no min-height floor").toBeGreaterThanOrEqual(MIN_LANE_PX);
    for (const [vp, frame] of Object.entries(FRAMES)) {
      const band = messageBand(frame);
      const natural = band.laneFloor - 8 - band.stackBottom;
      expect(Math.max(natural, floorPx), `${vp}: the popup lane is ${natural}px tall, so every popup is suppressed`)
        .toBeGreaterThanOrEqual(MIN_LANE_PX);
    }
  });

  it("keeps its toast-column reservation, so the two layers stay disjoint", () => {
    const base = rulesFor(".impact-popups").find((r) => r.media === null && decl(r.body, "right") !== null)!;
    expect(decl(base.body, "right"), "the popup lane gave up its right reservation").toContain("safe-area-inset-right");
  });
});

describe("the footer's reservation is measured from the edge it is anchored to", () => {
  it("is zero in portrait, where the footer is at the top", () => {
    // This is the whole defect. `--hud-footer-height` is 346 in portrait and is
    // a distance DOWNWARD; using it as a `bottom` inset parks a bottom-anchored
    // lane 278px up a 844px screen, i.e. in the middle of the flight field.
    expect(messageBand(FRAMES["390x844"]!).footerBottom).toBe(0);
    expect(messageBand(FRAMES["1200x762"]!).footerBottom).toBe(162);
  });

  it("is the same number whether the band reports it or the caller publishes it", () => {
    // `HUD.publishMessageBand` has to write `--hud-footer-bottom` BEFORE it
    // reads `.quips`, which is anchored to it. Two expressions of one value is
    // two numbers waiting to disagree, so the caller uses this and `messageBand`
    // uses this; the test below fails the day one of them stops.
    for (const [vp, frame] of Object.entries(FRAMES)) {
      expect(
        footerBottomReservation(frame),
        `${vp}: publishMessageBand and messageBand disagree about the footer's bottom reservation`,
      ).toBe(messageBand(frame).footerBottom);
    }
    expect(footerBottomReservation({ anchoredTop: true, footerPx: 346 })).toBe(0);
    expect(footerBottomReservation({ anchoredTop: false, footerPx: 162 })).toBe(162);
  });

  it("every bottom-anchored lane reads the orientation-correct variable", () => {
    for (const sel of [".quips", ".slope-chain"]) {
      const rules = rulesFor(sel);
      expect(rules.length, `${sel} has no rule`).toBeGreaterThan(0);
      for (const r of rules) {
        if (decl(r.body, "bottom") === null) continue;
        expect(
          decl(r.body, "bottom"),
          `${sel}${r.media ? ` @media ${r.media}` : ""} anchors to --hud-footer-height, which measures the wrong edge in portrait`,
        ).toContain("--hud-footer-bottom");
      }
    }
  });
});

describe("the stack has one order and one source", () => {
  it("the hand hangs off the band and the toast lane hangs off the hand", () => {
    const shown = messageBand(FRAMES["1200x762"]!);
    expect(shown.stackBottom - shown.bottom, "the hand's height is not in the stack")
      .toBeCloseTo(FRAMES["1200x762"]!.handPx + LANE_GAP_PX * 2, 6);
    // `.hand` is `display:none` under `max-height: 500px`; with it gone the stack
    // is the band and one gap, which is what keeps 844x390 from reserving 68px
    // of corridor for a coach that is not painted.
    const hidden = messageBand(FRAMES["844x390"]!);
    expect(hidden.stackBottom - hidden.bottom).toBe(LANE_GAP_PX);
  });

  it("`.hand`, `.toasts` and `.impact-popups` all read the published stack", () => {
    expect(effective(".hand", "top")).toContain("--hud-messages-bottom");
    expect(effective(".toasts", "top")).toContain("--hud-stack-bottom");
    expect(effective(".impact-popups", "top")).toContain("--hud-stack-bottom");
  });

  it("no breakpoint re-anchors a message lane, because a breakpoint is not a measurement", () => {
    // This is the drift rule proper. A per-breakpoint `top` is a second guess
    // at a number `publishMessageBand` now measures, and it is the only kind of
    // rule that can put two lanes in the same pixels while both look correct.
    for (const sel of [".flight-messages", ".toasts", ".hand", ".impact-popups"]) {
      const restating = rulesFor(sel)
        .filter((r) => r.media !== null)
        .map((r) => decl(r.body, "top"))
        .filter((v): v is string => v !== null);
      expect(restating, `${sel} is re-anchored by a breakpoint`).toEqual([]);
    }
  });

  it("the ring chain clears the top of the free band, which is the footer in portrait", () => {
    expect(effective(".ring-chain", "top")).toContain("--hud-chain-clear");
    // In portrait the ceiling is the footer's bottom, not the header's.
    expect(messageBand(FRAMES["390x844"]!).chainClear).toBe(354);
    expect(messageBand(FRAMES["1200x762"]!).chainClear).toBe(172.2);
  });
});

describe("the band is no longer capped per child", () => {
  it("`.flight-messages > *` has no max-height", () => {
    // 64px clipped 16px off a two-line coaching cue: the band is 74px at
    // 1200x762, so the second line lost its descenders.
    expect(css).not.toMatch(/\.flight-messages\s*>\s*\*\s*\{[^}]*max-height/);
  });

  it("and `.coach-steps` is a flow child of the band, not a `top: 30%` guess", () => {
    const bar = rulesFor(".coach-steps").find((r) => r.media === null && r.selector.trim() === ".coach-steps")!;
    expect(decl(bar.body, "position")).toBe("static");
    expect(decl(bar.body, "top"), "the bar is absolutely positioned again").toBeNull();
    expect(decl(bar.body, "margin-top"), "the bar is guessing at the sentence's height again").toBeNull();
  });
});

describe("a message is evicted when it has been READ, not when a constant expires", () => {
  /**
   * `oldestToastAgeMs` returned a boolean dressed as an age — 0 until a
   * 520ms grace timer fired, `Infinity` after — so `decideToast` could only
   * ever answer on the requirement's *sign*, never its value. Every message
   * was evicted at 520ms, including the ones the read model prices at 6s.
   */
  it("a two-word message is not evictable at the old 520ms floor", () => {
    const hold = messageHoldMs("Butter landing");
    expect(hold).toBeGreaterThan(TOAST_MIN_VISIBLE_MS);
    expect(decideToast(1, 1, TOAST_MIN_VISIBLE_MS, 0, hold).action).toBe("defer");
  });

  it("and is evictable exactly when it has been read", () => {
    const hold = messageHoldMs("Butter landing");
    expect(decideToast(1, 1, hold - 1, 0, hold).action).toBe("defer");
    expect(decideToast(1, 1, hold, 0, hold).action).toBe("show");
  });

  it("the deferral is the remaining read time, not the flat floor", () => {
    const hold = messageHoldMs("The ridge is a suggestion, not a contract");
    expect(hold).toBeGreaterThan(TOAST_MIN_VISIBLE_MS);
    expect(decideToast(1, 1, 900, 0, hold)).toEqual({ action: "defer", waitMs: hold - 900 });
  });

  it("defaults to the floor for a caller that has no read model to offer", () => {
    expect(decideToast(1, 1, TOAST_MIN_VISIBLE_MS, 0).action).toBe("show");
    expect(decideToast(1, 1, TOAST_MIN_VISIBLE_MS - 1, 0).action).toBe("defer");
  });
});

/**
 * The footer has two orientations, and CSS cannot tell which one it is in.
 *
 * Landscape pins `.flight-footer` to the viewport's bottom edge. Portrait
 * overrides it to `top: calc(var(--hud-header-height) + 8px)` — parked just
 * under the header — which inverts what `--hud-footer-height` measures: a
 * bottom RESERVATION in one case, a downward BAND in the other. Every consumer
 * of that variable has to pick the right reading, and the test for "which one"
 * is the thing that got wrong.
 *
 * The heuristic that failed was "is the footer's top in the upper half of the
 * screen?", which is false precisely where it mattered. On a 320x568 phone the
 * header runs 290px down the screen, so the portrait footer parked under it at
 * y 310 sits BELOW the midpoint at y 284. Called bottom-anchored, it reserved
 * 258px from the bottom instead of 427px from the top, and the coaching band
 * landed at y 306 — inside the footer's own 310..427 box, overlapping it by
 * 196x51px. The header being tall is what makes the midpoint wrong, and the
 * header is tallest on the narrowest phones, which is where the bug bit.
 *
 * The test below is the real discriminator: the top-anchored footer is parked
 * a few px below the header's bottom edge whatever the viewport's shape,
 * while a bottom-anchored footer is pinned to the bottom edge and therefore
 * far below the header on any screen tall enough to hold both.
 */
describe("footerAnchoredTop", () => {
  it("sees the portrait footer as top-anchored even below the screen's midpoint", () => {
    // 320x568: hud starts at y 12, header is 290px, footer parked at y 310.
    // 310 - 12 = 298, against a header of 290 plus 16px of slack. The midpoint
    // test fails here (298 > 568/2); this one does not.
    const anchored = footerAnchoredTop({ footerTop: 310, hudTop: 12, headerPx: 290 });
    expect(anchored).toBe(true);
    expect(310 - 12).toBeGreaterThan(568 / 2);
  });

  it("sees the landscape footer as bottom-anchored at every frozen frame", () => {
    // 1280x800 / 844x390 / 568x320, all measured from the race fixture.
    for (const f of [
      { hudTop: 12, headerPx: 190, footerTop: 670.5 },
      { hudTop: 4, headerPx: 159, footerTop: 268.5 },
      { hudTop: 4, headerPx: 156, footerTop: 186 },
    ]) {
      expect(footerAnchoredTop(f)).toBe(false);
    }
  });

  it("puts the boundary at the header's bottom edge, not at a fraction of the screen", () => {
    const base = { hudTop: 0, headerPx: 100 };
    // Parked exactly on the header's bottom edge: top-anchored.
    expect(footerAnchoredTop({ ...base, footerTop: 100 })).toBe(true);
    // One px past the slack: still top-anchored, which is the 8px the portrait
    // rule's own offset leaves plus rounding.
    expect(footerAnchoredTop({ ...base, footerTop: 100 + FOOTER_TOP_ANCHOR_SLACK_PX })).toBe(true);
    // One px beyond the slack: the footer has started travelling downward.
    expect(footerAnchoredTop({ ...base, footerTop: 100 + FOOTER_TOP_ANCHOR_SLACK_PX + 1 })).toBe(false);
  });

  it("is offset from the play area's top, so a HUD that starts below the page top still reads", () => {
    // Same footer and header, play area 40px down the page: the difference is
    // unchanged, so the answer must be too. A test written against raw page
    // coordinates instead would flip here.
    expect(footerAnchoredTop({ footerTop: 350, hudTop: 40, headerPx: 290 })).toBe(
      footerAnchoredTop({ footerTop: 310, hudTop: 0, headerPx: 290 }),
    );
  });

  it("follows the slack constant rather than hard-coding the boundary twice", () => {
    // If the slack changes, the boundary moves with it. This fails if someone
    // widens the constant without checking what it reclassifies.
    const just = (delta: number) =>
      footerAnchoredTop({ footerTop: 100 + FOOTER_TOP_ANCHOR_SLACK_PX + delta, hudTop: 0, headerPx: 100 });
    expect(just(0)).toBe(true);
    expect(just(1)).toBe(false);
    expect(just(-1)).toBe(true);
  });
});
