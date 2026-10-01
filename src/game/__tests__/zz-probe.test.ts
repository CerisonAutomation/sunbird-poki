import { describe, it } from "vitest";
import { Bird } from "../Bird";
import { TerrainSystem } from "../TerrainSystem";
import { BIRD_RADIUS, PHYS_DT } from "../constants";

describe("probe", () => {
  it("sweep small start altitude", () => {
    const opts = { fever: false, speedMult: 1, boost: false, diving: false } as const;
    for (const startAlt of [0, 6, 10, 14, 20]) {
      for (const startVx of [11, 34, 48, 62]) {
        let g = 0;
        let n = 0;
        let launches = 0;
        let maxAlt = 0;
        let above20 = 0;
        let firstGroundedAt = -1;
        for (const seed of ["probe-seed", "alpha", "beta", "gamma"]) {
          const t = new TerrainSystem(seed);
          const b = new Bird();
          b.reset(64, t.heightAt(64) + BIRD_RADIUS + startAlt);
          b.vx = startVx;
          for (let i = 0; i < 120 * 60; i++) {
            b.step(PHYS_DT, opts, t);
            t.update(b.x);
            if (b.justLaunched) launches++;
            if (b.grounded) {
              g++;
              if (firstGroundedAt < 0) firstGroundedAt = i / 120;
            }
            n++;
            if (b.altitude > maxAlt) maxAlt = b.altitude;
            if (b.altitude > 20) above20++;
          }
        }
        console.log(
          `alt=${String(startAlt).padStart(2)} vx=${String(startVx).padStart(2)} | grounded=${((g / n) * 100).toFixed(0).padStart(2)}% launches=${String(launches).padStart(3)} maxAlt=${maxAlt.toFixed(0).padStart(3)} above20=${((above20 / n) * 100).toFixed(0).padStart(2)}% firstGround=${firstGroundedAt.toFixed(1)}s`,
        );
      }
    }
  });
});
