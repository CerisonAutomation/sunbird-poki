/**
 * The competitive screens: the race lobby, ranked, the squad, AI practice and
 * the mode picker.
 */

import { formatNumberLocalized, t } from "../../i18n";
import { menuIcon, menuIconSm } from "../MenuIcons";
import { PVP_MODES } from "../Modes";
import { paginate } from "../Pagination";
import { type FriendChallenge } from "../SocialSystem";
import { SQUAD_QUESTS, squadQuestClaimState, squadQuestProgress, squadQuestScope } from "../Squad";
import { rivalPalette, skinPalette, skinShape, sunbirdSVG } from "../Sunbird";
import { SQUAD_CHAT } from "../edition";
import { seenAgo } from "../pilots";
import { SCREEN, escapeHtml, head, sectionTitle } from "./kit";
import { aiRivalSection, boardSource } from "./parts";
import { type HudSnapshot } from "./types";

export function renderLive(s: Pick<HudSnapshot, "firstSteps" | "lobbyRivals" | "multiplayerConfigured" | "netError" | "netState" | "pvpModes" | "pvpWorlds" | "roomAiFallback" | "roomCode" | "roomCount" | "roomReady" | "roomReadyCount" | "roomSize" | "roomSkill" | "selectedPvpMode" | "selectedPvpWorld" | "skins">): string {
  const connected = s.netState === "lobby" || s.netState === "racing";
  // The AI fallback seats four generated pilots in the same roster as real
  // ones, so "Connected" and "live" would both be claims about people who are
  // not there. The badge, the presence line and every peer row say AI instead.
  const status = s.roomAiFallback
    ? "AI flock · offline"
    : connected ? "Connected" : s.netState === "connecting" ? "Flock Ready" : "Local Flock";
  const live = s.lobbyRivals.filter((r) => r.tag.includes("live") || r.tag.includes("AI"));

  const modePills = s.pvpModes.map((m) => `
    <button class="pvp-pill ${s.selectedPvpMode === m.id ? "on" : ""}" data-ui data-action="select-pvp-mode" data-id="${m.id}" title="${m.blurb}">
      <span>${menuIconSm(m.icon)}</span> <b>${m.name}</b> <small>${m.finish}m</small>
    </button>
  `).join("");

  const worldPills = s.pvpWorlds.map((w) => `
    <button class="world-pill ${s.selectedPvpWorld === w.id ? "on" : ""}" data-ui data-action="select-pvp-world" data-id="${w.id}" title="${w.tagline}">
      <span>${menuIconSm(w.emoji)}</span> <b>${w.name}</b> <small>${w.difficulty}</small>
    </button>
  `).join("");

  const activeMode = s.pvpModes.find((m) => m.id === s.selectedPvpMode) ?? s.pvpModes[0] ?? { name: "Sprint GP", icon: "lightning", finish: 1500 };
  const activeWorld = s.pvpWorlds.find((w) => w.id === s.selectedPvpWorld) ?? s.pvpWorlds[0] ?? { name: "Emerald Circuit", emoji: "leaf" };

  return `${head(SCREEN.raceLobby)}
    ${!s.firstSteps.pvp ? `<div class="onboarding-card pvp-intro-card">
      <b>${menuIconSm("flock")} Welcome to the Race Lobby</b>
      <p>Race live against real players flying <b>the same hills</b>, same seed — pure skill, no luck.</p>
      <ul class="shop-intro-tips">
        <li><b>Ranked mode</b> — earn and lose rating. Climb the division ladder.</li>
        <li><b>Casual mode</b> — no rating at stake. Just racing.</li>
        <li><b>Private room</b> — share a code to race a friend head-to-head.</li>
        <li><b>AI flock</b> — always there, even offline. Same screen, just the bottom row.</li>
      </ul>
      <small>Store boosts are disabled in races — pure flight only.</small>
    </div>` : ""}
    <p class="tagline">Live pilots, private rooms, or the offline AI flock — both rivals live on this one screen.</p>
    ${s.netState === "error" && s.netError ? `<p class="network-notice" role="alert">${escapeHtml(s.netError)}</p>` : ""}
    <p class="race-fairness">${menuIcon("medal")} Equal flight equipment · your bird, your timing. Store boosts are saved for solo play.</p>

    ${s.roomCode ? `      <section class="race-section private-session" aria-label="${t("hud.renderLive.PRoom", undefined, "Your private room")}">
        <div class="race-section-head">
          <h3>${t("hud.renderLive.FRoom", undefined, "Flock Room: ")}<strong>${escapeHtml(s.roomCode)}</strong></h3>
          <span class="board-badge ${connected ? "live" : "island"}" role="status">${status}</span>
        </div>
        <div class="room-now">
          <span class="room-now-label">${t("hud.renderLive.ICode", undefined, "Invite code")}</span>
          <strong class="room-now-code">${escapeHtml(s.roomCode)}</strong>
          <button class="mini-btn" data-ui data-action="copy-invite">${t("hud.renderLive.CLink", undefined, "Copy link")}</button>
        </div>

        <div class="lobby-selector-box">
          <div class="lobby-selector-label"><span>${t("hud.renderLive.RFormat", undefined, "Race Format")}</span> <b>${menuIconSm(activeMode.icon)} ${activeMode.name} (${activeMode.finish} m)</b></div>
          <div class="pills-scroll">${modePills}</div>
          <div class="lobby-selector-label"><span>${t("hud.renderLive.WCircuit", undefined, "World Circuit")}</span> <b>${menuIconSm(activeWorld.emoji)} ${activeWorld.name}</b></div>
          <div class="pills-scroll">${worldPills}</div>
        </div>

        <p class="room-presence" role="status">${Math.max(1, s.roomCount)} ${s.roomAiFallback ? "in room · AI pilots" : "connected"} · ${s.roomReadyCount} ready</p>

        <div class="room-actions-bar">
          <button class="primary-btn gold large-btn" data-ui data-action="start-room-now">${menuIconSm("lightning")} Start Race Now (${s.roomCount > 1 ? "Launch Room" : "Fill with AI flock"})</button>
          <button class="soft-btn ${s.roomReady ? "on" : ""}" data-ui data-action="ready-room" aria-pressed="${s.roomReady}" ${connected ? "" : "disabled"} title="${connected ? "" : "Race connection lost — close the room to race again"}">${s.roomReady ? "Cancel ready" : "Ready up ✓"}</button>
        </div>

        <div class="room-flock" aria-label="${t("hud.renderLive.PRoomx", undefined, "Pilots in this room")}">
          <div class="room-bird ${s.roomReady ? "is-ready" : ""}">
            ${(() => {
              const mine = s.skins.find((v) => v.equipped);
              const def = mine?.def;
              return sunbirdSVG({ width: 48, animateWings: true, palette: def ? skinPalette(def) : undefined, shape: def ? skinShape(def) : undefined });
            })()}
            <b>You</b>
            <small>${s.roomReady ? "Ready ✓" : "In room"}</small>
          </div>
          ${live.slice(0, 7).map((p, i) => `
            <div class="room-bird ${p.ready ? "is-ready" : ""}">
              ${(() => {
                const def = s.skins.find((v) => v.def.id === p.skin)?.def;
                return sunbirdSVG({ width: 48, animateWings: true, palette: def ? skinPalette(def) : rivalPalette(i + 1), shape: def ? skinShape(def) : undefined });
              })()}
              <b>${escapeHtml(p.name)}</b>
              <small>${p.ready ? "Ready ✓" : s.roomAiFallback ? "AI pilot" : "In room"}</small>
            </div>
          `).join("")}
        </div>
        ${!live.length ? `<p class="fineprint">Just you so far — share the code above and the room fills with real pilots.</p>` : ""}
        ${s.roomCount > 8 ? `<p class="fineprint">And ${s.roomCount - 8} more ${s.roomAiFallback ? "AI pilots" : "connected pilots"}</p>` : ""}

        <button class="ghost-btn" data-ui data-action="room-close">${t("hud.renderLive.LRoom", undefined, "Leave room")}</button>
      </section>` : `
      <section class="race-section quick-match-hero" aria-label="${t("hud.renderLive.QMatch", undefined, "Quick Match")}">
        <div class="race-section-head">
          <h3>${menuIconSm("lightning")} Quick Match</h3>
          <span class="board-badge live">${t("hud.renderLive.LSearch", undefined, "Live search")}</span>
        </div>
        <p class="qm-desc">Search this circuit for live pilots. If nobody answers, you choose — keep waiting or race the AI flock.</p>

        <div class="quick-match-btns">
          <button class="primary-btn gold large-btn" data-ui data-action="quick-match-instant">${menuIconSm("lightning")} ${activeMode.name} on ${activeWorld.name}</button>
          <button class="soft-btn" data-ui data-action="quick-match-shuffle">${menuIconSm("dice")} Surprise me — random race</button>
          <button class="soft-btn" data-ui data-action="pvp-casual">${t("hud.renderLive.SOnlinePilots", undefined, "Search Online Pilots")}</button>
        </div>

        <details class="customize-race">
          <summary>Customize · format &amp; world (${activeMode.name} · ${activeWorld.name})</summary>
          <div class="lobby-selector-box">
            <div class="lobby-selector-label"><span>${t("hud.renderLive.PFormat", undefined, "PvP Format")}</span> <b>${menuIconSm(activeMode.icon)} ${activeMode.name} (${activeMode.finish} m)</b></div>
            <div class="pills-scroll">${modePills}</div>
            <div class="lobby-selector-label"><span>${t("hud.renderLive.WCircuitx", undefined, "World Circuit")}</span> <b>${menuIconSm(activeWorld.emoji)} ${activeWorld.name}</b></div>
            <div class="pills-scroll">${worldPills}</div>
          </div>
        </details>
      </section>

      <section class="race-section room-entry" aria-label="${t("hud.renderLive.IFriends", undefined, "Invite friends")}">
        <div class="room-entry-crest">${menuIcon("online")}</div>
        <h3>${t("hud.renderLive.FFlock", undefined, "Fly with your flock")}</h3>
        ${s.multiplayerConfigured
          ? `<p>Create a private room with a custom code and link. Race your squad on any course!</p>
        <button class="primary-btn" data-ui data-action="host-room">${t("hud.renderLive.CPrivateRoom", undefined, "Create Private Room")}</button>`
          : `<p class="pilot-note island" role="note">Live rooms are not available in this edition. AI practice and same-screen 1v1 below still race.</p>
        <button class="primary-btn" data-ui data-action="host-room" disabled>${t("hud.renderLive.CPrivateRoomx", undefined, "Create Private Room")}</button>`}
        <!-- Room-code entry is shared markup: the id must exist exactly once
             in the document (duplicate ids break label/for and getElementById). -->
        <label class="field-label" for="race-room-code">${t("hud.renderLive.EFriendSRoomCode", undefined, "Or enter a friend's room code")}</label>
        <div class="redeem">
          <input id="race-room-code" data-ui data-ref="roomCode" data-enter-action="join-room" aria-label="${t("hud.renderLive.RCode", undefined, "Room code")}" maxlength="2048" placeholder="Code or invite link" autocomplete="off" autocapitalize="characters" spellcheck="false" />
          <button class="mini-btn" data-ui data-action="join-room" ${s.multiplayerConfigured ? "" : "disabled"}>Join</button>
        </div>
      </section>
      <nav class="destination-grid" aria-label="${t("hud.renderLive.MWaysRace", undefined, "More ways to race")}">
        <button class="destination" data-ui data-action="open-practice"><span class="destination-art">${menuIcon("compass")}</span><span class="destination-copy"><b>${t("hud.renderLive.APracticeOnly", undefined, "AI practice only")}</b><span>${t("hud.renderLive.SLobbyStraightFlock", undefined, "Skip the lobby — straight to the flock")}</span></span></button>
        <button class="destination" data-ui data-action="versus"><span class="destination-art">${menuIcon("versus")}</span><span class="destination-copy"><b>${t("hud.renderLive.SScreen1v1", undefined, "Same-screen 1v1")}</b><span>${t("hud.renderLive.LSplitScreenFlight", undefined, "Local split-screen flight")}</span></span></button>
        <button class="destination" data-ui data-action="open-squad"><span class="destination-art">${menuIcon("squad")}</span><span class="destination-copy"><b>Squad</b><span>${SQUAD_CHAT ? "Friends &amp; club chat" : "Friends &amp; clubs"}</span></span></button>
      </nav>`}
    <!-- The other half of the PvP offer, on the same screen as the lobby rather
         than behind a second home tile: an offline AI race is a rival, and
         picking an opponent is the player's decision, not the menu's. -->
    <div class="section-title race-rival-divider"><span>${t("hud.renderLive.RAI", undefined, "Or race the AI")}</span><small>${t("hud.renderLive.ONOWAITING", undefined, "OFFLINE · NO WAITING")}</small></div>
    ${aiRivalSection(s)}
    <button class="soft-btn wide" data-ui data-action="open-shop">${t("hud.changeLoadout", undefined, "Change loadout")}</button>
    <p class="fineprint">${t("hud.loadoutTip", undefined, "Hold downhill to build speed. Release uphill to launch. Slipstream behind rivals for slingshot surges!")}</p>`;
}

