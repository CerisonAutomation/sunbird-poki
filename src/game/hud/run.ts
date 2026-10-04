/**
 * The in-run surfaces: the results card, the continue offer, the ad break,
 * and the versus result.
 *
 * Pure string builders over `HudSnapshot` — no DOM access. The results card
 * is the widest reader in the HUD (60 of the snapshot's 227 fields), the one
 * screen that legitimately needs most of the state.
 */
import { adEscapeArmed, adEscapeCountdown } from "../adGate";
import { formatNumberLocalized, t } from "../../i18n";
import { flightTakeaway } from "../FlightGuidance";
import { growthLedger } from "../GrowthLedger";
import { clockSvg, iconGlyph, menuIcon, menuIconSm } from "../MenuIcons";
import { type CelebrationView } from "../ProgressBeats";
import { type RacerStats } from "../Racer";
import { nextBird } from "../ShopBrowse";
import { PORTAL_DISPLAY_NAME, SELL_AD_REMOVAL } from "../edition";
import { escapeHtml, sectionTitle } from "./kit";
import { type HudSnapshot } from "./types";
import { distanceText, renderGoalList, renderMissions, renderQuests, renderScoreTable } from "./parts";

export function renderGameOver(s: Pick<HudSnapshot, "balloons" | "bestDistance" | "biomeEmoji" | "biomeName" | "board" | "boardMetric" | "boardScope" | "campaignDone" | "campaignTotal" | "celebration" | "challengeOutcome" | "claimedQuests" | "coins" | "distance" | "duel" | "duelDelta" | "duelWas" | "endReason" | "expShareFirst" | "firstSteps" | "flightPath" | "ghostDelta" | "highScores" | "island" | "massRace" | "mastery" | "missions" | "modeId" | "modeName" | "multiplierClaimed" | "nearMiss" | "nestLevel" | "nestMult" | "newBest" | "newlyCompleted" | "nextAction" | "p1Stats" | "p2Stats" | "perfects" | "photoFinish" | "portalName" | "quests" | "raceField" | "raceFinishM" | "raceFinishTime" | "racePlace" | "raceRated" | "raceVerified" | "ratingBonus" | "ratingDelta" | "rings" | "rival" | "roomCode" | "score" | "season" | "sessionGoals" | "share" | "shareBusy" | "skins" | "slopeChain" | "slopeScore" | "sunflowers" | "trophyCounts" | "versus" | "versusWinner" | "wallet" | "wings" | "zeniths">): string {
  if (s.versus && s.p1Stats && s.p2Stats) return renderVersusResult(s);
  const questTotal = s.claimedQuests.reduce((a, q) => a + q.reward, 0);
  const deltaTxt =
    s.raceRated && s.ratingDelta !== 0
      ? `<span class="rate-delta ${s.ratingDelta > 0 ? "up" : "down"}">${s.ratingDelta > 0 ? "+" : ""}${s.ratingDelta}</span>`
      : "";
  const duelStrip =
    s.duelWas !== ""
      ? `<div class="race-hero ${s.duelWas === "won" ? "win" : ""}">
           <div class="race-medal">${menuIconSm("swords")}${s.duelWas === "won" ? menuIconSm("medal_1") : ""}</div>
           <div class="race-place"><b>DUEL ${s.duelWas === "won" ? "WON" : "LOST"}</b><span>${s.duelWas === "won" ? "+" : ""}${s.duelDelta} rating → ${s.rival.rating}</span></div>
           <div class="race-rating">Duel record ${s.duel.wins}–${s.duel.losses} · ${menuIconSm("fire")}${s.duel.streak} streak<span class="race-rated-tag">ranked · local</span></div>
         </div>`
      : "";
  const raceStrip =
    s.duelWas === "" && s.massRace
      ? s.racePlace > 0
        ? `<div class="race-hero ${s.racePlace === 1 ? "win" : s.racePlace <= 3 ? "podium" : ""}">
           <div class="race-medal">${menuIconSm(s.racePlace === 1 ? "medal_1" : s.racePlace === 2 ? "medal_2" : s.racePlace === 3 ? "medal_3" : "flag")}</div>
           <div class="race-place"><b>P${s.racePlace}</b><span>of ${s.raceField} pilots · ${s.raceFinishTime.toFixed(1)}s</span></div>
           ${s.raceVerified ? `<div class="verified-tag">✓ placement refereed by the room server</div>` : ""}
           <div class="race-bar"><i style="width:${Math.round((1 - (s.racePlace - 1) / Math.max(1, s.raceField)) * 100)}%"></i></div>
           ${
             s.raceRated
               ? `<div class="race-rating">Rival rating ${s.rival.rating} ${deltaTxt}<span class="race-rated-tag">ranked · local</span></div>`
               : `<div class="race-rating"><span class="race-rated-tag">casual · rating frozen</span></div>`
           }
           ${
             s.rival.streak >= 2
               ? `<div class="race-streak">${menuIconSm("fire")} ${s.rival.streak}-race win streak${s.ratingBonus > 0 ? ` · +${s.ratingBonus}● streak bonus` : ""}</div>`
               : ""
           }
         </div>
         ${s.photoFinish ? `<div class="reward-strip photo">${menuIconSm("photo")} ${escapeHtml(s.photoFinish)}</div>` : ""}
`
        : `<div class="race-hero dnf">
           <div class="race-medal">${menuIconSm("boom")}</div>
           <div class="race-place"><b>${s.modeId === "pvp_knockout" ? "KNOCKED OUT" : "RACE INCOMPLETE"}</b><span>${s.modeId === "pvp_knockout" ? // Not a timer. Knockout gates every 500 m of distance
              // (Game.nextKnockoutDist), so blaming a clock contradicted the mode
              // card's own blurb on the same product.
              "Fell behind the elimination gate" : `DNF · Reached ${Math.round(s.distance)}m of ${s.raceFinishM}m`}</span></div>
           ${
             s.raceRated
               ? `<div class="race-rating">Rival rating ${s.rival.rating} ${deltaTxt}<span class="race-rated-tag">ranked · local</span></div>`
               : `<div class="race-rating"><span class="race-rated-tag">casual · rating frozen</span></div>`
           }
         </div>`
      : "";
  // Clipboard score fallback — always visible when AUDS isn't available so
  // players always have *some* share action on the results screen.
  const clipboardShare = !s.share.available && !s.share.loaded && !s.share.code
    ? `<button class="soft-btn wide" data-ui data-action="copy-score">${menuIconSm("clipboard")} Copy score to clipboard</button>`
    : "";

  // Async multiplayer by code. Only rendered when this build can actually
  // talk to AUDS (Poki + game id) or when the player has already loaded a run.
  const shareBlock =
    s.share.available || s.share.loaded || s.share.code
      ? `
    <div class="share-run">
      ${sectionTitle("link", "Shared run", "friend's code · async race")}
      ${
        s.share.code
          ? `<div class="friend-row"><span class="fr-name">${t("hud.renderGameOver.RCode", undefined, "Run code")}</span><span class="fr-code">${escapeHtml(s.share.code)}</span><button class="mini-btn" data-ui data-action="copy-share">${t("hud.renderGameOver.CCode", undefined, "Copy code")}</button></div>`
          : `<button class="soft-btn wide" data-ui data-action="share-run" ${s.share.busy ? "disabled" : ""}>${s.share.busy ? "Publishing…" : "Share this run for a friend"}</button>`
      }
      <div class="redeem">
        <input data-ui data-enter-action="load-run" aria-label="${t("hud.renderNextFlight.SRunCode", undefined, "Shared run code")}" placeholder="A friend's run code" maxlength="40" autocomplete="off" spellcheck="false" />
        <button class="mini-btn" data-ui data-action="load-run" ${s.share.busy ? "disabled" : ""}>Load</button>
      </div>
      ${
        s.share.loaded
          ? `<div class="pilot-note">Loaded <b>${escapeHtml(s.share.loaded.name)}</b>'s run — ${formatNumberLocalized(Math.round(s.share.loaded.distance))} m on the same hills. <button class="mini-btn gold" data-ui data-action="race-share">${t("hud.renderGameOver.RTheirMark", undefined, "Race their mark")}</button></div>`
          : ""
      }
      ${s.share.error ? `<div class="pilot-note warn" role="status">${escapeHtml(s.share.error)}</div>` : ""}
    </div>`
      : "";

  return `
    <div class="results-kicker">${escapeHtml(s.modeName)} · ${t("hud.gameover.flightRecap", undefined, "flight recap")}</div>
    <h2>${escapeHtml(
      s.massRace
        ? s.racePlace === 1
          ? "Race won!"
          : s.racePlace <= 3 && s.racePlace > 0
            ? "Podium finish!"
            : s.racePlace > 0
              ? "Race finished"
              : "Knocked out"
        : (END_REASON_TITLE[s.endReason] ?? "Flight completed")
    )}</h2>
    <p class="end-reason">${escapeHtml(s.massRace ? "" : (END_REASON_LINE[s.endReason] ?? ""))}</p>
    <p class="tagline">${s.massRace ? t("hud.gameover.massraceTagline", undefined, "Your place, your progress, your next race.") : t("hud.gameover.soloTagline", undefined, "A little farther. A little smoother. One more flight?")}</p>
    <div class="result-actions"><button class="play-again-btn" data-ui data-action="${resultsPrimaryAction(s)}">${s.massRace && s.roomCode ? t("hud.gameover.backToLobby", undefined, "Back to race lobby") : s.massRace && s.racePlace > 0 ? t("hud.gameover.raceAgain", undefined, "Race again · same stakes") : t("hud.gameover.flyAgain", undefined, "Fly Again")}</button><button class="soft-btn" data-ui data-action="menu">${t("hud.gameover.mainMenu", undefined, "Main Menu")}</button></div>
    ${!s.massRace ? `<p class="fineprint replay-note">${t("hud.gameover.replayNote", undefined, "Fly again replays this exact course so you can race the ghost of the run you just flew 👻")}</p>` : ""}
    ${s.newBest ? `<div class="new-best">${menuIconSm("crown")} ${t("hud.gameover.newBest", undefined, "NEW BEST")} · ${distanceText(s.distance)}<small>${t("hud.gameover.farthestFlight", undefined, "your farthest flight yet")}</small></div>` : ""}
    ${s.boardScope === "global" && s.boardMetric === "distance" && s.board && s.board.yourRank > 0 ? `<div class="reward-strip rank-strip">${t("hud.gameover.leaderboardRank", undefined, "Leaderboard rank")} · <b>#${s.board.yourRank}</b> of ${s.board.total}</div>` : ""}

    ${shareBlock}
    ${renderCelebration(s)}
    ${renderFlightRecap(s.flightPath)}
    <div class="over-stats meta-progress-strip">
      <div><span>${menuIconSm("bird")} Migration</span><b>${s.campaignDone}/${s.campaignTotal} legs</b></div>
      <div><span>${menuIconSm("trophy")} Trophies</span><b>${s.trophyCounts.unlocked}/${s.trophyCounts.total}</b></div>
      <div><span>${menuIcon("pass")} Nest Pass</span><b>Lv.${s.season.tier}/${s.season.maxTier}</b></div>
    </div>
    <div class="over-stats result-summary">
      <div><span>${t("hud.stat.distance", undefined, "Distance")}</span><b>${distanceText(s.distance)}</b></div>
      <div><span>${t("hud.stat.score", undefined, "Score")}</span><b>${formatNumberLocalized(Math.floor(s.score))}</b></div>
      <div><span>${t("hud.stat.coins", undefined, "Coins")}</span><b>${formatNumberLocalized(s.coins)}</b></div>
    </div>

    <div class="btn-row result-links">
      <button class="soft-btn gold-tint" data-ui data-action="open-shop">${menuIcon("shop")} Shop</button>
      <button class="soft-btn" data-ui data-action="open-pass">${menuIcon("pass")} Pass</button>
      <button class="soft-btn" data-ui data-action="open-atlas">${menuIcon("atlas")} Atlas</button>
    </div>
    ${!s.firstSteps.shop ? `<div class="reward-strip new-player-shop-cta">
      <b>${menuIconSm("coin")} You have ${formatNumberLocalized(s.wallet)} coins</b> — spend them in the Shop: boosts from 40, birds from 150
      <button class="soft-btn wide gold-tint" style="margin-top:8px" data-ui data-action="open-shop">${menuIcon("shop")} Open Shop</button>
    </div>` : ""}
    ${s.nextAction ? `<p class="next-action">${escapeHtml(s.nextAction)}</p>` : ""}

    ${renderCoinMultiplierCard(s.coins, s.multiplierClaimed, s.portalName !== "none")}

    ${renderNextFlight(s)}
    <details class="result-details"><summary>${t("hud.renderGameOver.FDetails", undefined, "Flight details ")}<span>Landmarks &amp; skill</span></summary><div class="over-stats">
      <div><span>Perfects</span><b>${s.perfects}</b></div>
      <div><span>${t("hud.renderGameOver.SMoments", undefined, "Skyline moments")}</span><b>${s.zeniths}</b></div>
      <div><span>Rings</span><b>${s.rings}</b></div>
      <div><span>Balloons</span><b>${s.balloons}</b></div>
      <div><span>Sunflowers</span><b>${s.sunflowers}</b></div>
      <div><span>${t("hud.renderGameOver.SFlow", undefined, "Slope flow")}</span><b>${s.slopeScore} pts · ×${s.slopeChain}</b></div>
      <div><span>Islands</span><b>${s.island + 1}</b></div>
    </div></details>
    ${s.ghostDelta !== null ? `<div class="reward-strip ${s.ghostDelta >= 0 ? "" : "nest"}">${s.ghostDelta >= 0 ? `Beat your ghost by ${Math.round(s.ghostDelta)}m! ${menuIconSm("ghost")}` : `${Math.round(-s.ghostDelta)}m behind your best ghost`}</div>` : ""}
    ${questTotal ? `<div class="reward-strip">Daily quest${s.claimedQuests.length > 1 ? "s" : ""} complete · +${questTotal} coins</div>` : ""}
    ${s.newlyCompleted.length ? `<div class="reward-strip nest">Nest upgraded → Lv.${s.nestLevel} · ×${s.nestMult.toFixed(2)} score</div>` : ""}
    ${s.nearMiss ? `<div class="nearmiss">${s.nearMiss}</div>` : ""}
    ${s.challengeOutcome ? `<div class="reward-strip ${s.challengeOutcome.includes("missed") ? "nest" : ""}">${escapeHtml(s.challengeOutcome)}</div>` : ""}
    ${duelStrip}
    ${raceStrip}
    <div class="reached-strip">Reached <b>${menuIconSm(s.biomeEmoji)} ${s.biomeName}</b> · Island ${s.island + 1}</div>

    ${clipboardShare}
    ${s.expShareFirst
      ? `<button class="soft-btn wide" data-ui data-action="share" ${s.shareBusy ? "disabled" : ""}>${s.shareBusy ? "Preparing…" : `${menuIcon("share")} Share this flight`}</button>
         <button class="soft-btn wide" data-ui data-action="throw-challenge">${menuIcon("versus")} Challenge a rival on these hills</button>`
      : `<button class="soft-btn wide" data-ui data-action="throw-challenge">${menuIcon("versus")} Challenge a rival on these hills</button>
         <button class="soft-btn wide" data-ui data-action="share" ${s.shareBusy ? "disabled" : ""}>${s.shareBusy ? "Preparing…" : `${menuIcon("share")} Share this flight`}</button>`}
    <details class="result-details"><summary>Progress &amp; rewards <span>Goals, quests &amp; records</span></summary>
    ${renderGoalList(s.sessionGoals)}
    ${renderQuests(s.quests)}
    ${renderMissions(s.missions, s.newlyCompleted)}
    <h3 class="table-title">${t("hud.renderGameOver.HGlides", undefined, "High glides")}</h3>
    ${renderScoreTable(s.highScores.slice(0, 5))}</details>
    <button class="soft-btn wide results-shop-cta" data-ui data-action="open-shop">${menuIcon("shop")} Shop — birds, boosts &amp; trails</button>
  `;
}

/**
 * The two lines that turn a result into progress: the ranked beats, then the
 * growth ledger underneath.
 *
 * The ledger is derived here, from the two ladders the snapshot *already*
 * carries (`wings` and this flight's `mastery` row), because that is what
 * `GrowthLedger.ts` was written against: "This module decides what the card
 * says; `HUD.ts` only renders it." It is deliberately not a separate snapshot
 * field — that would be a second copy of state the snapshot already has, which
 * is the failure mode this whole card was built to avoid.
 *
 * The ledger is a `<dl>` because it is a set of terms (a ladder and its
 * remaining distance) and not a list of beats: assistive tech gets one
 * announcement per line, and the decorative bar is `aria-hidden` because the
 * text beside it already says the same thing.
 */
export function renderCelebration(s: Pick<HudSnapshot, "celebration" | "mastery" | "modeId" | "wings">): string {
  const cel = s.celebration;
  const lines = growthLedger(s.wings, s.mastery.find((m) => m.modeId === s.modeId) ?? null);
  const ledger = lines
    .map(
      (l) => `<div class="gl-row gl-${escapeHtml(l.kind)}">
        <dt><i aria-hidden="true">${escapeHtml(l.icon)}</i><span class="gl-label">${escapeHtml(l.label)}</span></dt>
        <dd><span>${escapeHtml(l.detail)}</span><i class="gl-bar" aria-hidden="true"><b style="width:${(l.progress * 100).toFixed(1)}%"></b></i></dd>
      </div>`,
    )
    .join("");
  const growth = `<div class="growth-ledger"><span class="gl-title">${escapeHtml(t("hud.progress.strip", undefined, "What this flight grew"))}</span>${
    ledger ? `<dl>${ledger}</dl>` : ""
  }</div>`;
  if (!cel || (!cel.staged.length && !cel.ledger.length && !cel.folded)) return growth;
  const beatEl = (b: CelebrationView["staged"][0], withDelay = true): string => {
    const cls = ["beat", b.rarity, b.banner ? "banner" : ""].filter(Boolean).join(" ");
    const delay = withDelay ? ` style="animation-delay:${b.delayMs}ms"` : "";
    const text = t(b.key, b.params, b.fallback);
    // `b.icon` is an icon NAME ("trophy", "egg", "badge"), not art and not a
    // glyph. It used to be `escapeHtml(b.icon)` — the name, escaped, as the
    // row's leading text — so every beat on the results card rendered its own
    // caption in place of its picture: "egg Nest upgraded!", "trophy Trophy:
    // Cloud Nine". `menuIconSm` draws the SVG; an unknown name draws nothing,
    // and can no longer become a word (see MenuIcons).
    //
    // Merge note: main's markup (the .beat-icon / .beat-text hooks) is kept
    // because the icon needs a sized slot of its own — a bare <i> in the text
    // flow is part of why these rows collided. The arena branch's glyph
    // fallback is kept too: several beat names have a text glyph but no
    // authored artwork, and under main's contract `iconGlyph` returns "" for
    // anything unknown, so this degrades to empty rather than to a word.
    const mark = menuIconSm(b.icon) || escapeHtml(iconGlyph(b.icon));
    return `<div class="${cls}" role="listitem"${delay}><i class="beat-icon" aria-hidden="true">${mark}</i><span class="beat-text">${escapeHtml(text)}</span></div>`;
  };
  const stageBits = cel.staged.map((b) => beatEl(b)).join("");
  const ledgerBits = cel.ledger.map((b) => beatEl(b, false)).join("");
  const moreBit = cel.folded > 0 ? `<div class="beat more" role="listitem">${escapeHtml(t("hud.progress.more", { n: cel.folded }, `+${cel.folded} more from this flight`))}</div>` : "";
  const beatRow = ledgerBits || moreBit ? `<div class="beat-row">${ledgerBits}${moreBit}</div>` : "";
  return `<div class="celebration" role="list" aria-label="${escapeHtml(t("hud.progress.strip", undefined, "What this flight grew"))}">${stageBits}${beatRow}</div>${growth}`;
}

export function renderNextFlight(s: Pick<HudSnapshot, "bestDistance" | "distance" | "island" | "perfects" | "skins" | "wallet">): string {
  const lesson = flightTakeaway(s), bird = nextBird(s.skins);
  return `<section class="next-flight" aria-label="${t("hud.renderAd.NFlightPlan", undefined, "Next flight plan")}"><span class="next-flight-art">${menuIcon("compass")}</span><div><small>${t("hud.renderNextFlight.TINTONEXTFLIGHT", undefined, "TAKE THIS INTO YOUR NEXT FLIGHT")}</small><b>${lesson.title}</b><p>${lesson.tip}</p>${bird ? `<p class="next-unlock">${s.wallet >= bird.def.price ? `${bird.def.name} is within reach · ${bird.def.price} coins in the Shop` : `${bird.def.name} · ${bird.def.price - s.wallet} more coins to unlock`}</p>` : ""}</div></section>`;
}

/** The run's silhouette: an SVG sparkline of the altitude profile. */
export function renderFlightRecap(path: [number, number][]): string {
  if (path.length < 3) return "";
  const w = 320;
  const hgt = 64;
  let maxX = 1;
  let maxY = 12;
  for (const [x, y] of path) {
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const px = (x: number): number => (x / maxX) * (w - 4) + 2;
  const py = (y: number): number => hgt - 4 - (Math.max(0, y) / maxY) * (hgt - 10);
  const line = path.map(([x, y], i) => `${i === 0 ? "M" : "L"}${px(x).toFixed(1)} ${py(y).toFixed(1)}`).join(" ");
  const area = `${line} L${px(path[path.length - 1]![0]).toFixed(1)} ${hgt - 2} L${px(path[0]![0]).toFixed(1)} ${hgt - 2} Z`;
  // Peak marker — the flight's zenith deserves a dot.
  let peak = path[0]!;
  for (const p of path) if (p[1] > peak[1]) peak = p;
  return `
    <div class="flight-recap" aria-label="${t("hud.renderGameOver.FAltitudeProfile", undefined, "Flight altitude profile")}">
      <svg viewBox="0 0 ${w} ${hgt}" preserveAspectRatio="none">
        <defs><linearGradient id="fr-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffb020" stop-opacity="0.55"/>
          <stop offset="1" stop-color="#ffb020" stop-opacity="0.05"/>
        </linearGradient></defs>
        <path d="${area}" fill="url(#fr-g)"/>
        <path d="${line}" fill="none" stroke="#e08a10" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        <circle cx="${px(peak[0]).toFixed(1)}" cy="${py(peak[1]).toFixed(1)}" r="3" fill="#ff6b4a"/>
      </svg>
      <span class="fr-peak">▲ ${Math.round(peak[1])} m peak</span>
    </div>`;
}

/**
 * End-of-run 3× coin bonus card. Pure and exported so the claim contract is
 * unit-testable: the bonus claims ONCE per run (Game.multiplierClaimed).
 * On portal builds the button triggers a rewarded ad (clapperboard glyph); on
 * direct builds it is a free bonus (MON-09: clapperboard only on rewarded
 * placements).
 */
export function renderCoinMultiplierCard(coins: number, claimed: boolean, rewarded = false): string {
  if (coins <= 0) return "";
  if (claimed) {
    return `<div class="multiplier-cta-card claimed">✓ 3× bonus applied &nbsp;+● ${formatNumberLocalized(coins * 2)} extra coins</div>`;
  }
  if (rewarded) {
    // Portal editions route the bonus through the platform's rewarded ad: the
    // reward is stated BEFORE the tap (Poki's rewarded-copy rule), the icon
    // marks it as an ad, and a declined ad never steals the card away.
    return `<div class="multiplier-cta-card">
      <div class="multiplier-cta-text">
        <b>3× Flight Coin Bonus</b>
        <span>Watch a short ad · triple ● ${coins} → ● ${coins * 3}</span>
      </div>
      <button class="primary-btn gold wide" data-ui data-action="multiply-run-coins">${menuIconSm("play")} Watch → 3× &nbsp;+● ${formatNumberLocalized(coins * 2)}</button>
    </div>`;
  }
  return `<div class="multiplier-cta-card">
      <div class="multiplier-cta-text">
        <b>3× Flight Coin Bonus</b>
        <span>Triple ● ${coins} → ● ${coins * 3}</span>
      </div>
      <button class="primary-btn gold wide" data-ui data-action="multiply-run-coins">Claim 3× &nbsp;+● ${formatNumberLocalized(coins * 2)}</button>
    </div>`;
}

export function renderVersusResult(s: Pick<HudSnapshot, "p1Stats" | "p2Stats" | "versusWinner">): string {
  const a = s.p1Stats!;
  const b = s.p2Stats!;
  const row = (label: string, x: number, y: number, fmt: (n: number) => string): string => {
    const win = x === y ? 0 : x > y ? 1 : 2;
    const max = Math.max(x, y, 1);
    return `<div class="vs-stat">
      <span class="${win === 1 ? "w" : ""}">${fmt(x)}</span>
      <em>${label}<i class="vs-bars"><b class="l" style="width:${Math.round((x / max) * 100)}%"></b><b class="r" style="width:${Math.round((y / max) * 100)}%"></b></i></em>
      <span class="${win === 2 ? "w" : ""}">${fmt(y)}</span>
    </div>`;
  };
  const time = (r: RacerStats): string => (r.finishedAt > 0 ? `${r.finishedAt.toFixed(1)}s` : "DNF");
  const margin =
    a.finishedAt > 0 && b.finishedAt > 0 ? Math.abs(a.finishedAt - b.finishedAt).toFixed(1) + "s" : "by distance";
  return `
    <div class="vs-hero ${s.versusWinner === 1 ? "p1win" : "p2win"}">
      <span class="vs-crown-big">${menuIconSm("trophy")}</span>
      <div class="vs-winner">PLAYER ${s.versusWinner} WINS</div>
      <div class="vs-margin">by ${margin} · same device, same hills</div>
    </div>
    <div class="vs-head"><span class="p1">${menuIconSm("p1")} P1 · SPACE / left half</span><span class="p2">P2 · ENTER / right half ${menuIconSm("p2")}</span></div>
    <div class="vs-stats">
      <div class="vs-stat time"><span>${time(a)}</span><em>race time</em><span>${time(b)}</span></div>
      ${row("distance", a.distance, b.distance, (n) => `${Math.round(n)}m`)}
      ${row("max altitude", a.maxAltitude, b.maxAltitude, (n) => `${Math.round(n)}m`)}
      ${row("perfect ramps", a.perfects, b.perfects, (n) => String(n))}
      ${row("best combo", a.bestCombo, b.bestCombo, (n) => `×${n}`)}
      ${row("coins", a.coins, b.coins, (n) => String(n))}
      ${row("top speed", a.topSpeed, b.topSpeed, (n) => `${Math.round(n)}`)}
    </div>
    <button class="primary-btn hero" data-ui data-action="versus"><span class="hero-label">REMATCH</span><span class="hero-hint">swap sides for fairness</span></button>
    <button class="ghost-btn" data-ui data-action="menu">Menu</button>
  `;
}

export function renderContinue(s: Pick<HudSnapshot, "adAvailable" | "canAffordContinue" | "coins" | "continueCost" | "continueHighlight" | "continueReason" | "continueTimer" | "distance" | "gold" | "modeName" | "portalName" | "score" | "wallet">): string {
  const portal = s.portalName !== "none";
  // MON-19: the reason line is context-driven (record / near-best / streak /
  // momentum). It explains why this run is worth resuming — it never changes
  // what the options are, and the standard non-ad options stay in the primary
  // position above the rewarded one (MON-05…MON-08).
  // One card language for the whole app: the second-wind offer is a *recap*
  // screen like any other, so it uses the same kicker / heading / stat strip /
  // action row as the results card instead of the old bespoke "zzz" panel.
  // MON-05…MON-08 still hold: the standard options sit above the rewarded one,
  // the rewarded button keeps its clapperboard label, and "let it sleep" is a plain
  // exit — never hidden, never the only way out.
  return `
    <div class="results-kicker">${escapeHtml(s.modeName)} · flight recap</div>
    <h2>${t("hud.renderContinue.SWind", undefined, "Second wind?")}</h2>
    <p class="tagline">Sunbird is dozing off at ${distanceText(s.distance)}.</p>
    ${s.continueReason ? `<p class="continue-reason${s.continueHighlight ? " is-highlight" : ""}">${escapeHtml(s.continueReason)}</p>` : ""}
    <div class="over-stats result-summary">
      <div><span>${t("hud.stat.distance", undefined, "Distance")}</span><b>${distanceText(s.distance)}</b></div>
      <div><span>Score</span><b>${formatNumberLocalized(Math.floor(s.score))}</b></div>
      <div><span>${t("hud.stat.coins", undefined, "Coins")}</span><b>${formatNumberLocalized(s.coins)}</b></div>
    </div>
    ${s.adAvailable
      ? `<div role="status"><button class="reward-strip wake-strip wake-ad-btn" data-ui data-action="continue-ad">${menuIconSm("play")} ${portal ? "Watch for Second Wind" : "Watch a short clip → Second Wind"} · <b data-live="contTimer">${Math.ceil(s.continueTimer)}</b>s left ${clockSvg()}</button></div>`
      : `<div class="reward-strip wake-strip" role="status">${clockSvg()}<span>Second wind closes in <b data-live="contTimer">${Math.ceil(s.continueTimer)}</b>s</span></div>`}
    <div class="result-actions">
      <button class="play-again-btn ${s.canAffordContinue ? "" : "off"}" data-ui data-action="continue-coins" ${s.canAffordContinue ? "" : "disabled"}>Spend ● ${s.continueCost} <small>(you have ${s.wallet})</small></button>
      <button class="soft-btn" data-ui data-action="continue-sleep">${t("hud.renderContinue.LSleep", undefined, "Let it sleep")}</button>
    </div>
    ${!portal && s.gold ? `<button class="soft-btn wide" data-ui data-action="continue-gold">✦ Gold · free wake-up</button>` : ""}
    <p class="fineprint replay-note">Sleep ends the flight and shows your recap. Waking up keeps this run alive from where it landed.</p>
  `;
}

export function renderAd(s: Pick<HudSnapshot, "adElapsed" | "adReason" | "adSafetySeconds" | "adSkippable" | "adTimer" | "gold" | "portalName">): string {
  const portal = s.portalName !== "none";
  const canRemoveBreaks = SELL_AD_REMOVAL && !s.gold;
  const label = portal
    ? `${PORTAL_DISPLAY_NAME} · sponsored break`
    : `Sponsored break · ${s.adReason === "continue" ? "your second wind is loading…" : "back to flying in a moment"}`;
  const header = portal
    ? `Advertisement`
    : `Your ad is loading`;
  const subtext = portal
    ? `Your run is paused while the portal serves this break.`
    : `Back to flying in a moment.`;
  return `
    <div class="ad-label">${label}</div>
    <div class="portal-ad-wait"><div class="spinner"></div><h3>${header}</h3><p>${subtext}</p></div>
    <div class="ad-bar"><i data-live="adBar"></i></div>
    <div class="ad-actions">
      ${
        s.adSkippable
          // A placeholder break is NOT skippable either. This used to be a
          // `ad-skip` button that unlocked at zero — and since the game never
          // ended a placeholder break by itself, clicking it was the only way
          // out, which made "skip" the intended exit. The break now completes
          // on its own the instant the countdown lands (see Game.fixedUpdate),
          // so there is nothing here to press: this is a read-only status
          // chip, not a control.
          // `adSkippable` is `!portalEnabled()` (Game.ts), so this chip only ever
          // renders on a PLACEHOLDER break — one the game times itself — and
          // `adTimer` is therefore a real countdown on exactly this path. It
          // was briefly swapped for a flat "Second Wind loading…" when
          // adReason === "continue", which hid the only number that says when
          // a self-timed break ends. The portal path never reaches this branch;
          // it takes the escape hatch below, which has no number to show.
          ? `<div class="ad-countdown" role="status" data-live="adSkip">${clockSvg()}<span>Continues in <b>${Math.ceil(Math.max(0, s.adTimer))}</b>s</span></div>`
          // Escape hatch, NOT a skip. On a portal build `adTimer` is left at 0,
          // so this used to render enabled with a flat "Return to flight" from
          // the first frame of every break — one click skipped a real ad. It is
          // now inert until the break has demonstrably failed, with an honest
          // countdown so the control is never dead without saying why.
          // `Game.handleAction` enforces the same window independently.
          : (() => {
              const armed = adEscapeArmed(s.adElapsed, s.adSafetySeconds);
              const left = adEscapeCountdown(s.adElapsed, s.adSafetySeconds);
              return `<button class="mini-btn" data-ui data-action="ad-stuck"${armed ? "" : " disabled"}>${
                armed
                  ? "Return to flight"
                  : `${clockSvg()}<span>Break in progress — return in <b>${left}</b>s</span>`
              }</button>`;
            })()
      }
      ${canRemoveBreaks ? `<button class="mini-btn gold" data-ui data-action="ad-gold">✦ Remove breaks</button>` : ""}
    </div>
  `;
}

/**
 * The action behind the results card's primary button — and behind a tap on the
 * bare backdrop beside that card, which is the same affordance with a larger hit
 * area.
 *
 * A placed mass race rematches at the same stakes (an online field goes back
 * through the honest search; a duel or an AI flock replays locally). Every other
 * run just flies again.
 *
 * Both callers must agree, so the decision lives here instead of being
 * re-derived inline at each site. It previously existed only inside the render
 * string, and the backdrop tap dispatched `restart-flight` — an action `Game`
 * honours only while paused or playing, so tapping the results backdrop was a
 * silent no-op. It looked like it worked because a touch on the bare overlay
 * also armed the dive gesture and `holdToStart()` restarted the run that way;
 * once overlays stopped arming gameplay gestures (they own the finger, so the
 * card can scroll and the tap can land) that accidental path disappeared and the
 * dead action was exposed.
 */
export function resultsPrimaryAction(
  s: Pick<HudSnapshot, "duelWas" | "massRace" | "racePlace">,
): "rematch" | "retry" {
  return s.massRace && s.racePlace > 0 && !s.duelWas ? "rematch" : "retry";
}

/**
 * How each ending is named on the results card.
 *
 * Three deaths used to produce one card reading "Flight completed" — including
 * a settle-death that fires with most of the daylight still on the meter, which
 * cannot be read as "the sun won" by any player.
 */
const END_REASON_TITLE: Record<string, string> = {
  daylight: "The sun beat you",
  water: "You washed out",
  settled: "You stopped flying",
};

const END_REASON_LINE: Record<string, string> = {
  daylight: "Your daylight ran out. Each new island refills it — keep moving.",
  water: "The sea took the run. Hit the ramp before you run out of hill.",
  settled: "Four seconds without flying ends the run. Keep the dive going.",
};