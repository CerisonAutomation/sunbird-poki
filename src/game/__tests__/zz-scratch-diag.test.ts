// SCRATCH DIAG — is the exchange bounded by physics or by the speed cap?
import { describe, it } from "vitest";
import { Bird } from "../Bird";
import { TerrainSystem } from "../TerrainSystem";
import { PHYS_DT, MAX_SPEED, applyLiveTune, LIVE_TUNE_DEFAULTS, type LiveTunable } from "../constants";
import { GLIDE_EXCHANGE_MAX } from "../constants";

type Policy = (bird: Bird, terrain: TerrainSystem, t: number) => boolean;
const MASHER: Policy = () => true;
const EXPERT: Policy = (b, tr) => tr.slopeAt(b.x) < 0;
const TUNING = [
  "2026-09-16", "2026-09-17", "2026-09-18", "2027-01-04", "2027-01-05",
  "2027-01-06", "2027-01-07", "2027-01-08", "2027-02-11", "2027-02-12",
];
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
function resetAll(): void {
  for (const k of Object.keys(LIVE_TUNE_DEFAULTS) as LiveTunable[]) applyLiveTune(k, LIVE_TUNE_DEFAULTS[k]);
}

function diag(seed: string, policy: Policy, v: number) {
  applyLiveTune("GLIDE_EXCHANGE", v);
  const terrain = new TerrainSystem(seed);
  const bird = new Bird();
  bird.reset(64, terrain.heightAt(64) + 0.9);
  const steps = Math.round(60 / PHYS_DT);
  let maxSpd = 0, maxSink = 0, atCap = 0, air = 0;
  let accelSum = 0, accelMax = 0;
  for (let i = 0; i < steps; i++) {
    const diving = policy(bird, terrain, (i + 1) * PHYS_DT);
    const vx0 = bird.vx;
    bird.step(PHYS_DT, { diving, fever: false, speedMult: 1, boost: false }, terrain);
    const sp = bird.speed();
    if (sp > maxSpd) maxSpd = sp;
    if (!bird.grounded) {
      air++;
      if (-bird.vy > maxSink) maxSink = -bird.vy;
      if (sp >= MAX_SPEED - 0.01) atCap++;
      const a = (bird.vx - vx0) / PHYS_DT;
      if (a > 0) { accelSum += a; if (a > accelMax) accelMax = a; }
    }
  }
  terrain.dispose();
  return { maxSpd, maxSink, atCap, air, accelAvg: air ? accelSum / air : 0, accelMax };
}

describe("exchange diagnostics", () => {
  it("bounds check", () => {
    console.log(`\nGLIDE_EXCHANGE_MAX = ${GLIDE_EXCHANGE_MAX}, MAX_SPEED = ${MAX_SPEED}`);
    for (const v of [0, 0.65, 0.8, 1.0, 1.3, 2.0, 3.0]) {
      const d = TUNING.map((s) => diag(s, EXPERT, v));
      const mm = TUNING.map((s) => diag(s, MASHER, v));
      console.log(
        `  k=${String(v).padEnd(5)} expert: maxSpd=${Math.max(...d.map((x) => x.maxSpd)).toFixed(1)}` +
        ` maxSink=${Math.max(...d.map((x) => x.maxSink)).toFixed(1)}` +
        ` stepsAtCap=${d.reduce((a, x) => a + x.atCap, 0)}/${d.reduce((a, x) => a + x.air, 0)}` +
        ` meanFwdAccel=${mean(d.map((x) => x.accelAvg)).toFixed(1)} peakFwdAccel=${Math.max(...d.map((x) => x.accelMax)).toFixed(1)}` +
        ` | masher maxSpd=${Math.max(...mm.map((x) => x.maxSpd)).toFixed(1)}`,
      );
    }
    resetAll();
  }, 600000);
});