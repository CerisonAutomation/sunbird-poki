/**
 * Main-thread watchdog — turns "the game feels stuck" into a *measured event*.
 *
 * Players experience a frozen frame as a crash even when the process is
 * healthy. Until now a 12-second decode stall, a pathological GC or a blocked
 * synchronous storage write was invisible: no log, no telemetry, no way to
 * tell one angry review from another. The watchdog closes that observability
 * hole without changing any behavior:
 *
 *   - a requestAnimationFrame heartbeat marks the main loop alive;
 *   - a 1 s interval checks the heartbeat only while the tab is VISIBLE and
 *     the watchdog is not suspended (rAF does not fire in background tabs —
 *     naively checking would report every tab-switch as a stall);
 *   - a stalled frame window is classified into a bucket (1–2 s, 2–5 s, 5 s+)
 *     by a pure function, emitted once per stall episode, and fed to the
 *     caller's sink (telemetry + crash breadcrumbs).
 *
 * `longtask` PerformanceObserver, where supported (Chromium), refines the
 * report with the worst individual task duration — same event, more evidence.
 */

export type StallBucket = "1s" | "2s" | "5s" | "10s";

/** Pure classifier — exported for tests. */
export function stallBucket(stallMs: number): StallBucket {
  if (stallMs >= 10_000) return "10s";
  if (stallMs >= 5_000) return "5s";
  if (stallMs >= 2_000) return "2s";
  return "1s";
}

/** Structural timer types — `typeof setInterval` is ambiguous with Node's
 * types on (Node returns Timeout, the DOM lib returns number). */
export type SetIntervalLike = (fn: () => void, ms: number) => unknown;
export type ClearIntervalLike = (id: unknown) => void;

export interface WatchdogOptions {
  /** No heartbeat for this long (while visible) counts as a stall. Default 2 s. */
  stallMs?: number;
  /** Called ONCE per stall episode with the detected duration so far. */
  onStall?: (stallMs: number, bucket: StallBucket, worstTaskMs: number) => void;
  /** Test seams. null rAF means auto-detect (null in true headless envs). */
  now?: () => number;
  raf?: RafLike | null;
  setInterval?: SetIntervalLike;
  clearInterval?: ClearIntervalLike;
  document?: { visibilityState: string } | null;
  observeLongTasks?: ((cb: (worstMs: number) => void) => () => void) | null;
}

interface RafLike {
  (cb: (t: number) => void): number;
}

function defaultRaf(): RafLike | null {
  if (typeof requestAnimationFrame === "function") return (cb) => requestAnimationFrame(cb);
  return null;
}

export class Watchdog {
  private lastTick = 0;
  private rafId = 0;
  private intervalId: unknown = null;
  private inStall = false;
  private worstTaskMs = 0;
  private stopLongTasks: (() => void) | null = null;
  private suspended = false;
  private readonly stallMs: number;
  private readonly onStall: WatchdogOptions["onStall"];
  private readonly now: () => number;
  private readonly raf: RafLike | null;
  private readonly setIntervalImpl: SetIntervalLike;
  private readonly clearIntervalImpl: ClearIntervalLike;
  private readonly doc: WatchdogOptions["document"];
  private running = false;

  constructor(opts: WatchdogOptions = {}) {
    this.stallMs = opts.stallMs ?? 2_000;
    this.onStall = opts.onStall;
    this.now = opts.now ?? Date.now;
    this.raf = opts.raf ?? defaultRaf();
    this.setIntervalImpl = opts.setInterval ?? ((fn, ms) => setInterval(fn, ms));
    this.clearIntervalImpl = opts.clearInterval ?? ((id) => clearInterval(id as Parameters<typeof clearInterval>[0]));
    this.doc = opts.document ?? (typeof document !== "undefined" ? { visibilityState: document.visibilityState } : null);
    this.observeLongTasks =
      opts.observeLongTasks ??
      (typeof PerformanceObserver === "function"
        ? (cb) => {
            let worst = 0;
            try {
              const po = new PerformanceObserver((list) => {
                for (const item of list.getEntries()) {
                  if (item.duration > worst) worst = item.duration;
                }
                cb(worst);
              });
              po.observe({ entryTypes: ["longtask"] });
              return () => {
                try {
                  po.disconnect();
                } catch {
                  /* already disconnected */
                }
              };
            } catch {
              return () => undefined; // entry type unsupported (Safari/Firefox)
            }
          }
        : null);
  }

  private observeLongTasks: ((cb: (worstMs: number) => void) => () => void) | null;

  start(): void {
    if (this.running || !this.raf) return;
    this.running = true;
    this.lastTick = this.now();
    this.inStall = false;

    const tick = (): void => {
      if (!this.running) return;
      this.lastTick = this.now();
      this.rafId = this.raf!(tick);
    };
    this.rafId = this.raf(tick);

    if (this.observeLongTasks) {
      this.stopLongTasks = this.observeLongTasks((worstMs) => {
        this.worstTaskMs = worstMs;
      });
    }

    this.intervalId = this.setIntervalImpl(() => this.check(), 1_000);
  }

  private check(): void {
    if (!this.running || this.suspended) return;
    // Suspended conditions: hidden tab (no rAF fires), or the game told us it
    // is deliberately not rendering (context loss, ad break).
    if (this.doc && this.doc.visibilityState !== "visible") {
      this.lastTick = this.now(); // don't accumulate a phantom stall
      this.inStall = false;
      return;
    }
    const stalled = this.now() - this.lastTick;
    if (stalled >= this.stallMs) {
      if (!this.inStall) {
        this.inStall = true;
        this.onStall?.(stalled, stallBucket(stalled), Math.round(this.worstTaskMs));
      }
    } else if (this.inStall && stalled < this.stallMs) {
      this.inStall = false; // recovered — a new stall can be reported fresh
    }
  }

  /** Game-driven suspension (ad breaks, context loss): no stall reports until
   * resumed. A latched flag, not a timestamp reset — time keeps flowing past
   * a deliberate pause, and must not be misread as a stall when it does. */
  suspend(): void {
    this.suspended = true;
    this.inStall = false;
    this.lastTick = this.now();
  }

  /** Undo suspend() and re-arm from now. */
  resume(): void {
    this.suspended = false;
    this.inStall = false;
    this.lastTick = this.now();
  }

  stop(): void {
    this.running = false;
    if (this.intervalId !== null) {
      this.clearIntervalImpl(this.intervalId);
      this.intervalId = null;
    }
    if (this.rafId) {
      // cancelAnimationFrame may not exist in tests; the running flag already
      // stops the callback chain, this is just hygiene in the browser.
      try {
        cancelAnimationFrame(this.rafId);
      } catch {
        /* non-browser */
      }
      this.rafId = 0;
    }
    if (this.stopLongTasks) {
      this.stopLongTasks();
      this.stopLongTasks = null;
    }
    this.worstTaskMs = 0;
  }
}
