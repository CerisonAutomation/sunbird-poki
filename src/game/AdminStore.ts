/**
 * Live tuning store for the dev panel.
 *
 * Nothing here is game state. A knob is a number, a range, and a closure that
 * writes the matching module binding — which is why moving a slider is visible
 * in the running simulation rather than only in the panel that drew it. The
 * write path funnels through `applyLiveTune` / `applyReleaseTune`, the two
 * single-writer surfaces those modules expose, because an ES module binding
 * cannot be reassigned from anywhere else.
 *
 * DEV-ONLY BY CONSTRUCTION, NOT BY CONVENTION. The panel that renders this
 * store is behind `import.meta.env.DEV` at the entry point, so a production
 * bundle never reaches this module. The store itself carries no gate: gating it
 * here would mean a second, weaker place to forget.
 */
import { LIVE_TUNE_DEFAULTS, applyLiveTune, type LiveTunable } from "./constants";
import { RELEASE_TUNE_DEFAULTS, applyReleaseTune, type ReleaseTunable } from "./FlightPhysics";
import { resetIslandLayout } from "./Biomes";

/** Which part of the flight a knob belongs to, in panel order. */
export type KnobGroup = "Flight" | "Ground" | "Release" | "Scoring" | "World" | "Camera";

/**
 * When a changed value becomes visible. Stated per knob because the honest
 * answer differs and a panel that claims "live" for a run-start constant is the
 * same lie as a panel whose sliders do nothing.
 *
 *  - `now`    read inside the frame loop, so the very next frame uses it
 *  - `run`    read when a run is (re)started — change it, then hit Fly again
 *  - `layout` rebuilds the island prefix table under the bird, so the ground
 *             re-forms mid-flight; set it before starting a run to judge it
 */
export type ApplyScope = "now" | "run" | "layout";

export type Knob = {
  key: string;
  label: string;
  group: KnobGroup;
  min: number;
  max: number;
  step: number;
  /** Appended to the readout so a bare 0.55 is not ambiguous. */
  unit?: string;
  /** A constraint the numbers alone do not carry. Keep it short. */
  note?: string;
  scope: ApplyScope;
  fallback: number;
  apply: (value: number) => void;
};

const tune = (key: LiveTunable, label: string, group: KnobGroup, min: number, max: number, step: number, extra: Partial<Knob> = {}): Knob => ({
  key,
  label,
  group,
  min,
  max,
  step,
  fallback: LIVE_TUNE_DEFAULTS[key],
  apply: (v) => applyLiveTune(key, v),
  ...extra,
  scope: extra.scope ?? "now",
});

const release = (key: ReleaseTunable, label: string, group: KnobGroup, min: number, max: number, step: number, extra: Partial<Knob> = {}): Knob => ({
  key,
  label,
  group,
  min,
  max,
  step,
  fallback: RELEASE_TUNE_DEFAULTS[key],
  apply: (v) => applyReleaseTune(key, v),
  ...extra,
  scope: extra.scope ?? "now",
});

/**
 * Every knob, in panel order. Ranges are deliberately far wider than the
 * shipped value: a tuning panel that cannot reach "obviously broken" is a
 * tuning panel that cannot answer the question you opened it to ask.
 */
