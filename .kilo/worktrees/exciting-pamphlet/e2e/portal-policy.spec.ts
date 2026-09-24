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
 * and asserts the two policies that were violated until the compliance pass:
 *
 *   1. PLAYER-AUTHORED TEXT / PERSONAL DATA — the pilot name is broadcast to
 *      real players (netlib rooms, rosters, floating name tags). Poki allows no
 *      unmoderated player text and no collection of personal data, so the
 *      portal build must offer a read-only generated name plus a 🎲 roll — no
 *      text field, no "Save". The direct build keeps free rename.
 *   2. AD-REMOVAL PURCHASES (REQ-20) — nothing may offer to remove or disable
 *      ads. The portal paywall must not carry Gold's "No sponsored breaks"
 *      bullet, and no screen may say "no breaks" / "Remove breaks". The direct
 *      build keeps them (it owns its own ad schedule).
 *
 * `scripts/portal-markers.mjs` proves the strings are absent from the portal
 * bundle; this proves the *player* never sees them and that the replacement
 * surface actually works.
 *
 * Run: pnpm test:policy   (after `pnpm build:portals` and `pnpm build`)
 */
const PORTAL_PORT = 4178;
const DIRECT_PORT = 4179;
const POKI_CDN = /game-cdn\.poki\.com/;

/** Any wording that promises the player fewer or no ads. */
const AD_REMOVAL_COPY = /sponsored break|no breaks|remove breaks|remove ads|no ads|ad-?free/i;

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

