/**
 * The dev tuning panel: that it is reachable in development, unreachable in a
 * production bundle, and — the part that matters most — that moving a slider
 * moves the *simulation*, not just the number next to it.
 *
 * "The panel exists" and "the panel works" are different claims, and the second
 * one is the one that fails silently. Every live assertion below goes through a
 * real consumer: Bird.step for gravity, releaseKick and dampClimbAtCeiling for
 * the release and ceiling constants, islandTemplate for the island layout. None
 * of them re-implement the physics, so none of them can agree with a broken
 * write path by accident.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { adminTune, KNOBS } from "../AdminStore";
import { Bird } from "../Bird";
import { TerrainSystem } from "../TerrainSystem";
import { PHYS_DT } from "../constants";
import { applyReleaseKick, dampClimbAtCeiling, releaseKick } from "../FlightPhysics";
import { islandStartFor, islandTemplate } from "../Biomes";

const root = process.cwd();
const read = (...parts: string[]): string => readFileSync(join(root, ...parts), "utf8");

afterEach(() => {
  adminTune.resetAll();
});

/**
 * 0.25 s of real flight from a known start, read back off the real bird.
 *
 * Speed is a parameter because the lift term is speed-borne: at the 11 m/s
 * `Bird.reset` hands out, `clamp(sp / GLIDE_LIFT_SPEED)` is a fifth of full
 * and a GLIDE_LIFT_MAX change is nearly invisible — which would make a lift
 * assertion pass for the wrong reason.
 */
function fly(opts: { vx?: number; diving?: boolean; set?: Record<string, number> } = {}): number {
  for (const [key, value] of Object.entries(opts.set ?? {})) adminTune.set(key, value);
  const terrain = new TerrainSystem("dev-panel");
  const bird = new Bird();
  bird.reset(64, terrain.heightAt(64) + 90);
  bird.vx = opts.vx ?? 11;
  for (let i = 0; i < 30; i++) {
    bird.step(PHYS_DT, { diving: opts.diving ?? false, fever: false, speedMult: 1, boost: false }, terrain);
  }
  return Math.abs(bird.vy);
}

describe("the production gate", () => {
  const main = read("src", "main.tsx");

  it("mounts the panel from the entry point", () => {
    // Without this the guard assertions below pass on a panel nothing loads.
    expect(main).toContain("./game/DevPanelMount");
  });

  it("guards that mount with the build-time DEV constant", () => {
    expect(main).toContain("if (import.meta.env.DEV) void import(\"./game/DevPanelMount\")");
  });

  it("uses a compile-time constant, not a runtime check", () => {
    // `location.hostname === "localhost"` would survive the production build and
    // ship the panel; only a substitution Vite makes at build time cannot.
    expect(main).not.toMatch(/import\.meta\.env\[[^\]]*\]/);
    expect(main).not.toMatch(/location\.hostname/);
  });

  it("loads the panel dynamically, so no production build carries the chunk", () => {
    expect(main).not.toMatch(/^import .*DevPanel/m);
  });

  it("is not statically imported by any other module", () => {
    // A static import anywhere would put the panel in that module's chunk and
    // survive the DEV gate at the entry point, so the whole tree is scanned.
    const staticImport = /^\s*import\s+(?!type\b)[^;]*["'][^"']*DevPanel(?:Mount)?["']/m;
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "__tests__" || entry.name === "node_modules") continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry.name) && staticImport.test(readFileSync(full, "utf8"))) {
          offenders.push(full.slice(root.length + 1));
        }
      }
    };
    walk(join(root, "src"));
    expect(offenders).toEqual([]);
  });

  it("opens on a key the game does not already own", async () => {
    const { DEV_PANEL_KEY } = await import("../DevPanelMount");
    const input = read("src", "game", "Input.ts");
    // Everything Input.ts claims as a dive / player-2 / system key, read from
    // the source rather than a copy, so a new binding cannot sneak past.
    const taken = new Set<string>();
    for (const m of input.matchAll(/"([A-Za-z][A-Za-z0-9]*)"/g)) taken.add(m[1]!);
    for (const m of input.matchAll(/e\.code === "([^"]+)"/g)) taken.add(m[1]!);
    expect(taken.has(DEV_PANEL_KEY)).toBe(false);
    expect(DEV_PANEL_KEY).toBe("Backquote");
  });
});

