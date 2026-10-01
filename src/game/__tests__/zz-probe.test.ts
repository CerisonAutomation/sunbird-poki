import { describe, it } from "vitest";
import { Bird } from "../Bird";
import { TerrainSystem } from "../TerrainSystem";
import { BIRD_RADIUS, PHYS_DT } from "../constants";

describe("probe", () => {
  it("sweep start conditions", () => {
    const opts = { fever: false, speedMult: 1, boost: false, diving: false } as const;
    for (const startAlt of [0, 20, 45, 80]) {
      for (const startVx of [11, 45, 70]) {
        let g = 0;
        let n = 0;
        let launches = 0;
        let maxAlt = 0;
        let above20 = 0;
        for (const seed of ["probe-seed", "alpha", "beta"]) {
          const t = new TerrainSystem(seed);
          const b = new Bird();
          b.reset(64, t.heightAt(64) + BIRD_RADIUS + startAlt);
          b.vx = startVx;
          for (let i = 0; i < 120 * 60; i++) {
            b.step(PHYS_DT, opts, t);
            t.update(b.x);
            if (b.justLaunched) launches++;
            if (b.grounded) g++;
            n++;
            if (b.altitude > maxAlt) maxAlt = b.altitude;
            if (b.altitude > 20) above20++;
          }
        }
        console.log(
          `startAlt=${String(startAlt).padStart(2)} vx=${String(startVx).padStart(2)} | grounded=${((g / n) * 100).toFixed(0).padStart(2)}% launches=${String(launches).padStart(3)} maxAlt=${maxAlt.toFixed(0).padStart(3)} timeAbove20m=${((above20 / n) * 100).toFixed(0).padStart(2)}%`,
        );
      }
    }
  });
});
