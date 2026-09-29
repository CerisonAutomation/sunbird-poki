import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationQueue } from "../NotificationQueue";

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
    // Timeline. The mid-fade window is only EXIT_MS wide, so the sample has to
    // land inside it rather than near it:
    //   t=0     push a  -> a's hold expires t=3000, fade done t=3240
    //   t=1000  push b  -> b's hold expires t=4000; push c (queued)
    //   t=3100  a is MID-FADE: still in the DOM, but its slot must be gone
    //   t=3260  a's fade finished and c has taken the freed slot
    q.push("a");
    vi.advanceTimersByTime(1000);
    q.push("b");
    q.push("c");
    vi.advanceTimersByTime(2100); // t=3100

    // "a" is still on screen, so "c" must still be waiting. This is the
    // assertion the old code failed: it released the slot at t=3000.
    expect([...dom()].map((e) => e.textContent)).toEqual(["a", "b"]);
    expect(q.visibleCount).toBe(MAX_VISIBLE);
    expect(q.pendingCount).toBe(1);

    vi.advanceTimersByTime(160); // t=3260, a's fade is done
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
    vi.advanceTimersByTime(HOLD_MS);
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
