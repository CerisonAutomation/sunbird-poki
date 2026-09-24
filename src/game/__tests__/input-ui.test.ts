import { afterEach, describe, expect, it, vi } from "vitest";
import { Input } from "../Input";
let input: Input | undefined;
afterEach(() => { input?.dispose(); vi.restoreAllMocks(); document.body.innerHTML = ""; });
function fixture(mark = vi.fn()) {
  const host = document.createElement("div");
  document.body.append(host);
  input = new Input(host, mark);
  return { host, input, mark };
}
function key(el: Element, code: string, type = "keydown") {
  const event = new KeyboardEvent(type, { code, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}
describe("native menu keyboard input", () => {
  it.each(["button", "summary", "input", "select", "textarea", "a"])("does not steal Space or Enter from %s", tag => {
    const { host, input, mark } = fixture();
    const el = document.createElement(tag);
    host.append(el);
    for (const code of ["Space", "Enter"]) {
      expect(key(el, code).defaultPrevented).toBe(false);
      expect(key(el, code, "keyup").defaultPrevented).toBe(false);
    }
    expect(input.p2Key).toBe(false);
    expect(mark).not.toHaveBeenCalled();
  });
  it("retains gameplay keys on the scene and clears a key released after focus changes", () => {
    const { host, input, mark } = fixture();
    expect(key(host, "Space").defaultPrevented).toBe(true);
    expect(mark).toHaveBeenCalledOnce();
    const field = document.createElement("input");
    host.append(field);
    key(field, "Space", "keyup");
    key(host, "Enter");
    expect(input.p2Key).toBe(true);
    key(field, "Enter", "keyup");
    expect(input.p2Key).toBe(false);
  });
  it("keeps Escape available on a menu button", () => {
    const { host, input } = fixture();
    const button = document.createElement("button");
    host.append(button);
    key(button, "Escape");
    expect(input.pausePressed).toBe(true);
  });
});


it.each(["start", "retry"])("does not capture the pointer for %s buttons", action => {
  const { host, mark } = fixture();
  const button = document.createElement("button");
  button.dataset.action = action;
  button.innerHTML = '<svg><path d="M0 0"/></svg>';
  host.append(button);
  const event = new MouseEvent("pointerdown", { bubbles: true, cancelable: true });
  button.querySelector("path")!.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
  expect(mark).not.toHaveBeenCalled();
});

it("supports independent A/L keys, held aliases, and blur recovery", () => {
  const { host, input } = fixture();
  key(host, "KeyA"); key(host, "KeyL");
  expect(input.diving).toBe(true); expect(input.diving2).toBe(true);
  key(host, "Space"); key(host, "KeyA", "keyup");
  expect(input.diving).toBe(true);
  key(host, "KeyL", "keyup"); expect(input.diving2).toBe(false);
  window.dispatchEvent(new Event("blur")); expect(input.diving).toBe(false);
});

it.each(["vertical", "horizontal"] as const)("routes simultaneous touch independently in %s split", splitMode => {
  const { host, input } = fixture();
  input.splitMode = splitMode;
  vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 400, height: 600 } as DOMRect);
  const point = (id: number, x: number, y: number, type: string) => {
    const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
    Object.defineProperty(event, "pointerId", { value: id });
    host.dispatchEvent(event);
  };
  point(1, 60, 100, "pointerdown");
  point(2, 320, 500, "pointerdown");
  expect(input.diving).toBe(true); expect(input.diving2).toBe(true);
  point(1, 60, 100, "pointercancel");
  expect(input.diving).toBe(false); expect(input.diving2).toBe(true);
  point(2, 320, 500, "pointerup"); expect(input.diving2).toBe(false);
});

