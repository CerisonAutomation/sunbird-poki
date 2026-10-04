// SCRATCH CONFIRM — fresh seed set never used for tuning OR finalist selection.
import { describe, it } from "vitest";
import { Bird } from "../Bird";
import { TerrainSystem } from "../TerrainSystem";
import { PHYS_DT, applyLiveTune, LIVE_TUNE_DEFAULTS, type LiveTunable } from "../constants";

type Policy = (bird: Bird, terrain: TerrainSystem, t: number) => boolean;
const MASHER: Policy = () => true;
const EXPERT: Policy = (b, tr) => tr.slopeAt(b.x) < 0;
const COAST: Policy = () => false;

// FRESH: used for exactly one confirmation pass, after the value was chosen.
const FRESH = Array.from({ length: 40 }, (_, i) => `fresh-${String(i + 1).padStart(2, "0")}`);

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
function resetAll(): void {
  for (const k of Object.keys(LIVE_TUNE_DEFAULTS) as LiveTunable[]) applyLiveTune(k, LIVE_TUNE_DEFAULTS[k]);
}

function run(seed: string, policy: Policy, seconds: number) {
  const terrain = new TerrainSystem(seed);
  const bird = new Bird();
  bird.reset(64, terrain.heightAt(64) + 0.9);
  const steps = Math.round(seconds / PHYS_DT);
  let spd = 0, air = 0;
  for (let i = 0; i < steps; i++) {
    bird.step(PHYS_DT, { diving: policy(bird, terrain, (i + 1) * PHYS_DT), fever: false, speedMult: 1, boost: false }, terrain);
    if (!bird.grounded) air++;
    spd += bird.speed();
  }
  const r = { x: bird.x, spd: spd / steps, air: air / steps };
  terrain.dispose();
  return r;
}

describe("fresh-seed confirmation", () => {
  it("confirms the chosen value on 40 unused seeds", () => {
    console.log("\n### FRESH n=40 (used once, after selection)");
    for (const v of [0, 0.65, 0.8, 1.0, 1.3]) {
      applyLiveTune("GLIDE_EXCHANGE", v);
      const e: number[] = [], m: number[] = [], c: number[] = [];
      let eSpd = 0, mSpd = 0;
      for (const s of FRESH) {
        const er = run(s, EXPERT, 60), mr = run(s, MASHER, 60), cr = run(s, COAST, 60);
        e.push(er.x); m.push(mr.x); c.push(cr.x);
        eSpd += er.spd; mSpd += mr.spd;
      }
      const per = e.map((x, i) => x / m[i]);
      const worst = Math.min(...per);
      console.log(
        `  k=${String(v).padEnd(5)} ratio=${(mean(e) / mean(m)).toFixed(4)} worst=${worst.toFixed(4)} (${FRESH[per.indexOf(worst)]})` +
        ` minPerSeed=${Math.min(...per).toFixed(4)} | e=${mean(e).toFixed(0)}m spd=${(eSpd / FRESH.length).toFixed(1)}` +
        ` m=${mean(m).toFixed(0)}m spd=${(mSpd / FRESH.length).toFixed(1)}` +
        ` coast=${mean(c).toFixed(0)}m hold/coast=${(mean(m) / mean(c)).toFixed(3)}`,
      );
    }
    resetAll();
  }, 900000);
});