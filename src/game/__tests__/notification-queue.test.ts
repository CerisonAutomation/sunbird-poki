import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationQueue } from "../NotificationQueue";
import { messageHoldMs } from "../MessageTiming";

/**
 * NotificationQueue is currently unreferenced — nothing constructs it and it is
 * absent from the shipped bundle, so it earns no coverage for free. It is
 * tested anyway, for the two reasons that matter: it is a complete
 * implementation someone wrote, and it had two defects that would surface the
 * moment it is wired up. Both are pinned below.
 */

const HOLD_MS = 3000;
const EXIT_MS = 240;
const MAX_VISIBLE = 2;

let container: HTMLElement;
let q: NotificationQueue;

const dom = () => container.querySelectorAll(".hud-notification");

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  q = new NotificationQueue(container);
});

afterEach(() => {
  q.dispose();
  container.remove();
  vi.useRealTimers();
});

/** Advance past the hold so a notification is mid-fade, not yet gone. */
const intoFade = () => vi.advanceTimersByTime(HOLD_MS);

describe("NotificationQueue — capacity", () => {
  it("shows at most two at a time and queues the rest", () => {
    q.push("a");
    q.push("b");
    q.push("c");
    expect(q.visibleCount).toBe(MAX_VISIBLE);
    expect(q.pendingCount).toBe(1);
    expect(dom()).toHaveLength(MAX_VISIBLE);
  });

  it("preserves arrival order in the DOM and in the queue", () => {
    q.push("first");
    q.push("second");
    q.push("third");
    expect([...dom()].map((e) => e.textContent)).toEqual(["first", "second"]);
  });

  it("carries the kind through as a class so styling can differ", () => {
    q.push("gold!", "gold");
    q.push("careful", "warn");
    const els = [...dom()];
    expect(els[0]!.className).toContain("gold");
    expect(els[1]!.className).toContain("warn");
    expect(els[0]!.className).toContain("hud-notification");
  });

  it("renders text as text, never as markup", () => {
    q.push("<img src=x onerror=alert(1)>");
    const el = dom()[0]!;
    expect(el.querySelector("img")).toBeNull();
    expect(el.textContent).toBe("<img src=x onerror=alert(1)>");
  });
});

