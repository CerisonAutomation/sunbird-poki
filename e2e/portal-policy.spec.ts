import { createServer, type Server } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Platform-policy contract test — the browser-level half of the Poki
 * compliance gates.
 *
 * It drives the SHIPPING artifacts, not a dev server:
 *
 *   • `poki-upload/` (the folder handed to the Poki Inspector)
 *   • `dist/`        (the direct/web build)
 *
 * and asserts the two policies that matter in the shipped bundle:
 *
 *   1. PLAYER-AUTHORED TEXT — Poki's external-resources policy forbids *chat
 *      systems* and personal-data collection, not display names, so the Poki
 *      build DOES offer a typing surface for the pilot name (it is broadcast to
 *      real players over netlib and persisted on a public leaderboard, so the
 *      duty is moderation, not prohibition). What this proves is therefore the
 *      stronger property: the moderation pipeline actually ships — a blocked
 *      spelling is rejected in the artifact, and a clean name is accepted. The
 *      crazy/generic editions set CUSTOM_PILOT_NAMES=false and render the
 *      generated name read-only; the direct build keeps free rename.
 *   2. AD-REMOVAL PURCHASES (REQ-20/REQ-31) — nothing may offer to remove or
 *      disable ads, and no screen may say "no breaks" / "Remove breaks". In
 *      this fork there is only one edition: `src/game/edition.ts` IS the Poki
 *      edition and `vite.config.ts` defines `VITE_SELL_AD_REMOVAL` to false for
 *      every build, so `dist/` is held to the same rule as `poki-upload/`. That
 *      is why this asserts **absence** rather than walking into a paywall: the
 *      controls do not exist, so a screen that offers them is unreachable, and
 *      the only correct thing to assert is that nothing on the way there offers
 *      one. `src/game/__tests__/ad-surfaces.test.ts` pins the same rule at the
 *      render layer for the break overlay, which no menu walk can reach.
 *
 * `scripts/portal-markers.mjs` proves the strings are absent from the portal
 * bundle; this proves the *player* never sees them and that the replacement
 * surface actually works.
 *
 * Run: pnpm test:policy   (it runs `pnpm build:poki` and `pnpm build` itself)
 */
const PORTAL_PORT = 4178;
const DIRECT_PORT = 4179;
const POKI_CDN = /game-cdn\.poki\.com/;

/**
 * Poki's AUDS leaderboard API, stubbed for the same reason the SDK is: the
 * policy assertions below are about the ARTIFACT, and this spec must not depend
 * on a live third-party service.
 *
 * `SDK_STUB.getToken()` returns the literal string "stub-token", so with the
 * real AUDS endpoint reachable the game sent a fake token to Poki's production
 * API and got HTTP 400 back — four times over, once per leaderboard read. The
 * spec's `boot()` records every response >= 400, so `expect(errors).toEqual([])`
 * was asserting that Poki's production backend accepts a fabricated token. That
 * is not a property of the build under test, and it made the suite fail (or pass)
 * on Poki's uptime and this game's AUDS provisioning rather than on the code.
 *
 * Stubbing it keeps the strictness that matters: any 404 on a missing asset, any
 * 5xx, and every console/page error still fails the test. Nothing is filtered.
 * The empty leaderboard is also the honest case — a first run has no scores.
 */
const AUDS_STUB = /auds\.poki\.io/;
const AUDS_EMPTY_LIST = JSON.stringify({ total: 0, items: [] });

/** Any wording that promises the player fewer or no ads. */
const AD_REMOVAL_COPY = /sponsored break|no breaks|remove breaks|remove ads|no ads|ad-?free/i;

