import { afterEach, describe, expect, it, vi } from "vitest";
import { splitLayout, splitViews } from "../Viewport";
import { Game } from "../Game";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("split-screen viewport partition", () => {
  it.each([
    [390, 844, "horizontal"], [768, 1024, "horizontal"],
    [844, 390, "vertical"], [1024, 768, "vertical"],
    [800, 800, "horizontal"], [999, 800, "horizontal"], [1000, 800, "vertical"],
  ] as const)("chooses the same layout at %i × %i", (width, height, layout) => {
    expect(splitLayout(width, height)).toBe(layout);
  });

  it.each([1, 1.25, 1.5, 1.75, 2, 2.625])("covers every physical pixel at DPR %s", dpr => {
    for (const [width, height] of [[393, 853], [853, 393], [768, 1024], [1024, 768], [801, 801]]) {
      // Three.js rounds viewport/scissor components after applying DPR.
      const [p1, p2] = splitViews(width, height, dpr).map(view => ({
        x: Math.round(view.x * dpr), y: Math.round(view.y * dpr),
        width: Math.round(view.width * dpr), height: Math.round(view.height * dpr),
      }));
      const w = Math.floor(width * dpr), h = Math.floor(height * dpr);
      expect(p1.width * p1.height + p2.width * p2.height).toBe(w * h);
      for (const view of [p1, p2]) {
        expect(view.x).toBeGreaterThanOrEqual(0);
        expect(view.y).toBeGreaterThanOrEqual(0);
        expect(view.x + view.width).toBeLessThanOrEqual(w);
        expect(view.y + view.height).toBeLessThanOrEqual(h);
      }
      if (splitLayout(width, height) === "vertical") {
        expect(p1.x).toBe(0);
        expect(p2.x).toBe(p1.width);
        expect(p2.x + p2.width).toBe(w);
        expect(p1.height).toBe(h);
        expect(p2.height).toBe(h);
      } else {
        expect(p2.y).toBe(0);
        expect(p1.y).toBe(p2.height);
        expect(p1.y + p1.height).toBe(h);
        expect(p1.width).toBe(w);
        expect(p2.width).toBe(w);
      }
    }
  });
});

// Exercise the production resize method without constructing a WebGL context.
const resize = (Game.prototype as unknown as { resize(): void }).resize;
function fixture() {
  return {
    disposed: false,
    host: { clientWidth: 390, clientHeight: 844 },
    dpr: 1.5, renderDpr: 0, renderWidth: 0, renderHeight: 0,
    renderer: { setPixelRatio: vi.fn(), setSize: vi.fn() },
    camera: { resize: vi.fn(), setBaseFov: vi.fn() },
    fx: { resize: vi.fn() },
    p1: {}, p2: {}, versus: true,
    input: { splitMode: "off" },
  };
}

describe("rotation resizing", () => {
  it("uses the host, not a keyboard/zoom-reduced visual viewport", () => {
    vi.stubGlobal("visualViewport", { width: 390, height: 240 });
    const game = fixture();
    resize.call(game);
    expect(game.renderer.setSize).toHaveBeenCalledWith(390, 844, false);
    expect(game.camera.resize).toHaveBeenCalledWith(390 / 844);
    expect(game.input.splitMode).toBe("horizontal");
  });

  it("resizes across rotations without reallocating unchanged buffers", () => {
    const game = fixture();
    resize.call(game);
    resize.call(game);
    expect(game.renderer.setSize).toHaveBeenCalledTimes(1);
    game.host = { clientWidth: 844, clientHeight: 390 };
    resize.call(game);
    expect(game.renderer.setSize).toHaveBeenLastCalledWith(844, 390, false);
    expect(game.camera.resize).toHaveBeenLastCalledWith(844 / 390);
    expect(game.input.splitMode).toBe("vertical");
    expect(game.fx.resize).toHaveBeenLastCalledWith(844, 390, 1.5);
    game.dpr = 1;
    resize.call(game);
    expect(game.renderer.setPixelRatio).toHaveBeenLastCalledWith(1);
    expect(game.renderer.setSize).toHaveBeenCalledTimes(3);
  });

  it("ignores transient zero dimensions and late callbacks after disposal", () => {
    const game = fixture();
    game.host.clientHeight = 0;
    resize.call(game);
    game.host.clientHeight = 844;
    game.disposed = true;
    resize.call(game);
    expect(game.renderer.setSize).not.toHaveBeenCalled();
    expect(game.camera.resize).not.toHaveBeenCalled();
  });
});
