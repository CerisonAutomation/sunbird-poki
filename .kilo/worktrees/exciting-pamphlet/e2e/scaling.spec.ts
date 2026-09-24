import { test, expect } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

/**
 * Poki's Web-fit scaling contract (developers.poki.com/guide/requirements-quality):
 * the game must scale to cover the full canvas at 640x360, 836x470 and
 * 1031x580, plus phone form factors. The Inspector runs its own visual pass,
 * but these sizes must not break layout or JS in CI either.
 */
const SIZES: { name: string; width: number; height: number }[] = [
  { name: "640x360 (Poki min scaling)", width: 640, height: 360 },
  { name: "836x470 (Poki mid scaling)", width: 836, height: 470 },
  { name: "1031x580 (Poki max scaling)", width: 1031, height: 580 },
  { name: "phone landscape", width: 844, height: 390 },
  { name: "phone portrait", width: 390, height: 844 },
  { name: "small phone portrait", width: 320, height: 568 },
  { name: "small phone landscape", width: 568, height: 320 },
  { name: "tablet portrait", width: 768, height: 1024 },
  { name: "tablet landscape", width: 1024, height: 768 },
];

for (const size of SIZES) {
  test.describe(`covers the full canvas at ${size.name} without errors`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    test("passes layout and canvas coverage checks", async ({ page }) => {
      test.setTimeout(120000);
      const app = new SunbirdPage(page);
      await app.open();
      await app.ready();

      // The canvas must cover the entire viewport — no letterbox, no gap.
      const cover = await page.evaluate(() => {
        const canvas = document.querySelector("canvas");
        if (!canvas) return { w: 0, h: 0 };
        const r = canvas.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      });
      expect(cover.w, "canvas width covers the viewport").toBeGreaterThanOrEqual(size.width);
      expect(cover.h, "canvas height covers the viewport").toBeGreaterThanOrEqual(size.height);

      // Check bounds and overflow, not just visibility behind a clipped card.
      await app.expectMenuFits();
      await expect(page.locator('[data-ref="menuCard"] h1')).toBeVisible();
      await expect(page.locator('[data-action="open-live"]')).toBeVisible();

      // A race lobby must also fit (the densest screen).
      await app.openMenu("open-live", "Race Lobby");
      await expect(page.locator('[data-action="quick-match-instant"]')).toBeVisible();
      await app.expectMenuFits();

      expect(app.errors).toEqual([]);
    });
  });
}
