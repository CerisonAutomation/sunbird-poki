import { test, expect, type Page } from "@playwright/test";
import { CONTINUE_COST, CONTINUE_TIMEOUT } from "../src/game/constants";
import { formatDistance } from "../src/game/math";
import { SunbirdPage } from "./SunbirdPage";

/**
 * The end-of-run surface: the second-wind offer, the results card, and its
 * three loops (fly again, share card, challenge link). Death here is real —
 * the flight actually runs and the physics ends the run — which makes this
 * the closest e2e proxy for the Poki Inspector's event-log walkthrough.
 *
 * "Fly until dead" is a MINUTE-long flight, and that is the whole reason this
 * file used to sit red for ~50 s a test. A run ends in `Game.onDaylightOut`,
 * the solo day is `DAYLIGHT_MAX` = 52 s, and nothing ends it sooner: the
 * settle rule (`stepSettleAndGoals`) needs `bird.speed() < 4`, while `Bird`
 * holds a `MIN_KEEP_SPEED` = 12 floor along the ground and in the water, so
 * the `settled` and `water` reasons never fire and the daylight clock always
 * decides. The old helper budgeted 30 s for it and then waited on a
 * still-flying bird — its own failure snapshot shows a live daylight bar, the
 * Pause control, a coach hint and 578 m on the clock. Measured end of flight
 * on a quiet box is 54–59 s; see `RUN_END_TIMEOUT` for why the budget is set
 * in wall clock and not in daylight.
 *
 * What the run ends ON is worth stating too, because two assertions here used
 * to promise otherwise:
 *   • the results card's heading is `END_REASON_TITLE[endReason]`
 *     (src/game/hud/run.ts). Three deaths used to draw one card reading
 *     "Flight completed"; "Flight completed" survives only as the
 *     unknown-reason fallback, so pinning it pins the fallback.
 *   • the rewarded option on the second-wind card is `menuIconSm("play")`
 *     plus a label, not the "🎬" glyph this file used to assert. The glyph is
 *     gone from the whole product.
 */

/**
 * A whole solo day, in WALL clock — and that is the number that has to be
 * generous. `Game.fixedUpdate` runs physics on a fixed step and DROPS the
 * backlog past `MAX_CATCHUP_STEPS` (it even tracks `sim_backlog_dropped`), so
 * a starved frame rate does not slow the flight down, it runs it in slow
 * motion: 52 s of daylight measures 55 s on a quiet box and past 150 s on one
 * where other suites are sharing the CPU. The budget has to cover the slow
 * box, or the gate reports the weather.
 */
const RUN_END_TIMEOUT = 240_000;

/**
 * Per-test budget for the same reason, and with room for what each test does
 * after the run ends. `results-layout.spec.ts` sets 420 s for one flight on
 * the same grounds ("180 s was not enough for this test's own work, let alone
 * the game"); every test here flies that flight and then exercises a loop.
 */
test.describe.configure({ timeout: 420_000 });

/**
 * The two lines the results card draws per ending, from `END_REASON_TITLE` /
 * `END_REASON_LINE` in `src/game/hud/run.ts` (module-private, hence mirrored).
 * Pairing a title with its own explanation is what makes the assertion real:
 * a card showing the generic fallback fails the membership check, and a title
 * with the wrong line under it fails the second.
 */
const END_REASON_LINES = {
  "The sun beat you": "daylight ran out",
  "You washed out": "The sea took the run",
  "You stopped flying": "Four seconds without flying",
} as const;

/** Fly a real flight to its real end, and report which surface opened. */
async function flyUntilDead(page: Page, app: SunbirdPage): Promise<"continue" | "over"> {
  await app.fly();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Space");
    await page.waitForTimeout(550);
  }
  // Two destinations, and only two: the second wind counts itself down to the
  // results card, and an unentitled run goes there directly. Asserted against
  // both rather than one, because a test that waits for the wrong one cannot
  // tell "the game changed" from "the game never got there".
  await expect(page.locator('[data-ref="continue"]:not(.hidden), [data-ref="over"]:not(.hidden)')).toBeVisible({
    timeout: RUN_END_TIMEOUT,
  });
  return (await page.locator('[data-ref="continue"]:not(.hidden)').isVisible()) ? "continue" : "over";
}

