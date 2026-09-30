import { describe, expect, it } from "vitest";
import { journeyAction, type JourneyActionContext } from "../actions/journey";
import { dailyChallenge, weeklyGauntlet } from "../Challenges";
import { DAILY_STIPEND } from "../constants";
import { modeById } from "../Modes";
import { weekKey } from "../Tournaments";
import { SaveData } from "../SaveData";
import type { GameAudio } from "../Audio";
import type { Bird } from "../Bird";
import type { HUD } from "../HUD";
import type { ParticleFX } from "../ParticleFX";

/**
 * The journey action table, exercised without a Game.
 *
 * Two things are being defended here, and they are different in kind.
 *
 * The first is table logic: the daily-completion check, the claim-once guards,
 * and the mode each entry selects. The mode assertions are the important ones —
 * picking a challenge is the table's only decision, and it is made by WRITING
 * `ctx.modeId`. A test that stops checking the write-back would let a broken
 * selection ship silently, because nothing else about a challenge start looks
 * wrong until the player is flying the wrong course.
 *
 * The second is the adapter, and no test in this file can see it. `modeId` and
 * `mode` are only plain data properties here; in `Game.journeyContext()` they
 * must be live accessors, or every write lands on a throwaway object that
 * typechecks perfectly. That is a review/audit obligation, not a unit-test one
 * — grep the adapter for `modeId: this.modeId` before trusting it.
 */

interface Recorded {
  toasts: string[];
  calls: string[];
  runs: { challenge?: string; event?: boolean }[];
}

function recorder(): Recorded {
  return { toasts: [], calls: [], runs: [] };
}

function context(save: SaveData, rec: Recorded, today: string, over: Partial<JourneyActionContext> = {}): JourneyActionContext {
  return {
    save,
    hud: { toast: (message: string) => rec.toasts.push(message) } as unknown as HUD,
    audio: { purchase() {}, chapterFanfare() {} } as unknown as GameAudio,
    particles: { emitConfetti() {} } as unknown as ParticleFX,
    bird: { x: 0, y: 0 } as unknown as Bird,
    today,
    modeId: "daytrip",
    mode: modeById("daytrip"),
    todaysDaily: () => dailyChallenge(today, save.state.challenges.dailyChallengeFailures ?? 0),
    exitVersus: () => rec.calls.push("exitVersus"),
    startRun: (opts) => {
      rec.runs.push(opts ?? {});
      rec.calls.push("startRun");
    },
    setScreen: (screen) => rec.calls.push("screen:" + screen),
    bump: () => rec.calls.push("bump"),
    ...over,
  };
}

const TODAY = "2026-09-30";

