/**
 * The commerce screens: the hangar/shop, the coin store, and checkout.
 *
 * Pure string builders — `(snapshot) => html` — with no DOM access and no
 * knowledge of the controller. Everything here is a pure function of its
 * input, so a screen is testable by calling it and reading the string.
 */

import { formatNumberLocalized, t } from "../../i18n";
import { DAILY_STIPEND, SHOP_AD_COINS, SHOP_AD_SESSION_CAP } from "../constants";
import { COLLECTIONS, dailyFlashBird, GOLD, skinById, STARTER_PACK, VIP, type BoostView, type ShopTrailView, type SkinView } from "../Economy";
import { SELL_AD_REMOVAL } from "../edition";
import { menuHorizon, menuIcon } from "../MenuIcons";
import { browseSkins, type ShopBrowse } from "../ShopBrowse";
import { skinPalette, skinShape, sunbirdSVG } from "../Sunbird";
import { SCREEN, escapeHtml, head, sectionTitle, upsellStrip } from "./kit";
import type { HudSnapshot } from "./types";
function skinRarity(d: { goldOnly?: boolean; vipOnly?: boolean; prizeOnly?: string; price: number; rarity?: string }): { key: string; label: string } {
  if (d.prizeOnly) return { key: "prize", label: "PRIZE" };
  // Explicit rarity from the catalogue wins over inferred price bands.
  if (d.rarity && d.rarity !== "starter") return { key: d.rarity, label: d.rarity.toUpperCase() };
  if (d.vipOnly) return { key: "mythic", label: "MYTHIC" };
  if (d.goldOnly) return { key: "legendary", label: "LEGENDARY" };
  if (d.price >= 700) return { key: "epic", label: "EPIC" };
  if (d.price >= 400) return { key: "rare", label: "RARE" };
  if (d.price > 0) return { key: "common", label: "COMMON" };
  return { key: "starter", label: "STARTER" };
}

function skinStatBars(d: { speedMult: number; feverBonus: number; daylightBonus: number; magnetAlways: boolean }): string {
  const bars: [string, number, string][] = [
    ["Speed", Math.min(100, Math.round(((d.speedMult - 1) / 0.08) * 100)), `${d.speedMult > 1 ? "+" : ""}${Math.round((d.speedMult - 1) * 100)}%`],
    ["Fever", Math.min(100, Math.round((d.feverBonus / 5) * 100)), d.feverBonus > 0 ? `+${d.feverBonus}s` : "—"],
    ["Daylight", Math.min(100, Math.round((d.daylightBonus / 12) * 100)), d.daylightBonus > 0 ? `+${d.daylightBonus}s` : "—"],
  ];
  return `<div class="sk-stats">${bars
    .map(([k, pct, val]) => `<span class="sk-stat"><em>${k}</em><i><b style="width:${pct}%"></b></i><u>${val}</u></span>`)
    .join("")}${d.magnetAlways ? `<span class="sk-stat mag">🧲 always-on</span>` : ""}</div>`;
}

