/**
 * The home screen: hero, launch cluster (Fly now + loadout chip), quick rail,
 * daily-ritual banner, tournament strip, onboarding route, play/progress
 * destinations, standings strip.
 *
 * Extracted from HUD.ts (2026-10-04) so the menu's markup lives with the rest
 * of the screen renderers in hud/ instead of inside the 3,000-line HUD class
 * file. Pure string builder over HudSnapshot, same contract as hud/run.ts and
 * hud/loadout.ts: no DOM access, no mutation, all interactivity via
 * `data-action`s handled by Game.
 */

import { formatNumberLocalized, t } from "../../i18n";
import { arrowRightSvg, arrowUpRightSvg, closeSvg, menuIcon, menuIconSm, menuHorizon } from "../MenuIcons";
import { skinPalette, skinShape, sunSVG, sunbirdSVG } from "../Sunbird";
import { PLAY_DESTINATIONS, PROGRESS_DESTINATIONS, QUICK_ACTIONS, tournamentCountdownCard, type MenuDestination } from "../MenuCatalog";
import { shouldShowDailyBanner } from "../Engagement";
import { distanceText } from "./parts";
import { escapeHtml } from "./kit";
import type { HudSnapshot } from "./types";

function menuLinks(items: MenuDestination[]): string {
  return items.map(item =>
    `<button class="destination" data-ui data-action="${item.action}" data-icon="${item.icon}"><span class="destination-art">${menuIcon(item.icon)}</span><span class="destination-copy"><b>${item.title}</b><span>${item.detail}</span></span><span class="destination-arrow" aria-hidden="true">${arrowUpRightSvg()}</span></button>`,
  ).join("");
}

/**
 * "Top wings" — the live board, three rows, on the home screen.
 *
 * Competition is a reason to press play again, so the standing is shown above
 * the Play grid, not only behind a menu page. It is a view onto the page the
 * menu already fetches, and it disappears when there is nothing to show.
 */
function homeBoardStrip(s: HudSnapshot): string {
  const rows = s.homeBoard.slice(0, 3);
  // Render even with no rows. This strip is now the home menu's ONLY route to
  // the leaderboards (the tile moved to SECONDARY_DESTINATIONS), and `homeBoard`
  // is empty whenever the board cache is cold — first boot, a failed fetch, an
  // offline launch. Returning "" there left the leaderboards unreachable from
  // the menu at all, on exactly the boots where a player is most likely to go
  // looking. An empty state that still opens the page beats no control.
  // Rank badges are drawn, not emoji: medal glyphs render as tofu boxes on
  // font sets without the emoji face (several platforms ship none by default),
  // and a row of empty squares under "Top pilots" reads as broken.
  const medals = ["1", "2", "3"];
  // Three compact rows in ONE panel, not three stacked cards. The rows are the
  // live top of the ladder — the player's own line is marked, so the strip says
  // "you belong on this board" instead of "here is a table" — and the whole
  // panel opens the full leaderboards. Density is what keeps it above the Play
  // grid: the earlier three-card version cost ~3x this height and pushed PvP
  // off a 640-tall phone entirely.
  return `
    <button class="home-board" data-ui data-action="open-board" aria-label="${t("hud.renderOnboardingRoute.OLeaderboards", undefined, "Open the leaderboards")}">
      <span class="hb-head">
        <span class="hb-title">${menuIconSm("trophy")} Top pilots</span>
        <span class="hb-go">All boards ›</span>
      </span>
      ${rows.length
        ? rows
            .map(
              (row, i) => `<span class="hb-row${row.you ? " you" : ""}">
            <span class="hb-medal">${medals[i]}</span>
            <span class="hb-name">${escapeHtml(row.name)}</span>
            <span class="hb-val">${row.value}</span>
          </span>`,
            )
            .join("")
        : `<span class="hb-empty">${escapeHtml(t("hud.boardStrip.empty", undefined, "No runs posted yet — set the first mark"))}</span>`}
    </button>`;
}

