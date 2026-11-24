import { expect, test } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

for (const width of [320, 390]) {
  test(`progress pills and career label remain visible at ${width}px`, async ({ page }) => {
    await page.route("https://game-cdn.poki.com/scripts/v2/poki-sdk.js", route =>
      route.fulfill({ contentType: "application/javascript", body: "" }));
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const app = new SunbirdPage(page);
    await app.open();
    await app.ready();
    await page.locator('nav.progress-destinations [data-action="open-progress"]').click();
    const card = page.locator('[data-ref="menuCard"]');
    await expect(card.locator(".screen-head h2")).toHaveText("Your progress");
    const geometry = await card.evaluate(el => {
      const cardBox = el.getBoundingClientRect();
      const pills = [...el.querySelectorAll(".hero-meta .pill")].map(p => {
        const box = p.getBoundingClientRect();
        return { left: box.left, right: box.right };
      });
      const label = el.querySelector<HTMLElement>(".wings-track span")!;
      const track = label.parentElement!;
      return { left: cardBox.left, right: cardBox.right, pills,
        overflow: getComputedStyle(track).overflowY, label: label.getBoundingClientRect().toJSON(),
        track: track.getBoundingClientRect().toJSON(), text: label.textContent };
    });
    for (const pill of geometry.pills) {
      expect(pill.left).toBeGreaterThanOrEqual(geometry.left);
      expect(pill.right).toBeLessThanOrEqual(geometry.right);
    }
    expect(geometry.text).toContain("to ");
    expect(geometry.overflow).toBe("visible");
    expect(geometry.label.top).toBeGreaterThanOrEqual(geometry.track.bottom);
  });
}

test("mode selection and race customization use vector indicators", async ({ page }) => {
  await page.route("https://game-cdn.poki.com/scripts/v2/poki-sdk.js", route =>
    route.fulfill({ contentType: "application/javascript", body: "" }));
  const app = new SunbirdPage(page);
  await app.open(); await app.ready();
  await app.openMenu("mode-select", "Game modes");
  await expect(page.locator(".mode-card.on .mode-check svg")).toBeVisible();
  await app.backHome();
  await app.openMenu("open-live", "Race Lobby");
  const marker = await page.locator(".customize-race summary").evaluate(el => {
    const before = getComputedStyle(el, "::before");
    return { content: before.content, border: before.borderRightWidth };
  });
  expect(marker.content).toBe('""');
  expect(marker.border).toBe("2px");
});

for (const motion of ["no-preference", "reduce"] as const) {
  test(`short cards do not fade out their final content (${motion})`, async ({ page }) => {
  await page.route("https://game-cdn.poki.com/scripts/v2/poki-sdk.js", route =>
    route.fulfill({ contentType: "application/javascript", body: "" }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: motion });
  const app = new SunbirdPage(page);
  await app.open(); await app.ready();
  await app.openMenu("open-scores", "Your scores");
  const card = page.locator('[data-ref="menuCard"]');
  const state = await card.evaluate(el => ({
    scrollHeight: el.scrollHeight, clientHeight: el.clientHeight,
    mask: getComputedStyle(el).maskImage,
  }));
  expect(state.scrollHeight).toBeLessThanOrEqual(state.clientHeight + 1);
  // Chromium may resolve an inactive/end-of-scroll timeline to an opaque
  // gradient rather than "none"; both leave the bottom fully visible.
  expect(["none", "linear-gradient(rgb(0, 0, 0) 100%, rgb(0, 0, 0) 100%)"]).toContain(state.mask);
  });
}
