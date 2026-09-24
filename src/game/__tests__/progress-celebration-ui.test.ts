/**
 * The celebration strip and the in-run wings bar — markup, order and a11y.
 *
 * `ProgressBeats.ts` decides *what* a run's progress is worth; these cases check
 * that the HUD actually puts it on screen: nothing when the run earned nothing,
 * the staged beats in rank order with the stagger attached, the folded beats
 * still visible, and the proximity bar hidden until the rank-up is close.
 *
 * The snapshot stub is the Proxy pattern `pilot-name-surface.test.ts` uses: the
 * results card reads dozens of fields, and anything unlisted answers as an empty
 * value of whatever shape is asked for.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HudSnapshot } from "../HUD";
import { celebrationView, planCelebration, STAGGER_MS, type ProgressEvent } from "../ProgressBeats";

type LooseSnapshot = Record<string, unknown>;

function snapshotStub(): LooseSnapshot {
  const target = function () {} as unknown as LooseSnapshot;
  return new Proxy(target, {
    get(t, prop, recv) {
      if (Reflect.has(t, prop)) return Reflect.get(t, prop, recv);
      if (prop === Symbol.toPrimitive || prop === "toString" || prop === "valueOf") return () => "";
      if (prop === Symbol.iterator) return function* () {};
      if (prop === "length") return 0;
      if (prop === "then") return undefined;
      if (["map", "slice", "filter", "join", "flatMap"].includes(String(prop))) return () => [];
      return snapshotStub();
    },
    set(t, prop, value) {
      return Reflect.set(t, prop, value);
    },
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    disconnect() {}
    unobserve() {}
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

async function render(overrides: Record<string, unknown>): Promise<HTMLElement> {
  const { HUD } = await import("../HUD");
  const hud = new HUD(document.body);
  const snap = snapshotStub();
  Object.assign(snap, {
    state: "gameover",
    screen: "main",
    version: 1,
    // A truthy race snapshot routes the card to the two-player results branch.
    race: null,
    versus: false,
    p1Stats: null,
    p2Stats: null,
    settings: { reduceMotion: false },
    celebration: celebrationView(planCelebration([])),
    proximity: { visible: false, fill: 0, remaining: 0, name: "" },
    ...overrides,
  });
  hud.update(snap as unknown as HudSnapshot);
  return document.querySelector<HTMLElement>(".hud-root")!;
}

/** A run that moved four ladders at once — the case the toast cap used to eat. */
const fourLadders: ProgressEvent[] = [
  { kind: "quest", count: 1, coins: 60 },
  { kind: "mastery", icon: "🏔", mode: "Tempest", level: 2, maxed: false, skill: "", coins: 100 },
  { kind: "wings", tierId: "silver", icon: "🥈", name: "Silver Wings" },
  { kind: "trophy", id: "dist_100k", title: "World Wanderer", rarity: "gold" },
];

describe("results card: the celebration strip", () => {
  it("renders nothing at all for a run that earned nothing", async () => {
    const root = await render({});
    expect(root.querySelector(".celebration")).toBeNull();
  });

  it("stages every beat the run earned, rarest last", async () => {
    const root = await render({ celebration: celebrationView(planCelebration(fourLadders)) });
    const strip = root.querySelector(".celebration");
    expect(strip).not.toBeNull();
    const staged = [...strip!.querySelectorAll(":scope > .beat")];
    expect(staged).toHaveLength(3);
    // Build-up: the mastery level leads, the lifetime rank-up closes, and the
    // quest — the quietest thing the run did — waits in the ledger row.
    expect(staged.map((el) => el.className)).toEqual(["beat silver", "beat gold", "beat silver banner"]);
    expect(staged.map((el) => (el as HTMLElement).style.animationDelay)).toEqual([
      "0ms",
      `${STAGGER_MS}ms`,
      `${STAGGER_MS * 2}ms`,
    ]);
    expect(staged[0]!.textContent).toContain("Tempest mastery Lv.2");
    expect(staged[1]!.textContent).toContain("World Wanderer");
    expect(staged[2]!.textContent).toContain("Silver Wings");
  });

  it("keeps the beats that did not make the stage on screen", async () => {
    const root = await render({ celebration: celebrationView(planCelebration(fourLadders)) });
    const row = root.querySelector(".celebration .beat-row");
    expect(row).not.toBeNull();
    expect(row!.querySelectorAll(".beat")).toHaveLength(1);
    expect(row!.textContent).toContain("Quest complete · +60 coins");
  });

  it("folds a wall of progress into a count instead of chips", async () => {
    const busy: ProgressEvent[] = [
      ...fourLadders,
      { kind: "record", metres: 4210 },
      { kind: "pass", tier: 7 },
      { kind: "cosmetic", icon: "✨", label: "Stormline trail" },
      { kind: "nest", level: 4, mult: 1.18 },
      { kind: "challenge", variant: "daily", icon: "☀", label: "Daily challenge", coins: 80 },
      { kind: "trophy", id: "flights_100", title: "Sky Veteran", rarity: "gold" },
    ];
    const root = await render({ celebration: celebrationView(planCelebration(busy)) });
    const more = root.querySelector(".celebration .beat.more");
    expect(more).not.toBeNull();
    expect(more!.textContent).toContain("+3 more from this flight");
  });

  it("gives the strip an accessible name and a list role", async () => {
    const root = await render({ celebration: celebrationView(planCelebration(fourLadders)) });
    const strip = root.querySelector(".celebration")!;
    expect(strip.getAttribute("role")).toBe("list");
    expect((strip.getAttribute("aria-label") ?? "").length).toBeGreaterThan(3);
    // Icons are decoration; the words carry the meaning.
    for (const icon of strip.querySelectorAll(".beat > i")) expect(icon.getAttribute("aria-hidden")).toBe("true");
    // A list whose items are not list items is announced as an empty list.
    const beats = strip.querySelectorAll(".beat");
    expect(beats.length).toBeGreaterThan(0);
    for (const beat of beats) expect(beat.getAttribute("role")).toBe("listitem");
  });

  it("leaves the growth ledger next to the celebration, not merged into it", async () => {
    const root = await render({ celebration: celebrationView(planCelebration(fourLadders)) });
    expect(root.querySelector(".celebration")).not.toBeNull();
    expect(root.querySelector(".growth-ledger")).not.toBeNull();
  });
});