describe("journey action table", () => {
  it("consumes only the actions it owns", () => {
    const save = new SaveData();
    const rec = recorder();
    expect(journeyAction(context(save, rec, TODAY), "not-a-journey", "")).toBe(false);
    expect(journeyAction(context(save, rec, TODAY), "open-challenges", "")).toBe(true);
  });

  it("selects the daily's own mode and launches it as a challenge", () => {
    const save = new SaveData();
    const rec = recorder();
    // Pinned to a mode that is NOT the seeded default. With the real daily
    // the mode is whatever TODAY rolls, and when that happens to equal
    // "daytrip" the assertion below passes even if the write-back were dropped
    // entirely — the guard would be decorative. A fixed different mode makes
    // it real: a dropped write leaves modeId on "daytrip" and fails.
    const ctx = context(save, rec, TODAY, {
      todaysDaily: () => ({ ...dailyChallenge(TODAY, 0), mode: "endless" as const }),
    });

    expect(journeyAction(ctx, "play-daily", "")).toBe(true);
    // The write-back: the flight must be launched in the challenge's mode.
    expect(ctx.modeId).toBe("endless");
    expect(ctx.mode).toEqual(modeById("endless"));
    expect(rec.runs).toEqual([{ challenge: "daily" }]);
    expect(rec.calls).toContain("exitVersus");
  });

  it("refuses to start a daily that is already complete", () => {
    const save = new SaveData();
    const rec = recorder();
    const ctx = context(save, rec, TODAY);
    save.completeDaily(TODAY);

    expect(journeyAction(ctx, "play-daily", "")).toBe(true);
    // The guard is the handler's own: a stale card can still post the action.
    expect(rec.runs).toHaveLength(0);
    expect(ctx.modeId).toBe("daytrip");
    expect(rec.toasts.join(" ")).toMatch(/already complete/i);
  });

  it("clamps a gauntlet stage id into range and locks a cleared stage", () => {
    const save = new SaveData();
    const rec = recorder();
    const ctx = context(save, rec, TODAY);
    const gauntlet = weeklyGauntlet(weekKey());

    // Out-of-range ids clamp rather than reading past the end of the stage list.
    expect(journeyAction(ctx, "play-gauntlet", "99")).toBe(true);
    expect(ctx.modeId).toBe(gauntlet.stages[2]!.mode);
    expect(rec.runs).toEqual([{ challenge: "gauntlet2" }]);

    save.completeGauntletStage(gauntlet.week, 2);
    rec.runs.length = 0;
    expect(journeyAction(ctx, "play-gauntlet", "2")).toBe(true);
    expect(rec.runs).toHaveLength(0);
    expect(rec.toasts.join(" ")).toMatch(/already cleared/i);
  });

  it("locks the event to the daytrip mode", () => {
    const save = new SaveData();
    const rec = recorder();
    const ctx = context(save, rec, TODAY);
    expect(journeyAction(ctx, "play-event", "")).toBe(true);
    expect(ctx.modeId).toBe("daytrip");
    expect(rec.runs).toEqual([{ event: true }]);
  });

  it("refuses a second claim of the same daily stipend", () => {
    const save = new SaveData();
    const rec = recorder();
    const ctx = context(save, rec, TODAY);
    const before = save.state.wallet;

    // The card disables via the snapshot, but a double-tap can land before
    // the re-render — the handler has to be its own guard.
    expect(journeyAction(ctx, "claim-daily-stipend", "")).toBe(true);
    const afterFirst = save.state.wallet;
    expect(afterFirst).toBeGreaterThan(before);
    expect(save.state.lastStipendClaimed).toBe(TODAY);

    expect(journeyAction(ctx, "claim-daily-stipend", "")).toBe(true);
    expect(save.state.wallet).toBe(afterFirst);
    expect(rec.toasts).toHaveLength(1);
    expect(rec.toasts.join(" ")).toContain(String(DAILY_STIPEND));
  });

  it("will not claim a calendar gift twice on the same day", () => {
    const save = new SaveData();
    const rec = recorder();
    const ctx = context(save, rec, TODAY);

    expect(journeyAction(ctx, "claim-calendar", "")).toBe(true);
    const afterFirst = save.state.wallet;
    expect(rec.toasts).toHaveLength(1);

    expect(journeyAction(ctx, "claim-calendar", "")).toBe(true);
    expect(save.state.wallet).toBe(afterFirst);
    expect(rec.toasts[1]).toMatch(/already claimed/i);
  });

  it("pays a campaign chapter only once it is unlocked and complete", () => {
    const save = new SaveData();
    // No chapter can be complete on a save with no claim history, and saying so
    // explicitly keeps the test independent of anything left in storage by an
    // earlier case (the table calls `persist()` on some paths).
    save.state.campaignClaimed = [];
    const rec = recorder();
    const ctx = context(save, rec, TODAY);

    // An unknown id is consumed and silent — it is a stale card, not an error.
    expect(journeyAction(ctx, "claim-campaign", "not-a-chapter")).toBe(true);
    expect(rec.toasts).toHaveLength(0);

    // The first chapter cannot be complete on a fresh save.
    expect(journeyAction(ctx, "claim-campaign", "ch1")).toBe(true);
    expect(rec.toasts.join(" ")).toMatch(/not ready/i);
    expect(save.state.wallet).toBe(0);
  });

  it("opens the challenge and campaign screens without side effects", () => {
    const save = new SaveData();
    const rec = recorder();
    const ctx = context(save, rec, TODAY);
    expect(journeyAction(ctx, "open-challenges", "")).toBe(true);
    expect(journeyAction(ctx, "open-campaign", "")).toBe(true);
    expect(rec.calls).toEqual(["screen:challenges", "screen:campaign"]);
    expect(rec.runs).toHaveLength(0);
  });
});