/** Group the 60+ bird wall into browsable collections with owned counters. */
function renderSkinCollections(s: HudSnapshot, browse: ShopBrowse): string {
  const matches = browseSkins(s.skins, browse);
  const filtered = browse.query.trim() !== "" || browse.filter !== "all";
  if (!matches.length) return `<div class="shop-empty">${menuIcon("compass")}<b>${t("hud.renderSkinCollections.NBirdsView", undefined, "No birds in this view")}</b><p>${t("hud.renderSkinCollections.TBirdNamePerkDifferentFilter", undefined, "Try a bird name, a perk, or a different filter.")}</p><button class="soft-btn" data-ui data-action="shop-clear">${t("hud.renderSkinCollections.SAllBirds", undefined, "Show all birds")}</button></div>`;
  const portal = s.portalName !== "none";
  const byId = new Map<string, SkinView[]>();
  for (const v of matches) {
    const cid = v.def.collection ?? "starter";
    if (!byId.has(cid)) byId.set(cid, []);
    byId.get(cid)!.push(v);
  }
  return COLLECTIONS.filter((c) => byId.has(c.id))
    .map((c) => {
      const skins = byId.get(c.id)!;
      const collection = s.skins.filter(v => (v.def.collection ?? "starter") === c.id);
      const got = collection.filter(v => v.owned).length;
      const complete = got === collection.length;
      const bonus = 100 + collection.length * 25;
      return `<details class="collection ${complete ? "complete" : ""}" data-ref="collection-${c.id}${filtered ? "-filtered" : ""}" ${filtered ? "open" : ""}>
        <summary class="coll-head"><span class="collection-art">${menuIcon(c.id === "tournament" ? "trophy" : c.id === "achievement" ? "medal" : c.id === "cosmic" ? "endless" : c.id === "premium" ? "rank" : c.id === "elements" ? "boost" : c.id === "nature" ? "atlas" : "bird")}</span><b>${c.name}</b>
        <span class="coll-count">${complete ? "✓ complete" : `${got}/${collection.length} · bonus ● ${bonus}`}</span></summary>
        <div class="skin-grid">${skins.map((v) => renderSkinCard(v, portal, browse.preview, s.wallet)).join("")}</div>
      </details>`;
    })
    .join("");
}

export function skinAction(v: SkinView, portal: boolean, wallet: number): string {
  const d = v.def;
  const price = v.dealPrice ?? d.price;
  const priceLabel = v.dealPrice !== undefined ? `<s>● ${d.price}</s> ● ${price}` : `● ${price}`;
  let action: string;
  if (v.equipped) action = `<span class="tag on">✓ In use</span>`;
  else if (v.owned) action = `<button class="mini-btn" data-ui data-action="equip-skin" data-id="${d.id}">Equip</button>`;
  else if (d.prizeOnly) action = `<span class="tag prize" title="${d.prizeOnly}">🏆 ${d.prizeOnly}</span>`;
  else if (v.locked && portal)
    // A Gold-locked variant must not become a paywall on the portal build.
    // Selling premium currency is forbidden there (Poki REQ-20) and the portal
    // carries no Gold checkout, so a button here would be an offer the portal
    // edition cannot honour — the same defect REQ-31 covers for the break
    // overlay. It is named as a perk instead, so the row still says why the
    // item is locked rather than hiding behind a dead end.
    action =
      v.lockReason === "gold"
        ? `<span class="tag portal-lock">${t("hud.skinAction.GPerk", undefined, "Gold perk")}</span>`
        : `<span class="tag portal-lock">♛ VIP — not on this build</span>`;
  else if (v.locked && SELL_AD_REMOVAL)
    action = `<button class="mini-btn ${v.lockReason === "vip" ? "vip" : "gold"}" data-ui data-action="open-paywall">${v.lockReason === "vip" ? "♛ VIP" : "✦ Gold"}</button>`;
  else if (v.locked)
    action = `<span class="tag portal-lock">${t("hud.skinAction.GPerk", undefined, "Gold perk")}</span>`;
  else
    action = `<button class="mini-btn ${v.affordable ? (v.dealPrice !== undefined ? "gold" : "") : "off"}" data-ui data-action="buy-skin" data-id="${d.id}" ${v.affordable ? "" : "disabled"} aria-label="${v.affordable ? `Buy ${d.name} for ${price} coins` : `${d.name} costs ${price} coins; earn more coins to unlock`}">${priceLabel}</button>`;
  return action + (!v.owned && !v.locked && !d.prizeOnly && !v.affordable ? `<small class="purchase-shortfall">${Math.max(0, price - wallet)} more coins</small>` : "");
}

