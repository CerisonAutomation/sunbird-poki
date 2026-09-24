import { test, expect } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

for (const viewport of [{ width: 1280, height: 800 }, { width: 360, height: 740 }, { width: 320, height: 568 }, { width: 844, height: 390 }, { width: 568, height: 320 }]) {
  test(`HUD lanes do not overlap at ${viewport.width}×${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    const app = new SunbirdPage(page);
    await app.open();
    await app.ready();
    await app.fly();
    await app.layoutFixture(true);
    await app.expectNoOverlaps([".top-bar > .stat-block", ".stat-block.right", ".sun-meter", ".hud-controls"]);
    await app.expectNoOverlaps([".top-bar", ".mid-meta", ".power-strip", ".roster-bar"]);
    await app.expectNoOverlaps([".hud-header", ".flight-messages", ".toasts", ".flight-footer", ".standings", ".alt-gauge"]);
    await app.expectNoOverlaps([".goal-strip", ".fever-wrap", ".draft-meter", ".emote-wheel"]);
    const root = page.locator("#layout-fixture");
    await expect(root.locator(".hint")).toBeVisible();
    await expect(root.locator(".launch-banner")).toBeHidden();
    await expect(root.locator(".goal-pop")).toBeHidden();
    await root.evaluate(el => { (el as HTMLElement).dataset.feedback = "launch"; });
    await expect(root.locator(".hint")).toBeHidden();
    await expect(root.locator(".launch-banner")).toBeVisible();
    await expect(root.locator(".launch-banner")).toHaveCSS("opacity", "1");
    await expect(root.locator(".toasts")).toBeHidden();
    expect(app.errors).toEqual([]);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await page.screenshot({ path: info.outputPath(`hud-${viewport.width}.png`) });
  });
}
