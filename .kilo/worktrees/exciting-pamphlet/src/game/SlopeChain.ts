export type SlopeChainAward = { chain: number; points: number };

/** Scores the rhythm of a clean downslope landing followed by a rated lip. */
export class SlopeChain {
  private armed = false;
  chain = 0;
  score = 0;

  reset(): void {
    this.armed = false;
    this.chain = 0;
    this.score = 0;
  }

  land(quality: number, slope: number, impact: number): boolean {
    this.armed = quality >= 0.8 && slope < -0.04 && impact < 6;
    if (!this.armed) this.chain = 0;
    return this.armed;
  }

  launch(rating: "none" | "good" | "great" | "perfect"): SlopeChainAward | null {
    if (!this.armed) return null;
    this.armed = false;
    if (rating === "none") {
      this.chain = 0;
      return null;
    }
    this.chain += 1;
    const points = 20 + Math.min(5, this.chain) * 10;
    this.score += points;
    return { chain: this.chain, points };
  }

  break(): void {
    this.armed = false;
    this.chain = 0;
  }

  get open(): boolean { return this.armed; }
}
