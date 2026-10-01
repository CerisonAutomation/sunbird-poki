// The quip lane and the dedup branch, driven for real.
//
// Two things are being pinned here, and both are the same shape of defect: a
// timer that was armed but not tracked.
//
//  1. `quip()` had no coverage at all. The whole lane — `liveQuips` dedup,
//     `quipLayer.replaceChildren()`, `expireQuip()`, the visible-time hold —
//     could be reduced to `quip(text) { return; }` and the suite would still
//     pass. That is not a hypothetical: the lane is where the 211 flavour
//     lines the report called "missing" actually go, and they were missing
//     because of a hold that was spent while the lane was hidden.
//
//  2. The toast dedup branch — `if (live && live.el.isConnected)` — is the
//     branch that held the stale-id bug. `scheduleToastOut` re-arms itself
//     every poll tick but used to return only its FIRST id, so the create path
//     stored `timer: -1` and every later `cancelTimer(live.timer)` cancelled
//     nothing. The consequences were both silent: the pre-refresh poll chain
//     kept running and expired the pill on the ORIGINAL schedule, so a
//     duplicate did not actually extend anything; and the orphaned chain
//     re-armed forever, growing `this.timers` without bound.
//
// Assertions here are behavioural: they read the DOM the player reads, and
// they use literal millisecond values rather than the module's own constants,
// because comparing the code against numbers it exports is satisfied by any
// self-consistent model.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HUD } from "../HUD";

/** Fade-out before the node leaves the DOM, mirrored from `quip()`'s `out`. */
const QUIP_EXIT_MS = 260;
/** Toast exit animation, mirrored from the `out` transition in index.css. */
const TOAST_EXIT_MS = 420;
/** The quip hold, as a literal. See the note above on why not the export. */
const HOLD_MS = 3400;
/** Extra wait a hidden-lane quip is granted before it is released anyway:
 *  3400 + 2400. A test that waits longer than this is waiting past the
 *  release, not measuring whether read time was banked. */
const BUDGET_MS = 5800;
/** Hold for a two-word toast, as a literal: 450 acquire + 2 words × 415. The
 *  toast lane is not the quip lane and does NOT hold for `HOLD_MS`; using the
 *  quip's number here would have the pill expire long before the assertion. */
const LINE_HOLD_MS = 1280;
/** Hold once the line has been merged and reads "MERGED LINE ×2" — three words,
 *  so 450 + 3 × 415. Measured: the pill is removed 2150 ms after the merge,
 *  which is this hold plus the 420 ms exit plus up to one 100 ms poll. */
const MERGED_HOLD_MS = 1695;

let hud: HUD;
let quipLane: HTMLElement;
let toastLane: HTMLElement;

function quips(): HTMLElement[] {
  return [...quipLane.querySelectorAll<HTMLElement>(".quip")];
}

function pills(): HTMLElement[] {
  return [...toastLane.querySelectorAll<HTMLElement>(".toast")];
}

/** Armed timers, read through the private set. White-box on purpose: an
 *  orphaned re-arming poll has no player-visible symptom once its node is
 *  gone, so "the poller went quiet" can only be observed here. */
function armedTimers(): number {
  return (hud as unknown as { timers: Set<number> }).timers.size;
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    disconnect() {}
    unobserve() {}
  });
  vi.useFakeTimers();
  hud = new HUD(document.body);
  quipLane = document.querySelector<HTMLElement>('[data-ref="quips"]')!;
  toastLane = document.querySelector<HTMLElement>('[data-ref="toasts"]')!;
  quipLane.style.visibility = "visible";
  toastLane.style.visibility = "visible";
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

