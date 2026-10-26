import { test, expect, type Locator, type Page } from "@playwright/test";
import type { Server } from "node:http";
import {
  FREEZE, startArtifactServer, stopArtifactServer,
} from "./visual-helpers";

/**
 * `toPass()` takes its budget from the expect timeout, and the global one is
 * 20s — shorter than a single click on a CPU-rasterised page needs when the
 * card re-renders underneath it. Configured here so the retry loop is bounded
 * by the same number as every other wait in this spec.
 */
function patientExpect() {
  return expect.configure({ timeout: SCREEN_TIMEOUT });
}

/**
 * Every screen a player can reach from the menu, checked for clipped text and
 * off-screen content. Runs in the default language so it stays one test and a
 * couple of minutes; the per-language version is visual-locale.spec.ts.
 */

/* ------------------------------------------------------------------ nav ----
 *
 * These lookups live in the spec rather than in visual-helpers.ts because the
 * menu stopped being a flat list of unique `data-action` values, and the two
 * things that broke it are different surfaces:
 *
 *   1. The first-run "flight plan" card (`section.onboarding-route`) reuses
 *      `pvp-practice`, `open-practice`, `open-loadout`, `open-live` and
 *      `open-settings` verbatim. A bare `[data-action="open-settings"]` then
 *      resolves to two elements, throws a strict-mode violation, and burns the
 *      test's entire budget doing it.
 *   2. The daily-ritual banner (`div.pc--gold`) carries its own shortcut to
 *      `open-challenges`, alongside the grid tile.
 *
 * Both are *copies of* a destination rather than the destination, and the home
 * menu's own controls live in a small, fixed set of containers. Pinning the
 * lookups to that set is an allowlist, not an exclusion: a menu that moves a
 * destination somewhere new fails loudly with "0 controls" instead of silently
 * matching a promo banner forever.
 */

/** The containers that hold the home menu's own, canonical controls. */
const HOME_CONTROLS = [
  "nav.home-quick-rail",   // the four actions under "Fly now"
  "nav.destination-grid",  // the Play and Progress tiles
  "button.home-board",     // leaderboard strip
  "div.home-record",       // Nest Pass record bar
  "button.event-strip",    // tournament countdown
  "button.primary-btn",    // "Fly now" itself
].join(", ");

const CARD = '[data-ref="menuCard"]';

/** Home-only, locale-independent and a single match: the quick rail. */
const HOME_RAIL = `${CARD} nav.home-quick-rail`;

/**
 * Boot is the real WebGL build under headless SwiftShader, which rasterises on
 * the CPU, so how long it takes tracks machine load rather than test
 * difficulty. These are bounds, not targets: a boot that never finishes is a
 * failure, a slow one is Tuesday.
 */
const BOOT_TIMEOUT = 120_000;
const SCREEN_TIMEOUT = 45_000;

/**
 * A home destination: the menu's own control for `action`, never a copy.
 *
 * Two shapes, because three of the menu's controls *are* their container — "Fly
 * now", the leaderboard strip and the tournament countdown are single buttons
 * with the action on the button, while the quick rail, the destination grids
 * and the record bar hold one inside them. Matching only the descendant form
 * silently found nothing for those three, which is how a lookup bug becomes a
 * 45-second wait for a control that was never going to appear.
 */
function homeControl(page: Page, action: string): Locator {
  return page.locator(
    `${CARD} :is(${HOME_CONTROLS}):is([data-action="${action}"]), `
    + `${CARD} :is(${HOME_CONTROLS}) [data-action="${action}"]`,
  );
}

/**
 * A control on the screen the player is already inside. The flight plan and the
 * daily banner are rendered by the home screen only, so away from home a bare
 * action is unique again — and this is the lookup nested routes need.
 */
function screenControl(page: Page, action: string): Locator {
  return page.locator(`${CARD} [data-action="${action}"]`);
}

/** The heading of the screen the card is showing: "" on the home menu. */
function screenTitle(page: Page): Promise<string> {
  return page.evaluate(
    () => document.querySelector('[data-ref="menuCard"] .screen-head h2')?.textContent?.trim() ?? "",
  );
}

