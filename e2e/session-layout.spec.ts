import { test, expect } from "@playwright/test";
import { footerAnchoredTop, messageBand, type MessageBandInput } from "../src/game/hud/messageBand";
import { SunbirdPage } from "./SunbirdPage";

for (const viewport of [{ width: 320, height: 568 }, { width: 568, height: 320 }, { width: 1280, height: 800 }]) {
  test(`real split-screen scores, countdown and controls fit at ${viewport.width}×${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    const app = new SunbirdPage(page);
    await app.open(); await app.ready(); await app.menuAction("versus").click();
    await expect(page.locator('[data-action="pause"]')).toBeVisible();
    await expect(page.locator(".versus-bar")).toBeVisible();
    await expect(page.locator(".versus-guide")).toContainText(viewport.width / viewport.height >= 1.25 ? "left" : "top");
    await expect(page.locator(".versus-guide")).toContainText("A / Space");
    await app.awaitSettledLanes();
    await app.expectNoOverlaps([".versus-bar", ".hud-controls"], ".hud-root");
    await app.expectNoOverlaps([".hud-header", ".flight-messages", ".flight-footer"], ".hud-root");
    await page.screenshot({ path: info.outputPath(`split-${viewport.width}.png`) });
    await app.pause(); await app.resume();
    expect(app.errors).toEqual([]);
  });
}

test("AI race social controls are optional, keyboard-dismissible and never steal dive input", async ({ page }, info) => {
  await page.setViewportSize({ width: 568, height: 320 });
  const app = new SunbirdPage(page);
  await app.open(); await app.ready(); await app.openMenu("open-live", "Race Lobby");
  const card = page.locator('[data-ref="menuCard"]');
  await card.locator('[data-action="open-practice"]').click();
  await card.locator('[data-action="room-size"][data-id="5"]').click();
  await expect(card.locator('[data-action="room-size"][data-id="5"]')).toHaveAttribute("aria-pressed", "true");
  await card.getByRole("button", { name: /Race the AI flock ·/ }).click();
  const toggle = page.getByRole("button", { name: /Emotes$/ });
  await expect(toggle).toBeVisible();
  await expect(page.locator(".emote-options")).toBeHidden();
  await toggle.click(); await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await app.awaitSettledLanes();
  await app.expectNoOverlaps([".hud-header", ".flight-messages", ".flight-footer", ".alt-gauge"], ".hud-root");
  await page.getByRole("button", { name: "Send Wave", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('[data-action="pause"]')).toBeVisible();
  await toggle.click(); await page.getByRole("button", { name: "Send Wave", exact: true }).click();
  await expect(page.locator(".emote-options")).toBeHidden();
  await page.screenshot({ path: info.outputPath("practice-clean-hud.png") });
  await app.pause(); await app.resume();
  expect(app.errors).toEqual([]);
});

/**
 * The emote picker is a POPUP laid out in flow inside the lane the HUD measures
 * to reserve space for persistent objectives, so opening it used to resize the
 * footer rather than overlay anything. At 568x320 that made the footer 255.5px
 * of a 320px screen — its top edge at y 52.5, inside the header's 4..132.2 box,
 * which the overlap check above reports as a 227x79px collision.
 *
 * The three assertions below are the three causes, and each one fails if its
 * own fix is reverted:
 *
 *  1. THE PICKER IS ONE ROW AND FITS. A 3-row picker of 44px buttons is 196px
 *     tall; six buttons sharing the footer's full width on one row are 38px.
 *     Reverting the `max-height: 360px` compaction — which is dead the moment
 *     it is written ABOVE the base `.emote-options button` rule, since a media
 *     query adds no specificity and `min-height: 44px` beats `height: 30px` —
 *     puts the picker back to 196px and the footer back to 255.5px.
 *  2. THE FOOTER LEAVES A CORRIDOR, not a millimetre of clearance. `expectNoOverlaps`
 *     only rejects a 1px overlap, and the band was 9.1px clear of the footer
 *     before `.stat-medal` was dropped from the header on this height. 16px is
 *     a real gap and the shortest frame is the one where a two-line coaching cue
 *     grows the band into it.
 *  3. THE PUBLISHED STACK IS THE MEASUREMENT, recomputed from the live boxes.
 *     `--hud-messages-top` is placed from `quipY`, and `.quips` hangs off
 *     `--hud-footer-bottom`, which this same publication writes — through a
 *     project-wide `transition: all 0.00001s`, so a same-task read gets the
 *     PREVIOUS position (42px too low, measured) and nothing ever corrected it.
 *     Reverting the settling pass in `HUD.publishStack` fails here while every
 *     geometric assertion still passes.
 */
test("the emote picker opens on the shortest frame without resizing the HUD out from under the band", async ({ page }, info) => {
  await page.setViewportSize({ width: 568, height: 320 });
  const app = new SunbirdPage(page);
  await app.open(); await app.ready(); await app.openMenu("open-live", "Race Lobby");
  const card = page.locator('[data-ref="menuCard"]');
  await card.locator('[data-action="open-practice"]').click();
  await card.locator('[data-action="room-size"][data-id="5"]').click();
  await card.getByRole("button", { name: /Race the AI flock ·/ }).click();
  const toggle = page.getByRole("button", { name: /Emotes$/ });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await app.awaitSettledLanes();

  const measured = await page.locator(".hud-root").evaluate(root => {
    const el = <T extends HTMLElement>(sel: string): T => root.querySelector<T>(sel)!;
    const hud = el<HTMLElement>(".play-hud");
    const hudTop = hud.getBoundingClientRect().top;
    const hudBottom = hud.getBoundingClientRect().bottom;
    const box = (node: HTMLElement) => {
      const r = node.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
    };
    const footer = el<HTMLElement>(".flight-footer");
    const buttons = Array.from(root.querySelectorAll<HTMLElement>(".emote-options button")).map(box);
    const vars = getComputedStyle(root);
    return {
      hudTop, hudBottom,
      headerBottom: box(el<HTMLElement>(".hud-header")).bottom,
      headerPx: box(el<HTMLElement>(".hud-header")).bottom - hudTop,
      footer: box(footer),
      messages: box(el<HTMLElement>(".flight-messages")),
      quipY: box(el<HTMLElement>(".quips")).top - hudTop,
      bandPx: el<HTMLElement>(".flight-messages").offsetHeight,
      handPx: el<HTMLElement>(".hand").offsetHeight,
      slopeHidden: getComputedStyle(el<HTMLElement>(".slope-chain")).display === "none",
      buttons,
      published: {
        top: Number.parseFloat(vars.getPropertyValue("--hud-messages-top")),
        max: Number.parseFloat(vars.getPropertyValue("--hud-messages-max")),
        floor: Number.parseFloat(vars.getPropertyValue("--hud-lane-floor")),
        chainClear: Number.parseFloat(vars.getPropertyValue("--hud-chain-clear")),
        footerBottom: Number.parseFloat(vars.getPropertyValue("--hud-footer-bottom")),
      },
    };
  });

  // 1. One row of six, all of them inside the window and inside the picker.
  expect(measured.buttons, "the picker rendered no buttons").toHaveLength(6);
  const rows = new Set(measured.buttons.map(b => Math.round(b.top)));
  expect(rows.size, `the picker wrapped onto ${rows.size} rows`).toBe(1);
  for (const b of measured.buttons) {
    expect(b.left, "a picker button starts off the left of the window").toBeGreaterThanOrEqual(0);
    expect(b.right, "a picker button runs off the right of the window").toBeLessThanOrEqual(568);
    expect(b.bottom, "a picker button runs off the bottom of the window").toBeLessThanOrEqual(320);
  }
  // 2. The footer is a band, not the whole screen, and it leaves a corridor.
  expect(measured.footer.height, "the footer is most of the window").toBeLessThanOrEqual(144);
  const corridor = measured.footer.top - measured.messages.bottom;
  expect(corridor, "the coaching band is on top of the objective card").toBeGreaterThanOrEqual(16);
  expect(measured.footer.top, "the footer reaches into the header").toBeGreaterThanOrEqual(measured.headerBottom);

  // 3. The published stack is what `messageBand` says for the live geometry —
  //    recomputed here through the shipping function, never restated.
  const anchoredTop = footerAnchoredTop({
    footerTop: measured.footer.top,
    hudTop: measured.hudTop,
    headerPx: measured.headerPx,
  });
  const input: MessageBandInput = {
    hudPx: measured.hudBottom - measured.hudTop,
    headerPx: measured.headerPx,
    anchoredTop,
    footerPx: anchoredTop
      ? Math.max(0, measured.footer.bottom - measured.hudTop)
      : Math.max(0, measured.hudBottom - measured.footer.top),
    quipY: measured.quipY,
    slopeY: measured.slopeHidden ? measured.hudBottom - measured.hudTop : measured.hudBottom,
    handPx: measured.handPx,
    naturalBandPx: measured.bandPx,
  };
  expect(anchoredTop, "a bottom-anchored footer was read as the portrait top-anchored one").toBe(false);
  const band = messageBand(input);
  expect(measured.published.top, "--hud-messages-top was published against a stale measurement").toBeCloseTo(band.top, 1);
  expect(measured.published.max, "--hud-messages-max was published against a stale measurement").toBeCloseTo(band.maxPx, 1);
  expect(measured.published.floor, "--hud-lane-floor was published against a stale measurement").toBeCloseTo(band.laneFloor, 1);
  expect(measured.published.chainClear, "--hud-chain-clear was published against a stale measurement").toBeCloseTo(band.chainClear, 1);
  expect(measured.published.footerBottom, "--hud-footer-bottom was published against a stale measurement").toBeCloseTo(band.footerBottom, 1);

  await page.screenshot({ path: info.outputPath("practice-picker-open-568x320.png") });
  expect(app.errors).toEqual([]);
});