/** The free, always-present exit out of the second wind. */
async function letItSleep(page: Page): Promise<void> {
  await page.locator('[data-ref="continue"] [data-action="continue-sleep"]').click();
  await expect(page.locator('[data-ref="over"]')).toBeVisible({ timeout: 15_000 });
}

/** The heading/reason pair on the results card, checked for consistency. */
async function endReason(page: Page): Promise<string> {
  const title = (await page.locator('[data-ref="over"] h2').innerText()).trim();
  expect(Object.keys(END_REASON_LINES), `the results card said "${title}"`).toContain(title);
  await expect(page.locator('[data-ref="over"] .end-reason')).toContainText(
    END_REASON_LINES[title as keyof typeof END_REASON_LINES],
  );
  return title;
}

async function cardFits(page: Page, selector: string): Promise<void> {
  const r = await page.locator(selector).evaluate(el => {
    const box = el.getBoundingClientRect();
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, overflow: el.scrollWidth - el.clientWidth };
  });
  const viewport = page.viewportSize()!;
  expect(r.left).toBeGreaterThanOrEqual(0);
  expect(r.top).toBeGreaterThanOrEqual(0);
  expect(r.right).toBeLessThanOrEqual(viewport.width + 1);
  expect(r.bottom).toBeLessThanOrEqual(viewport.height + 1);
  expect(r.overflow).toBeLessThanOrEqual(1);
}

test("the second-wind card always shows the standard alternatives beside the clock", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  expect(await flyUntilDead(page, app)).toBe("continue");

  const cont = page.locator('[data-ref="continue"]');
  await expect(cont.locator("h2")).toHaveText("Second wind?");
  // The free exit is never hidden and never the only way out (MON-08).
  const sleep = cont.locator('[data-action="continue-sleep"]');
  await expect(sleep).toBeVisible();
  await expect(sleep).toBeEnabled();
  // The coin option states its price AND the wallet it is judged against, so
  // the deal is legible before the tap — and it is enabled exactly when that
  // wallet covers the price. Both numbers are read back out of the card
  // rather than assumed, because the flight pays the wallet as it goes.
  const coins = cont.locator('[data-action="continue-coins"]');
  await expect(coins).toBeVisible();
  const label = (await coins.innerText()).replace(/\s+/g, " ");
  expect(label).toContain(`Spend ${CONTINUE_COST}`);
  // The price is marked as coins by a glyph, not by the "●" character: HUD's
  // renderCoins() rewrites every bullet in the rendered HTML to an inline
  // COIN_SVG (src/game/__tests__/coin-glyph.test.ts), so the text alone is
  // "Spend 80" and a bare number would say nothing about what it costs.
  await expect(coins.locator("svg.coin-glyph")).toHaveCount(1);
  const shown = Number(/you have (\d+)/.exec(label)?.[1] ?? "0");
  await expect(coins).toBeEnabled({ timeout: 5_000 });
  expect(shown, `card said "${label}" while offering a disabled coin option`).toBeGreaterThanOrEqual(CONTINUE_COST);
  // The countdown is the load-bearing half: exactly one live region, it
  // carries the number, and the number is a real time left. This is the
  // e2e half of the contract src/game/__tests__/second-wind-countdown.test.ts
  // pins in markup — the strip is announced, and no stylesheet hides it.
  const status = cont.locator('[role="status"]');
  await expect(status).toHaveCount(1);
  const timer = status.locator('[data-live="contTimer"]');
  await expect(timer).toBeVisible();
  const remaining = Number((await timer.innerText()).trim());
  expect(remaining).toBeGreaterThan(0);
  expect(remaining).toBeLessThanOrEqual(CONTINUE_TIMEOUT);
  // The rewarded option, when this session has a portal ad surface to serve
  // it, shares that same live region rather than replacing the clock — which
  // is the "never instead of the standard options" half of MON-05…MON-08.
  // Whether the button renders at all is deliberately not asserted: the
  // shipped bundle folds isPortalBuild() to true and SIMULATED_BREAKS to
  // false, so the card renders the plain strip the moment the SDK is absent
  // or ad-blocked, and src/game/__tests__/ad-honesty.test.ts exists to keep
  // that honest. What must hold in both branches is what is asserted above.
  const ad = status.getByRole("button");
  if (await ad.count()) await expect(ad).toContainText("Second Wind");
  await cardFits(page, '[data-ref="continue"] .paper-card');
  expect(app.errors).toEqual([]);
});

