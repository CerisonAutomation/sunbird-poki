import { afterEach, describe, expect, it, vi } from "vitest";
import { HUD } from "../HUD";
import { feedbackSlot } from "../HudFeedback";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); document.body.innerHTML = ""; });

function fixture() {
  const disconnect = vi.fn();
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect = disconnect; });
  const hud = new HUD(document.body);
  return { hud, root: document.querySelector<HTMLElement>(".hud-root")!, disconnect };
}

describe("readable HUD feedback", () => {
  it("gives countdown / finish / launch / goal precedence over coaching", () => {
    const state = { countdown: 3, finishRemaining: 8, launchBannerT: 1, goalPop: "Goal!" };
    expect(feedbackSlot(state)).toBe("countdown");
    state.countdown = 0;
    expect(feedbackSlot(state)).toBe("finish");
    state.finishRemaining = 0;
    expect(feedbackSlot(state)).toBe("launch");
    state.launchBannerT = 0;
    expect(feedbackSlot(state)).toBe("goal");
    state.finishRemaining = 4000; // no finish widget yet; do not suppress coaching
    state.goalPop = "";
    expect(feedbackSlot(state)).toBe("hint");
  });

  it("keeps the painted menu sky out of the DOM — the 3D world is the backdrop", () => {
    const { hud, root, disconnect } = fixture();
    // The main-screen backdrop is the live 3D gameplay world (attract flight,
    // Game.menuTick). The painted 2D sky canvas must NOT be mounted, or it
    // covers the world with a flat opaque painting (regression 2026-09).
    expect(root.querySelector(".menu-sky")).toBeNull();
    // The hero-bird overlay stays mounted but permanently hidden (the big
    // drifting title-screen bird was removed by request); MenuSky.dispose()
    // relies on it being a real element.
    const hero = root.querySelector(".menu-hero-layer");
    expect(hero).not.toBeNull();
    expect(hero!.classList.contains("hidden")).toBe(true);
    expect(hero!.querySelector("canvas")).not.toBeNull();
    // Dormant: no sized canvas buffers (unsized canvases stay at the
    // 300×150 default — no memory, no rAF).
    for (const c of root.querySelectorAll("canvas")) expect(c.width).toBe(300);
    expect(root.querySelectorAll(".top-bar .hud-controls button")).toHaveLength(2);
    expect(root.querySelector(".hud-header .roster-bar")).not.toBeNull();
    expect(root.querySelector(".flight-footer .fever-wrap")).not.toBeNull();
    expect(root.querySelectorAll(".flight-messages > *")).toHaveLength(5);
    hud.dispose();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("draws the flight coin counter with the same glyph as the menus", () => {
    const { hud, root } = fixture();
    const coin = root.querySelector<HTMLElement>(".play-hud .stat-value.coin");
    expect(coin).not.toBeNull();
    // The shared inline SVG. This counter used to be drawn by a ::before
    // radial-gradient dot in index.css, which made it the one coin in the game
    // rendered with different art from every menu price and reward pill.
    expect(coin!.querySelector("svg.coin-glyph")).not.toBeNull();
    // The amount is its own node, so a per-frame text update cannot wipe the
    // glyph and the layout fixture can replace the number alone.
    const amount = coin!.querySelector<HTMLElement>('[data-ref="coins"]');
    expect(amount).not.toBeNull();
    expect(amount!.tagName).toBe("SPAN");
    expect(amount!.textContent).toBe("0");
    hud.dispose();
  });

  it("bounds notifications, deduplicates without layout reads and cancels disposal timers", () => {
    vi.useFakeTimers();
    const { hud, root } = fixture();
    root.dataset.flying = "true";
    hud.toast("Butter landing", "cloud");
    hud.toast("Butter landing", "cloud");
    expect(root.querySelector(".toast")?.textContent).toBe("Butter landing ×2");
    hud.toast("Through the ring", "gold");
    expect(root.querySelectorAll(".toast")).toHaveLength(1);
    expect(root.querySelector(".toast")?.textContent).toBe("Through the ring");
    root.dataset.flying = "false";
    hud.toast("Menu reward");
    expect(root.querySelectorAll(".toast")).toHaveLength(2);
    hud.flash("perfect");
    vi.advanceTimersByTime(32); // complete CSS-enter requestAnimationFrames
    hud.dispose();
    expect(vi.getTimerCount()).toBe(0);
    expect(document.querySelector(".hud-root")).toBeNull();
  });
});
