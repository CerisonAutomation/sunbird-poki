import { test, expect } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SunbirdPage } from "./SunbirdPage";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * First-flight coach visibility trace.
 *
 * The first-session probe read the coach line at the instant flight started
 * and got an empty string. This samples the hint element every 200 ms for the
 * first 20 s of a genuine first flight (fresh storage) and records, frame by
 * frame, whether the on-screen instruction exists and what it says. Also grabs
 * screenshots at t+1 s and t+5 s so the write-up can show what the player sees
 * rather than describe it.
 */
test("first flight: is the coach line on screen?", async ({ page }, info) => {
  await page.addInitScript(() => localStorage.clear());
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await app.fly();

  const t0 = Date.now();
  const samples: { t: number; text: string; visible: boolean; cls: string; handVisible: boolean }[] = [];
  const deadline = Date.now() + 20_000;
  let shot1 = false;
  let shot5 = false;
  const shots: string[] = [];
  while (Date.now() < deadline) {
    const s = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('[data-ref="hint"]');
      const hand = document.querySelector<HTMLElement>('[data-ref="hand"]');
      const handVisible = (() => {
        if (!hand) return false;
        const r = hand.getBoundingClientRect();
        const cs = getComputedStyle(hand);
        return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.opacity !== "0" && cs.display !== "none";
      })();
      if (!el) return { text: "", visible: false, cls: "missing", handVisible };
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        text: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
        visible: r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.opacity !== "0" && cs.display !== "none",
        cls: el.className,
        handVisible,
      };
    });
    samples.push({ t: Date.now() - t0, ...s });
    if (!shot1 && Date.now() - t0 > 1000) {
      const p = join(here, "..", "test-artifacts", `firstflight-1s-${info.project.name}.png`);
      await page.screenshot({ path: p }); shots.push(p); shot1 = true;
    }
    if (!shot5 && Date.now() - t0 > 5000) {
      const p = join(here, "..", "test-artifacts", `firstflight-5s-${info.project.name}.png`);
      await page.screenshot({ path: p }); shots.push(p); shot5 = true;
    }
    await page.waitForTimeout(200);
  }

  const withText = samples.filter(s => s.visible && s.text.length > 0);
  const handSamples = samples.filter(s => s.handVisible).length;
  const report = {
    project: info.project.name,
    viewport: page.viewportSize(),
    generatedAt: new Date().toISOString(),
    sampleCount: samples.length,
    samplesWithVisibleCoachText: withText.length,
    firstVisibleCoachTextMs: withText.length ? withText[0].t : null,
    // Objective proof of the persistent-hold-cue change: over a no-input first
    // flight the press hand must now stay visible for (nearly) the whole
    // window instead of vanishing after the old 2.6 s.
    handVisibleSamples: handSamples,
    handVisibleFraction: Number((handSamples / Math.max(1, samples.length)).toFixed(2)),
    coachLinesSeen: Array.from(new Set(withText.map(s => s.text))),
    samples,
    shots,
    errors: app.errors,
  };
  const out = join(here, "..", "test-artifacts", `coach-trace-${info.project.name}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2));
  expect(app.errors).toEqual([]);
});