describe("mobile touchscreen responsiveness and gesture protection", () => {
  it("prevents default on touchstart for gameplay area to eliminate scroll/pinch latency", () => {
    const { host, mark } = fixture();
    const event = new Event("touchstart", { bubbles: true, cancelable: true });
    host.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(mark).toHaveBeenCalledOnce();
  });

  it("permits default touchstart on interactive text inputs", () => {
    const { host } = fixture();
    const inputField = document.createElement("input");
    host.append(inputField);
    const event = new Event("touchstart", { bubbles: true, cancelable: true });
    inputField.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("spawns a touch ripple on pointerdown for immediate visual touch feedback", () => {
    const { host } = fixture();
    const event = new MouseEvent("pointerdown", { bubbles: true, cancelable: true, clientX: 120, clientY: 240 });
    Object.defineProperty(event, "pointerId", { value: 1 });
    host.dispatchEvent(event);
    const ripple = document.querySelector(".touch-ripple");
    expect(ripple).not.toBeNull();
    expect((ripple as HTMLElement).style.left).toBe("120px");
    expect((ripple as HTMLElement).style.top).toBe("240px");
  });

  it("triggers boost on intentional quick double-tap", () => {
    const { host, input } = fixture();
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);

    const point = (type: string, clientX = 100, clientY = 100) => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });
      Object.defineProperty(event, "pointerId", { value: 1 });
      if (type === "pointerdown") host.dispatchEvent(event);
      else window.dispatchEvent(event);
    };

    // First tap: quick tap (down at 1000, up at 1080 -> 80ms duration)
    point("pointerdown");
    expect(input.diving).toBe(true);
    now = 1080;
    point("pointerup");
    expect(input.diving).toBe(false);
    expect(input.consumeBoost()).toBe(false);

    // Second tap: arrives 120ms later (at 1200) within 280ms
    now = 1200;
    point("pointerdown");
    expect(input.consumeBoost()).toBe(true);
  });

  it("does NOT trigger boost on rhythmic slope diving / pump dives longer than 220ms", () => {
    const { host, input } = fixture();
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);

    const point = (type: string, clientX = 100, clientY = 100) => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });
      Object.defineProperty(event, "pointerId", { value: 1 });
      if (type === "pointerdown") host.dispatchEvent(event);
      else window.dispatchEvent(event);
    };

    // First dive: held down on slope for 400ms (1000 to 1400)
    point("pointerdown");
    expect(input.diving).toBe(true);
    now = 1400;
    point("pointerup");
    expect(input.diving).toBe(false);
    expect(input.consumeBoost()).toBe(false);

    // Second dive: tap arrives 100ms later on next slope crest
    now = 1500;
    point("pointerdown");
    // Because the first dive was a sustained slope carve (> 220ms), boost must NOT be accidentally consumed!
    expect(input.consumeBoost()).toBe(false);
  });

  it("captures pointerdown anywhere across window for full-screen touch responsiveness", () => {
    const { input } = fixture();
    const event = new MouseEvent("pointerdown", { bubbles: true, cancelable: true, clientX: 50, clientY: 50 });
    Object.defineProperty(event, "pointerId", { value: 7 });
    window.dispatchEvent(event);
    expect(input.diving).toBe(true);
    const upEvent = new MouseEvent("pointerup", { bubbles: true, cancelable: true });
    Object.defineProperty(upEvent, "pointerId", { value: 7 });
    window.dispatchEvent(upEvent);
    expect(input.diving).toBe(false);
  });

  it("triggers boost on upward flick / swipe-up gesture", () => {
    const { host, input } = fixture();
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);

    const down = new MouseEvent("pointerdown", { bubbles: true, cancelable: true, clientX: 150, clientY: 300 });
    Object.defineProperty(down, "pointerId", { value: 3 });
    host.dispatchEvent(down);
    expect(input.diving).toBe(true);

    now = 1150; // 150ms flick duration
    const up = new MouseEvent("pointerup", { bubbles: true, cancelable: true, clientX: 155, clientY: 240 }); // dy = -60px
    Object.defineProperty(up, "pointerId", { value: 3 });
    window.dispatchEvent(up);

    expect(input.diving).toBe(false);
    expect(input.consumeBoost()).toBe(true);
  });

  it("spawns player-specific touch ripples in split-screen mode", () => {
    const { host, input } = fixture();
    input.splitMode = "vertical";
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 400, height: 600 } as DOMRect);

    // P1 touch on left half
    const p1Down = new MouseEvent("pointerdown", { bubbles: true, cancelable: true, clientX: 100, clientY: 200 });
    Object.defineProperty(p1Down, "pointerId", { value: 10 });
    host.dispatchEvent(p1Down);

    const p1Ripple = document.querySelector(".touch-ripple.p1");
    expect(p1Ripple).not.toBeNull();

    // P2 touch on right half
    const p2Down = new MouseEvent("pointerdown", { bubbles: true, cancelable: true, clientX: 300, clientY: 200 });
    Object.defineProperty(p2Down, "pointerId", { value: 11 });
    host.dispatchEvent(p2Down);

    const p2Ripple = document.querySelector(".touch-ripple.p2");
    expect(p2Ripple).not.toBeNull();
  });
});

/**
 * Poki EN-02: "use WASD or arrow keys for movement and the space bar or return
 * key for primary menu actions". This game's single movement control is the
 * dive/hold action, so both clusters must drive it — and the arrow cluster must
 * not scroll the host page inside an embedded portal frame.
 */
