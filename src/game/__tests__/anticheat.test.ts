import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyRunSubmission } from "../AntiCheat";
import { defaultProfile } from "../PlayerProfile";

describe("AntiCheat & Profiles", () => {
  it("generates a valid canonical profile", () => {
    const prof = defaultProfile("player_123", "Ace Pilot");
    expect(prof.playerId).toBe("player_123");
    expect(prof.displayName).toBe("Ace Pilot");
    expect(prof.guest).toBe(true);
    expect(prof.privacy.showOnLeaderboards).toBe(true);
    expect(prof.moderation.status).toBe("clear");
  });

  it("verifies realistic run submissions", () => {
    const res = verifyRunSubmission({
      distance: 1200,
      score: 15000,
      durationMs: 30000,
    });
    expect(res.valid).toBe(true);
    expect(res.quarantined).toBe(false);
  });

  it("quarantines impossible high-speed submissions", () => {
    const res = verifyRunSubmission({
      distance: 10000,
      score: 100000,
      durationMs: 5000, // 2000 m/s average speed!
    });
    expect(res.valid).toBe(false);
    expect(res.quarantined).toBe(true);
    expect(res.reason).toContain("Unrealistic average speed");
  });

  it("quarantines negative telemetry values", () => {
    const res = verifyRunSubmission({
      distance: -500,
      score: 100,
      durationMs: 1000,
    });
    expect(res.valid).toBe(false);
    expect(res.quarantined).toBe(true);
  });
});

/**
 * The wiring, not just the predicate.
 *
 * The predicate had a unit test for two years while nothing called it, so these
 * cases are about the shape the GAME actually submits.
 */
describe("run submissions the game really sends", () => {
  it("accepts a plausible flight", () => {
    // A 5 km run at the game's typical ~15 m/s cruise.
    const res = verifyRunSubmission({
      distance: 5000,
      altitude: 260,
      perfects: 14,
      coins: 96,
      score: 6100,
      durationMs: 333_000,
    });
    expect(res).toEqual({ valid: true, quarantined: false });
  });

  it("rejects a run with no duration — the defect that quarantined every honest score", () => {
    // This is what the shipping client used to build: ScoreSubmission had no
    // durationMs, and the server coerces a missing duration to 0, so its gate
    // read `distance > 0 && 0 < minRunDurationMs` and filed every real run as
    // quarantined. The type now requires the field; this pins the consequence.
    const res = verifyRunSubmission({ distance: 5000, score: 6100, durationMs: 0 });
    expect(res.valid).toBe(false);
    expect(res.reason).toContain("Instantaneous");
  });

  it("rejects a run whose score density is physically impossible", () => {
    const res = verifyRunSubmission({ distance: 800, score: 5_000_000, durationMs: 60_000 });
    expect(res.valid).toBe(false);
    expect(res.reason).toContain("Score density");
  });
});

/**
 * Client and server must not disagree about what is physically possible: a
 * client that is stricter than the server silently drops honest runs, and one
 * that is looser lets tampered telemetry through to be rejected only on the
 * way out. The server file names the client constants it mirrors, so this
 * reads those numbers back rather than trusting the comment.
 */
describe("client ⇄ server anti-cheat limits agree", () => {
  const server = readFileSync(resolve(__dirname, "../../../server/src/anticheat/limits.ts"), "utf8");
  const num = (key: string): number => {
    const found = new RegExp(`${key}\\s*:\\s*([0-9_]+)`).exec(server);
    expect(found, `server LIMITS.${key} not found — the pairing must be re-checked`).not.toBeNull();
    return Number(found![1]!.replace(/_/g, ""));
  };

  it("shares the average-speed ceiling", () => {
    expect(num("maxAvgSpeedMps")).toBe(120);
  });

  it("shares the minimum duration per 100 m", () => {
    expect(num("minMsPer100m")).toBe(500);
  });

  it("shares the score-density gates", () => {
    expect(num("scoreDensityFactor")).toBe(1000);
    expect(num("scoreDensityBase")).toBe(100_000);
  });
});
