import { describe, expect, it } from "vitest";
import { shopAction, type ShopActionContext } from "../actions/shop";
import { SHOP_AD_SESSION_CAP } from "../constants";
import { SaveData } from "../SaveData";
import type { GameAudio } from "../Audio";
import type { Bird } from "../Bird";
import type { HUD } from "../HUD";
import type { ParticleFX } from "../ParticleFX";
import type { Telemetry } from "../Telemetry";

/**
 * The shop action table, exercised without a Game.
 *
 * This file is the reason the table was pulled out from behind 182 methods of
 * god-object: before, every one of these assertions required booting the whole
 * game to reach a single `case`. The port is narrow enough to fake, and the
 * branches covered here are the expensive ones — they are the guards that stop
 * an exploit or ship a button that silently does nothing.
 */

interface Recorded {
  toasts: string[];
  tracked: string[];
  calls: string[];
}

function recorder(): Recorded {
  return { toasts: [], tracked: [], calls: [] };
}

function context(save: SaveData, rec: Recorded, over: Partial<ShopActionContext> = {}): ShopActionContext {
  return {
    save,
    hud: { toast: (message: string) => rec.toasts.push(message) } as unknown as HUD,
    audio: {
      chapterFanfare() {},
      fanfare() {},
      ding() {},
    } as unknown as GameAudio,
    particles: { emitConfetti() {} } as unknown as ParticleFX,
    bird: { x: 0, y: 0 } as unknown as Bird,
    telemetry: { track: (event: string) => rec.tracked.push(event) } as unknown as Telemetry,
    platform: null,
    shopAdClaimed: 0,
    checkoutBusy: false,
    adsLive: () => true,
    multiplyCoinsFromShopAd: async () => {
      rec.calls.push("shopAd");
    },
    setScreen: (screen) => rec.calls.push("screen:" + screen),
    backScreen: () => rec.calls.push("back"),
    bump: () => rec.calls.push("bump"),
    buySkin: () => rec.calls.push("buySkin"),
    buyBoost: () => rec.calls.push("buyBoost"),
    buyTrail: () => rec.calls.push("buyTrail"),
    // The loadout's staging moves go through the real save so a test can see
    // stock actually change; a recorder stub would let a broken inventory
    // pass as a working one.
    armBoost: (id, n) => save.armBoost(id, n),
    unarmBoost: (id, n) => save.unarmBoost(id, n),
    buyCoinStarter: () => rec.calls.push("buyCoinStarter"),
    buyCoinGold: () => rec.calls.push("buyCoinGold"),
    buyPortalVip: () => rec.calls.push("buyPortalVip"),
    buyMysteryVault: () => rec.calls.push("buyMysteryVault"),
    applySkin: () => rec.calls.push("applySkin"),
    restore: () => rec.calls.push("restore"),
    redeem: () => rec.calls.push("redeem"),
    redeemReferral: () => rec.calls.push("redeemReferral"),
    importCloud: () => rec.calls.push("importCloud"),
    copyWithFeedback: async () => {
      rec.calls.push("copy");
    },
    ...over,
  };
}

