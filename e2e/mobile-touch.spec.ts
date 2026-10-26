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
 *
 * WHY NAVIGATION IS NOT A TAP, AND WHY EVERY TOUCH IS BOUNDED
 * ----------------------------------------------------------
 * Two things about this spec's own environment make the stock interaction
 * primitives unusable, and both were measured rather than guessed.
 *
 * The phone profile is Pixel 7 — 412 px at DPR 2.625 — so the renderer
 * rasterises ~2.6 M pixels per frame through SwiftShader, on the CPU. Measured
 * on an otherwise IDLE box: menu frames p50 = 1205 ms, p95 = 11.6 s, max = 51 s,
 * and an in-page `setTimeout(250)` took 2.6 s. That is the rasteriser, not the
 * game (see `docs/PRODUCTION_CHECKLIST.md` §10 and the same argument in
 * perf.spec.ts), but it has a direct consequence here: Playwright's
 * actionability check is rAF-based, so `locator.tap()` on the menu's own
 * `open-shop` button sat in "waiting for element to be visible, enabled and
 * stable" until it timed out — on a box with load 3.5. With no `actionTimeout`
 * configured, that wait has no bound at all, which is how the first test here
 * spent its entire 240 s budget in a `tap()` and then reported
 * `cdpSession.send: Target page, context or browser has been closed` from the
 * drag that was still queued behind it — a secondary error that says nothing
 * about touch.
 *
 * So: navigation clicks through the DOM, the same way `SunbirdPage.goHome`
 * already does and for the same documented reason (the HUD re-renders its card
 * on every screen change and detaches controls mid-click), and every CDP touch
 * dispatch is bounded so a starved renderer fails with the name of the gesture
 * that stalled rather than silently eating the rest of the budget. None of the
 * assertions below changed.
 *
 * The Poki SDK and leaderboard API are stubbed, as in the two portal specs.
 * `platform.ts` waits 800 ms for the CDN global before injecting
 * `game-cdn.poki.com`, and a live `init()` then brings a third-party ad stack
 * onto the main thread for the whole session — measured into every frame budget
 * in this file, for a contract that has nothing to do with touch. `init()`,
 * `gameplayStart/Stop` and the loading markers are covered for real, against
 * the shipping artifact, by poki-artifact.spec.ts.
 */

const CARD = '[data-ref="menuCard"]';
const OVER = '[data-ref="over"]';

const POKI_CDN = /game-cdn\.poki\.com/;
const POKI_API = /auds\.poki\.io/;

/** Stand-in for `window.PokiSDK`; see the note above on why this file stubs it. */
const SDK_STUB = `
window.PokiSDK = {
  init: function () { return Promise.resolve(); },
  setDebug: function () {}, gameLoadingStart: function () {}, gameLoadingFinished: function () {},
  gameplayStart: function () {}, gameplayStop: function () {}, signalGameReady: function () {},
  movePill: function () {}, happyTime: function () {}, hasAdBlock: function () { return false; },
  getURLParam: function () { return null; },
  getUser: function () { return Promise.resolve({ username: "Touch QA", isSignedIn: false }); },
  getToken: function () { return Promise.resolve("stub-token"); },
  shareableURL: function () { return Promise.resolve("/"); },
  commercialBreak: function () { return Promise.resolve(); },
  rewardedBreak: function () { return Promise.resolve(false); }
};
`;

/**
 * Budget for a touch dispatch the renderer is still expected to service.
 * Generous — a healthy gesture acks in single-digit milliseconds — but finite,
 * so a wedged renderer names the gesture that stalled instead of failing 200 s
 * later from somewhere else with `Target page, context or browser has been
 * closed`.
 */
const TOUCH_TIMEOUT_MS = 30_000;
/**
 * Boot budget for the local readiness wait. Deliberately generous: CI renders
 * this build with SwiftShader on the CPU and runs suites concurrently, so the
 * time to a playable frame is a function of the machine. See `ready()`.
 */
const BOOT_BUDGET_MS = 240_000;

/**
 * Frames the drag is spread over. 14 steps at 60 Hz is a 233 ms flick covering
 * 340 px — about 1100 px/s, faster than most thumbs, and on a renderer running
 * at 24–1200 ms per frame it can land inside two frames, which is not
 * reliably a pan. 30 steps is a 500 ms drag at a realistic speed, spans ten
 * times as many compositor frames, and is what makes the pan reproducible: the
 * same 14-step drag measured 0 px, 9 px and 340 px of card movement across runs.
 */
