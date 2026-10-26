import { test, expect } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SunbirdPage } from "./SunbirdPage";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Chrome's line for a network fetch that never completed, e.g.
 * `Failed to load resource: net::ERR_NAME_NOT_RESOLVED`.
 *
 * The only absolute URL this build fetches is the Poki SDK script
 * `src/sdk/platform.ts` CDN-loads, and losing it is a path the code is written
 * around ("if the portal SDK can't load in this long, boot the game without
 * it", plus one retry). When the machine's DNS is briefly unavailable the fetch
 * fails and Chromium logs it — the network reporting a third-party request, not
 * the game misbehaving, and not what this spec is about. Nothing the game
 * fetches is absolute in a production build: `Realtime.URL_BASE` is empty
 * outside dev and `apiBase.backendBase("")` resolves to a relative prefix, so
 * this pattern can only ever describe a third-party resource.
 */
const THIRD_PARTY_RESOURCE_FAILURE = /^Failed to load resource: net::ERR_/;

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
  // Fresh storage for a genuine first flight. The `try` is the whole fix for
  // this spec failing on `errors` — it is not defensive dressing.
  //
  // `vite.config.ts:19` pins `const PORTAL = "poki"`, so EVERY build here
  // targets the portal and `src/sdk/platform.ts` CDN-loads
  // `https://game-cdn.poki.com/scripts/v2/poki-sdk.js` whenever the packaged tag
  // is absent — which it always is under a plain `vite preview`. That SDK pulls
  // in the Google IMA / GPT / Prebid ad stack, and those open sandboxed
  // `about:blank` ad frames. An init script runs in EVERY frame, so the bare
  // `localStorage.clear()` threw `SecurityError: Failed to read the
  // 'localStorage' property from 'Window': The document is sandboxed and lacks
  // the 'allow-same-origin' flag.` once per ad frame — two of them, on both
  // viewports, every run — and `SunbirdPage` (correctly) recorded them as page
  // errors, so the assertion below went red on noise this spec created itself.
  // The captured stack named it outright: `at <anonymous>:2:35`, which is this
  // injected wrapper, not any module in the bundle.
  //
  // The game's own storage access is already guarded for precisely this case
  // (`src/game/Storage.ts:141-146`: "sandboxed cross-origin iframe: the
  // accessor itself throws"). Clearing THIS origin's storage is the intent;
  // clearing a foreign ad frame's storage was never possible.
  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {
      /* a sandboxed ad frame — not the origin this spec is measuring */
    }
  });
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await app.fly();

  const t0 = Date.now();
  const samples: { t: number; text: string; visible: boolean; cls: string; handVisible: boolean; coachBarVisible: boolean }[] = [];
  // The sampling window opens when the coach is FIRST seen, not at flight
  // start, and is still 20 s long.
  //
  // The hint lane belongs to whichever feedback slot wins
  // (`src/game/HudFeedback.ts:feedbackSlot`), and for the first seconds of a run
  // that is the countdown, then the launch banner. The coach therefore cannot
  // appear until those are done — measured at 7.1 s and 10.9 s on desktop and
  // phone, and up to 12.9 s on a heavily loaded box. A window that opened at
  // flight start therefore spends most of its budget waiting, and under load
  // where a single `page.evaluate` costs seconds the loop can close having
  // collected two samples, both of them from the countdown:
  //
  //   Error: no visible coach line in 2 samples over 20 s (classes seen: hint show)
  //
  // That is a measurement of the machine, reported as a missing coach. Opening
  // the window on the first visible sample keeps the 20 s the file is about —
  // and 20 s of the cue being UP is exactly what the persistence claims below
  // are about. `firstVisibleCoachTextMs` still records the delay from flight
  // start, so nothing about the original measurement is lost.
  //
  // The cap is the backstop: a build with no coach at all still terminates and
  // fails on the assertions below rather than sampling forever.
  const WINDOW_MS = 20_000;
  const MAX_WAIT_MS = 60_000;
  let windowOpen: number | null = null;
  let shot1 = false;
  let shot5 = false;
  let shotCoach = false;
  const shots: string[] = [];
  while (Date.now() - t0 < MAX_WAIT_MS) {
    const s = await page.evaluate(() => {
      const painted = (el: HTMLElement | null): boolean => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.opacity !== "0" && cs.display !== "none";
      };
      const el = document.querySelector<HTMLElement>('[data-ref="hint"]');
      // The FirstFlight coach's OWN progress bar, not the sentence. The sentence
      // lane has a fallback — `Game.ts:8179` is `coachHint() || this.hint`, so a
      // coach that produces no text is silently replaced by the timed generic
      // hints ("HOLD to dive", "RELEASE · soften the landing"). A test that only
      // watches the sentence therefore passes on a build whose first-flight
      // coach has been removed, which is exactly what a mutation here proved.
      // `coachStep()` (`Game.ts:3180-3185`) collapses to `{step:-1, steps:0}` on
      // the same condition, so this bar is the DOM that only a live coach paints.
      const bar = document.querySelector<HTMLElement>('[data-ref="coachSteps"]');
      const hand = document.querySelector<HTMLElement>('[data-ref="hand"]');
      if (!el) return { text: "", visible: false, cls: "missing", handVisible: painted(hand), coachBarVisible: painted(bar) };
      return {
        text: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
        visible: painted(el),
        cls: el.className,
        handVisible: painted(hand),
        coachBarVisible: painted(bar),
      };
    });
    const at = Date.now() - t0;
    samples.push({ t: at, ...s });
    if (windowOpen === null && s.visible && s.text.length > 0) windowOpen = at;
    if (!shot1 && at > 1000) {
      const p = join(here, "..", "test-artifacts", `firstflight-1s-${info.project.name}.png`);
      await page.screenshot({ path: p }); shots.push(p); shot1 = true;
    }
    if (!shot5 && at > 5000) {
      const p = join(here, "..", "test-artifacts", `firstflight-5s-${info.project.name}.png`);
      await page.screenshot({ path: p }); shots.push(p); shot5 = true;
    }
    if (!shotCoach && s.visible && s.text.length > 0) {
      // The frame the claims below are about, unlike the two above it, which
      // land during the countdown and show a menu the player never sees.
      const p = join(here, "..", "test-artifacts", `firstflight-coach-${info.project.name}.png`);
      await page.screenshot({ path: p }); shots.push(p); shotCoach = true;
    }
    if (windowOpen !== null && at - windowOpen >= WINDOW_MS) break;
    await page.waitForTimeout(200);
  }

