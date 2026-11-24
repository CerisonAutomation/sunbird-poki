import { t } from "../i18n";

/** Player-facing, high-stakes feedback. Resolve at display time so a language
 * change applies immediately; values are actual grants, never advertised sums. */
export const importantMessages = {
  streakDay: (days: number, coins: number): string =>
    t("hud.toast.streakDay", { n: days, c: coins }, `Day ${days} streak · +${coins} coins`),
  streakMilestone: (days: number, coins: number, trail: boolean): string => {
    const suffix = trail ? t("message.newTrailSuffix", undefined, " + a new trail") : "";
    return t("hud.toast.streakMilestone", { days, coins, trail: suffix }, `${days}-day streak · +${coins} coins${suffix}!`);
  },
  vipDaily: (coins: number): string =>
    t("hud.toast.vipGift", { n: coins }, `VIP daily gift · +${coins} coins`),
  seasonEnd: (division: string, coins: number): string =>
    t("hud.toast.seasonEnd", { division, coins }, `Ranked season over · ${division} reward +${coins} coins`),
  trophy: (title: string): string => t("hud.toast.trophy", { title }, `Trophy: ${title}`),
  firstShop: (): string => t("message.firstShop", undefined, "Choose birds, boosts and trails in the Hangar."),
  shopTip: (): string => t("message.shopTip", undefined, "Visit the Hangar to explore birds, boosts and trails."),
  adUnavailable: (): string => t("message.adUnavailable", undefined, "Ads are unavailable right now — use coins for a second wind."),
  rewardUnconfirmed: (): string => t("message.rewardUnconfirmed", undefined, "No reward granted — the ad was unavailable or not completed. Try again."),
  continueUnconfirmed: (): string => t("message.continueUnconfirmed", undefined, "No second wind granted — the ad was unavailable or not completed. Try again or use coins."),
  flightBonus: (coins: number): string => t("message.flightBonus", { coins }, `3× flight bonus · +${coins} coins`),
  shopCoins: (coins: number): string => t("message.shopCoins", { coins }, `Free coins · +${coins} coins`),
};