test("\"End the flight\" completes the run to the full results card", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  expect(await flyUntilDead(page, app)).toBe("continue");
  await letItSleep(page);
  const over = page.locator('[data-ref="over"]');
  // Sleeping is an exit, not a second death: the run keeps the reason it
  // already had, and the card has to say which one it was.
  await endReason(page);
  await expect(over.getByRole("button", { name: "Fly Again" })).toBeVisible();
  await expect(over.getByRole("button", { name: "Main Menu" })).toBeVisible();
  await expect(over.locator('[data-action="share"]')).toBeVisible();
  await expect(over.locator('[data-action="throw-challenge"]')).toBeVisible();
  await cardFits(page, '[data-ref="over"] .paper-card');
  expect(app.errors).toEqual([]);
});

test("the challenge link embeds the shared seed and offers a manual-copy fallback", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new DOMException("Denied", "NotAllowedError")) },
    });
  });
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  expect(await flyUntilDead(page, app)).toBe("continue");
  await letItSleep(page);
  await page.locator('[data-ref="over"] [data-action="throw-challenge"]').click();
  const dialog = page.getByRole("dialog", { name: "Copy manually", exact: true });
  await expect(dialog).toBeVisible();
  const text = await dialog.getByLabel("Text to copy").inputValue();
  expect(text).toContain("Beat my");
  // The URL must carry the seed payload hash (#key=seed.distance.name) so a
  // rival loads the exact same hills.
  expect(text).toMatch(/#\w+=\S+\.\d+\.\S+/);
  // The "copied" success claim must NOT appear while the clipboard refused.
  await expect(page.getByText("Challenge link copied", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(app.errors).toEqual([]);
});

test("sharing a flight draws a real PNG card and hands the player the run's text without downloading", async ({ page }) => {
  // The card is a real PNG drawn at 1000x620, and that is observed as the game
  // draws it rather than as the bytes of a saved file: this is the Poki build
  // (vite.config.ts pins VITE_PORTAL_TARGET to the literal "poki" for every
  // build, pinned again by poki-build-ids.test.ts), so `Game.shareRun` calls
  // `shareOrDownload(..., allowDownload = !portalEnabled() = false)` and the
  // `<a download>` is never built — portal QA flags image downloads. The
  // previous version of this test waited up to 45s for that file and could only
  // ever time out. The download gate itself is covered on both sides in
  // src/game/__tests__/share-delivery.test.ts.
  await page.addInitScript(() => {
    const seen = { width: 0, height: 0, encoded: 0 };
    (window as unknown as { __shareCard: typeof seen | null }).__shareCard = null;
    // Widened on purpose: getContext/toBlob are overloaded, and a patch that
    // has to restate those overloads is a patch nobody can read.
    const proto = HTMLCanvasElement.prototype as unknown as {
      getContext: (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) => unknown;
      toBlob: (this: HTMLCanvasElement, done: (blob: Blob | null) => void, ...rest: unknown[]) => void;
    };
    const getContext = proto.getContext;
    const toBlob = proto.toBlob;
    proto.getContext = function (this: HTMLCanvasElement, kind, ...rest) {
      const ctx = getContext.call(this, kind, ...rest);
      if (kind === "2d" && this.width === 1000 && this.height === 620) {
        seen.width = this.width;
        seen.height = this.height;
        (window as unknown as { __shareCard: typeof seen | null }).__shareCard = seen;
      }
      return ctx;
    };
    // toBlob is what proves the card was actually ENCODED, not just sized. A
    // 1000x620 card that encoded to nothing would still satisfy a size check.
    proto.toBlob = function (this: HTMLCanvasElement, done, ...rest) {
      return toBlob.call(this, blob => {
        if (this.width === 1000 && this.height === 620) seen.encoded = blob ? blob.size : 0;
        done(blob);
      }, ...rest);
    };
  });
  await page.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined, configurable: true }));
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  expect(await flyUntilDead(page, app)).toBe("continue");
  await letItSleep(page);
  const over = page.locator('[data-ref="over"]');
  let initiatedDownloads = 0;
  page.on("download", () => { initiatedDownloads += 1; });
  await over.locator('[data-action="share"]').click();

  // No share sheet and a refused clipboard is the portal state, so the run's
  // TEXT is what the player gets — offered, never claimed as copied. Waiting
  // for the dialog is also what makes the encode assertion below mean
  // anything: `buildShareCard` AWAITS `canvas.toBlob`, and this dialog only
  // opens after that promise has settled, so sampling `encoded` before it
  // would measure an encode that had not happened yet.
  const dialog = page.getByRole("dialog", { name: "Copy manually", exact: true });
  await expect(dialog).toBeVisible();

  const drawn = await page.evaluate(() => (window as unknown as { __shareCard?: { width: number; height: number; encoded: number } | null }).__shareCard ?? null);
  expect(drawn, "the share card was never drawn").not.toBeNull();
  expect([drawn!.width, drawn!.height]).toEqual([1000, 620]);
  // A real rasterised postcard is tens of kilobytes; a blank 1000x620 canvas
  // encodes to a few hundred. This is the assertion that the card has content.
  expect(drawn!.encoded).toBeGreaterThan(20_000);

  const text = await dialog.getByLabel("Text to copy").inputValue();
  const sharedDistance = /^I flew ([\d,]+)m in Sunbird/.exec(text);
  expect(sharedDistance, `share text was not the flight payload: ${text}`).not.toBeNull();
  // The card's own number, read back through the product's formatter. The card
  // renders km above 1000 m and grouped metres below, so the formatter is
  // imported rather than re-implemented — a hand-rolled parse would compare
  // "1.07 km" as 107 metres and pass for the wrong reason.
  const sharedMetres = Number(sharedDistance![1]!.replace(/,/g, ""));
  expect(sharedMetres).toBeGreaterThan(0);
  const cardDistance = (await over.locator(".result-summary b").first().innerText()).trim();
  expect(cardDistance).toBe(formatDistance(sharedMetres, "en"));
  // A copy that never happened must not be announced as one, and a file must
  // not be pushed at a player on a build whose QA forbids it.
  await expect(page.getByText("Image download requested", { exact: true })).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(initiatedDownloads).toBe(0);
  expect(app.errors).toEqual([]);
});

