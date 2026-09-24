import type { SkinView } from "./Economy";

export type ShopFilter = "all" | "owned" | "affordable" | "nature" | "cosmic" | "elements" | "legendary";
export type ShopBrowse = { query: string; filter: ShopFilter; preview: string };
export const newShopBrowse = (): ShopBrowse => ({ query: "", filter: "all", preview: "" });

/** Search is literal, bounded and local. Never execute user input as a regex. */
export function browseSkins(skins: readonly SkinView[], browse: ShopBrowse): SkinView[] {
  const words = browse.query.trim().toLocaleLowerCase().slice(0, 80).split(/\s+/).filter(Boolean);
  return skins.filter(v => {
    if (browse.filter === "owned" && !v.owned) return false;
    if (browse.filter === "affordable" && (v.owned || v.locked || v.def.prizeOnly || !v.affordable)) return false;
    if (browse.filter === "nature" && v.def.collection !== "nature") return false;
    if (browse.filter === "cosmic" && v.def.collection !== "cosmic") return false;
    if (browse.filter === "elements" && v.def.collection !== "elements") return false;
    if (browse.filter === "legendary" && v.def.rarity !== "legendary" && v.def.rarity !== "mythic") return false;
    const text = `${v.def.name} ${v.def.perk} ${v.def.collection ?? "starter"} ${v.def.rarity ?? ""}`.toLocaleLowerCase();
    return words.every(word => text.includes(word));
  });
}

/** Honest next unlock: exclude subscription/event/prize gates, do not upsell. */
export function nextBird(skins: readonly SkinView[]): SkinView | undefined {
  return skins.filter(v => !v.owned && !v.locked && !v.def.prizeOnly)
    .reduce<SkinView | undefined>((best, v) => !best || v.def.price < best.def.price ? v : best, undefined);
}
