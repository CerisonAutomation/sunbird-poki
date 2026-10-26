import { test, expect, type Locator, type Page } from "@playwright/test";
import type { Server } from "node:http";
import {
  FREEZE, startArtifactServer, stopArtifactServer,
} from "./visual-helpers";

/**
 * Pixel baselines for the surfaces that must not drift silently. CSS animations
 * are frozen first so a run is repeatable.
 *
 * Baselines live in e2e/visual-baselines.spec.ts-snapshots/ and are committed.
 * They are font- and platform-sensitive, and Playwright keeps a baseline per
 * platform, so a run on a machine that has never captured one has nothing to
 * compare against. Regenerate deliberately after an intended design change:
 *
 *   npx playwright test e2e/visual-baselines.spec.ts \
 *     --config=playwright.gD.config.ts --update-snapshots
 *
 * and review the diff before committing. Use a config that declares both
 * projects — playwright.visual.config.ts is desktop-only, so it leaves the
 * `-phone` baselines behind.
 */

/* ------------------------------------------------------------- motion ----
 *
 * `prefers-reduced-motion: reduce` is not a trick to make this suite pass; it
 * is the game's own setting, and the menu card is built out of it.
 *
 * `.paper-card.menu-hero` is deliberately translucent — `backdrop-filter:
 * blur(16px) saturate(1.15)` over the live attract flight — so an element
 * screenshot of the card contains a slice of the running 3D world. Under
 * normal motion that world never repeats: Game.menuTick flies the attract
 * pilot, the flock drifts, the camera dollies, and the CPU rasteriser
 * (SwiftShader) adds its own timing. Two runs of one build cannot match, so
 * the comparison was measuring noise rather than drift.
 *
 * The game already has a first-class answer. `prefers-reduced-motion: reduce`
 * makes LivingBackground paint a static flock (setReducedMotion freezes its
 * clock and stops spawning traffic), holds the menu sky still, and drops bloom
 * — the expensive post pass. Measured on this build, three fresh sessions of
 * the same artifact under reduced motion differ by 1 to 17 pixels out of
 * 547,920 (0.0002%-0.0031% at Playwright's default per-pixel threshold), and
 * the same measurement without it is orders of magnitude larger.
 *
 * That measurement is what the two constants below are set from, and
 * "the menu card is still enough to baseline" asserts it on every run, so the
 * suite fails loudly if a future change makes the world leak back into the
 * capture instead of quietly loosening the tolerance.
 */
test.use({ contextOptions: { reducedMotion: "reduce" } });

/**
 * Allowed drift between a baseline and a fresh capture, as a fraction of the
 * card's pixels. 0.1% against a measured worst case of 0.0031% — thirty times
 * the noise, and still far below anything a real change produces (one moved
 * line of type is thousands of pixels on a 547,920-pixel card). It replaces a
 * flat 1%, which was never measured against anything.
 */
const MAX_DIFF_PIXEL_RATIO = 0.001;

/**
 * Allowed drift between two captures of the *same* build, measured in-page as
 * "any channel differs by more than 8/255". Ten times the worst pair measured
 * under reduced motion (0.0232% at the strictest comparator setting), so
 * ordinary antialiasing jitter passes and a moving world does not.
 */
const STILL_DRIFT = 0.002;

/**
 * Capturing an element waits for a frame from a CPU rasteriser on a machine
 * that is also running five other browser suites: measured at 19-61s per
 * capture here, against the 20s global expect timeout. This is a bound on the
 * wait, not on the comparison — the pixel budget above is unchanged.
 */
const CAPTURE_TIMEOUT = 120_000;

/** Boot is the same CPU-rasterised WebGL build; same reasoning, same bound. */
const BOOT_TIMEOUT = 120_000;
const SCREEN_TIMEOUT = 45_000;

/* ------------------------------------------------------------------ nav ----
 *
 * The menu is not a flat list of unique `data-action` values: the first-run
 * flight plan reuses `pvp-practice`, `open-practice`, `open-loadout`,
 * `open-live` and `open-settings`, and the daily-ritual banner adds a second
 * `open-challenges`. A bare lookup matches two elements, throws a strict-mode
 * violation and spends the whole budget doing it. These are pinned to the
 * containers that hold the menu's *own* controls; see visual-screens.spec.ts
 * for the full argument.
 */
const HOME_CONTROLS = [
  "nav.home-quick-rail",
  "nav.destination-grid",
  "button.home-board",
  "div.home-record",
  "button.event-strip",
  "button.primary-btn",
].join(", ");

const CARD = '[data-ref="menuCard"]';
const HOME_RAIL = `${CARD} nav.home-quick-rail`;

/**
 * A home destination: the menu's own control for `action`, never a copy.
 *
 * Two shapes: "Fly now", the leaderboard strip and the tournament countdown
 * carry the action on the button that *is* the container, while the quick rail,
 * the destination grids and the record bar hold one inside them. Matching only
 * the descendant form finds nothing for those three.
 */
function homeControl(page: Page, action: string): Locator {
  return page.locator(
    `${CARD} :is(${HOME_CONTROLS}):is([data-action="${action}"]), `
    + `${CARD} :is(${HOME_CONTROLS}) [data-action="${action}"]`,
  );
}

function screenTitle(page: Page): Promise<string> {
  return page.evaluate(
    () => document.querySelector('[data-ref="menuCard"] .screen-head h2')?.textContent?.trim() ?? "",
  );
}

