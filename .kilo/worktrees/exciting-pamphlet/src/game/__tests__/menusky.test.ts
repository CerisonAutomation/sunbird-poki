import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MenuSky } from "../MenuSky";

/**
 * The main-screen background regression guard.
 *
 * The menu sky is a 2D canvas behind the translucent paper card: a painted
 * gradient sky, drifting cloud bands, hill silhouettes, the flock — and the
 * hero-bird canvas above the card. A blank canvas in ANY of these layers
 * makes the whole title screen read as a dead, flat background (the exact
 * class of bug this suite pins). jsdom has no canvas implementation, so the
 * 2D context is mocked with a call recorder: the assertions are about what
 * the code DRAWS, not about pixels.
 */

type CtxCall = { method: string; args: unknown[] };

// jsdom has no Path2D; MenuSky caches hill silhouettes as Path2D objects.
// A no-op stub is enough — the recorded 2D calls are what the test asserts.
class Path2DStub {
  moveTo(): void {}
  lineTo(): void {}
  quadraticCurveTo(): void {}
  bezierCurveTo(): void {}
  closePath(): void {}
}
const g = globalThis as Record<string, unknown>;
if (typeof g.Path2D === "undefined") g.Path2D = Path2DStub;

function makeCtxMock(): { ctx: CanvasRenderingContext2D; calls: CtxCall[] } {
  const calls: CtxCall[] = [];
  const gradient = { addColorStop: () => undefined };
  const target: Record<string, unknown> = {
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => ({}),
  };
  const proxy = new Proxy(target, {
    get(t, prop) {
      if (typeof prop === "string" && prop in t) return t[prop];
      if (typeof prop === "string") {
        return (...args: unknown[]) => {
          calls.push({ method: prop, args });
        };
      }
      return undefined;
    },
    set() {
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx: proxy, calls };
}

let mocks: { ctx: CanvasRenderingContext2D; calls: CtxCall[] }[];
let getCtxSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mocks = [];
  getCtxSpy = vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockImplementation(function (this: HTMLCanvasElement) {
      const m = makeCtxMock();
      mocks.push(m);
      return m.ctx;
    }) as never;
});

afterEach(() => {
  getCtxSpy.mockRestore();
});

/** Call names made against the given canvas mock. */
function methodsOf(mockIndex: number): string[] {
  return mocks[mockIndex].calls.map(c => c.method);
}

describe("MenuSky — the main-screen background must actually paint", () => {
  it("paints the full-viewport sky on first draw (no blank background)", () => {
    const sky = new MenuSky();
    sky.resize(1280, 800);
    // The sky canvas is the FIRST canvas created (host canvas).
    const skyCalls = methodsOf(0);
    expect(skyCalls).toContain("setTransform");
    // The gradient sky fillRect must cover the whole viewport.
    const fillRects = mocks[0].calls.filter(c => c.method === "fillRect");
    expect(fillRects.length).toBeGreaterThan(0);
    const full = fillRects.find(c => c.args[0] === 0 && c.args[1] === 0 && c.args[2] === 1280 && c.args[3] === 800);
    expect(full).toBeTruthy();
  });

  it("paints the hero bird on the hero layer (the layer that used to be permanently blank)", () => {
    const sky = new MenuSky();
    sky.resize(1280, 800);
    // The hero canvas is the SECOND canvas created.
    const heroCalls = methodsOf(1);
    expect(heroCalls).toContain("clearRect");
    // A bird draw requires a transform (translate) — a blank hero canvas
    // only ever recorded clearRect (or nothing).
    expect(heroCalls).toContain("translate");
  });

  it("activating the menu turns the layers on and keeps drawing", () => {
    const sky = new MenuSky();
    sky.resize(1280, 800);
    const before = mocks[0].calls.length;
    sky.setActive(true);
    expect(sky.host.classList.contains("on")).toBe(true);
    expect(sky.heroHost.classList.contains("on")).toBe(true);
    // setActive draws an immediate frame — the sky canvas got new work.
    expect(mocks[0].calls.length).toBeGreaterThan(before);
    sky.setActive(false);
    expect(sky.host.classList.contains("on")).toBe(false);
  });

  it("a resize to a new size repaints with the new dimensions (no stale/blank frame)", () => {
    const sky = new MenuSky();
    sky.resize(800, 600);
    sky.resize(1024, 768);
    const fillRects = mocks[0].calls.filter(c => c.method === "fillRect");
    const fullNew = fillRects.find(c => c.args[2] === 1024 && c.args[3] === 768);
    expect(fullNew).toBeTruthy();
  });

  it("disposal removes both layers from the DOM", () => {
    const sky = new MenuSky();
    document.body.appendChild(sky.host);
    document.body.appendChild(sky.heroHost);
    expect(document.body.contains(sky.host)).toBe(true);
    sky.dispose();
    expect(document.body.contains(sky.host)).toBe(false);
    expect(document.body.contains(sky.heroHost)).toBe(false);
  });
});
