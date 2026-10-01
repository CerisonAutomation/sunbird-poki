// Message layers must not occupy the same pixels.
//
// The report was "the messages overlap". Two layers were fighting: `.toasts` is
// a top-RIGHT column while flying, and `.impact-popups` is a lane that ran the
// full width (`left:50px; right:50px`) with the popup positioned AT the bird. A
// bird in the upper right of the corridor put "THUD!" directly under a milestone
// toast, and the player read both as one smear.
//
// Neither layer knew about the other, so nothing stopped it. This pins the
// invariant structurally: the popup lane's right inset reserves the toast
// column's width, and every breakpoint that resizes the toast column resizes
// the reservation in the same breath.
//
// The alternative — a runtime collision test in jsdom — cannot work here: jsdom
// performs no layout, so `getBoundingClientRect()` returns zeros and
// `HUD.popup()` bails on its own `lane.width < 80` guard. The geometry has to
// be asserted against the stylesheet.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/index.css"), "utf8");

/** Every rule block that sets `right:` on `.impact-popups`, with its selector. */
function reservationRules(): { selector: string; right: string }[] {
  const out: { selector: string; right: string }[] = [];
  // Match `selector { ... }` where the body contains `right:`.
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(css); m; m = re.exec(css)) {
    const selector = (m[1] ?? "").trim();
    const body = m[2] ?? "";
    if (!/\.impact-popups\b/.test(selector)) continue;
    const right = /(^|;)\s*right\s*:\s*([^;]+)/.exec(body)?.[2]?.trim();
    if (right) out.push({ selector, right });
  }
  return out;
}

/** Every declared toast width, i.e. the widths the reservation must match. */
function toastWidths(): string[] {
  const out: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(css); m; m = re.exec(css)) {
    const selector = (m[1] ?? "").trim();
    const body = m[2] ?? "";
    if (!/(^|[\s,])\.toasts(\s|$)/.test(selector)) continue;
    const w = /(^|;)\s*width\s*:\s*([^;]+)/.exec(body)?.[2]?.trim();
    if (w && /\d/.test(w)) out.push(w);
  }
  return out;
}

describe("the popup lane reserves the toast column", () => {
  const rules = reservationRules();

  it("every .impact-popups rule sets an explicit right inset", () => {
    expect(rules.length, "found at least the base lane").toBeGreaterThan(0);
    for (const r of rules) {
      expect(r.right, `selector: ${r.selector}`).not.toBe("50px");
    }
  });

  it("the base lane reserves a width the toast column actually uses", () => {
    const widths = toastWidths();
    expect(widths.length, "the toast column declares a width somewhere").toBeGreaterThan(0);
    const base = rules.find((r) => !r.selector.includes("@media"))!;
    // The reservation must be built from a real toast width, not a guessed
    // constant — otherwise the two drift the moment the toast column is retuned.
    const matched = widths.some((w) => base.right.includes(w));
    expect(
      matched,
      `base reservation "${base.right}" does not reuse any declared toast width (${widths.join(", ")})`,
    ).toBe(true);
  });

  it("every breakpoint that narrows the toast column also narrows the reservation", () => {
    // `min(280px, 34vw)` is the desktop column; `min(240px, 48vw)` is the <=640px
    // one. If a future breakpoint shrinks .toasts and forgets the lane, the two
    // layers start colliding again on exactly the small embedded frames that
    // reported the bug.
    const all = css;
    expect(all).toMatch(/min\(280px,\s*34vw\)/);
    expect(all).toMatch(/min\(240px,\s*48vw\)/);
    const reservations = rules.map((r) => r.right).join(" ");
    for (const w of ["min(280px, 34vw)", "min(240px, 48vw)"]) {
      expect(reservations, `no reservation reuses ${w}`).toContain(w);
    }
  });

  it("leaves the popup lane wide enough to still be foveal at the bird", () => {
    // The reservation must not eat the lane. `HUD.popup()` bails below 80px
    // wide and clamps into it, so a lane squeezed to nothing would silently
    // stop rendering impact text at all — trading one defect for a worse one.
    // The reservation is a fraction of viewport width, so assert it is bounded.
    const base = rules.find((r) => !r.selector.includes("@media"))!;
    const vw = /(\d+)vw/.exec(base.right);
    expect(vw, "reservation is expressed in vw").not.toBeNull();
    expect(Number(vw![1]), "must not reserve more than half the viewport").toBeLessThan(50);
  });
});