describe("in flight: the wings proximity bar", () => {
  it("stays hidden until the rank-up is close", async () => {
    const root = await render({ state: "playing", screen: "main" });
    const meter = root.querySelector<HTMLElement>(".wings-near");
    expect(meter).not.toBeNull();
    expect(meter!.classList.contains("hidden")).toBe(true);
  });

  it("fills and names the rung it is climbing", async () => {
    const root = await render({
      state: "playing",
      screen: "main",
      proximity: { visible: true, fill: 0.75, remaining: 150, name: "Silver Wings" },
    });
    const meter = root.querySelector<HTMLElement>(".wings-near")!;
    expect(meter.classList.contains("hidden")).toBe(false);
    expect((meter.firstElementChild as HTMLElement).style.width).toBe("75%");
    expect(meter.lastElementChild!.textContent).toBe("150 m to Silver Wings");
  });

  it("rewrites the label as the metres fall, and hides again at the promotion", async () => {
    const { HUD } = await import("../HUD");
    const hud = new HUD(document.body);
    const snap = snapshotStub();
    Object.assign(snap, {
      state: "playing",
      screen: "main",
      version: 1,
      settings: { reduceMotion: false },
      celebration: celebrationView(planCelebration([])),
      proximity: { visible: true, fill: 0.9, remaining: 60, name: "Silver Wings" },
    });
    hud.update(snap as unknown as HudSnapshot);
    const root = document.querySelector<HTMLElement>(".hud-root")!;
    const meter = root.querySelector<HTMLElement>(".wings-near")!;
    expect(meter.lastElementChild!.textContent).toBe("60 m to Silver Wings");
    snap.version = 2;
    snap.proximity = { visible: false, fill: 1, remaining: 0, name: "Silver Wings" };
    hud.update(snap as unknown as HudSnapshot);
    expect(meter.classList.contains("hidden")).toBe(true);
  });
});

describe("reduce motion: the celebration must still be readable", () => {
  /**
   * The beats fade in with `opacity: 0` + a CSS animation, and
   * `menu-polish.css` cancels every animation inside `.overlay` with
   * `!important` when Reduce Motion is on. Without an explicit override the
   * whole celebration stays invisible for exactly the players who asked for
   * less motion — so the override is pinned here, in both of its forms.
   */
  const css = readFileSync(join(process.cwd(), "src/game/ui.css"), "utf8");

  it("shows every beat when the in-game toggle is on", () => {
    const rule = /\.sb-reduce-motion\s+\.celebration\s+\.beat\s*\{([^}]*)\}/.exec(css);
    expect(rule, "ui.css needs a .sb-reduce-motion .celebration .beat rule").not.toBeNull();
    expect(rule![1]).toMatch(/animation:\s*none/);
    expect(rule![1]).toMatch(/opacity:\s*1/);
  });

  it("shows every beat when the OS prefers reduced motion", () => {
    const blocks = css.split("@media (prefers-reduced-motion: reduce)");
    const guarded = blocks.some((b) => /\.celebration\s+\.beat/.test(b) && /opacity:\s*1/.test(b));
    expect(guarded).toBe(true);
  });
});
