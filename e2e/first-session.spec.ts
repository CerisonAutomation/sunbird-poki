import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SunbirdPage } from "./SunbirdPage";

/**
 * First-session baseline probe.
 *
 * Records OBSERVED facts about a brand-new player's first session. Every
 * number comes from a real browser at a real viewport, driving the real UI
 * with real input, against the production preview build, with every non-app
 * network service blocked — so the journey cannot be shaped by a backend
 * being up or down, and the offline path is the one under measurement.
 *
 * Nothing here invents a player outcome. It does not claim the session was
 * enjoyable or that the player wanted another run; it records how long each
 * leg took, how many interactions each leg cost, and what the game actually
 * showed. Interpretation belongs in the write-up, not in this file.
 *
 * The run ends the way results-layout.spec.ts ends it: no shipped test hooks,
 * no accelerated physics, no manufactured results DOM — the daylight clock
 * finishes the flight. The report lands in test-artifacts/ (gitignored).
 */

const here = dirname(fileURLToPath(import.meta.url));

type EventMark = { at: number; event: string; detail?: string };
type Interaction = { at: number; kind: "click" | "key"; target: string };

/** Block every request that is not the app itself; count what we blocked. */
async function blockNetwork(page: Page, origin: string): Promise<{ blocked: string[]; allowed: () => number }> {
  const blocked: string[] = [];
  let allowed = 0;
  await page.route("**/*", async route => {
    const url = route.request().url();
    if (url.startsWith("data:") || url.startsWith("blob:")) return route.continue();
    if (url.startsWith(origin)) { allowed += 1; return route.continue(); }
    blocked.push(url);
    return route.abort("internetdisconnected");
  });
  return { blocked, allowed: () => allowed };
}

/**
 * The console error Chromium logs for a request THIS SPEC aborted.
 *
 * `blockNetwork` below calls `route.abort("internetdisconnected")`, and Chromium
 * turns that into exactly one `Failed to load resource: net::ERR_INTERNET_
 * DISCONNECTED` per blocked request. This spec is the only one in the suite that
 * blocks anything, so this string is this spec's own doing and nothing else's:
 * `SunbirdPage` keeps `ERR_INTERNET_DISCONNECTED` out of its noise list on
 * purpose, because in every other spec it would mean a real failure.
 *
 * It shows up twice per run here, and the report names both culprits — the
 * portal SDK `src/sdk/platform.ts` CDN-loads, once on its first attempt and once
 * on the single retry `platform.ts` allows before resolving "none":
 *
 *   "https://game-cdn.poki.com/scripts/v2/poki-sdk.js"   (blockedUrls[0])
 *   "https://game-cdn.poki.com/scripts/v2/poki-sdk.js"   (blockedUrls[1])
 *
 * The game handling that failure without an uncaught error is the behaviour
 * `platform.ts` documents ("`init()` rejects in the local sandbox → the game
 * still boots"); the network error line is Chromium reporting the abort, not
 * the game failing. `errors` in the report below therefore holds everything
 * EXCEPT this, and `blockedResourceNoise` keeps the excluded count visible so
 * the filter cannot quietly grow.
 */
const BLOCKED_BY_GUARD = "Failed to load resource: net::ERR_INTERNET_DISCONNECTED";

