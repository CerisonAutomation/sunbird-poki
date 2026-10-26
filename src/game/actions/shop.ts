import { DAILY_STIPEND, SHOP_AD_SESSION_CAP } from "../constants";
import { SELL_AD_REMOVAL } from "../edition";
import { iconGlyph } from "../MenuIcons";
import type { GameAudio } from "../Audio";
import type { Bird } from "../Bird";
import type { HUD } from "../HUD";
import type { ParticleFX } from "../ParticleFX";
import type { SaveData } from "../SaveData";
import type { Telemetry } from "../Telemetry";
import type { UiScreen } from "../hud/types";
import type { PlatformAdapter } from "../../sdk/platform";

/**
 * The shop's action table.
 *
 * `Game.handleShopEvent` was 121 lines of `switch` living inside a class with
 * 182 methods. Pulling it out behind a port buys three things the god-object
 * could not: the dependency list is now the interface below, so it is greppable
 * and the compiler checks it; the action table is a plain function, so it can
 * be unit-tested with a fake context instead of a live `Game`; and the
 * commerce rules are readable without scrolling past the frame loop.
 *
 * Members are `readonly` because this table *routes* — every mutation belongs
 * to the subsystem it names (`ctx.save`, `ctx.audio`). Nothing here is
 * allowed to reach past them and poke at the rest of `Game`, which is the
 * property that keeps this a port rather than a second god-object.
 */
export interface ShopActionContext {
  readonly save: SaveData;
  readonly hud: HUD;
  readonly audio: GameAudio;
  readonly particles: ParticleFX;
  readonly bird: Bird;
  readonly telemetry: Telemetry;
  readonly platform: PlatformAdapter | null;
  readonly shopAdClaimed: number;
  readonly checkoutBusy: boolean;
  adsLive(): boolean;
  multiplyCoinsFromShopAd(): Promise<void>;
  setScreen(screen: UiScreen): void;
  backScreen(): void;
  bump(): void;
  buySkin(id: string): void;
  buyBoost(id: string): void;
  buyTrail(id: string): void;
  /** Stage copies into the next flight's loadout. Returns how many moved.
   *  The host owns the slot cap, so the rule lives in one place and the UI
   *  merely reflects it. */
  armBoost(id: string, n: number): number;
  /** Move staged copies back into storage. Returns how many moved. */
  unarmBoost(id: string, n: number): number;
  buyCoinStarter(): void;
  buyCoinGold(): void;
  buyPortalVip(): void;
  buyMysteryVault(): void;
  applySkin(): void;
  restore(): void;
  redeem(): void;
  redeemReferral(): void;
  importCloud(): void;
  copyWithFeedback(text: string, copiedToast: string): Promise<void>;
}

/**
 * Route a shop action. Returns true when the table consumed it, which is the
 * contract `handleAction` dispatches on.
 */