/**
 * Daily Login Ritual banner: "Daily Challenge ready! +N coins waiting",
 * shown at boot and on every return to the home menu until either the daily
 * is completed or the player dismisses it (Play now / the X). Uses the same
 * `pc pc--gold pc-row` card the "Do this now" strip uses elsewhere, so the
 * home menu and the progress screen share one visual language for "act now".
 */
function renderDailyRitualBanner(s: HudSnapshot): string {
  if (!shouldShowDailyBanner(s.daily.done, s.dismissedDailyPrompt)) return "";
  // Clickable. It announced coins waiting and offered no route to them; the only
  // child control was a dismiss, which is a way to make the problem go away.
  return `<div class="pc pc--gold pc-row daily-ritual-banner">
    <button class="pc-open" data-ui data-action="open-challenges">
    <span class="pc-icon">${menuIconSm("sun")}</span>
    <div class="pc-body"><b>${t("hud.renderDailyRitualBanner.DChallengeReady", undefined, "Daily Challenge ready!")}</b><span>+${s.daily.reward} coins waiting — open ›</span></div>
    </button>
    <button class="mini-btn ghost daily-ritual-close" data-ui data-action="dismiss-daily-banner" aria-label="${t("hud.aria.dismiss", undefined, "Dismiss")}">${closeSvg()}</button>
  </div>`;
}

/**
 * Persistent tournament countdown card (Feature: Tournament Countdown
 * Urgency): "<cup> ends in N day(s) — You're currently <tier>!", for the
 * soonest-ending of this week's two cups. Tapping it opens Tournaments.
 */
function renderTournamentCountdown(s: HudSnapshot): string {
  // The countdown card is the home screen's ONLY route to Tournaments (the
  // tile moved to SECONDARY_DESTINATIONS), and it used to return "" whenever
  // `tournamentCountdownCard` had nothing to say — so tournaments vanished
  // from the menu entirely on exactly the boots where the cups had not loaded
  // yet. With no card there is still a tournament to enter, so the strip
  // renders in a plain state rather than withdrawing the route.
  const card = tournamentCountdownCard(s.cups);
  // Reuses the already-styled `event-strip` card (weekly-event strip on the
  // progress screen) rather than inventing unstyled markup — same visual
  // language for "a clock is running on this", different destination.
  return `<button class="event-strip" data-ui data-action="open-cups" aria-label="${t("hud.renderMain.VTournaments", undefined, "View tournaments")}">
    <span class="ds-icon">${menuIconSm("trophy")}</span>
    <span class="ds-body">${escapeHtml(card?.text ?? t("hud.tournaments.idle", undefined, "Weekly score challenges"))}</span>
    <span class="ds-go">›</span>
  </button>`;
}

/**
 * The five things a new pilot is shown, under the main "Fly now" button.
 *
 * These used to be "Feel the glide / Choose your bird / Race the flock" — but
 * step 1 was the same action as the button directly above it, so the panel
 * opened by offering the player something they had just been handed, and the
 * two text destinations it taught (racing, the shop) were not the two the game
 * actually needs explained first. It is now the five surfaces a first run has
 * to meet: fly, the loadout, the AI flock, live rivals, and settings — which is
 * every action in `QUICK_ACTIONS` plus the first flight itself.
 *
 * Step 2 sends the player to the pre-flight Loadout rather than the Shop. The
 * step promises a bird, a trail and boosters, and Loadout is the only screen
 * that stages all three; the Shop is where you spend, which is a different
 * promise than the one the step makes. The Shop remains one tap from Loadout.
 *
 * The steps are honest about WHERE they are: step 1 used to say "Spend the coins
 * you just earned" on a brand-new save, which starts at zero.
 */
