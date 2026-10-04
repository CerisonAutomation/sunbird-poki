// SCRATCH MEASUREMENT HARNESS — not a gate. Deleted before hand-off.
import { describe, it } from "vitest";
import { Bird } from "../Bird";
import { TerrainSystem } from "../TerrainSystem";
import { PHYS_DT } from "../constants";

type Policy = (bird: Bird, terrain: TerrainSystem, t: number, rng: () => number) => boolean;

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

type Stat = {
  x: number;
  airFrac: number;
  meanAlt: number;
  maxAlt: number;
  meanSpeed: number;
  launches: number;
  releases: number;
  groundedFrac: number;
};

function run(seed: string, policy: Policy, seconds: number): Stat {
  const terrain = new TerrainSystem(seed);
  const bird = new Bird();
  bird.reset(64, terrain.heightAt(64) + 0.9);
  const rng = lcg(0x5eed);
  const steps = Math.round(seconds / PHYS_DT);
  let air = 0;
  let ground = 0;
  let altSum = 0;
  let maxAlt = 0;
  let spdSum = 0;
  let launches = 0;
  let releases = 0;
  let wasDiving = false;
  let t = 0;
  for (let i = 0; i < steps; i++) {
    t += PHYS_DT;
    const diving = policy(bird, terrain, t, rng);
    if (wasDiving && !diving && !bird.grounded) releases++;
    wasDiving = diving;
    const beforeLaunch = bird.justLaunched;
    bird.step(PHYS_DT, { diving, fever: false, speedMult: 1, boost: false }, terrain);
    if (!beforeLaunch && bird.justLaunched) launches++;
    if (bird.grounded) ground++;
    else air++;
    altSum += bird.altitude;
    if (bird.altitude > maxAlt) maxAlt = bird.altitude;
    spdSum += bird.speed();
  }
  terrain.dispose();
  return {
    x: bird.x,
    airFrac: air / steps,
    groundedFrac: ground / steps,
    meanAlt: altSum / steps,
    maxAlt,
    meanSpeed: spdSum / steps,
    launches,
    releases,
  };
}

const POLICIES: Record<string, Policy> = {
  masher: () => true,
  expert: (_b, tr, _t, _r) => tr.slopeAt(_b.x) < 0,
  random: (_b, _tr, _t, rng) => rng() < 0.5,
};

const GATE = ["2026-09-16", "2026-09-17", "2026-09-18"];
const TUNING = [
  "2026-09-16", "2026-09-17", "2026-09-18",
  "2027-01-04", "2027-01-05", "2027-01-06", "2027-01-07", "2027-01-08",
  "2027-02-11", "2027-02-12", "2027-02-13", "2027-02-14", "2027-02-15",
  "2027-03-21", "2027-03-22", "2027-03-23", "2027-03-24", "2027-03-25",
  "2027-04-02", "2027-04-03",
];
// HELD OUT: never tuned against.
const HELDOUT = [
  "held-a01", "held-a02", "held-a03", "held-a04", "held-a05", "held-a06",
  "held-a07", "held-a08", "held-a09", "held-a10", "held-a11", "held-a12",
  "held-a13", "held-a14", "held-a15", "held-a16", "held-a17", "held-a18",
  "held-a19", "held-a20", "held-a21", "held-a22", "held-a23", "held-a24",
  "held-a25", "held-a26", "held-a27", "held-a28", "held-a29", "held-a30",
  "held-a31", "held-a32", "held-a33", "held-a34", "held-a35", "held-a36",
  "held-a37", "held-a38", "held-a39", "held-a40",
];

function report(label: string, seeds: string[], seconds = 60, diag = false): void {
  const out: Record<string, { means: number[]; perSeed: number[] }> = {};
  for (const name of Object.keys(POLICIES)) out[name] = { means: [], perSeed: [] };
  const expertStats: Stat[] = [];
  const masherStats: Stat[] = [];
  for (const seed of seeds) {
    for (const [name, policy] of Object.entries(POLICIES)) {
      const st = run(seed, policy, seconds);
      out[name].means.push(st.x);
      if (name === "expert") expertStats.push(st);
      if (name === "masher") masherStats.push(st);
    }
  }
  for (let i = 0; i < seeds.length; i++) {
    for (const name of Object.keys(POLICIES)) {
      out[name].perSeed.push(out[name].means[i] / out.masher.means[i]);
    }
  }
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const eMean = mean(out.expert.means);
  const mMean = mean(out.masher.means);
  const rMean = mean(out.random.means);
  const ratioOfMeans = eMean / mMean;
  const perSeed = out.expert.perSeed;
  const worst = Math.min(...perSeed);
  const worstIdx = perSeed.indexOf(worst);
  const best = Math.max(...perSeed);
  const avg = (a: Stat[], f: (s: Stat) => number) => mean(a.map(f));
  const lines = [
    `[${label}] n=${seeds.length} secs=${seconds}`,
    `  expert/masher ratio-of-means = ${ratioOfMeans.toFixed(4)}`,
    `  expert/masher mean-of-per-seed = ${mean(perSeed).toFixed(4)}  WORST=${worst.toFixed(4)} (${seeds[worstIdx]})  best=${best.toFixed(4)}`,
    `  random/masher = ${(rMean / mMean).toFixed(4)}  worst=${Math.min(...out.random.perSeed).toFixed(4)}`,
    `  dist: expert=${eMean.toFixed(0)}m masher=${mMean.toFixed(0)}m`,
  ];
  if (diag) {
    lines.push(
      `  expert: air=${(avg(expertStats, (s) => s.airFrac) * 100).toFixed(1)}% meanAlt=${avg(expertStats, (s) => s.meanAlt).toFixed(1)} maxAlt=${Math.max(...expertStats.map((s) => s.maxAlt)).toFixed(1)} spd=${avg(expertStats, (s) => s.meanSpeed).toFixed(1)} launches/run=${(avg(expertStats, (s) => s.launches)).toFixed(1)} releases/run=${(avg(expertStats, (s) => s.releases)).toFixed(1)}`,
      `  masher: air=${(avg(masherStats, (s) => s.airFrac) * 100).toFixed(1)}% meanAlt=${avg(masherStats, (s) => s.meanAlt).toFixed(1)} maxAlt=${Math.max(...masherStats.map((s) => s.maxAlt)).toFixed(1)} spd=${avg(masherStats, (s) => s.meanSpeed).toFixed(1)} launches/run=${(avg(masherStats, (s) => s.launches)).toFixed(1)} releases/run=${(avg(masherStats, (s) => s.releases)).toFixed(1)}`,
    );
  }
  console.log(lines.join("\n"));
}

describe("scratch", () => {
  it("measures", () => {
    report("GATE", GATE, 60, true);
    report("TUNING", TUNING, 60, true);
    report("HELDOUT", HELDOUT, 60, true);
  });
});