/**
 * Boot progress + progressive loading — Poki rules EA-04 and EA-05.
 *
 * EA-04: "loading screens should be visually engaging and include a progress
 * bar to prevent players from assuming the game is broken".
 * EA-05: "progressive loading … downloads only essential initial assets first,
 * while remaining files load in the background to minimise drop-off rates".
 *
 * Both rules sound like asset-pipeline advice, but they apply to a
 * zero-asset game too — here the "assets" are JavaScript modules and the work
 * done in the constructor. So this module does two things:
 *
 *   1. **Real progress.** Named stages are marked as the game actually reaches
 *      them (shell → engine chunk → renderer → world → HUD → first flyable
 *      frame). The inline boot bar is driven from those marks, so the bar can
 *      never lie: it is a measurement, not a timer. This is also what makes the
 *      screen honest on a slow connection — the bar stalls where the work
 *      stalls, which is the information a waiting player needs.
 *   2. **Deferred work.** Anything that is *not* needed for the first
 *      interactive frame (music bus warm-up, leaderboard prefetch, particle
 *      pool growth, sky variants) is queued through `defer()` and run on
 *      `requestIdleCallback`, with a timeout fallback for browsers without it.
 *      The player can press Fly before any of it finishes.
 *
 * Everything degrades to a no-op outside a browser (unit tests, SSR), and every
 * DOM write is guarded.
 */

export type BootStageId = "shell" | "chunk" | "engine" | "world" | "hud" | "flight" | "ready";

export type BootStage = {
  id: BootStageId;
  /** Relative cost of the stage. Weights only have to be roughly right. */
  weight: number;
  /** Player-facing copy for the loading screen (kept short, English source). */
  label: string;
};

/**
 * Stage plan. Weights reflect measured cold-start cost on a mid-range phone:
 * the code chunk dominates, world generation (terrain + sky + biome palettes)
 * is second, everything after the first frame is free.
 */
export const BOOT_STAGES: BootStage[] = [
  // The shell's own label matches the inline copy in index.html so the first
  // reported stage never rewrites the text the player is already reading.
  { id: "shell", weight: 2, label: "Warming up the wings…" },
  { id: "chunk", weight: 6, label: "Downloading flight systems…" },
  { id: "engine", weight: 3, label: "Starting the engine…" },
  { id: "world", weight: 5, label: "Painting the islands…" },
  { id: "hud", weight: 2, label: "Warming up the wings…" },
  { id: "flight", weight: 3, label: "Almost ready…" },
  { id: "ready", weight: 1, label: "Ready to fly" },
];

const TOTAL_WEIGHT = BOOT_STAGES.reduce((sum, stage) => sum + stage.weight, 0);

export type BootState = {
  /** Completed stage ids, in the order they were marked. */
  completed: BootStageId[];
  /** 0..1, weighted. */
  progress: number;
  /** Most recently started stage, or null before the first mark. */
  current: BootStageId | null;
  /** True once the "ready" mark has fired. */
  ready: boolean;
  /** Copy for the loading screen. */
  label: string;
};

const listeners = new Set<(state: BootState) => void>();
const completed = new Set<BootStageId>();
let order: BootStageId[] = [];
let ready = false;

function computedProgress(): number {
  let done = 0;
  for (const stage of BOOT_STAGES) if (completed.has(stage.id)) done += stage.weight;
  return Math.max(0, Math.min(1, done / TOTAL_WEIGHT));
}

function labelFor(): string {
  for (let i = BOOT_STAGES.length - 1; i >= 0; i -= 1) {
    const stage = BOOT_STAGES[i];
    if (completed.has(stage.id)) return stage.label;
  }
  return BOOT_STAGES[0].label;
}

export function bootState(): BootState {
  const current = order.length ? order[order.length - 1] : null;
  return { completed: [...order], progress: computedProgress(), current, ready, label: labelFor() };
}