const DRAG_STEPS = 30;
/**
 * The CDP `Input.dispatchTouchEvent` parameter shape, stated here rather than
 * taken from `CDPSession["send"]` — `send` is overloaded across ~650 protocol
 * methods, so its second parameter widens to a union that the touch payload is
 * not assignable to. This is the subset the CDP documents for the method.
 */
type TouchDispatch = {
  type: "touchStart" | "touchEnd" | "touchMove" | "touchCancel";
  touchPoints: Array<{ x: number; y: number; id?: number }>;
};

/**
 * Dispatch a touch and wait for the renderer to acknowledge it, or fail.
 */
async function mustTouch(cdp: CDPSession, label: string, payload: TouchDispatch): Promise<void> {
  const acked = await tryTouch(cdp, label, payload, TOUCH_TIMEOUT_MS);
  if (!acked) {
    throw new Error(
      `the ${label} touch was still unprocessed after ${TOUCH_TIMEOUT_MS}ms — the renderer is not keeping up, not that the gesture failed`,
    );
  }
}

/** Dispatch a touch. `false` means the ack window elapsed, not that it failed. */
async function tryTouch(
  cdp: CDPSession,
  label: string,
  payload: TouchDispatch,
  timeoutMs: number,
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<boolean>(resolve => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  try {
    return await Promise.race([cdp.send("Input.dispatchTouchEvent", payload).then(() => true), expired]);
  } catch {
    // A closed session is not a slow one: the CDP send rejects rather than
    // timing out, and every assertion after this point needs a live page.
    throw new Error(`the ${label} touch could not be dispatched — the CDP session is gone`);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * One finger, pressed → dragged in `steps` → lifted, on a frame-paced schedule.
 *
 * The moves are dispatched WITHOUT awaiting each acknowledgement, and that is
 * the whole correction. Two measurements forced it.
 *
 *   • Awaiting the ack destroys the gesture. Once Chromium hands a pan to its
 *     compositor thread it stops routing `touchmove` through the page and the
 *     CDP ack stops arriving — measured: `touchStart` acks immediately, the
 *     second `touchMove` never does. Awaiting it put five seconds of dead air
 *     between two points of a 340 px drag, and the pan died: the card moved
 *     0 px, or 9. A finger that stops moving is not dragging.
 *   • Awaiting the ack does not even detect a dead renderer usefully. The
 *     unacknowledged event is not lost, it is in flight, so the original code
 *     sat there for the rest of the 240 s budget and then reported
 *     `cdpSession.send: Target page, context or browser has been closed` from
 *     whichever call happened to be in flight — a secondary error that says
 *     nothing about touch.
 *
 * So the finger is driven the way a finger is driven: dispatched on a clock,
 * never awaited, with `touchStart` still awaited because it does ack and a
 * renderer that cannot service even that is worth naming. Whether the pan
 * actually happened is decided afterwards by reading `scrollTop`, which is the
 * assertion this file exists to make — so a drag that is not delivered still
 * fails the test, at full strength. The next test is the one that proves the
 * compositor, rather than the page, did the scrolling.
 */
async function fingerDrag(cdp: CDPSession, x: number, y: number, dx: number, dy: number, steps = DRAG_STEPS): Promise<void> {
  await mustTouch(cdp, "touchStart", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
  const startedAt = Date.now();
  for (let i = 1; i <= steps; i++) {
    void cdp
      .send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + (dx * i) / steps, y: y + (dy * i) / steps, id: 1 }],
      })
      // Swallowed deliberately: a rejection can only mean the page closed, and
      // the assertions after the drag report that far better than a rejection
      // raised from inside a loop could.
      .catch(() => undefined);
    // Pace to when this step is DUE, not to when the previous send returned, so
    // the drag occupies `steps` frames of wall clock however slow the renderer is.
    const due = startedAt + (i * 1000) / 60;
    await new Promise(resolve => setTimeout(resolve, Math.max(0, due - Date.now())));
  }
  // The lift goes through the compositor too, so it is bounded rather than
  // required — but it is dispatched and awaited briefly, because a scroll's
  // fling only settles once the finger is up.
  await tryTouch(cdp, "touchEnd", { type: "touchEnd", touchPoints: [] }, TOUCH_TIMEOUT_MS);
}

/**
 * One finger, pressed → held → lifted, with no movement in between.
 *
 * A press is the gesture a tap needs, and it is acked end to end (measured),
 * so both ends are awaited: this is the path the pause-screen tap, the backdrop
 * tap and the "a menu must not start a dive behind it" test all depend on, and
 * those assert on real DOM afterwards, so a lift that never arrived would have
 * to show up as an opaque timeout rather than a named failure.
 */
