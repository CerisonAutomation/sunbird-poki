/**
 * The progression screens: high glides, the Nest Pass, the trophy case,
 * the account screen, the campaign and the tournament cups.
 */

import { formatNumberLocalized, t } from "../../i18n";
import { type AchievementView } from "../Achievements";
import { skinById } from "../Economy";
import { menuIconSm } from "../MenuIcons";
import { TRAILS } from "../Tournaments";
import { PIGGY_BANK_CAP, PIGGY_BANK_MIN_SMASH, VIP_DAILY_GIFT } from "../constants";
import { PORTAL_DISPLAY_NAME, PORTAL_EDITION_NOTE, SELL_AD_REMOVAL, SIMULATED_BREAKS } from "../edition";
import { SCREEN, escapeHtml, head, sectionTitle } from "./kit";
import { distanceText, renderGoalList, renderMissions, renderQuests, renderRivalBanner } from "./parts";
import { type HudSnapshot, type SeedMode } from "./types";

export function renderProgress(s: Pick<HudSnapshot, "bestDistance" | "calendar" | "canFreeSpin" | "eventClearsWeek" | "gold" | "missions" | "monthlyTheme" | "nestLevel" | "nestMult" | "piggyCoins" | "portalName" | "prestigeLevel" | "prestigeMult" | "quests" | "rival" | "rivalBanner" | "seedLabel" | "seedMode" | "sessionGoals" | "skillLabel" | "streakDays" | "todayBest" | "vip" | "wallet" | "weeklyEvent" | "wings">): string {
  const portal = s.portalName !== "none";
  const modes: { id: SeedMode; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "random", label: "Wild" },
  ];
  const seedPicker = !portal && s.gold
    ? `<div class="seg">${modes
        .map((m) => `<button data-ui data-action="seed-${m.id}" class="${s.seedMode === m.id ? "on" : ""}">${m.label}</button>`)
        .join("")}</div>`
    : portal
      ? `<p class="portal-note">${PORTAL_EDITION_NOTE}</p>`
      : SELL_AD_REMOVAL ? `<button class="lock-chip" data-ui data-action="open-paywall">✦ Pick your hills with Gold</button>` : "";
  // The subtitle below is deliberately NOT wrapped in t(). It had a t() call
  // whose key was never added to the barrel, so it read as translated in the
  // source while rendering the English fallback for all 20 locales. The
  // source→barrel coverage test (i18n/__tests__/locales.test.ts) fails on
  // exactly that now; until a real translation exists for every shipped
  // locale, a plain literal is the honest representation of its state.
  // --- Do This Now: time-sensitive actions ---
  const doNow: string[] = [];
  if (!s.calendar.claimedToday) doNow.push(`<button class="cal-strip" data-ui data-action="claim-calendar">${menuIconSm("calendar")} Daily gift ready — day ${(s.calendar.cycleDay % 28) + 1} of 28 <b>CLAIM</b></button>`);
  if (s.canFreeSpin) doNow.push(`<div class="pc pc--blue pc-row"><span class="pc-icon">${menuIconSm("spin")}</span><div class="pc-body"><b>${t("hud.renderProgress.DLuckyWheel", undefined, "Daily Lucky Wheel")}</b><span>${t("hud.renderProgress.FSpinAvailableNow", undefined, "Free spin available now!")}</span></div><button class="primary-btn gold" data-ui data-action="spin-wheel">Free Spin! ${menuIconSm("spin")}</button></div>`);
  if (s.piggyCoins >= PIGGY_BANK_MIN_SMASH) doNow.push(`<div class="pc pc--pink pc-row"><span class="pc-icon">${menuIconSm("piggy")}</span><div class="pc-body"><b>${t("hud.renderProgress.PBankReady", undefined, "Piggy Bank ready")}</b><span>● ${s.piggyCoins} coins saved — smash it!</span></div><button class="primary-btn gold" data-ui data-action="smash-piggy">Smash ${menuIconSm("hammer")}</button></div>`);

  // --- Collect section: non-urgent systems ---
  const collectSections: string[] = [];
  if (!s.canFreeSpin) collectSections.push(`<div class="pc pc--blue pc-row"><span class="pc-icon">${menuIconSm("spin")}</span><div class="pc-body"><b>${t("hud.renderProgress.DLuckyWheelx", undefined, "Daily Lucky Wheel")}</b><span>Spin to win up to ● 1,000 Coins &amp; Mystery Vault Keys</span></div><button class="soft-btn" disabled>${menuIconSm("spin")} Tomorrow</button></div>`);
  if (s.piggyCoins < PIGGY_BANK_MIN_SMASH) collectSections.push(`<div class="pc pc--pink pc-row"><span class="pc-icon">${menuIconSm("piggy")}</span><div class="pc-body"><b>${t("hud.renderProgress.CPiggyBank", undefined, "Coin Piggy Bank")}</b><span>+20% flight bonus: ● ${s.piggyCoins} / ${PIGGY_BANK_CAP}</span></div><span class="tag need">${t("hud.renderProgress.FFill", undefined, "Fly to fill")}</span></div>`);
  if (s.nestLevel >= 5 || s.prestigeLevel > 0) collectSections.push(`<div class="pc pc--purple pc-row"><span class="pc-icon">${menuIconSm("crown")}</span><div class="pc-body"><b>Solar Crown Prestige ${s.prestigeLevel > 0 ? `Rank ${s.prestigeLevel}` : ""}</b><span>Permanent coin boost: +${Math.round((s.prestigeMult - 1) * 100)}%</span></div><button class="primary-btn gold" data-ui data-action="perform-prestige">Rebirth ${menuIconSm("crown")}</button></div>`);

  return `${head(t("hud.progress.title", undefined, "Your progress"))}
    <div class="hero-meta">
      <span class="pill seed-pill">${s.seedLabel}</span>
      <span class="pill wings-pill" title="${distanceText(s.wings.lifetime)} lifetime">${menuIconSm(s.wings.icon)} ${s.wings.name}</span>
      <span class="pill">● ${formatNumberLocalized(s.wallet)}</span>
      <span class="pill">${menuIconSm("fire")} ${s.streakDays}d</span>
    </div>
    ${
      s.wings.nextNeeded > 0
        ? `<div class="wings-track" aria-label="${t("hud.renderSkinCollections.CProgress", undefined, "Career progress")}"><i style="width:${Math.round(s.wings.progress * 100)}%"></i><span>${distanceText(s.wings.nextNeeded)} to ${s.wings.nextName}</span></div>`
        : ""
    }
    ${s.rivalBanner ? renderRivalBanner(s.rivalBanner) : ""}

    ${doNow.length ? `<div class="section-title progress-do-now"><span>${t("hud.renderProgress.DNow", undefined, "Do this now")}</span></div>${doNow.join("")}` : ""}

    ${sectionTitle(null, "Today", "QUESTS &amp; GOALS")}
    ${renderGoalList(s.sessionGoals)}
    ${renderQuests(s.quests)}

    <button class="event-strip" data-ui data-action="play-event">
      <span class="ds-icon">${menuIconSm(s.weeklyEvent.icon)}</span>
      <span class="ds-body"><b>Event · ${s.weeklyEvent.name}</b><em>${menuIconSm(s.monthlyTheme.icon)} ${s.monthlyTheme.name} · fly ${formatNumberLocalized(s.weeklyEvent.target)} m · ● ${s.weeklyEvent.reward}</em></span>
      <span class="ds-go">${s.eventClearsWeek > 0 ? `✓${s.eventClearsWeek}` : "FLY"}</span>
    </button>

    ${sectionTitle(null, "Career", "RANK &amp; WINGS")}
    <button class="rank-card" data-ui data-action="open-rank" aria-label="${t("hud.aria.rivalRankPractice", undefined, "View local Rival rank (practice field)")}">
      <span class="rank-div">${s.rival.divisionIcon} ${s.rival.division}</span>
      <span class="rank-num">${s.rival.rating}</span>
      <span class="rank-bar"><i style="width:${Math.round(s.rival.progress * 100)}%"></i></span>
      <span class="rank-sub">${
        s.rival.nextNeeded > 0
          ? `${formatNumberLocalized(s.rival.rating)} / ${formatNumberLocalized(Math.round(s.rival.rating + s.rival.nextNeeded))} to ${s.rival.nextName}`
          : "Top division — defend it"
      } · ${menuIconSm("fire")}${s.rival.streak} streak</span>
    </button>
    <div class="wallet-row">
      <span class="pill">Nest Lv.${s.nestLevel} · ×${s.nestMult.toFixed(2)}</span>
      ${!portal && s.gold ? '<span class="pill gold">✦ Gold</span>' : ""}
      ${!portal && s.vip ? '<span class="pill vip">♛ VIP</span>' : ""}
      <span class="pill skill">${s.skillLabel}</span>
    </div>

    ${collectSections.join("")}
    ${seedPicker}

    ${renderMissions(s.missions)}
    <div class="menu-stats"><div>Best <b>${distanceText(s.bestDistance)}</b></div><div>Today <b>${distanceText(s.todayBest)}</b></div></div>
`;
}