/**
 * Every control that would let a player buy their way out of an ad, and why
 * each one is somewhere a player can actually reach.
 *
 *  open-paywall  the Coin Store / Gold upsell, and the way into it. Five render
 *                sites in HUD.ts — 1901 `upsellStrip()`, 2994 the mission
 *                lock-chip, 3127 the variant row, 3494 the Nest Pass upsell,
 *                3566 the account Gold row — and every one of them is behind
 *                `SELL_AD_REMOVAL`, which `edition.ts` sets to false. A correct
 *                portal build therefore renders none of them, which is the
 *                reason this test used to hang: it clicked one and waited 240s
 *                for a screen that must not exist.
 *  gold-buy      "Unlock Gold" on the Coin Store. Gold is the entitlement that
 *                removes breaks, so the button *is* the ad-removal offer.
 *  vip-buy       the same offer, for VIP.
 *  restore       "Restore passes" — the recovery path for those same two SKUs,
 *                so it re-delivers an ad-removing entitlement.
 *  ad-gold       "✦ Remove breaks", on the break overlay. The sharpest of the
 *                five: it sits on the ad itself, offering to end it early. No
 *                menu screen carries it — reaching it needs a flight — so the
 *                walk below cannot visit it and its absence is pinned at the
 *                render layer instead, by "never offers to remove breaks on the
 *                portal edition (REQ-31)" in
 *                src/game/__tests__/ad-surfaces.test.ts, which renders the
 *                overlay with `canRemoveBreaks: true` and asserts no `ad-gold`
 *                comes out. It is listed here so the inventory a reader checks
 *                the game against is the whole one.
 */
const AD_REMOVAL_ACTIONS = ["open-paywall", "gold-buy", "vip-buy", "restore", "ad-gold"] as const;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
};

function serve(root: string, port: number): Promise<Server> {
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? "/", `http://127.0.0.1:${port}`).pathname);
    const rel = pathname === "/" ? "/index.html" : pathname;
    const file = path.normalize(path.join(root, rel));
    if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end(`404 ${pathname}`);
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": statSync(file).size,
      "Access-Control-Allow-Origin": "*",
    });
    if (req.method === "HEAD") res.end();
    else createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

/** Stand-in for the Poki SDK, injected before the bundle exactly like the Inspector. */
const SDK_STUB = `
window.__pokiCalls = [];
window.PokiSDK = (function () {
  function record(name) { return function () { window.__pokiCalls.push(name); }; }
  return {
    init: function () { record("init")(); return Promise.resolve(); },
    setDebug: record("setDebug"),
    gameLoadingStart: record("gameLoadingStart"),
    gameLoadingFinished: record("gameLoadingFinished"),
    gameplayStart: record("gameplayStart"),
    gameplayStop: record("gameplayStop"),
    signalGameReady: record("signalGameReady"),
    movePill: record("movePill"),
    hasAdBlock: function () { record("hasAdBlock")(); return false; },
    getURLParam: function () { record("getURLParam")(); return null; },
    getUser: function () { record("getUser")(); return Promise.resolve({ username: "Inspector QA", isSignedIn: false }); },
    getToken: function () { record("getToken")(); return Promise.resolve("stub-token"); },
    shareableURL: function () { record("shareableURL")(); return Promise.resolve("/"); },
    commercialBreak: function (onStart) { record("commercialBreak")(); if (typeof onStart === "function") onStart(); return Promise.resolve(); },
    rewardedBreak: function (onStart) { record("rewardedBreak")(); if (typeof onStart === "function") onStart(); return Promise.resolve(true); }
  };
})();
`;

let portalServer: Server;
let directServer: Server;

test.beforeAll(async () => {
  portalServer = await serve(path.join(import.meta.dirname, "..", "poki-upload"), PORTAL_PORT);
  directServer = await serve(path.join(import.meta.dirname, "..", "dist"), DIRECT_PORT);
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => portalServer.close(() => resolve()));
  await new Promise<void>((resolve) => directServer.close(() => resolve()));
});

