import { expect, test } from "@playwright/test";
import type { Server } from "node:http";
import { FREEZE, startArtifactServer, stopArtifactServer } from "./visual-helpers";

let server: Server;
let baseUrl: string;
test.beforeAll(async () => { ({ server, baseUrl } = await startArtifactServer()); });
test.afterAll(async () => { await stopArtifactServer(server); });

test("first-visit shop guidance stays readable and compact on phones", async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(baseUrl, { waitUntil: "commit" });
  await expect(page.locator("#boot-shell")).toHaveCount(0, { timeout: 120_000 });
  await expect(page.locator("nav.home-quick-rail")).toBeVisible({ timeout: 120_000 });
  // The decorative onboarding symbol is an SVG, not a font-dependent glyph.
  await expect(page.locator(".onboarding-route-head > span svg")).toHaveCount(1);
  await page.locator('nav.home-quick-rail [data-action="open-shop"]').click();
  const intro = page.locator(".shop-intro-card");
  await expect(intro).toBeVisible();
  await page.addStyleTag({ content: FREEZE });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
    const labels = intro.locator("li b");
    await expect(labels).toHaveCount(3);
    for (const label of await labels.all()) await expect(label).toHaveCSS("display", "inline");
    await expect(intro.locator("small b")).toHaveCSS("display", "inline");
    const foreground = await intro.locator(":scope > b").evaluate(el => getComputedStyle(el).color);
    const channels = foreground.match(/\d+/g)?.map(Number) ?? [];
    expect(channels).toHaveLength(3);
    const luminance = (rgb: number[]) => rgb.map(c => c / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
    // A conservative cream background, darker than the rendered light card.
    const ratio = (luminance([242, 228, 195]) + 0.05) / (luminance(channels) + 0.05);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    await expect(intro).toHaveCSS("text-align", "left");
    await page.screenshot({ path: info.outputPath(`shop-intro-${width}.png`) });
  }
});
