/**
 * In-Flight Shop — game-changing feature: buy powerups mid-flight with coins.
 * Hexagonal: domain + adapter, modular, dynamically fits.
 */

export type PowerupDef = {
  id: "boost" | "magnet" | "shield" | "fever";
  icon: string;
  name: string;
  cost: number;
  desc: string;
  duration: number;
};

export const INFLIGHT_POWERUPS: PowerupDef[] = [
  { id: "boost", icon: "🚀", name: "Boost", cost: 35, desc: "+30 speed 5s", duration: 5 },
  { id: "magnet", icon: "🧲", name: "Magnet", cost: 25, desc: "Coins 8s", duration: 8 },
  { id: "shield", icon: "🛡", name: "Shield", cost: 40, desc: "No crash 6s", duration: 6 },
  { id: "fever", icon: "🔥", name: "Fever", cost: 80, desc: "Warp 142", duration: 4 },
];

export type InFlightShopState = {
  coins: number;
  owned: string[];
  cooldowns: Map<string, number>;
};

export class InFlightShopDomain {
  private state: InFlightShopState = { coins: 0, owned: [], cooldowns: new Map() };

  constructor(private readonly onBuy: (id: string) => void) {}

  update(coins: number, dt: number): void {
    this.state.coins = coins;
    for (const [id, cd] of this.state.cooldowns) {
      const next = Math.max(0, cd - dt);
      if (next <= 0) this.state.cooldowns.delete(id);
      else this.state.cooldowns.set(id, next);
    }
  }

  canBuy(def: PowerupDef): boolean {
    if (this.state.coins < def.cost) return false;
    if (this.state.cooldowns.has(def.id)) return false;
    return true;
  }

  buy(def: PowerupDef): boolean {
    if (!this.canBuy(def)) return false;
    this.state.coins -= def.cost;
    this.state.cooldowns.set(def.id, def.duration + 2); // +2s cooldown
    this.onBuy(def.id);
    return true;
  }

  render(): string {
    return `<div class="inflight-shop" role="group" aria-label="In-flight powerup shop">
      ${INFLIGHT_POWERUPS.map((p) => {
        const can = this.canBuy(p);
        const cd = this.state.cooldowns.get(p.id);
        const label = cd ? `${p.icon} ${Math.ceil(cd)}s` : `${p.icon} ${p.name} · ●${p.cost}`;
        return `<button class="mini-btn ${can ? "gold" : "off"}" data-ui data-action="buy-powerup" data-id="${p.id}" ${can ? "" : "disabled"} title="${p.desc}">${label}</button>`;
      }).join("")}
    </div>`;
  }
}