/** Boot a build and wait for the menu CTA — the same readiness the game ships. */
async function boot(page: Page, origin: string): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`);
  });
  await page.goto(origin + "/", { waitUntil: "commit" });
  await expect(page.locator("#boot-shell")).toHaveCount(0, { timeout: 45_000 });
  await dismissNameEntry(page);
  await expect(page.getByRole("button", { name: "Play free flight now", exact: true })).toBeVisible({ timeout: 45_000 });
  return errors;
}

/** A fresh profile lands on the first-run welcome screen before the menu CTA,
 *  so every test that boots a build has to get past it. Both editions leave it
 *  with "Let's Fly": the portal build commits the curated name on the plate, the
 *  direct build commits the field (pre-filled with the same generated name).
 *  Without this the CTA wait below simply times out and the failure looks like a
 *  broken menu rather than an undismissed onboarding screen. */
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
  const cta = page.getByRole("button", { name: "Play free flight now", exact: true });
  for (let i = 0; i < 8 && !(await cta.isVisible().catch(() => false)); i += 1) {
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('[data-ref="menuCard"] [data-action="back"]')?.click();
    });
    await page.waitForTimeout(300);
  }
  await expect(cta).toBeVisible({ timeout: 20_000 });
}

test.describe("portal artifact (poki-upload/)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(SDK_STUB);
    await page.route(POKI_CDN, (route) =>
      route.fulfill({ status: 200, contentType: "application/javascript", body: SDK_STUB }),
    );
  });

  test("the first-run welcome screen offers no typing surface either", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${PORTAL_PORT}/`, { waitUntil: "commit" });
    await expect(page.locator("#boot-shell")).toHaveCount(0, { timeout: 45_000 });

    // A fresh profile lands here before the menu, so this is the first name
    // surface a portal player ever sees — it has to obey the same edition split
    // as the board's pilot-name row, not just that one.
    const fly = page.locator('[data-action="confirm-pilot-name"]');
    await expect(fly).toBeVisible({ timeout: 45_000 });
    await expect(page.locator(".name-entry-form input")).toHaveCount(0);
    await expect(page.locator('[data-ref="pilotNameInput"]')).toHaveCount(0);

    const plate = page.locator(".name-entry-plate");
    await expect(plate).toBeVisible();
    const before = (await plate.textContent())?.trim() ?? "";
    expect(before.length, "a curated name is already on the plate").toBeGreaterThan(0);
    expect(await plate.getAttribute("aria-label")).toBe("Pilot name");

    // The sanctioned alternative has to work: a dice that only wrote to an input
    // which is no longer in the bundle would leave the plate stuck.
    await page.locator('[data-action="randomize-pilot-name"]').click();
    await expect
      .poll(async () => (await plate.textContent())?.trim() ?? "", {
        timeout: 15_000,
        message: "🎲 must roll a new curated name on the welcome plate",
      })
      .not.toBe(before);
    await expect(page.locator(".name-entry-form input")).toHaveCount(0);

    // And "Let's Fly" must be a real exit. It reads the name field, so on a
    // build with no field it would toast "Please enter a pilot name" forever and
    // trap the player on this screen with no way out.
    await fly.click();
    await expect(page.getByRole("button", { name: "Play free flight now", exact: true })).toBeVisible({ timeout: 30_000 });
    expect(errors).toEqual([]);
  });

  test("shows the pilot name read-only and rolls a new one without a keyboard", async ({ page }) => {
    const errors = await boot(page, `http://127.0.0.1:${PORTAL_PORT}`);
    await openMenu(page, "open-board", "Leaderboard");

    // No typing surface and no free-text save path.
    await expect(page.locator('[data-ref="pilotName"]')).toHaveCount(0);
    await expect(page.locator('[data-action="rename-pilot"]')).toHaveCount(0);
    await expect(page.locator(".pilot-name-row input")).toHaveCount(0);

    const plate = page.locator(".pilot-name-readonly");
    await expect(plate).toBeVisible();
    const before = (await plate.textContent())?.trim() ?? "";
    expect(before.length, "the generated name is on screen").toBeGreaterThan(0);
    expect(await plate.getAttribute("aria-label")).toBe("Pilot name");

    // The sanctioned alternative: roll a curated name. It must actually change
    // the displayed name — a dead button here would leave players stuck.
    await page.locator('[data-action="autogen-pilot"]').click();
    await expect
      .poll(async () => (await page.locator(".pilot-name-readonly").textContent())?.trim() ?? "", {
        timeout: 15_000,
        message: "🎲 Random must roll a new curated name",
      })
      .not.toBe(before);
    await expect(page.locator(".pilot-name-row input")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("never offers to remove ads, anywhere a player can reach", async ({ page }) => {
    const errors = await boot(page, `http://127.0.0.1:${PORTAL_PORT}`);

    // Paywall: Nest Pass upsell → Coin Store.
    await openMenu(page, "open-pass", "Nest Pass");
    await page.locator('[data-action="open-paywall"]').first().click();
    await expect(page.locator('[data-ref="menuCard"] .screen-head h2')).toHaveText("Coin Store", { timeout: 20_000 });

    const goldBullets = page.locator(".gold-hero:not(.vip) + .feature-list li");
    await expect(goldBullets).toHaveCount(6);
    for (const li of await goldBullets.allTextContents()) {
      expect(li, `Gold bullet must not promise ad removal: ${li}`).not.toMatch(AD_REMOVAL_COPY);
    }

    // Every screen a player can reach from the menu, scanned as rendered text.
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
      "open-live",
      "open-practice",
      "mode-select",
    ];
    const card = page.locator('[data-ref="menuCard"]');
    for (const action of screens) {
      await goHome(page);
      await card.locator(`[data-action="${action}"]`).first().click();
      await expect(card.locator(".screen-head h2").first()).toBeVisible({ timeout: 20_000 });
      const text = (await card.innerText()).replace(/\s+/g, " ");
      expect(text, `${action} must not offer ad removal`).not.toMatch(AD_REMOVAL_COPY);
    }
    expect(errors).toEqual([]);
  });
});

test.describe("direct build (dist/) keeps what the portal drops", () => {
  test("free-text rename and the full Gold pitch survive outside the portals", async ({ page }) => {
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

    await goHome(page);
    await openMenu(page, "open-pass", "Nest Pass");
    await page.locator('[data-action="open-paywall"]').first().click();
    const goldBullets = page.locator(".gold-hero:not(.vip) + .feature-list li");
    await expect(goldBullets).toHaveCount(7);
    const bullets = await goldBullets.allTextContents();
    expect(bullets.some((b) => /No sponsored breaks, ever/.test(b))).toBe(true);

    expect(errors).toEqual([]);
  });
});
