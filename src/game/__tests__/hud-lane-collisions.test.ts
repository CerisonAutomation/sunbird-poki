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

  it("every breakpoint that resizes the lane keeps it below the chain", () => {
    // The 640px and 500px overrides both restate `top`. If either drops back to
    // a literal the collision returns on exactly the frames Poki serves.
    const chainTop = headerOffset(decl(chainRule.body, "top")!)!;
    const anchored = rulesFor(".toasts").filter((r) => r.media !== null && headerOffset(decl(r.body, "top") ?? "") !== null);
    expect(
      anchored.length,
      "expected the max-width:640px and max-height:500px overrides to both restate the lane",
    ).toBeGreaterThanOrEqual(2);
    for (const r of anchored) {
      const t = headerOffset(decl(r.body, "top")!)!;
      expect(
        t,
        `@media ${r.media} re-anchored the lane to ${t}px, level with the chain at ${chainTop}px`,
      ).toBeGreaterThanOrEqual(chainTop + CHAIN_PILL_PX);
    }
  });
});

describe("on short viewports the lane stays off the flight controls", () => {
  it("is anchored below the header, not pulled up over the buttons", () => {
    // The `max-height: 600px` block. Mute and pause live in `.hud-controls` at
    // the top-right of the header, so any `top` small enough to clear the
    // viewport top is sitting on them.
    const short = rulesFor(".toasts").filter((r) => r.media?.includes("max-height: 600px"));
    expect(short, "the max-height:600px block must restate the lane").not.toHaveLength(0);
    for (const r of short) {
      const body = r.body;
      // Anchored to the bottom of the free band, off the measured footer.
      expect(decl(body, "bottom"), "the lane must anchor to the bottom").toContain("hud-footer-height");
      expect(decl(body, "top"), "the lane must release the top edge").toBe("auto");
    }
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