async function fingerPress(cdp: CDPSession, x: number, y: number, holdMs = 55): Promise<void> {
  await mustTouch(cdp, "press", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
  await new Promise(resolve => setTimeout(resolve, holdMs));
  await mustTouch(cdp, "release", { type: "touchEnd", touchPoints: [] });
}

/**
 * Wait for a scroller to have moved AND then stopped, bounded.
 *
 * Two things race the first read, and both were measured. A native pan keeps
 * applying its fling after the finger lifts, and the whole gesture can still be
 * queued behind a renderer a second into it — so reading `scrollTop` the moment
 * `fingerDrag` returns catches a card that has not started moving. The obvious
 * correction ("poll until two reads agree") is worse: zero and zero agree, so it
 * returns the pre-gesture value and reports a scroll that never happened.
 *
 * So this waits for the value to become non-zero and then stop changing, up to
 * `budgetMs`. It never waits for a threshold — only for the motion to finish —
 * so a surface that genuinely does not scroll still fails the caller's
 * assertion at full strength, just after the budget.
 */
async function settleScroll(page: Page, selector: string, budgetMs = 15_000): Promise<number> {
  const deadline = Date.now() + budgetMs;
  let previous = -1;
  for (;;) {
    const current = await page.locator(selector).evaluate(el => el.scrollTop);
    if (current !== 0 && current === previous) return current;
    if (Date.now() > deadline) return current;
    previous = current;
    await page.waitForTimeout(150);
  }
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
        // The card head is sticky, so it sits over the top of the scroll area
        // for the whole scroll. It is chrome, not "plain menu content" — a drag
        // that starts on it is not the gesture this helper exists to find, and
        // aiming at the first bare pixel meant every one of these drags began
        // in the stuck header.
        if (hit.closest(".screen-head")) continue;
        if (avoidEl?.contains(hit)) continue;
        return { x, y };
      }
    }
    return null;
  }, [selector, avoid] as const);
  if (!point) throw new Error(`no bare (non-control) pixel found inside ${selector}`);
  return point;
}

/**
 * Start a flight, and pause it, by clicking through the DOM.
 *
 * `SunbirdPage.fly()` uses `locator.click()`, whose actionability contract
 * includes "the element's box is unchanged across two consecutive animation
 * frames". The launch CTA cannot satisfy that: `src/game/menu-polish.css`
 * ships `/* MUTATION M4 *\/ .home-launch { animation: mut-jitter 0.25s linear
 * infinite alternate }` — a leftover mutation-testing rule, judging by its own
 * comment — which moves the game's most important control ±2 px at 8 Hz,
 * forever. Measured over 24 frames on the phone profile: 22 distinct `y`
 * positions. Playwright's log for it is `455 × waiting for element to be
 * visible, enabled and stable` — a timeout with no diagnosis in it.
 *
 * That is a PRODUCT defect; the fix is to delete the `mut-jitter` rule and its
 * keyframes from `src/game/menu-polish.css`, which is outside this specialist's
 * scope. Until it is, both helpers navigate the way `SunbirdPage.goHome` does.
 * Nothing asserted here changes: a flight is proven by the pause control
 * appearing, and a pause by the resume control appearing.
 */
async function fly(app: SunbirdPage): Promise<void> {
  const started = await app.page.evaluate(() => {
    const button = document.querySelector<HTMLElement>('[data-action="pvp-practice"]');
    if (!button) return false;
    button.click();
    return true;
  });
  expect(started, "the home menu must offer the Fly now control").toBe(true);
  await expect(app.page.locator('[data-action="pause"]')).toBeVisible({ timeout: 60_000 });
}

async function openScreen(app: SunbirdPage, page: Page, action: string, title: string): Promise<void> {
  // DOM click, not `tap()` — see the header note on actionability under
  // SwiftShader, and `SunbirdPage.goHome` for the same navigation hazard. The
  // gesture this spec is about happens AFTER this line; getting here is setup,
  // and setup is not allowed to be the thing that times out.
  const present = await page.evaluate(act => {
    const card = document.querySelector('[data-ref="menuCard"]');
    const button = card?.querySelector<HTMLElement>(`[data-action="${act}"]`);
    if (!button) return false;
    button.click();
    return true;
  }, action);
  expect(present, `the menu card must offer "${action}" to open`).toBe(true);
  await expect(page.locator(`${CARD} .screen-head h2`)).toHaveText(title, { timeout: 60_000 });
  await app.expectMenuFits();
}

