import { test, expect } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

for (const viewport of [{ width: 1280, height: 800 }, { width: 320, height: 568 }, { width: 390, height: 844 }, { width: 568, height: 320 }]) {
  test(`menu launch and settings fit at ${viewport.width}×${viewport.height}`, async ({ page }, info) => {
    // This layout test runs offline in CI. Stub the optional portal script
    // rather than depending on CDN access (the game falls back without it).
    await page.route("https://game-cdn.poki.com/scripts/v2/poki-sdk.js", route =>
      route.fulfill({ contentType: "application/javascript", body: "" }));
    await page.setViewportSize(viewport);
    // Measure a settled layout, not an entrance animation. The overlay animates
    // in, and a `getBoundingClientRect` taken mid-flight reads a control smaller
    // than its CSS box (a 44x44 toggle measured 42.68). The shipping CSS honours
    // prefers-reduced-motion by zeroing overlay animation/transition, so asking
    // for it makes the geometry deterministic and the 44px target assertion
    // about the control's real size rather than the frame we happened to sample.
    await page.emulateMedia({ reducedMotion: "reduce" });
    const app = new SunbirdPage(page);
    await app.open(); await app.ready();
    await app.expectMenuFits();
    // The menu can re-render after boot; poll the live element rather than
    // measuring a detached node between rendering and style calculation.
    await expect(page.locator(".menu-hero h1")).toHaveCSS("font-weight", "500");
    await expect(page.locator(".menu-hero h1")).toHaveCSS("color", "rgb(255, 122, 69)");
    await app.expectNoOverlaps([".hero-sun-wrap", ".menu-mute"], '[data-ref="menuCard"]');
    // Overlap alone does not say which element the finger reaches. The mute
    // toggle shared its top row with a sticky, opaque status bar and was
    // painted over by it — the boxes overlapped, which the assertion above is
    // happy with, while the lower 60% of the button took no input at any of
    // these viewports. Hit-testing is the only check that can see that.
    await app.expectControlsHitTestable();
    await expect(page.getByRole("button", { name: "Fly now", exact: true })).toBeInViewport({ ratio: 1 });
    if (viewport.width <= 390) {
      const launch = page.locator(".home-launch");
      const loadout = page.locator(".loadout-quick");
      const geometry = await launch.evaluate(el => {
        const button = el.getBoundingClientRect();
        const label = el.querySelector(".launch-copy b")!;
        const range = document.createRange(); range.selectNodeContents(label);
        return { width: button.width, labelLines: range.getClientRects().length, bottom: button.bottom };
      });
      expect(geometry.width).toBeGreaterThan(200);
      expect(geometry.labelLines).toBe(1);
      expect((await loadout.boundingBox())!.y).toBeGreaterThanOrEqual(geometry.bottom);
    }
    await expect(page.locator('details[data-ref="homeMore"]')).toHaveCount(0);
    await expect(app.menuAction("versus")).toBeVisible();
    await page.screenshot({ path: info.outputPath(`home-${viewport.width}.png`) });
    await app.openMenu("open-settings", "Settings");
    await app.expectMenuFits();
    await app.expectControlsHitTestable();
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
