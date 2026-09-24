import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BOOT_STAGES,
  bootStage,
  bootState,
  defer,
  deferredCount,
  onBootProgress,
  resetBootProgress,
} from "../BootProgress";

/**
 * Poki easy-access rules EA-04 (a progress bar that is real) and EA-05
 * (progressive loading: essential work first, the rest in the background).
 */
function bootShell(): void {
  document.body.innerHTML = `
    <div class="boot" id="boot">
      <div class="boot-copy" id="boot-copy">Warming up the wings…</div>
      <div class="boot-bar" id="boot-bar" role="progressbar"><i id="boot-bar-fill"></i></div>
    </div>`;
}

afterEach(() => {
  resetBootProgress();
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("boot progress (EA-04)", () => {
  it("reports weighted progress that only ever moves forward", () => {
    expect(bootState().progress).toBe(0);
    const afterShell = bootStage("shell");
    const afterChunk = bootStage("chunk");
    const afterReady = bootStage("ready");
    expect(afterShell.progress).toBeGreaterThan(0);
    expect(afterChunk.progress).toBeGreaterThan(afterShell.progress);
    expect(afterReady.progress).toBe(1);
    expect(afterReady.ready).toBe(true);
    // Reaching "ready" closes out every stage in the plan, in plan order — a
    // skipped mark can never leave the bar short of 100 %.
    expect(afterReady.completed).toEqual(BOOT_STAGES.map((s) => s.id));
  });

  it("is idempotent so a remount cannot inflate the bar", () => {
    bootStage("engine");
    const first = bootState().progress;
    bootStage("engine");
    bootStage("engine");
    expect(bootState().progress).toBe(first);
    expect(bootState().completed.filter((s) => s === "engine")).toHaveLength(1);
  });

  it("drives the inline loading bar with a real width, never a fake timer", () => {
    bootShell();
    const bar = document.getElementById("boot-bar")!;
    const fill = document.getElementById("boot-bar-fill")!;
    bootStage("shell");
    expect(bar.classList.contains("is-determinate")).toBe(true);
    bootStage("chunk");
    expect(fill.style.width).toBe(`${Math.round(bootState().progress * 100)}%`);
    expect(bar.getAttribute("aria-valuenow")).toBe(String(Math.round(bootState().progress * 100)));
    bootStage("ready");
    expect(fill.style.width).toBe("100%");
  });

  it("exposes a stage label for the loading screen and announces progress", () => {
    const seen: number[] = [];
    const off = onBootProgress((state) => seen.push(state.progress));
    const events: CustomEvent[] = [];
    const listener = (event: Event) => events.push(event as CustomEvent);
    window.addEventListener("sunbird-boot", listener);
    bootStage("chunk");
    window.removeEventListener("sunbird-boot", listener);
    off();
    expect(seen).toEqual([bootState().progress]);
    expect(events).toHaveLength(1);
    expect((events[0].detail as { label: string }).label).toBe("Downloading flight systems…");
  });

  it("keeps a no-op path when the boot shell is absent (tests, SSR, retries)", () => {
    document.body.innerHTML = "";
    expect(() => bootStage("world")).not.toThrow();
    expect(bootState().completed).toEqual(["world"]);
  });

  it("weights every stage so no stage can claim more than its share", () => {
    expect(BOOT_STAGES.every((s) => s.weight > 0 && s.label.length > 0)).toBe(true);
    expect(new Set(BOOT_STAGES.map((s) => s.id)).size).toBe(BOOT_STAGES.length);
  });
});

describe("deferred background work (EA-05)", () => {
  it("runs non-essential work off the critical path", async () => {
    vi.useFakeTimers();
    const ran: string[] = [];
    defer("board", () => {
      ran.push("board");
    });
    // Nothing runs synchronously: the first frame is not waiting on it.
    expect(ran).toEqual([]);
    await vi.runAllTimersAsync();
    expect(ran).toEqual(["board"]);
    expect(deferredCount()).toBe(0);
  });

  it("keeps order and survives a task that throws", async () => {
    vi.useFakeTimers();
    const ran: string[] = [];
    defer("a", () => {
      throw new Error("warm-up failure must not break the boot");
    });
    defer("b", () => {
      ran.push("b");
    });
    await vi.runAllTimersAsync();
    expect(ran).toEqual(["b"]);
  });

  it("uses requestIdleCallback when the browser provides it", async () => {
    const idle = vi.fn((cb: () => void) => {
      cb();
      return 1;
    });
    vi.stubGlobal("requestIdleCallback", idle);
    const ran: string[] = [];
    defer("music", () => {
      ran.push("music");
    });
    expect(idle).toHaveBeenCalled();
    await Promise.resolve();
    expect(ran).toEqual(["music"]);
    vi.unstubAllGlobals();
  });
});
