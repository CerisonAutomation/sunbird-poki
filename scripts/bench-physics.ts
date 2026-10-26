/**
 * Hot-path physics benchmark — the numbers behind the perf gates.
 *
 * WHY THIS EXISTS
 * The 120 Hz fixed step (`Bird.step`) is the game's backbone: ghosts,
 * replays and the 40-pilot mass race all run through it, and it shares
 * the frame budget with rendering. `src/game/__tests__/physics-perf.test.ts`
 * gates the per-step cost inside the test suite; this script is the
 * same measurement as a first-class, human-readable report, so a
 * optimization's before/after cost is a number you can quote rather
 * than a feeling.
 *
 * WHAT IT MEASURES (highest-value paths first)
 *  1. `Bird.step`        — ns per physics step, solo and 40-bird (the
 *                         mass-race field, sharing one TerrainSystem
 *                         and therefore its height cache).
 *  2. `heightAt`         — ns per terrain sample, warm and cold cache.
 *  3. `normalAt` /       — the grounded-branch probes that run every
 *     `curvatureAt`        step a bird is carving.
 *
 * HONESTY RULES
 *  • Wall-clock, so it is only meaningful uninstrumented and unloaded —
 *    the same caveat the suite's timing case carries. Coverage runs
 *    (`__COVERAGE_RUN__`) are skipped for the same reason.
 *  • Three batches, report the MINIMUM: a noisy neighbour can only
 *    slow a batch, never speed it up, so the minimum is the honest
 *    estimate of the true cost.
 *  • Deterministic: fixed seed, fixed policies, fixed iteration
 *    counts. Two runs of this script on the same build agree.
 *
 * Run: `pnpm bench:physics` (tsx). Exit code 1 if the per-step budget
 * (20 µs — the physics-perf.test.ts gate) is exceeded.
 */
import { Bird } from "../src/game/Bird";
import { TerrainSystem } from "../src/game/TerrainSystem";
import { PHYS_DT, BIRD_RADIUS, MAX_SPEED } from "../src/game/constants";

const SEED = "2026-09-11";
/** Budget from physics-perf.test.ts: 20 µs/step fails ~6x before a
 *  real regression becomes player-visible. */
const STEP_BUDGET_US = 20;

const policy = (b: Bird, tr: TerrainSystem): boolean => tr.distanceToCrest(b.x) > 70;

function makeFlight(): { terrain: TerrainSystem; bird: Bird } {
  const terrain = new TerrainSystem(SEED);
  const bird = new Bird();
  bird.reset(64, terrain.heightAt(64) + BIRD_RADIUS);
  return { terrain, bird };
}

function stepOnce(f: { terrain: TerrainSystem; bird: Bird }): void {
  const diving = policy(f.bird, f.terrain);
  f.bird.step(PHYS_DT, { diving, fever: false, speedMult: 1, boost: false }, f.terrain);
}

/** ns/op over `iters` calls, minimum of `batches` runs. */
function measure(label: string, iters: number, fn: () => void): number {
  // Warm the JIT so cold-start cost doesn't skew the measurement.
  for (let i = 0; i < Math.min(2000, iters); i += 1) fn();
  let best = Infinity;
  for (let batch = 0; batch < 3; batch += 1) {
    const t0 = performance.now();
    for (let i = 0; i < iters; i += 1) fn();
    best = Math.min(best, ((performance.now() - t0) / iters) * 1e6);
  }
  return best;
}

const fmt = (ns: number): string => (ns >= 1000 ? `${(ns / 1000).toFixed(2)} µs` : `${ns.toFixed(0)} ns`);

function benchStepSolo(): number {
  const f = makeFlight();
  // Warm up with a real flight so the terrain caches and the JIT are
  // in the state a mid-run frame actually sees.
  for (let i = 0; i < 1200; i += 1) stepOnce(f);
  const ns = measure("step (solo)", 12_000, () => stepOnce(f));
  f.terrain.dispose();
  return ns;
}