export function renderRank(s: Pick<HudSnapshot, "duel" | "duelFoe" | "loadout" | "rival" | "skins">): string {
  const r = s.rival;
  const wl = r.wins + r.losses > 0 ? Math.round((r.wins / (r.wins + r.losses)) * 100) : 0;
  return `
    ${head(SCREEN.rivalRank, "back", `<span class="pill">${boardSource(s).chip}</span>`)}
    <div class="rank-hero">
      <div class="rank-div-big">${r.divisionIcon}</div>
      <div class="rank-hero-num">${r.rating}</div>
      <div class="rank-hero-div">${r.division}</div>
      <div class="rank-bar big"><i style="width:${Math.round(r.progress * 100)}%"></i></div>
      <div class="rank-hero-next">${r.nextNeeded > 0 ? `${formatNumberLocalized(Math.round(r.nextNeeded))} rating to ${r.nextName}` : "Top division — defend it"}</div>
    </div>
    <div class="rank-stats">
      <div><span>W–L</span><b>${r.wins}–${r.losses}</b></div>
      <div><span>${t("hud.renderRank.WRate", undefined, "Win rate")}</span><b>${wl}%</b></div>
      <div><span>Streak</span><b class="streak-b ${r.streak > 0 ? "lit" : ""}"><svg viewBox="0 0 24 24" class="fl"><path d="M12 2C13 6 17 8 17 13a5 5 0 0 1-10 0c0-2 1-3.4 2-4.6 0 1.6.6 2.6 1.8 3 -.4-3.4 1.4-6.6 1.2-9.4z" fill="currentColor"/></svg>${r.streak}</b></div>
      <div><span>Best</span><b>×${r.bestStreak}</b></div>
    </div>
    <div class="season-card">
      <div class="season-head"><b>Season</b><span class="pill">${r.season.daysLeft}d left</span></div>
      <div class="season-body">Peak ${r.season.peakIcon} ${r.season.peak} · pays <b>● ${r.season.rewardCoins}</b> at reset, then ratings drift halfway back to 1000.</div>
    </div>
    ${sectionTitle(null, "Recent races", "this device only")}
    ${
      r.matches.length
        ? `<div class="match-list">${[...r.matches]
            .reverse()
            .map(
              (m) =>
                `<div class="match-row ${m.won ? "won" : ""}"><span class="m-place">${m.won ? menuIconSm("medal") : ""}P${m.place}</span><span class="m-meta">of ${m.field} · ${escapeHtml(m.mode)}</span><span class="m-date">${escapeHtml(m.date)}</span></div>`,
            )
            .join("")}</div>`
        : `<p class="fineprint">${t("hud.renderRank.NRankedRacesYetFirst40BirdFinishSetsTone", undefined, "No ranked races yet. Your first 40-bird finish sets the tone.")}</p>`
    }
    ${sectionTitle(null, "Duels", "ranked 1v1 · ±16 rating")}
    <div class="duel-card">
      <div class="vs-stage slim">
        <div class="vs-you"><span class="bird-badge you">${(() => {
        // The badge sat directly above the line that names the bird you are
        // flying, and drew the default Sunbird in default orange — so the one
        // place a ranked player checks their own bird showed them the wrong one.
        const mine = s.skins.find((v) => v.equipped) ?? s.skins.find((v) => v.owned);
        const def = mine?.def;
        return sunbirdSVG({ palette: def ? skinPalette(def) : undefined, shape: def ? skinShape(def) : undefined, width: 62, animateWings: true, title: def ? def.name : "Your sunbird" });
      })()}</span><b>YOU</b><span class="vs-sub">${r.rating}</span></div>
        <div class="vs-mark">VS</div>
        <div class="vs-foes"><div class="vs-foe"><span class="bird-badge">${sunbirdSVG({ palette: rivalPalette(0), width: 54, flap: 0.35, title: s.duelFoe.name })}</span><b>${escapeHtml(s.duelFoe.name)}</b><span class="vs-sub">${escapeHtml(s.duelFoe.tag)} · ~${s.duelFoe.rating}</span></div></div>
      </div>
      <div class="rank-stats">
        <div><span>Duel W–L</span><b>${s.duel.wins}–${s.duel.losses}</b></div>
        <div><span>Streak</span><b class="streak-b ${s.duel.streak > 0 ? "lit" : ""}"><svg viewBox="0 0 24 24" class="fl"><path d="M12 2C13 6 17 8 17 13a5 5 0 0 1-10 0c0-2 1-3.4 2-4.6 0 1.6.6 2.6 1.8 3 -.4-3.4 1.4-6.6 1.2-9.4z" fill="currentColor"/></svg>${s.duel.streak}</b></div>
        <div><span>Best</span><b>×${s.duel.bestStreak}</b></div>
        <div><span>Prize</span><b>${s.duel.wins >= 10 ? `${menuIconSm("bird")} won` : `${s.duel.wins}/10`}</b></div>
      </div>
      <button class="primary-btn hero" data-ui data-action="pvp-duel"><span class="hero-label">${menuIconSm("swords")} DUEL</span><span class="hero-hint">1v1 · first to 4,000 m · win 10 for the Hummingbird</span></button>
      <p class="fineprint ranked-perk-note" title="${t("hud.renderCups.RModeCosmeticPerksAreBalancedFairPlay", undefined, "In ranked mode, cosmetic perks are balanced for fair play")}">${menuIconSm("shield")} In ranked duels, cosmetic perks are balanced for fair play — max +3% speed, +3s buffs, earned birds included. Flying <b>${escapeHtml(s.loadout.bird)}</b>: ${escapeHtml(s.loadout.rankedNote)}</p>
    </div>
    <button class="primary-btn race40 hero" data-ui data-action="pvp-ranked"><span class="hero-label">${menuIconSm("swords")} RACE RANKED</span><span class="hero-hint">climb or defend ${r.division}</span></button>
    <p class="fineprint">Your rating changes based on how you finish in ranked 40-bird races and duels. Reaching Sunbird Legend unlocks the Solstice bird. Seasons soft-reset monthly with a division reward.</p>
  `;
}