export function shopAction(ctx: ShopActionContext, action: string, id: string): boolean {

    switch (action) {
      case "open-shop":
        if (!ctx.save.state.seenShop) {
          ctx.save.state.seenShop = true;
          ctx.save.persist();
          ctx.telemetry.track("onboarding_shop_opened", { runs: ctx.save.state.runsPlayed });
          ctx.hud.toast("Shop: birds change your stats, boosts give you powers, trails look great — boosts from 40 coins, birds from 150", "gold", "shop");
          ctx.platform?.measure("milestone", "first-shop", "reached");
        }
        ctx.platform?.measure("button", "shop", "interact");
        ctx.setScreen("shop");
        return true;
      case "shop-free-coins": {
        // Rewarded ad from the shop: capped per session to prevent ad farming.
        // The card is hidden without a live ad surface (HUD: `adAvailable`), so
        // this is the second half of the same gate.
        if (!ctx.adsLive()) return true;
        if (ctx.shopAdClaimed >= SHOP_AD_SESSION_CAP) {
          ctx.hud.toast("Free coin rewards capped for this hour", "info");
          return true;
        };
        void ctx.multiplyCoinsFromShopAd();
        return true;
      }
      case "buy-bundle": {
        // One crate per save. It pays 250 coins for 240 — re-claimable it is
        // an infinite +10/click coin faucet.
        if (ctx.save.state.wingmanBundle) return true;
        if (!ctx.save.spend(240)) {
          ctx.hud.toast("Need ● 240 coins to claim Ace Wingman Crate", "warn");
          return true;
        }
        ctx.save.state.wingmanBundle = true;
        ctx.save.persist();
        ctx.save.armBoost("shield");
        ctx.save.armBoost("sunflask");
        ctx.save.armBoost("magnet");
        ctx.save.ownTrail("trail_tide");
        ctx.save.equipTrail("trail_tide");
        ctx.save.addCoins(DAILY_STIPEND);
        ctx.audio.chapterFanfare();
        ctx.particles.emitConfetti(ctx.bird.x, ctx.bird.y + 3);
        ctx.hud.toast(`${iconGlyph("badge")} Ace Wingman Crate Unlocked! 3 Boosts + Tideglass Trail + ${DAILY_STIPEND} Coins!`, "gold");
        ctx.bump();
        return true;
      }
      case "buy-nest": {
        const price = ctx.save.nestUpgradePrice();
        if (ctx.save.buyNestUpgrade()) {
          ctx.audio.fanfare();
          ctx.hud.toast(`Nest upgraded → ×${ctx.save.nestMultiplier().toFixed(2)} score forever`, "gold");
        } else {
          ctx.hud.toast(ctx.save.state.nestBought >= 10 ? "Nest is fully upgraded" : `Need ● ${price}`, "info");
        }
        ctx.bump();
        return true;
      }
      case "buy-skin":
        ctx.buySkin(id);
        return true;
      // `select-skin` is the whole CARD and `equip-skin` is its little button:
      // one intent, so they share a body. They stay separate strings because
      // `MenuContinuity` keys focus restore on (data-action, data-id) — a
      // duplicate pair on the same card would make the wrapper match first and
      // swallow the focus a keyboard user had on the button.
      case "equip-skin":
      case "select-skin":
        // Re-check ownership here rather than trusting the button. `equipSkin`
        // already refuses an unowned id, but the table then went on to apply the
        // skin, ding and repaint — announcing a selection the save did not
        // make. Same rule as `loadout-trail` and `select-trail` below.
        if (!ctx.save.state.ownedSkins.includes(id)) return true;
        ctx.save.equipSkin(id);
        ctx.applySkin();
        ctx.audio.ding();
        ctx.platform?.measure("cosmetic", id ?? "skin", "interact");
        ctx.bump();
        return true;
      // The shop's owned-trail CTA reads "Equip", so it must equip. It used to
      // fire `buy-trail`, which TOGGLES for an already-owned trail (Game.buyTrail
      // treats it as a re-buy): the second tap turned the ribbon off while the
      // button still said "Equip", so a trail looked like it refused to stick.
      // Distinct from `equip-trail`, which is Game's toggle on the prize-trails
      // screen and must keep toggling.
      case "select-trail":
        if (!ctx.save.state.tournaments.trails.includes(id)) return true;
        ctx.save.equipTrail(id);
        ctx.audio.ding();
        ctx.bump();
        return true;
      // ---- pre-flight loadout -------------------------------------------
      // Staging is a MOVEMENT between storage and the next flight's loadout,
      // never a purchase. Both directions are re-checked here rather than
      // trusting the button, for the same reason the squad quest payout is:
      // the UI is a view, not the guard.
      case "open-loadout":
        if (!ctx.save.state.seenLoadout) {
          ctx.save.state.seenLoadout = true;
          ctx.save.persist();
        }
        ctx.setScreen("loadout");
        return true;
      case "loadout-bird":
        if (!ctx.save.state.ownedSkins.includes(id)) return true;
        ctx.save.equipSkin(id);
        ctx.applySkin();
        ctx.audio.ding();
        ctx.platform?.measure("cosmetic", id ?? "bird", "interact");
        ctx.bump();
        return true;
      case "loadout-trail":
        if (!ctx.save.state.tournaments.trails.includes(id)) return true;
        ctx.save.equipTrail(id);
        ctx.audio.ding();
        ctx.bump();
        return true;
      case "loadout-buy-trail":
        ctx.buyTrail(id);
        return true;
      case "loadout-boost-add":
        if (ctx.armBoost(id, 1) > 0) {
          ctx.audio.ding();
          ctx.bump();
        }
        return true;
      case "loadout-boost-drop":
        if (ctx.unarmBoost(id, 1) > 0) {
          ctx.audio.ding();
          ctx.bump();
        }
        return true;
      case "buy-boost":
        ctx.buyBoost(id);
        return true;
      case "buy-trail":
        ctx.buyTrail(id);
        return true;
      case "starter-buy":
        ctx.buyCoinStarter();
        return true;
      case "gold-buy":
        ctx.buyCoinGold();
        return true;
      case "vip-buy":
        // Never silently nothing. VIP has no purchase on a build that removes
        // the ad break, so say so; the button used to re-render identically.
        if (SELL_AD_REMOVAL) ctx.buyPortalVip();
        else ctx.hud.toast("VIP is not available on this build", "warn");
        return true;
      case "buy-vault":
        ctx.buyMysteryVault();
        return true;
      case "checkout-cancel":
        if (!ctx.checkoutBusy) ctx.backScreen();
        return true;
      case "restore":
        ctx.restore();
        return true;
      case "redeem":
        ctx.redeem();
        return true;
      case "copy-referral":
        void ctx.copyWithFeedback(ctx.save.state.referralCode, "Code copied");
        return true;
      case "redeem-referral":
        ctx.redeemReferral();
        return true;
      case "copy-cloud":
        void ctx.copyWithFeedback(ctx.save.exportCode(), "Save code copied");
        return true;
      case "import-cloud":
        ctx.importCloud();
        return true;
      default:
        return false;
    }
}
