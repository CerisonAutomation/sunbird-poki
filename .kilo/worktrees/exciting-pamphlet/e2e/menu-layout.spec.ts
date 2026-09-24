import { test, expect } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

for (const viewport of [{ width: 1280, height: 800 }, { width: 320, height: 568 }, { width: 568, height: 320 }]) {
  test(`menu launch and settings fit at ${viewport.width}×${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    const app = new SunbirdPage(page);
    await app.open(); await app.ready();
    await app.expectMenuFits();
    const brand = await page.locator(".menu-hero h1").evaluate(el => {
      const style = getComputedStyle(el); return { weight: style.fontWeight, color: style.color };
    });
    expect(brand.weight).toBe("500");
    expect(brand.color).toBe("rgb(255, 122, 69)"); // Current coral brand in menu-polish.css.
    await app.expectNoOverlaps([".hero-sun-wrap", ".menu-mute"], '[data-ref="menuCard"]');
    await expect(page.getByRole("button", { name: "Play free flight now", exact: true })).toBeInViewport({ ratio: 1 });
    await expect(page.locator('details[data-ref="homeMore"]')).toHaveCount(0);
    await expect(page.locator('[data-action="versus"]')).toBeVisible();
    await page.screenshot({ path: info.outputPath(`home-${viewport.width}.png`) });
    await app.openMenu("open-settings", "Settings");
    await app.expectMenuFits();
    const card = page.locator('[data-ref="menuCard"]');
    const sizes = await card.locator(".toggle").evaluateAll(buttons => buttons.map(el => {
      const r = el.getBoundingClientRect(); return { width: r.width, height: r.height };
    }));
    for (const size of sizes) { expect(size.width).toBeGreaterThanOrEqual(44); expect(size.height).toBeGreaterThanOrEqual(44); }
    await card.getByRole("button", { name: "Large text", exact: true }).click();
    await app.expectMenuFits();
    await card.evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: info.outputPath(`settings-${viewport.width}.png`) });
    expect(app.errors).toEqual([]);
  });
}
