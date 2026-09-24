import { afterEach, describe, expect, it, vi } from "vitest";
import { emoteWheelVisible, HUD } from "../HUD";

/**
 * Menu audit (2026-09-18): "emote does nothing".
 *
 * Two defects, both pinned here:
 *  1. the wheel was gated on `state === "playing"`, so it was invisible in the
 *     Race Lobby — the place a room's players actually gather (and the place a
 *     PvP-only player sees first);
 *  2. the sender's only feedback was a tiny emoji on their roster dot, which is
 *     off-screen in first place. `HUD.pulseEmote()` now pops the player's own
 *     bubble immediately, independent of the sim clock (which is frozen
 *     whenever the race is not stepping).
 */
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function fixture() {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const hud = new HUD(document.body);
  return { hud, root: document.querySelector<HTMLElement>(".hud-root")! };
}

describe("emote wheel visibility", () => {
  it("is visible wherever a race field exists, regardless of UI state", () => {
    expect(emoteWheelVisible({ massRace: true })).toBe(true);
    // no `state` input exists — the lobby/result screens are covered by design
  });

  it("stays hidden in solo flights with no field", () => {
    expect(emoteWheelVisible({ massRace: false })).toBe(false);
  });

  it("starts collapsed in the HUD and exposes six labelled emote buttons", () => {
    const { root } = fixture();
    const wheel = root.querySelector<HTMLElement>('[data-ref="emoteWheel"]')!;
    expect(wheel.classList.contains("hidden")).toBe(true);
    const options = root.querySelector<HTMLElement>(".emote-options")!;
    expect(options.classList.contains("hidden")).toBe(true);
    const buttons = [...options.querySelectorAll<HTMLButtonElement>('button[data-action="emote"]')];
    expect(buttons).toHaveLength(6);
    for (const b of buttons) {
      expect(b.dataset.id).toBeTruthy();
      expect(b.getAttribute("aria-label")).toMatch(/^Send /);
    }
  });
});

describe("emote feedback for the sender", () => {
  it("pops the player's own bubble with the chosen emote", () => {
    vi.useFakeTimers();
    const { hud, root } = fixture();
    const bubble = root.querySelector<HTMLElement>('[data-ref="emoteBubble"]')!;
    expect(bubble.classList.contains("hidden")).toBe(true);

    hud.pulseEmote("🔥");
    expect(bubble.textContent).toBe("🔥");
    expect(bubble.classList.contains("hidden")).toBe(false);
    expect(bubble.classList.contains("pop")).toBe(true);
  });

  it("fades the bubble out on its own so it never sticks on screen", () => {
    vi.useFakeTimers();
    const { hud, root } = fixture();
    const bubble = root.querySelector<HTMLElement>('[data-ref="emoteBubble"]')!;
    hud.pulseEmote("👋");
    vi.advanceTimersByTime(2400);
    expect(bubble.classList.contains("hidden")).toBe(true);
  });

  it("restarts the pop animation for a rapid second emote and keeps the last text", () => {
    vi.useFakeTimers();
    const { hud, root } = fixture();
    const bubble = root.querySelector<HTMLElement>('[data-ref="emoteBubble"]')!;
    hud.pulseEmote("👋");
    hud.pulseEmote("👑");
    expect(bubble.textContent).toBe("👑");
    expect(bubble.classList.contains("pop")).toBe(true);
    // the timer from the first emote must not hide the second one early
    vi.advanceTimersByTime(1500);
    expect(bubble.classList.contains("hidden")).toBe(false);
    vi.advanceTimersByTime(900);
    expect(bubble.classList.contains("hidden")).toBe(true);
  });
});
