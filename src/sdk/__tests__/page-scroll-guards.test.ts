/**
 * Page-jump prevention — Poki HTML5 doc, final steps.
 *
 * The doc's snippet is unconditional and page-level: swallow ArrowDown, ArrowUp
 * and Space, and `preventDefault()` the wheel, because all four scroll the host
 * page by default and the game is embedded in it. Two things this repo does
 * differently on purpose, both documented in `installPageScrollGuards`:
 *
 *   • a game's own scrollable surfaces (menus, the emote wheel) keep scrolling;
 *   • a focused native control keeps its keys, so space/arrows still activate
 *     buttons — the doc's blunter version would be a keyboard-accessibility
 *     regression.
 *
 * The third case here is the one that regressed silently: the guards were
 * installed from inside `initPlatform`'s continuation, so the whole window
 * between the first interactive frame and the portal handshake — including the
 * menu a player is pressing space on — ran with the page free to scroll.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { installPageScrollGuards } from "../platform";

let detach: (() => void) | null = null;

afterEach(() => {
  detach?.();
  detach = null;
});

function press(key: string, target: EventTarget = document.body): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

function wheel(target: EventTarget = document.body): WheelEvent {
  const event = new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

describe("page scroll guards (Poki: do not let the page jump)", () => {
  it("swallows exactly the keys the doc names", () => {
    detach = installPageScrollGuards();
    for (const key of ["ArrowDown", "ArrowUp", " "]) {
      expect(press(key).defaultPrevented, key).toBe(true);
    }
  });

  it("swallows the wheel too", () => {
    detach = installPageScrollGuards();
    expect(wheel().defaultPrevented).toBe(true);
  });

  it("leaves the page free again once detached", () => {
    const stop = installPageScrollGuards();
    expect(press("ArrowDown").defaultPrevented).toBe(true);
    stop();
    expect(press("ArrowDown").defaultPrevented).toBe(false);
    expect(wheel().defaultPrevented).toBe(false);
  });

  it("does not steal space or arrows from a focused control", () => {
    detach = installPageScrollGuards();
    const button = document.createElement("button");
    document.body.append(button);
    try {
      for (const key of ["ArrowDown", " "]) expect(press(key, button).defaultPrevented, key).toBe(false);
    } finally {
      button.remove();
    }
  });

  it("does not steal arrows from the game's own scrolling surfaces", () => {
    detach = installPageScrollGuards();
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    document.body.append(overlay);
    try {
      expect(press("ArrowDown", overlay).defaultPrevented).toBe(false);
      expect(wheel(overlay).defaultPrevented).toBe(false);
    } finally {
      overlay.remove();
    }
  });
});

describe("the guards are installed before the portal handshake, not after it", () => {
  it("runs installPageScrollGuards ahead of initPlatform in the Game constructor", () => {
    const src = readFileSync(resolve(__dirname, "../../game/Game.ts"), "utf8");

    // The doc's guard is about the page, so it cannot sit behind a third-party
    // CDN round trip: a slow portal script left the opening menu unguarded.
    const guards = src.indexOf("installPageScrollGuards()");
    const init = src.indexOf("initPlatform(");
    expect(guards, "guards must be installed").toBeGreaterThan(-1);
    expect(init, "initPlatform must be called").toBeGreaterThan(-1);
    expect(guards, "guards are installed before the SDK handshake awaits").toBeLessThan(init);
  });
});
