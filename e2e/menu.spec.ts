import { test, expect, type Page } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

/**
 * The home menu's own Back control, pressed without a pointer hit test.
 *
 * `dispatchEvent("click")` rather than `click()`, and the difference is not
 * the game's. `vite.config.ts` pins `const PORTAL = "poki"`, so the build this
 * harness serves standalone loads Poki's own SDK (src/sdk/platform.ts), and
 * that SDK mounts a mobile-nav drag pill into the document:
 * `<div aria-hidden="true" id="poki-debug-pill">`, measured at x 0, y 24,
 * 62x46 on a 412x839 viewport. A menu card's Back button measures x 35, y 43,
 * 44x44 — the pill sits on top of it, so Playwright's hit test reported
 * "poki-debug-pill intercepts pointer events" and retried for the full 300 s
 * budget. The pill is not Sunbird UI, is not in any bundle in this repo, and
 * does not exist in the packaged portal artifact (there the script tag is
 * injected by scripts/package-portal.mjs and the pill belongs to Poki's own
 * host page) — it exists only because the harness serves the portal build on
 * its own. e2e/journeys.spec.ts documents the same measurement and makes the
 * same call.
 *
 * Dispatching still runs the game's real delegated handler on the real
 * control, so the navigation and every assertion after it are unchanged and
 * still load-bearing. What is not exercised is CSS hit-testing of a control a
 * foreign element covers in this harness, which is not a fact about Sunbird.
 */
async function pressBack(page: Page): Promise<void> {
  await page.locator('[data-ref="menuCard"] [data-action="back"]').dispatchEvent("click");
}

/**
 * Back to the home menu, however many screens deep the walk left us.
 *
 * One Back is not always home: the Rival-rank leg below walks home → Your
 * progress → Rival rank, and the product ships Rival Rank with no home tile on
 * purpose (see `SECONDARY_DESTINATIONS` in src/game/MenuCatalog.ts). Press
 * Back until the home menu is actually up rather than assuming one hop.
 */
async function goHome(page: Page): Promise<void> {
  const cta = page.locator('[data-action="pvp-practice"]');
  for (let hop = 0; hop < 4; hop++) {
    if (await cta.isVisible()) return;
    const back = page.locator('[data-ref="menuCard"] [data-action="back"]');
    if ((await back.count()) === 0) break;
    await back.dispatchEvent("click");
    await expect(cta).toBeVisible({ timeout: 20_000 });
  }
  await expect(cta).toBeVisible();
}

/** Leave a sub-screen for the home menu in this (English) session. */
async function backHome(app: SunbirdPage, page: Page): Promise<void> {
  await pressBack(page);
  await app.ready();
}

