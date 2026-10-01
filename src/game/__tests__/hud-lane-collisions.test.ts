// Two HUD lanes were sharing the same corner, and a third was sharing a corner
// with the controls.
//
// C1 — `.ring-chain` and `.toasts`. Both are right-anchored at `right: 14px`.
// The chain took `var(--hud-header-height) + 4px` and the toast lane took a flat
// `112px`. The header height is measured at runtime and lands at ~106px on
// desktop, so the two sat 2px apart and overlapped across a ~113x33px corner at
// 1280x720, 360x640, 390x844 and every size between — on every flight where a
// ring chain happened to be live, which is most of them.
//
// C2 — on short viewports (`max-height: 600px`, i.e. exactly the 844x390
// landscape frame Poki embeds) the toast lane was pulled to `safe-area + 6px`,
// which put it at y 6..40 / x 620..830, directly over the mute and pause
// buttons at y 4..48 / x 744..840. The taps still registered — the lane is
// `pointer-events: none` — so nothing crashed; the player simply could not see
// what they were pressing, on the two controls most likely to generate a
// support ticket.
//
// Neither was visible to the suite. `e2e/layout.spec.ts` asserts
// `.hud-header` against `.toasts`, but `.ring-chain` is one of nine HUD elements
// that live in no flow lane, and `SunbirdPage.layoutFixture` never unhides it —
// so the exact two elements the surrounding CSS comments argue about were the
// two the fixture never exercised.
//
// jsdom performs no layout, so this asserts against the stylesheet, the same
// way `message-lanes.test.ts` does.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Comments are stripped before anything is parsed. The prose in this file
// argues about the exact values these rules used to carry, so a naive
// `right:\s*([^;]+);` happily matches `` `right: 14px` `` inside a comment and
// reports the lane as drifted when it is correct.
const css = readFileSync(join(process.cwd(), "src/index.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

interface Rule {
  /** Enclosing `@media` condition, or null at top level. */
  media: string | null;
  selector: string;
  body: string;
}

/** Every rule in the sheet, with the `@media` condition each one sits inside. */
function allRules(): Rule[] {
  const out: Rule[] = [];

  // A hand-rolled brace walk rather than a regex: a regex cannot tell the `}`
  // that closes a declaration block from one belonging to a nested construct,
  // and `indexOf("}")` runs to the next one it cannot see. Recursing into
  // at-rule blocks keeps each rule's media condition correct by construction —
  // there is no stack to keep in sync.
  function scan(text: string, media: string | null): void {
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
      if (prelude.startsWith("@media")) {
        scan(body, prelude.slice("@media".length).replace(/\s+/g, " ").trim());
      } else if (prelude.startsWith("@")) {
        // @keyframes / @supports / @font-face: not rules we assert on.
      } else if (prelude) {
        out.push({ media, selector: prelude, body });
      }
      i = j;
    }
  }

  scan(css, null);
  return out;
}

const RULES = allRules();

/** The declarations of every rule whose selector list ends in `sel`. */
function rulesFor(sel: string): Rule[] {
  return RULES.filter((r) =>
    r.selector
      .split(",")
      .some((s) => s.trim().endsWith(sel)),
  );
}

/** Value of `prop` in a rule body, or null. */
function decl(body: string, prop: string): string | null {
  return new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+);`).exec(body)?.[1]?.trim() ?? null;
}

/**
 * The numeric px offset added to the measured header height, or null when the
 * rule is not anchored to the header at all.
 */
function headerOffset(body: string): number | null {
  const m = /var\(--hud-header-height[^)]*\)\s*\+\s*(-?[\d.]+)px/.exec(body);
  return m ? Number(m[1]) : null;
}

// The ring-chain pill is ~33px tall, so any lane top less than 33px below the
// chain's top overlaps it.
const CHAIN_PILL_PX = 33;

// Both lanes have a base rule and an in-flight (`[data-flying="true"]`) rule.
// The in-flight ones are what share the corner during a flight, so those are
// the rules under test — the base rules are the menu/portrait layout.
const inFlight = (sel: string): Rule => {
  const hit = rulesFor(sel).find((r) => r.media === null && r.selector.includes('[data-flying="true"]'));
  if (!hit) throw new Error(`no in-flight rule for ${sel}`);
  return hit;
};
const chainRule = inFlight(".ring-chain");
// Source order decides at equal specificity, and the last top-level rule to
// touch `top` is the one that renders. There are two: an older wide-portrait
// anchor that the in-flight rule fully overrides, and the in-flight rule.
const laneRules = rulesFor(".toasts").filter((r) => r.media === null);
const effectiveLane = laneRules[laneRules.length - 1]!;

describe("the toast lane sits below the ring chain, not level with it", () => {
  it("the chain keeps the corner and the lane is pushed clear of it", () => {
    const chainTop = headerOffset(decl(chainRule.body, "top")!);
    const laneTop = headerOffset(decl(effectiveLane.body, "top")!);
    expect(chainTop, "the chain must be anchored to the measured header").not.toBeNull();
    expect(laneTop, "the lane must be anchored to the measured header, not a literal").not.toBeNull();
    expect(laneTop!).toBeGreaterThanOrEqual(chainTop! + CHAIN_PILL_PX);
  });

  it("both still share the right edge, so the lane cannot drift wide of it", () => {
    // If these ever diverge the lane escapes the collision but starts covering
    // the flight field instead, which is a different bug and just as visible.
    for (const [name, rule] of [
      ["chain", chainRule],
      ["lane", effectiveLane],
    ] as const) {
      const right = decl(rule.body, "right");
      expect(right, `${name} lost its right anchor`).toBeTruthy();
      expect(right, `${name} must respect the notch inset`).toContain("safe-area-inset-right");
    }
  });

  it("no breakpoint re-anchors the lane, because the band already has", () => {
    // The 640px and 500px overrides used to restate `top`, and this test checked
    // each restatement was still below the chain. That was a real defence, but it
    // is also the thing that let the four message lanes drift: a per-breakpoint
    // `top` is a second guess at a number `HUD.publishMessageBand` now measures,
    // and a second guess cannot be checked against a measurement for ever.
    //
    // So the contract is inverted. No breakpoint may restate `top` at all; the
    // only anchor is the measured band, whose `max()` floor is the header offset
    // asserted above. A new `@media` that wants to move the lane has to move the
    // band, which is the one place the arithmetic is reviewed.
    //
    // All four transient lanes are named, not just the toast lane. This used to
    // check `.toasts` alone, while the comment claimed a general rule — so a
    // breakpoint that re-anchored the coaching band, the coach hand or the popup
    // reservation reintroduced the exact second guess the comment rules out, and
    // the suite stayed green. The mutation that proved it: injecting
    // `@media (max-height: 360px) { .flight-messages { top: calc(var(--hud-header-height) + 76px) } }`
    // passed every assertion here.
    const anchored = [".flight-messages", ".toasts", ".hand", ".impact-popups"].flatMap((sel) =>
      rulesFor(sel)
        .filter((r) => r.media !== null && decl(r.body, "top") !== null)
        .map((r) => `${sel} @ ${r.media}`),
    );
    expect(
      anchored,
      "a breakpoint re-anchors a message lane; move --hud-stack-bottom / --hud-messages-top in HUD.publishMessageBand instead",
    ).toEqual([]);
  });
});

describe("on short viewports the lane stays off the flight controls", () => {
  it("stays in the measured stack, which is below the header by construction", () => {
    // Mute and pause live in `.hud-controls` at the top-right of the header, so
    // any `top` small enough to clear the viewport top is sitting on them.
    //
    // This used to be answered by re-anchoring the lane to the bottom of the free
    // band in a `max-height: 600px` block. That worked, and it cost a fourth
    // independent anchor: on a 844x390 frame the bottom-anchored lane landed at
    // y 132..172 while the measured band sat at y 150..177 — it moved the lane
    // out of the controls and straight into the coaching sentence. The stack is
    // the answer now, and the assertion is that it is the ONLY answer: the
    // breakpoint may compress the pill, but it may not place the lane.
    const short = rulesFor(".toasts").filter((r) => r.media?.includes("max-height: 600px"));
    expect(short, "the max-height:600px block must still compress the lane").not.toHaveLength(0);
    for (const r of short) {
      expect(decl(r.body, "top"), `@media ${r.media} re-anchors the toast lane`).toBeNull();
      expect(decl(r.body, "bottom"), `@media ${r.media} re-anchors the toast lane`).toBeNull();
    }
    // And the one anchor it does have puts it below the measured band, so it
    // cannot be inside the header whatever the viewport.
    //
    // The variable is `--hud-stack-bottom`, not `--hud-messages-bottom`. The
    // coach hand hangs OFF the band rather than off the header, so the bottom of
    // the band is not the bottom of the stack: the hand's own measured height
    // sits between them. A lane anchored to the band's bottom would therefore
    // land on the hand — which is the same collision this test exists to catch,
    // one variable name further down. The header term stays in the expression as
    // a floor for the window before the band has been measured.
    expect(decl(effectiveLane.body, "top")).toContain("--hud-stack-bottom");
  });
});

describe("impact popups respect prefers-reduced-motion", () => {
  // The variants are named in the SELECTOR list, not the body — a rule that
  // only froze `.impact-popup` would leave `--thud` and `--bop` animating.
  const reduced = RULES.filter((r) => r.media?.includes("prefers-reduced-motion: reduce"));
  const popupRules = reduced.filter((r) => r.selector.includes(".impact-popup"));
  const covered = popupRules.flatMap((r) => `${r.selector}\n${r.body}`).join("\n");

  it("are frozen, not merely slowed", () => {
    // `ui.css` kills animation with an `!important` longhand on `*`. The thud
    // and bop variants declare theirs via the `animation` SHORTHAND with
    // `!important`, and a shorthand at class specificity (0,1,0) outranks a
    // longhand on the universal selector (0,0,0). So the largest, fastest,
    // most motion-heavy element in the flight HUD — 28-38px type scaling to
    // 1.4x, travelling 210% of its own height — played in full for exactly the
    // players who asked for stillness, while every other pulse stopped.
    expect(popupRules.length, "no reduced-motion rule covers .impact-popup").toBeGreaterThan(0);
    expect(covered).toMatch(/animation:\s*none\s*!important/);
    for (const v of ["--thud", "--bop", ".rise"]) {
      expect(covered, `reduced-motion does not cover .impact-popup${v}`).toContain(v);
    }
  });

  it("leaves the popup visible rather than hiding the feedback", () => {
    // Freezing the animation is the point; deleting the element is a different
    // decision, and it would take the hit feedback with it.
    expect(covered).toContain("opacity: 1");
    expect(covered).not.toContain("display: none");
  });
});

describe("the touch ripple respects prefers-reduced-motion without spending !important", () => {
  // The ripple is a bare <span class="touch-ripple p1"> (Input.spawnTouchRipple).
  // It is the tap feedback for a one-button game, so reduced-motion still has to
  // neutralise it — but it must be HIDDEN, not slowed: the motion lives in the
  // animation, so a duration override would still paint a 52px circle.
  //
  // The `!important` that used to sit on this rule was pure debt. Nothing in
  // any sheet competes for `display` on this class, so at (0,1,0) it wins on
  // its own. Paying specificity debt to re-assert a rule that already wins is
  // how the index.css ratchet creeps upward one legitimate fix at a time.
  const ripple = RULES.filter(
    (r) => r.media?.includes("prefers-reduced-motion: reduce") && r.selector.includes(".touch-ripple"),
  );

  it("hides the ripple outright", () => {
    expect(ripple.length, "no reduced-motion rule covers .touch-ripple").toBeGreaterThan(0);
    const body = ripple.map((r) => r.body).join("\n");
    expect(decl(body, "display"), "a slowed ripple is still a visible circle").toBe("none");
  });

  it("carries no !important, because nothing competes for display", () => {
    const body = ripple.map((r) => r.body).join("\n");
    expect(body, "the ripple rule regressed to specificity debt").not.toContain("!important");
  });
});

/** Count top-level whitespace-separated tracks, so `minmax(0, 1fr)` is one. */
function trackCount(value: string): number {
  let depth = 0;
  let count = 0;
  let seenToken = false;
  for (const ch of value) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (depth === 0 && /\s/.test(ch)) {
      if (seenToken) count++;
      seenToken = false;
      continue;
    }
    if (depth === 0 && !/\s/.test(ch)) seenToken = true;
  }
  return seenToken ? count + 1 : count;
}

/** The track list of a `grid-template-columns`, split on the whitespace that
 *  is not inside a function. `minmax(0, 1fr)` is one track, not two. */
function splitTracks(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of value) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (depth === 0 && /\s/.test(ch) && current) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current) out.push(current);
  return out;
}

describe("the altitude gauge clears the footer in the orientation the footer moves", () => {
  // `--hud-footer-height` does not mean one thing. `HUD` measures it from the
  // bottom on landscape, but design-polish.css moves the footer to the TOP in
  // portrait and `HUD` switches to measuring its bottom edge downward instead.
  // The base `.play-hud .alt-gauge` rule reads the variable the landscape way
  // and subtracts it from `100%`.
  //
  // In portrait that arithmetic asks for a spot above a footer that is not
  // there. At 320x568 the gauge took the header term (H + 28 = 195.4) because
  // the footer term (100% - 290.4 - 46 = 231.6) was larger, while the footer
  // actually starts at H + 8 = 175.4 — so the gauge rendered inside the goal
  // strip by 33x44px. Its height term came out at 38.2px, under the 44px
  // floor, so it was crushed as well: wrong place and wrong size at once.
  const portrait = RULES.filter(
    (r) => r.media?.includes("max-aspect-ratio") && r.selector.includes(".alt-gauge"),
  );

  it("has a portrait override, because the base rule cannot be right in both", () => {
    expect(
      portrait.length,
      "no portrait override for .alt-gauge; the base rule reads --hud-footer-height as a bottom inset, which a top-anchored footer is not",
    ).toBeGreaterThan(0);
    expect(decl(portrait.map((r) => r.body).join("\n"), "top"), "the portrait override does not place the gauge").toBeTruthy();
    expect(decl(portrait.map((r) => r.body).join("\n"), "height"), "the portrait override does not size the gauge").toBeTruthy();
  });

  it("hangs below whichever of the header and the footer ends lower", () => {
    // The premise of the whole fix: the footer's TOP edge is `H + 8`, so no
    // fixed header offset can clear it. Only a `max()` over both offsets can,
    // and `min()` is the bug being asserted against — it is what picked the
    // header term and dropped the gauge into the strip.
    const top = decl(portrait.map((r) => r.body).join("\n"), "top")!;
    expect(top, "the portrait gauge must clear the footer, so it needs a max()").toMatch(/max\(/);
    expect(top, "the portrait gauge no longer clears the header").toContain("--hud-header-height");
    expect(top, "the portrait gauge no longer clears the footer").toContain("--hud-footer-height");
  });

  it("sizes from the footer's bottom edge, not from both edges", () => {
    // The old term was `100% - H - F - 72`: subtracting the header again on top
    // of a `max()` top that already clears it is what drove the height under
    // the floor. Below the footer the header is spent.
    const height = decl(portrait.map((r) => r.body).join("\n"), "height")!;
    expect(height, "the portrait height must be measured from the footer's bottom edge").toContain("--hud-footer-height");
    expect(height, "the header is already cleared by the top; subtracting it again starves the height").not.toContain("--hud-header-height");
  });
});

describe("the narrow top bar has a track for everything it places", () => {
  // At <=640px the daylight meter is moved onto its own full-width row two
  // lines down. Nothing is placed in the third column of row one — but the
  // `auto` track still took its size from the spanning meter and took 96px off
  // the row, leaving each stat block 88px. The best row needs 76px of content
  // inside a 76px box, so "1.44 km" broke into "1.44" / "km".
  const narrowTopBar = rulesFor(".hud-header .top-bar").filter(
    (r) => r.media?.includes("max-width: 640px") && decl(r.body, "grid-template-columns") !== null,
  );
  const narrowSun = rulesFor(".hud-header .sun-meter").filter(
    (r) => r.media?.includes("max-width: 640px") && decl(r.body, "grid-row") !== null,
  );

  it("declares exactly as many tracks as it places items on the first row", () => {
    expect(narrowTopBar.length, "the <=640px top-bar grid rule is gone").toBeGreaterThan(0);
    const cols = decl(narrowTopBar[0]!.body, "grid-template-columns")!;
    // The premise, checked first: the meter really is on its own row, so the
    // first row really does hold only the two stat blocks. Without this the
    // column count below would be asserting an accident.
    expect(narrowSun.length, "the <=640px rule no longer moves the sun meter off row one").toBeGreaterThan(0);
    expect(decl(narrowSun[0]!.body, "grid-row"), "the sun meter is back on row one, so a third track is needed").toBe("2");
    expect(
      trackCount(cols),
      `the first row places two stat blocks but the grid declares ${trackCount(cols)} tracks (${cols})`,
    ).toBe(2);
  });

  it("sizes the distance block from the free space, with no auto track between the stat blocks", () => {
    // Belt and braces on the specific mechanism: an `auto` track sitting BETWEEN
    // two 1fr tracks is exactly what starved them. Grid sizes an `auto` track
    // from its row's min-content — and on a row that also holds a column-spanning
    // sibling, that sibling's min-content leaks in, which is how an empty middle
    // track took 96px off a 76px block and broke "1.44 km" across two lines.
    //
    // A TRAILING `auto` is not the bug and is required: the coins column should
    // hug its number and let the distance block take whatever is left. So the
    // check is positional, not a blanket ban on `auto` — an earlier version of
    // this assertion forbade the token outright and was wrong.
    const cols = decl(narrowTopBar[0]!.body, "grid-template-columns")!;
    const tracks = splitTracks(cols);
    expect(
      tracks[0],
      `the distance block is in column 1 and must take the free space, so the first track is the flexible one (${cols})`,
    ).toMatch(/^1fr$|^minmax\(0,\s*1fr\)$/);
    const autoAt = tracks.findIndex((t) => t === "auto");
    expect(
      autoAt,
      `no auto track may sit between two stat blocks — it sizes off the spanning meter and starves them (${cols})`,
    ).toBe(tracks.length - 1);
  });
});
