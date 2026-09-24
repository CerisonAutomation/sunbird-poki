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
    await expect(page.getByRole("button", { name: "Play free flight now", exact: true })).toBeVisible({ timeout: 30_000 });
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
