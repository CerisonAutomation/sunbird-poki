/**
 * Engagement regressions for the results card and the home hero — the levers
 * from docs/poki/ENGAGEMENT_PLAYBOOK.md that live in markup, locked here so a
 * refactor cannot quietly re-bury them.
 *
 * The playbook's diagnosis: the 2026-10-04 fit test lost players at the recap
 * (avg 1m20s, retry rate low). Three markup causes — a headline that mourned
 * successful runs, a near-miss strip buried below eight folds, and the armed
 * coin bonus below the fold — are each pinned by a test below. The home-hero
 * streak chip (endowed progress at the return decision point) is pinned too.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderGameOver } from "../hud/run";
import { mountHud, snapshotStub, WINGS } from "./hudHarness";
import type { HudSnapshot } from "../hud/types";

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

/** A snapshot whose unread fields render as inert empties (see hudHarness). */
function recap(over: Record<string, unknown> = {}): string {
  const snap = snapshotStub();
  Object.assign(snap, {
    // Multiplayer strips — inert for a solo day trip.
    massRace: false, roomCode: "", racePlace: 0, raceRated: false, raceVerified: false,
    raceField: 0, raceFinishM: 0, raceFinishTime: 0, ratingDelta: 0, ratingBonus: 0,
    duelWas: "", duelDelta: 0, duel: { wins: 0, losses: 0, streak: 0 },
    versus: false, versusWinner: 0, p1Stats: null, p2Stats: null, photoFinish: "",
    rival: { rating: 1000, streak: 0 },
    // Share — unavailable build: the clipboard fallback is the honest floor.
    share: { available: false, loaded: null, code: "", busy: false, error: "" },
    shareBusy: false, expShareFirst: false,
    // Empty collections render their sections as no-ops.
    sessionGoals: [], quests: [], missions: [], newlyCompleted: [], highScores: [],
    claimedQuests: [], flightPath: [], skins: [], mastery: [], celebration: null,
    // Scalar readouts.
    endReason: "daylight", runOutcome: "complete", modeId: "daytrip", modeName: "Day Trip",
    distance: 0, score: 0, coins: 0, bestDistance: 0, island: 0,
    perfects: 0, zeniths: 0, rings: 0, balloons: 0, sunflowers: 0,
    slopeScore: 0, slopeChain: 0, nestLevel: 1, nestMult: 1,
    newBest: false, nextAction: "", nearMiss: "", challengeOutcome: "",
    ghostDelta: null, board: null, boardScope: "global", boardMetric: "distance",
    multiplierClaimed: false, portalName: "none",
    wallet: { coins: 0 }, wings: WINGS,
    season: { tier: 1, maxTier: 50 }, trophyCounts: { unlocked: 0, total: 0 },
    campaignDone: 0, campaignTotal: 0, biomeEmoji: "sun", biomeName: "Meadows",
    ...over,
  });
  return renderGameOver(snap as unknown as HudSnapshot);
}

describe("outcome-aware recap headline (playbook §3)", () => {
  it("celebrates a day trip flown to sundown as a complete flight", () => {
    const html = recap({ endReason: "daylight", runOutcome: "complete" });
    expect(html).toContain("You flew to sundown");
    // The old shame frame — "The sun beat you" — must not greet a completed run.
    expect(html).not.toContain("The sun beat you");
  });

  it("celebrates a chosen landing as a completed journey", () => {
    const html = recap({ endReason: "settled", runOutcome: "complete" });
    expect(html).toContain("Flight complete — landed clean");
    expect(html).not.toContain("You stopped flying");
  });

  it("keeps honest coaching for genuine fails (a ditching is still a fail)", () => {
    const html = recap({ endReason: "water", runOutcome: "fail" });
    expect(html).toContain("You washed out");
    expect(html).toContain("The sea took the run");
  });

  it("coaches a no-show daylight run instead of celebrating it", () => {
    const html = recap({ endReason: "daylight", runOutcome: "fail" });
    expect(html).toContain("The sun beat you");
    expect(html).not.toContain("You flew to sundown");
  });
});

describe("recap fold order (playbook §3 + lever 8)", () => {
  it("puts the near-miss strip at the emotional peak: after the tagline, before the retry button", () => {
    const html = recap({
      endReason: "daylight",
      runOutcome: "fail",
      nearMiss: "2% off your best distance",
    });
    const nearMiss = html.indexOf("2% off your best distance");
    const tagline = html.indexOf("One more flight?");
    const actions = html.indexOf("result-actions");
    expect(nearMiss).toBeGreaterThan(tagline);
    expect(nearMiss).toBeLessThan(actions);
  });

  it("shows the armed coin bonus and next flight above the fold, right after the stats", () => {
    // coins > 0 arms the 3× bonus card; with 0 coins it correctly renders nothing.
    const html = recap({ endReason: "daylight", runOutcome: "complete", coins: 120 });
    const summary = html.indexOf("result-summary");
    const multiplier = html.indexOf("multiplier-cta-card");
    const nextFlight = html.indexOf("next-flight");
    const links = html.indexOf("result-links");
    expect(multiplier).toBeGreaterThan(summary);
    expect(nextFlight).toBeGreaterThan(summary);
    // And no second copy below the fold (the move must not duplicate the card).
    expect(html.indexOf("multiplier-cta-card", multiplier + 1)).toBe(-1);
    expect(links).toBeGreaterThan(multiplier);
  });

  it("keeps Fly Again as the first action in the card's action row", () => {
    const html = recap({ endReason: "daylight", runOutcome: "complete" });
    const actions = html.indexOf("result-actions");
    const flyAgain = html.indexOf("Fly Again");
    const menu = html.indexOf("Main Menu");
    expect(actions).toBeGreaterThan(-1);
    expect(flyAgain).toBeGreaterThan(actions);
    expect(flyAgain).toBeLessThan(menu);
  });
});

describe("home-hero streak chip (playbook lever 4)", () => {
  it("surfaces a 2+ day streak on the hero, where the return decision happens", async () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const { root } = await mountHud({ state: "menu", screen: "main", streakDays: 3 });
    const chip = root.querySelector(".streak-pill");
    expect(chip?.textContent).toContain("3-day streak");
  });

  it("stays quiet at 0-1 days (no fake endowed progress)", async () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const { root } = await mountHud({ state: "menu", screen: "main", streakDays: 1 });
    expect(root.querySelector(".streak-pill")).toBeNull();
  });
});
