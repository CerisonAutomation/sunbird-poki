import { afterEach, describe, expect, it, vi } from "vitest";
import type * as GuardModule from "./rejection-guard";

/**
 * The guard's job in one sentence: when the engine reports a floating
 * promise rejection (`unhandledrejection` on window), it must demote it to a
 * rate-limited console.debug note (verbose logs only) instead of the red
 * "Uncaught (in promise)" error frame — portal QA treats console errors as
 * defects, and the production gate bans console.warn/log in shipped code,
 * while the game's network paths are best-effort by design.
 *
 * jsdom has no rendering engine to dispatch the event from a real rejection,
 * so the tests dispatch the exact event the browser would. Each test imports
 * a FRESH module instance (install flag + rate-limit clock are module state)
 * and uninstalls in `afterEach` so listeners never accumulate on the shared
 * jsdom window.
 */

const SINK = () => {};

let guard: typeof GuardModule | null = null;

async function freshGuard(): Promise<typeof GuardModule> {
  vi.resetModules();
  const mod = await import("./rejection-guard");
  mod.installRejectionGuard();
  guard = mod;
  return mod;
}

function rejectionEvent(reason: unknown): PromiseRejectionEvent {
  // A plain Event is a faithful stand-in: the guard only reads `reason` and
  // calls `preventDefault()`, both of which this provides.
  const event = new Event("unhandledrejection", { cancelable: true }) as PromiseRejectionEvent;
  Object.defineProperty(event, "reason", { value: reason });
  return event;
}

afterEach(() => {
  guard?.uninstallRejectionGuard();
  guard = null;
  vi.restoreAllMocks();
});

describe("installRejectionGuard", () => {
  it("demotes an unhandled rejection to a debug note (no error frame)", async () => {
    await freshGuard();
    const debug = vi.spyOn(console, "debug").mockImplementation(SINK);
    const warn = vi.spyOn(console, "warn").mockImplementation(SINK);
    const error = vi.spyOn(console, "error").mockImplementation(SINK);

    const event = rejectionEvent(new Error("boom: network fell over"));
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true); // browser error frame suppressed
    expect(debug).toHaveBeenCalled();
    expect(debug.mock.calls.map((c) => c.join(" ")).join(" ")).toContain("boom: network fell over");
    // Shipped code must stay warn/log-free (production gate) and error-free (Poki QA).
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("is idempotent — two installs add exactly one listener", async () => {
    vi.resetModules();
    const mod = await import("./rejection-guard");
    const addSpy = vi.spyOn(window, "addEventListener");
    mod.installRejectionGuard();
    mod.installRejectionGuard();
    expect(addSpy.mock.calls.filter((c) => c[0] === "unhandledrejection").length).toBe(1);
    guard = mod; // let afterEach uninstall
  });

  it("rate-limits the note — a burst of rejections logs once per window", async () => {
    await freshGuard();
    const debug = vi.spyOn(console, "debug").mockImplementation(SINK);
    for (let i = 0; i < 5; i++) window.dispatchEvent(rejectionEvent(new Error(`burst-${i}`)));
    const notes = debug.mock.calls.map((c) => String(c[0]));
    // Five rejections, one note: the rest are rate-limited.
    expect(notes.length).toBe(1);
    expect(notes[0]).toContain("burst-0");
  });

  it("uninstall stops demoting (restores default behaviour)", async () => {
    await freshGuard();
    const debug = vi.spyOn(console, "debug").mockImplementation(SINK);
    guard?.uninstallRejectionGuard();
    const event = rejectionEvent(new Error("post-uninstall"));
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(debug).not.toHaveBeenCalled();
  });
});
