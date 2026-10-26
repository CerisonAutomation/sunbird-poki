import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  ANTICHEAT_MAX_SPEED_MPS,
  ANTICHEAT_MIN_MS_PER_100M,
  defaultProfile,
  verifyRunSubmission,
} from "../AntiCheat";
import { Bird } from "../Bird";
import { BOOST_EXTRA_SPEED, MAX_MODE_SPEED_BONUS, MAX_SKIN_SPEED_MULT, MAX_SPEED_FEVER, PHYS_DT } from "../constants";
import { SKINS } from "../Economy";
import { ENDLESS_SPEED_SCALE_MAX } from "../FlightProgression";
import { TerrainSystem } from "../TerrainSystem";

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
    // MAX_SPEED_FEVER (128) plus a boost (42) is 170 m/s, and the speed gate
    // used to be a literal 120, so a player who used both — the exact play the
    // leaderboard is supposed to reward — was filed as a cheater. The gate is
    // now derived from the physics, and 170 is only the floor of what it
    // permits: the real ceiling also carries the skin and escalation multipliers.
    const res = verifyRunSubmission({
      distance: 5000,
      score: 6100,
      // 95% of the ceiling, not 100%. At exactly the ceiling the duration and
      // the minimum-duration bound are algebraically the same number, so the
      // assertion would be decided by float rounding rather than by the gate.
      durationMs: (5000 / (ANTICHEAT_MAX_SPEED_MPS * 0.95)) * 1000,
    });
    expect(res, res.reason).toEqual({ valid: true, quarantined: false });

    // The escalated case that was still being rejected after the 170 fix: the
    // fastest skin, deep into a long run, fever and boost together.
    expect(ANTICHEAT_MAX_SPEED_MPS).toBeGreaterThan(MAX_SPEED_FEVER + BOOST_EXTRA_SPEED);
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
    const found = new RegExp(`${key}\\s*:\\s*([0-9_]+(?:\\.[0-9]+)?)`).exec(server);
    expect(found, `server LIMITS.${key} not found — the pairing must be re-checked`).not.toBeNull();
    return Number(found![1]!.replace(/_/g, ""));
  };

  // These compare the SERVER against the CLIENT's own exported constants. The
  // previous version asserted the server equalled a hardcoded 120, which is
  // how a 120 server sat behind a 170 client for so long without a single test
  // going red: the assertion was true of the server and silent about the game.
  it("shares the average-speed ceiling", () => {
    expect(num("maxAvgSpeedMps")).toBeCloseTo(ANTICHEAT_MAX_SPEED_MPS, 2);
  });

  it("shares the minimum duration per 100 m", () => {
    expect(num("minMsPer100m")).toBeCloseTo(ANTICHEAT_MIN_MS_PER_100M, 1);
  });

  it("shares the score-density gates", () => {
    expect(num("scoreDensityFactor")).toBe(1000);
    expect(num("scoreDensityBase")).toBe(100_000);
  });
});

/**
 * The ceiling has to be a property of the PHYSICS, not a number that was once
 * correct. This drives the real `Bird` at the most generous settings the game
 * can assemble — fever, boost, the fastest skin, deep into an escalating run —
 * and asserts the gate is at least as high as what the bird actually reaches.
 * Every previous version of this gate was a literal that lagged the game.
 */
