import { test, expect } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

test("cold boot keeps the canonical bird visible until the game is ready", async ({ page }) => {
  const app = new SunbirdPage(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/assets/Game-*.js", async route => { await gate; await route.continue(); });
  await app.open();
  await expect(page.locator(".boot-bird")).toBeVisible();
  const bootPaths = await page.locator(".boot-bird path").evaluateAll(paths => paths.map(p => p.getAttribute("d")));
  expect(bootPaths.length).toBeGreaterThan(4);
  // index.html names the keyframes `boot-bird-orbit` (the `.boot-orbit` span
  // carries them); the reduced-motion block below must be able to cancel them.
  await expect(page.locator(".boot-orbit")).toHaveCSS("animation-name", "boot-bird-orbit");
  release();
  await app.ready();
  expect(await page.locator(".hero-bird path").evaluateAll(paths => paths.map(p => p.getAttribute("d")))).toEqual(bootPaths);
  expect(app.requests.some(url => /\/Fx-.*\.js/.test(url))).toBe(false);
  expect(app.requests.some(url => /\/Social-.*\.js/.test(url))).toBe(false);
  expect(app.errors).toEqual([]);
});

test("flight, pause and resume work without runtime errors", async ({ page }, info) => {
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await app.fly();
  await app.expectNoOverlaps([".top-bar > .stat-block", ".stat-block.right", ".sun-meter", ".hud-controls"], ".hud-root");
  await app.pause();
  await app.resume();
  if (info.project.name === "phone") {
    expect(app.requests.some(url => /\/Fx-.*\.js/.test(url))).toBe(false);
    const viewportWidth = await page.evaluate(() => innerWidth);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewportWidth);
  }
  expect(app.errors).toEqual([]);
});

test("reduced-motion loader does not orbit", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/assets/Game-*.js", async route => { await gate; await route.continue(); });
  const app = new SunbirdPage(page);
  await app.open();
  await expect(page.locator(".boot-orbit")).toHaveCSS("animation-name", "none");
  release();
  await app.ready();
  expect(app.errors).toEqual([]);
});

test("an interrupted lazy game download offers an explicit retry, not a reload loop", async ({ page }) => {
  const app = new SunbirdPage(page);
  let failOnce = true;
  await page.route("**/assets/Game-*.js", async route => {
    if (failOnce) { failOnce = false; await route.abort("failed"); }
    else await route.continue();
  });
  await app.open();
  await expect(page.getByRole("heading", { name: "The flight download was interrupted" })).toBeVisible();
  await expect(page.getByText("Check your connection", { exact: false })).toBeVisible();
  app.errors.length = 0; // the deliberately aborted request is expected
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await app.ready();
  expect(app.errors).toEqual([]);
});