/** Exported so the Pilot Lookup panel can be tested without a live game. */
export function renderSquad(s: Pick<HudSnapshot, "bestDistance" | "friendChallenges" | "recentPilots" | "runsPlayed" | "squad" | "squadNotice" | "squadQuestsClaimed" | "today" | "todayBest">): string {
  const sq = s.squad;
  const friendPage = paginate(sq.friends, sq.friendPage);
  const clubPage = paginate(sq.clubs, sq.clubPage);
  const pages = (kind: string, view: { page: number; pages: number }): string => view.pages < 2 ? "" : `<nav class="collection-pager" aria-label="${kind} pages"><button class="mini-btn" data-ui data-action="squad-page" data-id="${kind}:${view.page - 1}" aria-label="Previous ${kind}" ${view.page === 0 ? "disabled" : ""}>‹</button><span>${view.page + 1} / ${view.pages}</span><button class="mini-btn" data-ui data-action="squad-page" data-id="${kind}:${view.page + 1}" aria-label="Next ${kind}" ${view.page === view.pages - 1 ? "disabled" : ""}>›</button></nav>`;
  const notice = s.squadNotice ? `<div class="reward-strip">${escapeHtml(s.squadNotice)}</div>` : "";

  const quests = `
    ${sectionTitle(null, "Squadron Team Quests", "Co-Op Milestones")}
    <div class="squad-quests">
      ${SQUAD_QUESTS.map((q) => {
        // One progress implementation, shared with the claim handler, and the
        // ledger decides visibility — so a spent reward leaves the screen
        // instead of leaving a button that pays again tomorrow.
        const prog = squadQuestProgress(q, s);
        const state = squadQuestClaimState(q, s, s.squadQuestsClaimed, s.today);
        return `<div class="squad-quest-card">
          <div class="sq-info"><b>${escapeHtml(q.title)}</b><span>${escapeHtml(q.desc)}</span></div>
          <div class="sq-action">
            ${state === "claimable"
              ? `<button class="mini-btn gold" data-ui data-action="claim-squad-quest" data-id="${q.id}">Claim ● ${q.rewardCoins}</button>`
              : state === "already-claimed"
              ? `<span class="sq-prog-label">✓ ${squadQuestScope(q) === "daily" ? t("hud.squad.claimedTodayBadge", undefined, "claimed today") : t("hud.squad.claimedBadge", undefined, "Claimed")}</span>`
              : `<span class="sq-prog-label">${prog}/${q.target}</span>`}
          </div>
        </div>`;
      }).join("")}
    </div>
  `;

  // ---------------------------------------------------------- pilot lookup
  // The panel never invents a pilot. Every row below is either a code the
  // service resolved, a wingman row the service returned, or a pilot this
  // device actually shared a room with.
  const lookup = sq.lookup;
  const lookupCard = (() => {
    if (!lookup) return "";
    if (lookup.status !== "ok") {
      const tone = lookup.status === "unavailable" ? "island" : "warn";
      return `<div class="pilot-note ${tone}" role="status">${escapeHtml(lookup.message)}${lookup.query ? ` <b>${escapeHtml(lookup.query)}</b>` : ""}</div>`;
    }
    const stats = [
      lookup.club ? `${menuIconSm("castle")} ${escapeHtml(lookup.club)}` : "",
      lookup.bestDistance > 0 ? `${menuIconSm("takeoff")} best ${formatNumberLocalized(lookup.bestDistance)} m` : "",
      lookup.rank > 0 ? `#${lookup.rank} global` : "",
    ].filter(Boolean).join(" · ");
    const action = lookup.friend
      ? `<span class="fineprint">${t("hud.renderCampaign.AWingmen", undefined, "Already in your wingmen")}</span>`
      : lookup.incoming
        ? `<button class="primary-btn" data-ui data-action="pilot-add" data-id="${escapeHtml(lookup.code)}">${t("hud.renderCampaign.ATheirRequest", undefined, "Accept their request")}</button>`
        : lookup.outgoing
          ? `<span class="fineprint">${t("hud.renderCampaign.RSentWaitingThem", undefined, "Request sent — waiting for them")}</span>`
          : `<button class="primary-btn" data-ui data-action="pilot-add" data-id="${escapeHtml(lookup.code)}">${menuIconSm("wing")} ${t("hud.pvp.addWingman", undefined, "Add wingman")}</button>`;
    return `
      <div class="pilot-card">
        <div class="pilot-card-head">
          <b>${escapeHtml(lookup.name)}</b>
          <span class="pilot-dot ${lookup.online ? "on" : ""}">${lookup.online ? "● Online now" : "○ Offline"}</span>
        </div>
        <div class="pilot-card-meta"><span class="pilot-code">${escapeHtml(lookup.code)}</span>${stats ? `<span>${stats}</span>` : ""}</div>
        <div class="pilot-card-actions">
          ${action}
          <button class="mini-btn" data-ui data-action="pilot-invite" data-id="${escapeHtml(lookup.name)}">${t("hud.renderCampaign.IMyRoom", undefined, "Invite to my room")}</button>
          <button class="mini-btn" data-ui data-action="pilot-copy" data-id="${escapeHtml(lookup.code)}">${t("hud.renderCampaign.CCode", undefined, "Copy code")}</button>
        </div>
      </div>`;
  })();

  const requests = (() => {
    const rows = [
      ...sq.requestsIn.map((r) => `<div class="friend-row"><span class="fr-name">${menuIconSm("mail_in")} ${escapeHtml(r.name)}</span><span class="fr-code">wants to fly with you</span><button class="mini-btn" data-ui data-action="req-accept" data-id="${escapeHtml(r.requestId)}">Accept</button><button class="mini-btn ghost" data-ui data-action="req-decline" data-id="${escapeHtml(r.requestId)}">Decline</button></div>`),
      ...sq.requestsOut.map((r) => `<div class="friend-row"><span class="fr-name">${menuIconSm("mail_out")} ${escapeHtml(r.name)}</span><span class="fr-code">request pending</span><button class="mini-btn ghost" data-ui data-action="req-cancel" data-id="${escapeHtml(r.requestId)}">Cancel</button></div>`),
    ];
    if (!rows.length) return "";
    return `${sectionTitle(null, "Requests", `${rows.length} waiting`)}<div class="friend-list">${rows.join("")}</div>`;
  })();

  const lookupPanel = `
    ${sectionTitle("search", "Pilot Lookup", sq.live && !sq.isAutonomous ? "online directory" : "offline build")}
    <p class="fineprint">Look a pilot up by their exact code. Results come from the pilot directory — nothing here is invented, and an unknown or unreachable code says so.</p>
    <div class="redeem">
      <input data-ui data-ref="pilotCode" data-enter-action="pilot-add" aria-label="${t("hud.renderCampaign.FCodex", undefined, "Friend code")}" placeholder="Friend code (SUN-9F3K2A)" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${escapeHtml(sq.pilotQuery)}" />
      <button class="mini-btn" data-ui data-action="pilot-lookup">${sq.lookupBusy ? "Looking…" : "Look up"}</button>
    </div>
    ${lookupCard}
    ${requests}`;

  const wingmen = (() => {
    const page = sq.friends.length > 0 ? friendPage : { items: [], page: 0, pages: 0 };
    if (!sq.friends.length) {
      return `${sectionTitle("wing", "Wingmen", "0")}
        <div class="empty-note">No wingmen yet. Look one up by code above, or save a pilot you have actually raced with below. Your code is <b>${escapeHtml(sq.myCode || "…")}</b>.</div>`;
    }
    return `
    ${sectionTitle("wing", "Wingmen", String(sq.friends.length))}
    <div class="friend-list">${(page.items as typeof sq.friends)
      .map((f) => {
        const presence = f.local ? "met in a race" : f.online ? "● online" : "○ offline";
        const best = f.bestDistance && f.bestDistance > 0 ? ` · best ${formatNumberLocalized(Math.round(f.bestDistance))} m` : "";
        return `<div class="friend-row"><span class="fr-name">${menuIconSm("bird")} ${escapeHtml(f.name)} <small>${escapeHtml(presence)}${best}</small></span><span class="fr-code">${escapeHtml(f.code || "")}</span><button class="mini-btn" data-ui data-action="friend-challenge" aria-label="Challenge ${escapeHtml(f.name)}" data-id="${escapeHtml(f.code || f.name)}">${menuIconSm("flag")} Challenge</button><button class="mini-btn ghost" data-ui data-action="squad-remove" aria-label="Remove ${escapeHtml(f.name)}" data-id="${escapeHtml(f.code || f.name)}">✕</button></div>`;
      })
      .join("")}</div>${pages("friends", page)}`;
  })();

  // Ghost-race challenges (SocialSystem.FriendChallenge) — an async chase
  // line posted against a wingman's best, settled the moment you land.
  const ghostChallenges = (() => {
    const challenges = s.friendChallenges ?? [];
    if (!challenges.length) return "";
    const kindLabel: Record<FriendChallenge["challengeKind"], string> = {
      distance: "distance", score: "score", altitude: "altitude", perfects: "perfect launches",
    };
    const rows = challenges
      .map((ch) => {
        const status = ch.status === "accepted" ? "racing — fly to settle it" : "posted — tap to race";
        return `<div class="friend-row"><span class="fr-name">${menuIconSm("flag")} vs ${escapeHtml(ch.challengerName)} <small>${escapeHtml(status)}</small></span><span class="fr-code">beat ${formatNumberLocalized(Math.round(ch.ghostDistance))} m ${kindLabel[ch.challengeKind]}</span><button class="mini-btn gold" data-ui data-action="challenge-race" data-id="${escapeHtml(ch.id)}">${menuIconSm("flag")} Race ghost</button></div>`;
      })
      .join("");
    return `${sectionTitle("flag", "Ghost Challenges", `${challenges.length} active`)}
      <p class="fineprint">Async races against a wingman's posted line — race the ghost and the result settles the instant you land.</p>
      <div class="friend-list">${rows}</div>`;
  })();

  // Real history: rooms this device actually shared with other pilots.
  const flewWith = (() => {
    const mates = s.recentPilots.filter((m) => !sq.friends.some((f) => f.name.toLowerCase() === m.name.toLowerCase()));
    if (!s.recentPilots.length) {
      return `${sectionTitle("takeoff", "Flew with", "0")}<div class="empty-note">Pilots who share a room with you appear here — real rooms, real names, remembered on this device.</div>`;
    }
    const rows = mates.slice(0, 8).map((m) => `<div class="friend-row">
      <span class="fr-name">${menuIconSm("bird")} ${escapeHtml(m.name)}</span>
      <span class="fr-code">room ${escapeHtml(m.roomCode)} · ${escapeHtml(seenAgo(m.lastSeenAt, Date.now()))}${m.bestDistance > 0 ? ` · ${formatNumberLocalized(m.bestDistance)} m` : ""}</span>
      <button class="mini-btn" data-ui data-action="mate-wingman" data-id="${escapeHtml(m.name)}">Save</button>
      <button class="mini-btn ghost" data-ui data-action="mate-invite" data-id="${escapeHtml(m.name)}">Invite</button>
      <button class="mini-btn ghost" data-ui data-action="mate-forget" data-id="${escapeHtml(m.name)}" aria-label="Forget ${escapeHtml(m.name)}">✕</button>
    </div>`).join("");
    return `${sectionTitle("takeoff", "Flew with", `${s.recentPilots.length} remembered`)}
      <p class="fineprint">${t("hud.renderCampaign.KDeviceFromRacesActuallyFlewTogether", undefined, "Kept on this device from races you actually flew together.")}</p>
      <div class="friend-list">${rows || `<div class="empty-note">${t("hud.renderCampaign.EFlewAlreadyWingmen", undefined, "Everyone you flew with is already in your wingmen.")}</div>`}</div>`;
  })();

  const friends = `${lookupPanel}${wingmen}${ghostChallenges}${flewWith}`;
  const myClub = sq.clubs.find((c) => c.id === sq.myClubId);
  const clubChat = SQUAD_CHAT && myClub
    ? `
    <div class="club-chat">
      <div class="chat-box" data-scroll-memory="squad-chat" data-stick-bottom role="log" aria-label="${t("hud.aria.clubChat", undefined, "Club chat history")}">
        ${sq.chat.length
          ? sq.chat.map((m) => `<div class="chat-line"><b>${escapeHtml(m.name)}</b><span>${escapeHtml(m.text)}</span></div>`).join("")
          : `<div class="empty-note">${t("hud.renderCampaign.SHelloClubMessagesStayBetweenMembers", undefined, "Say hello to your club — messages stay between members.")}</div>`}
      </div>
      <div class="redeem">
        <input data-ui data-enter-action="squad-chat" aria-label="${t("hud.renderCampaign.CMessage", undefined, "Club message")}" placeholder="Message your club" maxlength="140" autocomplete="off" />
        <button class="mini-btn" data-ui data-action="squad-chat">Send</button>
      </div>
    </div>`
    : "";
  const clubs = myClub
    ? `
    ${sectionTitle(null, "Your club", `${myClub.members}/30 members`)}
    <div class="club-card mine">
      <div class="daily-head"><span class="daily-icon">${menuIconSm("castle")}</span><div><b>${escapeHtml(myClub.name)}</b><em>${escapeHtml(myClub.motto)}</em></div><button class="mini-btn ghost" data-ui data-action="squad-leave-club">Leave</button></div>
    </div>
    ${clubChat}`
    : `
    ${sectionTitle(null, "Flight Clubs", "join or found one")}
    ${
      sq.clubs.length
        ? `<div class="club-list">${clubPage.items
            .map(
              (c) => `<div class="club-row"><div><b>${menuIconSm("castle")} ${escapeHtml(c.name)}</b><em>${escapeHtml(c.motto)} · ${c.members}/30</em></div><button class="mini-btn" data-ui data-action="squad-join-club" data-id="${c.id}" ${c.members >= 30 ? "disabled" : ""}>Join</button></div>`,
            )
            .join("")}</div>`
        : `<div class="empty-note">${t("hud.renderCampaign.NClubsYetFoundFirstOne", undefined, "No clubs yet — found the first one.")}</div>`
    }
    ${pages("clubs", clubPage)}
    <div class="redeem"><input data-ui data-enter-action="squad-create-club" aria-label="${t("hud.renderCampaign.CName", undefined, "Club name")}" placeholder="Club name" maxlength="24" autocomplete="off" /><button class="mini-btn gold" data-ui data-action="squad-create-club">${t("hud.renderCampaign.FClub", undefined, "Found club")}</button></div>`;

  const hubBanner = sq.isAutonomous
    ? `<div class="reward-strip" style="background:linear-gradient(135deg,#fff8e1,#ffe082); color:#5d4037; border:1px solid #ffcc80; margin-bottom:12px;">${menuIconSm("offline")} Offline build · wingman requests and pilot lookup need the online service. Pilots you actually raced with still work.</div>`
    : "";

  // A lost Squad key never blocks the pilot: flight progress, coins and
  // birds live in the save file, not in the Squad service. The honest path
  // is an explicit, confirmed re-enrollment into a fresh profile.
  const recovery = sq.credentialError && !sq.isAutonomous
    ? `<section class="squad-recovery" role="region" aria-label="${t("hud.renderRank.SProfileRecovery", undefined, "Squad profile recovery")}">
        ${sectionTitle(null, "Squad profile recovery", "key missing")}
        <p>${escapeHtml(sq.error || "This browser cannot unlock the saved Squad profile.")} Your flight progress, coins and birds are untouched — only the Squad identity is locked.</p>
        <label class="recovery-consent"><input type="checkbox" data-ui /> I understand this creates a separate Squad profile.</label>
        <div class="room-actions-bar">
          <button class="primary-btn" data-ui data-action="squad-new-profile" ${sq.busy || sq.loading ? "disabled" : ""}>${t("hud.renderCampaign.CNewSquadProfile", undefined, "Create a new Squad profile")}</button>
          <button class="soft-btn" data-ui data-action="squad-refresh" ${sq.loading ? "disabled" : ""}>${t("hud.renderCampaign.TReconnecting", undefined, "Try reconnecting")}</button>
        </div>
      </section>`
    : "";

  return `
    ${head(SCREEN.squad, "back", sq.myCode ? `<span class="pill">${escapeHtml(sq.myCode)}</span>` : "")}
    <p class="tagline">${t("hud.renderCampaign.LFlockBiggerAdventure", undefined, "A little flock. A bigger adventure.")}</p>
    ${hubBanner}
    ${recovery}
    ${sq.myCode ? `<div class="squad-invite"><span class="squad-invite-art">${menuIcon("squad")}</span><div><b>${t("hud.renderCampaign.FCode", undefined, "Your friend code")}</b><p>${t("hud.renderCampaign.SSomeoneWantFly", undefined, "Share it with someone you want to fly with.")}</p></div><button class="mini-btn" data-ui data-action="squad-copy-code">${t("hud.renderCampaign.CCodex", undefined, "Copy code")}</button></div>` : ""}
    ${notice}
    ${quests}
    <fieldset class="squad-fields"><legend class="sr-only">${t("hud.renderCampaign.SActions", undefined, "Squad actions")}</legend>${friends + clubs}</fieldset>
    <button class="soft-btn wide" data-ui data-action="squad-refresh" ${sq.loading || sq.busy ? "disabled" : ""}>${sq.loading ? "Connecting…" : "Refresh Squad"}</button>
    <button class="soft-btn wide" data-ui data-action="open-live">${t("hud.renderCampaign.RFriends", undefined, "Race with friends")}</button>
  `;
}

