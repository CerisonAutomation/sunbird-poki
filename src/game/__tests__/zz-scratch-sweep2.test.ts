// SCRATCH SWEEP 2 — glide exchange. Deleted before hand-off.
import { describe, it } from "vitest";
import { Bird } from "../Bird";
import { TerrainSystem } from "../TerrainSystem";
import { PHYS_DT, applyLiveTune, LIVE_TUNE_DEFAULTS, type LiveTunable } from "../constants";

type Policy = (bird: Bird, terrain: TerrainSystem, t: number) => boolean;

function run(seed: string, policy: Policy, seconds: number) {
  const terrain = new TerrainSystem(seed);
  const bird = new Bird();
  bird.reset(64, terrain.heightAt(64) + 0.9);
  const steps = Math.round(seconds / PHYS_DT);
  let air = 0, alt = 0, spd = 0, maxAlt = 0;
  for (let i = 0; i < steps; i++) {
    bird.step(PHYS_DT, { diving: policy(bird, terrain, (i + 1) * PHYS_DT), fever: false, speedMult: 1, boost: false }, terrain);
    if (!bird.grounded) air++;
    alt += bird.altitude;
    if (bird.altitude > maxAlt) maxAlt = bird.altitude;
    spd += bird.speed();
  }
  const r = { x: bird.x, air: air / steps, alt: alt / steps, spd: spd / steps, maxAlt };
  terrain.dispose();
  return r;
}

const MASHER: Policy = () => true;
const EXPERT: Policy = (b, tr) => tr.slopeAt(b.x) < 0;

const GATE = ["2026-09-16", "2026-09-17", "2026-09-18"];
const TUNING = [
  "2026-09-16", "2026-09-17", "2026-09-18",
  "2027-01-04", "2027-01-05", "2027-01-06", "2027-01-07", "2027-01-08",
  "2027-02-11", "2027-02-12", "2027-02-13", "2027-02-14", "2027-02-15",
  "2027-03-21", "2027-03-22", "2027-03-23", "2027-03-24", "2027-03-25",
  "2027-04-02", "2027-04-03",
];
const HELDOUT = [
  "held-a01", "held-a02", "held-a03", "held-a04", "held-a05", "held-a06",
  "held-a07", "held-a08", "held-a09", "held-a10", "held-a11", "held-a12",
  "held-a13", "held-a14", "held-a15", "held-a16", "held-a17", "held-a18",
  "held-a19", "held-a20", "held-a21", "held-a22", "held-a23", "held-a24",
  "held-a25", "held-a26", "held-a27", "held-a28", "held-a29", "held-a30",
  "held-a31", "held-a32", "held-a33", "held-a34", "held-a35", "held-a36",
  "held-a37", "held-a38", "held-a39", "held-a40",
];

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

function set(k: LiveTunable, v: number): void { applyLiveTune(k, v); }
function resetAll(): void {
  for (const k of Object.keys(LIVE_TUNE_DEFAULTS) as LiveTunable[]) applyLiveTune(k, LIVE_TUNE_DEFAULTS[k]);
}

function ev(v: number, seeds: string[], seconds = 60) {
  set("GLIDE_EXCHANGE", v);
  const e: number[] = [], m: number[] = [];
  let eAir = 0, eAlt = 0, eSpd = 0, eMax = 0, mSpd = 0;
  for (const s of seeds) {
    const er = run(s, EXPERT, seconds), mr = run(s, MASHER, seconds);
    e.push(er.x); m.push(mr.x);
    eAir += er.air; eAlt += er.alt; eSpd += er.spd; eMax = Math.max(eMax, er.maxAlt); mSpd += mr.spd;
  }
  const per = e.map((x, i) => x / m[i]);
  const n = seeds.length;
  return {
    ratio: mean(e) / mean(m), meanPer: mean(per), worst: Math.min(...per),
    worstSeed: seeds[per.indexOf(Math.min(...per))],
    eDist: mean(e), mDist: mean(m),
    eAir: eAir / n, eAlt: eAlt / n, eSpd: eSpd / n, eMax, mSpd: mSpd / n,
  };
}

function line(tag: string, m: ReturnType<typeof ev>): string {
  return `  ${tag.padEnd(22)} ratio=${m.ratio.toFixed(4)} worst=${m.worst.toFixed(4)} (${m.worstSeed})` +
    ` e=${m.eDist.toFixed(0)}m (air ${(m.eAir * 100).toFixed(1)}% alt ${m.eAlt.toFixed(1)} maxAlt ${m.eMax.toFixed(0)} spd ${m.eSpd.toFixed(1)})` +
    ` m=${m.mDist.toFixed(0)}m spd ${m.mSpd.toFixed(1)}`;
}

describe("glide exchange sweep", () => {
  it("sweeps on TUNING", () => {
    const vals = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.65, 0.8, 1.0, 1.3];
    console.log("\n### GLIDE_EXCHANGE sweep on TUNING (n=20)");
    for (const v of vals) console.log(line(`GLIDE_EXCHANGE=${v}`, ev(v, TUNING)));
    resetAll();
  }, 900000);

  it("validates finalists on HELDOUT (n=40)", () => {
    console.log("\n### GLIDE_EXCHANGE finalists on HELDOUT (n=40, never tuned against)");
    for (const v of [0, 0.3, 0.4, 0.5, 0.65, 0.8, 1.0]) console.log(line(`GLIDE_EXCHANGE=${v}`, ev(v, HELDOUT)));
    console.log("\n### 3-seed GATE headline");
    for (const v of [0, 0.4, 0.5, 0.65, 0.8]) console.log(line(`GLIDE_EXCHANGE=${v}`, ev(v, GATE)));
    resetAll();
  }, 900000);
});