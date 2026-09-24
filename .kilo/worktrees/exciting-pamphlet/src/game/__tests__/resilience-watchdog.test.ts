import { describe, expect, it, vi } from "vitest";
import { stallBucket, Watchdog, type StallBucket } from "../resilience/Watchdog";

describe("stallBucket", () => {
  it("classifies thresholds", () => {
    expect(stallBucket(999)).toBe("1s");
    expect(stallBucket(2_000)).toBe("2s");
    expect(stallBucket(5_000)).toBe("5s");
    expect(stallBucket(30_000)).toBe("10s");
  });
});

/** Deterministic rAF/interval harness. */
function harness() {
  const rafCbs: Array<(t: number) => void> = [];
  const intervals: Array<{ fn: () => void; ms: number }> = [];
  let t = 0;
  const raf = (cb: (t: number) => void): number => {
    rafCbs.push(cb);
    return rafCbs.length;
  };
  const setIntervalImpl = ((fn: () => void, ms: number) => {
    intervals.push({ fn, ms });
    return intervals.length as unknown as ReturnType<typeof setInterval>;
  }) as typeof setInterval;
  const clearIntervalImpl = () => undefined;
  const beat = (): void => {
    t += 16;
    for (const cb of [...rafCbs]) cb(t);
  };
  const everyInterval = (): void => {
    for (const i of intervals) i.fn();
  };
  return { raf, setIntervalImpl, clearIntervalImpl, beat, everyInterval, now: () => t, advance: (ms: number) => (t += ms) };
}

type OnStall = (stallMs: number, bucket: StallBucket, worstTaskMs: number) => void;

function makeWatchdog(h: ReturnType<typeof harness>, onStall: OnStall): Watchdog {
  return new Watchdog({
    stallMs: 2_000,
    onStall,
    now: h.now,
    raf: h.raf,
    setInterval: h.setIntervalImpl,
    clearInterval: h.clearIntervalImpl,
    document: { visibilityState: "visible" },
    observeLongTasks: null,
  });
}

describe("Watchdog", () => {
  it("reports one stall episode when the heartbeat stops", () => {
    const h = harness();
    const onStall = vi.fn((_ms: number, _bucket: StallBucket, _worst: number) => undefined);
    const wd = makeWatchdog(h, onStall);
    wd.start();
    h.beat();
    h.beat();
    h.advance(3_000); // heartbeat froze here
    h.everyInterval();
    expect(onStall).toHaveBeenCalledTimes(1);
    expect(onStall.mock.calls[0]?.[0]).toBeGreaterThanOrEqual(2_000);
    expect(onStall.mock.calls[0]?.[1]).toBe("2s");
  });

  it("does NOT re-report during the same stall episode", () => {
    const h = harness();
    const onStall = vi.fn((_ms: number, _bucket: StallBucket, _worst: number) => undefined);
    const wd = makeWatchdog(h, onStall);
    wd.start();
    h.beat();
    h.advance(3_000);
    h.everyInterval();
    h.advance(1_000);
    h.everyInterval();
    h.advance(1_000);
    h.everyInterval();
    expect(onStall).toHaveBeenCalledTimes(1);
  });

  it("a recovered heartbeat re-arms stall reporting", () => {
    const h = harness();
    const onStall = vi.fn((_ms: number, _bucket: StallBucket, _worst: number) => undefined);
    const wd = makeWatchdog(h, onStall);
    wd.start();
    h.beat();
    h.advance(3_000);
    h.everyInterval(); // stall #1
    h.beat(); // recovers
    h.everyInterval();
    h.advance(3_000);
    h.everyInterval(); // stall #2
    expect(onStall).toHaveBeenCalledTimes(2);
  });

  it("ignores stalls while the tab is hidden (rAF truthfully stops)", () => {
    const h = harness();
    let visibility = "visible";
    const onStall = vi.fn((_ms: number, _bucket: StallBucket, _worst: number) => undefined);
    const wd = new Watchdog({
      stallMs: 2_000,
      onStall,
      now: h.now,
      raf: h.raf,
      setInterval: h.setIntervalImpl,
      clearInterval: h.clearIntervalImpl,
      document: { get visibilityState() { return visibility; } },
      observeLongTasks: null,
    });
    wd.start();
    h.beat();
    visibility = "hidden";
    h.advance(60_000);
    h.everyInterval();
    expect(onStall).not.toHaveBeenCalled();
    // Coming back to visibility resets cleanly — no phantom stall.
    visibility = "visible";
    h.everyInterval();
    h.beat();
    expect(onStall).not.toHaveBeenCalled();
  });

  it("suspend() suppresses reports (ad breaks, context loss)", () => {
    const h = harness();
    const onStall = vi.fn((_ms: number, _bucket: StallBucket, _worst: number) => undefined);
    const wd = makeWatchdog(h, onStall);
    wd.start();
    h.beat();
    wd.suspend();
    h.advance(10_000);
    h.everyInterval();
    expect(onStall).not.toHaveBeenCalled();
  });

  it("stop() halts everything", () => {
    const h = harness();
    const onStall = vi.fn((_ms: number, _bucket: StallBucket, _worst: number) => undefined);
    const wd = makeWatchdog(h, onStall);
    wd.start();
    h.beat();
    wd.stop();
    h.advance(30_000);
    h.everyInterval();
    h.beat(); // late rAF callback must be a no-op too
    expect(onStall).not.toHaveBeenCalled();
  });

  it("start() without rAF (headless) is a safe no-op", () => {
    const wd = new Watchdog({ raf: null, observeLongTasks: null });
    expect(() => wd.start()).not.toThrow();
    wd.stop();
  });

  it("forwards the worst observed long task", () => {
    const h = harness();
    const onStall = vi.fn((_ms: number, _bucket: StallBucket, _worst: number) => undefined);
    let longTaskCb: ((worstMs: number) => void) | null = null;
    const wd = new Watchdog({
      stallMs: 2_000,
      onStall,
      now: h.now,
      raf: h.raf,
      setInterval: h.setIntervalImpl,
      clearInterval: h.clearIntervalImpl,
      document: { visibilityState: "visible" },
      observeLongTasks: (cb) => {
        longTaskCb = cb;
        return () => (longTaskCb = null);
      },
    });
    wd.start();
    const ltCb = longTaskCb as ((worstMs: number) => void) | null;
    ltCb?.(450);
    h.beat();
    h.advance(3_000);
    h.everyInterval();
    expect(onStall.mock.calls[0]?.[2]).toBe(450);
  });
});