function renderSkinCard(v: SkinView, portal: boolean, preview: string, wallet: number): string {
  const d = v.def, rarity = skinRarity(d);
  // Species and colour together, and a real wingbeat. This card is the product
  // shot: it was 88px, static, and one silhouette for all sixty-nine birds, so
  // the shop read as a colour chart. Bigger, alive, and drawn as the species it
  // sells.
  const birdSvg = sunbirdSVG({ palette: skinPalette(d), shape: skinShape(d), width: 104, animateWings: true, title: d.name });
  const dealTag = v.dealPrice !== undefined && !v.owned ? `<span class="deal-tag">TODAY −40%</span>` : "";
  return `<div class="skin-card r-${rarity.key} ${v.equipped ? "equipped" : ""} ${v.owned ? "owned" : ""} ${v.dealPrice !== undefined ? "deal" : ""}" data-skin="${d.id}">
    <span class="rarity">${rarity.label}</span>
    ${dealTag}
    <button class="skin-bird skin-preview" data-ui data-action="preview-skin" data-id="${d.id}" aria-label="Preview ${d.name}" aria-pressed="${preview === d.id}">${birdSvg}<span>Preview</span></button>
    <div class="sk-name">${d.name}</div><div class="sk-perk">${d.perk}</div>${skinStatBars(d)}${skinAction(v, portal, wallet)}</div>`;
}

function renderBoostRow(v: BoostView, wallet: number): string {
  const d = v.def;
  const price = v.dealPrice ?? d.price;
  const missing = Math.max(0, price - wallet);
  const priceLabel = v.dealPrice !== undefined ? `<s>● ${d.price}</s> ● ${price}` : `● ${price}`;
  const action = v.armed
    ? `<span class="tag on">${d.permanent ? "Unlocked ✓" : "Armed ✓"}</span>`
    : v.affordable
      ? `<button class="mini-btn ${v.dealPrice !== undefined ? "gold" : ""}" data-ui data-action="buy-boost" data-id="${d.id}">${priceLabel}</button>`
      : `<span class="tag need">Need ${missing}●</span>`;
  const dealTag = v.dealPrice !== undefined && !v.armed ? `<span class="deal-tag">TODAY −50%</span>` : "";
  return `<div class="boost-row ${v.armed ? "armed" : ""} ${v.dealPrice !== undefined ? "deal" : ""}"><span class="bi">${menuIcon("boost")}</span><div><div class="mt"><b class="boost-name">${escapeHtml(d.name)}</b>${d.permanent ? `<span class="boost-once">permanent</span>` : `<span class="boost-once">one flight</span>`}${dealTag}</div><div class="md">${d.desc}</div></div>${action}</div>`;
}

function renderTrailCard(v: ShopTrailView, wallet: number): string {
  const d = v.def;
  const stops = d.css.join(", ");
  const missing = Math.max(0, d.price - wallet);
  const action = v.equipped
    ? `<span class="tag on">✓ In use</span>`
    : v.owned
      ? `<button class="mini-btn" data-ui data-action="buy-trail" data-id="${d.id}">Equip</button>`
      : v.affordable
        ? `<button class="mini-btn" data-ui data-action="buy-trail" data-id="${d.id}">● ${d.price}</button>`
        : `<span class="tag need">Need ${missing}●</span>`;
  return `<div class="trail-card ${v.equipped ? "equipped" : ""}">
    <span class="trail-swatch" style="background:linear-gradient(90deg, ${stops})"></span>
    <div class="trail-body"><b>${d.label}</b><em>${d.desc}</em></div>${action}</div>`;
}

