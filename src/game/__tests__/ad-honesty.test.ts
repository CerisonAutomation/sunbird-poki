/**
 * Ad honesty for the direct (non-portal) build.
 *
 * The failure mode this file exists to prevent: a build that *shows* a
 * sponsored break it cannot serve. The direct build has no ad network wired in,
 * so `MockAdProvider` used to interrupt a run with "Sponsored break… Your ad is
 * loading… Skip in 3" that never became an ad — a fake ad state that cost the
 * player time for nothing, while the Gold pitch sold "No sponsored breaks, ever"
 * (i.e. charged to remove a break that was never an ad).
 *
 * Every direct-build break surface is now gated on `edition.SIMULATED_BREAKS`,
 * which is off unless the build is made with `VITE_SIM_BREAKS=true` (an ad-flow
 * rehearsal, or a future real provider). These guards pin the gate at each use
 * site, because a new call site added without it would silently ship a fake ad
 * again — and pin the cadence maths the UI copy promises ("N left today"), so a
 * real provider can be wired later without re-deriving it.
 *
 * Portal builds are covered by `src/sdk/__tests__/poki-breaks.test.ts`: Poki and
 * CrazyGames supply real `commercialBreak` / `rewardedBreak` calls and own ad
 * frequency (REQ-20), so they must never simulate one.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { AD_MIN_RUN_GAP, ADS_PER_DAY, INTERSTITIAL_EVERY } from "../constants";
import { SIMULATED_BREAKS } from "../edition";
import { SaveData } from "../SaveData";

/** Read a repo source file (vitest runs from the workspace root). */
function src(...parts: string[]): string {
  return readFileSync(join(process.cwd(), "src", ...parts), "utf8");
}

/** The full statement starting at `marker`, so multi-line gates are caught. */
function statement(text: string, marker: string): string {
  const at = text.indexOf(marker);
  expect(at, `expected to find ${marker}`).toBeGreaterThanOrEqual(0);
  const end = text.indexOf(";", at);
  return text.slice(at, end === -1 ? at + 400 : end + 1);
}

describe("the shipped direct build never fakes a sponsored break", () => {
  it("runs with simulated breaks off unless VITE_SIM_BREAKS opts in", () => {
    // Tests run in the shipped configuration (the env var unset), which is the
    // configuration this whole file protects.
    expect(SIMULATED_BREAKS).toBe(false);
  });

  it("pins the flag to the direct target only, so a portal can never simulate", () => {
    const config = readFileSync(join(process.cwd(), "vite.config.ts"), "utf8");

    expect(config).toMatch(
      /"import\.meta\.env\.VITE_SIM_BREAKS": JSON\.stringify\(PORTAL === "none" && process\.env\.VITE_SIM_BREAKS === "true"\)/,
    );
  });

  it("gates the end-of-run interstitial on the flag", () => {
    const dueAd = statement(src("game", "Game.ts"), "const dueAd =");

    expect(dueAd).toContain("SIMULATED_BREAKS");
    // The portal path is decided elsewhere (real breaks), so the direct gate
    // must stay a conjunction: flag AND not-a-portal AND not-Gold AND cadence.
    expect(dueAd).toContain("!this.portalEnabled()");
    expect(dueAd).toContain("shouldShowInterstitial");
  });

  it("gates the continue card's second-wind ad offer on the flag", () => {
    const game = src("game", "Game.ts");
    const canAd = statement(game, "const canAd =");

    expect(canAd).toContain("SIMULATED_BREAKS");
    // The snapshot field the continue card reads must agree with canAd, or the
    // card would offer a break the game refuses to play.
    expect(statement(game, "adAvailable: this.portalEnabled()")).toContain("SIMULATED_BREAKS");
  });

  it("never promises a daily break cap the build does not enforce", () => {
    const hud = src("game", "HUD.ts");
    const at = hud.indexOf("Sponsored breaks respect a hard cap");

    expect(at).toBeGreaterThanOrEqual(0);
    // The gate sits immediately before the copy in the same template expression.
    expect(hud.slice(Math.max(0, at - 220), at)).toContain("SIMULATED_BREAKS && s.portalName === \"none\"");
  });

  it("keeps the Gold pitch honest: no ad-removal bullet without real breaks", async () => {
    const { GOLD } = await import("../Economy");

    expect(GOLD.features.some((f) => /sponsored break/i.test(f))).toBe(false);
    // The bullet is gated on the Vite define so Rollup DCEs the string out of
    // every build that cannot serve a break (all portals, plus this one).
    expect(src("game", "Economy.ts")).toContain('import.meta.env.VITE_SIM_BREAKS ? ["No sponsored breaks, ever"]');
  });
});

describe("interstitial cadence (the maths the UI copy promises)", () => {
  // Exercised even though the shipped build never plays one: a real provider
  // gets wired against this, the daily cap is what "N left today" reports, and
  // silent rot here would resurface as ad spam the moment the flag flips on.
  let save: SaveData;

  // SaveData persists through localStorage, so the daily ad counter would
  // otherwise leak from one case into the next.
  beforeEach(() => {
    localStorage.clear();
    save = new SaveData();
  });

  it("gives the first two runs a clean start", () => {
    expect(save.shouldShowInterstitial(0)).toBe(false);
    expect(save.shouldShowInterstitial(1)).toBe(false);
    expect(save.shouldShowInterstitial(2)).toBe(true);
  });

  it("paces breaks every INTERSTITIAL_EVERY runs after the grace period", () => {
    const due = [2, 3, 4, 5, 6, 7, 8, 9].filter((runs) => save.shouldShowInterstitial(runs));

    expect(due).toEqual([2, 5, 8]);
    expect(INTERSTITIAL_EVERY).toBe(3);
  });

  it("enforces a minimum gap between two breaks", () => {
    save.recordAdImpression(5);
    // Next due run is 8, but a break one run later is too soon.
    expect(save.shouldShowInterstitial(6)).toBe(false);
    expect(AD_MIN_RUN_GAP).toBeGreaterThan(1);
    expect(save.shouldShowInterstitial(8)).toBe(true);
  });

  it("hard-caps breaks per day, and the cap is what adsLeftToday reports", () => {
    expect(save.adsLeftToday()).toBe(ADS_PER_DAY);
    for (let i = 0; i < ADS_PER_DAY; i += 1) save.recordAdImpression(2 + i * INTERSTITIAL_EVERY);

    expect(save.adsLeftToday()).toBe(0);
    // A due run with an exhausted cap must not show a break — the cap is
    // enforced, not decorative.
    expect(save.shouldShowInterstitial(2 + ADS_PER_DAY * INTERSTITIAL_EVERY)).toBe(false);
  });
});
