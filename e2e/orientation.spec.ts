import { test, expect, type Page } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

async function expectViewportFits(page: Page): Promise<void> {
  const viewport = page.viewportSize()!;
  await expect.poll(() => page.locator(".game-root > canvas").evaluate(canvas => {
    const rect = canvas.getBoundingClientRect();
    const buffer = canvas as HTMLCanvasElement;
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      // Check the WebGL buffer too: CSS alone can stretch a stale frame.
      aspect: Math.round(buffer.width / buffer.height * 100),
    };
  })).toEqual({
    ...viewport,
    aspect: Math.round(viewport.width / viewport.height * 100),
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  // Visibility assertions alone miss an opaque pseudo-element covering the UI.
  for (const pseudo of ["::before", "::after"]) {
    expect(await page.evaluate(pseudo => getComputedStyle(document.body, pseudo).content, pseudo)).toBe("none");
  }
}

test("installed app permits both orientations", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  expect((await response.json()).orientation).toBe("any");
});

test("portrait and landscape remain playable when rotating during a flight", async ({ page }, info) => {
  const portrait = { width: 390, height: 844 };
  const landscape = { width: 844, height: 390 };
  await page.setViewportSize(portrait);
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await app.expectMenuFits();
  await expectViewportFits(page);
  // Exercise real touch input in the mobile project, not just DOM visibility.
  const play = page.getByRole("button", { name: "Play free flight now", exact: true });
  if (info.project.name === "phone") await play.tap();
  else await play.click();
  await expect(page.locator(".hud-root")).toHaveAttribute("data-ui-state", "playing");
  const canvas = await page.locator(".game-root > canvas").elementHandle();

  for (const viewport of [landscape, portrait]) {
    await page.setViewportSize(viewport);
    // Also exercise browsers which emit orientationchange before a late resize.
    await page.evaluate(() => window.dispatchEvent(new Event("orientationchange")));
    await expectViewportFits(page);
    await expect(page.locator(".hud-root")).toHaveAttribute("data-ui-state", "playing");
    await app.expectNoOverlaps([".top-bar > .stat-block", ".stat-block.right", ".sun-meter", ".hud-controls"], ".hud-root");
    await app.pause();
    await app.resume();
  }
  // Rotation resizes the existing game rather than replacing/restarting it.
  expect(await canvas!.evaluate(el => el === document.querySelector(".game-root > canvas"))).toBe(true);
  await app.pause();
  await page.setViewportSize(landscape);
  await expectViewportFits(page);
  await expect(page.locator(".hud-root")).toHaveAttribute("data-ui-state", "paused");
  await app.resume();
  expect(app.errors).toEqual([]);
});

test("local split-screen divider and controls follow phone and tablet rotation", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await page.locator('[data-ref="menuCard"] [data-action="versus"]').click();
  const hud = page.locator(".play-hud.versus");

  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 393, height: 853 },
    { width: 853, height: 393 },
    { width: 800, height: 800 },
    { width: 1000, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    // Also exercise browsers which emit orientationchange before a late resize.
    await page.evaluate(() => window.dispatchEvent(new Event("orientationchange")));
    await expectViewportFits(page);
    const horizontal = viewport.width / viewport.height < 1.25;
    await expect(hud).toHaveAttribute("data-split-layout", horizontal ? "horizontal" : "vertical");
    await expect(hud.locator(".versus-guide")).toContainText(horizontal ? "top" : "left");
    await expect(hud.locator(".versus-guide")).toContainText(horizontal ? "bottom" : "right");
    await expect.poll(() => hud.evaluate(el => {
      const style = getComputedStyle(el, "::after");
      return { width: parseFloat(style.width), height: parseFloat(style.height) };
    })).toEqual(horizontal ? { width: viewport.width, height: 2 } : { width: 2, height: viewport.height });
  }
  await app.pause();
  await app.resume();
  expect(app.errors).toEqual([]);
});

test("menus remain bounded and actionable after rotation with large text", async ({ page }) => {
  const app = new SunbirdPage(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await app.open();
  await app.ready();
  await app.openMenu("open-settings", "Settings");
  const card = page.locator('[data-ref="menuCard"]');
  await card.getByRole("button", { name: "Large text", exact: true }).click();
  for (const viewport of [{ width: 568, height: 320 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    await expectViewportFits(page);
    await app.expectMenuFits();
    // Trial click verifies hit-testing, scrolling and stable bounds without changing settings.
    await card.getByRole("button", { name: "Large text", exact: true }).click({ trial: true });
  }
  await app.backHome();
  await app.fly();
  await app.pause();
  expect(app.errors).toEqual([]);
});

test("visual viewport changes cannot distort a fixed-size game host", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await page.locator('[data-ref="menuCard"] [data-action="versus"]').click();
  await expectViewportFits(page);
  await page.evaluate(() => {
    // Model the mobile keyboard/pinch-zoom case: visual viewport shrinks while
    // the canvas's CSS/layout viewport stays the same size.
    const viewport = window.visualViewport!;
    Object.defineProperty(viewport, "height", { configurable: true, value: 240 });
    viewport.dispatchEvent(new Event("resize"));
  });
  await expectViewportFits(page);
  await expect(page.locator(".play-hud.versus")).toHaveAttribute("data-split-layout", "horizontal");
  await page.evaluate(() => {
    Reflect.deleteProperty(window.visualViewport!, "height");
    window.visualViewport!.dispatchEvent(new Event("resize"));
  });
  await app.pause();
  await app.resume();
  expect(app.errors).toEqual([]);
});

test("an embedded game follows its iframe rather than the outer page orientation", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route("**/orientation-host", route => route.fulfill({
    contentType: "text/html",
    body: '<!doctype html><iframe id="game" src="/" style="border:0;width:390px;height:844px" allow="autoplay; fullscreen"></iframe>',
  }));
  const app = new SunbirdPage(page); // Collect runtime errors across frames too.
  await page.goto("/orientation-host");
  const game = page.frameLocator("#game");
  await game.getByRole("button", { name: "Random name", exact: true }).click();
  await game.locator('[data-action="confirm-pilot-name"]').click();
  await game.getByRole("button", { name: "Play free flight now", exact: true }).click();
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 390, height: 844 }]) {
    await page.locator("#game").evaluate((el, size) => {
      el.style.width = `${size.width}px`;
      el.style.height = `${size.height}px`;
    }, viewport);
    await expect.poll(() => game.locator(".game-canvas").evaluate(el => {
      const r = el.getBoundingClientRect();
      return { width: r.width, height: r.height };
    })).toEqual(viewport);
    await game.locator('[data-action="pause"]').click();
    await game.locator('[data-action="resume"]').click();
  }
  expect(app.errors).toEqual([]);
});
