import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HUD } from "../HUD";

/**
 * HUD teardown is the only thing standing between a long session and a growing
 * DOM. Every toast, overlay and nametag the HUD creates is a real node appended
 * to a container that outlives the screen, so "does dispose() actually take
 * them all with it" is worth asserting rather than reading.
 *
 * This is a leak regression, not a behaviour test: it constructs and disposes
 * the HUD repeatedly and asserts the document does not grow. A missing
 * `remove()`, an un-tracked `setTimeout`, or a listener left on a surviving
 * node all show up as a rising node count.
 */
describe("HUD teardown", () => {
  let parent: HTMLElement;
  const made: HUD[] = [];

  beforeEach(() => {
    // Same stub the sibling HUD suites install; jsdom has no ResizeObserver.
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
      unobserve() {}
    });
    vi.spyOn(performance, "now").mockReturnValue(60_000);
    parent = document.createElement("div");
    document.body.appendChild(parent);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    for (const hud of made.splice(0)) {
      try {
        hud.dispose();
      } catch {
        /* already gone */
      }
    }
    parent.remove();
  });

  it("leaves no nodes behind after dispose", () => {
    for (let i = 0; i < 5; i++) {
      const hud = new HUD(parent);
      made.push(hud);
      hud.dispose();
    }
    // The host is left in place; everything the HUD hung inside it must be gone.
    expect(parent.children.length).toBe(0);
    expect(document.querySelectorAll(".hud-root").length).toBe(0);
  });

  it("does not grow the document across mount/dispose cycles", () => {
    const before = document.querySelectorAll("*").length;
    for (let i = 0; i < 12; i++) {
      const hud = new HUD(parent);
      made.push(hud);
      hud.dispose();
    }
    const after = document.querySelectorAll("*").length;
    // A per-instance constant is fine; a per-cycle one is a leak.
    expect(after - before, "node count grew across mount/dispose cycles").toBeLessThanOrEqual(0);
  });

  it("survives a double dispose", () => {
    const hud = new HUD(parent);
    made.push(hud);
    expect(() => {
      hud.dispose();
      hud.dispose();
    }).not.toThrow();
    expect(parent.children.length).toBe(0);
  });
});