export function renderShop(s: HudSnapshot, browse: ShopBrowse): string {
  const owned = s.skins.filter((v) => v.owned).length;
  const armedBoosts = s.boosts.filter((b) => b.armed);
  const equippedSkin = s.skins.find(v => v.def.id === browse.preview) ?? s.skins.find(v => v.equipped);
  const matches = browseSkins(s.skins, browse).length;
  const heroSvg = equippedSkin
    ? sunbirdSVG({ palette: skinPalette(equippedSkin.def), shape: skinShape(equippedSkin.def), width: 168, animateWings: true, title: equippedSkin.def.name })
    : sunbirdSVG({ width: 128, animateWings: true, title: "Sunbird" });

  const flash = s.dailyFlash ?? dailyFlashBird("today");
  const flashDef = skinById(flash.id);
  const flashView = s.skins.find(v => v.def.id === flash.id);
  const flashOwned = flashView?.owned ?? false;
  const flashSvg = sunbirdSVG({ palette: skinPalette(flashDef), shape: skinShape(flashDef), width: 104, animateWings: true, title: flashDef.name });

  const filters = [
    ["all", "All birds"],
    ["affordable", "Can unlock"],
    ["owned", "Owned"],
    ["nature", "Nature 🌿"],
    ["cosmic", "Cosmic 🌌"],
    ["elements", "Elements 🌪"],
    ["legendary", "Legendary ★"],
  ] as const;

  return `
    ${head(SCREEN.shop, "back", `<span class="pill coin">● ${formatNumberLocalized(s.wallet)}</span>`)}
    <p class="shop-intro">${t("hud.renderShop.H", undefined, "YOUR HANGAR ")}<span>${t("hud.renderShop.FWingsMakeThemYours", undefined, "Find your wings. Make them yours.")}</span></p>

    <div class="pc pc--gold pc-row">
      <span class="pc-icon">🪙</span>
      <div class="pc-body">
        <b>${t("hud.renderShop.DFlightStipend", undefined, "Daily Flight Stipend")}</b>
        <span>Daily test &amp; hangar allowance</span>
      </div>
      ${s.stipendClaimed
        ? `<span class="tag on">Claimed Today ✓</span>`
        : `<button class="primary-btn gold" data-ui data-action="claim-daily-stipend">Claim +● ${DAILY_STIPEND}</button>`
      }
    </div>
    ${s.adAvailable ? `
    <div class="pc pc--gold pc-row">
      <span class="pc-icon">📺</span>
      <div class="pc-body">
        <b>${t("hud.renderShop.FCoins", undefined, "Free Coins")}</b>
        <span>Watch a short ad · +● ${SHOP_AD_COINS} (max ${SHOP_AD_SESSION_CAP}/hour)</span>
      </div>
      <button class="primary-btn gold" data-ui data-action="shop-free-coins">${t("hud.renderShop.WAd", undefined, "Watch Ad")}</button>
    </div>` : ""}

    <div class="pc pc--red">
      <div class="pc-header">
        <span class="pc-badge">🔥 DAILY FLASH SALE · 40% OFF</span>
        <span class="pc-label" style="color:#c62828;">${t("hud.renderShop.RMidnight", undefined, "Resets at Midnight")}</span>
      </div>
      <div class="pc-row">
        <div class="pc-preview">${flashSvg}</div>
        <div class="pc-body">
          <b>${flashDef.name}</b>
          <span>${flashDef.perk}</span>
          <div class="pc-price">
            <s>● ${flashDef.price}</s>
            <b>● ${flash.price}</b>
          </div>
        </div>
        <div class="pc-action">
          ${flashOwned
            ? `<span class="tag on">Owned ✓</span>`
            : s.wallet >= flash.price
              ? `<button class="primary-btn gold" data-ui data-action="buy-skin" data-id="${flashDef.id}">Unlock · ● ${flash.price}</button>`
              : `<span class="tag need">Need ● ${flash.price - s.wallet}</span>`
          }
          <button class="mini-btn" data-ui data-action="preview-skin" data-id="${flashDef.id}">Preview</button>
        </div>
      </div>
    </div>

    <div class="shop-hero">
      ${menuHorizon()}
      <div class="shop-hero-bird">${heroSvg}</div>
      <div class="shop-hero-info">
        <small class="shop-preview-label">${equippedSkin?.equipped ? "YOUR EQUIPPED BIRD" : "BIRD PREVIEW · NOT EQUIPPED"}</small>
        <div class="shop-hero-name" tabindex="-1">${equippedSkin ? equippedSkin.def.name : "Sunbird"}</div>
        <div class="shop-hero-perk">${equippedSkin ? equippedSkin.def.perk : "The original. Fast, honest, unstoppable."}</div>
        ${equippedSkin ? `<div class="shop-preview-action">${skinAction(equippedSkin, s.portalName !== "none", s.wallet)}</div>` : ""}
      </div>
    </div>
    <p class="shop-rules">Bird perks are for solo play. Live races use equal flight equipment; your appearance stays yours.</p>

    <div class="pc pc--blue">
      <div class="pc-header">
        <span class="pc-badge">📦 ACE PILOT CRATE · SAVE 73%</span>
        <span class="pc-label">${t("hud.renderShop.VPack", undefined, "Value Pack")}</span>
      </div>
      <div class="pc-row" style="margin-bottom:10px;">
        <span class="pc-icon">✈️</span>
        <div class="pc-body">
          <b>${t("hud.renderShop.AWingmanBundle", undefined, "Ace Wingman Bundle")}</b>
          <span>3 Boosts · Tideglass Trail · +${DAILY_STIPEND} Coins</span>
        </div>
      </div>
      ${s.wingmanBundle
        ? `<span class="pc-claimed" style="justify-content:center;">✓ Unlocked</span>`
        : s.wallet >= 240
          ? `<button class="primary-btn gold wide" data-ui data-action="buy-bundle" data-id="wingman">Claim · ● 240</button>`
          : `<button class="primary-btn gold wide" data-ui data-action="buy-bundle" data-id="wingman" disabled>Need ● ${240 - s.wallet} more</button>`
      }
    </div>

    <div class="pc pc--vault pc-row">
      <span class="pc-icon">🥚</span>
      <div class="pc-body">
        <b>${t("hud.renderShop.GMysteryVault", undefined, "Golden Mystery Vault")}</b>
        <span>35% Bird Skin · 35% Radiant Trail · 30% Coin Jackpot</span>
      </div>
      ${s.wallet >= 150
        ? `<button class="primary-btn gold" data-ui data-action="buy-vault">Open · ● 150</button>`
        : `<span class="tag need">Need ● ${150 - s.wallet}</span>`
      }
    </div>

    <div class="section-title shop-catalog-divider">${t("hud.renderShop.BCatalog", undefined, "Browse catalog ")}<small>${t("hud.renderShop.BBoostsTrails", undefined, "Birds · Boosts · Trails")}</small></div>
    <nav class="shop-jumps" aria-label="${t("hud.renderPaywall.SSections", undefined, "Shop sections")}">${[["shopBirds", "bird", "Birds"], ["shopBoosts", "boost", "Boosts"], ["shopTrails", "trail", "Trails"]].map(([id, icon, label]) => `<button class="soft-btn" data-ui data-action="shop-section" data-id="${id}">${menuIcon(icon as "bird" | "boost" | "trail")}<span>${label}</span></button>`).join("")}</nav>

    <section class="shop-browser" data-ref="shopBirds" aria-label="Browse birds">
      <div class="section-title shop-section-birds">${t("hud.renderShop.BCollection", undefined, "Bird collection ")}<small>${owned}/${s.skins.length} owned</small></div>
      <label class="field-label" for="shop-search">${t("hud.renderShop.FBird", undefined, "Find a bird")}</label>
      <input id="shop-search" type="search" data-ui data-ref="shopSearch" value="${escapeHtml(browse.query)}" placeholder="Name, collection or perk" maxlength="80" autocomplete="off" />
      <div class="shop-filters" role="group" aria-label="${t("hud.vipBlock.FBirds", undefined, "Filter birds")}">${filters.map(([id, label]) => `<button class="mini-btn ${browse.filter === id ? "gold" : ""}" data-ui data-action="shop-filter" data-id="${id}" aria-pressed="${browse.filter === id}">${label}</button>`).join("")}</div>
      <p class="shop-match-count" role="status">${matches} ${matches === 1 ? "bird" : "birds"} shown${browse.filter === "affordable" ? " · unowned, purchasable with your coins" : ""}</p>
      ${renderSkinCollections(s, browse)}
    </section>

    <details class="shop-section" data-ref="shopBoosts"><summary><span class="section-art">${menuIcon("boost")}</span>Boosts &amp; upgrades <span>${armedBoosts.length} armed</span></summary>
      <p class="fineprint">One-flight boosts are used in solo or casual AI flights. Live races and ranked practice use equal flight equipment and keep these boosts for later. Permanent upgrades stay with you.</p>
      <div class="boost-list">${s.boosts.map((b) => renderBoostRow(b, s.wallet)).join("")}</div>
      ${sectionTitle("Nest", "permanent score multiplier")}
      <div class="boost-list"><div class="boost-row nest-row">
        <span class="bi">${menuIcon("story")}</span>
        <div><div class="mt">${t("hud.renderShop.NUpgrade", undefined, "Nest upgrade ")}<span class="boost-once">forever</span></div>
        <div class="md">Lv.${s.nestLevel} · ×${s.nestMult.toFixed(2)} score${s.nestMaxed ? " · fully upgraded" : ` · next ×${(s.nestMult + 0.12).toFixed(2)}`}</div></div>
        ${
          s.nestMaxed
            ? `<span class="tag on">MAX ✓</span>`
            : s.wallet >= s.nestPrice
              ? `<button class="mini-btn gold" data-ui data-action="buy-nest">● ${s.nestPrice}</button>`
              : `<span class="tag need">Need ${s.nestPrice - s.wallet}●</span>`
        }
      </div></div>
    </details>

    <details class="shop-section" data-ref="shopTrails"><summary><span class="section-art">${menuIcon("trail")}</span>Trails <span>${t("hud.renderShop.CYoursForever", undefined, "Cosmetic · yours forever")}</span></summary>
      <div class="trail-list">${s.shopTrails.map((t) => renderTrailCard(t, s.wallet)).join("")}</div>
    </details>

    ${s.portalName === "none" && !(s.gold && s.vip) ? upsellStrip() : ""}
    <p class="fineprint">${t("hud.renderShop.ECoinsByFlyingDailyQuestsStreaksNestPass", undefined, "Earn coins by flying, daily quests, streaks and the Nest Pass.")}</p>
  `;
}