export function renderPass(s: Pick<HudSnapshot, "gold" | "season">): string {
  const pct = Math.min(100, (s.season.have / s.season.need) * 100);
  return `
    ${head(SCREEN.nestPass, "back", `<span class="pill">Lv.${s.season.tier}/${s.season.maxTier}</span>`)}
    <div class="pass-progress"><i style="width:${pct}%"></i></div>
    <p class="tagline">${s.season.label} — fly to earn XP.${SELL_AD_REMOVAL ? " Gold unlocks the premium track." : " Fly to unlock rewards."}</p>
    ${!s.gold && SELL_AD_REMOVAL ? `<button class="upsell" data-ui data-action="open-paywall"><div><b>✦ Unlock premium rewards</b><span>${t("hud.renderPass.DTierRewardsGold", undefined, "Double the tier rewards with Gold")}</span></div><span class="mini-btn gold">Unlock</span></button>` : ""}
    ${!SELL_AD_REMOVAL ? `<p class="fineprint pass-portal-note">✦ Portal edition — the free Nest Pass track is fully earnable. Gold is a one-time purchase with flight coins.</p>` : ""}
    <div class="tier-track">
      ${s.season.tiers
        .map((t) => {
          const canFree = t.unlocked && !t.freeClaimed;
          const canPremium = t.unlocked && !t.premiumLocked && !t.premiumClaimed;
          const premiumTitle = t.premiumLocked && !SELL_AD_REMOVAL ? "Portal edition — premium rewards shown for reference" : undefined;
          return `<div class="tier-card ${t.unlocked ? "unlocked" : ""}">
            <div class="tier-num">Lv.${t.tier}</div>
            <button class="tier-reward free ${t.freeClaimed ? "claimed" : ""}" data-ui data-action="${canFree ? "claim-pass-free" : ""}" data-id="${t.tier}" ${canFree ? "" : "disabled"}>${rewardLabel(t.free)}</button>
            <button class="tier-reward premium ${t.premiumClaimed ? "claimed" : ""} ${t.premiumLocked ? "locked" : ""}" data-ui data-action="${canPremium ? "claim-pass-premium" : ""}" data-id="${t.tier}" ${premiumTitle ? `title="${premiumTitle}"` : ""} ${canPremium ? "" : "disabled"}>${rewardLabel(t.premium)}${t.premiumLocked ? `<i class="lock-badge">✦</i>` : ""}</button>
          </div>`;
        })
        .join("")}
    </div>
    <p class="fineprint">${t("hud.renderPass.NPassResetsEveryMonthSpendRewardsBeforeDoes", undefined, "The Nest Pass resets every month — spend rewards before it does!")}</p>
  `;
}

