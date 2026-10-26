import { test, expect } from "@playwright/test";
import { formatDistance } from "../src/game/math";
import { SunbirdPage } from "./SunbirdPage";

test("a real completed flight puts replay first and preserves results when browsing the shop", async ({ page }, info) => {
  // 180s was not enough for this test's own work, let alone the game: the
  // daylight clock is deliberately left to run out, and that wait is allowed
  // 140s of it. What is left covers rendering the results card and drawing the
  // share postcard on CPU-rasterised SwiftShader.
  //
  // It did NOT cover a share-card download, and no budget ever would: see the
  // share step below. `waitForEvent("download")` was waiting for a build this
  // repository cannot produce, so raising the timeout to 420s only made the
  // same impossible wait longer.
  test.setTimeout(420000);
  await page.setViewportSize({ width: 320, height: 568 });
  // Record the postcard canvas the moment the game draws it. The share card is
  // a real 1000x620 PNG, and that stays asserted below — it is simply asserted
  // where it is observable. It used to be asserted indirectly, as the bytes of
  // a file download, which this build is built never to perform (see the
  // comment at the share step).
  await page.addInitScript(() => {
    const seen = { width: 0, height: 0, dataUrlHead: "" };
    (window as unknown as { __shareCard: typeof seen | null }).__shareCard = null;
    // Widened on purpose: getContext/toDataURL are overloaded, and a patch that
    // has to restate those overloads is a patch nobody can read.
    const proto = HTMLCanvasElement.prototype as unknown as {
      getContext: (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) => unknown;
      toDataURL: (this: HTMLCanvasElement, ...args: unknown[]) => string;
    };
    const getContext = proto.getContext;
    const toDataURL = proto.toDataURL;
    proto.getContext = function (this: HTMLCanvasElement, kind, ...rest) {
      const ctx = getContext.call(this, kind, ...rest);
      if (kind === "2d" && this.width === 1000 && this.height === 620) {
        seen.width = this.width;
        seen.height = this.height;
        (window as unknown as { __shareCard: typeof seen | null }).__shareCard = seen;
      }
      return ctx;
    };
    proto.toDataURL = function (this: HTMLCanvasElement, ...args) {
      const url = toDataURL.call(this, ...args);
      if (this.width === 1000 && this.height === 620) seen.dataUrlHead = url.slice(0, 22);
      return url;
    };
  });
  await page.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined, configurable: true }));
  const app = new SunbirdPage(page);
  await app.open(); await app.ready(); await app.fly();
  // Let the actual daylight clock end a no-input flight; no shipped test hooks,
  // accelerated physics or manufactured results DOM.
  await expect(page.locator('[data-ref="continue"]:not(.hidden), [data-ref="over"]:not(.hidden)')).toBeVisible({ timeout: 140000 });
  const sleep = page.locator('[data-action="continue-sleep"]');
  if (await sleep.isVisible()) await sleep.click();
  const result = page.locator('[data-ref="over"]');
  await expect(result).toBeVisible();
  // The card names WHY the run ended, it does not say "Flight completed" for
  // every death — three different reasons used to produce one line that no
  // player could act on. This flight deliberately runs the daylight clock out,
  // so the title is pinned to that reason: a weaker `toBeVisible()` here would
  // pass no matter which reason the game reported, including none at all.
  await expect(result.getByRole("heading", { name: "The sun beat you", exact: true })).toBeVisible();
  await expect(result.locator(".end-reason")).toContainText("daylight ran out");
  await expect(result.locator(".result-actions .play-again-btn")).toBeInViewport({ ratio: 1 });
  await expect(result.locator(".play-again-btn")).toHaveCount(1);
  const bounds = await result.locator(".paper-card").boundingBox();
  const toasts = await page.locator('[data-ref="toasts"]').boundingBox();
  if (toasts && toasts.height && bounds) expect(bounds.y + bounds.height).toBeLessThanOrEqual(toasts.y);
  await page.screenshot({ path: info.outputPath("results-320.png") });
  await page.setViewportSize({ width: 568, height: 320 });
  await expect(result.locator(".result-actions .play-again-btn")).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: info.outputPath("results-568.png") });
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(result.locator(".next-flight")).toContainText("NEXT FLIGHT");
  // The share button's real contract on THIS build, and the reason the old
  // `waitForEvent("download")` sat here forever:
  //
  //   vite.config.ts pins VITE_PORTAL_TARGET to the literal "poki" for every
  //   `vite build` ("sunbird-poki is always the Poki portal build"), so
  //   `isPortalBuild()` is unconditionally true, `Game.shareRun` calls
  //   `shareOrDownload(card, undefined, !this.portalEnabled())`, and
  //   `allowDownload === false` returns out of `Social.shareOrDownload` BEFORE
  //   the `<a download>` is built. Portal QA flags image downloads, and the
  //   player is handed the run's text instead — via the manual-copy dialog,
  //   because the clipboard is refused inside a portal frame.
  //
  // So a PNG download is not a slow step here, it is a build this repository
  // cannot produce: its own tests pin both halves of that
  // (src/game/__tests__/share-delivery.test.ts, poki-build-ids.test.ts).
  // What replaces the download assertion is strictly more behaviour, not less:
  // the postcard really is rasterised at the documented 1000x620 and really is
  // a PNG, the text the player is handed really is THIS run's distance, and no
  // file is initiated behind their back.
  let initiatedDownloads = 0;
  page.on("download", () => { initiatedDownloads += 1; });
  await result.locator('[data-action="share"]').click();
  const copyDialog = page.getByRole("dialog", { name: "Copy manually", exact: true });
  await expect(copyDialog).toBeVisible();
  const shareText = await copyDialog.getByLabel("Text to copy").inputValue();
  // The product's own share grammar, pinned in src/game/__tests__/social.test.ts.
  const sharedDistance = /^I flew ([\d,]+)m in Sunbird/.exec(shareText);
  expect(sharedDistance, `share text was not the flight payload: ${shareText}`).not.toBeNull();
  // …and it is THIS flight's distance, not a fixture: the share payload and the
  // results card are two renderings of one number, so the card must read back
  // as exactly what the product's OWN formatter makes of the shared metres. The
  // formatter is imported rather than re-implemented because the card renders
  // km above 1000 m and grouped metres below it, and a hand-rolled parse here
  // would quietly compare two different numbers ("1.07 km" read as 107).
  const sharedMetres = Number(sharedDistance![1]!.replace(/,/g, ""));
  expect(sharedMetres).toBeGreaterThan(0);
  const cardDistance = (await result.locator(".result-summary b").first().innerText()).trim();
  expect(cardDistance).toBe(formatDistance(sharedMetres, "en"));
  // The postcard was really drawn, at the size the card promises, as a PNG.
  const drawn = await page.evaluate(() => (window as unknown as { __shareCard?: { width: number; height: number; dataUrlHead: string } | null }).__shareCard ?? null);
  expect(drawn).not.toBeNull();
  expect(drawn!.width).toBe(1000);
  expect(drawn!.height).toBe(620);
  expect(drawn!.dataUrlHead).toBe("data:image/png;base64,");
  // Dismissed before the shop step: this overlay covers the results card.
  await copyDialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(copyDialog).toHaveCount(0);
  // The negative half of the portal contract. A download that never arrives is
  // only evidence after the browser has had a window to start one; the click
  // above is synchronous inside the page, so a short settle is the whole test.
  await page.waitForTimeout(500);
  expect(initiatedDownloads).toBe(0);
  await result.locator('[data-action="open-shop"]').click();
  const card = page.locator('[data-ref="menuCard"]');
  await expect(card.locator(".screen-head h2")).toHaveText("Shop");
  await card.getByRole("button", { name: "Back", exact: true }).click();
  await expect(result).toBeVisible();
  await result.locator(".result-actions .play-again-btn").click();
  await expect(page.locator('[data-action="pause"]')).toBeVisible();
  expect(app.errors).toEqual([]);
});