describe("NotificationQueue — never exceeds two on screen", () => {
  // The defect this pins: `dismiss` used to splice the entry out of `live` the
  // instant the hold expired and only THEN start a 240ms CSS fade. A queued
  // notification arriving inside that window took the freed slot and rendered
  // while the old element was still in the DOM — so three notifications were
  // briefly visible, which is the one thing MAX_VISIBLE exists to prevent.
  it("does not start a third while two are still fading out", () => {
    // Staggered on purpose: a and b must expire at DIFFERENT instants for the
    // mid-fade window to exist. Pushed together they expire together and the
    // slot question never arises.
    // Timeline, DERIVED from the model rather than hardcoded. This used to
    // assume a flat 3000 ms hold, so pointing the queue at the shared
    // word-based model (which gives a one-word notification the 1100 ms floor)
    // silently moved every event and the assertion below was then measuring a
    // window that no longer existed. A test whose schedule is written out long-
    // hand is a test that breaks when the duration is fixed.
    //
    //   t=0     push a  -> a's hold expires at HOLD, fade done at HOLD+EXIT_MS
    //   t=+1000 push b  -> b expires 1000ms later; push c (queued)
    //   HOLD/2   a is MID-FADE: still in the DOM, but its slot must be gone
    //   HOLD+EXIT a's fade finished and c has taken the freed slot
    const HOLD = messageHoldMs("a");
    q.push("a");
    vi.advanceTimersByTime(1000);
    q.push("b");
    q.push("c");
    // Land inside a's fade window: after its hold expires (HOLD) but before the
    // fade completes (HOLD + EXIT_MS). `a` is still in the DOM, so `c` must
    // still be waiting — that is the whole point. We are already 1000ms in, so
    // only the remainder is advanced.
    vi.advanceTimersByTime(Math.max(1, HOLD + EXIT_MS / 2 - 1000));
    // b must still be on screen at this point or the sample is meaningless.
    expect([...dom()].map((e) => e.textContent)).toContain("b");

    // "a" is still on screen, so "c" must still be waiting. This is the
    // assertion the old code failed: it released the slot at t=3000.
    expect([...dom()].map((e) => e.textContent)).toEqual(["a", "b"]);
    expect(q.visibleCount).toBe(MAX_VISIBLE);
    expect(q.pendingCount).toBe(1);

    // Advance past a's fade completing (it is mid-fade at this point, so the
    // remainder of the fade is what's left, not a magic number).
    vi.advanceTimersByTime(EXIT_MS / 2 + 1);
    expect([...dom()].map((e) => e.textContent)).toEqual(["b", "c"]);

    // Now the real case: two leaving together, a third waiting. A fresh
    // container, or `dom()` would count the first queue's leftovers too.
    const c2 = document.createElement("div");
    document.body.appendChild(c2);
    const dom2 = () => c2.querySelectorAll(".hud-notification");
    const q2 = new NotificationQueue(c2);
    q2.push("x");
    q2.push("y");
    q2.push("z");
    // x and y were pushed together, so they expire together: land in the
    // middle of their shared fade window.
    vi.advanceTimersByTime(messageHoldMs("x") + EXIT_MS / 2);
    expect(dom2().length, "x and y are both mid-fade").toBe(2);
    expect(q2.visibleCount, "neither slot is free yet").toBe(MAX_VISIBLE);
    expect(q2.pendingCount).toBe(1);
    expect([...dom2()].map((e) => e.textContent)).toEqual(["x", "y"]);
    q2.dispose();
    c2.remove();
  });

  it("stays at two across a rapid burst, checked at every step", () => {
    for (let i = 0; i < 8; i++) q.push(`n${i}`);
    // Walk the whole lifecycle in small steps and assert the invariant holds
    // at each one — an off-by-one in the slot release only shows up mid-fade.
    for (let t = 0; t < HOLD_MS * 3; t += 40) {
      vi.advanceTimersByTime(40);
      expect(q.visibleCount, `at t=${t}`).toBeLessThanOrEqual(MAX_VISIBLE);
      expect(dom().length, `at t=${t}`).toBeLessThanOrEqual(MAX_VISIBLE);
    }
  });

  it("drains the whole queue eventually", () => {
    for (let i = 0; i < 5; i++) q.push(`n${i}`);
    vi.advanceTimersByTime((HOLD_MS + EXIT_MS) * 6);
    expect(q.visibleCount).toBe(0);
    expect(q.pendingCount).toBe(0);
    expect(dom()).toHaveLength(0);
  });
});

describe("NotificationQueue — dispose", () => {
  it("removes everything on screen and empties the queue", () => {
    q.push("a");
    q.push("b");
    q.push("c");
    q.dispose();
    expect(dom()).toHaveLength(0);
    expect(q.visibleCount).toBe(0);
    expect(q.pendingCount).toBe(0);
  });

  it("cannot be resurrected by a push after dispose", () => {
    q.dispose();
    q.push("late");
    expect(dom()).toHaveLength(0);
    expect(q.visibleCount).toBe(0);
  });

  it("does not drain a queued notification after a mid-fade dispose", () => {
    // The second defect this pins: the EXIT timeout scheduled in `dismiss` was
    // not tracked, so a queue disposed while a notification was fading would
    // still fire its `drain()` afterwards and append elements into a container
    // the owner believed was torn down.
    q.push("a");
    q.push("b");
    q.push("c"); // queued
    intoFade(); // a and b are now mid-fade, with exit timers armed
    q.dispose();
    vi.advanceTimersByTime(EXIT_MS * 4);
    expect(dom()).toHaveLength(0);
  });

  it("cancels the hold timer so nothing fires after teardown", () => {
    q.push("a");
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    q.dispose();
    // Not zero: `show` arms a requestAnimationFrame for the enter transition
    // and jsdom schedules that on a timer too. What matters is that nothing
    // still mutates the DOM afterwards.
    vi.advanceTimersByTime(HOLD_MS * 2);
    expect(dom()).toHaveLength(0);
    expect(q.visibleCount).toBe(0);
  });
});