export function renderTrophies(s: Pick<HudSnapshot, "trophies" | "trophyCounts">): string {
  const groups: Record<string, AchievementView[]> = { bronze: [], silver: [], gold: [], platinum: [] };
  for (const v of s.trophies) groups[v.def.rarity]!.push(v);
  const order: (keyof typeof groups)[] = ["bronze", "silver", "gold", "platinum"];
  return `
    ${head(SCREEN.trophyCase, "back", `<span class="pill">${s.trophyCounts.unlocked}/${s.trophyCounts.total}</span>`)}
    ${order
      .map(
        (rarity) => `
      <details class="shop-section trophy-collection" data-ref="trophies-${rarity}"><summary>${rarity}<span>${groups[rarity]!.filter(v => v.unlocked).length}/${groups[rarity]!.length} unlocked</span></summary>
      <div class="trophy-grid">
        ${groups[rarity]!
          .map((v) => {
            const pct = Math.min(100, (v.progress / v.def.target) * 100);
            return `<div class="trophy ${v.unlocked ? "unlocked" : ""} ${rarity}">
              <div class="trophy-icon">${menuIconSm(v.unlocked ? "trophy" : "lock")}</div>
              <div class="trophy-name">${v.def.title}</div>
              <div class="trophy-desc">${v.def.desc}</div>
              ${v.unlocked ? "" : `<div class="qb"><i style="width:${pct}%"></i></div>`}
            </div>`;
          })
          .join("")}
      </div></details>`,
      )
      .join("")}
  `;
}

