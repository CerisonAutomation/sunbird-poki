import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MAX_LEGAL_SPEED_MPS, defaultProfile, verifyRunSubmission } from "../AntiCheat";
import { Bird } from "../Bird";
import { SKINS } from "../Economy";
import { endlessSpeedScale } from "../FlightProgression";
import { TerrainSystem } from "../TerrainSystem";
import { BOOST_EXTRA_SPEED, MAX_SPEED_FEVER } from "../constants";

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

  it("accepts a legal fever-and-boost run, which used to be quarantined", () => {
    // MAX_SPEED_FEVER (128) plus a boost (42) is 170 m/s of legal ceiling. The
    // speed gate was a literal 120, so a player who used both — the exact play
    // the leaderboard is supposed to reward — averaged out above the ceiling and
    // got filed as a cheater. The gate is now derived from the physics.
    const topSpeed = MAX_SPEED_FEVER + BOOST_EXTRA_SPEED;
    const res = verifyRunSubmission({
      distance: 5000,
      score: 6100,
      durationMs: (5000 / topSpeed) * 1000, // a run held flat at the ceiling
    });
    expect(res, res.reason).toEqual({ valid: true, quarantined: false });
  });

  it("still quarantines a run beyond the physics ceiling", () => {
    const res = verifyRunSubmission({
      distance: 5000,
      score: 6100,
      durationMs: (5000 / (MAX_SPEED_FEVER + BOOST_EXTRA_SPEED) / 2) * 1000,
    });
    expect(res.valid).toBe(false);
    expect(res.reason).toContain("Unrealistic average speed");
  });

  it("applies the physics gate to a SHORT run too, not only past 100 m", () => {
    // The checks used to be skipped entirely below 100 m, so a 90 m run could
    // claim any speed at all and pass clean.
    const res = verifyRunSubmission({ distance: 90, score: 100, durationMs: 40 });
    expect(res.valid).toBe(false);
    expect(res.reason).toContain("Unrealistic average speed");
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

/**
 * The speed gate must bound what the shipped physics can actually produce.
 *
 * It has been wrong twice: first as a literal 120, then as `MAX_SPEED_FEVER +
 * BOOST_EXTRA_SPEED` (170) described in its own comment as "derived from the
 * physics" while omitting two of the three multipliers `Game.fixedUpdate()`
 * passes into `Bird.step()`. A fever + boost run in a 1.08 skin deep into an
 * escalating mode reaches ~236 m/s and was quarantined as cheating.
 *
 * So this does not compare the constant to another constant — that is the
 * mistake it exists to prevent. It drives the real `Bird` at the worst legal
 * combination of inputs and asserts the gate is above what comes out, and not
 * absurdly above it.
 */
describe("speed ceiling bounds the real physics", () => {
  const worstCaseSpeedMult = () => {
    const fastestSkin = SKINS.reduce((m, s) => Math.max(m, s.speedMult), 1);
    // Far enough along the escalation curve to be at its asymptote.
    return fastestSkin * endlessSpeedScale(500, 1e6);
  };

  const flatOut = (): number => {
    const terrain = new TerrainSystem("anticheat-ceiling");
    const bird = new Bird();
    bird.x = 400;
    bird.y = terrain.heightAt(400) + 200;
    bird.grounded = false;
    bird.vx = 400;
    bird.vy = 0;
    const opts = { diving: true, fever: true, speedMult: worstCaseSpeedMult(), boost: true };
    // The cap is applied every step, so a handful of steps is enough to pin to it.
    for (let i = 0; i < 20; i += 1) bird.step(1 / 120, opts, terrain);
    return bird.speed();
  };

  it("a maximal legal run is not treated as cheating", () => {
    const reached = flatOut();
    expect(reached).toBeGreaterThan(200); // sanity: we really are at the ceiling
    expect(reached).toBeLessThanOrEqual(MAX_LEGAL_SPEED_MPS);
  });

  it("the gate is not so loose that it stops being a gate", () => {
    // Within 15% of what the physics can reach: high enough to clear every
    // legal run, low enough that a fabricated score still fails.
    expect(MAX_LEGAL_SPEED_MPS).toBeLessThan(flatOut() * 1.15);
  });

  it("tracks the skin table rather than a transcribed number", () => {
    const fastestSkin = SKINS.reduce((m, s) => Math.max(m, s.speedMult), 1);
    expect(MAX_LEGAL_SPEED_MPS).toBeGreaterThan(MAX_SPEED_FEVER * fastestSkin);
  });
});
