/**
 * The two progression moments that used to be silent *during* play.
 *
 * The goal strip (see `flight-goal-strip.test.ts`) makes progress visible; this
 * suite is about the instants progress *lands*:
 *
 *  1. **A career rung crossed mid-flight.** Lifetime distance only commits when
 *     the run lands, so the crossing is knowable in flight and used to be reported
 *     only on the results card — the biggest status jump in the game arrived as a
 *     line of text 20 s after it was earned.
 *  2. **A daily quest completed mid-flight.** Today's quests were evaluated from
 *     finished-run stats and drawn in a menu, so the day horizon never fired while
 *     the player was still flying.
 *
 * Both now fire in the run, and both are guarded here — including the structural
 * reason the rank-up gets its own banner: the flight HUD arbitrates *one* message
 * slot (`HudFeedback.feedbackSlot`), in which the finish countdown outranks the
 * goal pill for the last 900 m. A long flight is exactly where a rank-up happens,
 * so the rarest moment in the game must not be able to lose that arbitration.
 *
 * Research grounding: `docs/audits/PROGRESSION_FEEL_2026-09-24.md`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { wingsCrossing } from "../Career";
import { enqueuePop, feedbackSlot, type PopMoment } from "../HudFeedback";

import { cssRules, mountHud } from "./hudHarness";

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    disconnect() {}
    unobserve() {}
  });
  vi.spyOn(performance, "now").mockReturnValue(60_000);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("the rank-up crossing is noticed mid-flight, and only once", () => {
  const crossing = (flownMetres: number, nextNeeded: number, alreadyCued = false) =>
    wingsCrossing({ flownMetres, nextNeeded, alreadyCued });

  it("fires the instant this flight's metres cover the gap to the rung", () => {
    expect(crossing(340, 340)).toBe(true); // exactly on the line counts
    expect(crossing(900, 340)).toBe(true);
  });

  it("stays silent while the gap is still open", () => {
    expect(crossing(339, 340)).toBe(false);
    expect(crossing(0, 340)).toBe(false);
  });

  it("fires once per flight — a banner that repeats every frame is a stuck overlay", () => {
    expect(crossing(400, 340, true)).toBe(false);
  });

  it("stays silent at the top rank, where there is nothing left to cross", () => {
    expect(crossing(99_999, 0)).toBe(false);
    expect(crossing(99_999, -5)).toBe(false);
  });

  it("treats a non-finite gap or distance as no crossing, like wingsProximity does", () => {
    expect(crossing(Number.NaN, 340)).toBe(false);
    expect(crossing(400, Number.NaN)).toBe(false);
    // A non-finite distance is read as zero metres flown, exactly like
    // wingsProximity() reads it — it must not fire a rank-up on a corrupt frame.
    expect(crossing(Number.POSITIVE_INFINITY, 340)).toBe(false);
  });
});

describe("moments queue behind the single pill instead of overwriting each other", () => {
  const pop = (text: string, kind: PopMoment["kind"] = "quest"): PopMoment => ({ text, kind });

  it("keeps the order they were earned in", () => {
    const queued = enqueuePop(enqueuePop([], pop("Gold Rush")), pop("Coin Run"));

    expect(queued.map((q) => q.text)).toEqual(["Gold Rush", "Coin Run"]);
  });

  it("never mutates the queue it is handed", () => {
    const before: PopMoment[] = [pop("first")];
    const after = enqueuePop(before, pop("second"));

    expect(before).toHaveLength(1);
    expect(after).not.toBe(before);
  });

  it("drops the newest once three are waiting: stale pops draining out after landing are worse", () => {
    let q: PopMoment[] = [];
    for (const t of ["a", "b", "c", "d", "e"]) q = enqueuePop(q, pop(t), 3);

    expect(q.map((x) => x.text)).toEqual(["a", "b", "c"]);
  });

  it("the arbiter still outranks the pill with the finish countdown — the reason the banner is separate", () => {
    // Regression guard on the premise: if this ever stops being true, the rank-up
    // banner could be folded back into the pill and this suite should say so.
    expect(feedbackSlot({ countdown: 0, finishRemaining: 400, launchBannerT: 0, goalPop: "Gold Rush ✓" })).toBe("finish");
    expect(feedbackSlot({ countdown: 0, finishRemaining: 0, launchBannerT: 0, goalPop: "Gold Rush ✓" })).toBe("goal");
    expect(feedbackSlot({ countdown: 0, finishRemaining: 0, launchBannerT: 0, goalPop: "" })).toBe("hint");
  });
});

describe("the rank-up banner renders, and no arbitration can swallow it", () => {
  it("lives outside .flight-messages, whose children share the one slot", async () => {
    const { root } = await mountHud({ rankUp: "🦅 Sky Racer" });
    const banner = root.querySelector<HTMLElement>(".rank-up");

    expect(banner, "the flight HUD must render a rank-up banner").toBeTruthy();
    expect(banner!.closest(".flight-messages"), "it must not be a lane child, or feedbackSlot can hide it").toBeNull();
    expect(banner!.textContent).toBe("🦅 Sky Racer");
    expect(banner!.className).toContain("show");
    expect(banner!.getAttribute("aria-live")).toBe("polite");
  });

  it("clears once the moment is over", async () => {
    const { hud, snap, root } = await mountHud({ rankUp: "🦅 Sky Racer", version: 1 });
    Object.assign(snap, { rankUp: "", version: 2 });
    hud.update(snap as never);

    const banner = root.querySelector<HTMLElement>(".rank-up")!;
    expect(banner.textContent).toBe("");
    expect(banner.className).not.toContain("show");
  });

  it("no stylesheet hides the banner, and short viewports move and shrink it instead", () => {
    const targeting = (file: string) =>
      cssRules(file).filter((r) => r.sel.split(",").some((part) => part.trim().endsWith(".rank-up")));

    for (const file of ["game/ui.css", "index.css"]) {
      for (const rule of targeting(file)) {
        expect(rule.body, `${file}: ${rule.sel} must not hide the rank-up banner`).not.toMatch(/display:\s*none/);
      }
    }
    // The base rule legitimately starts at opacity 0 (that is its hidden state and
    // the animation's job), but no *viewport* override may blank it: that is how
    // the goal strip ended up invisible on phones in landscape.
    for (const rule of cssRules("index.css").filter((r) => r.sel.split(",").some((p) => p.trim().endsWith(".rank-up")))) {
      expect(rule.body, `index.css: ${rule.sel} must not blank the banner`).not.toMatch(/(^|;)\s*opacity:\s*0\s*(;|$)/);
    }

    // Short viewports shrink the banner to the band the lanes leave; they never
    // reposition it (its top comes from the measured lanes) and never remove it.
    const short = cssRules("index.css").filter((r) => r.sel.split(",").some((p) => p.trim().endsWith(".rank-up")));
    expect(short.length, "both max-height:500px queries must shrink the banner").toBeGreaterThanOrEqual(2);
    for (const rule of short) expect(rule.body, `${rule.sel} must not reposition the banner`).not.toMatch(/(^|;|\s)top:/);

    // The banner's own top must be the free-band midpoint — derived from BOTH
    // measured lanes — and not a bare viewport percentage, which cannot know how
    // tall the footer grew. See HudLayout.bannerCentre().
    const base = cssRules("game/ui.css").filter((r) => r.sel === ".rank-up").pop()!;
    expect(base.body).toMatch(/--hud-header-height/);
    expect(base.body).toMatch(/--hud-footer-height/);
    expect(base.body).toMatch(/100vh/);
    expect(base.body).toMatch(/\/\s*2/);
    expect(base.body, "no hardcoded viewport percentage for top").not.toMatch(/top:\s*\d+(\.\d+)?%/);
  });

  it("is dark ink on gold, because white on --coin-gold is about 1.9:1", () => {
    const rule = cssRules("game/ui.css").filter((r) => r.sel === ".rank-up").pop();

    expect(rule, ".rank-up must be styled").toBeTruthy();
    expect(rule!.body).toMatch(/color:\s*var\(--ink\)/);
    expect(rule!.body).toMatch(/var\(--coin-gold\)/);
    expect(rule!.body).toMatch(/pointer-events:\s*none/); // it must never eat a flap
  });

  it("respects reduced motion without losing the moment", () => {
    const rule = cssRules("game/ui.css").filter((r) => r.sel === ".rank-up.show" && /animation:\s*none/.test(r.body)).pop();

    expect(rule, "reduced motion must drop the animation, not the banner").toBeTruthy();
    expect(rule!.body).toMatch(/opacity:\s*1/);
  });
});

describe("a quest completion reads differently from a session goal", () => {
  it("marks the pill with the ladder that fired", async () => {
    const { root } = await mountHud({ goalPop: "Gold Rush ✓  +120 on landing", goalPopKind: "quest" });

    expect(root.querySelector(".goal-pop")!.className).toContain("kind-quest");
    expect(root.querySelector(".goal-pop")!.textContent).toContain("+120 on landing");
  });

  it("keeps a session goal in the goal green", async () => {
    const { root } = await mountHud({ goalPop: "Fly 900 m ✓  +52", goalPopKind: "goal" });

    expect(root.querySelector(".goal-pop")!.className).toContain("kind-goal");
    expect(root.querySelector(".goal-pop")!.className).not.toContain("kind-quest");
  });

  it("styles the quest pill apart from the goal pill, in ink that clears 7:1 on its own fill", () => {
    const rule = cssRules("game/ui.css").filter((r) => r.sel === ".goal-pop.kind-quest").pop();

    expect(rule, "the quest kind must have its own treatment").toBeTruthy();
    expect(rule!.body).toMatch(/color:\s*var\(--text-on-sky\)/); // #fff on the dark sky ink
    expect(rule!.body).toMatch(/text-shadow/);
    expect(rule!.body).toMatch(/var\(--halo-on-sky\)/);
  });
});
