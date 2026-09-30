import { afterEach, describe, expect, it, vi } from "vitest";
import { HUD } from "../HUD";
import { TOAST_MIN_VISIBLE_MS } from "../toastFloor";
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
    // Membership, not a count. `toHaveLength(5)` pinned the lane's exact
    // child count, so adding `.chain-readout` to the flight-messages lane —
    // which is where ui.css has always said it belongs — failed here instead of
    // being accepted, and the only way to satisfy it was to leave the element
    // outside the lane. A count assertion silently forbids the fix for the very
    // bug it should have caught.
    //
    // What actually matters is that the lane's declared members ARE in the lane,
    // and that nothing undeclared is. Asserting the names means a new lane
    // member is a one-line change here and a wrong lane is a failure.
    const msgs = root.querySelector(".flight-messages")!;
    for (const sel of [".launch-banner", ".hint", ".goal-pop", ".finish-countdown", ".countdown", ".chain-readout"]) {
      expect(msgs.querySelector(sel), `${sel} must be in the flight-messages lane`).not.toBeNull();
    }
    // Everything in the lane is a declared member — no strays parked there.
    const declared = [".launch-banner", ".hint", ".goal-pop", ".finish-countdown", ".countdown", ".chain-readout"];
    for (const child of [...msgs.children]) {
      expect(declared.some((d) => child.matches(d)), `undeclared ${child.className} in the lane`).toBe(true);
    }
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
    // The in-flight cap is one pill, and it used to be enforced by evicting
    // the incumbent instantly — so in a stream of system messages a toast
    // could be born and destroyed inside the same 100 ms, which is why the
    // flavour lines never appeared. A pill now gets TOAST_MIN_VISIBLE_MS
    // before anything may replace it; the newcomer waits its turn.
    hud.toast("Through the ring", "gold");
    expect(root.querySelectorAll(".toast")).toHaveLength(1);
    expect(
      root.querySelector(".toast")?.textContent,
      "the incumbent keeps the slot until it has actually been readable",
    ).toBe("Butter landing ×2");
    vi.advanceTimersByTime(TOAST_MIN_VISIBLE_MS + 40);
    expect(
      root.querySelector(".toast")?.textContent,
      "and the deferred message still arrives — it is delayed, not dropped",
    ).toBe("Through the ring");
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