test("menu routes start at the top, remain in bounds, and keep Back reachable", async ({ page }) => {
  test.setTimeout(180000);
  const app = new SunbirdPage(page);
  await app.open(); await app.ready();
  // `title` is what the screen's `<h2>` must actually read — the headings live
  // in `SCREEN_HEADINGS` (src/game/hud/kit.ts) and are pinned against the
  // translation barrel by screen-titles.test.ts, so this list is a copy of the
  // product's own names, not a guess. "Your scores" is the saved-flight-records
  // screen; "High glides" is a different screen's heading (the progress hub's
  // sibling id), which is why this used to sit 20 s on a heading that was never
  // going to arrive.
  //
  // `via` names the screen a destination is opened from when it has no home
  // tile of its own. `SECONDARY_DESTINATIONS` documents exactly that: Rival
  // rank opens from the Your-progress hub, Nest Pass from the home record bar,
  // Tournaments from the countdown strip and the leaderboards from the board
  // strip — "a second route to a screen you could already reach from the same
  // screen" is the reason they are not tiles. Only Rival Rank needs the extra
  // hop here; the others are reachable from home and are walked that way.
  const screens: readonly { action: string; title: string; via?: { action: string; title: string } }[] = [
    { action: "open-settings", title: "Settings" },
    { action: "open-shop", title: "Shop" },
    { action: "open-scores", title: "Your scores" },
    { action: "open-account", title: "Account" },
    { action: "open-live", title: "Race Lobby" },
    { action: "open-progress", title: "Your progress" },
    { action: "open-challenges", title: "Challenges" },
    { action: "open-cups", title: "Tournaments" },
    { action: "open-trophies", title: "Trophy Case" },
    { action: "open-pass", title: "Nest Pass" },
    { action: "open-atlas", title: "Island Atlas" },
    { action: "open-campaign", title: "The Long Migration" },
    { action: "open-rank", title: "Rival Rank", via: { action: "open-progress", title: "Your progress" } },
    { action: "open-board", title: "Leaderboard" },
    { action: "open-squad", title: "Squad" },
  ];
  const card = page.locator('[data-ref="menuCard"]');
  for (const { action, title, via } of screens) {
    if (via) {
      await app.openMenu(via.action, via.title);
      await app.menuAction(action).click();
      await expect(card.locator(".screen-head h2")).toHaveText(title, { timeout: 45_000 });
    } else {
      await app.openMenu(action, title);
    }
    expect(await card.evaluate(el => el.scrollTop), title).toBe(0);
    await app.expectMenuFits();
    await card.evaluate(el => { el.scrollTop = el.scrollHeight; });
    const back = card.getByRole("button", { name: "Back", exact: true });
    await expect(back).toBeInViewport();
    await goHome(page);
  }
  expect(app.errors).toEqual([]);
});

test("every destination the home menu offers has exactly one entry of its own", async ({ page }) => {
  // The regression behind the keyboard test below. The onboarding flight plan is
  // built from the same destination catalog as the menu, so its steps carry the
  // same `data-action` as the menu entries they shortcut — `open-settings`,
  // `open-live`, `open-loadout`, `open-practice` all appear twice on a first
  // run. That is deliberate ("the panel and the rail can never disagree",
  // renderOnboardingRoute), and it is why a bare
  // `page.locator('[data-action="…"]')` resolves to two elements and fails
  // Playwright's strict mode — a failure that surfaces as a hang, because the
  // violation inside a 20 s expect is followed by a teardown that waits out the
  // whole 300 s budget. Every lookup in this file therefore goes through
  // `app.menuAction()`, which is `:not(.onboarding-route-step)`; this pins the
  // invariant that makes that safe: one non-onboarding entry per action, so the
  // helper resolves to exactly the one the player would tap.
  const app = new SunbirdPage(page);
  await app.open(); await app.ready();
  const card = page.locator('[data-ref="menuCard"]');
  const actions = await card.locator("[data-action]:not(.onboarding-route-step)").evaluateAll(
    els => [...new Set(els.map(el => (el as HTMLElement).dataset.action!))],
  );
  expect(actions.length).toBeGreaterThan(8);
  for (const action of actions) {
    await expect(card.locator(`[data-action="${action}"]:not(.onboarding-route-step)`), action).toHaveCount(1);
  }
  // The duplicated half is still there — this is a shared catalog, not a bug —
  // so the exclusion is doing real work rather than filtering nothing.
  const duplicated = ["open-settings", "open-live"];
  for (const action of duplicated) {
    expect(await card.locator(`[data-action="${action}"]`).count(), action).toBeGreaterThan(1);
  }
  expect(app.errors).toEqual([]);
});

