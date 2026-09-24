import { describe, expect, it } from "vitest";
import { PLAY_DESTINATIONS, COLLECTION_DESTINATIONS, PROGRESS_DESTINATIONS } from "../MenuCatalog";
import { menuIcon, menuHorizon } from "../MenuIcons";

const destinations = [...PLAY_DESTINATIONS, ...COLLECTION_DESTINATIONS, ...PROGRESS_DESTINATIONS];
describe("canonical illustrated menu", () => {
  it("gives every destination a distinct, local, decorative illustration", () => {
    expect(new Set(destinations.map(d => d.action)).size).toBe(destinations.length);
    expect(new Set(destinations.map(d => d.icon)).size).toBe(destinations.length);
    for (const item of destinations) {
      const root = document.createElement("div");
      root.innerHTML = menuIcon(item.icon);
      const svg = root.querySelector("svg")!;
      expect(svg.getAttribute("viewBox")).toBe("0 0 64 64");
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
      expect(root.querySelector("path, circle, rect")).not.toBeNull();
      expect(root.querySelector("image, use, foreignObject, script, [id] ")).toBeNull();
    }
  });
  it("keeps the hero horizon decorative and free of particle/animation work", () => {
    const horizon = menuHorizon();
    expect(horizon).toContain('aria-hidden="true"');
    expect(horizon).not.toMatch(/<animate|<image|<filter|<circle/);
  });
});