describe("shop action table", () => {
  it("consumes only the actions it owns", () => {
    const save = new SaveData();
    const rec = recorder();
    expect(shopAction(context(save, rec), "not-a-shop-action", "")).toBe(false);
    // handleAction relies on the return value to decide whether to keep looking,
    // so a known action must always report as consumed.
    expect(shopAction(context(save, rec), "open-shop", "")).toBe(true);
  });

  it("sells the Ace Wingman Crate exactly once per save", () => {
    const save = new SaveData();
    save.addCoins(1000);
    const rec = recorder();
    const ctx = context(save, rec);

    expect(shopAction(ctx, "buy-bundle", "")).toBe(true);
    expect(save.state.wingmanBundle).toBe(true);
    // It pays 250 for 240, so a re-claimable crate is an infinite +10 faucet.
    // The guard in the handler is `if (wingmanBundle) return true`, so the second
    // and third claims must both be consumed but pay nothing.
    const afterBuy = save.state.wallet;

    expect(shopAction(ctx, "buy-bundle", "")).toBe(true);
    expect(save.state.wallet, "the crate was claimable a second time").toBe(afterBuy);

    expect(shopAction(ctx, "buy-bundle", "")).toBe(true);
    expect(save.state.wallet, "the crate was claimable a third time").toBe(afterBuy);
  });

  it("refuses the crate it cannot pay for and says what is missing", () => {
    const save = new SaveData();
    // Set the precondition rather than trusting a clean slate: the table
    // calls `persist()`, so an earlier test in this file can leave a wallet
    // in storage and make "cannot afford" pass or fail for the wrong reason.
    save.state.wallet = 0;
    save.state.wingmanBundle = false;
    const rec = recorder();
    expect(shopAction(context(save, rec), "buy-bundle", "")).toBe(true);
    expect(save.state.wingmanBundle).toBe(false);
    expect(rec.toasts.join(" ")).toContain("240");
    expect(save.state.wallet).toBe(0);
  });

  it("keeps the free-coin ad inert when no ad surface is live", () => {
    const save = new SaveData();
    const rec = recorder();
    const ctx = context(save, rec, { adsLive: () => false });
    // The card is hidden without a live ad; this is the second half of that gate.
    expect(shopAction(ctx, "shop-free-coins", "")).toBe(true);
    expect(rec.calls).not.toContain("shopAd");
  });

  it("caps rewarded free coins per session and explains the cap", () => {
    const save = new SaveData();
    const rec = recorder();
    const ctx = context(save, rec, { shopAdClaimed: SHOP_AD_SESSION_CAP });
    expect(shopAction(ctx, "shop-free-coins", "")).toBe(true);
    expect(rec.calls).not.toContain("shopAd");
    expect(rec.toasts.join(" ")).toMatch(/capped/i);
  });

  it("still pays out a rewarded ad one claim below the cap", () => {
    const save = new SaveData();
    const rec = recorder();
    const ctx = context(save, rec, { shopAdClaimed: SHOP_AD_SESSION_CAP - 1 });
    expect(shopAction(ctx, "shop-free-coins", "")).toBe(true);
    expect(rec.calls).toContain("shopAd");
  });

  it("telescopes the first-visit onboarding exactly once", () => {
    const save = new SaveData();
    // Explicit, for the same reason as the crate test: a persisted `seenShop`
    // would make the first-visit arm silently skip and the "fires once"
    // assertion below would be vacuous.
    save.state.seenShop = false;
    const rec = recorder();
    const ctx = context(save, rec);

    shopAction(ctx, "open-shop", "");
    expect(save.state.seenShop).toBe(true);
    expect(rec.tracked).toContain("onboarding_shop_opened");
    expect(rec.toasts.length).toBe(1);

    rec.tracked.length = 0;
    rec.toasts.length = 0;
    shopAction(ctx, "open-shop", "");
    expect(rec.tracked).toHaveLength(0);
    expect(rec.toasts).toHaveLength(0);
    // Still opens the shop — the second visit is not onboarding, it is a purchase.
    expect(rec.calls).toContain("screen:shop");
  });

  it("never lets a VIP button do nothing and say nothing", () => {
    const save = new SaveData();
    const rec = recorder();
    shopAction(context(save, rec), "vip-buy", "");
    // Portal builds strip the ad break, so VIP has no purchase to make there.
    // Either route is fine; silence is not.
    expect(rec.calls.includes("buyPortalVip") || rec.toasts.length > 0).toBe(true);
  });

  it("will not navigate away from a checkout still in flight", () => {
    const save = new SaveData();
    const rec = recorder();

    shopAction(context(save, rec, { checkoutBusy: true }), "checkout-cancel", "");
    expect(rec.calls).not.toContain("back");

    shopAction(context(save, rec, { checkoutBusy: false }), "checkout-cancel", "");
    expect(rec.calls).toContain("back");
  });

  it("routes save, restore and referral buttons to their subsystems", () => {
    const save = new SaveData();
    const rec = recorder();
    const ctx = context(save, rec);

    expect(shopAction(ctx, "restore", "")).toBe(true);
    expect(shopAction(ctx, "redeem", "")).toBe(true);
    expect(shopAction(ctx, "redeem-referral", "")).toBe(true);
    expect(shopAction(ctx, "import-cloud", "")).toBe(true);
    expect(rec.calls).toEqual(expect.arrayContaining(["restore", "redeem", "redeemReferral", "importCloud"]));
  });
});