describe("the knob table", () => {
  it("covers every knob the panel renders, with a real range around it", () => {
    expect(KNOBS.length).toBeGreaterThanOrEqual(30);
    for (const knob of KNOBS) {
      expect(knob.min).toBeLessThan(knob.fallback);
      expect(knob.max).toBeGreaterThan(knob.fallback);
      expect(knob.step).toBeGreaterThan(0);
      expect(knob.label.length).toBeGreaterThan(0);
    }
  });

  it("seeds every readout with the value the game module was built with", () => {
    // A fallback that drifts from the compiled constant is a reset button that
    // does not reset, so the panel would quietly lie about "shipped".
    for (const knob of KNOBS) expect(adminTune.get(knob.key)).toBe(knob.fallback);
    expect(adminTune.dirty()).toEqual([]);
  });

  it("refuses to write a non-finite value", () => {
    adminTune.set("GRAVITY_DIVE", Number.NaN);
    expect(adminTune.get("GRAVITY_DIVE")).toBe(adminTune.knob("GRAVITY_DIVE")!.fallback);
  });

  it("clamps to the knob's own range", () => {
    adminTune.set("GRAVITY_DIVE", 1e9);
    expect(adminTune.get("GRAVITY_DIVE")).toBe(adminTune.knob("GRAVITY_DIVE")!.max);
  });

  it("restores one knob and all knobs", () => {
    const shipped = adminTune.get("COIN_VALUE");
    adminTune.set("COIN_VALUE", 7);
    expect(adminTune.dirty()).toContain("COIN_VALUE");
    adminTune.reset("COIN_VALUE");
    expect(adminTune.get("COIN_VALUE")).toBe(shipped);
    adminTune.set("CAMERA_BASE_Z", 60);
    adminTune.resetAll();
    expect(adminTune.dirty()).toEqual([]);
  });

  it("notifies subscribers on a write", () => {
    let hits = 0;
    const off = adminTune.subscribe(() => { hits += 1; });
    adminTune.set("COIN_VALUE", 3);
    off();
    adminTune.set("COIN_VALUE", 4);
    expect(hits).toBe(1);
  });

  it("saves only the knobs that were moved, and reset-all forgets them", () => {
    localStorage.clear();
    adminTune.set("COIN_VALUE", 9);
    adminTune.persist();
    expect(JSON.parse(localStorage.getItem("sunbird.devtune")!)).toEqual({ COIN_VALUE: 9 });
    adminTune.resetAll();
    expect(adminTune.get("COIN_VALUE")).toBe(adminTune.knob("COIN_VALUE")!.fallback);
    expect(localStorage.getItem("sunbird.devtune")).toBeNull();
  });

  it("re-applies a previous session's overrides on hydrate", () => {
    localStorage.clear();
    localStorage.setItem("sunbird.devtune", JSON.stringify({ DAYLIGHT_MAX: 11, CAMERA_BASE_Z: 61 }));
    expect(adminTune.get("DAYLIGHT_MAX")).toBe(adminTune.knob("DAYLIGHT_MAX")!.fallback);
    adminTune.hydrate();
    expect(adminTune.get("DAYLIGHT_MAX")).toBe(11);
    expect(adminTune.get("CAMERA_BASE_Z")).toBe(61);
    localStorage.clear();
    adminTune.resetAll();
  });

  it("ignores a stored value that is not a finite number, and does not write it", () => {
    localStorage.setItem("sunbird.devtune", JSON.stringify({ GRAVITY_DIVE: "fast", CAMERA_BASE_Z: 45 }));
    let writes = 0;
    const off = adminTune.subscribe(() => { writes += 1; });
    adminTune.hydrate();
    off();
    expect(adminTune.get("GRAVITY_DIVE")).toBe(adminTune.knob("GRAVITY_DIVE")!.fallback);
    expect(adminTune.get("CAMERA_BASE_Z")).toBe(45);
    // One write for the one usable entry. Writing `undefined` to the other 35
    // knobs would look identical here but would fire a notify per knob and
    // rebuild the island layout table on every hydrate.
    expect(writes).toBe(1);
    localStorage.clear();
  });
});