/**
 * Click a control and wait for the card to actually go somewhere.
 *
 * Waiting for a `.screen-head h2` to appear only proves the card left the home
 * menu, so it cannot be the check for a *nested* step — the screen you are on
 * already has one. The heading changing is the assertion that works for both.
 *
 * The click is retried inside one bounded budget because the card is re-rendered
 * in place, and under the CPU rasteriser the re-render can land after Playwright
 * has already resolved the control — so a click can lose its element and time
 * out without anything being wrong with the app. Each retry checks first
 * whether the previous click landed, so the control is never clicked twice, and
 * the assertion that decides the test is the one at the end.
 */
async function navigate(
  page: Page,
  control: Locator,
  label: string,
): Promise<void> {
  const before = await screenTitle(page);
  await patientExpect()(async () => {
    if ((await screenTitle(page)) !== before) return;
    await control.click({ timeout: 5_000 });
  }, { message: `${label}: the control could not be clicked` }).toPass();
  await expect
    .poll(() => screenTitle(page), { timeout: SCREEN_TIMEOUT, message: `${label} never opened a screen` })
    .not.toBe(before);
}

async function bootToMenu(page: Page, baseUrl: string): Promise<void> {
  await page.goto(baseUrl, { waitUntil: "commit" });
  await expect(page.locator("#boot-shell")).toHaveCount(0, { timeout: BOOT_TIMEOUT });
  // There is no pilot-name screen in this build: loader, then menu.
  await expect(page.locator(HOME_RAIL)).toBeVisible({ timeout: BOOT_TIMEOUT });
}

/**
 * Walk back out of whatever screen we are in, one back button at a time.
 *
 * Each retry is one click plus proof that the home menu came back, so a slow
 * re-render cannot be mistaken for a screen that needs another back, and a
 * screen that needs several cannot be mistaken for a finished walk.
 */
async function backToMenu(page: Page): Promise<void> {
  await patientExpect()(async () => {
    if (await page.locator(HOME_RAIL).isVisible().catch(() => false)) return;
    await screenControl(page, "back").first().click({ timeout: 5_000 });
    await expect(page.locator(HOME_RAIL)).toBeVisible({ timeout: 5_000 });
  }, { message: "the back button never returned to the home menu" }).toPass();
}

/**
 * Every screen, and the clicks that reach it.
 *
 * `open-rank` is the one route that is not a single tap from the menu: Rival
 * rank is a secondary destination (MenuCatalog.SECONDARY_DESTINATIONS) that the
 * home screen reaches only from inside Your progress, so the home card carries
 * no control for it at all. A flat list of home actions asked for it, found
 * nothing, and hung until the test timed out. The route is spelled out here so
 * the test walks the path a player actually takes.
 */
/**
 * Walk the visible DOM inside the menu card and report what a player would
 * actually see go wrong.
 *
 * A local copy of visual-helpers' `visualDefects`, with one rule changed, and
 * the change is the whole point of this file's existence:
 *
 *   **An inline `<svg>` root is skipped by the "clips its own text" rule.**
 *
 * `el.textContent` on an `<svg>` is its `<title>` — the bird's accessible name,
 * "Jet", not text anybody reads — while a Range over the element measures the
 * *artwork*. So the rule fired on 20 of the Shop's birds with
 * `clipped svg[...]: "Jet" content 101px in an 89px box`, on every screen
 * check and every one of the 22 locales, and none of it was a text defect.
 * That is the same false positive the helper already excludes for decorative
 * `::before`/`::after` glows; the Shop's illustrations are simply more of them.
 *
 * It was masking the rule's real purpose, which still works unchanged: a label
 * longer than its box is still caught, in every language, because the label is
 * a real element with real text.
 *
 * Worth reporting to whoever owns the art rather than hiding here: those 20
 * birds are authored 10 user units wider than their own `viewBox`
 * (`getBBox()` 86×31 in a 76×68 box), and an SVG root clips overflow, so a wing
 * tip really is cropped. That is an illustration bug, not a text bug, and it is
 * in Sunbird.ts rather than in this suite.
 *
 * Deliberately narrow, as upstream: panels scroll, so "below the fold" is not a
 * defect, and `clientWidth` excludes borders, so a bordered button always
 * measures a few px wider than its content box. Only two things count —
 *   1. a box that CLIPS its own TEXT (overflow hidden/clip, text wider),
 *   2. a leaf text node that escapes the panel sideways.
 */
