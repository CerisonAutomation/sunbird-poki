import { afterEach, describe, expect, it, vi } from "vitest";
import { OverlayNavigation } from "../OverlayNavigation";
afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

describe("overlay keyboard boundary", () => {
  it("skips closed-disclosure controls even if the browser reports client rects", () => {
    document.body.innerHTML = '<div id="host"><canvas></canvas><div id="hud"><div class="play-hud"></div><div class="overlay"><h2>Settings</h2><button>Back</button><details><summary>Advanced</summary><button>Reset</button></details></div></div></div>';
    const root = document.getElementById("hud")!;
    const overlay = root.querySelector<HTMLElement>(".overlay")!;
    const nav = new OverlayNavigation(root);
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    nav.sync(overlay);
    expect(overlay.getAttribute("role")).toBe("dialog");
    expect(root.querySelector<HTMLElement>(".play-hud")!.inert).toBe(true);
    const summary = overlay.querySelector("summary")!;
    summary.focus();
    summary.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(overlay.querySelector("button"));
    document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(summary);
    nav.sync(null);
    expect(document.activeElement).toBe(document.querySelector("canvas"));
    expect(overlay.inert).toBe(true);
    nav.dispose();
  });
});

/**
 * Poki EN-02: "the space bar or return key for primary menu actions". The
 * overlays focus their heading for screen readers, so a bare Space/Return has
 * no focused button to activate — it must be routed to the primary action
 * without hijacking a control's own behaviour.
 */
describe("primary menu action via Space / Return (Poki EN-02)", () => {
  function overlayFixture() {
    document.body.innerHTML = `
      <div id="hud"><div class="play-hud"></div>
        <div class="overlay">
          <h2 id="title">Settings</h2>
          <button class="soft-btn" id="secondary">Sound</button>
          <button class="primary-btn" id="primary">Fly again</button>
        </div>
      </div>`;
    const root = document.getElementById("hud")!;
    const overlay = root.querySelector<HTMLElement>(".overlay")!;
    const nav = new OverlayNavigation(root);
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    nav.sync(overlay);
    return { root, overlay, nav };
  }

  // Focus-first contract (mirrors e2e input-standards:42): the first bare key
  // moves focus onto the primary without activating it — a stray Space must
  // never launch a race or spend coins in one press — and the press that
  // lands on the now-focused control activates it natively, unhijacked.
  it.each(["Enter", " "])("routes a bare key on the heading onto the primary action (%s)", (keyName) => {
    const { nav } = overlayFixture();
    const primary = document.getElementById("primary")!;
    const clicked = vi.fn();
    primary.addEventListener("click", clicked);
    const title = document.getElementById("title")!;
    title.focus();
    const event = new KeyboardEvent("keydown", { key: keyName, bubbles: true, cancelable: true });
    title.dispatchEvent(event);
    // Focus lands on the primary, the key is consumed, nothing fired yet.
    expect(document.activeElement).toBe(primary);
    expect(event.defaultPrevented).toBe(true);
    expect(clicked).not.toHaveBeenCalled();
    // The press that lands on the focused control is left to native
    // activation: OverlayNavigation must not hijack or prevent it.
    const second = new KeyboardEvent("keydown", { key: keyName, bubbles: true, cancelable: true });
    primary.dispatchEvent(second);
    expect(second.defaultPrevented).toBe(false);
    nav.dispose();
  });

  it("does not hijack a focused control's own activation", () => {
    const { nav } = overlayFixture();
    const secondary = document.getElementById("secondary")!;
    const clicked = vi.fn();
    secondary.addEventListener("click", clicked);
    secondary.focus();
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    secondary.dispatchEvent(event);
    expect(clicked).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    nav.dispose();
  });

  it("ignores key repeats, IME composition and an already-handled event", () => {
    const { nav } = overlayFixture();
    const primary = document.getElementById("primary")!;
    const clicked = vi.fn();
    primary.addEventListener("click", clicked);
    const title = document.getElementById("title")!;
    title.focus();
    title.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", repeat: true, bubbles: true, cancelable: true }));
    title.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true, cancelable: true }));
    const handled = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    handled.preventDefault();
    title.dispatchEvent(handled);
    expect(clicked).not.toHaveBeenCalled();
    nav.dispose();
  });

  it("does nothing when no overlay is open", () => {
    document.body.innerHTML = '<div id="hud"><div class="play-hud"></div></div>';
    const root = document.getElementById("hud")!;
    const nav = new OverlayNavigation(root);
    const button = document.createElement("button");
    button.className = "primary-btn";
    const clicked = vi.fn();
    button.addEventListener("click", clicked);
    root.append(button);
    button.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(clicked).not.toHaveBeenCalled();
    nav.dispose();
  });
});
