import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BIOMES, biomeForIsland, islandIndexFor, islandStartFor, islandTemplate, localXFor } from "../Biomes";
import { CLIMB_STEP_THRESHOLD, biomeClimb, biomeDifficulty, flightProgression } from "../FlightProgression";
import { FRENZY_AT, FLAIR_MAX, chainBonus, chainLabel, chainPulse, chainScale, chainTier, isFrenzyMoment } from "../ChainFlair";
import { TerrainSystem } from "../TerrainSystem";
import { Bird } from "../Bird";
import { PHYS_DT, RENDER_RECENTER_THRESHOLD } from "../constants";

/**
 * The three things this pass added: worlds that are shaped rather than stamped,
 * compensation for the two biomes that are a wall rather than a slope, and a
 * chain that escalates loudly.
 *
 * Each is pinned here because all three fail SILENTLY otherwise. A layout bug
 * shows up as a bird that quietly cannot clear a gap; a climb measure that
 * stops flagging a wall shows up as a difficulty spike nobody can reproduce; a
 * flair ladder that never escalates shows up as a reward nobody notices.
 */
describe("the island layout: islands are shaped, not stamped", () => {
  it("gives every biome its own island length", () => {
    const scales = BIOMES.map((b) => b.terrain.islandScale);
    // Nine biomes and one length would be a stamp. The spread is the point.
    expect(new Set(scales).size, "every island is the same length again").toBeGreaterThan(5);
    for (const scale of scales) {
      expect(scale, "a zero or negative island length").toBeGreaterThan(0.5);
      expect(scale).toBeLessThan(1.5);
    }
  });

  it("keeps every landmark inside its own island", () => {
    // The failure this guards is the one the island-lengthening pass nearly
    // shipped: a longer period with unmoved landmarks, so the extra length is
    // an empty shoulder instead of more island.
    for (let island = 0; island < 40; island += 1) {
      const t = islandTemplate(island);
      const label = `island ${island} (${biomeForIsland(island).id})`;
      expect(t.dropBlendStart, label).toBeLessThan(t.dropStart);
      expect(t.dropStart, label).toBeLessThan(t.rampStart);
      expect(t.rampStart, label).toBeLessThan(t.gapStart);
      expect(t.gapStart, label).toBeLessThan(t.gapEnd);
      // A landing shelf, always: a gap that wraps past the island is unwinnable.
      expect(t.period - t.gapEnd, `${label} has no landing shelf`).toBeGreaterThan(8);
    }
  });

  it("resolves a world-x back to the island it belongs to", () => {
    for (let island = 0; island < 40; island += 1) {
      const t = islandTemplate(island);
      for (const offset of [0, 1, t.dropStart, t.gapStart + 10, t.period - 1]) {
        const x = t.start + Math.min(offset, t.period - 1);
        expect(islandIndexFor(x), `x=${Math.round(x)} landed on the wrong island`).toBe(island);
        expect(localXFor(x)).toBeGreaterThanOrEqual(0);
        expect(localXFor(x)).toBeLessThanOrEqual(t.period);
      }
    }
  });

  it("lays islands end to end, with no gap or overlap between them", () => {
    for (let island = 0; island < 40; island += 1) {
      const here = islandTemplate(island);
      const next = islandTemplate(island + 1);
      expect(next.start, `island ${island + 1} does not begin where ${island} ends`).toBeCloseTo(
        here.start + here.period,
        6,
      );
      expect(islandStartFor(island)).toBe(here.start);
    }
  });

  it("keeps answering past the end of the table — the world is infinite", () => {
    // A run that reaches island 2100 must still have ground under it, so this
    // cannot be a bounded lookup.
    const deep = islandStartFor(3000);
    expect(Number.isFinite(deep)).toBe(true);
    expect(deep).toBeGreaterThan(islandStartFor(100));
    expect(islandIndexFor(deep + 500)).toBeGreaterThan(2900);
  });

  it("wraps negative x to the end of the first island, not off the world", () => {
    // The menu's attract camera and the floating origin both sit behind the
    // start line at times, and a negative local-x reads as "no terrain here".
    expect(localXFor(-1)).toBe(islandTemplate(0).period - 1);
    expect(localXFor(-10)).toBeGreaterThan(0);
  });

  it("still launches and clears the gap on every biome", () => {
    // The regression that mattered: a longer island has a wider gap, and a
    // launch height that did not scale with it left the bird falling into the
    // sea on the long biomes. It is silent in play and loud here.
    for (const biome of BIOMES) {
      const island = BIOMES.indexOf(biome);
      const terrain = new TerrainSystem("gap-crossing");
      const tpl = islandTemplate(island);
      const bird = new Bird();
      bird.reset(tpl.start + tpl.dropStart + 2, terrain.heightAt(tpl.start + tpl.dropStart + 2) + 0.9);
      bird.grounded = true;
      bird.vx = 24;
      let launched = false;
      let splashed = false;
      for (let tick = 0; tick < 20 / PHYS_DT && bird.x < tpl.start + tpl.period; tick++) {
        bird.step(PHYS_DT, { diving: terrain.localX(bird.x) < tpl.rampStart, fever: false, speedMult: 1, boost: false }, terrain);
        launched ||= bird.justLaunched;
        splashed ||= bird.inWater;
      }
      expect(launched, `${biome.id} (${Math.round(tpl.period)} m) never launched`).toBe(true);
      expect(splashed, `${biome.id} (${Math.round(tpl.period)} m) fell in the water`).toBe(false);
      bird.dispose();
      terrain.dispose();
    }
  });
});

