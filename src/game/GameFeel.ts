/**
 * Unified game-feel state machine: hit-stop, slow-motion, trauma-based shake,
 * and FOV kick — adapted from the single-file prototype's Feel object.
 *
 * Why one place: previously hitStopTimer, timeScale, and shake(amount) were
 * private fields scattered across 20+ Game.ts sites with no semantic names.
 * Here every impulse has a name and tuned defaults; callers express *what
 * happened*, not *what numbers to poke*.
 */

const TUNE = {
  shakeDecay: 1.6,      // trauma/s — fast decay, only big hits register
  fovKickDecay: 6,      // 1/s exponential
  fovSpeedK: 0.35,
  fovSpeedMax: 14,
  crashStopS: 0.09,
  crashSlowS: 0.30,
  crashSlowTs: 0.35,
  roughStopS: 0.06,
  roughSlowS: 0,
  roughSlowTs: 1,
  nearMissSlowS: 0.20,
  nearMissSlowTs: 0.45,
  finishWinStopS: 0.12,
  finishWinSlowS: 0.50,
  finishWinSlowTs: 0.30,
} as const;

function damp(current: number, target: number, halflife: number, dt: number): number {
  return target + (current - target) * Math.exp(-halflife * dt * Math.LN2);
}

export class GameFeel {
  trauma = 0;
  fovKick = 0;
  fovSpeed = 0;

  private stopT = 0;
  private stopTs = 1;
  private slowT = 0;
  private slowTs = 1;
  private t = 0;

  /** Resolved each frame by update(). */
  timescale = 1;
  shakeX = 0;
  shakeY = 0;
  shakeR = 0;

  // ── Named game events ────────────────────────────────────────────────────

  crash(): void {
    this.stopT = TUNE.crashStopS;
    this.stopTs = 0;
    this.slowT = TUNE.crashSlowS;
    this.slowTs = TUNE.crashSlowTs;
    this.addTrauma(0.9);
    this.fovKick = Math.max(this.fovKick, 8);
  }

  rough(): void {
    this.stopT = Math.max(this.stopT, TUNE.roughStopS);
    this.stopTs = Math.min(this.stopTs, 0.5);
    this.addTrauma(0.30);
  }

  /** Gentle bump: collision without full stop. */
  bump(amount = 0.25): void {
    this.addTrauma(amount);
  }

  perfect(chain: number): void {
    this.fovKick = Math.min(10, 3 + chain * 0.6);
    this.addTrauma(0.12 + Math.min(chain, 10) * 0.008);
  }

  feverClinch(isFever: boolean): void {
    this.stopT = Math.max(this.stopT, isFever ? 0.04 : 2 / 60);
    this.stopTs = 0;
    this.slowT = Math.max(this.slowT, 0.15);
    this.slowTs = Math.min(this.slowTs, 0.45);
    this.addTrauma(0.20);
    this.fovKick = Math.min(10, this.fovKick + 4);
  }

  nearMiss(): void {
    this.slowT = Math.max(this.slowT, TUNE.nearMissSlowS);
    this.slowTs = Math.min(this.slowTs, TUNE.nearMissSlowTs);
    this.fovKick = Math.max(this.fovKick, 6);
    this.addTrauma(0.18);
  }

  overtake(): void {
    this.fovKick = Math.max(this.fovKick, 7);
    this.addTrauma(0.15);
  }

  boost(): void {
    this.fovKick = 10;
    this.addTrauma(0.25);
  }

  finishWin(): void {
    this.stopT = TUNE.finishWinStopS;
    this.stopTs = 0;
    this.slowT = TUNE.finishWinSlowS;
    this.slowTs = TUNE.finishWinSlowTs;
    this.addTrauma(0.5);
  }

  zenithSlowmo(scale: number): void {
    this.slowTs = scale;
    this.slowT = 999; // caller clears via reset() or explicit timeout
  }

  /** Instantly restore normal time (race end, pause, etc.). */
  reset(): void {
    this.stopT = 0;
    this.slowT = 0;
    this.stopTs = 1;
    this.slowTs = 1;
    this.timescale = 1;
    this.trauma = 0;
    this.fovKick = 0;
  }

  addTrauma(v: number): void {
    this.trauma = Math.min(1, this.trauma + v);
  }

  // ── Per-frame update ─────────────────────────────────────────────────────

  /**
   * Call once per raw frame before applying simDt.
   * @returns `stopFrame` — true means skip physics and render-only this tick.
   */
  update(dt: number, speedNorm = 0): boolean {
    this.t += dt;

    // Hit-stop → stop physics, freeze world
    let ts = 1;
    if (this.stopT > 0) {
      this.stopT -= dt;
      ts = this.stopTs;
      if (this.stopT <= 0) {
        this.stopT = 0;
        // fall through to slowT check
      } else {
        this.timescale = ts;
        this._decayShake(dt);
        return true; // caller should skip physics
      }
    }

    // Slow-motion
    if (this.slowT > 0 && this.slowT < 990) {
      this.slowT -= dt;
      ts = this.slowTs;
      if (this.slowT <= 0) { this.slowT = 0; ts = 1; }
    } else if (this.slowT >= 990) {
      ts = this.slowTs; // zenith hold — never auto-expires
    }

    this.timescale = ts;

    // FOV speed contribution
    const targetFovSpeed = Math.max(0, (speedNorm * 80 - 18) * TUNE.fovSpeedK);
    this.fovSpeed = damp(this.fovSpeed, Math.min(targetFovSpeed, TUNE.fovSpeedMax), TUNE.fovKickDecay, dt);
    this.fovKick = damp(this.fovKick, 0, TUNE.fovKickDecay, dt);

    this._decayShake(dt);
    return false;
  }

  private _decayShake(dt: number): void {
    this.trauma = Math.max(0, this.trauma - TUNE.shakeDecay * dt);
    const sh = this.trauma * this.trauma; // squaring: only big hits register
    const w = this.t * 28;
    this.shakeX = (Math.sin(w * 1.3) + Math.sin(w * 3.7)) * 0.5 * sh * 1.6;
    this.shakeY = (Math.cos(w * 1.7) + Math.sin(w * 2.9)) * 0.5 * sh * 1.1;
    this.shakeR = Math.sin(w * 2.3) * sh * 0.045;
  }

  /** Total FOV offset (kick + speed contribution). */
  get fovOffset(): number {
    return this.fovKick + this.fovSpeed;
  }
}