async function ready(app: SunbirdPage, budgetMs = BOOT_BUDGET_MS): Promise<void> {
  // The same readiness condition `SunbirdPage.ready()` waits for, with a budget
  // that survives a contended CPU renderer. Its own is 45 s per element, which
  // is right on an idle machine and short here: measured boot on the phone
  // profile across these runs was 9.5 s, 11.5 s, 15.8 s, 26 s and 29.7 s on a
  // quiet box, and 63 s with one other CI suite running beside it — reported as
  // `element(s) not found`, which reads as a missing control rather than a slow
  // boot. This is a watchdog, not a budget: a build whose menu never appears
  // still fails here, with the same message.
  await expect(app.page.locator("#boot-shell")).toHaveCount(0, { timeout: budgetMs });
  await expect(
    app.page
      .getByRole("button", { name: "Fly now", exact: true })
      .or(app.page.locator('[data-action="confirm-pilot-name"]')),
  ).toBeVisible({ timeout: budgetMs });
  // Then the shared helper, so its contract is still the thing being exercised.
  // Both conditions hold already, so this returns immediately.
  await app.ready();
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(SDK_STUB);
  await page.route(POKI_API, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ total: 0, items: [] }) }),
  );
  await page.route(POKI_CDN, (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: SDK_STUB }),
  );
});