describe("the climb: two biomes are a wall, and the game says so", () => {
  it("scores a biome from the fields the flight actually uses", () => {
    for (const biome of BIOMES) {
      const score = biomeDifficulty(BIOMES.indexOf(biome));
      expect(Number.isFinite(score)).toBe(true);
      expect(score).toBeGreaterThan(0);
    }
    // A later biome is not automatically harder — measured, not assumed.
    expect(biomeDifficulty(8)).toBeGreaterThan(biomeDifficulty(0));
  });

  it("flags the two real walls and leaves the ordinary slopes alone", () => {
    const steps = BIOMES.map((_, i) => biomeClimb(i));
    const walls = steps.filter((c) => c.large).map((c) => steps.indexOf(c));
    // Measured, so re-tuning a biome moves the wall with it. At the shipped
    // numbers the walls are Midnight Coast (gust→storm, 4.4× the roughness,
    // 31% shorter arches) and Cinder Forge (the game's roughest surface).
    expect(walls).toEqual([5, 7]);
    for (const step of steps) {
      if (step.large) {
        expect(step.step, "a wall below the threshold is not a wall").toBeGreaterThanOrEqual(CLIMB_STEP_THRESHOLD);
        expect(step.relief).toBeGreaterThan(0);
        expect(step.relief).toBeLessThanOrEqual(1);
      } else {
        expect(step.step, "a slope above the threshold is a wall").toBeLessThan(CLIMB_STEP_THRESHOLD);
        expect(step.relief).toBe(0);
      }
    }
  });

  it("pays more relief for a steeper wall", () => {
    expect(biomeClimb(7).relief).toBeGreaterThan(biomeClimb(5).relief);
  });

  it("never calls the first island a climb", () => {
    expect(biomeClimb(0).large).toBe(false);
    expect(biomeClimb(0).relief).toBe(0);
  });

  it("keeps the ordinary per-island ramp smooth — it is not a wall", () => {
    // flightProgression is a gentle saturating curve and has always been; the
    // walls are in the biome table, not here. This pins both halves.
    for (let island = 1; island < 60; island += 1) {
      expect(flightProgression(island).hillScale).toBeGreaterThan(flightProgression(island - 1).hillScale);
      expect(flightProgression(island).hillScale - flightProgression(island - 1).hillScale).toBeLessThan(0.03);
    }
  });
});