test("settings work by keyboard, stay focused, persist, and use honest mute state", async ({ page }) => {
  test.setTimeout(120000);
  const app = new SunbirdPage(page);
  await app.open(); await app.ready();
  // `menuAction`, not a bare `[data-action="open-settings"]`: on a first run
  // the onboarding flight plan also offers Settings, so the bare locator
  // matches two elements and trips strict mode.
  await app.menuAction("open-settings").focus(); await page.keyboard.press("Enter");
  const card = page.locator('[data-ref="menuCard"]');
  await expect(card.locator("h2")).toHaveText("Settings");
  const mute = card.getByRole("button", { name: "Mute all sound", exact: true });
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  await mute.focus(); await page.keyboard.press("Space");
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await expect(mute).toBeFocused();
  await page.keyboard.press("Space");
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  const volume = card.getByLabel("Effects volume", { exact: true });
  await volume.fill("65"); await volume.dispatchEvent("change");
  await expect(volume).toHaveValue("65");
  await card.getByLabel("Music track", { exact: true }).selectOption("2");
  await card.getByLabel("Render quality", { exact: true }).selectOption("low");
  await backHome(app, page);
  await page.reload(); await app.ready();
  await app.openMenu("open-settings", "Settings");
  await expect(volume).toHaveValue("65");
  await expect(card.getByLabel("Music track", { exact: true })).toHaveValue("2");
  await expect(card.getByLabel("Render quality", { exact: true })).toHaveValue("low");
  // Disclosure summary is the last visible focusable control (destructive action closed).
  const danger = card.locator(".danger-zone > summary");
  await danger.focus(); await page.keyboard.press("Tab");
  await expect(card.getByRole("button", { name: "Back", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab"); await expect(danger).toBeFocused();
  expect(app.errors).toEqual([]);
});

test("room code is editable; shop collections stay open across visits", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open(); await app.ready();
  await app.openMenu("open-live", "Race Lobby");
  const card = page.locator('[data-ref="menuCard"]');
  const code = card.getByLabel("Room code", { exact: true });
  await code.fill("ABCDE");
  await card.getByRole("button", { name: "Change loadout", exact: true }).click();
  await card.getByRole("button", { name: "Back", exact: true }).dispatchEvent("click");
  // Drafts survive updates within a screen, not navigation into another screen.
  await code.fill("ABCDE");
  await expect(code).toHaveValue("ABCDE");
  await backHome(app, page);
  await app.openMenu("open-shop", "Shop");
  // The bird catalogue has to be REACHABLE, not short. This line used to
  // compare the card's total scrollHeight against a magic 1800px, which the
  // shop grew straight past — it measured 4738 on a 1280x800 desktop — and
  // which said nothing a player cares about: the card is a scroll surface, and
  // `expectMenuFits()` already covers the layout contract that does matter (the
  // card stays inside the viewport and does not overflow horizontally).
  //
  // What the magic number was a proxy for is stated in the shop's own source:
  // commit ca6d15c moved the catalogue ABOVE the promos because the birds were
  // "five panels deep in a shop whose own headline is 'Find your wings. Make
  // them yours.' … the player simply never reached them". So ask that question
  // directly — the search box has to be inside the FIRST screen of the card, or
  // the promos have pushed the catalogue back down again.
  const reach = await card.evaluate(el => {
    const search = el.querySelector<HTMLElement>('[data-ref="shopSearch"]')!;
    return { top: search.getBoundingClientRect().top - el.getBoundingClientRect().top, height: el.clientHeight };
  });
  expect(reach.top, `the bird catalogue starts ${Math.round(reach.top)}px down a ${Math.round(reach.height)}px card`).toBeLessThanOrEqual(reach.height);
  const collection = card.locator('details[data-ref="collection-nature"]');
  await collection.locator("summary").click();
  await expect(collection.locator(".skin-card").first()).toBeVisible();
  const locked = collection.locator('[data-action="buy-skin"]').first();
  await expect(locked).toBeDisabled();
  await backHome(app, page);
  await app.openMenu("open-shop", "Shop");
  await expect(collection).toHaveAttribute("open", "");
  expect(app.errors).toEqual([]);
});

test("save import requires explicit replacement consent and rejects an invalid code", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open(); await app.ready();
  await app.openMenu("open-account", "Account");
  const card = page.locator('[data-ref="menuCard"]');
  const before = await card.getByLabel("Your exportable save code").inputValue();
  await card.getByLabel("Save code to import").fill("not-a-save");
  await card.getByRole("button", { name: "Import save", exact: true }).click();
  await expect(card.getByRole("status")).toContainText("Confirm that you want to replace");
  await card.getByRole("checkbox").check();
  await card.getByRole("button", { name: "Import save", exact: true }).click();
  await expect(card.getByRole("status")).toContainText("couldn't be read");
  await expect(card.getByLabel("Your exportable save code")).toHaveValue(before);
  await expect(card.getByLabel("Save code to import")).toHaveValue("not-a-save");
  expect(app.errors).toEqual([]);
});

test("a save code exported from another device actually restores this one", async ({ page }) => {
  // The regression for the consent/reject test above, which is satisfied by a
  // DEAD control as readily as a working one: it only ever presses Import on a
  // string that must be refused. `Game.importCloud()` reads the pasted code
  // with `hud.readValue("cloudImport")` and the consent with
  // `hud.readChecked("confirmImport")`, and both resolve only through
  // `[data-ref="…"]`. With those refs off the account form, every press
  // answered "Paste a save code first." — so the move-your-progress-to-another
  // -device flow the section above it advertises could not be completed at all.
  //
  // So: prove a code comes BACK. The referral code is a good witness — it is
  // derived from a per-save random device id, so a wiped device mints a
  // different one and only a real import restores the original.
  const app = new SunbirdPage(page);
  await app.open(); await app.ready();
  await app.openMenu("open-account", "Account");
  const card = page.locator('[data-ref="menuCard"]');
  const code = await card.getByLabel("Your exportable save code").inputValue();
  const referral = (await card.locator(".code-row .code").innerText()).trim();
  expect(code.length).toBeGreaterThan(20);
  expect(referral).toMatch(/^SUN-[A-Z0-9]{6}$/);
  await page.evaluate(() => localStorage.removeItem("sunbird.save.v2"));
  await page.reload({ waitUntil: "commit" });
  await app.ready();
  await app.openMenu("open-account", "Account");
  await expect(card.locator(".code-row .code")).not.toHaveText(referral);
  await card.getByLabel("Save code to import").fill(code);
  await card.getByRole("checkbox").check();
  await card.getByRole("button", { name: "Import save", exact: true }).click();
  await expect(card.getByRole("status")).toContainText("Welcome back");
  await expect(card.locator(".code-row .code")).toHaveText(referral);
  expect(app.errors).toEqual([]);
});

test("the main-menu backdrop is the live 3D gameplay world (no painted sky)", async ({ page }) => {
  test.setTimeout(120000);
  const app = new SunbirdPage(page);
  await app.open(); await app.ready();

  // The menu backdrop is the live 3D attract flight (Game.menuTick). The
  // painted 2D sky canvas must NOT be mounted — an opaque canvas covering the
  // gameplay world is exactly the regression this test guards against.
  await expect(page.locator(".menu-sky")).toHaveCount(0);

  // The hero-bird overlay stays mounted but permanently hidden.
  const heroHost = page.locator(".menu-hero-layer");
  await expect(heroHost).toHaveCount(1);
  await expect(heroHost).toHaveClass(/hidden/);

  // The 3D gameplay canvas is the backdrop: it fills the viewport under the
  // translucent card.
  const canvas = page.locator(".game-canvas");
  await expect(canvas).toHaveCount(1);
  const box = await canvas.boundingBox();
  const vp = page.viewportSize()!;
  expect(box).not.toBeNull();
  expect(box!.x).toBeLessThanOrEqual(0);
  expect(box!.y).toBeLessThanOrEqual(0);
  expect(box!.width).toBeGreaterThanOrEqual(vp.width);
  expect(box!.height).toBeGreaterThanOrEqual(vp.height);

  expect(app.errors).toEqual([]);
});