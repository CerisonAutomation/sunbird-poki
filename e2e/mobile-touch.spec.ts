import { expect, test, type CDPSession, type Page } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

/**
 * Mobile touch contract.
 *
 * Playwright's `tap()` only reproduces a touch that lands on a control. Every
 * regression this file pins came from a finger landing somewhere else — the
 * plain `<div>` between two shop rows, the dimmed backdrop beside a card, the
 * bare paint of the pause screen — so the gestures below are driven through
 * CDP `Input.dispatchTouchEvent`, the same path a real finger takes.
 *
 * The failure mode being guarded: `Input` used to cancel `touchstart` and
 * `touchmove` on `window` for anything that was not a control. Chromium only
 * hands a pan to its compositor thread while the first touch events stay
 * uncancelled, so cancelling them stopped menu scrolling before it began, and
 * cancelling `touchstart` also suppressed the compatibility `click` that a
 * backdrop tap or a pause-screen tap depends on.
 */

const CARD = '[data-ref="menuCard"]';
const OVER = '[data-ref="over"]';

/** One finger, pressed → dragged in `steps` → lifted, with frame-paced moves. */
async function fingerDrag(cdp: CDPSession, x: number, y: number, dx: number, dy: number, steps = 14): Promise<void> {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + (dx * i) / steps, y: y + (dy * i) / steps, id: 1 }],
    });
    await new Promise(resolve => setTimeout(resolve, 16));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function fingerPress(cdp: CDPSession, x: number, y: number, holdMs = 55): Promise<void> {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
  await new Promise(resolve => setTimeout(resolve, holdMs));
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/** A pixel of `selector` that is not covered by any control — the regression case. */
async function barePixel(page: Page, selector: string, avoid = ""): Promise<{ x: number; y: number }> {
  const point = await page.evaluate(([sel, avoidSel]) => {
    const root = document.querySelector<HTMLElement>(sel);
    if (!root) return null;
    const box = root.getBoundingClientRect();
    const avoidEl = avoidSel ? document.querySelector(avoidSel) : null;
    for (let y = box.top + 8; y < box.bottom - 8; y += 9) {
      for (let x = box.left + 8; x < box.right - 8; x += 9) {
        const hit = document.elementFromPoint(x, y);
        if (!hit || !root.contains(hit)) continue;
        if (hit.closest("button, a, summary, input, select, textarea, [data-action], [role=button]")) continue;
        if (avoidEl?.contains(hit)) continue;
        return { x, y };
      }
    }
    return null;
  }, [selector, avoid] as const);
  if (!point) throw new Error(`no bare (non-control) pixel found inside ${selector}`);
  return point;
}

async function openScreen(app: SunbirdPage, page: Page, action: string, title: string): Promise<void> {
  let button = page.locator(`${CARD} [data-action="${action}"]`).first();
  if (!(await button.isVisible().catch(() => false))) {
    // Several destinations live one disclosure away on the home screen.
    const more = page.locator(`${CARD} .home-more > summary`).first();
    if (await more.isVisible().catch(() => false)) await more.tap();
    button = page.locator(`${CARD} [data-action="${action}"]`).first();
  }
  await expect(button).toBeVisible();
  await button.tap();
  await expect(page.locator(`${CARD} .screen-head h2`)).toHaveText(title);
  await app.expectMenuFits();
}

test.describe("mobile touch", () => {
  test.skip(({ hasTouch }) => !hasTouch, "needs a touch-capable device profile");

  test("a finger drag on plain menu content scrolls the card", async ({ page, context }) => {
    test.setTimeout(120000);
    const app = new SunbirdPage(page);
    const cdp = await context.newCDPSession(page);
    await app.open();
    await app.ready();
    await openScreen(app, page, "open-shop", "Shop");

    // The card must genuinely overflow, or the test would pass vacuously.
    const range = await page.locator(CARD).evaluate(card => card.scrollHeight - card.clientHeight);
    expect(range, "shop card should overflow on a phone").toBeGreaterThan(200);

    // Start the drag on a non-control pixel: that is exactly where scrolling
    // used to die, because only controls were exempted from preventDefault.
    const from = await barePixel(page, CARD);
    await page.locator(CARD).evaluate(card => { card.scrollTop = 0; });
    await fingerDrag(cdp, from.x, from.y, 0, -340);

    const scrolled = await page.locator(CARD).evaluate(card => card.scrollTop);
    expect(scrolled, "finger drag must scroll the menu card").toBeGreaterThan(100);

    // Scroll must stay inside the game: Poki's page-integration rule.
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect(app.errors).toEqual([]);
  });

  test("the browser, not script, owns the pan during a menu drag", async ({ page, context }) => {
    test.setTimeout(120000);
    const app = new SunbirdPage(page);
    const cdp = await context.newCDPSession(page);
    await app.open();
    await app.ready();
    await openScreen(app, page, "open-shop", "Shop");

    // Bubble-phase listeners, registered after Input's own, so defaultPrevented
    // reflects what the app actually did.
    await page.evaluate(() => {
      window.__touch = { moves: 0, prevented: 0, cancelled: 0 };
      for (const type of ["touchmove", "touchstart"] as const) {
        window.addEventListener(type, event => {
          if (type === "touchmove") window.__touch.moves++;
          if (event.defaultPrevented) window.__touch.prevented++;
        }, false);
      }
      window.addEventListener("pointercancel", () => { window.__touch.cancelled++; }, false);
    });

    const from = await barePixel(page, CARD);
    await fingerDrag(cdp, from.x, from.y, 0, -340);

    const touch = await page.evaluate(() => window.__touch);
    expect(touch.prevented, "no touch event inside a menu may be cancelled").toBe(0);
    expect(touch.moves).toBeGreaterThan(0);
    // A pointercancel is the compositor taking the gesture over — proof the
    // scroll is native rather than scripted.
    expect(touch.cancelled, "the compositor should claim the pan").toBeGreaterThan(0);
    expect(app.errors).toEqual([]);
  });

  test("a nested list inside a card scrolls under the finger too", async ({ page, context }) => {
    test.setTimeout(120000);
    const app = new SunbirdPage(page);
    const cdp = await context.newCDPSession(page);
    await app.open();
    await app.ready();
    await openScreen(app, page, "open-pass", "Nest Pass");

    const track = page.locator(`${CARD} .tier-track`);
    await expect(track).toBeVisible();
    const range = await track.evaluate(el => el.scrollHeight - el.clientHeight);
    expect(range, "tier track should overflow on a phone").toBeGreaterThan(200);

    const box = await track.boundingBox();
    await track.evaluate(el => { el.scrollTop = 0; });
    await fingerDrag(cdp, box!.x + box!.width / 2, box!.y + box!.height / 2, 0, -260);
    expect(await track.evaluate(el => el.scrollTop)).toBeGreaterThan(80);
    expect(app.errors).toEqual([]);
  });

  test("tapping the bare pause screen resumes the flight", async ({ page, context }) => {
    test.setTimeout(120000);
    const app = new SunbirdPage(page);
    const cdp = await context.newCDPSession(page);
    await app.open();
    await app.ready();
    await app.fly();
    await app.pause();

    // The pause overlay resumes on a click anywhere on its own surface, and it
    // is a <div> — cancelling touchstart used to swallow that click outright.
    const overlay = page.locator(".overlay:visible", { has: page.locator('[data-action="resume"]') }).first();
    const at = await barePixel(page, ".overlay.pause");
    await fingerPress(cdp, at.x, at.y);
    await expect(page.locator('[data-action="pause"]')).toBeVisible();
    await expect(overlay).toBeHidden();
    expect(app.errors).toEqual([]);
  });

  test("tapping the backdrop beside a card goes back", async ({ page, context }) => {
    test.setTimeout(120000);
    const app = new SunbirdPage(page);
    const cdp = await context.newCDPSession(page);
    await app.open();
    await app.ready();
    await openScreen(app, page, "open-shop", "Shop");

    const at = await page.evaluate(() => {
      const overlay = document.querySelector<HTMLElement>(".overlay.menu")!;
      const card = document.querySelector('[data-ref="menuCard"]')!;
      const box = overlay.getBoundingClientRect();
      for (const [x, y] of [[box.left + 4, box.top + 4], [box.right - 4, box.top + 4], [box.left + box.width / 2, box.top + 3]]) {
        const hit = document.elementFromPoint(x, y);
        if (hit && !card.contains(hit) && hit === overlay) return { x, y };
      }
      return null;
    });
    test.skip(!at, "card covers the whole overlay at this viewport");
    await fingerPress(cdp, at!.x, at!.y);
    await expect(page.getByRole("button", { name: "Play free flight now", exact: true })).toBeVisible();
    expect(app.errors).toEqual([]);
  });

  test("touching a menu does not fire gameplay gestures", async ({ page, context }) => {
    test.setTimeout(120000);
    const app = new SunbirdPage(page);
    const cdp = await context.newCDPSession(page);
    await app.open();
    await app.ready();

    const at = await barePixel(page, CARD);
    await fingerPress(cdp, at.x, at.y, 90);

    // The gold dive ripple belongs to the flight surface; splashing it over a
    // menu reads as the game eating the tap.
    expect(await page.locator(".touch-ripple").count()).toBe(0);
    // A hold on a menu must not start a dive behind it.
    expect(await page.locator(".hud-root").getAttribute("data-ui-state")).not.toBe("playing");
    expect(app.errors).toEqual([]);
  });

  test("touch feedback survives the small-screen performance pass", async ({ page }) => {
    test.setTimeout(120000);
    const app = new SunbirdPage(page);
    await app.open();
    await app.ready();

    // The <=640px block used to freeze every animation on the page to 0.01ms,
    // which deleted the tap ripple, the spinners and the low-sun warning on
    // exactly the devices that rely on them.
    const feedback = await page.evaluate(() => {
      const read = (className: string) => {
        const el = document.createElement("div");
        el.className = className;
        document.body.append(el);
        const style = getComputedStyle(el);
        const value = { name: style.animationName, duration: style.animationDuration, iterations: style.animationIterationCount };
        el.remove();
        return value;
      };
      return { ripple: read("touch-ripple p1"), spinner: read("spinner"), sunLow: read("sun-fill low") };
    });

    expect(feedback.ripple.name).toBe("touch-ripple-expand");
    expect(parseFloat(feedback.ripple.duration)).toBeGreaterThan(0.05);
    expect(feedback.spinner.iterations).toBe("infinite");
    expect(parseFloat(feedback.spinner.duration)).toBeGreaterThan(0.05);
    // The low-sun warning still pulses — on the compositor, via pulse-soft.
    expect(feedback.sunLow.iterations).toBe("infinite");
    expect(feedback.sunLow.name).toMatch(/pulse/);
    expect(app.errors).toEqual([]);
  });

  test("a press on a menu button still produces a visible press state", async ({ page }) => {
    test.setTimeout(120000);
    const app = new SunbirdPage(page);
    await app.open();
    await app.ready();

    // `transform: none !important` on the small-screen button rule used to
    // cancel every :active press transform, so a phone got no confirmation at
    // all. Assert no blanket !important transform is applied to buttons.
    const blocked = await page.evaluate(() => {
      const button = document.querySelector<HTMLElement>(".paper-card button");
      if (!button) return null;
      for (const sheet of document.styleSheets) {
        let rules: CSSRuleList;
        try { rules = sheet.cssRules; } catch { continue; }
        const walk = (list: CSSRuleList, media: string | null): string | null => {
          for (const rule of Array.from(list)) {
            if (rule instanceof CSSMediaRule) { const hit = walk(rule.cssRules, rule.conditionText); if (hit) return hit; continue; }
            if (!(rule instanceof CSSStyleRule)) continue;
            if (!rule.selectorText.includes("button") && !/btn/.test(rule.selectorText)) continue;
            const priority = rule.style.getPropertyPriority("transform");
            if (priority === "important" && rule.style.getPropertyValue("transform").trim() === "none") {
              return `${rule.selectorText} @ ${media ?? "base"}`;
            }
          }
          return null;
        };
        const hit = walk(rules, null);
        if (hit) return hit;
      }
      return null;
    });
    expect(blocked, "no !important transform:none may flatten button press states").toBeNull();
    expect(app.errors).toEqual([]);
  });

  test("the gameplay surface still refuses to scroll or chain", async ({ page, context }) => {
    test.setTimeout(120000);
    const app = new SunbirdPage(page);
    const cdp = await context.newCDPSession(page);
    await app.open();
    await app.ready();
    await app.fly();

    const box = await page.locator(".game-root > canvas").boundingBox();
    await fingerDrag(cdp, box!.x + box!.width / 2, box!.y + box!.height * 0.8, 30, -300);

    // Holding is the whole game: a drag must not become a scroll, and must not
    // chain into the host page the portal embeds us in.
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollTop)).toBe(0);
    expect(await page.locator('[data-action="pause"]').isVisible()).toBe(true);
    expect(app.errors).toEqual([]);
  });

  test("the results card scrolls; its bare backdrop stays inert", async ({ page, context }) => {
    test.setTimeout(240000);
    const app = new SunbirdPage(page);
    const cdp = await context.newCDPSession(page);
    await app.open();
    await app.ready();
    await app.fly();

    // No debug hook ships, so the run is flown until the physics actually ends
    // it — the same way results.spec.ts reaches this screen. Daylight drains
    // whether or not we dive, so this taps for a while and then lets the run
    // coast out; tapping stops the moment the results card is up, because a
    // dive input in the `gameover` state restarts the run by design.
    for (let i = 0; i < 40 && !(await page.locator(OVER).isVisible().catch(() => false)); i++) {
      await page.keyboard.press("Space");
      await page.waitForTimeout(700);
      // A portal build offers a Second Wind first; the direct build does not.
      const decline = page.locator('[data-action="continue-sleep"]');
      if (await decline.isVisible().catch(() => false)) {
        await decline.click();
        await page.waitForTimeout(1500);
      }
    }
    await expect(page.locator(OVER)).toBeVisible({ timeout: 90000 });

    // The results card is the tallest surface in the game and its own scroller,
    // so a finger drag inside it must pan it rather than doing nothing.
    const card = page.locator(`${OVER} .paper-card`);
    const range = await card.evaluate(el => el.scrollHeight - el.clientHeight);
    expect(range, "the results card should have something to scroll").toBeGreaterThan(50);
    const box = await card.boundingBox();
    await fingerDrag(cdp, box!.x + box!.width / 2, box!.y + box!.height * 0.75, 0, -260);
    expect(await card.evaluate(el => el.scrollTop), "finger drag scrolls the results card").toBeGreaterThan(20);

    // The bare backdrop is deliberately inert: a stray tap (or a scroll drag
    // that ends off the card) must never launch another race while the player
    // reads the recap. Restarting stays an explicit button on the card.
    await expect(page.locator(`${OVER} .play-again-btn`)).toHaveAttribute("data-action", "retry");
    const point = await barePixel(page, OVER);
    await fingerPress(cdp, point.x, point.y);
    await page.waitForTimeout(600);
    await expect(page.locator(OVER), "backdrop tap must not restart the race").toBeVisible();

    // The card's own primary button is the explicit restart affordance.
    await page.locator(`${OVER} .play-again-btn`).click();
    await expect(page.locator(OVER)).toBeHidden({ timeout: 20000 });
    await expect(page.locator('[data-action="pause"]')).toBeVisible({ timeout: 20000 });
    expect(app.errors).toEqual([]);
  });
});

declare global {
  interface Window { __touch: { moves: number; prevented: number; cancelled: number } }
}