describe("standardised movement keys (Poki EN-02)", () => {
  it.each(["Space", "KeyA", "KeyW", "KeyS", "KeyD", "ArrowUp", "ArrowDown"])(
    "accepts %s as the dive / primary action",
    (code) => {
      const { host, input, mark } = fixture();
      const event = key(host, code);
      expect(event.defaultPrevented).toBe(true);
      expect(input.diving).toBe(true);
      expect(mark).toHaveBeenCalledOnce();
      key(host, code, "keyup");
      expect(input.diving).toBe(false);
    },
  );

  it("releases the action only when every held alias is up", () => {
    const { host, input } = fixture();
    key(host, "KeyW");
    key(host, "ArrowDown");
    key(host, "KeyW", "keyup");
    expect(input.diving).toBe(true);
    key(host, "ArrowDown", "keyup");
    expect(input.diving).toBe(false);
  });

  it("keeps Return as the second player's standard confirm key", () => {
    const { host, input } = fixture();
    key(host, "Enter");
    expect(input.p2Key).toBe(true);
    key(host, "Enter", "keyup");
    expect(input.p2Key).toBe(false);
  });

  it("never steals the standard keys from a focused menu control", () => {
    const { host } = fixture();
    const button = document.createElement("button");
    host.append(button);
    for (const code of ["Space", "Enter", "KeyW", "ArrowDown"]) {
      expect(key(button, code).defaultPrevented).toBe(false);
    }
  });
});

describe("orientation and cancelled touch recovery", () => {
  function point(host: HTMLElement, id: number, type: string, x: number, y: number) {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
    Object.defineProperty(event, "pointerId", { value: id });
    host.dispatchEvent(event);
  }

  it("releases old split touches on rotation and routes fresh ones to the new halves", () => {
    const { host, input } = fixture();
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ left: 20, top: 30, width: 800, height: 400 } as DOMRect);
    input.splitMode = "vertical";
    point(host, 1, "pointerdown", 100, 100);
    point(host, 2, "pointerdown", 700, 100);
    input.splitMode = "vertical"; // Duplicate resize must not release active input.
    expect(input.diving).toBe(true);
    expect(input.diving2).toBe(true);
    input.splitMode = "horizontal";
    expect(input.diving).toBe(false);
    expect(input.diving2).toBe(false);
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ left: 20, top: 30, width: 400, height: 800 } as DOMRect);
    point(host, 1, "pointerup", 100, 40); // Old-orientation release is not a flick.
    expect(input.consumeBoost()).toBe(false);
    point(host, 3, "pointerdown", 100, 700);
    expect(input.diving).toBe(false);
    expect(input.diving2).toBe(true);
    point(host, 4, "pointerdown", 100, 100);
    expect(input.diving).toBe(true);
    point(host, 3, "pointercancel", 100, 100);
    expect(input.diving).toBe(true);
    expect(input.diving2).toBe(false);
  });

  it("does not interpret a cancelled pointer or a menu release as a boost", () => {
    const { host, input } = fixture();
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    point(host, 1, "pointerdown", 150, 300);
    now += 100;
    point(host, 1, "pointercancel", 150, 200);
    expect(input.diving).toBe(false);
    expect(input.consumeBoost()).toBe(false);
    now += 100;
    point(host, 2, "pointerdown", 150, 300);
    expect(input.consumeBoost()).toBe(false); // Not the second tap of a double-tap.
    point(host, 99, "pointerup", 150, 100); // Never tracked (e.g. a UI button).
    expect(input.consumeBoost()).toBe(false);
    expect(input.diving).toBe(true);
  });

  it("preserves keyboard holds when the touch layout changes", () => {
    const { host, input } = fixture();
    key(host, "Space");
    key(host, "KeyL");
    input.splitMode = "horizontal";
    input.splitMode = "vertical";
    expect(input.diving).toBe(true);
    expect(input.diving2).toBe(true);
    key(host, "Space", "keyup");
    key(host, "KeyL", "keyup");
    expect(input.diving).toBe(false);
    expect(input.diving2).toBe(false);
  });
});

/**
 * A menu overlay owns its own gestures.
 *
 * Regression cover for the two mobile breakages this caused: cancelling
 * `touchstart`/`touchmove` anywhere outside a `<button>` stopped Chromium from
 * ever handing the pan to its compositor thread (the shop card measured 0px of
 * a 1340px scroll range), and cancelling `touchstart` also suppressed the
 * compatibility `click` that dismisses a backdrop tap or resumes from pause —
 * neither of which is a `<button>`.
 */