const withText = samples.filter(s => s.visible && s.text.length > 0);
  const handSamples = samples.filter(s => s.handVisible).length;
  const coachBarSamples = samples.filter(s => s.coachBarVisible).length;
  // The hand over the samples where the coach SENTENCE is up — the only fair
  // denominator. The sentence and the hand are different DOM nodes with
  // different visibility rules: `.hint` is display:none unless
  // `[data-feedback="hint"]` owns the slot (`src/index.css:2154-2157`), and the
  // slot is shared with the countdown, the launch banner and goal pops
  // (`src/game/HudFeedback.ts`). So the hand is legitimately absent in samples
  // where the sentence is not painted either, and a fraction over the whole
  // window measures slot contention rather than the cue — it came out at 0.52 on
  // a 412x839 phone, a hair off a threshold, which is how a threshold becomes
  // a flake. "Whenever the sentence is up, the hand is up" is the product
  // contract anyway: `Game.ts:8495-8503` derives both from the same coach state.
  const handWithCoach = samples.filter(s => s.visible && s.text.length > 0 && s.handVisible).length;
  const report = {
    project: info.project.name,
    viewport: page.viewportSize(),
    generatedAt: new Date().toISOString(),
    sampleCount: samples.length,
    // The window opens at the first visible coach line, so these fractions are
    // over "cue up" time. `firstVisibleCoachTextMs` is still measured from the
    // start of the flight, which is where the original trace measured it.
    windowOpenedAtMs: windowOpen,
    windowLengthMs: samples.length ? samples[samples.length - 1].t - (windowOpen ?? 0) : 0,
    samplesWithVisibleCoachText: withText.length,
    firstVisibleCoachTextMs: withText.length ? withText[0].t : null,
    // How much of the window carried the FirstFlight coach's OWN progress bar,
    // as opposed to the generic timed hints that share the same lane.
    coachBarSamples,
    coachBarFraction: Number((coachBarSamples / Math.max(1, samples.length)).toFixed(2)),
    // Objective proof of the persistent-hold-cue change: over a no-input first
    // flight the press hand must now stay visible for (nearly) the whole
    // window instead of vanishing after the old 2.6 s.
    handVisibleSamples: handSamples,
    handVisibleFraction: Number((handSamples / Math.max(1, samples.length)).toFixed(2)),
    handSamplesWithCoachText: handWithCoach,
    handWithCoachTextFraction: Number((handWithCoach / Math.max(1, withText.length)).toFixed(2)),
    coachLinesSeen: Array.from(new Set(withText.map(s => s.text))),
    samples,
    shots,
    errors: app.errors.filter(text => !THIRD_PARTY_RESOURCE_FAILURE.test(text)),
    thirdPartyResourceNoise: app.errors.length - app.errors.filter(text => !THIRD_PARTY_RESOURCE_FAILURE.test(text)).length,
  };
  const out = join(here, "..", "test-artifacts", `coach-trace-${info.project.name}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2));
  expect(report.errors).toEqual([]);

  // The trace is the deliverable, so these are the claims it has to earn.
  // Without them this spec only ever asserted "the page logged nothing", which
  // says nothing about the coach line its name asks about — and the first run
  // proved it: the report recorded `samplesWithVisibleCoachText: 20` and a
  // fully painted cue while the spec still failed for an unrelated reason.
  //
  // 1. The coach line reaches the screen at all during a first flight.
  //    `FirstFlight.view()` supplies the sentence and `HUD.ts:1661-1662` writes
  //    it plus the `show` class; without either, the hint lane is an empty box
  //    and the player is told nothing about the only mechanic in the game.
  expect(
    report.samplesWithVisibleCoachText,
    `no visible coach line in ${report.sampleCount} samples over 20 s (classes seen: ` +
      `${Array.from(new Set(samples.map(s => s.cls))).join(", ") || "none"})`,
  ).toBeGreaterThan(0);

  // 2. What it says is a sentence, not a glyph or a stray character.
  expect(report.coachLinesSeen.length).toBeGreaterThan(0);
  for (const line of report.coachLinesSeen) {
    expect(line.length, `coach line is not an instruction: ${JSON.stringify(line)}`).toBeGreaterThanOrEqual(8);
  }

  // 3. It is the FIRST-FLIGHT coach and not the generic fallback hints. This is
  //    the assertion that has teeth: the sentence lane degrades silently
  //    (`Game.ts:8179` is `coachHint() || this.hint`), so a build with the coach
  //    removed still shows plausible instructions and passes 1 and 2. Only the
  //    coach's own progress bar is exclusive to it — `coachStep()` collapses to
  //    `{step:-1, steps:0}` the moment the coach yields no text, and
  //    `HUD.ts:1671-1672` then keeps `.coach-steps` hidden.
  expect(
    report.coachBarSamples,
    `the first-flight coach progress bar was never on screen; the sentence lane was being ` +
      `served by the generic fallback hints instead (${report.coachLinesSeen.join(" | ") || "nothing"})`,
  ).toBeGreaterThan(0);

  // 4. The press hand is with the sentence for the WHOLE window. This is the
  //    regression the file documents: it used to vanish 2.6 s into the flight,
  //    leaving a first-time player holding nothing while the sentence carried
  //    on. Asserted as an exact match over every sample that showed the
  //    sentence, across 20 s of it, because a fraction is a threshold with a
  //    flake attached and this is a binary contract.
  expect(
    report.handSamplesWithCoachText,
    `press hand accompanied the coach sentence in only ${report.handSamplesWithCoachText}/` +
      `${report.samplesWithVisibleCoachText} samples over a ${Math.round(report.windowLengthMs / 1000)}s window`,
  ).toBe(report.samplesWithVisibleCoachText);
});
