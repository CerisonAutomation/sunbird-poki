import { describe, expect, it } from "vitest";
import { Bird } from "../Bird";
import { TerrainSystem } from "../TerrainSystem";

/**
 * THE SKILL CEILING.
 *
 * A one-button game is only a game if the button has a right and a wrong
 * moment. This file measures that, because it was once measurably absent:
 * driving the shipped physics for 60 s with a policy that simply held the
 * button travelled 2.23 km, while a policy that read the terrain and timed
 * its releases travelled 2.16 km. Holding a brick on the button was the
 * optimal strategy for the whole game. Everything downstream — session
 * length, return rate, the leaderboard, the reason to buy a faster skin —
 * rests on that not being true.
 *
 * Three defects caused it, all of them cases where the code did the opposite
 * of what its own comment claimed:
 *
 *   1. `GROUND_STICK_DIVE` was applied as a floor on EVERY slope, so a held
 *      stick accelerated the bird *up* hills (`max(negative, 11)`). Now it
 *      applies only below `GROUND_STICK_FLAT_SLOPE`, the dead-flat ground it
 *      was written for.
 *   2. Landing while holding raised the speed-retention floor to 0.86,
 *      making a held stick immune to bad landings and deleting the alignment
 *      skill. Now a tuck is a bonus (`LAND_TUCK_BONUS`), not a floor.
 *   3. Nothing anywhere rewarded releasing. Now a release timed to a crest
 *      converts speed into height (`LAUNCH_POP_WINDOW`) — the gesture
 *      FirstFlight was already coaching and the physics was ignoring.
 *
 * The measurement below is deliberately crude and deliberately permanent: it
 * is a fitness comparison between fixed policies, so it cannot be satisfied
 * by tuning a number in isolation, and it will fail again the moment a
 * "quality of life" change reintroduces a free ride. The scripted expert is
 * far from optimal, so the real ceiling is above what this reports — that is
 * fine, this is a floor on the ceiling.
 */

type Policy = (bird: Bird, terrain: TerrainSystem, time: number) => boolean;

const SEEDS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

/** Distance flown in `seconds` of simulated time under a fixed policy. */
function distance(policy: Policy, seed: string, seconds = 60): number {
  const terrain = new TerrainSystem(seed);
  const bird = new Bird();
  bird.x = 50;
  bird.y = terrain.heightAt(50) + 2;
  bird.vx = 40;
  bird.vy = 0;
  bird.grounded = true;
  const dt = 1 / 120;
  for (let t = 0; t < seconds; t += dt) {
    bird.step(dt, { diving: policy(bird, terrain, t), fever: false, speedMult: 1, boost: false }, terrain);
  }
  const travelled = bird.x;
  bird.dispose();
  terrain.dispose();
  return travelled;
}

/** Holds the button for the entire run. The strategy that used to win. */
const hold: Policy = () => true;
/** Never touches the button. The true floor of the game. */
const coast: Policy = () => false;
/** Mashes at 8 Hz with no regard for the terrain. */
const masher: Policy = (_bird, _terrain, time) => Math.floor(time * 8) % 2 === 0;
/**
 * Reads the terrain: carve the downslopes and the flats, coast the climbs,
 * dive when falling in the air so the next touchdown is tangential, and let
 * go on the way up so the crest pop fires.
 */
const expert: Policy = (bird, terrain) => {
  if (bird.grounded) return terrain.slopeAt(bird.x) <= 0.02;
  return bird.vy < -1;
};

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

describe("skill ceiling", () => {
  const byPolicy = (policy: Policy): number[] => SEEDS.map((seed) => distance(policy, seed));

  it("playing well beats holding the button by a wide margin", () => {
    const expertRuns = byPolicy(expert);
    const mashRuns = byPolicy(masher);
    const ratios = expertRuns.map((d, i) => d / mashRuns[i]!);

    // Measured 1.73x mean / 1.47x worst seed after the fix; 1.06x before it.
    // Note this is the FLOOR of the real ceiling twice over: the harness
    // drives `Bird` directly, so it earns none of `LaunchSystem`'s rating
    // boosts (up to 1.145x plus a combo), and the scripted expert is nowhere
    // near an optimal line.
    // The bar is set below the measurement, not at it, so ordinary tuning has
    // room and a regression to "the button does not matter" still fails.
    expect(mean(ratios)).toBeGreaterThan(1.6);
    expect(Math.min(...ratios)).toBeGreaterThan(1.3);
  });

  it("holding the button is no longer the optimal strategy", () => {
    // The defect, stated as a property. Every seed, not on average.
    const holdRuns = byPolicy(hold);
    const expertRuns = byPolicy(expert);
    for (let i = 0; i < SEEDS.length; i += 1) {
      expect(expertRuns[i]!, `seed ${SEEDS[i]}: holding beat playing`).toBeGreaterThan(holdRuns[i]!);
    }
  });

  it("stays playable for someone who only ever holds", () => {
    // The other half of the design: raising the ceiling must not raise the
    // floor. A player who does nothing but hold still flies a real distance
    // and still clearly beats doing nothing at all, so the first run is never
    // a wall.
    const holdRuns = byPolicy(hold);
    const coastRuns = byPolicy(coast);
    expect(Math.min(...holdRuns)).toBeGreaterThan(1200);
    expect(mean(holdRuns)).toBeGreaterThan(mean(coastRuns) * 1.3);
  });

  it("a perfectly timed release pops harder than a late one", () => {
    // The pop, isolated from terrain luck: same crest, same approach speed,
    // only the release timing differs. This is the skill the ceiling is made
    // of, so it is pinned directly rather than only through the fitness runs.
    const seed = "pop-timing";

    /** When the bird first leaves the ground if the stick is simply held. */
    const launchTime = (): number => {
      const terrain = new TerrainSystem(seed);
      const bird = new Bird();
      bird.x = 50;
      bird.y = terrain.heightAt(50) + 2;
      bird.vx = 60;
      bird.grounded = true;
      const dt = 1 / 120;
      for (let t = 0; t < 30; t += dt) {
        bird.step(dt, { diving: true, fever: false, speedMult: 1, boost: false }, terrain);
        if (bird.justLaunched) {
          bird.dispose();
          terrain.dispose();
          return t;
        }
      }
      bird.dispose();
      terrain.dispose();
      return Number.NaN;
    };

    /** Peak height above ground of the arc, releasing `lead` s before the lip. */
    const apexFor = (lead: number, lip: number): number => {
      const terrain = new TerrainSystem(seed);
      const bird = new Bird();
      bird.x = 50;
      bird.y = terrain.heightAt(50) + 2;
      bird.vx = 60;
      bird.grounded = true;
      const dt = 1 / 120;
      let best = 0;
      let airborne = false;
      for (let t = 0; t < 30; t += dt) {
        bird.step(dt, { diving: t < lip - lead, fever: false, speedMult: 1, boost: false }, terrain);
        if (bird.justLaunched) airborne = true;
        if (airborne && !bird.grounded) best = Math.max(best, bird.y - terrain.heightAt(bird.x));
        if (airborne && bird.grounded) break;
      }
      bird.dispose();
      terrain.dispose();
      return best;
    };

    const lip = launchTime();
    expect(Number.isFinite(lip), "the probe terrain never launched the bird").toBe(true);

    const onTime = apexFor(0.05, lip);
    const early = apexFor(2.5, lip);
    // Letting go a moment before the lip gets meaningfully more air than
    // letting go so early the window has expired.
    expect(onTime).toBeGreaterThan(early);
  });
});