export function renderPractice(s: Pick<HudSnapshot, "firstSteps" | "pvpModes" | "roomSize" | "roomSkill" | "selectedPvpMode">): string {
  // The AI-only view. Still reachable from the lobby's "more ways to race" row
  // for a player who wants to skip the lobby chrome entirely, and it renders the
  // same `aiRivalSection` as the combined PvP screen, so the two cannot drift.
  return `${head(SCREEN.aiPvp)}
    ${!s.firstSteps.pve ? `<div class="onboarding-card pvai-intro-card">
      <b>${menuIconSm("bird")} Practice Arena — AI Rivals</b>
      <p>Race against AI pilots that match your skill level. Always available, no internet needed.</p>
      <ul class="shop-intro-tips">
        <li><b>Your rating is safe</b> — AI races never affect your ranked score.</li>
        <li><b>Skill-matched</b> — the flock adjusts to your level over time.</li>
        <li><b>Same hills</b> — the same procedural terrain as ranked play. Real practice.</li>
      </ul>
      <small>Ready for real opponents? Open the Race Lobby when you want to go ranked.</small>
    </div>` : ""}
    ${aiRivalSection(s)}
    <button class="soft-btn wide" data-ui data-action="open-live">${menuIconSm("globe")} Want human rivals? Open the lobby</button>
    <button class="soft-btn wide" data-ui data-action="open-shop">${t("hud.renderPractice.CLoadout", undefined, "Change loadout")}</button>`;
}

