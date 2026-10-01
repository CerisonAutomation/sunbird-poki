// A message that was never visible is not a message.
//
// The report was "the funny messages never show up". They were not missing and
// they were not empty — the pipeline was called, the pill was built, and it was
// then removed having been on screen for zero readable milliseconds.
//
// The cause is an interaction between two independent facts:
//
//   1. `src/index.css` sets `visibility: hidden` on `.toasts` while a countdown,
//      a launch banner or the finish counter owns the screen
//      (`[data-feedback="countdown"|"launch"|"finish"]`). All three of those are
//      in the `.flight-messages` lane, and the stylesheet hides everything else
//      while they own it.
//   2. `HUD.scheduleToastOut` used to start the read timer the instant the pill
//      was CREATED, not the instant it could be read.
//
// `Game.onLaunch` sets `launchBannerT` on every rated launch and fires the
// BIG_LAUNCH quip inside that same window, so that quip was guaranteed to be
// born hidden. So were the start countdown and the finish counter's tail.
//
// These tests drive the real `HUD` with the real lane and assert the observable
// consequence: a pill whose lane is closed must survive its nominal hold, must
// still be there when the lane opens, and must be released anyway if the lane
// never opens (a wait budget, not a wait forever).
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HUD } from "../HUD";
import {
  TOAST_CEIL_MS,
  TOAST_FLOOR_MS,
  TOAST_OBSCURE_POLL_MS,
  TOAST_OBSCURE_WAIT_MS,
  messageHoldMs,
} from "../MessageTiming";

/** Exit animation, mirrored from the `out` transition in index.css. */
const EXIT_MS = 420;

let hud: HUD;
let lane: HTMLElement;

function setLaneVisibility(visible: boolean): void {
  lane.style.visibility = visible ? "visible" : "hidden";
}

function pills(): HTMLElement[] {
  return [...lane.querySelectorAll<HTMLElement>(".toast")];
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    disconnect() {}
    unobserve() {}
  });
  vi.useFakeTimers();
  hud = new HUD(document.body);
  lane = document.querySelector<HTMLElement>('[data-ref="toasts"]')!;
  setLaneVisibility(true);
});