describe("the quip lane shows exactly one line at a time", () => {
  it("puts the joke on screen with the text the caller asked for", () => {
    hud.quip("THE BIRD HAS CHOSEN DIGNITY");
    expect(quips()).toHaveLength(1);
    expect(quips()[0]!.querySelector(".toast-text")!.textContent)
      .toBe("THE BIRD HAS CHOSEN DIGNITY");
  });

  it("replaces the incumbent rather than stacking a second node", () => {
    // The lane is one node wide by design. Stacking would cover the first joke
    // with the second, which is the flicker the impact-popup bug was.
    for (const line of ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH"]) hud.quip(line);
    expect(quips(), "more than one quip node on a one-node lane").toHaveLength(1);
    expect(quips()[0]!.querySelector(".toast-text")!.textContent).toBe("FIFTH");
  });

  it("replaces even mid-fade, so an outgoing node cannot resurrect", () => {
    hud.quip("OUTGOING");
    vi.advanceTimersByTime(HOLD_MS - 10);
    expect(quips()).toHaveLength(1);
    hud.quip("INCOMING");
    // The outgoing node's removal is still pending. Letting it run must not
    // take the incoming node with it.
    vi.advanceTimersByTime(QUIP_EXIT_MS * 2);
    expect(quips()).toHaveLength(1);
    expect(quips()[0]!.querySelector(".toast-text")!.textContent).toBe("INCOMING");
  });

  it("ignores a blank rather than spending the only slot on nothing", () => {
    hud.quip("A REAL LINE");
    hud.quip("");
    hud.quip("   \n\t ");
    expect(quips()).toHaveLength(1);
    expect(quips()[0]!.querySelector(".toast-text")!.textContent).toBe("A REAL LINE");
  });
});

describe("a repeated quip bumps its counter instead of restarting it", () => {
  it("shows the multiplier and keeps one node", () => {
    hud.quip("AGAIN");
    hud.quip("AGAIN");
    hud.quip("AGAIN");
    expect(quips()).toHaveLength(1);
    expect(quips()[0]!.querySelector(".toast-text")!.textContent).toBe("AGAIN ×3");
  });

  it("restarts the hold, so the joke is not cut short by its own repeat", () => {
    // The whole point of dedup is that a recurring line stays readable. If the
    // repeat did not extend the hold, a line that recurs every second would be
    // evicted on the first one's schedule — visible as a line that blinks out
    // mid-read.
    //
    // The sample point matters and is not arbitrary. An un-refreshed quip is
    // removed at HOLD_MS + QUIP_EXIT_MS = 3660, but it is still IN THE DOM
    // right up to that moment, fading. Asserting at 3500 therefore passes
    // whether or not the refresh happened, because the doomed node is still on
    // screen. The two behaviours only separate once the un-refreshed node has
    // finished leaving, so the assertion is taken at 4000 — past 3660, and well
    // short of the refreshed deadline at 6400.
    hud.quip("REPEATING LINE");
    vi.advanceTimersByTime(HOLD_MS - 400);
    hud.quip("REPEATING LINE");
    expect(quips()[0]!.querySelector(".toast-text")!.textContent).toBe("REPEATING LINE ×2");
    vi.advanceTimersByTime(1000);
    expect(quips(), "expired on the pre-refresh schedule").toHaveLength(1);
    expect(quips()[0]!.querySelector(".toast-text")!.textContent).toBe("REPEATING LINE ×2");
  });

  it("lets the repeated line go once its refreshed hold elapses", () => {
    hud.quip("REPEATING LINE");
    vi.advanceTimersByTime(HOLD_MS - 400);
    hud.quip("REPEATING LINE");
    vi.advanceTimersByTime(400 + HOLD_MS + QUIP_EXIT_MS);
    expect(quips(), "the refreshed hold never released it").toHaveLength(0);
  });

  it("starts a fresh line at ×1 once the previous one has gone", () => {
    // This is the map/DOM invariant, asserted through its observable
    // consequence. A surviving `liveQuips` entry cannot itself survive its own
    // node, because the dedup branch requires `live.el.isConnected` — but a
    // leaked entry WOULD still be found, counted, and cancelled on the next
    // clear, and the counter would read ×2 for a line that has only been said
    // once since it reappeared.
    hud.quip("AGAIN");
    vi.advanceTimersByTime(HOLD_MS + QUIP_EXIT_MS);
    expect(quips()).toHaveLength(0);
    hud.quip("AGAIN");
    expect(quips()[0]!.querySelector(".toast-text")!.textContent).toBe("AGAIN");
  });
});

describe("a quip is held for time the player can read, not time that elapses", () => {
  it("stays up through its hold and then leaves", () => {
    hud.quip("A HELD LINE");
    vi.advanceTimersByTime(HOLD_MS - 50);
    expect(quips(), "left before its hold").toHaveLength(1);
    vi.advanceTimersByTime(QUIP_EXIT_MS * 2);
    expect(quips(), "stayed past its hold").toHaveLength(0);
  });

  it("banks no read time while the stylesheet has the lane hidden", () => {
    // The defect this whole lane exists to prevent: `Game.onLaunch` fires a
    // BIG_LAUNCH quip inside the launch banner's own window, and the
    // stylesheet hides `.quips` for that feedback slot. A flat timer burned
    // the read window of a lane whose entire job is to be read to the end.
    quipLane.style.visibility = "hidden";
    hud.quip("BORN HIDDEN");
    // Long enough to be well past the hold, short enough to still be inside the
    // release budget. Only then does "still here" mean "no read time banked"
    // rather than "the ceiling fired".
    vi.advanceTimersByTime(BUDGET_MS - 100);
    expect(quips(), "released while nobody could see it").toHaveLength(1);
  });

  it("still releases a quip whose lane never opens", () => {
    // A wait with no ceiling is a leak, and a leak holds the one slot forever.
    quipLane.style.visibility = "hidden";
    hud.quip("NEVER SEEN");
    vi.advanceTimersByTime(HOLD_MS * 4);
    expect(quips(), "leaked because the lane never opened").toHaveLength(0);
  });

  it("measures the lane the way the stylesheet hides it", () => {
    // `visibility` is the property the countdown / launch / finish rules use.
    // If the check moved to a different property this whole accounting would
    // pass while banking full read time through an invisible lane.
    for (const [property, value] of [
      ["visibility", "hidden"],
      ["display", "none"],
      ["opacity", "0"],
    ] as const) {
      hud.quip(`CLOSED BY ${property}`);
      quipLane.style[property] = value;
      vi.advanceTimersByTime(BUDGET_MS - 100);
      expect(quips(), `read time banked through ${property}: ${value}`).toHaveLength(1);
      quipLane.style[property] = property === "opacity" ? "1" : "";
      vi.advanceTimersByTime(HOLD_MS * 3);
      expect(quips(), `leaked through ${property}: ${value}`).toHaveLength(0);
    }
  });
});

describe("the toast dedup branch actually extends the pill it merges into", () => {
  // This is the branch that held the stale-id bug, and it is the assertion
  // that fails against it. Under the old code `scheduleToastOut` returned only
  // its first id, so the create path stored `timer: -1`; the dedup branch's
  // `cancelTimer(live.timer)` cancelled nothing, the original poll chain ran
  // to its own deadline, and the pill left on the PRE-merge schedule no matter
  // how recently the line had been re-announced.
  it("keeps the pill past the pre-merge deadline", () => {
    hud.toast("MERGED LINE");
    vi.advanceTimersByTime(LINE_HOLD_MS - 400);
    hud.toast("MERGED LINE");
    expect(pills()).toHaveLength(1);
    expect(pills()[0]!.querySelector(".toast-text")!.textContent).toBe("MERGED LINE ×2");
    vi.advanceTimersByTime(500);
    expect(pills(), "expired on the pre-merge schedule").toHaveLength(1);
  });

  it("releases it once the merged hold elapses", () => {
    hud.toast("MERGED LINE");
    vi.advanceTimersByTime(LINE_HOLD_MS - 400);
    hud.toast("MERGED LINE");
    vi.advanceTimersByTime(400 + MERGED_HOLD_MS + TOAST_EXIT_MS);
    expect(pills(), "the merged hold never released it").toHaveLength(0);
  });

  it("counts every repeat", () => {
    for (let i = 0; i < 4; i += 1) hud.toast("REPEATED SYSTEM LINE");
    expect(pills()).toHaveLength(1);
    expect(pills()[0]!.querySelector(".toast-text")!.textContent)
      .toBe("REPEATED SYSTEM LINE ×4");
  });

  it("does not strip the icon off a repeated line", () => {
    // The ×n bump assigns to `.toast-text`, not to the pill. Assigning on the
    // pill would destroy the icon element rendered beside it, so every picture
    // would silently disappear from every repeated message.
    hud.toast("MAGNET ACQUIRED", "gold", "magnet");
    expect(pills()[0]!.querySelector("svg"), "icon never rendered").not.toBeNull();
    hud.toast("MAGNET ACQUIRED", "gold", "magnet");
    expect(pills()[0]!.querySelector("svg"), "icon stripped by the ×n bump").not.toBeNull();
    expect(pills()[0]!.querySelector(".toast-text")!.textContent).toBe("MAGNET ACQUIRED ×2");
  });
});

describe("an orphaned poll cannot outlive its own message", () => {
  // The leak half of the same bug. The pre-fix dedup branch left the original
  // poll chain armed and untracked, and that chain re-armed itself forever: the
  // node is gone by then, so the only symptom is a timer set that grows for as
  // long as the game is open.
  it("leaves no armed poll behind after a merged line is gone", () => {
    hud.toast("MERGED LINE");
    hud.toast("MERGED LINE");
    hud.toast("MERGED LINE");
    vi.advanceTimersByTime(HOLD_MS * 3 + TOAST_EXIT_MS * 2);
    expect(pills()).toHaveLength(0);
    expect(armedTimers(), "a poll is still re-arming with nothing to show").toBe(0);
  });

  it("leaves no armed poll behind after a quip is gone", () => {
    hud.quip("A GONE QUIP");
    hud.quip("A GONE QUIP");
    vi.advanceTimersByTime(HOLD_MS * 3 + QUIP_EXIT_MS * 2);
    expect(quips()).toHaveLength(0);
    expect(armedTimers(), "a quip poll is still re-arming").toBe(0);
  });

  it("leaves no armed poll behind after a lane that never opened", () => {
    // The release-on-timeout path must end the chain too, not just fire the
    // removal once.
    quipLane.style.visibility = "hidden";
    hud.quip("LEAK CANDIDATE");
    vi.advanceTimersByTime(HOLD_MS * 6);
    expect(quips()).toHaveLength(0);
    expect(armedTimers(), "the timeout path leaked its poll").toBe(0);
  });

  it("cancels the incumbent's poll when a quip replaces it", () => {
    // The replacement loop cancels each incumbent's timer before dropping its
    // map entry. An orphan cannot leak on its own — it fires once against a
    // detached node, finds `!isConnected`, and stops — so "the timer set is
    // flat" is NOT the observable. The observable is that the cancellation
    // happens at all, and it is measured mid-flight, where an uncancelled
    // incumbent's poll is still armed and counted.
    //
    // Measured: 12 quips at 200 ms apart leave exactly one armed poll with the
    // cancel, and 12 without it. One poll is the newest quip's own.
    for (let i = 0; i < 12; i += 1) {
      hud.quip(`BURST ${i}`);
      vi.advanceTimersByTime(200);
    }
    expect(armedTimers(), "an incumbent's poll outlived the quip that replaced it")
      .toBe(1);
    vi.advanceTimersByTime(HOLD_MS * 2 + QUIP_EXIT_MS * 2);
    expect(quips()).toHaveLength(0);
  });
});