async function visualDefects(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const defects: string[] = [];
    const card = document.querySelector<HTMLElement>('[data-ref="menuCard"]');
    if (!card) return ["menuCard not found"];
    const cardRect = card.getBoundingClientRect();

    /** True when an ancestor scrolls sideways, so "further right" is reachable. */
    const inHorizontalScroller = (node: Element) => {
      for (let p = node.parentElement; p && p !== card; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (s.overflowX === "auto" || s.overflowX === "scroll") return true;
      }
      return false;
    };
    /** Union box of the real content (text + element children, no pseudo-elements). */
    const contentBox = (el: Element) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getBoundingClientRect();
    };

    for (const el of Array.from(card.querySelectorAll<HTMLElement>("*"))) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;
      // Skip visually-hidden helpers (.sr-only and friends): 1px boxes with
      // overflow hidden are their whole point, not a clipping bug.
      if (style.clip !== "auto" || style.clipPath !== "none") continue;
      const text = (el.textContent ?? "").trim();
      if (!text) continue;
      const label = `${el.tagName.toLowerCase()}[${el.dataset.ref ?? el.dataset.action ?? el.className}]`;

      // 1. A box that clips its own TEXT. Measured with a Range so decorative
      //    ::before/::after glows — which legitimately overflow a box with
      //    overflow:hidden — do not count. Inline SVG is the same case: an
      //    <svg>'s textContent is its accessible <title> and its content box
      //    is the drawing, so this rule cannot mean "text" there.
      const clips = style.overflowX === "hidden" || style.overflowX === "clip";
      if (clips && el.tagName.toLowerCase() !== "svg") {
        const box = el.getBoundingClientRect();
        const content = contentBox(el);
        if (content.width && (content.right > box.right + 2 || content.left < box.left - 2)) {
          defects.push(`clipped ${label}: "${text.slice(0, 30)}" content ${Math.round(content.width)}px in a ${Math.round(box.width)}px box`);
        }
      }

      // 2. A leaf text node that escapes the panel sideways (not reachable by
      //    scrolling either).
      if (el.children.length === 0 && !inHorizontalScroller(el)) {
        const rect = el.getBoundingClientRect();
        if (rect.width && rect.height && (rect.right > cardRect.right + 4 || rect.left < cardRect.left - 4)) {
          defects.push(`escapes panel ${label}: "${text.slice(0, 30)}" at x=${Math.round(rect.left)}`);
        }
      }
    }
    return defects;
  });
}

const ROUTES: readonly { readonly label: string; readonly path: readonly string[] }[] = [
  { label: "open-shop", path: ["open-shop"] },
  { label: "open-settings", path: ["open-settings"] },
  { label: "open-board", path: ["open-board"] },
  { label: "open-progress", path: ["open-progress"] },
  { label: "open-cups", path: ["open-cups"] },
  { label: "open-account", path: ["open-account"] },
  { label: "open-challenges", path: ["open-challenges"] },
  { label: "open-campaign", path: ["open-campaign"] },
  { label: "open-rank", path: ["open-progress", "open-rank"] },
  { label: "open-pass", path: ["open-pass"] },
  { label: "open-trophies", path: ["open-trophies"] },
  { label: "open-atlas", path: ["open-atlas"] },
  { label: "open-scores", path: ["open-scores"] },
  { label: "open-squad", path: ["open-squad"] },
  { label: "open-live", path: ["open-live"] },
  { label: "mode-select", path: ["mode-select"] },
];

/**
 * Actions the home card deliberately renders twice, and who does the copying.
 * Asserted in the lookup test below, so the allowlist above is never the only
 * thing standing between a rename and a silent two-element strict-mode error.
 */
const DUPLICATED_ACTIONS: readonly (readonly [action: string, copiedBy: string])[] = [
  ["pvp-practice", "flight plan"],
  ["open-practice", "flight plan"],
  ["open-loadout", "flight plan"],
  ["open-live", "flight plan"],
  ["open-settings", "flight plan"],
  ["open-challenges", "daily-ritual banner"],
];

let server: Server;
let baseUrl = "";

test.beforeAll(async () => { ({ server, baseUrl } = await startArtifactServer()); });
test.afterAll(async () => { await stopArtifactServer(server); });

