/**
 * Polish pass regressions (2026-10-04 directive) — each test pins something a
 * player specifically asked for, in the layer where it actually broke:
 *
 *  - Quips rendered as raw UNSTYLED text (dark ink on the sky) because
 *    `.quip` had no CSS rule anywhere. Pinned at the stylesheet level.
 *  - Messages vanished mid-read; the read-time model was raised for a global
 *    second-language audience. Pinned by message-timing.test.ts literals.
 *  - No way to change bird/trail/boosters at the launch moment. The home hero
 *    now carries a loadout chip beside "Fly now". Pinned here.
 *  - No way to see what "max fps" work does. Settings > Show FPS counter.
 *    Pinned here.
 *  - New biomes paid a toast and nothing else. Charting now pays coins that
 *    scale with depth. Pinned at the pure-function level.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});
import { readFileSync } from "node:fs";
import { mountHud } from "./hudHarness";
import { chartingBonus, BIOMES } from "../Biomes";
import { STEP_DOWN_FRAME_SECONDS } from "../quality";

describe("quip pills are readable on any sky (the black-text fix)", () => {
  const css = readFileSync("src/index.css", "utf8");

  it("styles the quip pill itself — background, light text, and motion", () => {
    const quipRule = /\.quip\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(quipRule, "a .quip rule must exist — unstyled quips are dark ink on the sky").not.toBe("");
    expect(quipRule).toMatch(/background:/);
    expect(quipRule).toMatch(/color:\s*var\(--text-on-sky\)/);
    expect(quipRule).toMatch(/text-align:\s*center/);
  });

  it("keeps the gold joke readable: light text swapped for dark on light pills", () => {
    const goldRule = /\.quip\.gold\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(goldRule).not.toBe("");
    // White text on a gold pill is the original black-text bug wearing a hat.
    // var(--ink) resolves to the dark ink token — and it must NOT be
    // var(--text-on-sky), which is the unreadable combination.
    expect(goldRule).toMatch(/color:\s*var\(--ink\)/);
    expect(goldRule).not.toMatch(/color:\s*var\(--text-on-sky\)/);
  });
});

describe("the loadout chip sits at the launch moment", () => {
  it("shows the equipped bird, trail and staged boosts beside Fly now", async () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const { root } = await mountHud({
      state: "menu",
      screen: "main",
      loadout: { bird: "Robin", trail: "Goldleaf", boosts: 2, rankedNote: "" },
      skins: [],
    });
    const chip = root.querySelector<HTMLElement>(".loadout-quick");
    expect(chip, "the quick-shop chip must render on the home hero").not.toBeNull();
    expect(chip!.getAttribute("data-action")).toBe("open-loadout");
    expect(chip!.textContent).toContain("Robin");
    expect(chip!.textContent).toContain("Goldleaf");
    expect(chip!.textContent).toContain("2");
    // The chip must not displace the primary action.
    expect(root.querySelector('[data-action="pvp-practice"]')).not.toBeNull();
  });
});

describe("the FPS counter is a setting, not a permanent fixture", () => {
  it("paints the live rate when enabled in flight", async () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const { root } = await mountHud({
      state: "playing",
      fps: 60,
      settings: { showFps: true },
    });
    const chip = root.querySelector<HTMLElement>(".fps-chip");
    expect(chip?.classList.contains("hidden")).toBe(false);
    expect(chip?.textContent).toContain("60");
  });

  it("stays hidden when off, and outside flight", async () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const off = await mountHud({ state: "playing", fps: 60, settings: { showFps: false } });
    expect(off.root.querySelector(".fps-chip")?.classList.contains("hidden")).toBe(true);
    const menu = await mountHud({ state: "menu", fps: 60, settings: { showFps: true } });
    expect(menu.root.querySelector(".fps-chip")?.classList.contains("hidden")).toBe(true);
  });
});

describe("charting a new world pays (worlds & rewards)", () => {
  it("scales with depth and is strictly increasing across the chain", () => {
    expect(chartingBonus(BIOMES[0]!.id)).toBe(25);
    const rewards = BIOMES.map((b) => chartingBonus(b.id));
    for (let i = 1; i < rewards.length; i++) {
      expect(rewards[i]).toBeGreaterThan(rewards[i - 1]!);
    }
  });

  it("pays a fair minimum for an unknown or future biome id", () => {
    expect(chartingBonus("a-world-nobody-has-met")).toBe(25);
  });

  it("includes the tenth world, and it pays the deepest charting bonus", () => {
    // Amethyst Hollow (2026-10-04): the atlas's reward world before the laps.
    const amethyst = BIOMES.find((b) => b.id === "amethyst");
    expect(amethyst, "the tenth biome must exist").toBeDefined();
    expect(amethyst!.liftMult).toBeGreaterThan(1); // floaty air is its identity
    expect(amethyst!.glow).toBe(true);             // it is a night-glow world
    expect(BIOMES).toHaveLength(10);
    expect(chartingBonus("amethyst")).toBe(160);
  });
});

describe("the resolution ladder defends 60 fps, not 40", () => {
  it("steps down inside the perceptible sub-50fps band", () => {
    // 45 fps: above the old 1/40 step-down bar (which would sit and do
    // nothing), below the new one — the exact "stable but visibly not 60"
    // case the 2026-10-04 directive called out.
    expect(STEP_DOWN_FRAME_SECONDS).toBeLessThanOrEqual(1 / 50);
    expect(STEP_DOWN_FRAME_SECONDS).toBeLessThan(1 / 45);
  });
});