describe("a slider move reaches the running simulation", () => {
  it("gravity: a real Bird falls measurably faster under a tuned GRAVITY_GLIDE", () => {
    const shipped = fly();
    const retuned = fly({ set: { GRAVITY_GLIDE: 60 } });
    // ~0.25 s of fall: 16 m/s² gives ~4 m/s, 60 gives ~15. A wide band so a
    // drag tweak or a biome multiplier cannot make this flaky.
    expect(shipped).toBeGreaterThan(2);
    expect(retuned).toBeGreaterThan(shipped * 2.5);
  });

  it("gravity: the reset puts the simulation back", () => {
    const shipped = fly();
    fly({ set: { GRAVITY_GLIDE: 60 } });
    adminTune.reset("GRAVITY_GLIDE");
    expect(fly()).toBeCloseTo(shipped, 5);
  });

  it("dive gravity: a tuned GRAVITY_DIVE sinks a held stick harder", () => {
    const shipped = fly({ diving: true });
    const retuned = fly({ diving: true, set: { GRAVITY_DIVE: 200 } });
    expect(retuned).toBeGreaterThan(shipped * 1.8);
  });

  it("glide lift: a tuned GLIDE_LIFT_MAX is a real fraction of gravity", () => {
    const lifted = fly({ vx: 62 });
    const liftless = fly({ vx: 62, set: { GLIDE_LIFT_MAX: 0 } });
    // At GLIDE_LIFT_SPEED the ceiling cancels 55% of gravity, so the fall rate
    // collapses to under half. A knob that only changed a readout would not.
    expect(lifted).toBeLessThan(liftless * 0.6);
  });

  it("release kick: releaseKick() itself returns the tuned impulse", () => {
    expect(releaseKick(0, 0, 120)).toBeCloseTo(15, 6);
    adminTune.set("RELEASE_KICK", 40);
    expect(releaseKick(0, 0, 120)).toBeCloseTo(40, 6);
    // applyReleaseKick is what enforces the ceiling, and it reads the same
    // binding — a kick cannot outrun a small RELEASE_MAX_RISE.
    adminTune.set("RELEASE_MAX_RISE", 20);
    expect(applyReleaseKick(0, 0, 120)).toBeCloseTo(20, 6);
  });

  it("altitude ceiling: dampClimbAtCeiling() moves its band with ALT_CEILING", () => {
    expect(dampClimbAtCeiling(100, 250)).toBeCloseTo(20, 6);
    adminTune.set("ALT_CEILING", 400);
    expect(dampClimbAtCeiling(100, 250)).toBeCloseTo(100, 6);
  });

  it("island length: the layout table is rebuilt, not left stale", () => {
    const before = islandTemplate(0).period;
    adminTune.set("ISLAND_PERIOD", before * 2);
    const after = islandTemplate(0).period;
    expect(after).toBeCloseTo(before * 2, 4);
    // And the world stays self-consistent: island 1 still starts where island 0 ends.
    expect(islandStartFor(1)).toBeCloseTo(after, 4);
  });

  it("gap density: GAP_START is re-read without a layout rebuild", () => {
    const before = islandTemplate(0).gapStart;
    adminTune.set("GAP_START", before * 1.5);
    expect(islandTemplate(0).gapStart).toBeCloseTo(before * 1.5, 4);
  });
});
