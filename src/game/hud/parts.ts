/**
 * Screen fragments shared by more than one screen.
 *
 * These were module-private in `HUD.ts`. A screen module cannot import them
 * from there without a cycle, and the controller cannot own them once the
 * screens that use them have moved out — so they sit in this leaf module,
 * below every screen and above nothing but the chrome kit.
 */
import { formatNumberLocalized, getLocale, t } from "../../i18n";
import { type SessionGoal } from "../Engagement";
import { leaderboardBackend } from "../Leaderboard";
import { menuIcon, menuIconSm } from "../MenuIcons";
import { type MissionView, type QuestView } from "../Missions";
import { PVP_MODES } from "../Modes";
import { type HighScore } from "../SaveData";
import { LEADERBOARD_CLOUD_LABEL, POKI_EDITION, PORTAL_DISPLAY_NAME } from "../edition";
import { formatDistance } from "../math";
import { escapeHtml } from "./kit";
import { type HudSnapshot } from "./types";

/**
 * Distance, formatted for the player's chosen language.
 *
 * One place so a locale switch reaches every readout that shows a distance —
 * the flight HUD, the board, the recap, the results strip — instead of each
 * call site having to remember the second argument. The "m"/"km" units are
 * locale-neutral by convention in this game (they match the metric toggle in
 * Settings) and are left as-is; only the digits follow the locale.
 */
export function distanceText(meters: number): string {
  return formatDistance(meters, getLocale());
}

export function renderMissions(list: MissionView[], newly: string[] = []): string {
  const done = list.filter((m) => m.done).length;
  const rows = list
    .map((m) => {
      const fresh = newly.includes(m.def.id);
      return `<div class="mission ${m.done ? "done" : ""} ${fresh ? "fresh" : ""}">
        <span class="check">${m.done ? "✓" : ""}</span>
        <div><div class="mt">${m.def.title}</div><div class="md">${m.def.desc}</div></div>
        <span class="mp">${Math.min(m.progress, m.def.target)}/${m.def.target}</span>
      </div>`;
    })
    .join("");
  return `<details class="missions-details"><summary class="mission-head">${t("hud.renderMissions.NMissions", undefined, "Nest missions ")}<span class="mission-count">${done}/${list.length}</span></summary><div class="missions">${rows}</div></details>`;
}

export function renderQuests(list: QuestView[]): string {
  return `<div class="quests"><div class="mission-head">${t("hud.renderQuests.TSQuests", undefined, "Today's quests")}</div>${list
    .map((q) => {
      const pct = Math.min(100, (q.progress / q.def.target) * 100);
      return `<div class="quest ${q.done ? "done" : ""}">
        <div><div class="mt">${q.def.label}</div><div class="qb"><i style="width:${pct}%"></i></div></div>
        <span class="qr">${q.claimed ? "✓ claimed" : `● ${q.def.reward}`}</span>
      </div>`;
    })
    .join("")}</div>`;
}

export function renderGoalList(goals: SessionGoal[]): string {
  if (!goals.length) return "";
  return `<div class="quests"><div class="mission-head">${t("hud.renderGoalList.SGoals", undefined, "Session goals")}</div>${goals
    .map((g) => {
      const pct = Math.min(100, (g.progress / g.target) * 100);
      return `<div class="quest ${g.done ? "done" : ""}">
        <div><div class="mt">${g.label}</div><div class="qb"><i style="width:${pct}%"></i></div></div>
        <span class="qr">● ${g.reward}</span>
      </div>`;
    })
    .join("")}</div>`;
}

export function renderScoreTable(rows: HighScore[]): string {
  if (!rows.length) return `<div class="score-table"><div class="row empty">${t("hud.renderScoreTable.NFlightsYet", undefined, "No flights yet")}</div></div>`;
  return `<div class="score-table">${rows
    .map(
      (h, i) =>
        `<div class="row ${h.vip ? "vip" : ""}"><span>${i + 1}${h.vip ? "<i class='spark'>✦</i>" : ""}</span><span>${distanceText(h.distance)}</span><span>${h.coins}c</span><span>${formatNumberLocalized(Math.floor(h.score))}</span></div>`,
    )
    .join("")}</div>`;
}

export function renderRivalBanner(banner: string): string {
  const [name, dist] = banner.split("|");
  return `<div class="rival-banner">🥊 <b>${escapeHtml(name)}</b> ${t("hud.rivalChallenge", undefined, "challenged you — beat")} <b>${escapeHtml(dist)} m</b> ${t("hud.rivalOnHills", undefined, "on their hills. Hold to fly.")}</div>`;
}