export function renderAccount(s: Pick<HudSnapshot, "adsLeftToday" | "cloudCode" | "cloudMessage" | "gold" | "portalAccountName" | "portalName" | "referralCode" | "referralMessage" | "referralRedeemed" | "vip" | "vipDaysLeft">): string {
  // Portal account block: on Poki the player may be signed in, and the game is
  // required to be honest about who it thinks they are (their name is what
  // goes on the board). Sign-in is offered only behind a button — Poki's docs
  // forbid prompting for an account on load.
  const portalAccount = s.portalName !== "none"
    ? `${sectionTitle(null, `${PORTAL_DISPLAY_NAME} account`)}
    <div class="sheet">
      ${
        s.portalAccountName
          ? `<div class="code-row"><span>${t("hud.renderAccount.SAs", undefined, "Signed in as ")}<b>${escapeHtml(s.portalAccountName)}</b></span><span class="tag on">Linked</span></div>
             <p class="fineprint">Your progress and leaderboard scores follow this ${PORTAL_DISPLAY_NAME} account across devices.</p>`
          : `<div class="code-row"><span>${t("hud.renderAccount.NSigned", undefined, "Not signed in")}</span><button class="mini-btn" data-ui data-action="portal-sign-in">${t("hud.renderAccount.S", undefined, "Sign in")}</button></div>
             <p class="fineprint">Sign in to carry your progress between devices and appear on the board under your own name.</p>`
      }
    </div>`
    : "";
  return `
    ${head(SCREEN.account)}
    ${portalAccount}
    ${sectionTitle(null, "Membership")}
    ${!SELL_AD_REMOVAL ? "" : `
    <div class="sheet">
      <div class="code-row"><span>${s.gold ? "✦ Gold · owned for life" : "✦ Gold · not owned"}</span>${
        s.gold ? `<span class="tag on">Active</span>` : SELL_AD_REMOVAL ? `<button class="mini-btn gold" data-ui data-action="open-paywall">${t("hud.renderAccount.GGold", undefined, "Get Gold")}</button>` : `<span class="tag">${t("hud.renderAccount.PMember", undefined, "Portal member")}</span>`
      }</div>
      ${SELL_AD_REMOVAL ? `<div class="code-row"><span>♛ VIP · ${s.vip ? `${s.vipDaysLeft} day${s.vipDaysLeft === 1 ? "" : "s"} left` : "inactive"}</span>${
        s.vip
          ? `<button class="mini-btn vip" data-ui data-action="vip-buy">Extend</button>`
          : `<button class="mini-btn vip" data-ui data-action="vip-buy">Subscribe</button>`
      }</div>` : ""}
      <p class="fineprint">VIP gifts ${VIP_DAILY_GIFT} coins every day you play and adds a fourth daily quest. ${
        s.vip ? "" : "Cancel anytime — no auto-renewal in this build; your 30 days simply run out."
      }${
        /* Only the direct build schedules its own interstitials; on a portal the
           platform owns ad frequency, so the game must not describe (or count)
           breaks it does not control. */
        SIMULATED_BREAKS && s.portalName === "none" ? ` Sponsored breaks respect a hard cap: <b>${s.adsLeftToday}</b> left today.` : ""
      }</p>
    </div>
    `}

    ${sectionTitle(null, "Invite friends")}
    <div class="sheet">
      <p class="tagline">Share your code — friends who redeem it get a welcome bonus on their device.</p>
      <div class="code-row"><span class="code">${s.referralCode}</span><button class="mini-btn" data-ui data-action="copy-referral">Copy</button></div>
      ${
        s.referralRedeemed
          ? `<p class="note">${t("hud.renderAccount.VAlreadyRedeemedFriendCodeThanksJoining", undefined, "You've already redeemed a friend code. Thanks for joining!")}</p>`
          : `<div class="redeem"><input data-ui data-ref="friendcode" aria-label="${t("hud.renderCelebration.FReferralCode", undefined, "Friend referral code")}" placeholder="Friend's code (SUN-XXXXXX)" maxlength="10" autocomplete="off" /><button class="mini-btn" data-ui data-action="redeem-referral">Apply</button></div>`
      }
      ${s.referralMessage ? `<p class="note">${s.referralMessage}</p>` : ""}
    </div>
    ${sectionTitle(null, "Transfer saved progress")}
    <div class="sheet">
      <p class="tagline">${t("hud.renderAccount.CCodeMoveProgressAnotherDevice", undefined, "Copy this code to move your progress to another device.")}</p>
      <textarea class="cloud-box" data-ui aria-label="${t("hud.renderCelebration.ESaveCode", undefined, "Your exportable save code")}" readonly rows="3">${s.cloudCode}</textarea>
      <button class="mini-btn" data-ui data-action="copy-cloud">${t("hud.renderAccount.CCode", undefined, "Copy code")}</button>
      <p class="tagline" style="margin-top:10px">${t("hud.renderAccount.PCodeFromAnotherDeviceRestoreHere", undefined, "Paste a code from another device to restore it here:")}</p>
      <textarea class="cloud-box" data-ui aria-label="${t("hud.renderCelebration.SCodeImport", undefined, "Save code to import")}" rows="3" placeholder="Paste save code…"></textarea>
      <label class="import-confirm"><input type="checkbox" data-ui/>${t("hud.renderAccount.RProgressDeviceSave", undefined, "Replace progress on this device with this save.")}</label>
      <button class="mini-btn" data-ui data-action="import-cloud">${t("hud.renderAccount.ISave", undefined, "Import save")}</button>
      ${s.cloudMessage ? `<p class="note" role="status">${s.cloudMessage}</p>` : ""}
    </div>
    <p class="fineprint">${t("hud.renderAccount.CSaveCodeTransferProgressBetweenDevices", undefined, "Copy your save code to transfer progress between devices.")}</p>
  `;
}

