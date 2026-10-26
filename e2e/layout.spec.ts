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
    // The clone inherits the live HUD's derived band variables from before the
    // viewport was resized. Recompute them from the clone's own geometry
    // through the shipping `messageBand()`, or this asserts against a stale
    // copy rather than against anything the game produces.
    await app.publishBand();
    await app.expectNoOverlaps([".top-bar > .stat-block", ".stat-block.right", ".sun-meter", ".hud-controls"]);
    await app.expectNoOverlaps([".top-bar", ".mid-meta", ".power-strip", ".roster-bar"]);
    // `.goal-strip` is listed here as well as in the group below, because it is
    // the one lane the altitude gauge actually collides with: the gauge is
    // absolutely positioned down the left edge and the strip is centred, so at
    // 320x568 the gauge's readout sat inside the first goal card and clipped the
    // second. Grouping the strip only with fever/draft/emote compared it against
    // those three and never against the gauge — which is how the collision
    // survived a suite that asserted both elements at five viewports.
    await app.expectNoOverlaps([".hud-header", ".flight-messages", ".toasts", ".flight-footer", ".standings", ".alt-gauge", ".goal-strip"]);
    await app.expectNoOverlaps([".fever-wrap", ".draft-meter", ".emote-wheel"]);
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