export function renderPaywall(s: HudSnapshot): string {
  const starter = !s.starterOwned
    ? `
    <div class="starter-card">
      <div class="starter-flag">${t("hud.renderPaywall.OTIMEOFFER", undefined, "ONE-TIME OFFER")}</div>
      <h3>🎁 First Flight Pack · ${STARTER_PACK.price}</h3>
      <ul class="feature-list tight">${s.starterFeatures.map((f) => `<li>${f}</li>`).join("")}</ul>
      ${
        s.wallet >= STARTER_PACK.coinPrice
          ? `<button class="primary-btn starter" data-ui data-action="starter-buy">Claim Pack · ${STARTER_PACK.price}</button>`
          : `<button class="primary-btn starter off" data-ui data-action="starter-buy">Need ● ${STARTER_PACK.coinPrice - s.wallet} more coins</button>`
      }
    </div>`
    : "";
  return `
    ${head(SCREEN.coinStore)}
    <div class="wallet-row" style="margin-bottom:12px"><span class="pill coin">Your Balance: ● ${formatNumberLocalized(s.wallet)}</span></div>
    ${starter}
    <div class="gold-hero"><div class="gold-badge">✦</div><div class="gold-price">${GOLD.price}<small> lifetime</small></div></div>
    <ul class="feature-list">${s.goldFeatures.map((f) => `<li>${f}</li>`).join("")}</ul>
    ${
      s.gold
        ? `<div class="owned-banner">You own Sunbird Gold ✦</div>`
        : s.wallet >= GOLD.coinPrice
          ? `<button class="primary-btn gold" data-ui data-action="gold-buy">Unlock Gold · ${GOLD.price}</button>`
          : `<button class="primary-btn gold off" data-ui data-action="gold-buy">Need ● ${GOLD.coinPrice - s.wallet} more coins</button>`
    }
    ${SELL_AD_REMOVAL ? `${vipBlock(s)}` : `<p class="fineprint">♛ VIP is not sold on this build.</p>`}
    <div class="redeem"><input data-ui aria-label="${t("hud.renderSettings.PCode", undefined, "Promo code")}" placeholder="Promo code" maxlength="16" autocomplete="off" /><button class="mini-btn" data-ui data-action="redeem">Redeem</button></div>
    <button class="ghost-btn" data-ui data-action="restore">${t("hud.renderPaywall.RPasses", undefined, "Restore passes")}</button>
    ${s.restoreMessage ? `<p class="note">${s.restoreMessage}</p>` : ""}
    <p class="fineprint">All passes &amp; packs are earnable 100% through in-game flight coins!</p>
  `;
}