export function renderCampaign(s: Pick<HudSnapshot, "campaign" | "campaignDone" | "campaignTotal">): string {
  const rows = s.campaign
    .map((ch) => {
      const goals = ch.goals
        .map(
          (g) => `<div class="camp-goal ${g.done ? "done" : ""}">
            <span class="check">${g.done ? "✓" : ""}</span>
            <span class="cg-label">${escapeHtml(g.def.label)}</span>
            <span class="cg-prog">${formatNumberLocalized(Math.floor(g.progress))}/${formatNumberLocalized(g.def.target)}</span>
          </div>`,
        )
        .join("");
      const cta = !ch.unlocked
        ? `<span class="tag">${menuIconSm("lock")} Finish chapter ${ch.index} first</span>`
        : ch.claimed
          ? `<span class="tag on">✓ ${formatNumberLocalized(ch.def.rewardCoins)} coins</span>`
          : ch.complete
            ? `<button class="mini-btn gold" data-ui data-action="claim-campaign" data-id="${ch.def.id}">CLAIM ● ${ch.def.rewardCoins}</button>`
            : `<span class="tag">● ${ch.def.rewardCoins} on completion</span>`;
      return `<div class="camp-chapter ${!ch.unlocked ? "locked" : ""} ${ch.claimed ? "claimed" : ""}">
        <div class="camp-head"><span class="camp-icon">${menuIconSm(ch.def.icon)}</span><div><b>Chapter ${ch.index + 1} · ${escapeHtml(ch.def.title)}</b><em>${escapeHtml(ch.def.story)}</em></div></div>
        ${ch.unlocked ? goals : ""}
        <div class="camp-foot">${cta}</div>
      </div>`;
    })
    .join("");
  return `
    ${head(SCREEN.campaign, "back", `<span class="pill">${s.campaignDone}/${s.campaignTotal}</span>`)}
    <p class="tagline">A journey in eight chapters. Progress accrues from every flight — no separate grind.</p>
    <div class="camp-list">${rows}</div>
  `;
}

