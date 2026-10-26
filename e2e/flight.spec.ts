import { test, expect } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

/**
 * The boot screen has to be PAINTED before the game module runs — that is the
 * whole promise of a shell. It used to be tested by holding the game chunk at
 * the network layer (intercepting `assets/Game-*.js` with `page.route`) and
 * bird was on screen while it was held.
 *
 * That test could never pass again. The shipping build is single-file
 * (`VITE_SINGLEFILE`, default on), so `import("./game/Game")` is inlined into
 * `index.html` and there is no `assets/Game-*.js` to intercept — the route never
 * matched, the game booted instantly, and the test failed after burning the
 * full 300s budget. A gate that reports a timeout for a premise that stopped
 * existing is worse than no gate.
 *
 * So the invariant is asserted where it is actually true in both build shapes:
 * the shell is in the DELIVERED DOCUMENT, and it is gone once the menu is up.
 * The chunk-gated path is kept for chunked builds, where it is a strictly
 * stronger assertion than this.
 */
test("the boot shell ships in the document and is replaced by the menu's canonical bird", async ({ page, baseURL }) => {
  // 1. Static: the shell is in the HTML, before a single byte of JS runs. This
  //    is the half that actually regresses — a bundler change that drops the
  //    inline loader leaves nothing to paint while 2 MB of JS parses.
  const html = await (await page.request.get(baseURL!)).text();
  const bootBlock = html.match(/<svg[^>]*class="boot-bird"[\s\S]*?<\/svg>/);
  expect(bootBlock, "index.html must carry the boot bird in its inline shell").not.toBeNull();
  // index.html names the keyframes `boot-bird-orbit`; the reduced-motion block
  // must still be able to cancel them, so the name has to survive the build.
  expect(html).toContain("boot-bird-orbit");
  const bootPaths = [...bootBlock![0].matchAll(/<path[^>]*\sd="([^"]*)"/g)].map(m => m[1]!);
  expect(bootPaths.length).toBeGreaterThan(4);

  // 2. Live: the shell is gone, and the menu's bird is that same artwork — the
  //    player must not see one glider on the loader and a different one in the
  //    menu.
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await expect(page.locator("#boot-shell")).toHaveCount(0);
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

/**
 * A failed chunk must offer a retry rather than a reload loop.
 *
 * Skipped, loudly, against the single-file build — and the skip is the point.
 * The behaviour under test is "the lazy game chunk failed to download". In a
 * single-file build `import("./game/Game")` is inlined into `index.html`, so
 * there is no chunk request to abort: a route on `assets/Game-*.js` never
 * matches, the game boots normally, and the retry UI never appears. The test
 * then failed at the 20s expect and spent the rest of the 300s budget
 * retrying, so a build shape we ship by default read as a broken error path.
 *
 * The detection is by observed behaviour, not by reading an env var: if the
 * document pulls a `Game-*.js` chunk, the chunked build is what is under test
 * and the full assertion runs. `VITE_SINGLEFILE=false vite build` is that build.
 */
test("an interrupted lazy game download offers an explicit retry, not a reload loop", async ({ page }) => {
  const app = new SunbirdPage(page);
  await page.goto("/");
  const chunked = app.requests.some(url => /\/assets\/Game-.*\.js/.test(url));
  test.skip(
    !chunked,
    "the shipping build is single-file, so there is no lazy game chunk to interrupt — " +
      "run `VITE_SINGLEFILE=false` to exercise this path",
  );
  await app.open();
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