/**
 * Console errors the *browser* raises about the test rig, not the game.
 *
 * Both are properties of serving an https-only-guarded build over plain
 * `http://127.0.0.1`, which is what these tests do on purpose — the portal
 * artifact has to be exercised as a plain file server, not as the portal.
 * Neither string is emitted by game code, and neither can be fixed by game
 * code: COOP is refused because 127.0.0.1-over-http is not a potentially
 * trustworthy origin, and the sandboxed `about:blank` frames belong to the
 * service worker's own navigation. They are matched as whole phrases so a real
 * error that merely mentions a similar word still fails the test.
 */
const RIG_ERRORS = [
  "The Cross-Origin-Opener-Policy header has been ignored",
  "Blocked script execution in 'about:blank' because the document's frame is sandboxed",
];

/** Boot a build and wait for the menu CTA — the same readiness the game ships. */
async function boot(page: Page, origin: string): Promise<string[]> {
  const errors: string[] = [];
  const isRigNoise = (text: string) => RIG_ERRORS.some((frag) => text.includes(frag));
  page.on("pageerror", (e) => {
    if (!isRigNoise(e.message)) errors.push(e.message);
  });
  page.on("console", (m) => {
    if (m.type() === "error" && !isRigNoise(m.text())) errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`);
  });
  await page.goto(origin + "/", { waitUntil: "commit" });
  await expect(page.locator("#boot-shell")).toHaveCount(0, { timeout: 45_000 });
  await dismissNameEntry(page);
  await expect(page.getByRole("button", { name: "Fly now", exact: true })).toBeVisible({ timeout: 45_000 });
  return errors;
}

/** A fresh profile lands on the first-run welcome screen before the menu CTA,
 *  so every test that boots a build has to get past it. Both editions leave it
 *  with "Let's Fly": the Poki build commits the field, which is pre-filled with
 *  a generated name so accepting it is one tap; crazy/generic commit the
 *  curated name on the plate. Without this the CTA wait below simply times out
 *  and the failure looks like a broken menu rather than an undismissed
 *  onboarding screen. */
async function dismissNameEntry(page: Page): Promise<void> {
  const fly = page.locator('[data-action="confirm-pilot-name"]');
  if (!(await fly.isVisible().catch(() => false))) return;
  await fly.click();
  await expect(fly).toHaveCount(0, { timeout: 20_000 });
}

async function openMenu(page: Page, action: string, title: string): Promise<void> {
  const card = page.locator('[data-ref="menuCard"]');
  await card.locator(`[data-action="${action}"]`).first().click();
  await expect(card.locator(".screen-head h2")).toHaveText(title, { timeout: 20_000 });
}

/** Walk back out of any sub-screens until the home CTA is on screen again.
 *  The HUD re-renders its card on every screen change, which detaches the back
 *  button mid-click — so click through the DOM instead of an actionability
 *  wait, and re-check after each step. */
async function goHome(page: Page): Promise<void> {
  const cta = page.getByRole("button", { name: "Fly now", exact: true });
  for (let i = 0; i < 8 && !(await cta.isVisible().catch(() => false)); i += 1) {
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('[data-ref="menuCard"] [data-action="back"]')?.click();
    });
    await page.waitForTimeout(300);
  }
  await expect(cta).toBeVisible({ timeout: 20_000 });
}

/**
 * One screen's worth of the ad-removal contract, and the check both the portal
 * and the direct build run on every screen they visit: none of the controls in
 * AD_REMOVAL_ACTIONS is on the page, and no copy on it offers one.
 *
 * The copy scan reads the whole document, not the menu card, because the Gold
 * upsell strip (`upsellStrip()` in HUD.ts) renders beside the card rather than
 * inside it — a card-only scan would pass while the offer sat next to it.
 */
async function expectNoAdRemoval(page: Page, where: string): Promise<void> {
  for (const action of AD_REMOVAL_ACTIONS) {
    await expect(
      page.locator(`[data-action="${action}"]`),
      `${where} must not offer a way to remove ads (${action})`,
    ).toHaveCount(0);
  }
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  expect(text, `${where} must not offer ad removal in its copy`).not.toMatch(AD_REMOVAL_COPY);
}

test.describe("portal artifact (poki-upload/)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(SDK_STUB);
    await page.route(POKI_CDN, (route) =>
      route.fulfill({ status: 200, contentType: "application/javascript", body: SDK_STUB }),
    );
    await page.route(AUDS_STUB, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: AUDS_EMPTY_LIST }),
    );
  });

  test("the first-run welcome screen offers typing, pre-filled so it stays optional", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${PORTAL_PORT}/`, { waitUntil: "commit" });
    await expect(page.locator("#boot-shell")).toHaveCount(0, { timeout: 45_000 });

    // A fresh profile lands here before the menu, so this is the first name
    // surface a Poki player meets. Poki forbids chat systems and personal-data
    // collection, not display names — so the field is here, and it is already
    // filled with a generated call sign, which keeps "Let's Fly" a single tap.
    const fly = page.locator('[data-action="confirm-pilot-name"]');
    await expect(fly).toBeVisible({ timeout: 45_000 });
    const input = page.locator('[data-ref="pilotNameInput"]');
    await expect(input).toHaveCount(1);
    await expect(input).toHaveAttribute("maxlength", "14");
    const seeded = await input.inputValue();
    expect(seeded.length, "the field is pre-filled with a generated name").toBeGreaterThan(0);
    await expect(page.locator(".name-char-count span")).toHaveText(String(seeded.length));

    // The dice must write into the field, not to a plate that is no longer in
    // the bundle — a dead dice would leave the player with a name they cannot
    // change and no idea why.
    await page.locator('[data-action="randomize-pilot-name"]').click();
    await expect.poll(async () => input.inputValue(), { timeout: 15_000 }).not.toBe(seeded);

    // THE MODERATION PROOF. "fuuuck" is not a literal blocklist entry — it is a
    // stretched spelling that only the shipped normaliser collapses to a
    // blocked key, so this fails if the moderation pipeline is tree-shaken out
    // of the portal bundle or silently stops running.
    await input.fill("fuuuck");
    await fly.click();
    await expect(fly, "a blocked call sign must not get past the welcome screen").toBeVisible();
    // Match by text, not by position: toasts from boot (the streak/welcome
    // ones) are still in the DOM, so `.first()` would read an older toast.
    await expect(page.locator(".toast").filter({ hasText: /call sign/i }).first()).toBeVisible();

    // A clean name is accepted, all the way to the menu.
    await input.fill("SkyFox42");
    await fly.click();
    await expect(page.getByRole("button", { name: "Fly now", exact: true })).toBeVisible({ timeout: 30_000 });
    expect(errors).toEqual([]);
  });

  test("lets a Poki player type a call sign, and refuses one that is not allowed", async ({ page }) => {
    const errors = await boot(page, `http://127.0.0.1:${PORTAL_PORT}`);
    await openMenu(page, "open-board", "Leaderboard");

    // Free text on Poki: the field and its Save path are in the bundle, and the
    // read-only plate that crazy/generic use is not.
    const input = page.locator('[data-ref="pilotName"]');
    await expect(input).toHaveCount(1);
    await expect(page.locator('[data-action="rename-pilot"]')).toHaveCount(1);
    await expect(page.locator(".pilot-name-readonly")).toHaveCount(0);

    // The dice still works and must change what is on screen.
    const before = await input.inputValue();
    await page.locator('[data-action="autogen-pilot"]').click();
    await expect.poll(async () => input.inputValue(), { timeout: 15_000 }).not.toBe(before);

    // A blocked name is refused: the row says why, and the refusal is the
    // evasive spelling again — proof the normaliser ships, not just the words.
    await input.fill("fuuuck");
    await page.locator('[data-action="rename-pilot"]').click();
    await expect(page.locator(".toast").filter({ hasText: /call sign/i }).first()).toBeVisible();

    // A clean name is committed and read back from the field.
    await input.fill("SkyFox42");
    await page.locator('[data-action="rename-pilot"]').click();
    await expect
      .poll(async () => (await page.locator('[data-ref="pilotName"]').inputValue()) ?? "", { timeout: 15_000 })
      .toBe("SkyFox42");
    expect(errors).toEqual([]);
  });

  test("never offers to remove ads, anywhere a player can reach", async ({ page }) => {
    const errors = await boot(page, `http://127.0.0.1:${PORTAL_PORT}`);

    // The premise here used to be "walk into the paywall, then check it does not
    // offer ad removal". That is backwards for this build. `SELL_AD_REMOVAL` is
    // false, so the paywall is correctly not rendered at all and the Gold
    // upsell strip returns "" — a player cannot reach the screen, because the
    // screen does not exist. The property worth testing is therefore the
    // stronger and simpler one: no ad-removal control is reachable from the menu
    // at all, on any of the screens below. The entry point is asserted absent
    // here rather than clicked, and the direct build gets the same treatment.
    await goHome(page);
    await openMenu(page, "open-pass", "Nest Pass");
    await expectNoAdRemoval(page, "the Nest Pass screen");
    await expect(
      page.locator(".gold-hero .feature-list li"),
      "the Gold pitch must not ship in a portal build at all",
    ).toHaveCount(0);

    // Every screen a player can reach from the menu, scanned as rendered text.
    //
    // The list is the set of `data-action` values the home menu card actually
    // renders, measured against the built portal rather than assumed: the card
    // offers `pvp-practice`, not `open-practice`. A walk that clicks an action
    // the home does not carry waits out the whole 240s timeout on a locator that
    // can never appear, which is how this test spent four minutes per attempt
    // before the list was checked against the build.
    //
    // `open-live` is deliberately absent from this list, but NOT because it is
    // missing from the home menu — it is the single PvP tile. It is skipped
    // because its page is the tallest in the game (lobby + rooms + the AI flock
    // section that used to be a second tile), so it belongs to the nested/visual
    // walk in `visual-screens.spec.ts`, not to this one.
    //
    // `start-endless`, `versus` and `pvp-practice` are on the card too and are
    // skipped here, for one measured reason: none of them opens a screen with a
    // `.screen-head h2`. `pvp-practice` was tried and reported itself — the
    // assertion names the action — so this is observed, not assumed. They are
    // launch actions, not menu screens, and walking them would leave the runner
    // mid-flight for the next iteration.
    //
    // The cost of that skip is stated rather than hidden: the PvP surface is
    // where a rival offer is most plausible, and `open-live` is the one home
    // screen this walk does not open. `visual-screens.spec.ts` opens it and
    // fails on any visual defect, so the page is covered — just not by this
    // ad-removal scan.
    const screens = [
      "open-shop",
      "open-settings",
      "open-board",
      "open-progress",
      "open-cups",
      "open-account",
      "open-challenges",
      "open-campaign",
      "open-rank",
      "open-pass",
      "open-trophies",
      "open-atlas",
      "open-scores",
      "open-squad",
      "mode-select",
    ];
    const card = page.locator('[data-ref="menuCard"]');
    // The walk collects its failures instead of throwing on the first one.
    // This test IS the Poki REQ-20 check — "no ad-removal offer anywhere a
    // player can reach" — and a walk that aborts at the first screen it cannot
    // confirm leaves every later screen unchecked while reporting one red test.
    // That reads as a result when it is really a non-result, which is the worst
    // way for a compliance gate to fail. So: try all 15, then fail with the
    // whole list.
    const walkFailures: string[] = [];
    for (const action of screens) {
      try {
        await goHome(page);
        await card.locator(`[data-action="${action}"]`).first().click();
        // 60s, not 20s. Under headless SwiftShader a single menu transition
        // costs ~12s, so 20s left about eight seconds of slack for a step that
        // is slow *by environment* — and the walk died on the first screen with
        // "open-shop opened no screen with a heading" while the Shop screen was
        // in fact rendering one (HUD.ts:3602 calls head()).
        await expect(
          card.locator(".screen-head h2").first(),
          `${action} opened no screen with a heading`,
        ).toBeVisible({ timeout: 60_000 });

        // The heading has to be a title, not the screen's own key. 11 of these
        // 15 screens once rendered their raw internal id ("pass" for "Nest
        // Pass") and every other assertion on the page still passed: a
        // screenshot shows a heading either way, and a reviewer skims past it.
        // This is the reason the test is worth keeping rather than deleting.
        //
        // The id can surface in two shapes — the kebab action name and its camel
        // form — so both are compared. What is deliberately NOT asserted is
        // that the heading be several words long: "Settings", "Leaderboards",
        // "Account" and "Trophies" are all correct single-word titles, and a
        // rule that rejected them would be a test that fails on correct
        // behaviour, which is the same defect as the one it was written to catch.
        const heading = ((await card.locator(".screen-head h2").first().textContent()) ?? "").replace(/\s+/g, " ").trim();
        const camelId = action.replace(/-([a-z0-9])/g, (_, ch: string) => ch.toUpperCase());
        expect(heading, `${action} rendered no heading`).not.toBe("");
        expect(heading, `${action} rendered its own action name as the heading`).not.toBe(action);
        expect(heading, `${action} rendered its camelCase id as the heading`).not.toBe(camelId);
        expect(heading, `${action} rendered a bare id fragment as the heading`).not.toBe(action.split("-").pop() ?? "");

        await expectNoAdRemoval(page, action);
      } catch (err) {
        walkFailures.push(`${action}: ${(err as Error).message.split("\n")[0]}`);
      }
    }
    expect(
      walkFailures,
      `ad-removal walk did not complete cleanly on ${walkFailures.length} of ${screens.length} screens`,
    ).toEqual([]);
    expect(errors).toEqual([]);
  });
});

