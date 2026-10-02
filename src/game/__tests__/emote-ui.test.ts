import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { emoteWheelVisible, HUD } from "../HUD";

/**
 * The short-frame compaction of `.emote-options button` has to be written AFTER
 * the base rule it compacts. A media query adds no specificity, so an identical
 * selector earlier in the file loses on order however carefully it is scoped —
 * and the base rule's `min-height: 44px` then beats the compaction's own
 * `height: 30px` besides.
 *
 * The version that sat above the base rule was exactly that, and it shipped:
 * the buttons stayed at 44px, six of them wrapped into three rows of 196px
 * inside a 227.2px footer, and the footer grew to 255.5px of a 320px-tall
 * window. `index.css` says the same about the emote PILL a few hundred lines up
 * ("It MUST sit after the pill above: a media query adds no specificity"); this
 * is the guard for the second occurrence of the same mistake.
 */
const css = readFileSync(join(process.cwd(), "src/index.css"), "utf8");

describe("the short-frame picker compaction", () => {
  it("is written after the base rule it overrides", () => {
    const base = css.lastIndexOf("\n.flight-footer .emote-options button {");
    expect(base, "the base .emote-options button rule is gone").toBeGreaterThan(-1);
    const media = css.indexOf("@media (max-height: 360px)", base);
    expect(media, "the max-height: 360px block was moved above the base rule, where it is dead code").toBeGreaterThan(base);
    const button = css.indexOf(".flight-footer .emote-options button", media);
    expect(button, "the short-frame block no longer compacts the buttons").toBeGreaterThan(-1);
    expect(button, "the compaction is in the wrong media block").toBeGreaterThan(media);
    expect(button, "the compaction is above the base rule again").toBeGreaterThan(base);
  });

  it("clears the base rule's 44px touch floors rather than only lowering `height`", () => {
    const start = css.indexOf("@media (max-height: 360px)", css.lastIndexOf("\n.flight-footer .emote-options button {"));
    const body = css.slice(start, css.indexOf("}", css.indexOf("button", start)));
    // `min-height: 44px` on the base rule wins over any `height` the block sets,
    // which is why the first version of this fix moved nothing measurable.
    expect(body).toMatch(/min-height:\s*0/);
    expect(body).toMatch(/min-width:\s*0/);
    expect(body).toMatch(/flex:\s*1 1 0/);
  });
});

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
