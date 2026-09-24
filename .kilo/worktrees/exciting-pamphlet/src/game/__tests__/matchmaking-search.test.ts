import { afterEach, describe, expect, it, vi } from "vitest";
import { HUD } from "../HUD";
import { renderCoinMultiplierCard } from "../HUD";

/**
 * The search overlay is the moment a player decides whether this game is
 * multiplayer. It used to read "Searching… AI practice starts in 8s" and then
 * did exactly that — dropping them into bots without asking. These tests pin
 * the honest contract: the countdown is to a ROOM start, and the only way into
 * an AI race is the explicit button.
 */

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function fixture() {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  const hud = new HUD(document.body);
  return hud;
}

const el = (sel: string) => document.querySelector<HTMLElement>(sel)!;

describe("matchmaking search overlay", () => {
  it("counts down to a room start and never promises a bot race", () => {
    const hud = fixture();
    hud.setMatchmaking(true, 0, 40, 12, "searching", "2 joinable now · 6 pilots seated");
    expect(el(".matchmaking").classList.contains("hidden")).toBe(false);
    expect(el(".matchmaking-title").textContent).toContain("Searching for live pilots");
    expect(el(".matchmaking-count").textContent).toBe("Waiting for the first live pilot");
    expect(el(".matchmaking-label").textContent).toContain("Looking for pilots on this circuit");
    expect(el(".matchmaking-label").textContent).toContain("12s");
    expect(el(".matchmaking-rooms").textContent).toContain("2 joinable now");
    // The AI button exists but is not offered while the window is running.
    expect(el('[data-action="mm-ai"]').classList.contains("hidden")).toBe(true);
    expect(el('[data-action="mm-keep-search"]').classList.contains("hidden")).toBe(true);
    // The old copy is gone for good.
    expect(el(".matchmaking").textContent).not.toContain("AI practice starts");
    expect(el(".matchmaking").textContent).not.toContain("Launch Now");
    hud.dispose();
  });

  it("reports live pilots in the room as they arrive", () => {
    const hud = fixture();
    hud.setMatchmaking(true, 3, 40, 5, "searching", "");
    expect(el(".matchmaking-count").textContent).toBe("3 live pilots in this room");
    expect(el(".matchmaking-rooms").classList.contains("hidden")).toBe(true);
    hud.dispose();
  });

  it("never auto-readies: a live room shows an explicit Ready toggle", () => {
    const hud = fixture();
    hud.setMatchmaking(true, 1, 40, 5, "searching", "", "unready");
    expect(el('[data-action="mm-ready"]').classList.contains("hidden")).toBe(false);
    expect(el('[data-action="mm-ready"]').textContent).toContain("Ready up");
    expect(el(".matchmaking-label").textContent).toContain("ready up");
    hud.setMatchmaking(true, 1, 40, 5, "searching", "", "ready");
    expect(el('[data-action="mm-ready"]').textContent).toContain("cancel");
    expect(el(".matchmaking-label").textContent).toContain("6s countdown");
    hud.dispose();
  });

  it("hands the choice to the player when the window elapses", () => {
    const hud = fixture();
    hud.setMatchmaking(true, 0, 40, 0, "waiting", "");
    expect(el(".matchmaking-title").textContent).toContain("No live pilots");
    expect(el(".matchmaking-label").textContent).toContain("The search stays open");
    expect(el('[data-action="mm-ai"]').classList.contains("hidden")).toBe(false);
    expect(el('[data-action="mm-keep-search"]').classList.contains("hidden")).toBe(false);
    expect(el(".matchmaking").classList.contains("is-waiting")).toBe(true);
    hud.dispose();
  });

  it("hides itself completely when a search resolves", () => {
    const hud = fixture();
    hud.setMatchmaking(true, 1, 40, 3, "searching");
    hud.setMatchmaking(false, 0, 40, 0);
    expect(el(".matchmaking").classList.contains("hidden")).toBe(true);
    hud.dispose();
  });
});

describe("coin bonus card layout", () => {
  it("keeps the claim row in CSS so it can wrap on a 360px phone", () => {
    const html = renderCoinMultiplierCard(120, false);
    expect(html).toContain('class="multiplier-cta-card"');
    expect(html).toContain('class="multiplier-cta-text"');
    expect(html).toContain('class="primary-btn gold wide"');
    expect(html).not.toContain("nowrap");
    expect(html).toContain("Claim 3×");
    expect(html).toContain("+● 240");
  });

  it("renders the claimed state as a plain chip with no button", () => {
    const html = renderCoinMultiplierCard(120, true);
    expect(html).toContain("claimed");
    expect(html).toContain("3× bonus applied");
    expect(html).not.toContain("<button");
  });
});