/**
 * The VIP upsell. Never rendered on a build that cannot sell it — it used to
 * render a fully-styled primary button and a six-bullet feature list, then
 * toast "not available on this build" when tapped, which is worse than saying
 * nothing at all.
 */
function vipBlock(s: HudSnapshot): string {
  return `<div class="gold-hero vip"><div class="gold-badge vip">♛</div><div class="gold-price">${VIP.price}<small> 30 days</small></div></div>
    <ul class="feature-list">${s.vipFeatures.map((f) => `<li>${f}</li>`).join("")}</ul>
    ${
      s.vip
        ? `<div class="owned-banner vip">VIP active — ${s.vipDaysLeft} day${s.vipDaysLeft === 1 ? "" : "s"} left</div>
           ${s.wallet >= VIP.coinPrice
             ? `<button class="soft-btn wide vip" data-ui data-action="vip-buy">Extend 30 Days · ${VIP.price}</button>`
             : `<p class="fineprint">Need ● ${VIP.coinPrice - s.wallet} more coins to extend.</p>`}`
        : s.wallet >= VIP.coinPrice
          ? `<button class="primary-btn vip" data-ui data-action="vip-buy">Unlock VIP · ${VIP.price}</button>`
          : `<button class="primary-btn vip off" data-ui data-action="vip-buy">Need ● ${VIP.coinPrice - s.wallet} more coins</button>`
    }`;
}