async function bootToMenu(page: Page, baseUrl: string, locale?: string): Promise<void> {
  if (locale) {
    await page.addInitScript((code) => {
      localStorage.setItem("sunbird.i18n.locale", code);
    }, locale);
  }
  await page.goto(baseUrl, { waitUntil: "commit" });
  await expect(page.locator("#boot-shell")).toHaveCount(0, { timeout: BOOT_TIMEOUT });
  // There is no pilot-name screen in this build: loader, then menu.
  await expect(page.locator(HOME_RAIL)).toBeVisible({ timeout: BOOT_TIMEOUT });
}

/**
 * `toPass()` takes its budget from the expect timeout, and the global one is
 * 20s — shorter than a single click on a CPU-rasterised page needs when the
 * card re-renders underneath it. Configured here so the retry loop is bounded
 * by the same number as every other wait in this spec.
 */
function patientExpect() {
  return expect.configure({ timeout: SCREEN_TIMEOUT });
}

async function openFromMenu(page: Page, action: string): Promise<void> {
  const before = await screenTitle(page);
  // Retried inside one bounded budget: the card re-renders in place, and under
  // the CPU rasteriser a re-render can land after Playwright has resolved the
  // control, so a click can lose its element without anything being wrong with
  // the app. Each retry first checks whether the previous click landed.
  await patientExpect()(async () => {
    if ((await screenTitle(page)) !== before) return;
    await homeControl(page, action).click({ timeout: 5_000 });
  }, { message: `${action}: the control could not be clicked` }).toPass();
  await expect
    .poll(() => screenTitle(page), { timeout: SCREEN_TIMEOUT, message: `${action} never opened a screen` })
    .not.toBe(before);
}

let server: Server;
let baseUrl = "";

test.beforeAll(async () => { ({ server, baseUrl } = await startArtifactServer()); });
test.afterAll(async () => { await stopArtifactServer(server); });

test("menu card", async ({ page }) => {
  await bootToMenu(page, baseUrl);
  await page.addStyleTag({ content: FREEZE });
  await expect(page.locator(CARD)).toHaveScreenshot("menu-card.png", {
    maxDiffPixelRatio: MAX_DIFF_PIXEL_RATIO,
    timeout: CAPTURE_TIMEOUT,
  });
});

test("settings screen", async ({ page }) => {
  await bootToMenu(page, baseUrl);
  await openFromMenu(page, "open-settings");
  await page.addStyleTag({ content: FREEZE });
  await expect(page.locator(CARD)).toHaveScreenshot("settings-card.png", {
    maxDiffPixelRatio: MAX_DIFF_PIXEL_RATIO,
    timeout: CAPTURE_TIMEOUT,
  });
});

test("leaderboard screen", async ({ page }) => {
  await bootToMenu(page, baseUrl);
  await openFromMenu(page, "open-board");
  await page.addStyleTag({ content: FREEZE });
  await expect(page.locator(CARD)).toHaveScreenshot("board-card.png", {
    maxDiffPixelRatio: MAX_DIFF_PIXEL_RATIO,
    timeout: CAPTURE_TIMEOUT,
  });
});

test("Arabic mirrors the menu", async ({ page }) => {
  await bootToMenu(page, baseUrl, "ar");
  await page.addStyleTag({ content: FREEZE });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).direction)).toBe("rtl");
  await expect(page.locator(CARD)).toHaveScreenshot("menu-card-rtl.png", {
    maxDiffPixelRatio: MAX_DIFF_PIXEL_RATIO,
    timeout: CAPTURE_TIMEOUT,
  });
});

/**
 * The precondition the four baselines above rest on, asserted on its own.
 *
 * A pixel baseline only catches a regression if two captures of one build
 * agree to begin with. If the world behind the translucent card starts moving
 * again — a setting change, a new animation, reduced motion dropped from the
 * context — every baseline here starts failing on noise, and the tempting fix
 * is to widen MAX_DIFF_PIXEL_RATIO until they pass. This test fails first, and
 * says why.
 *
 * The diff is computed in the page on a canvas rather than with a PNG decoder
 * in Node: the browser is already here, the project ships no image library, and
 * this is the same measurement the tolerance is justified against.
 */
test("the menu card is still enough to baseline", async ({ page }) => {
  await bootToMenu(page, baseUrl);
  await page.addStyleTag({ content: FREEZE });
  const first = await page.locator(CARD).screenshot({ timeout: CAPTURE_TIMEOUT });
  await page.waitForTimeout(1500);
  const second = await page.locator(CARD).screenshot({ timeout: CAPTURE_TIMEOUT });

  const drift = await page.evaluate(async ([left, right]) => {
    const load = (src: string) => new Promise<HTMLImageElement>((done, fail) => {
      const img = new Image();
      img.onload = () => done(img);
      img.onerror = () => fail(new Error("capture could not be decoded"));
      img.src = src;
    });
    const [one, two] = await Promise.all([load(left), load(right)]);
    if (one.width !== two.width || one.height !== two.height) return 1;
    const pixels = (img: HTMLImageElement) => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const a = pixels(one);
    const b = pixels(two);
    let differing = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (
        Math.abs(a[i] - b[i]) > 8
        || Math.abs(a[i + 1] - b[i + 1]) > 8
        || Math.abs(a[i + 2] - b[i + 2]) > 8
      ) differing += 1;
    }
    return differing / (a.length / 4);
  }, [
    `data:image/png;base64,${first.toString("base64")}`,
    `data:image/png;base64,${second.toString("base64")}`,
  ] as [string, string]);

  expect(drift, "two captures of one build must agree — the card is a still image under reduced motion")
    .toBeLessThan(STILL_DRIFT);
});
