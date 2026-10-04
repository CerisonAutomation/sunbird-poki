// SCRATCH — LAUNCH_POP_DRIVE sweep. Deleted before hand-off.
import { describe, it } from "vitest";
import { Bird } from "../Bird";
import { TerrainSystem } from "../TerrainSystem";
import { PHYS_DT, applyLiveTune, LIVE_TUNE_DEFAULTS, type LiveTunable } from "../constants";

type Policy = (bird: Bird, terrain: TerrainSystem, t: number) => boolean;
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
function resetAll(): void {
  for (const k of Object.keys(LIVE_TUNE_DEFAULTS) as LiveTunable[]) applyLiveTune(k, LIVE_TUNE_DEFAULTS[k]);
}

const SC_SEEDS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
function scDistance(policy: Policy, seed: string, seconds = 60): number {
  const terrain = new TerrainSystem(seed);
  const bird = new Bird();
  bird.x = 50; bird.y = terrain.heightAt(50) + 2; bird.vx = 40; bird.vy = 0; bird.grounded = true;
  for (let t = 0; t < seconds; t += 1 / 120) {
    bird.step(1 / 120, { diving: policy(bird, terrain, t), fever: false, speedMult: 1, boost: false }, terrain);
  }
  const d = bird.x;
  bird.dispose(); terrain.dispose();
  return d;
}
const SC_HOLD: Policy = () => true;
const SC_COAST: Policy = () => false;
const SC_MASHER: Policy = (_b, _t, time) => Math.floor(time * 8) % 2 === 0;
const SC_EXPERT: Policy = (bird, terrain) => {
  if (bird.grounded) return terrain.slopeAt(bird.x) <= 0.02;
  return bird.vy < -1;
};

const HELDOUT = [
  "held-a01", "held-a02", "held-a03", "held-a04", "held-a05", "held-a06",
  "held-a07", "held-a08", "held-a09", "held-a10", "held-a11", "held-a12",
  "held-a13", "held-a14", "held-a15", "held-a16", "held-a17", "held-a18",
  "held-a19", "held-a20", "held-a21", "held-a22", "held-a23", "held-a24",
  "held-a25", "held-a26", "held-a27", "held-a28", "held-a29", "held-a30",
  "held-a31", "held-a32", "held-a33", "held-a34", "held-a35", "held-a36",
  "held-a37", "held-a38", "held-a39", "held-a40",
];
const FRESH = Array.from({ length: 40 }, (_, i) => `fresh-${String(i + 1).padStart(2, "0")}`);
const GATE = ["2026-09-16", "2026-09-17", "2026-09-18"];
const GAP_HOLD: Policy = () => true;
const GAP_EXPERT: Policy = (b, tr) => tr.slopeAt(b.x) < 0;

function gapRun(seed: string, policy: Policy, seconds: number) {
  const terrain = new TerrainSystem(seed);
  const bird = new Bird();
  bird.reset(64, terrain.heightAt(64) + 0.9);
  const steps = Math.round(seconds / PHYS_DT);
  let maxAlt = 0, spd = 0;
  for (let i = 0; i < steps; i++) {
    bird.step(PHYS_DT, { diving: policy(bird, terrain, (i + 1) * PHYS_DT), fever: false, speedMult: 1, boost: false }, terrain);
    if (bird.altitude > maxAlt) maxAlt = bird.altitude;
    spd += bird.speed();
  }
  const r = { x: bird.x, maxAlt, spd: spd / steps };
  terrain.dispose();
  return r;
}

describe("LAUNCH_POP_DRIVE sweep", () => {
  it("sweeps drive share against every gate", () => {
    console.log("\n### LAUNCH_POP_DRIVE — drive share, all gates");
    for (const v of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.65, 0.8, 0.9, 1.0]) {
      applyLiveTune("LAUNCH_POP_DRIVE", v);
      const scExp = SC_SEEDS.map((s) => scDistance(SC_EXPERT, s));
      const scMas = SC_SEEDS.map((s) => scDistance(SC_MASHER, s));
      const scHold = SC_SEEDS.map((s) => scDistance(SC_HOLD, s));
      const scCoas = SC_SEEDS.map((s) => scDistance(SC_COAST, s));
      const scRatio = scExp.map((d, i) => d / scMas[i]!);
      const hc = mean(scHold) / mean(scCoas);
      const rows: string[] = [];
      for (const [label, seeds] of [["HELD", HELDOUT], ["FRESH", FRESH], ["GATE3", GATE]] as const) {
        const eR = seeds.map((s) => gapRun(s, GAP_EXPERT, 60));
        const mR = seeds.map((s) => gapRun(s, GAP_HOLD, 60));
        const e = eR.map((x) => x.x);
        const m = mR.map((x) => x.x);
        const per = e.map((d, i) => d / m[i]!);
        rows.push(`${label} r=${(mean(e) / mean(m)).toFixed(4)} worst=${Math.min(...per).toFixed(4)} alt=${mean(e.map((x) => x.maxAlt)).toFixed(0)}`);
      }
      const allPass = hc > 1.3 && mean(scRatio) > 1.6 && Math.min(...scRatio) > 1.3
        && scExp.every((d, i) => d > scHold[i]!) && Math.min(...scHold) > 1200;
      console.log(
        `  drive=${String(v).padEnd(5)} ${allPass ? "PASS" : "FAIL"}` +
        ` hold/coast=${hc.toFixed(4)}${hc > 1.3 ? "" : " !!"}` +
        ` holdSum=${mean(scHold).toFixed(1)} coastSum=${mean(scCoas).toFixed(1)}` +
        ` scMin=${Math.min(...scRatio).toFixed(3)}${Math.min(...scRatio) > 1.3 ? "" : " !!"}` +
        ` exp>hold=${scExp.every((d, i) => d > scHold[i]!)} | ${rows.join(" | ")}`,
      );
    }
    resetAll();
  }, 1800000);
});