export function renderCups(s: Pick<HudSnapshot, "cups" | "lastPrize" | "titles" | "trails">): string {
  const hrs = (ms: number): string => {
    const h = Math.floor(ms / 3600000);
    return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h`;
  };
  const cups = s.cups
    .map((c) => {
      const tierLabel = c.tier ? c.tier.toUpperCase() : "UNRANKED";
      const prize = c.tier ? c.def.prizes[c.tier] : null;
      return `<div class="cup-card ${c.tier ?? ""}">
        <div class="cup-head"><span class="cup-icon">${menuIconSm(c.def.icon)}</span>
          <div><b>${c.def.name}</b><em>${c.def.blurb}</em></div>
          <span class="cup-timer">${hrs(c.endsInMs)} left</span>
        </div>
        <div class="cup-meta"><span class="cup-tier ${c.tier ?? "none"}">${tierLabel}</span><span>Best ${Math.round(c.entry.best)}</span><span>${c.entry.attempts} runs</span></div>
        <div class="qb"><i style="width:${Math.round(c.progress * 100)}%"></i></div>
        <div class="cup-next">${c.nextTier ? `Next: ${c.nextTier} at ${Math.round(c.nextCut)}` : "Diamond secured"}</div>
        ${
          c.claimable && prize
            ? `<button class="mini-btn gold" data-ui data-action="claim-cup" data-id="${c.def.id}">Claim ${menuIconSm(prize.icon)} ${prize.label}</button>`
            : `<button class="mini-btn" data-ui data-action="pick-mode" data-id="${c.def.mode}">Fly ${c.def.mode}</button>`
        }
      </div>`;
    })
    .join("");

  const trails = s.trails.length
    ? `${sectionTitle(null, "Prize trails")}<div class="btn-row">${s.trails
        .map((t) => `<button class="soft-btn ${t.equipped ? "gold" : ""}" data-ui data-action="equip-trail" data-id="${t.id}">${t.equipped ? "✓ " : ""}${t.label}</button>`)
        .join("")}</div>`
    : "";

  // The diamond cup's title prize was written to `state.titles` and read
  // nowhere, so the hardest prize in the game vanished on claim. Shown here
  // beside the prize trails, which is where won cosmetics already live.
  const titles = s.titles.length
    ? `${sectionTitle(null, "Prize titles")}<div class="btn-row">${s.titles
        .map((title) => `<span class="soft-btn prize-title" title="${t("hud.renderCups.wornBesideName", undefined, "Worn beside your name")}">♛ ${escapeHtml(title.label)}</span>`)
        .join("")}</div>`
    : "";

  return `
    ${head(SCREEN.tournaments, "back", `<span class="pill">Weekly</span>`)}
    <p class="tagline">Two cups run every week. Beat a division cut-off, then claim the prize — it lands in your account immediately.</p>
    <div class="cup-list">${cups}</div>
    ${s.lastPrize ? `<div class="reward-strip">Last prize · ${s.lastPrize}</div>` : ""}
    ${trails}
    ${titles}
    <p class="fineprint">${t("hud.renderCups.CResetEveryMondayWonCosmeticsArePermanent", undefined, "Cups reset every Monday. Won cosmetics are permanent.")}</p>
  `;
}

export function rewardLabel(r: { kind: string; amount?: number; id?: string }): string {
  if (r.kind === "coins") return `● ${r.amount}`;
  // Map through the catalogues. This printed the raw id — the skin's `paradise`,
  // the trail's `star` — on a fifty-tier track, which is the game's own plumbing
  // shown to the player as if it were a name.
  if (r.kind === "skin") return `${menuIconSm("bird")} ${skinById(r.id ?? "").name}`;
  if (r.kind === "trail") return `${menuIconSm("sparkle")} ${TRAILS[r.id ?? ""]?.label ?? "Trail"}`;
  return `${menuIconSm("gift")} ${r.id ?? "Reward"}`;
}