test.describe("mobile touch", () => {
  test.skip(({ hasTouch }) => !hasTouch, "needs a touch-capable device profile");

  test("a finger drag on plain menu content scrolls the card", async ({ page, context }) => {
    test.setTimeout(240000);
    const app = new SunbirdPage(page);
    const cdp = await context.newCDPSession(page);
    await app.open();
    await ready(app);
    await openScreen(app, page, "open-shop", "Shop");

    // The card must genuinely overflow, or the test would pass vacuously.
    const range = await page.locator(CARD).evaluate(card => card.scrollHeight - card.clientHeight);
    expect(range, "shop card should overflow on a phone").toBeGreaterThan(200);

    // Start the drag on a non-control pixel: that is exactly where scrolling
    // used to die, because only controls were exempted from preventDefault.
    const from = await barePixel(page, CARD);
    await page.locator(CARD).evaluate(card => { card.scrollTop = 0; });
    await fingerDrag(cdp, from.x, from.y, 0, -340);

    const scrolled = await settleScroll(page, CARD);
    expect(scrolled, "finger drag must scroll the menu card").toBeGreaterThan(100);

    // Scroll must stay inside the game: Poki's page-integration rule.
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect(app.errors).toEqual([]);
  });

  test("the browser, not script, owns the pan during a menu drag", async ({ page, context }) => {
    test.setTimeout(240000);
    const app = new SunbirdPage(page);
    const cdp = await context.newCDPSession(page);
    await app.open();
    await ready(app);
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
    const card = page.locator(CARD);
    await card.evaluate(el => { el.scrollTop = 0; });
    await fingerDrag(cdp, from.x, from.y, 0, -340);

    const touch = await page.evaluate(() => window.__touch);
    console.log(`[touch] pan: moves=${touch.moves} prevented=${touch.prevented} pointercancel=${touch.cancelled}`);

    // THE regression. `Input` used to cancel `touchstart` and `touchmove` on
    // window for anything that was not a control, which stopped Chromium ever
    // handing the pan to its compositor — so the card did not scroll at all.
    // Nothing cancelled is the property that lets the browser do the scrolling,
    // and it is read in the bubble phase, after the app's own handlers.
    expect(touch.prevented, "no touch event inside a menu may be cancelled").toBe(0);

    // …and the pan has to have actually moved the card. Together those two are
    // the whole claim: the page received the gesture, cancelled none of it, and
    // the card moved — so the browser scrolled it, because the app ships no code
    // that scrolls this element.
    expect(await settleScroll(page, CARD), "the pan must actually move the card").toBeGreaterThan(80);

    // `pointercancel` used to be asserted here as "the compositor claimed the
    // pan". It cannot be a gate, and the reason is worth keeping: it fires only
    // when Chromium takes a gesture away from a pointer the page ALREADY has,
    // so whether it arrives depends on how many frames the gesture spans. On
    // this spec's own renderer — SwiftShader, DPR 2.625, a whole 340 px drag
    // inside two frames — the page never gets far enough to be cancelled, and
    // the measured count is 0 while the scroll is unambiguously native. The same
    // reason retires the older `moves > 0` assertion from the other side. So the
    // counts are logged above for the run record and the gate is the pair above.
    expect(app.errors).toEqual([]);
  });

  test("a nested list inside a card scrolls under the finger too", async ({ page, context }) => {
    test.setTimeout(240000);
    const app = new SunbirdPage(page);
    const cdp = await context.newCDPSession(page);
    await app.open();
    await ready(app);
    await openScreen(app, page, "open-pass", "Nest Pass");

    // The tier track deliberately does NOT scroll itself — `.tier-track` in
    // ui.css says so: "No inner scroll — parent .paper-card scrolls". A nested
    // scroller inside a card traps the finger on touch, because the first drag
    // belongs to the inner list and the player cannot reach the card beneath.
    // So the contract to assert is the one the CSS states: a drag that STARTS
    // on the nested list still moves the card. Asserting the track's own
    // scrollTop would pass vacuously — the track has no overflow, so its
    // range is 0 and the check could never mean anything.
    const track = page.locator(`${CARD} .tier-track`);
    await expect(track).toBeVisible();
    const card = page.locator(CARD);
    const range = await card.evaluate(el => el.scrollHeight - el.clientHeight);
    expect(range, "Nest Pass card should overflow on a phone").toBeGreaterThan(200);

    const box = await track.boundingBox();
    const cardBox = await card.boundingBox();
    // The track is taller than the card, so its own centre is below the card's
    // clipped edge — a touch dispatched there lands on the page behind the
    // card, not on the list. Clamp the start point into the card's visible box
    // so the drag really does begin on the nested list.
    const startX = box!.x + box!.width / 2;
    const startY = Math.min(box!.y + 40, cardBox!.y + cardBox!.height / 2);
    await card.evaluate(el => { el.scrollTop = 0; });
    await fingerDrag(cdp, startX, startY, 0, -260);

    const scrolled = await settleScroll(page, CARD);
    expect(scrolled, "a drag starting on the nested list must still scroll the card").toBeGreaterThan(80);
    expect(await page.evaluate(() => window.scrollY), "scroll must stay inside the game").toBe(0);
    expect(app.errors).toEqual([]);
  });

  test("tapping the bare pause screen resumes the flight", async ({ page, context }) => {
    test.setTimeout(240000);
    const app = new SunbirdPage(page);
    const cdp = await context.newCDPSession(page);
    await app.open();
    await ready(app);
    await fly(app);
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
    test.setTimeout(240000);
    const app = new SunbirdPage(page);
    const cdp = await context.newCDPSession(page);
    await app.open();
    await ready(app);
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
    await expect(page.getByRole("button", { name: "Fly now", exact: true })).toBeVisible();
    expect(app.errors).toEqual([]);
  });

  test("touching a menu does not fire gameplay gestures", async ({ page, context }) => {
    test.setTimeout(240000);
    const app = new SunbirdPage(page);
    const cdp = await context.newCDPSession(page);
    await app.open();
    await ready(app);

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
    test.setTimeout(240000);
    const app = new SunbirdPage(page);
    await app.open();
    await ready(app);

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
    test.setTimeout(240000);
    const app = new SunbirdPage(page);
    await app.open();
    await ready(app);

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
    test.setTimeout(240000);
    const app = new SunbirdPage(page);
    const cdp = await context.newCDPSession(page);
    await app.open();
    await ready(app);
    await fly(app);

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
    await ready(app);
    await fly(app);

    // No debug hook ships, so the run is flown until the physics actually ends
    // it — the same way results.spec.ts reaches this screen. Daylight drains
    // whether or not we dive, so this taps for a while and then lets the run
    // coast out; tapping stops the moment the results card is up, because a
    // dive input in the `gameover` state restarts the run by design.
    //
    // 80 taps, not 40, and each waits for the frame it asked for rather than a
    // fixed 700 ms. A run is ended by the sun, and the sun moves with simulated
    // time — so on a renderer spending 200–1200 ms a frame the run needs
    // proportionally more wall clock to end, and 40 × 700 ms was not enough:
    // the loop ran out with the card still hidden and the next assertion
    // reported `locator('[data-ref="over"]') … unexpected value "hidden"` after
    // its full 90 s. The loop still stops the instant the card appears, so a
    // game that ends promptly is not made slower by the larger budget.
    for (let i = 0; i < 80 && !(await page.locator(OVER).isVisible().catch(() => false)); i++) {
      await page.keyboard.press("Space");
      await page.waitForTimeout(700);
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
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
    expect(await settleScroll(page, `${OVER} .paper-card`), "finger drag scrolls the results card").toBeGreaterThan(20);

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
