import { expect, test } from "@playwright/test";
import { SHAPES, sunbirdSVG } from "../src/game/Sunbird";

// Real SVG geometry, including the extreme canvas-equivalent wing poses. The
// long comet tail used to extend well outside the shared songbird frame.
test("every bird silhouette fits its SVG frame throughout the wingbeat", async ({ page }) => {
  for (const shape of SHAPES) {
    for (const flap of [0, 0.45, 1]) {
      await page.setContent(sunbirdSVG({ shape, flap }));
      const bounds = await page.locator("svg").evaluate((element) => {
        const svg = element as SVGSVGElement;
        const box = svg.getBBox();
        const frame = svg.viewBox.baseVal;
        return { x: box.x, y: box.y, right: box.x + box.width, bottom: box.y + box.height,
          left: frame.x, top: frame.y, frameRight: frame.x + frame.width, frameBottom: frame.y + frame.height };
      });
      expect(bounds.x, `${shape} flap ${flap}: left`).toBeGreaterThanOrEqual(bounds.left);
      expect(bounds.y, `${shape} flap ${flap}: top`).toBeGreaterThanOrEqual(bounds.top);
      expect(bounds.right, `${shape} flap ${flap}: right`).toBeLessThanOrEqual(bounds.frameRight);
      expect(bounds.bottom, `${shape} flap ${flap}: bottom`).toBeLessThanOrEqual(bounds.frameBottom);
    }
  }
});