test.describe("direct build (dist/)", () => {
  test("free-text rename ships there too, and it still offers no way to remove ads", async ({ page }) => {
    const errors = await boot(page, `http://127.0.0.1:${DIRECT_PORT}`);

    await openMenu(page, "open-board", "Leaderboard");
    const input = page.locator('[data-ref="pilotName"]');
    await expect(input).toHaveCount(1);
    await expect(page.locator('[data-action="rename-pilot"]')).toHaveCount(1);

    // Typed names still work there: type, save, and the field keeps the value.
    await input.fill("ArenaTester");
    await page.locator('[data-action="rename-pilot"]').click();
    await expect
      .poll(async () => (await page.locator('[data-ref="pilotName"]').inputValue()) ?? "", { timeout: 15_000 })
      .toBe("ArenaTester");

    // This test used to end by walking into the Coin Store and asserting the
    // Gold pitch was still there selling "No sponsored breaks, ever" — the whole
    // point being that the direct build keeps what the portal drops. In this fork
    // there is nothing left to keep: `dist/` and `poki-upload/` are the same
    // edition (`src/game/edition.ts` is the Poki edition, and vite.config.ts
    // defines `VITE_SELL_AD_REMOVAL` to false for every build), so there is no
    // Coin Store to open here either. It failed on the same missing locator as
    // the portal test. What can honestly be asserted about `dist/` is the
    // property that does hold and does matter: it boots clean, the free-text
    // rename surface ships, and it offers no way to remove ads either.
    await goHome(page);
    await openMenu(page, "open-pass", "Nest Pass");
    await expectNoAdRemoval(page, "the Nest Pass screen (dist/)");
    await expect(
      page.locator(".gold-hero .feature-list li"),
      "the Gold pitch must not ship in dist/ either",
    ).toHaveCount(0);

    expect(errors).toEqual([]);
  });
});