/** Compact top-wings leaderboard embedded on the main menu. */
/**
 * The AI-flock rival controls: how many computer birds, how good they are, and
 * every format you can throw at them.
 *
 * Extracted from the old standalone AI screen so the combined PvP screen and the
 * AI-only shortcut render the *same* controls. Two copies of this drifted once —
 * the lobby advertised formats the practice screen did not offer — and the only
 * thing that can stop that recurring is there being one of them.
 */
export function aiRivalSection(s: HudSnapshot): string {
  const currentMode = s.pvpModes.find((m) => m.id === s.selectedPvpMode) ?? s.pvpModes[0] ?? { name: "Sprint GP" };
  return `<section class="race-section race-section-ai" aria-label="${t("hud.aiRivalSection.RAIFlockOffline", undefined, "Race the AI flock offline")}">
      <div class="race-section-head"><h3>${menuIcon("bird")} Race the AI flock</h3><span class="section-step">offline · starts instantly</span></div>
      <p>Every format below starts immediately against computer-controlled birds — no server, no room, no rating. Learning the circuits here is the fastest way to win them online.</p>
      <div class="room-controls">
        <div class="room-ctl"><span class="room-ctl-label">${t("hud.aiRivalSection.AOpponents", undefined, "AI opponents ")}<small>plus you</small></span><div class="seg" role="group" aria-label="${t("hud.aiRivalSection.AOpponentsx", undefined, "AI opponents")}">${[5, 10, 20, 40].map((n) => `<button data-ui data-action="room-size" data-id="${n}" aria-pressed="${s.roomSize === n}" class="${s.roomSize === n ? "on" : ""}">${n}</button>`).join("")}</div></div>
        <div class="room-ctl"><span class="room-ctl-label">${t("hud.aiRivalSection.ASkill", undefined, "AI skill")}</span><div class="seg" role="group" aria-label="${t("hud.aiRivalSection.ASkillx", undefined, "AI skill")}">${(["chill", "sharp", "ace"] as const).map((k) => `<button data-ui data-action="room-skill" data-id="${k}" aria-pressed="${s.roomSkill === k}" class="${s.roomSkill === k ? "on" : ""}">${k === "chill" ? "Chill" : k === "sharp" ? "Sharp" : "Ace"}</button>`).join("")}</div></div>
      </div>
      <button class="primary-btn gold wide" data-ui data-action="ai-pvp" data-id="${s.selectedPvpMode}">🤖 Race the AI flock · ${currentMode.name}</button>
      <details class="practice-formats"><summary><h3>${t("hud.aiRivalSection.RFormats", undefined, "Race formats")}</h3></summary>
        <p class="fineprint">Dynamic AI pilots adapt locally with neural downslope timing, slipstream drafting, and slingshot attacks. No server connection required!</p>
        ${PVP_MODES.map((m) => `<button class="soft-btn wide ${s.selectedPvpMode === m.id ? "on" : ""}" data-ui data-action="ai-pvp" data-id="${m.id}">${menuIconSm(m.icon)} ${m.name} · ${m.blurb}</button>`).join("")}
        <button class="soft-btn wide" data-ui data-action="pvp-duel">⚔ 1v1 Seeded Rival Duel</button>
        <button class="soft-btn wide" data-ui data-action="practice-storm">⛈ Stormfront Race · wild weather</button>
        <button class="soft-btn wide" data-ui data-action="practice-ranked">🏆 40-Pilot Flock Grand Prix</button>
      </details>
    </section>`;
}

/**
 * Where the numbers on the board actually come from, in the player's language.
 *
 * The chip used to read "Local" on every build, which was wrong on the portal
 * editions: those publish and read through the portal's own cloud when that is
 * configured. Naming the source honestly is the difference between a board the
 * player trusts and one that looks like a placeholder.
 */
export function boardSource(_s: HudSnapshot): { chip: string; sentence: string } {
  const backend = leaderboardBackend();
  if (backend === "auds") {
    return { chip: LEADERBOARD_CLOUD_LABEL, sentence: `Scores sync to ${PORTAL_DISPLAY_NAME}'s worldwide board.` };
  }
  if (backend === "http") {
    return { chip: "🌐 global", sentence: "Scores sync to the global leaderboard." };
  }
  // Portal builds name the portal: a Poki player reading "Local" on a Poki page
  // concludes the board is broken, when what is true is narrower — this build
  // has no cloud board configured, so the standings are the ones on this
  // device. Say that, in the portal's own words. The rows named "· Practice"
  // are the device's generated benchmarks, and the sentence says so rather than
  // letting a new player infer that twenty named humans are ahead of them.
  const offlineBench = "Rungs marked “Practice” are this device's benchmarks, not pilots.";
  return POKI_EDITION
    ? { chip: `${PORTAL_DISPLAY_NAME} · on-device`, sentence: `This build keeps scores on your device. ${offlineBench}` }
    : { chip: "💾 local", sentence: `Rankings are stored on this device. Fly well to climb! ${offlineBench}` };
}