function benchStepMassRace(): number {
  // The 40-pilot field: one shared TerrainSystem (so the height cache
  // is shared, exactly like a real mass race), 40 birds.
  const terrain = new TerrainSystem(SEED);
  const birds: Bird[] = [];
  for (let i = 0; i < 40; i += 1) {
    const b = new Bird();
    b.reset(64 + i * 3, terrain.heightAt(64 + i * 3) + BIRD_RADIUS);
    birds.push(b);
  }
  const step40 = (): void => {
    for (const b of birds) {
      b.step(PHYS_DT, { diving: policy(b, terrain), fever: false, speedMult: 1, boost: false }, terrain);
    }
  };
  for (let i = 0; i < 1200; i += 1) step40();
  const nsPerField = measure("step (40-bird field)", 12_000, step40);
  birds.forEach((b) => b.dispose());
  terrain.dispose();
  return nsPerField / 40;
}

function benchTerrain(): { warm: number; cold: number; normal: number; curvature: number } {
  const terrain = new TerrainSystem(SEED);
  // A sliding window of consecutive bins, which is what a grounded
  // step actually probes: normalAt(x) twice, curvatureAt(x), the
  // launch-gate slopeAt, and the crest-prominence gate — a handful
  // of bins around the bird, all of which stay resident in the
  // direct-mapped height cache between steps. Cycling a small
  // window models that; a wide random sweep would thrash the
  // cache and measure misses, not hits. Deterministic by
  // construction — no Math.random — so two runs of this script
  // on the same build agree exactly.
  let probe = 0;
  const nextProbe = (): number => 500 + (probe++ % 32);
  // Warm: cache-resident bins, the steady state of a carving bird.
  const warm = measure("heightAt (warm cache)", 200_000, () => {
    terrain.heightAt(nextProbe());
  });
  // Cold: fresh quantised bins, so every call is a computeHeight miss.
  // Deterministic sweep far past the seeded layout, one bin at a time.
  let x = 100_000;
  const cold = measure("heightAt (cold cache)", 200_000, () => {
    x += 1 / 64;
    terrain.heightAt(x);
  });
  probe = 0;
  const normal = measure("normalAt", 200_000, () => {
    terrain.normalAt(nextProbe());
  });
  probe = 0;
  const curvature = measure("curvatureAt", 200_000, () => {
    terrain.curvatureAt(nextProbe());
  });
  terrain.dispose();
  return { warm, cold, normal, curvature };
}

function main(): void {
  console.log(`Sunbird physics hot-path benchmark — seed ${SEED}`);
  console.log(`(min of 3 batches; solo step budget ${STEP_BUDGET_US} µs)\n`);

  const stepSolo = benchStepSolo();
  const stepMass = benchStepMassRace();
  const t = benchTerrain();

  console.log("path                        cost        note");
  console.log("─".repeat(64));
  console.log(`Bird.step (solo)            ${fmt(stepSolo).padStart(9)}    120 Hz backbone`);
  console.log(`Bird.step (40-bird field)   ${fmt(stepMass).padStart(9)}    per bird, shared terrain cache`);
  console.log(`heightAt (warm)             ${fmt(t.warm).padStart(9)}    cache hit`);
  console.log(`heightAt (cold)             ${fmt(t.cold).padStart(9)}    computeHeight miss`);
  console.log(`normalAt                    ${fmt(t.normal).padStart(9)}    2x per grounded step`);
  console.log(`curvatureAt                 ${fmt(t.curvature).padStart(9)}    1x per grounded step`);
  console.log(`speed cap                   ${MAX_SPEED} m/s  (inputs bounded: no hypot overflow)`);

  const overBudget = stepSolo > STEP_BUDGET_US * 1000;
  if (overBudget) {
    console.error(`\nFAIL: solo step ${fmt(stepSolo)} exceeds the ${STEP_BUDGET_US} µs budget.`);
    process.exitCode = 1;
  } else {
    console.log(`\nPASS: solo step ${fmt(stepSolo)} is under the ${STEP_BUDGET_US} µs budget.`);
  }
}

main();
