import { DROP_START, RAMP_START } from "./constants";

export type FlightCue = "runup" | "apex" | null;
type Signals = { grounded: boolean; altitude: number; vy: number; speed(): number };

/** Sparse audio landmarks, not another per-frame sound emitter. */
export class FlightCues {
  private runupIsland = -1;
  private previousVy = 0;
  private cooldown = 0;

  reset(): void { this.runupIsland = -1; this.previousVy = 0; this.cooldown = 0; }

  update(dt: number, bird: Signals, island: number, localX: number): FlightCue {
    this.cooldown = Math.max(0, this.cooldown - dt);
    const apex = !bird.grounded && bird.altitude > 85 && this.previousVy > 0 && bird.vy <= 0;
    this.previousVy = bird.vy;
    if (bird.grounded && localX >= DROP_START && localX < RAMP_START && bird.speed() > 55 && this.runupIsland !== island) {
      this.runupIsland = island;
      this.cooldown = 1;
      return "runup";
    }
    if (apex && this.cooldown === 0) {
      this.cooldown = 4;
      return "apex";
    }
    return null;
  }
}
