/**
 * The pre-flight loadout: pick a bird, pick a trail, stage your boosters.
 *
 * The player's ask, verbatim: choose a bird and a trail before flying, and
 * have a STORE on that same screen — buy boosters there, keep them, and load
 * as many as you like for the next flight, with the option to buy more when
 * the shelf is empty.
 *
 * That last clause is why this screen exists rather than living in the shop.
 * A booster you own but cannot see, or cannot move from "bought" to "flying",
 * is a booster the player cannot reason about. Ownership, the loadout, and the
 * buy button all live on one page so the three can never disagree.
 *
 * This module never mutates the save. It renders `BoostView`/`SkinView`/
 * `ShopTrailView` and emits `data-action`s; the handlers live in Game.ts.
 */

import { formatNumberLocalized, t } from "../../i18n";
import { menuIcon, menuIconSm } from "../MenuIcons";
import { skinPalette, skinShape, sunbirdSVG } from "../Sunbird";
import { SCREEN, escapeHtml, head, sectionTitle } from "./kit";
import { type BoostView, type ShopTrailView, type SkinView } from "../Economy";
import { type HudSnapshot } from "./types";

/** How many staged boosters fit a loadout. A cap is what makes "load as many
 *  as you like" a decision rather than a free-for-all: without one, stacking
 *  every Shield the player ever bought would be strictly optimal and the
 *  whole store would collapse to one item. */
export const LOADOUT_MAX_BOOSTS = 6;

/**
 * Copies staged for the next flight, and the slots still free.
 *
 * These two exist so the button and the guard cannot disagree. The screen asks
 * "is the loadout full?" to decide whether `+` is live; the mutation site in
 * Game asks it again to decide whether to refuse. Two expressions of one rule
 * is two chances to drift, and the failure is silent: the `+` looks live, the
 * tap does nothing, and the player concludes the booster is broken.
 *
 * Callers pass the per-booster staged counts for STOCKABLE boosters only.
 * Permanent upgrades are owned outright, never occupy a slot, and are excluded
 * by the callers rather than filtered here — so a caller that forgets shows an
 * honest meter with a lying `+`.
 */
export function stagedSlots(stagedCounts: readonly number[]): number {
  return stagedCounts.reduce((sum, n) => sum + n, 0);
}

/** Slots left to fill. Never negative, so a caller can use it directly as the
 *  allowance without re-clamping. */
export function freeSlots(stagedCounts: readonly number[]): number {
  return Math.max(0, LOADOUT_MAX_BOOSTS - stagedSlots(stagedCounts));
}

/* -------------------------------------------------------------- bird ---- */

/** The owned birds, as a pickable row. Unowned ones are shown as a link to the
 *  shop rather than a dead row — a locked bird with no way forward is the
 *  "stranded CTA" problem this screen must not recreate. */
function birdRow(v: SkinView): string {
  const art = sunbirdSVG({ palette: skinPalette(v.def), shape: skinShape(v.def), width: 54, title: v.def.name });
  const state = v.equipped
    ? `<span class="tag on">${t("hud.loadout.InUse", undefined, "In use")} ✓</span>`
    : v.owned
      ? `<button class="mini-btn" data-ui data-action="loadout-bird" data-id="${v.def.id}" aria-pressed="false">${t("hud.loadout.Pick", undefined, "Pick")}</button>`
      : `<button class="mini-btn" data-ui data-action="open-shop" data-id="${v.def.id}">${t("hud.loadout.Get", undefined, "Get")} ● ${v.dealPrice ?? v.def.price}</button>`;
  return `<div class="pf-row pf-bird-row ${v.equipped ? "pf-on" : ""} ${v.owned ? "" : "pf-locked"}">
    <span class="li">${art}</span>
    <div class="lt"><b>${escapeHtml(v.def.name)}</b><span>${escapeHtml(v.def.perk ?? "")}</span></div>
    ${state}
  </div>`;
}

/* ------------------------------------------------------------- trail ---- */

function trailRow(v: ShopTrailView): string {
  // `def.css` is a list of colour STOPS, not a shorthand value. Writing them
  // straight into `background` produced `background:#a, #b, #c`, which is not a
  // valid declaration, so the browser dropped the whole thing and every trail
  // swatch on this screen rendered as an empty pill — `.pf-swatch` sets no
  // background of its own to fall back on. The shop's swatch wraps the same
  // list in a `linear-gradient()`; this now matches.
  const stops = v.def.css.join(", ");
  const state = v.equipped
    ? `<span class="tag on">${t("hud.loadout.InUse", undefined, "In use")} ✓</span>`
    : v.owned
      ? `<button class="mini-btn" data-ui data-action="loadout-trail" data-id="${v.def.id}" aria-pressed="false">${t("hud.loadout.Pick", undefined, "Pick")}</button>`
      : `<button class="mini-btn" data-ui data-action="loadout-buy-trail" data-id="${v.def.id}">● ${v.def.price}</button>`;
  return `<div class="pf-row pf-trail-row ${v.equipped ? "pf-on" : ""} ${v.owned ? "" : "pf-locked"}">
    <span class="li"><i class="pf-swatch" style="background:linear-gradient(90deg, ${stops})"></i></span>
    <div class="lt"><b>${escapeHtml(v.def.label)}</b><span>${escapeHtml(v.def.desc)}</span></div>
    ${state}
  </div>`;
}