function renderOnboardingRoute(s: HudSnapshot): string {
  // A walkthrough, not a poster. Each step dims and strikes itself through once
  // it is done, so the panel shrinks in meaning rather than in height as the
  // player learns the game. Every step is a real destination, and the four rail
  // destinations (PvP, AI PvP, shop, settings) are the same handlers the rail
  // fires, so the panel and the rail can never disagree.
  //
  // `done` is STORED, not derived, and deliberately so. The first attempt
  // derived it from `runsPlayed` / `wallet` / `bestDistance` and every one was
  // wrong: the wallet is a live balance, so a step completed and then spent
  // un-completed itself; `bestDistance > 0` marked "Meet your rivals" done
  // after one solo flight. "Did you open the shop" has no counter that means
  // only that, so it is a first-visit milestone in the save — monotonic, so it
  // cannot revert, and readable on a device that never showed this panel.
  const steps: readonly { n: string; action: string; title: string; sub: string; go: string; done: boolean }[] = [
    {
      n: "01", action: "pvp-practice", go: t("onboarding.step1Action", undefined, "Fly ›"),
      title: t("onboarding.step1Title", undefined, "Fly your first run"),
      sub: t("onboarding.step1Sub", undefined, "One input · the goal is on the strip"),
      done: s.runsPlayed >= 1,
    },
    {
      n: "02", action: "open-loadout", go: t("onboarding.step2Action", undefined, "Loadout ›"),
      title: t("onboarding.step2Title", undefined, "Choose your bird"),
      sub: t("onboarding.step2Sub", undefined, "Birds, trails and boosts for your next flight"),
      // `seenLoadout`, not `seenShop` and not `wallet > 0`. The wallet is a live
      // balance: a player who completed this step and then spent their coins
      // saw it revert to active, and a milestone that un-completes itself is
      // worse than none. Loadout is also the screen that actually does what
      // this step promises — it stages the bird, trail and boosters you fly
      // with, and it is reachable from the shop for anything you do not own yet.
      // The store itself is still one tap away from there.
      done: s.firstSteps.loadout,
    },
    {
      n: "03", action: "open-practice", go: t("onboarding.step3Action", undefined, "AI race ›"),
      title: t("onboarding.step3Title", undefined, "Race the flock"),
      sub: t("onboarding.step3Sub", undefined, "A real opponent is always there, even offline"),
      // `seenPve` — actually opening AI PvP. `runsPlayed >= 2` completed this
      // step for anyone who flew twice, including players who never touched it.
      done: s.firstSteps.pve,
    },
    {
      n: "04", action: "open-live", go: t("onboarding.step4Action", undefined, "Race ›"),
      title: t("onboarding.step4Title", undefined, "Meet your rivals"),
      sub: t("onboarding.step4Sub", undefined, "Live pilots, or a private room for a friend"),
      // `seenPvp` — actually opening the live lobby. `bestDistance > 0` was
      // true after one solo flight, so a solo-only player saw "Meet your
      // rivals" struck through without ever having tried.
      done: s.firstSteps.pvp,
    },
    {
      n: "05", action: "open-settings", go: t("onboarding.step5Action", undefined, "Settings ›"),
      title: t("onboarding.step5Title", undefined, "Make it yours"),
      sub: t("onboarding.step5Sub", undefined, "Sound, controls and how big the world looks"),
      done: s.firstSteps.settings,
    },
  ];
  const nextIndex = steps.findIndex((step) => !step.done);
  const allDone = nextIndex === -1;
  const head = allDone
    ? t("onboarding.allDone", undefined, "You know the ropes")
    : t("onboarding.startSubtitle", undefined, "five things worth knowing");
  return `<section class="onboarding-route" aria-label="${escapeHtml(t("onboarding.routeLabel", undefined, "Your first flight plan"))}">
      <div class="onboarding-route-head"><span>✦ ${allDone ? escapeHtml(t("onboarding.routeDone", undefined, "FLIGHT PLAN")) : escapeHtml(t("onboarding.startHere", undefined, "START HERE"))}</span><small>${escapeHtml(head)}</small><button class="mini-btn ghost onboarding-dismiss" data-ui data-action="dismiss-onboarding" aria-label="${escapeHtml(t("onboarding.skip", undefined, "Skip"))}">${closeSvg()}</button></div>
      <ol class="onboarding-route-steps">
        ${steps.map((step, i) => `<li><button class="onboarding-route-step${step.done ? " done" : ""}${i === nextIndex ? " active" : ""}" data-ui data-action="${step.action}"${step.done ? " disabled" : ""}><b>${step.done ? escapeHtml(t("onboarding.stepDoneMark", undefined, "✓")) : step.n}</b><span><strong>${escapeHtml(step.title)}</strong><small>${escapeHtml(step.sub)}</small></span><i>${escapeHtml(step.go)}</i></button></li>`).join("")}
      </ol>
    </section>`;
}