test("an ignored second wind runs out on its own clock and lands on the same reason", async ({ page }) => {
  // The regression this file exists to hold. `CONTINUE_TIMEOUT` seconds after
  // the second-wind card opens, `Game.fixedUpdate` calls `finishRun()` with
  // no input from the player: the offer is a decision with a deadline, not a
  // screen that can hold a run hostage. Measured end to end on this machine,
  // the ignored card closes itself in ~15 s and the card that appears is the
  // SAME reason the flight had, because sleeping and running out of daylight
  // are two exits from one `onDaylightOut` call, not two deaths.
  //
  // Nothing covered that. second-wind-countdown.test.ts pins the markup and
  // the stylesheet; this is the e2e half — the timer is not just painted, it
  // is wired to the state machine.
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  expect(await flyUntilDead(page, app)).toBe("continue");
  const offered = Number((await page.locator('[data-live="contTimer"]').innerText()).trim());
  expect(offered).toBeGreaterThan(0);
  // No click, no key, no wait for a button: the run ends by itself.
  const over = page.locator('[data-ref="over"]');
  await expect(over).toBeVisible({ timeout: CONTINUE_TIMEOUT * 1_000 + 20_000 });
  // This flight is flown to the end of the day, so the reason is pinned by
  // name rather than by table: a card that fell back to the generic
  // "Flight completed" line fails here.
  await expect(over.locator("h2")).toHaveText("The sun beat you");
  await expect(over.locator(".end-reason")).toContainText("daylight ran out");
  // The second-wind card is gone, not stacked under the results card.
  await expect(page.locator('[data-ref="continue"]')).toBeHidden();
  expect(app.errors).toEqual([]);
});

test("Fly Again restarts a live run, and exit-flight from pause returns home", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  expect(await flyUntilDead(page, app)).toBe("continue");
  await letItSleep(page);
  // Fly again → fresh run is live (the in-flight pause control exists).
  await page.getByRole("button", { name: "Fly Again", exact: true }).click();
  await expect(page.locator('[data-action="pause"]')).toBeVisible({ timeout: 15_000 });
  // ESC pauses (the documented stop/start pair fires through the state
  // machine); Exit flight then returns to the home screen.
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-action="resume"]')).toBeVisible();
  await page.locator('[data-ref="pause"] [data-action="menu"]').click();
  await app.ready();
  expect(app.errors).toEqual([]);
});