export const KNOBS: readonly Knob[] = [
  tune("GRAVITY_GLIDE", "Gravity — gliding", "Flight", 0, 60, 0.5, { unit: "m/s²", note: "the pull when the stick is up" }),
  tune("GRAVITY_DIVE", "Gravity — diving", "Flight", 0, 240, 1, { unit: "m/s²", note: "the pull when the stick is down" }),
  tune("GLIDE_LIFT_MAX", "Glide lift ceiling", "Flight", 0, 0.95, 0.01, { note: "fraction of gravity speed-borne lift may cancel" }),
  tune("GLIDE_LIFT_SPEED", "Glide lift speed", "Flight", 5, 200, 1, { unit: "m/s", note: "speed at which lift reaches that ceiling" }),
  tune("STICK_ACCEL_DIVE", "Stick downforce", "Flight", 0, 700, 5, { unit: "m/s²", note: "what holds a diving bird through a convex crest" }),
  tune("MAX_SPEED", "Top speed cap", "Flight", 20, 320, 1, { unit: "m/s", note: "the anti-cheat gate derives from this — a low value quarantines good runs" }),
  tune("FLARE_BRAKE", "Pull-out brake", "Release", 0, 900, 5, { unit: "m/s²", note: "peak of the decaying brake a release spends" }),
  tune("FLARE_DURATION", "Pull-out duration", "Release", 0, 2, 0.01, { unit: "s", note: "impulse ≈ brake × duration ÷ 2" }),
  release("RELEASE_KICK", "Release kick", "Release", 0, 70, 0.5, { unit: "m/s", note: "upward impulse a release buys at full speed" }),
  release("RELEASE_MAX_RISE", "Release rise ceiling", "Release", 0, 140, 1, { unit: "m/s", note: "a release is recovery, not a launch pad" }),
  release("RELEASE_KICK_COOLDOWN", "Release cooldown", "Release", 0, 4, 0.01, { unit: "s", note: "shorter than the dive it pays for, and the kick becomes farmable" }),

  tune("GROUND_G_GLIDE_DOWN", "Downhill pull (gliding)", "Ground", 0, 120, 0.5, { unit: "m/s²", note: "speed you build for free on a descent" }),
  tune("GROUND_STICK_DIVE", "Held-stick floor", "Ground", 0, 60, 0.5, { unit: "m/s²", note: "minimum push a held stick gives on dead flat ground" }),
  tune("GROUND_FRICTION", "Rolling resistance", "Ground", 0, 0.6, 0.005, { note: "high values glue the bird to the hillside" }),
  tune("MIN_KEEP_SPEED", "Minimum speed", "Ground", 0, 60, 0.5, { unit: "m/s", note: "the conveyor floor; zero lets the bird stall out entirely" }),
  tune("LAUNCH_POP_MAX", "Crest pop", "Ground", 0, 120, 0.5, { unit: "m/s", note: "vertical kick for releasing just before a lip" }),
  tune("LAUNCH_POP_SPEED", "Crest pop speed", "Ground", 10, 220, 1, { unit: "m/s", note: "speed at which the pop reaches full strength" }),
  tune("LAUNCH_POP_WINDOW", "Crest pop window", "Ground", 0, 2.5, 0.01, { unit: "s", note: "how early a release still counts" }),

  tune("COIN_VALUE", "Coin value", "Scoring", 0, 20, 0.5, { note: "the scoring multiplier — 1 is shipped" }),
  tune("CLOUD_BONUS", "Cloud bonus", "Scoring", 0, 500, 5, { unit: "pts" }),
  tune("MAGNET_RADIUS", "Coin magnet radius", "Scoring", 0, 100, 0.5, { unit: "m", note: "how wide a pass collects — the effective coin rate" }),

  tune("DAYLIGHT_MAX", "Day length", "World", 5, 400, 1, { unit: "s", note: "the whole clock, not a rate — everything else is tuned against 52" }),
  tune("DAYLIGHT_OCEAN_PENALTY", "Splash penalty", "World", 0, 60, 0.1, { unit: "s" }),
  tune("DAYLIGHT_SPLASH_INTERVAL", "Splash interval", "World", 0.05, 6, 0.05, { unit: "s" }),
  tune("ISLAND_REFILL_CEILING", "Refill ceiling", "World", 0, 500, 5, { unit: "m", note: "how high you may be and still bank an island's refill" }),
  tune("ISLAND_PERIOD", "Island length", "World", 400, 6000, 10, { unit: "m", scope: "layout", note: "world length — the terrain re-forms under you as you drag this" }),
  tune("GAP_START", "Gap start", "World", 300, 5000, 10, { unit: "m", scope: "layout", note: "how much of an island is land before the water; the obstacle-density knob" }),
  tune("DROP_START", "Drop-in start", "World", 200, 5000, 10, { unit: "m", scope: "layout", note: "where the entry slope begins" }),

  tune("START_SPEED", "Start speed", "Flight", 5, 200, 1, { unit: "m/s", scope: "run" }),
  tune("ALT_CEILING", "Altitude ceiling", "Flight", 30, 900, 5, { unit: "m", note: "Star Wish sits at 153-207 m; below that and the band clips them" }),

  tune("CAMERA_BASE_Z", "Camera distance", "Camera", 4, 200, 0.5, { unit: "m" }),
  tune("CAMERA_LOOKAHEAD", "Camera lookahead", "Camera", 0, 1.5, 0.01, { note: "how far ahead of the bird the frame leads" }),
  tune("CAMERA_REVEAL_MAX", "Camera pull-back", "Camera", 10, 500, 1, { unit: "m", note: "distance the altitude/speed terms sum to; retune with the base distance" }),
  tune("BIRD_BASE_SCALE", "Bird size", "Camera", 0.2, 8, 0.05, { note: "visual only — collision still uses BIRD_RADIUS" }),
];

