import {
  PU_CLOUDBOOST,
  PU_FEATHER,
  PU_GOLDENWINGS,
  PU_LONGGLIDE,
  PU_MAGNET,
  PU_SPEED,
  PU_WINGBOOST,
} from "./constants";
import { PICKUP_STYLE, type PickupKind } from "./Collectibles";

export type ActivePower = { kind: PickupKind; time: number; total: number; icon: string; label: string; level: 1 | 2 };

const DURATION: Partial<Record<PickupKind, number>> = {
  longglide: PU_LONGGLIDE,
  wingboost: PU_WINGBOOST,
  rocket: PU_SPEED,
  feather: PU_FEATHER,
  magnet: PU_MAGNET,
  goldenwings: PU_GOLDENWINGS,
  cloudboost: PU_CLOUDBOOST,
};

/**
 * Timed flight modifiers. Everything here *enhances* the hill loop — nothing
 * replaces it: no power-up grants free altitude, they only change how well the
 * bird converts the momentum it already earned.
 */
export class PowerUps {
  private timers = new Map<PickupKind, number>();
  /** Overcharge: grabbing a power-up while it is already live promotes it to
   * tier II (stronger effect) until the timer runs out. */
  private levels = new Map<PickupKind, 1 | 2>();
  shield = 0;

  reset(): void {
    this.timers.clear();
    this.levels.clear();
    this.shield = 0;
  }

  /** @returns seconds granted (0 for instant pickups handled by the caller). */
  add(kind: PickupKind): number {
    const d = DURATION[kind];
    if (!d) return 0;
    const cur = this.timers.get(kind) ?? 0;
    if (cur > 0) this.levels.set(kind, 2);
    // Golden Wings implies its lesser effects.
    if (kind === "goldenwings") {
      this.timers.set("longglide", Math.max(this.timers.get("longglide") ?? 0, d));
      this.timers.set("magnet", Math.max(this.timers.get("magnet") ?? 0, d));
    }
    this.timers.set(kind, Math.min(cur + d, d * 1.8));
    return d;
  }

  /** Current tier of a power-up: 0 = off, 1 = normal, 2 = overcharged. */
  level(kind: PickupKind): 0 | 1 | 2 {
    if (!this.has(kind)) return 0;
    return this.levels.get(kind) ?? 1;
  }

  tick(dt: number): void {
    for (const [k, t] of this.timers) {
      const n = t - dt;
      if (n <= 0) {
        this.timers.delete(k);
        this.levels.delete(k);
      } else {
        this.timers.set(k, n);
      }
    }
  }

  has(kind: PickupKind): boolean {
    return (this.timers.get(kind) ?? 0) > 0;
  }

  timeLeft(kind: PickupKind): number {
    return this.timers.get(kind) ?? 0;
  }

  /** Air-drag multiplier (lower = floats longer). Tier II floats longer still. */
  dragMult(): number {
    let m = 1;
    if (this.has("longglide")) m *= this.level("longglide") === 2 ? 0.3 : 0.42;
    if (this.has("goldenwings")) m *= 0.72;
    return m;
  }

  /** Speed-borne lift multiplier. Tier II lifts harder. */
  liftMult(): number {
    let m = 1;
    if (this.has("wingboost")) m *= this.level("wingboost") === 2 ? 1.75 : 1.5;
    if (this.has("goldenwings")) m *= 1.35;
    return m;
  }

  magnetOn(): boolean {
    return this.has("magnet") || this.has("goldenwings");
  }

  featherOn(): boolean {
    return this.has("feather") || this.has("goldenwings");
  }

  boostOn(): boolean {
    return this.has("rocket");
  }

  cloudBoostOn(): boolean {
    return this.has("cloudboost");
  }

  coinMult(): number {
    if (this.has("goldenwings")) return this.level("goldenwings") === 2 ? 3 : 2;
    return 1;
  }

  /** Magnet pull strength scale — tier II reaches further and pulls harder. */
  magnetScale(): number {
    return this.level("magnet") === 2 ? 1.6 : 1;
  }

  view(): ActivePower[] {
    const out: ActivePower[] = [];
    for (const [kind, time] of this.timers) {
      const style = PICKUP_STYLE[kind];
      out.push({ kind, time, total: DURATION[kind] ?? 1, icon: style.icon, label: style.label, level: this.levels.get(kind) ?? 1 });
    }
    out.sort((a, b) => b.time - a.time);
    return out.slice(0, 5);
  }
}