describe("the chain: a reward that escalates, or it is not felt", () => {
  it("climbs a ladder of tiers", () => {
    expect(chainTier(0)).toBe("none");
    expect(chainTier(1)).toBe("warm");
    expect(chainTier(2)).toBe("hot");
    expect(chainTier(FRENZY_AT - 1)).toBe("blazing");
    expect(chainTier(FRENZY_AT)).toBe("frenzy");
    expect(chainTier(99)).toBe("frenzy");
  });

  it("grows with the chain, but never by nine times", () => {
    // A readout nine times larger at ×9 than at ×1 covers the screen, and the
    // first few steps are invisible. The curve is deliberately compressive.
    const one = chainScale(1);
    const nine = chainScale(FLAIR_MAX);
    expect(nine).toBeGreaterThan(one);
    expect(nine / one).toBeLessThan(3);
    expect(chainScale(0)).toBe(0);
    expect(chainScale(FLAIR_MAX + 50)).toBe(chainScale(FLAIR_MAX));
  });

  it("pulses faster the longer the chain runs", () => {
    expect(chainPulse(0)).toBe(0);
    expect(chainPulse(1)).toBeGreaterThan(0);
    expect(chainPulse(FRENZY_AT)).toBeGreaterThan(chainPulse(2));
  });

  it("pays more the longer the chain runs, and never runs away", () => {
    expect(chainBonus(1)).toBe(0);
    expect(chainBonus(5)).toBeGreaterThan(chainBonus(2));
    expect(chainBonus(999)).toBeLessThanOrEqual(40);
  });

  it("labels itself, and says FRENZY at the threshold", () => {
    expect(chainLabel(0)).toBe("");
    expect(chainLabel(2)).toBe("CHAIN ×2");
    expect(chainLabel(FRENZY_AT)).toBe("FRENZY ×4");
  });

  it("announces the moment once, not once per step of a long chain", () => {
    expect(isFrenzyMoment(FRENZY_AT, false)).toBe(true);
    expect(isFrenzyMoment(FRENZY_AT, true)).toBe(false);
    expect(isFrenzyMoment(FRENZY_AT + 1, true)).toBe(false);
    expect(isFrenzyMoment(FRENZY_AT - 1, false)).toBe(false);
  });
});

describe("the input has to be worth something", () => {
  /**
   * The load-bearing claim of this pass, measured before the fix: the bird's
   * ONLY grounded acceleration was gravity along the slope, so `88 * slope`.
   * Anything flatter than about 1:10 lost more to friction than the input could
   * win, and 11-20% of every island's run-in sat in that dead zone — where
   * holding did nothing, letting go cost you speed, and the MIN_KEEP_SPEED
   * floor quietly supplied the velocity instead. Flat ground was a conveyor,
   * not a mistake.
   *
   * Launching is suppressed by pinning the bird to the surface each step, so
   * this measures the GROUND model rather than whatever a crest did to it.
   */
  const accelOn = (terrain: TerrainSystem, fromX: number, seconds: number, diving: boolean): number => {
    const bird = new Bird();
    bird.reset(fromX, terrain.heightAt(fromX) + 0.9);
    bird.grounded = true;
    bird.vx = 20;
    const v0 = bird.vx;
    const steps = Math.round(seconds / PHYS_DT);
    for (let i = 0; i < steps; i += 1) {
      bird.grounded = true;
      bird.y = terrain.heightAt(bird.x) + 0.9;
      bird.step(PHYS_DT, { diving, fever: false, speedMult: 1, boost: false }, terrain);
    }
    const a = (bird.vx - v0) / seconds;
    bird.dispose();
    return a;
  };

  it("holding builds speed on flat ground, where releasing coasts down", () => {
    // Find the flattest stretch of the teaching island's run-in.
    const terrain = new TerrainSystem("flat-input");
    const tpl = islandTemplate(0);
    let bestX = 0;
    let bestSlope = Infinity;
    for (let lx = 60; lx < tpl.dropStart - 80; lx += 5) {
      const s = Math.abs(terrain.slopeAt(tpl.start + lx + 40));
      if (s < bestSlope) { bestSlope = s; bestX = lx; }
    }
    expect(bestSlope, "the teaching island has no flat ground left to test").toBeLessThan(0.08);

    const from = tpl.start + bestX;
    const released = accelOn(terrain, from, 0.5, false);
    const held = accelOn(terrain, from, 0.5, true);
    // The whole point: on flat ground, the stick is the only acceleration there is.
    expect(held, "holding the stick does not build speed on flat ground").toBeGreaterThan(2);
    expect(held - released, "the input buys nothing on flat ground").toBeGreaterThan(2);
    terrain.dispose();
  });

  it("does not give the stick a free ride on a climb", () => {
    // The run is built on climbs costing you. The floor is a FLOOR on downhill
    // acceleration; uphill keeps the full slope penalty, or the whole game
    // would stop being about timing a release.
    const terrain = new TerrainSystem("climb-cost");
    const tpl = islandTemplate(0);
    let bestX = 0;
    let bestSlope = -Infinity;
    for (let lx = 60; lx < tpl.dropStart - 80; lx += 5) {
      const s = terrain.slopeAt(tpl.start + lx + 40);
      if (s > bestSlope) { bestSlope = s; bestX = lx; }
    }
    expect(bestSlope, "no uphill found to test").toBeGreaterThan(0.3);

    const from = tpl.start + bestX;
    const released = accelOn(terrain, from, 0.4, false);
    const held = accelOn(terrain, from, 0.4, true);
    // The climb must still COST, and it must cost MORE with the stick held.
    //
    // This assertion used to read `held > released` — "a dive should grip
    // harder than a coast" — and it passed for the wrong reason: the stick
    // floor was applied on every slope, not only on flats, so
    // `Math.max(GROUND_G_DIVE * downhill, GROUND_STICK_DIVE)` on an uphill
    // returned +11 m/s² and a held stick literally accelerated the bird up
    // the hill. The test's own preamble said "uphill keeps the full slope
    // penalty" while the assertion it made pinned the opposite, and the
    // consequence was that holding the button forever was the optimal way to
    // play the entire game (measured: hold 2.23 km vs 2.16 km for a policy
    // that read the terrain over 60 s).
    //
    // The corrected model is the one the rest of the game is written for:
    // GROUND_G_DIVE (88) is six times GROUND_G_GLIDE (14), so diving into a
    // climb scrubs speed hard and coasting up it is cheap. That is what makes
    // "release before the climb, hold into the drop" the right read, and it is
    // what the crest pop (LAUNCH_POP_WINDOW) then pays out on.
    expect(released, "climbing should cost speed").toBeLessThan(0);
    expect(held, "the stick must not make a steep climb free").toBeLessThan(0);
    expect(held, "diving into a climb has to cost more than coasting up it").toBeLessThan(released);
    terrain.dispose();
  });
});

