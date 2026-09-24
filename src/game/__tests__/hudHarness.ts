/**
 * Shared harness for tests that mount the real flight HUD in jsdom.
 *
 * Extracted from `flight-goal-strip.test.ts` when a second suite needed the same
 * mount: the snapshot stub is a Proxy because `HudSnapshot` has ~120 fields and a
 * test that cares about four of them should not have to invent the other 116.
 * Vitest hooks stay in each test file — a hook registered from an imported module
 * is invisible at the call site.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { SessionGoal } from "../Engagement";
import type { HudSnapshot } from "../HUD";

export type LooseSnapshot = Record<string, unknown>;

export function snapshotStub(): LooseSnapshot {
  const target = function () {} as unknown as LooseSnapshot;
  return new Proxy(target, {
    get(t, prop, recv) {
      if (Reflect.has(t, prop)) return Reflect.get(t, prop, recv);
      if (prop === Symbol.toPrimitive || prop === "toString" || prop === "valueOf") return () => "";
      if (prop === Symbol.iterator) return function* () {};
      if (prop === "length") return 0;
      if (prop === "then") return undefined;
      if (["map", "slice", "filter", "flatMap"].includes(String(prop))) return () => [];
      if (["join"].includes(String(prop))) return () => "";
      if (["find", "findIndex", "reduce"].includes(String(prop))) return () => undefined;
      return snapshotStub();
    },
    set(t, prop, value) {
      return Reflect.set(t, prop, value);
    },
  });
}

export function goal(over: Partial<SessionGoal> = {}): SessionGoal {
  return { id: "g0", kind: "distance", target: 900, label: "Fly 900 m in one run", reward: 52, progress: 0, done: false, ...over };
}

export const WINGS = { icon: "🪽", name: "Fledgling", progress: 0.42, nextName: "Sky Racer", nextNeeded: 340, lifetime: 12_400 };

/**
 * Mount the HUD with a snapshot stub and hand back the root. Callers query what
 * they care about; nothing here assumes a particular element exists.
 */
export async function mountHud(overrides: Record<string, unknown> = {}) {
  const { HUD } = await import("../HUD");
  const hud = new HUD(document.body);
  const snap = snapshotStub();
  Object.assign(snap, {
    state: "playing",
    screen: "main",
    version: 1,
    race: null,
    versus: false,
    p1Stats: null,
    p2Stats: null,
    settings: { reduceMotion: false },
    sessionGoals: [],
    wings: WINGS,
    goalPop: "",
    goalPopKind: "goal",
    rankUp: "",
    rankUpKind: "rank",
    beatLine: null,
    ...overrides,
  });
  hud.update(snap as unknown as HudSnapshot);
  return { hud, snap, root: document.body };
}

/** The goal strip specifically — throws if the flight HUD ever stops rendering it. */
export async function mount(overrides: Record<string, unknown> = {}) {
  const { hud, snap, root } = await mountHud(overrides);
  const strip = root.querySelector<HTMLElement>('[data-ref="goalStrip"]');
  if (!strip) throw new Error("no goal strip in the flight HUD");
  return { hud, snap, strip };
}

export function cssRules(file: string) {
  const text = readFileSync(join(process.cwd(), "src", ...file.split("/")), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  return [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim().replace(/\s+/g, " "), body: m[2] }));
}