export function renderModes(s: Pick<HudSnapshot, "modeId" | "modes">): string {
  return `
    ${head(SCREEN.gameModes)}
    <p class="tagline">${t("hud.renderModes.SFlightsBelowAreAgainstCourse", undefined, "Solo flights below are you against the course. A ")}<b>${t("hud.renderModes.PCircuit", undefined, "PvP circuit")}</b> opens the PvP options — ranked and casual online racing, private rooms, or the AI flock. All modes share your unlocks.</p>
    <div class="mode-list">
      ${s.modes
        .map(
          (m) => `<button class="mode-card ${m.id === s.modeId ? "on" : ""}" data-ui data-action="pick-mode" data-id="${m.id}">
            <span class="mode-icon">${menuIconSm(m.icon)}</span>
            <span class="mode-body"><b>${m.name}</b><em>${m.blurb}</em></span>
            <span class="mode-meta">${m.finish ? `${m.finish / 1000} km` : m.clock ? `${m.clock}s` : "∞"}</span>
            ${m.id === s.modeId ? `<span class="mode-check" aria-hidden="true">✓</span>` : ""}
          </button>`,
        )
        .join("")}
    </div>
    ${sectionTitle(null, "Racing Circuits", "PVP &amp; AI")}
    <div class="mode-list">
      ${PVP_MODES
        .map(
          (m) => `<button class="mode-card ${m.id === s.modeId ? "on" : ""}" data-ui data-action="pick-mode" data-id="${m.id}">
            <span class="mode-icon">${menuIconSm(m.icon)}</span>
            <span class="mode-body"><b>${m.name}</b><em>${m.blurb}</em></span>
            <span class="mode-meta">${m.finish ? `${m.finish / 1000} km` : m.clock ? `${m.clock}s` : "∞"}</span>
            ${m.id === s.modeId ? `<span class="mode-check" aria-hidden="true">✓</span>` : ""}
          </button>`,
        )
        .join("")}
    </div>
    ${sectionTitle(null, "Race the flock offline")}
    <button class="primary-btn gold wide" data-ui data-action="open-practice">${menuIconSm("robot")} AI PvP · pick a circuit &amp; race the neural flock</button>
    <button class="soft-btn wide" data-ui data-action="versus">${menuIconSm("people")} Split-screen · 2 players on this device</button>
  `;
}