describe("the render origin, which was never wired", () => {
  /**
   * TerrainSystem, CameraRig, Bird and Collectibles each carried a finished
   * `recenter` / `setRenderOrigin` for the whole life of the game with ZERO
   * callers, and all four doc comments pointed at a `RENDER_RECENTER_THRESHOLD`
   * in Game.ts that had never existed. This is the property that was missing:
   * the threshold is a multiple of itself, so a rebase is possible at all, and
   * procedural generation is unaffected by it (shape comes from float64 world x,
   * so a rebased world is byte-identical to an unrebased one).
   */
  it("is a whole number of thresholds, so the flight can actually reach it", () => {
    expect(RENDER_RECENTER_THRESHOLD).toBeGreaterThan(0);
    expect(Number.isInteger(RENDER_RECENTER_THRESHOLD)).toBe(true);
    // Two of the game's long islands' worth — far enough to be rare, near
    // enough that no player meets the float32 artefact.
    expect(RENDER_RECENTER_THRESHOLD).toBeLessThanOrEqual(8192);
  });

  it("does not change the terrain it generates", () => {
    // The whole safety argument for rebasing: a shifted render origin must be
    // invisible to the world, or the same seed would fly differently after a
    // rebase and every shared/race seed would stop being comparable.
    const a = new TerrainSystem("recenter-invariance");
    const b = new TerrainSystem("recenter-invariance");
    b.recenter(8192, 8192);
    for (const x of [100, 1500, 4200, 9000, 13000]) {
      expect(b.heightAt(x), `heightAt(${x}) changed after a rebase`).toBeCloseTo(a.heightAt(x), 9);
      expect(b.islandIndex(x)).toBe(a.islandIndex(x));
    }
    a.dispose();
    b.dispose();
  });

  it("is a no-op when the origin does not move", () => {
    // `recenter` rebuilds every loaded chunk. Called with the origin it already
    // has — which is what a per-frame call would do — it must do nothing.
    const t = new TerrainSystem("recenter-noop");
    const before = t.heightAt(3000);
    t.recenter(0, 3000);
    expect(t.heightAt(3000)).toBe(before);
    t.dispose();
  });
});

