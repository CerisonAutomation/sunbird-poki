/**
 * NotificationQueue — a small, self-contained queue for ambient "event"
 * notifications (world surprises like "Achoo!", Golden Hour, and similar
 * one-off flavour beats) that are distinct from the main feedback toast
 * layer (`HUD.toast()`).
 *
 * `HUD.toast()` already owns constant gameplay feedback (coins, quests,
 * pickups) and caps itself to one visible pill while flying. Event
 * notifications are lower-priority flavour text that can arrive at any
 * moment on top of that feedback — this queue renders them in their own
 * lane so the two never fight for the same pixels, keeps at most two
 * visible at once in arrival order, and auto-dismisses each one after a
 * fixed hold time so they never pile up or linger indefinitely.
 */

export type NotificationKind = "event" | "gold" | "warn" | "info";

interface PendingNotification {
  text: string;
  kind: NotificationKind;
}

interface LiveNotification {
  el: HTMLElement;
  timer: number;
}

/** At most this many notifications render at once; the rest wait their turn. */
const MAX_VISIBLE = 2;
import { messageHoldMs } from "./MessageTiming";

/** How long a notification stays fully visible before it starts to exit.
 *
 *  Was a flat 3000 ms sitting next to HUD's `1200 + 28 ms/char` — two layers,
 *  two answers to the same question. One formula now, shared, and it is applied
 *  to the text this queue actually holds rather than to an empty string.
 *
 *  The empty-string call that briefly replaced it was a real regression: a
 *  zero-word notification took the FLOOR (1100 ms), so this layer went from a
 *  3 s read to a 1.1 s glance and its test caught it. Derive per notification
 *  instead, which is what the shared model is for. */
const holdFor = (text: string): number => messageHoldMs(text);
/** Fade/slide-out duration, kept in sync with the CSS transition below. */
const EXIT_MS = 240;

export class NotificationQueue {
  private readonly pending: PendingNotification[] = [];
  private readonly live: LiveNotification[] = [];
  private disposed = false;

  constructor(private readonly container: HTMLElement) {}

  /** Enqueue an event notification; it renders immediately if a slot is free. */
  push(text: string, kind: NotificationKind = "event"): void {
    if (this.disposed) return;
    this.pending.push({ text, kind });
    this.drain();
  }

  /** How many notifications are currently on screen (for tests/diagnostics). */
  get visibleCount(): number {
    return this.live.length;
  }

  /** How many notifications are waiting for a free slot. */
  get pendingCount(): number {
    return this.pending.length;
  }

  private drain(): void {
    while (this.live.length < MAX_VISIBLE && this.pending.length > 0) {
      const next = this.pending.shift()!;
      this.show(next);
    }
  }

  private show(n: PendingNotification): void {
    const el = document.createElement("div");
    el.className = `hud-notification ${n.kind}`;
    el.textContent = n.text;
    this.container.appendChild(el);
    requestAnimationFrame(() => el.classList.add("in"));
    const timer = window.setTimeout(() => this.dismiss(el), holdFor(n.text));
    this.live.push({ el, timer });
  }

  private dismiss(el: HTMLElement): void {
    const idx = this.live.findIndex((v) => v.el === el);
    if (idx === -1) return;
    const entry = this.live[idx]!;
    window.clearTimeout(entry.timer);
    el.classList.remove("in");
    el.classList.add("out");
    // The entry deliberately STAYS in `live` until the element is really out of
    // the DOM. Releasing the slot here instead would let the next queued
    // notification render while this one is still fading, so three could be on
    // screen at once — the one thing MAX_VISIBLE exists to prevent. Being
    // briefly one deep for 240ms is the correct trade against that.
    entry.timer = window.setTimeout(() => {
      el.remove();
      const i = this.live.findIndex((v) => v.el === el);
      if (i !== -1) this.live.splice(i, 1);
      if (!this.disposed) this.drain();
    }, EXIT_MS);
  }

  /** Clears every pending and live notification, and cancels their timers. */
  dispose(): void {
    // `disposed` also covers the EXIT timers created in `dismiss`, which are
    // stored on the entry and so ARE cancelled above — but a queue that had a
    // notification mid-fade when dispose ran must not be resurrected by a later
    // push either, which the flag makes explicit.
    this.disposed = true;
    for (const v of this.live) window.clearTimeout(v.timer);
    for (const v of this.live) v.el.remove();
    this.live.length = 0;
    this.pending.length = 0;
  }
}