/* ------------------------------------------------------------ boost ---- */

/**
 * One booster: what you own, what is staged, and the two buttons that move
 * copies between them.
 *
 * The `+`/`−` pair is the whole inventory UI. Both are always rendered, and
 * both are `disabled` when they would do nothing, so the control never
 * disappears on you mid-adjustment — a button that vanishes is how a player
 * ends up unsure whether the tap registered.
 */
function boostRow(v: BoostView, room: number, coins: number): string {
  const d = v.def;
  const price = v.dealPrice ?? d.price;
  const label = escapeHtml(d.name);
  const desc = escapeHtml(d.desc);

  if (d.permanent) {
    // Permanent upgrades are not stock. They are unlocked outright, so the
    // staged/spare controls would be a lie. Show the real state only.
    return `<div class="pf-row pf-boost ${v.armed ? "pf-on" : ""}">
      <span class="li">${menuIconSm(d.icon)}</span>
      <div class="lt"><b>${label}</b><span>${desc}</span></div>
      ${v.armed
        ? `<span class="tag on">${t("hud.loadout.Owned", undefined, "Owned")} ✓</span>`
        : v.affordable
          ? `<button class="mini-btn gold" data-ui data-action="buy-boost" data-id="${d.id}">● ${price}</button>`
          : `<span class="tag need">${t("hud.loadout.NeedCoins", undefined, "Need")} ${Math.max(0, price - coins)}●</span>`}
    </div>`;
  }

  const canAdd = v.spare > 0 && room > 0;
  const canDrop = v.armedCount > 0;

  // `pf-deal`, NOT the bare `deal`. `.deal` is an unscoped global in
  // menu-polish.css (`!important`) that paints a saturated red badge meant for a
  // small "SALE" pill. Putting it on a full row painted the row hot-orange with
  // badge padding/radius and dark-on-red unreadable text — the same class-name
  // collision that `.loadout-row`/`.boost-row` caused earlier. Namespaced here,
  // styled in the paper palette below.
  return `<div class="pf-row pf-boost ${v.armedCount ? "pf-on" : ""} ${v.dealPrice !== undefined ? "pf-deal" : ""}">
    <span class="li">${menuIconSm(d.icon)}</span>
    <div class="lt">
      <b>${label}</b>
      <span>${desc}</span>
      <span class="pf-stock" data-ref="pf-stock-${d.id}">
        <span class="pf-stock-count">${t("hud.loadout.Owned", undefined, "Owned")}: <b>${v.stocked}</b></span>
                <span class="pf-stock-count pf-stock-live">${t("hud.loadout.Staged", undefined, "Staged")}: <b>${v.armedCount}</b></span>
        ${v.spare > 0 ? `<span class="pf-stock-spare">+${v.spare} ${t("hud.loadout.Spare", undefined, "in store")}</span>` : ""}
      </span>
    </div>
    <span class="pf-actions">
      <button class="mini-btn step" data-ui data-action="loadout-boost-add" data-id="${d.id}" ${canAdd ? "" : "disabled"}
        aria-label="${t("hud.loadout.AddOne", undefined, "Stage one more")} ${label}">+</button>
      <button class="mini-btn step" data-ui data-action="loadout-boost-drop" data-id="${d.id}" ${canDrop ? "" : "disabled"}
        aria-label="${t("hud.loadout.DropOne", undefined, "Unstage one")} ${label}">−</button>
      <button class="mini-btn buy${v.dealPrice !== undefined ? " pf-deal-btn" : ""}" data-ui data-action="buy-boost" data-id="${d.id}" ${v.affordable ? "" : "disabled"}>
        ${v.dealPrice !== undefined ? `<s>●${d.price}</s> ` : ""}● ${price}</button>
    </span>
  </div>`;
}

/* ------------------------------------------------------------ screen ---- */