describe("the season rollover pays you out instead of taking your pass away", () => {
  /**
   * A month turning over used to wipe xp and every unclaimed tier silently.
   * The obvious fix — push reached-but-unclaimed tiers into `claimedFree` — is
   * a trap: `claim()` returns null for anything in that list BEFORE it calls
   * grant(), so it FORFEITS the reward, and seeding from last month's list
   * blacklists the new season's whole track. This pins the grant, because the
   * failure mode is invisible: the rows look claimed, and nothing arrives.
   */
  it("grants every reached-but-unclaimed free tier, and resets the track", async () => {
    const { SEASON_TIERS, SEASON_XP_PER_TIER } = await import("../constants");
    const { SeasonPass } = await import("../SeasonPass");
    const { SaveData } = await import("../SaveData");
    const { seasonId } = await import("../season");

    const save = new SaveData();
    const reached = 30;
    save.state.season = {
      id: "1999-01",
      xp: reached * SEASON_XP_PER_TIER,
      claimedFree: [1, 2],
      claimedPremium: [],
    };
    const coinsBefore = save.state.wallet;
    // The pass is lazy: the rollover fires on first ACCESS, not in the
    // constructor, so poke it the way the HUD does.
    new SeasonPass(save).xp();

    // Tier 30 was reached and never claimed, so the Bird of Paradise must have
    // arrived with the rollover.
    expect(save.state.ownedSkins, "the tier-30 prize was forfeited at rollover").toContain("paradise");
    // Tiers 1 and 2 were already claimed last month and must NOT be paid twice.
    expect(save.state.season.claimedFree, "last month's claims poisoned the new track").toEqual([]);
    expect(save.state.season.id).toBe(seasonId());
    // A fresh track: last month's claimed list did not blacklist this month.
    // (xp resets to 0, so earn tier 1 before claiming it — claiming above
    // your tier is correctly refused.)
    const sp = new SeasonPass(save);
    sp.addXp(SEASON_XP_PER_TIER);
    expect(sp.claim(1, "free"), "tier 1 is permanently locked by last month").toBeTruthy();
    expect(save.state.wallet).toBeGreaterThan(coinsBefore);
    expect(SEASON_TIERS).toBeGreaterThan(reached);
  });
});

describe("the clock does not start before the player is ready", () => {
  /**
   * The day is 52 seconds of real time and it used to begin on the very first
   * physics step — so a first-time player watched it tick down while still
   * reading Distance / daylight / Coins and the coach line. Versus and networked
   * starts bring their own countdown, so the guard is solo-only.
   */
  it("arms a GO countdown for a solo run, and only a solo one", async () => {
    const { SOLO_START_COUNTDOWN } = await import("../constants");
    expect(SOLO_START_COUNTDOWN).toBeGreaterThan(1);
    expect(SOLO_START_COUNTDOWN).toBeLessThanOrEqual(5);

    const game = readFileSync(join(process.cwd(), "src", "game", "Game.ts"), "utf8");
    // The freeze is what makes the countdown worth anything: the existing
    // countdown branch breaks BEFORE the accumulator advances, so nothing steps
    // and nothing drains while it runs.
    const countdownBranch = game.indexOf("if (this.countdown > 0) {");
    const accLine = game.indexOf("this.acc += simDt;", countdownBranch);
    expect(accLine, "the sim must not run during the countdown").toBeGreaterThan(countdownBranch);
    expect(game.slice(countdownBranch, accLine)).toContain("break;");

    // Armed only when nothing else is already counting.
    expect(game).toContain("this.countdown = SOLO_START_COUNTDOWN;");
    const arm = game.slice(
      game.indexOf("this.countdown = SOLO_START_COUNTDOWN;") - 200,
      game.indexOf("this.countdown = SOLO_START_COUNTDOWN;"),
    );
    expect(arm).toContain("!this.versus");
    expect(arm).toContain("this.roomCode === \"\"");
  });
});
