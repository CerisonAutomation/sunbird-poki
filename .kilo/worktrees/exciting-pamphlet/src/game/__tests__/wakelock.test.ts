import { afterEach, describe, expect, it, vi } from "vitest";
import { ScreenWakeLock, createWakeLock, supportsWakeLock, type WakeLockHost, type WakeLockSentinelLike } from "../WakeLock";

/**
 * Poki DEV-14: WakeLock is one of the essential APIs the Player Device Report
 * tracks, and a dimmed phone screen mid-run is the most common non-bug mobile
 * drop-off. These tests pin the two contracts that matter: it is held exactly
 * while the player is flying, and it is a silent no-op where unsupported.
 */
type Sentinel = WakeLockSentinelLike & { release: ReturnType<typeof vi.fn> };
type RequestMock = ReturnType<typeof vi.fn<(type: "screen") => Promise<WakeLockSentinelLike>>>;
type FakeHost = { wakeLock: { request: RequestMock } };

const sentinels: Sentinel[] = [];

function fakeHost(): FakeHost {
  const request = vi.fn<(type: "screen") => Promise<WakeLockSentinelLike>>(() => {
    const sentinel = {
      released: false,
      release: vi.fn(() => {
        sentinel.released = true;
        return Promise.resolve();
      }),
    } as Sentinel;
    sentinels.push(sentinel);
    return Promise.resolve(sentinel as WakeLockSentinelLike);
  });
  return { wakeLock: { request } };
}

function visibilityTarget(state = "visible") {
  const listeners = new Set<() => void>();
  return {
    target: {
      visibilityState: state,
      addEventListener: (type: string, cb: () => void) => {
        if (type === "visibilitychange") listeners.add(cb);
      },
      removeEventListener: (_type: string, cb: () => void) => listeners.delete(cb),
    },
    fire: () => listeners.forEach((cb) => cb()),
    count: () => listeners.size,
  };
}

afterEach(() => {
  sentinels.length = 0;
  vi.restoreAllMocks();
});

describe("screen wake lock (DEV-14)", () => {
  it("is a silent no-op where the API is missing", () => {
    const lock = new ScreenWakeLock({}, visibilityTarget().target);
    expect(lock.supported).toBe(false);
    expect(() => lock.acquire()).not.toThrow();
    expect(lock.held).toBe(false);
    expect(supportsWakeLock({})).toBe(false);
  });

  it("acquires once, releases once, and never double-requests", async () => {
    const host: FakeHost = fakeHost();
    const lock = new ScreenWakeLock(host, visibilityTarget().target);
    expect(lock.supported).toBe(true);
    lock.acquire();
    lock.acquire();
    lock.acquire();
    await Promise.resolve();
    expect(host.wakeLock.request).toHaveBeenCalledTimes(1);
    expect(lock.held).toBe(true);
    lock.release();
    expect(lock.held).toBe(false);
    expect(sentinels[0].release).toHaveBeenCalled();
  });

  it("re-acquires after the platform drops the lock on a hidden page", async () => {
    const host: FakeHost = fakeHost();
    const vis = visibilityTarget();
    const lock = new ScreenWakeLock(host, vis.target);
    lock.acquire();
    await Promise.resolve();
    expect(host.wakeLock.request).toHaveBeenCalledTimes(1);
    // The browser releases the sentinel when the tab hides, then tells us the
    // page is visible again on the way back — that is when the run must take
    // its lock a second time.
    sentinels[0].released = true;
    vis.fire();
    await Promise.resolve();
    expect(host.wakeLock.request).toHaveBeenCalledTimes(2);
    expect(lock.held).toBe(true);
    // A lock that is already held is not requested again.
    vis.fire();
    await Promise.resolve();
    expect(host.wakeLock.request).toHaveBeenCalledTimes(2);
  });

  it("drops the lock when gameplay ends and honours the setting gate", async () => {
    const host: FakeHost = fakeHost();
    const vis = visibilityTarget();
    const lock = new ScreenWakeLock(host, vis.target);
    lock.acquire();
    await Promise.resolve();
    lock.release();
    sentinels[0].released = true;
    vis.fire();
    await Promise.resolve();
    // A released lock must not come back just because the page became visible.
    expect(host.wakeLock.request).toHaveBeenCalledTimes(1);

    lock.setEnabled(false);
    lock.acquire();
    await Promise.resolve();
    expect(host.wakeLock.request).toHaveBeenCalledTimes(1);
    lock.setEnabled(true);
    lock.acquire();
    await Promise.resolve();
    expect(host.wakeLock.request).toHaveBeenCalledTimes(2);
  });

  it("swallows a rejected request — a battery saver must not spam the console", async () => {
    const onError = vi.fn();
    const host: WakeLockHost = {
      wakeLock: { request: vi.fn(() => Promise.reject(new Error("NotAllowedError"))) },
    };
    const lock = new ScreenWakeLock(host, visibilityTarget().target, onError);
    expect(() => lock.acquire()).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    expect(lock.held).toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("releases a lock that arrives after gameplay already ended", async () => {
    const pending: { resolve: ((sentinel: WakeLockSentinelLike) => void) | null } = { resolve: null };
    const host: WakeLockHost = {
      wakeLock: {
        request: () =>
          new Promise<WakeLockSentinelLike>((resolve) => {
            pending.resolve = resolve;
          }),
      },
    };
    const lock = new ScreenWakeLock(host, visibilityTarget().target);
    lock.acquire();
    lock.release();
    const sentinel = { released: false, release: vi.fn(() => Promise.resolve()) };
    pending.resolve?.(sentinel);
    await Promise.resolve();
    await Promise.resolve();
    expect(sentinel.release).toHaveBeenCalled();
    expect(lock.held).toBe(false);
  });

  it("stops listening after dispose", async () => {
    const host: FakeHost = fakeHost();
    const vis = visibilityTarget();
    const lock = createWakeLock(host, vis.target);
    lock.acquire();
    await Promise.resolve();
    lock.dispose();
    expect(vis.count()).toBe(0);
    vis.fire();
    await Promise.resolve();
    expect(host.wakeLock.request).toHaveBeenCalledTimes(1);
  });
});