/** Test/teardown hook: forget every mark so a fresh boot starts at zero. */
export function resetBootProgress(): void {
  completed.clear();
  order = [];
  ready = false;
  listeners.clear();
  pending.length = 0;
}

export function onBootProgress(listener: (state: BootState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* --------------------------------------------------------------- DOM bridge */

function updateBootShell(state: BootState): void {
  if (typeof document === "undefined") return;
  try {
    const copy = document.getElementById("boot-copy");
    if (copy && !copy.closest(".boot.is-error")) copy.textContent = state.label;

    const bar = document.getElementById("boot-bar");
    const fill = document.getElementById("boot-bar-fill");
    if (bar && fill) {
      // Switch the CSS indeterminate slide to a real width. The class change is
      // what stops the animation — a determinate bar must not also be sliding.
      bar.classList.add("is-determinate");
      const pct = Math.round(state.progress * 100);
      fill.style.width = `${pct}%`;
      bar.setAttribute("aria-valuenow", String(pct));
    }
  } catch {
    /* the shell is decoration: never let it break the boot */
  }
}

/**
 * Mark a boot stage complete. Idempotent — a stage reached twice (React
 * StrictMode remount, a retry) reports once, so the bar can never jump
 * backwards or overshoot.
 */
export function bootStage(id: BootStageId): BootState {
  if (id === "ready") {
    // "Ready" is terminal: reaching it means every earlier stage happened, even
    // if a code path skipped a mark (a future refactor, a retry after a
    // transient failure). The bar lands on 100 % rather than stalling at
    // whatever the last explicit mark happened to be.
    for (const stage of BOOT_STAGES) {
      if (!completed.has(stage.id)) {
        completed.add(stage.id);
        order = [...order, stage.id];
      }
      if (stage.id === "ready") break;
    }
    ready = true;
  } else if (!completed.has(id)) {
    completed.add(id);
    order = [...order, id];
  }
  const state = bootState();
  updateBootShell(state);
  for (const listener of listeners) {
    try {
      listener(state);
    } catch {
      /* a listener must not break the boot sequence */
    }
  }
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    try {
      window.dispatchEvent(new CustomEvent("sunbird-boot", { detail: state }));
    } catch {
      /* no CustomEvent (very old embedded webview): progress is still internal */
    }
  }
  return state;
}

/* ----------------------------------------------------------- deferred work */

type PendingTask = { id: string; work: () => void | Promise<void>; timeout?: number };

const pending: PendingTask[] = [];
let flushing = false;

type IdleGlobal = {
  requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
  setTimeout?: (cb: () => void, ms: number) => number;
};

function scheduleIdle(run: () => void, timeout: number): void {
  const g = (typeof globalThis === "undefined" ? {} : globalThis) as IdleGlobal;
  try {
    if (typeof g.requestIdleCallback === "function") {
      g.requestIdleCallback(run, { timeout });
      return;
    }
    if (typeof g.setTimeout === "function") g.setTimeout(run, 120);
  } catch {
    /* no scheduler: the work simply never runs, which is safe for non-essentials */
  }
}

function flush(): void {
  if (flushing) return;
  flushing = true;
  const task = pending.shift();
  if (!task) {
    flushing = false;
    return;
  }
  const run = (): void => {
    try {
      void task.work();
    } catch {
      /* deferred work is best-effort by definition */
    }
    flushing = false;
    // Yield between tasks so a long warm-up list can never monopolise a frame.
    if (pending.length) scheduleIdle(flush, pending[0].timeout ?? 2500);
  };
  scheduleIdle(run, task.timeout ?? 2500);
}

/**
 * Queue work that must not delay the first interactive frame. Tasks run in
 * submission order during idle time (or 120 ms later where
 * `requestIdleCallback` is missing), which is what makes EA-05 true rather
 * than aspirational.
 */
export function defer(id: string, work: () => void | Promise<void>, timeout = 2500): void {
  pending.push({ id, work, timeout });
  flush();
}

/** Test hook: number of queued deferred tasks. */
export function deferredCount(): number {
  return pending.length;
}