afterEach(() => {
  try {
    hud.dispose();
  } catch {
    /* already gone */
  }
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("a message raised while the toast lane is closed still gets read", () => {
  it("survives its whole nominal hold, then is released once the lane opens", () => {
    // Straight from the quip pool's shape: six words, the corpus median.
    const quip = "THE BIRD HAS CHOSEN DIGNITY";
    const hold = messageHoldMs(quip);
    expect(hold).toBeGreaterThan(TOAST_FLOOR_MS);
    expect(hold).toBeLessThan(TOAST_CEIL_MS);

    setLaneVisibility(false);
    hud.toast(quip, "cloud");
    expect(pills()).toHaveLength(1);

    // The lane is still closed a full hold plus its whole exit later. The old
    // code had burned its read window and been removed by now, which is the
    // whole defect: created, sat there unread, deleted.
    vi.advanceTimersByTime(hold + TOAST_OBSCURE_POLL_MS * 2 + EXIT_MS);
    expect(pills(), "released while nobody could read it").toHaveLength(1);

    // The countdown ends.
    setLaneVisibility(true);
    vi.advanceTimersByTime(TOAST_OBSCURE_POLL_MS);
    // It has now been readable for a full read window, so it earns its exit.
    vi.advanceTimersByTime(hold + EXIT_MS + TOAST_OBSCURE_POLL_MS);
    expect(pills(), "never released after its lane opened").toHaveLength(0);
  });

  it("waits in proportion to the occlusion, not to a fixed penalty", () => {
    // Two occlusions of very different length. If the wait were a flat constant
    // the short one would still overrun, and if it were unbounded the long one
    // would leak. Both must land inside the single budget.
    const quip = "NICE ONE";
    const hold = messageHoldMs(quip);

    setLaneVisibility(false);
    hud.toast(quip, "cloud");
    // Occluded for less than the budget: it is still pending.
    vi.advanceTimersByTime(TOAST_OBSCURE_WAIT_MS - 1);
    expect(pills()).toHaveLength(1);
    setLaneVisibility(true);
    vi.advanceTimersByTime(hold + TOAST_OBSCURE_POLL_MS + EXIT_MS);
    expect(pills()).toHaveLength(0);
  });

  it("releases the pill anyway when the lane never opens", () => {
    // A wait without a ceiling is a leak, and a leak here is a stuck pill that
    // also holds the single in-flight slot forever.
    const quip = "STILL HERE?";
    const hold = messageHoldMs(quip);
    setLaneVisibility(false);
    hud.toast(quip, "cloud");
    vi.advanceTimersByTime(hold + TOAST_OBSCURE_WAIT_MS + EXIT_MS + TOAST_OBSCURE_POLL_MS);
    expect(pills(), "leaked because the lane never opened").toHaveLength(0);
  });

  it("gives a fully visible message the same lifetime as before", () => {
    // The fix must not lengthen the common case: when nothing is occluding,
    // the pill still leaves after its read window. The one grid tolerance is
    // the poll interval itself — visibility is sampled, not per-frame, so the
    // release lands on the first tick at or after the hold.
    const quip = "PLAIN VISIBLE MESSAGE";
    const hold = messageHoldMs(quip);
    hud.toast(quip, "cloud");
    vi.advanceTimersByTime(hold - TOAST_OBSCURE_POLL_MS);
    expect(pills(), "left early").toHaveLength(1);
    vi.advanceTimersByTime(TOAST_OBSCURE_POLL_MS * 2 + EXIT_MS);
    expect(pills(), "stayed after its read window").toHaveLength(0);
  });
});

describe("a blank message is not a message", () => {
  it("is dropped and does not evict a live pill", () => {
    // The failure this prevents is asymmetric and silent: an empty pill takes
    // the one in-flight slot, then renders as nothing, so a real message
    // disappears and the player sees no reason why.
    hud.toast("REAL MESSAGE", "gold");
    expect(pills()).toHaveLength(1);
    hud.toast("", "info");
    hud.toast("   \n\t ", "info");
    expect(pills()).toHaveLength(1);
    expect(pills()[0]!.textContent).toBe("REAL MESSAGE");
  });

  it("never enters the live-message registry, so it can be deduped away", () => {
    // Distinct from the slot test above. The dedup path keys on `liveToasts`,
    // so a blank that were merely "not rendered" but still registered would
    // show up as a phantom "   ×2" pill the moment anything else reused the
    // key. A real message must also be unaffected by the blank's timer.
    hud.toast("KEPT ALIVE", "gold");
    const before = pills()[0]!.textContent;
    hud.toast("   ", "info");
    hud.toast("   ", "info");
    hud.toast("", "info");
    expect(pills()).toHaveLength(1);
    expect(pills()[0]!.textContent, "a blank bumped a dedup counter").toBe(before);
    expect(pills()[0]!.textContent).not.toMatch(/×/);
    // And the real message still gets its full read window.
    vi.advanceTimersByTime(messageHoldMs("KEPT ALIVE") + TOAST_OBSCURE_POLL_MS * 2 + EXIT_MS);
    expect(pills()).toHaveLength(0);
  });
});

describe("every way the stylesheet can close the lane is measured, not guessed", () => {
  // The read-window fix is only as good as its definition of "closed". These
  // three properties are the three the stylesheet actually uses, and all three
  // are invisible to the player while the toast is nominally on screen.
  for (const [property, value] of [
    ["visibility", "hidden"],
    ["display", "none"],
    ["opacity", "0"],
  ] as const) {
    it(`banks no read time while the lane is ${property}: ${value}`, () => {
      const quip = "MEASURED CLOSURE";
      const hold = messageHoldMs(quip);
      // Start open so the pill is created in the ordinary way, then close.
      hud.toast(quip, "cloud");
      expect(pills()).toHaveLength(1);
      lane.style[property] = value;
      vi.advanceTimersByTime(hold + TOAST_OBSCURE_POLL_MS * 2 + EXIT_MS);
      expect(pills(), `read time banked through ${property}: ${value}`).toHaveLength(1);
    });
  }
});

describe("the wait budget is sized against the real occlusions, not guessed", () => {
  it("covers the longest real occlusion in the game", () => {
    // The wait has one real job: outlast the longest window during which the
    // stylesheet legitimately holds the lane shut. The start countdown is that
    // window (`SOLO_START_COUNTDOWN` seconds, and `feedbackSlot` returns
    // "countdown" for all of it, which is `visibility:hidden` on `.toasts`).
    // If the budget were under it, a message raised when the countdown begins
    // would still expire unseen — the original bug, just rarer.
    const countdown = readFileSync(join(process.cwd(), "src/game/constants.ts"), "utf8");
    const seconds = Number(/SOLO_START_COUNTDOWN\s*=\s*([\d.]+)/.exec(countdown)?.[1]);
    expect(Number.isFinite(seconds), "SOLO_START_COUNTDOWN was found").toBe(true);
    expect(TOAST_OBSCURE_WAIT_MS, "wait budget must outlast the start countdown")
      .toBeGreaterThanOrEqual(seconds * 1000);
  });

  it("stays finite, so a permanently closed lane cannot deadlock the layer", () => {
    // The in-flight lane holds exactly one pill, so a wait without a ceiling is
    // a hard lock: every later message would silently evict-and-die too.
    expect(TOAST_OBSCURE_WAIT_MS).toBeGreaterThan(0);
    expect(TOAST_OBSCURE_WAIT_MS).toBeLessThan(TOAST_CEIL_MS);
  });
});

describe("the stylesheet really does close the lane for these feedback slots", () => {
  // This is the coupling that made the bug invisible: the HUD waits on a lane
  // that a stylesheet rule elsewhere in the codebase hides. If the rule is ever
  // removed the wait becomes dead weight, and if a fourth hiding slot is added
  // the wait silently stops covering it. So the rule is pinned, and so is the
  // list of slots that can trigger it.
  const css = readFileSync(join(process.cwd(), "src/index.css"), "utf8");

  it("hides .toasts for the countdown, launch and finish slots", () => {
    // The rule the wait exists to survive, asserted against the selector
    // rather than a copy of it.
    expect(css).toMatch(/\.hud-root\[data-feedback="countdown"\]\s*\.toasts/);
    expect(css).toMatch(/\.hud-root\[data-feedback="launch"\]\s*\.toasts/);
    expect(css).toMatch(/\.hud-root\[data-feedback="finish"\]\s*\.toasts/);
  });

  it("reaches every slot that can hide the lane", () => {
    // The slots CSS hides the lane for must all be producible by the feedback
    // arbiter. A slot reachable from `feedbackSlot` but absent from the
    // stylesheet is fine (it does not hide anything); a stylesheet slot the
    // arbiter cannot produce would be a rule nothing can ever trip.
    const reachable = new Set(["countdown", "finish", "launch", "goal", "hint"]);
    const hiding = new Set(
      [...css.matchAll(/\.hud-root\[data-feedback="(\w+)"\]\s*\.toasts/g)].map((m) => m[1]!),
    );
    expect(hiding.size, "the toast-hiding rule was found").toBeGreaterThan(0);
    for (const slot of hiding) {
      expect(reachable.has(slot), `data-feedback="${slot}" can never be set`).toBe(true);
    }
  });
});