/**
 * The rail that sits directly under the main button.
 *
 * Four destinations, in one row, one tap below "Fly now" — the two things a
 * returning player does most (race someone, change something) used to be
 * scrolled off the bottom of a three-section menu.
 *
 * Rendered as real buttons with an explicit aria-label, because the visible
 * label is the destination's short title ("PvP") and the action it performs is
 * not obvious from it alone ("Race a real pilot" is). The label is the detail
 * line, so a screen reader announces the destination and not just the tile.
 *
 * `aria-current` is deliberately absent: this is navigation, not a position in
 * a set, and marking one of four as "current" would imply a state none of them
 * has.
 */
function renderQuickRail(): string {
  return `<nav class="home-quick-rail" aria-label="${escapeHtml(t("hud.quickRail.label", undefined, "Quick actions"))}">${QUICK_ACTIONS.map(
    (item) =>
      `<button class="quick-action quick-rail-btn" data-ui data-action="${item.action}" data-icon="${item.icon}" aria-label="${escapeHtml(item.title)} — ${escapeHtml(item.detail)}"><span class="quick-rail-art" aria-hidden="true">${menuIcon(item.icon)}</span><span class="quick-rail-copy"><b>${escapeHtml(item.title)}</b></span></button>`,
  ).join("")}</nav>`;
}