export function renderLoadout(
  s: Pick<HudSnapshot, "boosts" | "loadout" | "shopTrails" | "skins" | "wallet">,
): string {
  const loadout = s.loadout;
  // Permanent upgrades never occupy a slot, so they must not count toward the
  // cap or the meter would say "full" while three real slots sit empty.
  const staged = stagedSlots(s.boosts.filter((b) => !b.permanent).map((b) => b.armedCount));
  const room = freeSlots(s.boosts.filter((b) => !b.permanent).map((b) => b.armedCount));
  const slotsFull = room <= 0;
  const anyStock = s.boosts.some((b) => !b.permanent && b.stocked > 0);

  const ownedBirds = s.skins.filter((v) => v.owned);
  const unownedBirds = s.skins.filter((v) => !v.owned).slice(0, 6);
  const ownedTrails = s.shopTrails.filter((v) => v.owned);
  const unownedTrails = s.shopTrails.filter((v) => !v.owned).slice(0, 4);

  return `
    ${head(SCREEN.loadout, "back", `<span class="pill coin">● ${formatNumberLocalized(s.wallet)}</span>`)}

    <button class="primary-btn pf-fly-cta" data-ui data-action="pvp-practice">
      ${menuIcon("flight")} ${t("hud.loadout.FlyNow", undefined, "Fly now")}
      ${staged > 0 ? `<span class="pf-fly-badge">${staged} ${t("hud.loadout.BoostersBadge", undefined, "boosters")}</span>` : ""}
    </button>

    <section class="pf-summary" role="status">
      <div class="ls-row">
        <div class="ls-item">
          <em>${t("hud.loadout.Birds", undefined, "Your bird")}</em>
          <b>${escapeHtml(loadout.bird)}</b>
        </div>
        <div class="ls-item ls-trail">
          <em>${t("hud.loadout.Trails", undefined, "Trail")}</em>
          <span>${escapeHtml(loadout.trail)}</span>
        </div>
      </div>
      <div class="pf-meter${slotsFull ? " pf-meter--full" : ""}" role="img" aria-label="${t("hud.loadout.MeterLabel", undefined, "Boost slots used")} ${staged} / ${LOADOUT_MAX_BOOSTS}">
        ${Array.from({ length: LOADOUT_MAX_BOOSTS }, (_, i) => `<i class="${i < staged ? "pf-on" : ""}"></i>`).join("")}
      </div>
      <p class="pf-meter-label${slotsFull ? " pf-meter-label--full" : ""}">${slotsFull ? `<b>${t("hud.loadout.SlotsFull", undefined, "Loadout full!")}</b>` : `${staged} / ${LOADOUT_MAX_BOOSTS} ${t("hud.loadout.Slots", undefined, "boost slots used")}`}</p>
      <p class="fineprint">${t("hud.loadout.Note", undefined, "Boosters you own sit in the store until you stage them. Staged boosters are spent when you fly.")}</p>
    </section>

    ${sectionTitle("bird", t("hud.loadout.Birds", undefined, "Your bird"), String(ownedBirds.length))}
    <div class="pf-list">${ownedBirds.map(birdRow).join("")}</div>
    ${unownedBirds.length
      ? `<details class="pf-more">
          <summary>${t("hud.loadout.MoreBirds", undefined, "More birds in the shop")} (${unownedBirds.length})</summary>
          <div class="pf-list">${unownedBirds.map(birdRow).join("")}</div>
        </details>`
      : ""}

    ${sectionTitle("wind", t("hud.loadout.Trails", undefined, "Trail"), loadout.trail)}
    <div class="pf-list">${ownedTrails.map(trailRow).join("")}</div>
    ${unownedTrails.length
      ? `<details class="pf-more">
          <summary>${t("hud.loadout.MoreTrails", undefined, "Buy another trail")} (${unownedTrails.length})</summary>
          <div class="pf-list">${unownedTrails.map(trailRow).join("")}</div>
        </details>`
      : ""}

    ${sectionTitle(
      "rocket",
      t("hud.loadout.Boosters", undefined, "Boosters"),
      anyStock ? t("hud.loadout.InStore", undefined, "stocked") : t("hud.loadout.StoreEmpty", undefined, "store is empty"),
    )}
    <div class="pf-list">${s.boosts.filter((b) => !b.permanent).map((b) => boostRow(b, room, s.wallet)).join("")}</div>
    ${
      !anyStock
        ? `<p class="pf-empty">${t("hud.loadout.EmptyHelp", undefined, "You have no boosters in the store yet — buy one below and it stays yours until you stage it for a flight.")}</p>`
        : ""
    }
    ${
      slotsFull && anyStock
        ? `<p class="pf-warn">${t("hud.loadout.Full", undefined, "All slots full. Unstage one to swap boosters in.")}</p>`
        : ""
    }
    ${
      // Permanent upgrades get their own section rather than a row inside the
      // booster list. They ARE sellable boosters a player can otherwise only
      // find by hunting through the shop, so hiding them here would recreate the
      // exact gap this screen exists to close: something you can buy that you
      // cannot see where you buy. They carry no steppers — they are owned
      // outright — and they never occupy a slot.
      s.boosts.some((b) => b.permanent)
        ? `${sectionTitle("star", t("hud.loadout.Upgrades", undefined, "Upgrades"))}
           <div class="pf-list">${s.boosts.filter((b) => b.permanent).map((b) => boostRow(b, room, s.wallet)).join("")}</div>`
        : ""
    }
    <p class="fineprint">${t("hud.loadout.FairNote", undefined, "Boosters are kept out of live races and ranked practice so every pilot starts equal.")}</p>
    <button class="soft-btn wide" data-ui data-action="open-shop">${menuIcon("shop")} ${t("hud.loadout.FullShop", undefined, "Open the full shop")}</button>
  `;
}
