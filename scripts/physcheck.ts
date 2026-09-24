import { Bird } from "../src/game/Bird";
import { LaunchSystem } from "../src/game/LaunchSystem";
import { TerrainSystem } from "../src/game/TerrainSystem";
import { PHYS_DT, BIRD_RADIUS } from "../src/game/constants";

const terrain = new TerrainSystem("2025-01-01");
const bird = new Bird();
const launch = new LaunchSystem();

/** A simple "good player" AI: hold on downhills, release just before crests. */
function ai(x: number): boolean {
  // A human anticipates: start tucking just before the ground falls away,
  // and let go as soon as the next ramp starts lifting.
  return terrain.slopeAt(x + 10) < -0.02;
}

function run(policy: (x: number) => boolean, secs: number) {
  bird.reset(64, terrain.heightAt(64) + BIRD_RADIUS);
  launch.reset();
  let t = 0, maxAlt = 0, maxSpd = 0, perfects = 0, greats = 0, goods = 0, best = 0, launches = 0, airT = 0;
  while (t < secs) {
    const diving = policy(bird.x);
    launch.observeInput(diving, t);
    launch.tick(PHYS_DT);
    bird.step(PHYS_DT, { diving, fever: false, speedMult: 1, boost: false }, terrain);
    if (!bird.grounded) airT += PHYS_DT;
    if (bird.justLaunched) {
      launches++;
      const r = launch.evaluate(bird, terrain, t);
      if (r.rating === "perfect") perfects++;
      else if (r.rating === "great") greats++;
      else if (r.rating === "good") goods++;
      best = Math.max(best, launch.combo);
    }
    if (bird.justLanded && bird.landingQuality < 0.8) launch.breakCombo();
    maxAlt = Math.max(maxAlt, bird.altitude);
    maxSpd = Math.max(maxSpd, bird.speed());
    t += PHYS_DT;
  }
  return { dist: bird.x - 64, maxAlt, maxSpd, launches, perfects, greats, goods, best, airPct: (airT/secs)*100 };
}

const skilled = run(ai, 60);
const masher = run(() => true, 60);          // holds forever
const idler  = run(() => false, 60);         // never holds
// A precise player: tuck the moment the ground starts dropping, release the
// moment it starts rising again.
// True technique: stay tucked through the descent AND the climb, release only
// as the lip approaches so the ramp fires you off it.
function distToCrest(x: number): number {
  let prev = terrain.slopeAt(x);
  for (let d = 2; d < 120; d += 2) {
    const s2 = terrain.slopeAt(x + d);
    if (prev > 0 && s2 <= 0) return d;
    prev = s2;
  }
  return 999;
}
const expert = run((x) => distToCrest(x) > 16, 60);
const early  = run((x) => distToCrest(x) > 40, 60);

console.log("skilled ", JSON.stringify(skilled, (_k, v) => typeof v === "number" ? +v.toFixed(1) : v));
console.log("hold-all", JSON.stringify(masher,  (_k, v) => typeof v === "number" ? +v.toFixed(1) : v));
console.log("no-hold ", JSON.stringify(idler,   (_k, v) => typeof v === "number" ? +v.toFixed(1) : v));
console.log("expert  ", JSON.stringify(expert,  (_k, v) => typeof v === "number" ? +v.toFixed(1) : v));
console.log("early   ", JSON.stringify(early,   (_k, v) => typeof v === "number" ? +v.toFixed(1) : v));

// terrain smoothness: no absurd curvature spikes
let worst = 0, worstX = 0;
for (let x = 100; x < 6000; x += 1) {
  const c = Math.abs(terrain.curvatureAt(x));
  if (c > worst) { worst = c; worstX = x; }
}
console.log("max |curvature|", worst.toFixed(4), "at x=", worstX, "(radius", (1/worst).toFixed(1), "m)");