export function renderMain(s: HudSnapshot): string {
  // MenuCatalog is the single source of truth for home navigation. Keep the
  // renderer declarative: filtering destinations here used to leave stale PvP
  // entries in the catalog and made other screens drift from the home menu.
  const playDestinations = PLAY_DESTINATIONS;
  // The equipped bird for the loadout chip beside "Fly now". Falls back to the
  // first skin so a snapshot with no equipped flag (tests, migration edge)
  // still renders art rather than an empty box.
  const equippedSkin = s.skins.find((v) => v.equipped)?.def ?? s.skins[0]?.def;
  const progressDestinations = PROGRESS_DESTINATIONS;
  return `
    <button
      class="icon-btn menu-mute"
      data-ui
      data-action="set-mute"
      data-menu-mute
      aria-pressed="${s.settings.mute ? "true" : "false"}"
      aria-label="${s.settings.mute ? "Unmute sound" : "Mute sound"}"
      title="${s.settings.mute ? "Unmute sound" : "Mute sound"}"
    >${menuIcon(s.settings.mute ? "soundOff" : "sound")}</button>
    <header class="hero">
      ${menuHorizon()}
      <!-- Sun and bird both come from Sunbird.ts, so the title screen, the
           lobby and the flock in the menu sky are literally one sun and one
           bird. This SVG *is* the reference the whole game is drawn from. -->
      <div class="hero-sun-wrap">${sunSVG({ size: 64, className: "hero-sun" })}</div>
      ${sunbirdSVG({ className: "hero-bird", width: 92, title: "Sunbird", animateWings: true })}
      <div class="hero-title">
        <span class="hero-kicker">chase the daylight</span>
        <h1>SUNBIRD</h1>
        <p class="hero-sub">${t("hud.heroSub", undefined, "Hold to dive. Release to soar.")}<br>${t("hud.heroSub2", undefined, "Master the glide across endless islands.")}</p>
        ${s.streakDays >= 2 ? `<div class="hero-meta"><span class="pill streak-pill">${menuIconSm("sun")} ${s.streakDays}-day streak — one flight keeps it alive</span></div>` : ""}
      </div>
    </header>

    <div class="home-launch-row">
      <button class="primary-btn home-launch" data-ui data-action="pvp-practice" aria-label="${t("onboarding.flyNow", undefined, "Fly now")}"><span class="launch-art">${menuIcon("flight")}</span><span class="launch-copy"><small>${t("onboarding.skyIsYours", undefined, "THE SKY IS YOURS")}</small><b>${t("onboarding.flyNow", undefined, "Fly now")}</b><span>${t("onboarding.launchSub", undefined, "Hold to dive · release to glide")}</span></span><span class="launch-arrow" aria-hidden="true">${arrowRightSvg()}</span></button>
      <button class="destination loadout-quick" data-ui data-action="open-loadout" aria-label="${t("hud.loadoutQuick.aria", undefined, "Customise — change your bird, trail and boosters before you fly")}">
        <span class="lq-art" aria-hidden="true">${equippedSkin ? sunbirdSVG({ palette: skinPalette(equippedSkin), shape: skinShape(equippedSkin), width: 44, title: "" }) : menuIcon("bird")}</span>
        <span class="lq-copy"><small>${t("hud.loadoutQuick.title", undefined, "CUSTOMISE")}</small><b>${escapeHtml(s.loadout.bird)}</b><span>${escapeHtml(s.loadout.trail)}${s.loadout.boosts > 0 ? ` · ${s.loadout.boosts} ⚡` : ""}</span></span>
        <span class="lq-go" aria-hidden="true">${menuIconSm("wind")}</span>
      </button>
    </div>
    ${renderQuickRail()}
    ${renderDailyRitualBanner(s)}
    ${renderTournamentCountdown(s)}
    ${!s.settings.dismissedOnboarding ? renderOnboardingRoute(s) : ""}
    <!-- 01 — PLAY. PvP, AI PvP and the solo modes are all ways of playing, so
         they sit under the Play heading as one grid. Standings then close the
         section as a single full-width bar instead of a sixth row of choices:
         "how am I doing" is a different question from "what shall I play", and
         one bar at the end reads as the section's full stop. -->
    <div class="home-section-title"><span>${t("hud.renderMain.PNow", undefined, "Play now")}</span><small>${t("hud.renderMain.FRACEEXPLORE", undefined, "FLY · RACE · EXPLORE")}</small></div>
    <nav class="destination-grid play-destinations home-hub-grid" aria-label="${t("hud.aria.play", undefined, "Play")}">${menuLinks(playDestinations)}</nav>
    ${homeBoardStrip(s)}
    <div class="home-section-title"><span>Progress</span><small>${t("hud.renderMain.GRANKREWARDS", undefined, "GOALS · RANK · REWARDS")}</small></div>
    <nav class="destination-grid progress-destinations home-hub-grid" aria-label="${t("hud.aria.progress", undefined, "Progress")}">${menuLinks(progressDestinations)}</nav>
    <div class="home-record home-status-bar" role="status">
      <button class="sb-stat sb-coins" data-ui data-action="open-paywall" aria-label="${t("hud.menu.coinBalance", undefined, "coins")}: ${formatNumberLocalized(s.wallet)}">
        <span class="sb-icon" aria-hidden="true">${menuIconSm("coin")}</span>
        <b>${formatNumberLocalized(s.wallet)}</b>
        <small>coins</small>
      </button>
      <span class="sb-divider" aria-hidden="true"></span>
      <button class="sb-stat sb-pass" data-ui data-action="open-pass" aria-label="${t("hud.menu.nestPass", undefined, "Nest Pass")} level ${s.season.tier}">
        <span class="sb-icon" aria-hidden="true">${menuIcon("pass")}</span>
        <b>Lv.${s.season.tier}</b>
        <small>nest pass</small>
        <span class="sb-prog" style="--pct:${Math.round(s.season.tier / Math.max(1, s.season.maxTier) * 100)}%" aria-hidden="true"></span>
      </button>
      <span class="sb-divider" aria-hidden="true"></span>
      <button class="sb-stat sb-best" data-ui data-action="open-progress" aria-label="${t("hud.menu.personalBest", undefined, "Personal best")}: ${distanceText(s.bestDistance)}">
        <span class="sb-icon" aria-hidden="true">${menuIconSm("medal")}</span>
        <b>${distanceText(s.bestDistance)}</b>
        <small>best flight</small>
      </button>
    </div>
  `;
}