export function renderCheckout(s: HudSnapshot): string {
  if (s.checkoutOk) {
    const okLabel = s.checkoutSku === "sunbird_vip" ? "VIP" : s.checkoutSku === "sunbird_starter" ? "ready for takeoff" : "Gold";
    return `<div class="check-ok"><div class="gold-badge big">${s.checkoutSku === "sunbird_vip" ? "♛" : s.checkoutSku === "sunbird_starter" ? "🎁" : "✦"}</div><h2>You're ${okLabel}!</h2><p class="tagline">${t("hud.renderCheckout.PAreActiveImmediately", undefined, "Your perks are active immediately")}</p><button class="primary-btn gold" data-ui data-action="back">Fly on</button></div>`;
  }
  const item =
    s.checkoutSku === "sunbird_vip"
      ? { name: "Sunbird VIP", price: VIP.price, coinPrice: VIP.coinPrice, action: "vip-buy" }
      : s.checkoutSku === "sunbird_starter"
        ? { name: "First Flight Pack", price: STARTER_PACK.price, coinPrice: STARTER_PACK.coinPrice, action: "starter-buy" }
        : { name: "Sunbird Gold Pass", price: GOLD.price, coinPrice: GOLD.coinPrice, action: "gold-buy" };

  const canAfford = s.wallet >= item.coinPrice;
  return `
    ${head(SCREEN.confirmUnlock, "checkout-cancel")}
    <div class="sheet">
      <div class="sheet-row"><span>${item.name}</span><b>${item.price}</b></div>
      <p class="tagline">Wallet: ● ${formatNumberLocalized(s.wallet)}</p>
      ${
        canAfford
          ? `<button class="primary-btn gold" data-ui data-action="${item.action}">Confirm Unlock · ${item.price}</button>`
          : `<p class="error">Need ● ${item.coinPrice - s.wallet} more coins to unlock.</p>
             <button class="primary-btn" data-ui data-action="pvp-practice">Fly &amp; Earn Coins</button>`
      }
    </div>
  `;
}