test(`all ${ROUTES.length} reachable screens fit their box`, async ({ page }) => {
  // Sixteen screens, each a click out and a click back, on a build that
  // rasterises on the CPU. The shared 300s budget is not a property of this
  // test's difficulty; it is a leftover from the specs that visit one screen.
  test.slow();
  await bootToMenu(page, baseUrl);
  await page.addStyleTag({ content: FREEZE });
  const problems: string[] = [];
  for (const route of ROUTES) {
    await backToMenu(page);
    for (const [step, action] of route.path.entries()) {
      // The first click leaves the home menu, so it has to be the menu's own
      // control; anything after it is a control on the screen just opened.
      const control = step === 0 ? homeControl(page, action) : screenControl(page, action);
      await navigate(page, control, route.label);
    }
    const defects = await visualDefects(page);
    if (defects.length) problems.push(`${route.label}: ${defects.join(" | ")}`);
  }
  expect(problems, "screens with visual defects").toEqual([]);
});

/**
 * The navigation the test above depends on, asserted directly.
 *
 * A strict-mode violation is the most expensive kind of locator bug in this
 * suite: it does not fail where it happens, it parks the test until the
 * timeout. Checking "exactly one control" once, up front, for every action the
 * suite clicks, turns that into a fast, named failure — and the second half
 * pins *why* the allowlist exists, so deleting it looks like the regression it
 * would be.
 */
test("every menu lookup this suite makes resolves to exactly one control", async ({ page }) => {
  await bootToMenu(page, baseUrl);
  const problems: string[] = [];

  const rails = await page.locator(HOME_RAIL).count();
  if (rails !== 1) problems.push(`home rail matched ${rails} elements, expected 1`);

  for (const route of ROUTES) {
    const [first] = route.path;
    const controls = await homeControl(page, first).count();
    if (controls !== 1) {
      problems.push(`${route.label}: home control "${first}" matched ${controls} elements, expected 1`);
    }
  }

  for (const [action, copiedBy] of DUPLICATED_ACTIONS) {
    const copies = await page.locator(`${CARD} [data-action="${action}"]`).count();
    if (copies < 2) {
      problems.push(`"${action}" is no longer duplicated by the ${copiedBy} (${copies} match) — the allowlist needs re-checking`);
    }
    const owned = await homeControl(page, action).count();
    if (owned !== 1) {
      problems.push(`"${action}": the menu's own control matched ${owned} elements, expected 1`);
    }
  }

  // Rival rank has no home control at all: the nested route is the only way in.
  const rankOnHome = await homeControl(page, "open-rank").count();
  if (rankOnHome !== 0) {
    problems.push(`"open-rank" now has ${rankOnHome} home control(s) — the nested route is stale`);
  }

  expect(problems, "menu lookups that are not single-match").toEqual([]);
});

/**
 * The defect walk's one deliberate departure from the shared helper, tested
 * from both sides.
 *
 * The Shop's birds are inline SVG whose artwork is wider than their tile, and
 * the walk reported every one of them as `clipped svg[...]: "Jet" content
 * 101px in an 89px box` — on every screen check and in all 22 locales. The
 * quoted "text" was the bird's accessible `<title>`; the measured content was
 * the drawing. Fixing that by weakening the clipped-text rule would have been
 * worse than the bug, so the rule is asserted here on a label that really is
 * clipped: the fix must remove the false positive without removing the check.
 */
test("the defect walk ignores illustration geometry but still catches clipped text", async ({ page }) => {
  await bootToMenu(page, baseUrl);
  await page.addStyleTag({ content: FREEZE });
  await navigate(page, homeControl(page, "open-shop"), "open-shop");

  const illustrations = (await visualDefects(page)).filter((d) => d.includes("svg["));
  expect(illustrations, "inline SVG is artwork, not text: it must not be reported as clipped")
    .toEqual([]);

  // A label that genuinely does not fit its own box, injected so the assertion
  // does not depend on a locale shipping a long word.
  await page.evaluate(() => {
    const card = document.querySelector('[data-ref="menuCard"]')!;
    const probe = document.createElement("div");
    probe.className = "clipped-text-probe";
    probe.style.cssText = "width:80px;overflow:hidden;white-space:nowrap;font-size:12px";
    probe.textContent = "a label far longer than its own eighty pixel box";
    card.appendChild(probe);
  });

  const reported = await visualDefects(page);
  expect(
    reported.filter((d) => d.startsWith("clipped div[clipped-text-probe]")),
    "a label clipped by its own overflow:hidden must still be reported",
  ).not.toEqual([]);
});