const BY_KEY = new Map(KNOBS.map((k) => [k.key, k]));

/** Knob groups in the order the panel renders them. */
export const KNOB_GROUPS: readonly KnobGroup[] = ["Flight", "Ground", "Release", "Scoring", "World", "Camera"];

const STORAGE_KEY = "sunbird.devtune";

/**
 * Current value of every knob. Seeded from the compiled defaults, which are the
 * values the modules were initialised with — so a fresh panel shows the shipped
 * game, not the last developer's experiment.
 */
const current: Record<string, number> = Object.fromEntries(KNOBS.map((k) => [k.key, k.fallback]));
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

/** Clamp into the knob's own range and refuse anything non-finite. A slider
 *  cannot produce either, but a URL override or a pasted console call can, and
 *  a NaN written into a physics constant is a permanently dead bird. */
function sanitize(knob: Knob, value: number): number {
  if (!Number.isFinite(value)) return knob.fallback;
  return Math.min(knob.max, Math.max(knob.min, value));
}

export const adminTune = {
  knobs: KNOBS,
  knob(key: string): Knob | undefined {
    return BY_KEY.get(key);
  },
  get(key: string): number {
    return current[key] ?? BY_KEY.get(key)?.fallback ?? 0;
  },
  values(): Record<string, number> {
    return { ...current };
  },
  /** Keys whose value differs from the compiled default. */
  dirty(): string[] {
    return KNOBS.filter((k) => current[k.key] !== k.fallback).map((k) => k.key);
  },
  /** Write one knob and push it into the live simulation. */
  set(key: string, value: number): void {
    const knob = BY_KEY.get(key);
    if (!knob) return;
    const next = sanitize(knob, value);
    current[key] = next;
    knob.apply(next);
    // ISLAND_PERIOD is live, but every island boundary under LAYOUT_LIMIT was
    // baked out of it once — without this the world stops matching itself.
    if (knob.scope === "layout") resetIslandLayout();
    notify();
  },
  reset(key: string): void {
    const knob = BY_KEY.get(key);
    if (!knob) return;
    this.set(key, knob.fallback);
  },
  resetAll(): void {
    for (const knob of KNOBS) {
      current[knob.key] = knob.fallback;
      knob.apply(knob.fallback);
    }
    resetIslandLayout();
    // "Reset all" has to forget the saved set too, or the next reload quietly
    // reinstates the experiment the developer just abandoned.
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* private mode — nothing was persisted either */
    }
    notify();
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
  /**
   * Re-apply overrides saved by a previous dev session. Called by the mount,
   * never at import: a module that read localStorage on load would make every
   * test that imports it depend on the browser's storage.
   */
  hydrate(): void {
    let saved: Record<string, unknown> | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      saved = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    } catch {
      saved = null;
    }
    if (!saved) return;
    for (const knob of KNOBS) {
      const v = saved[knob.key];
      if (typeof v === "number") this.set(knob.key, v);
    }
  },
  /** Persist or clear the current overrides. */
  persist(): void {
    try {
      const dirty = adminTune.dirty();
      if (dirty.length === 0) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(dirty.map((k) => [k, current[k]]))));
    } catch {
      /* private mode — the overrides still apply for this session */
    }
  },
};

/** Readout text: enough digits for 0.00042 to survive, no trailing zero noise. */
export function formatTuned(knob: Knob, value: number): string {
  const decimals = knob.step >= 1 ? 0 : Math.min(6, Math.ceil(-Math.log10(knob.step)));
  return value.toFixed(decimals);
}