describe("menu overlays keep native scrolling and tapping", () => {
  /** host > .overlay > .paper-card > child, mirroring the real HUD tree. */
  function overlayFixture(childTag = "div", mark = vi.fn()) {
    const { host, input } = fixture(mark);
    const overlay = document.createElement("div");
    overlay.className = "overlay menu";
    const card = document.createElement("div");
    card.className = "paper-card";
    const child = document.createElement(childTag);
    card.append(child);
    overlay.append(card);
    host.append(overlay);
    return { host, input, overlay, card, child, mark };
  }
  const touch = (el: Element, type: string) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    return event;
  };
  const pointer = (el: Element, type: string, x = 100, y = 200, id = 1) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
    Object.defineProperty(event, "pointerId", { value: id });
    (type === "pointerdown" ? el : window).dispatchEvent(event);
    return event;
  };

  it.each(["touchstart", "touchmove"])("never cancels %s inside an overlay, so the card can pan", type => {
    const { child, card, overlay } = overlayFixture();
    for (const el of [child, card, overlay]) expect(touch(el, type).defaultPrevented).toBe(false);
  });

  it("still cancels touch on the bare gameplay surface", () => {
    const { host } = fixture();
    expect(touch(host, "touchstart").defaultPrevented).toBe(true);
    expect(touch(host, "touchmove").defaultPrevented).toBe(true);
  });

  it("honours data-scroll-surface as the escape hatch for a scroller outside an overlay", () => {
    const { host } = fixture();
    const rail = document.createElement("div");
    rail.dataset.scrollSurface = "true";
    const inner = document.createElement("div");
    rail.append(inner);
    host.append(rail);
    expect(touch(inner, "touchstart").defaultPrevented).toBe(false);
    expect(touch(inner, "touchmove").defaultPrevented).toBe(false);
  });

  it.each([".emote-wheel"])("leaves the in-flight %s rail scrollable", sel => {
    const { host } = fixture();
    const rail = document.createElement("div");
    rail.className = sel.slice(1);
    const gap = document.createElement("span");
    rail.append(gap);
    host.append(rail);
    expect(touch(gap, "touchstart").defaultPrevented).toBe(false);
    expect(pointer(gap, "pointerdown").defaultPrevented).toBe(false);
  });

  it("does not arm a dive, a boost or a gameplay ripple from a touch on a menu", () => {
    const { child, input } = overlayFixture();
    pointer(child, "pointerdown");
    expect(input.diving).toBe(false);
    expect(document.querySelector(".touch-ripple")).toBeNull();
    pointer(child, "pointerup");
    expect(input.consumeBoost()).toBe(false);
  });

  it("does not read a double-tap on a menu as the boost gesture", () => {
    const { child, input } = overlayFixture();
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    pointer(child, "pointerdown", 100, 200, 1);
    now = 1080;
    pointer(child, "pointerup", 100, 200, 1);
    now = 1200;
    pointer(child, "pointerdown", 104, 204, 2);
    expect(input.consumeBoost()).toBe(false);
  });

  it("does not read an upward flick on a menu as the boost gesture", () => {
    const { child, input } = overlayFixture();
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    pointer(child, "pointerdown", 150, 300, 3);
    now = 1150;
    pointer(child, "pointerup", 155, 240, 3);
    expect(input.consumeBoost()).toBe(false);
  });

  it("still counts a menu touch as the first gesture, so audio unlocks on touch-only devices", () => {
    const { child, mark } = overlayFixture("div", vi.fn());
    pointer(child, "pointerdown");
    expect(mark).toHaveBeenCalledOnce();
  });

  it("keeps the dive alive on the gameplay surface either side of an overlay", () => {
    const { host, child, input } = overlayFixture();
    pointer(host, "pointerdown", 10, 10, 5);
    expect(input.diving).toBe(true);
    pointer(child, "pointerdown", 100, 200, 6); // menu touch is ignored entirely
    expect(input.diving).toBe(true);
    pointer(child, "pointerup", 100, 200, 6);
    expect(input.diving).toBe(true); // and must not release the real hold
    pointer(host, "pointerup", 10, 10, 5);
    expect(input.diving).toBe(false);
  });

  it("positive control: the gameplay surface still dives and still shows the ripple", () => {
    // Guards the overlay tests above from passing for the wrong reason (e.g. a
    // guard so broad that no touch anywhere arms the dive any more).
    const { host, input } = overlayFixture();
    pointer(host, "pointerdown", 40, 60, 8);
    expect(input.diving).toBe(true);
    const ripple = document.querySelector(".touch-ripple");
    expect(ripple).not.toBeNull();
    expect((ripple as HTMLElement).style.left).toBe("40px");
  });
});
