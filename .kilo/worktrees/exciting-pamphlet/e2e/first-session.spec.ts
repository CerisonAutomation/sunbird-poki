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

test("first session: objective timings, gates and interaction counts", async ({ page }, info) => {
  test.setTimeout(300_000);
  const marks: EventMark[] = [];
  const interactions: Interaction[] = [];
  const origin = "http://127.0.0.1:4173";
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
  await page.getByRole("button", { name: "Play free flight now", exact: true }).click();
  menuInteractions.push({ at: at(), kind: "click", target: "Play free flight now" });
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
    deathToResults.push({ at: at(), kind: "click", target: "Let it sleep" });
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
    errors: app.errors,
  };

  const out = join(here, "..", "test-artifacts", `first-session-${info.project.name}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2));

  // Structural facts only — no claim about how the session felt.
  expect(report.counts.menuToFlightInteractions).toBe(1);
  expect(report.counts.resultsToRetryInteractions).toBe(1);
  expect(report.resultsSurface.retryInViewport).toBe(true);
  expect(report.errors).toEqual([]);
});
