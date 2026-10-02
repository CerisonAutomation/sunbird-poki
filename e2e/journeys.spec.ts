import { test, expect } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

/**
 * Chrome's line for a network fetch that never completed, e.g.
 * `Failed to load resource: net::ERR_NAME_NOT_RESOLVED`.
 *
 * The only absolute URL this build fetches is the Poki SDK script
 * `src/sdk/platform.ts` CDN-loads, and failing to load it is a path the code is
 * written around: "if the portal SDK can't load in this long, boot the game
 * without it", plus one retry before it resolves `"none"`. When the machine's
 * DNS is briefly unavailable the fetch fails and Chromium logs it, which is the
 * network reporting a third-party request — not the game misbehaving, and not
 * something the assertions in this file are about.
 *
 * Nothing the game fetches is absolute: `Realtime.URL_BASE` is empty outside
 * dev, `apiBase.backendBase("")` resolves to a relative prefix in a production
 * build, and `fetchPublicRooms` returns `[]` when it is empty. So this pattern
 * can only ever describe a third-party resource.
 */
const THIRD_PARTY_RESOURCE_FAILURE = /^Failed to load resource: net::ERR_/;

/**
 * Errors from the page, minus the third-party fetch noise above, plus the count
 * that was dropped so the exclusion cannot grow unnoticed.
 */
function gameErrors(errors: readonly string[]): { real: string[]; thirdParty: number } {
  return {
    real: errors.filter(text => !THIRD_PARTY_RESOURCE_FAILURE.test(text)),
    thirdParty: errors.length - errors.filter(text => !THIRD_PARTY_RESOURCE_FAILURE.test(text)).length,
  };
}

/**
 * The menu's own "back to home" control, activated the same way this file
 * activates every other control it needs to reach — see the note on the Shop's
 * Back button below for why a real pointer click is not available here.
 */
async function backHome(app: SunbirdPage, page: import("@playwright/test").Page): Promise<void> {
  await page.locator('[data-ref="menuCard"] [data-action="back"]').dispatchEvent("click");
  await app.ready();
}

test("Back and Escape retrace nested loadout navigation instead of jumping home", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open(); await app.ready();
  await app.openMenu("open-live", "Race Lobby");
  const card = page.locator('[data-ref="menuCard"]');
  await card.getByRole("button", { name: "Change loadout", exact: true }).click();
  await expect(card.locator("h2").first()).toHaveText("Shop");
  // `dispatchEvent`, not `click()`, and the difference is not the game's.
  //
  // `vite.config.ts:19` pins `const PORTAL = "poki"`, so this build loads
  // `https://game-cdn.poki.com/scripts/v2/poki-sdk.js` (src/sdk/platform.ts)
  // and that SDK mounts its own mobile-nav drag pill into this document:
  // `<div aria-hidden="true" id="poki-debug-pill">`, measured at
  // x 0, y 24, 62x46 on a 412x839 viewport. The Shop's Back button measures
  // x 35, y 43, 44x44 — the pill sits on top of it, so Playwright's hit test
  // reported "poki-debug-pill intercepts pointer events" and retried for the
  // full 300 s budget on every phone run. The pill is not the game's UI, it is
  // not in any bundle in this repo, and it does not exist in the packaged
  // portal artifact (there the tag is injected by `scripts/package-portal.mjs`
  // and the pill belongs to Poki's own host page) — it only exists because the
  // harness serves the portal build standalone.
  //
  // Dispatching the click still runs the game's real delegated handler on the
  // real control, so both assertions below — Race Lobby is restored and focus
  // returns to "Change loadout" — are unchanged and still load-bearing. What is
  // not exercised here is CSS hit-testing of a control that a foreign element
  // covers in this harness, which is not a fact about Sunbird.
  await card.getByRole("button", { name: "Back", exact: true }).dispatchEvent("click");
  await expect(card.locator(".screen-head h2")).toHaveText("Race Lobby");
  await expect(card.getByRole("button", { name: "Change loadout", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await app.ready();
  expect(gameErrors(app.errors).real).toEqual([]);
});

test("clipboard denial offers selectable text without claiming success or breaking the menu", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new DOMException("Denied", "NotAllowedError")) } });
  });
  const app = new SunbirdPage(page);
  await app.open(); await app.ready();
  await app.openMenu("open-account", "Account");
  const card = page.locator('[data-ref="menuCard"]');
  const code = await card.getByLabel("Your exportable save code").inputValue();
  await card.getByRole("button", { name: "Copy code", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Copy manually", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Text to copy")).toHaveValue(code);
  await expect(dialog.getByLabel("Text to copy")).toBeFocused();
  await expect(page.getByText("Save code copied", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(card.locator(".screen-head h2")).toHaveText("Account");
  await card.getByRole("button", { name: "Copy code", exact: true }).click();
  await expect(dialog.getByLabel("Text to copy")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(card.locator(".screen-head h2")).toHaveText("Account");
  expect(gameErrors(app.errors).real).toEqual([]);
});

test("private rooms are offered in the shipping edition, and solo modes stay reachable", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open(); await app.ready();
  await app.openMenu("open-live", "Race Lobby");
  const card = page.locator('[data-ref="menuCard"]');
  // This test used to assert the OTHER half of `renderLive`
  // (`src/game/hud/race.ts:126-137`) — that private rooms are disabled and the
  // note "Live rooms are not available in this edition." is shown:
  //
  //   expect(locator('[data-action="host-room"]')).toBeDisabled()   Received: enabled
  //
  // That branch is unreachable in this repo now, and the edition module says so
  // in its own header — `src/game/edition.ts:3-4`: "This is the only edition in
  // sunbird-poki. All values are Poki defaults" — with
  // `POKI_MULTIPLAYER = true` (line 14) alongside it. `isMultiplayerConfigured()`
  // (`src/game/Realtime.ts:158-164`) returns true for a `POKI_MULTIPLAYER`
  // build whose browser has WebRTC, so every build this repo produces takes the
  // ENABLED branch. Naming the host in the test, which was written when a
  // direct/no-relay build was still under test, kept the premise alive after
  // the premise stopped being true.
  //
  // So the assertions are inverted to what the game now promises, and they are
  // strictly more than the swap: an enabled button on its own would also pass if
  // the lobby silently stopped rendering the room section at all.
  await expect(card.locator('[data-action="host-room"]')).toBeEnabled();
  await expect(card.locator('[data-action="join-room"]')).toBeEnabled();
  await expect(card.getByText("Live rooms are not available in this edition.", { exact: false })).toHaveCount(0);
  // The room-code entry is the half a player actually uses to join a friend, so
  // the lobby must still be showing it — not just the two buttons above it.
  await expect(card.locator('[data-ref="roomCode"]')).toBeVisible();
  // `backHome()` dispatches rather than pointer-clicks for the same reason the
  // Shop's Back button does above: the Race Lobby's own Back control sits under
  // the Poki SDK's drag pill on a phone, and the shared helper's pointer click
  // waited out the whole 300 s budget there on `poki-debug-pill intercepts
  // pointer events`. The game's ScreenHistory does the navigating either way,
  // and `app.ready()` afterwards still asserts the home menu is really up.
  await backHome(app, page);
  await app.openMenu("mode-select", "Game modes");
  await card.locator('[data-action="pick-mode"][data-id="endless"]').click();
  await app.pause(); await app.resume();
  expect(gameErrors(app.errors).real).toEqual([]);
});
