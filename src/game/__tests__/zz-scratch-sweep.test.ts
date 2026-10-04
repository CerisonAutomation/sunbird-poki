// SCRATCH LEVER SWEEP — not a gate. Deleted before hand-off.
import { afterAll, describe, it } from "vitest";
import { Bird } from "../Bird";
import { TerrainSystem } from "../TerrainSystem";
import { PHYS_DT, applyLiveTune, LIVE_TUNE_DEFAULTS, type LiveTunable } from "../constants";
import { applyReleaseTune, RELEASE_TUNE_DEFAULTS, type ReleaseTunable } from "../FlightPhysics";

type Policy = (bird: Bird, terrain: TerrainSystem, t: number) => boolean;

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function run(seed: string, policy: Policy, seconds: number): { x: number; air: number; alt: number; spd: number } {
  const terrain = new TerrainSystem(seed);
  const bird = new Bird();
  bird.reset(64, terrain.heightAt(64) + 0.9);
  const rng = lcg(0x5eed);
  const steps = Math.round(seconds / PHYS_DT);
  let air = 0;
  let alt = 0;
  let spd = 0;
  let t = 0;
  for (let i = 0; i < steps; i++) {
    t += PHYS_DT;
    const diving = policy(bird, terrain, t);
    bird.step(PHYS_DT, { diving, fever: false, speedMult: 1, boost: false }, terrain);
    if (!bird.grounded) air++;
    alt += bird.altitude;
    spd += bird.speed();
  }
  const r = { x: bird.x, air: air / steps, alt: alt / steps, spd: spd / steps };
  terrain.dispose();
  return r;
}

const MASHER: Policy = () => true;
const EXPERT: Policy = (b, tr) => tr.slopeAt(b.x) < 0;

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

type Override = { k: LiveTunable | ReleaseTunable; v: number };

function setAll(ov: Override[]): void {
  for (const o of ov) {
    if (o.k in RELEASE_TUNE_DEFAULTS) applyReleaseTune(o.k as ReleaseTunable, o.v);
    else applyLiveTune(o.k as LiveTunable, o.v);
  }
}

function resetAll(): void {
  for (const k of Object.keys(LIVE_TUNE_DEFAULTS) as LiveTunable[]) {
    applyLiveTune(k, LIVE_TUNE_DEFAULTS[k]);
  }
  for (const k of Object.keys(RELEASE_TUNE_DEFAULTS) as ReleaseTunable[]) {
    applyReleaseTune(k, RELEASE_TUNE_DEFAULTS[k]);
  }
}

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

function evaluate(ov: Override[], seeds: string[], seconds = 60) {
  setAll(ov);
  const e: number[] = [];
  const m: number[] = [];
  let eAir = 0, eAlt = 0, eSpd = 0, mAir = 0, mAlt = 0, mSpd = 0;
  for (const s of seeds) {
    const er = run(s, EXPERT, seconds);
    const mr = run(s, MASHER, seconds);
    e.push(er.x);
    m.push(mr.x);
    eAir += er.air; eAlt += er.alt; eSpd += er.spd;
    mAir += mr.air; mAlt += mr.alt; mSpd += mr.spd;
  }
  const per = e.map((v, i) => v / m[i]);
  const n = seeds.length;
  return {
    ratio: mean(e) / mean(m),
    meanPer: mean(per),
    worst: Math.min(...per),
    worstSeed: seeds[per.indexOf(Math.min(...per))],
    eDist: mean(e),
    mDist: mean(m),
    eAir: eAir / n, eAlt: eAlt / n, eSpd: eSpd / n,
    mAir: mAir / n, mAlt: mAlt / n, mSpd: mSpd / n,
  };
}

type Row = { label: string; ov: Override[] };

function sweep(name: string, key: LiveTunable | ReleaseTunable, values: number[]): void {
  const rows: Row[] = [{ label: "baseline", ov: [] }];
  for (const v of values) rows.push({ label: `${key}=${v}`, ov: [{ k: key, v }] });
  const base = evaluate([], TUNING);
  console.log(
    `\n### ${name} (TUNING n=${TUNING.length})  baseline ratio=${base.ratio.toFixed(4)} worst=${base.worst.toFixed(4)}` +
    `\n    baseline: expert=${base.eDist.toFixed(0)}m air=${(base.eAir * 100).toFixed(1)}% alt=${base.eAlt.toFixed(1)} spd=${base.eSpd.toFixed(1)} | masher=${base.mDist.toFixed(0)}m air=${(base.mAir * 100).toFixed(1)}% spd=${base.mSpd.toFixed(1)}`,
  );
  for (const r of rows) {
    const m = evaluate(r.ov, TUNING);
    console.log(
      `  ${r.label.padEnd(26)} ratio=${m.ratio.toFixed(4)} worst=${m.worst.toFixed(4)} (${m.worstSeed})` +
      ` e=${m.eDist.toFixed(0)}m (air ${(m.eAir * 100).toFixed(1)}% alt ${m.eAlt.toFixed(1)} spd ${m.eSpd.toFixed(1)})` +
      ` m=${m.mDist.toFixed(0)}m (air ${(m.mAir * 100).toFixed(1)}% spd ${m.mSpd.toFixed(1)})`,
    );
  }
  resetAll();
}

describe("sweep", () => {
  it("runs", () => {
    sweep("crest-release bonus", "LAUNCH_POP_MAX", [26, 34, 40]);
    sweep("glide lift vs speed", "GLIDE_LIFT_SPEED", [62, 75, 85]);
    sweep("glide lift ceiling", "GLIDE_LIFT_MAX", [0.55, 0.7, 0.8]);
    sweep("glide air drag", "AIR_DRAG_GLIDE", [0.00015, 0.0002, 0.00028, 0.00042]);
    sweep("release kick", "RELEASE_KICK", [15, 20, 26, 32]);
    sweep("MAX_SPEED", "MAX_SPEED", [108, 128, 150]);
  }, 600000);

  afterAll(() => resetAll());
});