test("first session: objective timings, gates and interaction counts", async ({ page, baseURL }, info) => {
  // Budget for the whole session, not just one leg. This spec is the only one
  // that plays a run to its natural end: it waits up to 200 s below for the
  // daylight clock to finish the flight (measured 145 s on a loaded box), on
  // top of a boot that the same box takes 11–45 s. Against the inherited 300 s
  // that left roughly a minute of headroom, which is how it landed at 3.7 m and
  // 4.1 m on desktop and phone — passing, but with a run ending in an unrelated
  // failure. 480 s is generous in the way `playwright.config.ts:14-20` asks for:
  // "runtime tracks machine load rather than test difficulty … generous, with
  // `expect` still failing fast on a real regression". Every assertion below is
  // unchanged, and the longest single wait is still the 200 s one it always was.
  test.setTimeout(480_000);
  const marks: EventMark[] = [];
  const interactions: Interaction[] = [];
  // The origin this run is ACTUALLY served from, not the one the base config
  // defaults to. It used to be the literal "http://127.0.0.1:4173", which is
  // `playwright.config.ts`'s baseURL and nothing else — so under any other
  // config this spec blocked its own application:
  //
  //   page.goto: net::ERR_INTERNET_DISCONNECTED at http://127.0.0.1:4311/
  //
  // `blockNetwork` aborts every request that does not start with `origin`, and
  // the app's own document is the first request to go, so the session never
  // started. The guard is the point of this spec — it is what makes every
  // number below the offline path — so the origin is read from the fixture,
  // the way `flight.spec.ts:22-26` already reads `baseURL`.
  const origin = new URL(baseURL!).origin;
  const net = await blockNetwork(page, origin);
  const t0 = Date.now();
  const at = (): number => Date.now() - t0;
  const mark = (event: string, detail?: string): void => { marks.push({ at: at(), event, ...(detail ? { detail } : {}) }); };
  const at2 = (event: string): number => marks.find(m => m.event === event)!.at;

  const app = new SunbirdPage(page);
  page.on("console", m => { if (m.type() === "error") mark("console-error", m.text().slice(0, 200)); });

  mark("navigation-start");
  await app.open();
  mark("document-committed");
  await app.ready();
  mark("first-flyable-frame", "boot shell removed, menu CTA visible");

  // --- Initial menu surface: objective decision load ---
  const menuSurface = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>('[data-ref="menuCard"]');
    const controls = Array.from(card?.querySelectorAll<HTMLElement>("button, a, input, select, [role=button]") ?? []);
    const visible = controls.filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    });
    const cta = card?.querySelector<HTMLElement>(".home-launch");
    const ctaBox = cta?.getBoundingClientRect();
    return {
      controls: visible.length,
      headings: Array.from(card?.querySelectorAll("h1, h2") ?? []).map(h => h.textContent?.replace(/\s+/g, " ").trim() ?? ""),
      primaryCtaLabel: cta?.getAttribute("aria-label") ?? null,
      primaryCtaVisibleInViewport: ctaBox ? ctaBox.top >= 0 && ctaBox.bottom <= window.innerHeight + 1 : null,
      cardOverflowPx: card ? card.scrollHeight - card.clientHeight : 0,
    };
  });
  mark("menu-measured", `${menuSurface.controls} visible controls`);

  // --- Menu → flight ---
  const menuInteractions: Interaction[] = [];
  await page.getByRole("button", { name: "Fly now", exact: true }).click();
  menuInteractions.push({ at: at(), kind: "click", target: "Fly now" });
  await expect(page.locator('[data-action="pause"]')).toBeVisible();
  mark("flight-started");

  const coachAtStart = await page.locator('[data-ref="hint"]').innerText().catch(() => null);
  mark("coach-line-at-start", (coachAtStart ?? "").replace(/\s+/g, " ").trim() || "none");

  // --- Fly for real. A handful of dives as the coach asks, then hands off:
  // the daylight clock ends the run. No hooks, no fast-forward. ---
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Space");
    interactions.push({ at: at(), kind: "key", target: "Space (dive)" });
    await page.waitForTimeout(450);
  }
  mark("input-handed-off", "waiting for the daylight clock to end the run");

  const endSurface = page.locator('[data-ref="continue"]:not(.hidden), [data-ref="over"]:not(.hidden)');
  await expect(endSurface).toBeVisible({ timeout: 200_000 });
  mark("run-ended");

  // --- What stands between death and the results card? ---
  const gateVisible = await page.locator('[data-ref="continue"]:not(.hidden)').isVisible().catch(() => false);
  let gate: { heading: string | null; options: { action: string | null; label: string; disabled: boolean }[] } | null = null;
  const deathToResults: Interaction[] = [];

  if (gateVisible) {
    mark("continue-gate-visible");
    gate = await page.evaluate(() => {
      const card = document.querySelector<HTMLElement>('[data-ref="contCard"]');
      return {
        heading: card?.querySelector("h2")?.textContent?.trim() ?? null,
        options: Array.from(card?.querySelectorAll<HTMLButtonElement>("button") ?? []).map(b => ({
          action: b.dataset.action ?? null,
          label: b.textContent?.replace(/\s+/g, " ").trim() ?? "",
          disabled: b.disabled,
        })),
      };
    });
    mark("continue-gate-measured", `${gate.options.length} options, ${gate.options.filter(o => o.disabled).length} disabled`);
    await page.locator('[data-ref="continue"] [data-action="continue-sleep"]').click();
    deathToResults.push({ at: at(), kind: "click", target: "End the flight" });
  } else {
    mark("no-continue-gate", "run went straight to the results card");
  }

  const over = page.locator('[data-ref="over"]');
  await expect(over).toBeVisible({ timeout: 20_000 });
  mark("results-visible");

  // --- Results surface: is the replay loop findable without scrolling? ---
  const resultsSurface = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>('[data-ref="overCard"]');
    const retry = card?.querySelector<HTMLElement>(".play-again-btn");
    const rb = retry?.getBoundingClientRect();
    return {
      heading: card?.querySelector("h2")?.textContent?.trim() ?? null,
      actions: Array.from(card?.querySelectorAll<HTMLButtonElement>("button") ?? []).map(b => ({
        action: b.dataset.action ?? null,
        label: b.textContent?.replace(/\s+/g, " ").trim() ?? "",
      })),
      retryInViewport: rb ? rb.top >= -1 && rb.bottom <= window.innerHeight + 1 : null,
      retryTopPx: rb ? Math.round(rb.top) : null,
      cardBottomPx: card ? Math.round(card.getBoundingClientRect().bottom) : null,
      viewportHeight: window.innerHeight,
      distance: card?.querySelector(".result-summary div:nth-child(1) b")?.textContent?.trim() ?? null,
    };
  });
  mark("results-measured", `${resultsSurface.actions.length} actions, retry in viewport: ${String(resultsSurface.retryInViewport)}`);

  // --- Results → retry ---
  const retryInteractions: Interaction[] = [];
  await page.locator('[data-ref="over"] .play-again-btn').click();
  retryInteractions.push({ at: at(), kind: "click", target: resultsSurface.actions.find(a => a.action === "retry")?.label ?? "Fly Again" });
  await expect(page.locator('[data-action="pause"]')).toBeVisible({ timeout: 20_000 });
  mark("retry-flight-started");

  const report = {
    project: info.project.name,
    viewport: page.viewportSize(),
    generatedAt: new Date().toISOString(),
    marks,
    counts: {
      menuToFlightInteractions: menuInteractions.length,
      deathToResultsInteractions: deathToResults.length,
      resultsToRetryInteractions: retryInteractions.length,
      diveInputsDuringRun: interactions.length,
    },
    timingsMs: {
      navigationToFirstFlyableFrame: at2("first-flyable-frame"),
      menuToFlight: at2("flight-started") - at2("first-flyable-frame"),
      flightToRunEnd: at2("run-ended") - at2("flight-started"),
      runEndToResults: at2("results-visible") - at2("run-ended"),
      resultsToRetryFlight: at2("retry-flight-started") - at2("results-visible"),
    },
    menuSurface,
    coachLineAtStart: coachAtStart,
    continueGate: gateVisible ? gate : "not shown on this profile",
    resultsSurface,
    network: { appRequestsAllowed: net.allowed(), externalBlocked: net.blocked.length, blockedUrls: net.blocked.slice(0, 20) },
    // Everything except the console lines this spec's own guard caused. See
    // BLOCKED_BY_GUARD above for why those are not the game's.
    errors: app.errors.filter(text => text !== BLOCKED_BY_GUARD),
    blockedResourceNoise: app.errors.filter(text => text === BLOCKED_BY_GUARD).length,
  };

  const out = join(here, "..", "test-artifacts", `first-session-${info.project.name}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2));

  // Structural facts only — no claim about how the session felt.
  expect(report.counts.menuToFlightInteractions).toBe(1);
  expect(report.counts.resultsToRetryInteractions).toBe(1);
  expect(report.resultsSurface.retryInViewport).toBe(true);
  expect(report.errors).toEqual([]);

  // The offline claim has to have actually been exercised. Without this the
  // guard could silently stop matching and the report would be an ordinary
  // online session wearing an offline label — every number in it still
  // plausible, none of them about the offline path the spec exists to measure.
  expect(report.network.externalBlocked, "nothing was blocked, so this was not an offline session").toBeGreaterThan(0);
  expect(report.network.appRequestsAllowed, "the app itself was never allowed to load").toBeGreaterThan(0);
  // The filter above may only ever hide as many lines as this spec caused. A
  // single blocked request cannot legitimately produce two console errors, so a
  // larger count means a real failure is hiding behind the noise filter.
  expect(
    report.blockedResourceNoise,
    `${report.blockedResourceNoise} blocked-resource errors for ${report.network.externalBlocked} blocked requests`,
  ).toBeLessThanOrEqual(report.network.externalBlocked);
});