describe("the anti-cheat ceiling is derived from the physics it gates", () => {
  const SPEED_OPTS = {
    // DIVING, not gliding. This probe used to glide, and a gliding bird settles
    // around 94 m/s because drag balances gravity long before the cap is
    // reached — so the probe measured a number 2.7x below the gate and its
    // "the gate is not absurdly generous" half could never be satisfied. The
    // cap only means anything at the top of a dive, which is also the only way
    // a player ever gets near it.
    diving: true,
    fever: true,
    speedMult: MAX_SKIN_SPEED_MULT * ENDLESS_SPEED_SCALE_MAX,
    boost: true,
    // The fourth term of the cap expression, and the one that was missing from
    // the ceiling for a whole release. Without it this probe tops out ~14 m/s
    // UNDER the gate and the quarantine bug stays invisible.
    speedBonus: MAX_MODE_SPEED_BONUS,
  } as const;

  it("no faster than the ceiling, at the most generous settings the game can build", () => {
    const terrain = new TerrainSystem("anticheat-ceiling");
    const bird = new Bird();
    bird.reset(64, terrain.heightAt(64) + 400);
    let fastest = 0;
    for (let i = 0; i < Math.round(20 / PHYS_DT); i++) {
      bird.step(PHYS_DT, SPEED_OPTS, terrain);
      // A bird that touches down at speed launches off the lip, and the climb
      // is not what this measures. Put it back in the air and keep the max of
      // the dives themselves — which is the fastest a real run ever gets.
      if (bird.grounded) {
        bird.reset(64, terrain.heightAt(64) + 400);
        continue;
      }
      fastest = Math.max(fastest, bird.speed());
    }
    terrain.dispose();

    // The cap is applied to total speed, so this is the number the gate must
    // clear. Allow a hair of float slack, nothing more.
    expect(fastest).toBeLessThanOrEqual(ANTICHEAT_MAX_SPEED_MPS + 0.001);
    // And it must not be a ceiling so generous that it stops being a gate:
    // a real max dive has to actually approach it, or the constant has drifted
    // loose and would wave through anything.
    expect(fastest).toBeGreaterThan(ANTICHEAT_MAX_SPEED_MPS * 0.9);
  });

  it("the ceiling counts every term the cap expression has", () => {
    // The failure this guards is arithmetic drift between two files that each
    // believe they know the maximum. `Bird.step` clamps to
    //   feverCap * speedMult + boost + speedBonus
    // and the gate has to clear all three. Dropping the speedBonus term put
    // the gate 18 m/s under real flight; a future edit that adds a fifth term
    // to the cap would reintroduce the same quarantine silently, because the
    // probe above only fails once the gap exceeds the bird's real top speed.
    // Asserting the shape of the expression makes the coupling explicit.
    const src = readFileSync(join(process.cwd(), "src/game/AntiCheat.ts"), "utf8");
    const expr = src.match(/const MAX_SPEED_MPS =([\s\S]*?);/);
    expect(expr).not.toBeNull();
    const body = expr![1]!;
    for (const [term, what] of [
      ["MAX_SPEED_FEVER", "the fever cap"],
      ["MAX_SKIN_SPEED_MULT", "the skin multiplier"],
      ["ENDLESS_SPEED_SCALE_MAX", "the escalation multiplier"],
      ["BOOST_EXTRA_SPEED", "the boost term"],
      ["MAX_MODE_SPEED_BONUS", "the mode-surge term"],
    ] as const) {
      expect(body, `ceiling is missing ${what}`).toContain(term);
    }
  });

  it("no mode surge can grant more headroom than the ceiling allows for", () => {
    // `Game.ts` owns the four per-mode surge values and is the only place they
    // are written. `modeSpeedBonus` takes a max rather than a sum, so the
    // largest of the four is the most the cap can ever rise by. If someone
    // tunes a surge up, the gate has to move with it on the same change.
    const gameSrc = readFileSync(join(process.cwd(), "src/game/Game.ts"), "utf8");
    const surges = [...gameSrc.matchAll(/^const (\w*BONUS) = (\d+);$/gm)].map((m) => ({
      name: m[1]!,
      value: Number(m[2]),
    }));
    expect(surges.length).toBeGreaterThan(0);
    for (const s of surges) {
      expect(s.value, `${s.name} exceeds MAX_MODE_SPEED_BONUS — the anti-cheat ceiling would no longer clear it`).toBeLessThanOrEqual(
        MAX_MODE_SPEED_BONUS,
      );
    }
  });

  it("every shipped skin fits under the skin speed ceiling the gate assumes", () => {
    // MAX_SKIN_SPEED_MULT multiplies the anti-cheat ceiling. A skin above it
    // would be legal to fly and illegal to submit, so content is held to the
    // same bound rather than the constant being trusted.
    for (const skin of SKINS) {
      expect(skin.speedMult, `${skin.id} exceeds MAX_SKIN_SPEED_MULT`).toBeLessThanOrEqual(MAX_SKIN_SPEED_MULT);
    }
  });
});
