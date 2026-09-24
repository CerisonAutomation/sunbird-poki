import { JSDOM } from "jsdom";
import fs from "fs";
import path from "path";

// Setup global JSDOM environment
const html = fs.readFileSync(path.resolve("index.html"), "utf-8");
const dom = new JSDOM(html, {
  url: "http://localhost:5173/",
  pretendToBeVisual: true,
  runScripts: "outside-only"
});

// Polyfill window & document globals
Object.defineProperty(global, "window", { value: dom.window, writable: true });
Object.defineProperty(global, "document", { value: dom.window.document, writable: true });
Object.defineProperty(global, "HTMLElement", { value: dom.window.HTMLElement, writable: true });
Object.defineProperty(global, "SVGElement", { value: dom.window.SVGElement, writable: true });
Object.defineProperty(global, "Element", { value: dom.window.Element, writable: true });
Object.defineProperty(global, "Node", { value: dom.window.Node, writable: true });
Object.defineProperty(global, "requestAnimationFrame", { value: (cb: (t: number) => void) => setTimeout(cb, 16) as unknown as number });
Object.defineProperty(global, "cancelAnimationFrame", { value: (id: number) => clearTimeout(id) });
Object.defineProperty(global, "ResizeObserver", {
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
});

class MockPath2D {
  moveTo() {}
  lineTo() {}
  closePath() {}
}
Object.defineProperty(global, "Path2D", { value: MockPath2D, writable: true });
Object.defineProperty(dom.window, "Path2D", { value: MockPath2D, writable: true });

// Mock Canvas 2D Context for CLI headless browser checking
const mockCtx: Partial<CanvasRenderingContext2D> = {
  createLinearGradient: () => ({ addColorStop: () => {} } as unknown as CanvasGradient),
  createRadialGradient: () => ({ addColorStop: () => {} } as unknown as CanvasGradient),
  fillRect: () => {},
  clearRect: () => {},
  setTransform: () => {},
  save: () => {},
  restore: () => {},
  translate: () => {},
  scale: () => {},
  rotate: () => {},
  beginPath: () => {},
  closePath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  arc: () => {},
  ellipse: () => {},
  quadraticCurveTo: () => {},
  fill: () => {},
  stroke: () => {},
  measureText: () => ({ width: 40 } as TextMetrics),
  fillText: () => {},
  strokeText: () => {}
};

dom.window.HTMLCanvasElement.prototype.getContext = function(type: string) {
  if (type === "2d") return mockCtx as CanvasRenderingContext2D;
  return null;
} as unknown as typeof dom.window.HTMLCanvasElement.prototype.getContext;

import { HUD, type HudSnapshot } from "../src/game/HUD";
import { SKINS, BOOSTS, SHOP_TRAILS, type SkinView, type BoostView, type ShopTrailView } from "../src/game/Economy";
import { ACHIEVEMENTS, type AchievementView } from "../src/game/Achievements";
import { SeasonPass } from "../src/game/SeasonPass";
import { Tournaments } from "../src/game/Tournaments";
import { SaveData } from "../src/game/SaveData";
import { weeklyEvent, monthlyTheme } from "../src/game/Events";
import { campaignViews } from "../src/game/Campaign";
import { MISSION_DEFS, type MissionView } from "../src/game/Missions";

console.log("JSDOM Globals, Path2D, and Canvas mock set up successfully.");

function makeBaseSnapshot(): HudSnapshot {
  const realSkins: SkinView[] = SKINS.map((def, i) => ({
    def,
    owned: i === 0,
    equipped: i === 0,
    locked: i > 0,
    lockReason: null
  }));

  const realBoosts: BoostView[] = BOOSTS.map((def, i) => ({
    def,
    armed: i === 0,
    affordable: true,
    count: i === 0 ? 3 : 0
  }));

  const realShopTrails: ShopTrailView[] = SHOP_TRAILS.map((def, i) => ({
    def,
    owned: i === 0,
    equipped: i === 0,
    affordable: true
  }));

  const realTrophies: AchievementView[] = ACHIEVEMENTS.map((def, i) => ({
    def,
    progress: i === 0 ? 1 : 0,
    unlocked: i === 0
  }));

  const realMissions: MissionView[] = MISSION_DEFS.slice(0, 3).map((def) => ({
    def,
    progress: 2,
    done: false,
    completedBefore: false
  }));

  const save = new SaveData();
  const seasonPass = new SeasonPass(save);
  const tiers = seasonPass.view();
  const tourneys = new Tournaments(save);
  const cups = tourneys.view();

  return {
    state: "menu",
    screen: "main",
    checkoutSku: "sunbird_gold",
    portalName: "none",
    version: 1,
    distance: 1250,
    coins: 3420,
    daylight: 0.8,
    daylightMax: 100,
    fever: 0,
    feverOn: false,
    multiplier: 2,
    bestDistance: 4500,
    score: 8900,
    island: 3,
    perfects: 4,
    clouds: 12,
    zeniths: 2,
    rings: 8,
    balloons: 3,
    sunflowers: 5,
    hint: "Hold down the hill. Release up the ramp!",
    magnetTimer: 0,
    shield: 0,
    boostTimer: 0,
    gold: false,
    vip: false,
    vipDaysLeft: 0,
    vipExpiredNotice: false,
    adsLeftToday: 5,
    ghostDelta: 0,
    newBest: false,
    continueTimer: 5,
    continueCost: 100,
    canAffordContinue: true,
    adAvailable: true,
    adTimer: 0,
    adTotal: 15,
    adReason: "continue",
    seedLabel: "Island 3 · Sunset Peaks",
    wings: {
      icon: "🪶",
      name: "Breeze Rider",
      progress: 0.65,
      nextName: "Cloud Hopper",
      nextNeeded: 500,
      lifetime: 14200
    },
    flightPath: [[0, 20], [50, 45], [100, 30]],
    rivalBanner: "",
    seedMode: "today",
    wallet: 1540,
    streakDays: 4,
    nestLevel: 3,
    nestPrice: 500,
    nestMaxed: false,
    nestMult: 1.5,
    missions: realMissions,
    quests: [],
    highScores: [{ rank: 1, name: "SkyAce", score: 12500, distance: 7800, date: "2026-09-15" }],
    todayBest: 3200,
    runsPlayed: 28,
    newlyCompleted: [],
    claimedQuests: [],
    skins: realSkins,
    boosts: realBoosts,
    shopTrails: realShopTrails,
    settings: {
      mute: false,
      music: true,
      sfx: true,
      musicVolume: 0.8,
      sfxVolume: 0.9,
      musicTrack: "shuffle",
      quality: "high",
      reducedMotion: false,
      colorAssist: false,
      largeText: false,
      screenShake: true,
      locale: "en",
      soundVolume: 0.85
    },
    goldPrice: "$2.99",
    starterPrice: "$0.99",
    starterFeatures: ["5,000 Coins", "Solar Crest Skin", "Permanent 2x XP"],
    starterOwned: false,
    goldFeatures: ["Custom Seed Picker", "Endless Gold Mode", "Golden Wings Trail"],
    vipPrice: "$4.99/mo",
    vipFeatures: ["All Skins Unlocked", "Daily Mystery Vault", "No Forced Ads"],
    checkoutMode: "direct",
    checkoutUrl: "",
    checkoutBusy: false,
    checkoutError: "",
    checkoutOk: false,
    checkoutWaiting: false,
    restoreMessage: "",
    resetArmed: false,
    season: {
      tier: 4,
      maxTier: tiers.length,
      have: 340,
      need: 500,
      label: "Season 1: Solar Dawn",
      tiers
    },
    trophies: realTrophies,
    trophyCounts: { unlocked: 1, total: realTrophies.length },
    referralCode: "SUN-772",
    referralRedeemed: false,
    referralMessage: "",
    cloudCode: "SAVE-ABC-123",
    cloudMessage: "",
    canInstall: true,
    shareBusy: false,
    expShareFirst: false,
    combo: 3,
    speedNorm: 0.65,
    gust: 0,
    inThermal: false,
    biomeName: "Sunset Highlands",
    biomeEmoji: "🌄",
    atlas: [
      { island: 1, name: "Sunrise Coast", emoji: "🌅", tagline: "Gentle rolling dunes", color: "#ffaa44", reached: true, hazard: "None" },
      { island: 2, name: "Emerald Valleys", emoji: "🌿", tagline: "Deep swoops and tall crests", color: "#44bb77", reached: true, hazard: "Crosswinds" },
      { island: 3, name: "Sunset Peaks", emoji: "🌄", tagline: "Craggy alpine ridges", color: "#ee6633", reached: true, hazard: "Steep Drops" }
    ],
    farthestIsland: 3,
    showTutorialHand: false,
    launchBanner: "PERFECT LAUNCH ×4",
    launchBannerT: 0.8,
    launchRating: "perfect",
    altitude: 42,
    altZone: 2,
    maxAltitude: 180,
    powers: [
      { id: "shield", label: "Sea Shield", icon: "🛡️", remaining: 12 }
    ],
    modes: [
      { id: "classic", name: "Island Migration", desc: "Race against the sunset", icon: "🌅" },
      { id: "endless", name: "Endless Soar", desc: "Glide as far as wings carry you", icon: "✨" }
    ],
    modeId: "classic",
    modeName: "Island Migration",
    modeIcon: "🌅",
    countdown: 0,
    versus: false,
    splitLayout: "off",
    versusWinner: 0,
    p1Stats: null,
    p2Stats: null,
    raceFinish: 5000,
    sessionGoals: [
      { desc: "Catch 20 coins", progress: 14, target: 20, done: false }
    ],
    goalPop: "",
    nearMiss: "",
    skillLabel: "Good",
    skill: 72,
    bestAltitude: 140,
    bestCombo: 6,
    runGems: 2,
    pilotName: "GoldenFalcon",
    board: null,
    boardLoading: false,
    boardScope: "global",
    boardMetric: "distance",
    boardOnline: true,
    cups,
    trails: [
      { id: "sparkle", label: "Gold Dust", equipped: true }
    ],
    lastPrize: "",
    standings: [],
    racePlace: 1,
    raceFinishM: 5000,
    raceField: 8,
    raceFinishTime: 0,
    massRace: false,
    multiplayerLive: false,
    roster: [],
    roomCode: "FLY123",
    roomCount: 1,
    roomCapacity: 8,
    roomReady: false,
    roomReadyCount: 0,
    roomSize: 8,
    roomSkill: "gold",
    roomMuted: false,
    roomRivals: [],
    netState: "connected",
    linkQuality: "good",
    netError: "",
    draft: 0,
    finishRemaining: 0,
    nemesis: "",
    photoFinish: "",
    slopeChain: 0,
    slopeScore: 0,
    rival: {
      rating: 1420,
      division: "Gold II",
      divisionIcon: "🥇",
      wins: 18,
      losses: 5,
      streak: 3,
      bestStreak: 7,
      nextName: "Gold I",
      nextNeeded: 80,
      progress: 0.6,
      matches: [],
      season: { daysLeft: 12, peak: 1450, peakDivision: "Gold II", peakIcon: "🥇", rewardCoins: 1000 }
    },
    loadout: { bird: "sunbird", trail: "sparkle", boosts: 3 },
    lobbyRivals: [],
    raceRated: false,
    raceVerified: false,
    ratingDelta: 0,
    ratingBonus: 0,
    duel: { wins: 4, losses: 1, streak: 2, bestStreak: 4 },
    duelWas: "",
    duelDelta: 0,
    duelFoe: { name: "RivalGlider", tag: "#441", rating: 1390 },
    daily: {
      title: "Sunset Sprint",
      modeName: "Island Migration",
      modeIcon: "🌅",
      modifierIcon: "⚡",
      modifierLabel: "Turbo Gusts",
      modifierDesc: "30% faster tailwinds",
      metric: "metres",
      target: 2000,
      reward: 250,
      done: false,
      dailiesDone: 3
    },
    gauntlet: {
      week: "2026-W37",
      stages: [
        { index: 1, label: "Stage 1", modeName: "Island Migration", modeIcon: "🌅", metric: "distance", target: 1500, reward: 200, done: true },
        { index: 2, label: "Stage 2", modeName: "Endless Soar", modeIcon: "✨", metric: "coins", target: 50, reward: 300, done: false }
      ],
      clearBonus: 500,
      cleared: false,
      lifetimeClears: 2
    },
    calendar: {
      cycleDay: 5,
      claimedToday: false,
      days: [
        { day: 1, label: "50 Coins", claimed: true, today: false, milestone: false },
        { day: 2, label: "100 Coins", claimed: true, today: false, milestone: false },
        { day: 3, label: "150 Coins", claimed: true, today: false, milestone: false },
        { day: 4, label: "Magnet x3", claimed: true, today: false, milestone: false },
        { day: 5, label: "300 Coins", claimed: false, today: true, milestone: false },
        { day: 6, label: "Shield x3", claimed: false, today: false, milestone: false },
        { day: 7, label: "Solar Feather Skin", claimed: false, today: false, milestone: true }
      ]
    },
    mastery: [
      { modeId: "classic", name: "Island Migration", icon: "🌅", runs: 28, level: 3, nextAt: 40, progress: 0.7, perk: "+6% coin value", skillName: "Thermal Surge", skillDesc: "Ascend higher in thermal updrafts", maxed: false }
    ],
    challengeOutcome: "",
    weeklyEvent: weeklyEvent(),
    monthlyTheme: monthlyTheme(),
    eventClearsWeek: 2,
    eventClearsMonth: 8,
    themeTrailClaimed: false,
    themeTrailNeed: 10,
    campaign: campaignViews(save, []),
    campaignDone: 5,
    campaignTotal: 15,
    squad: {
      live: true,
      loading: false,
      busy: false,
      friendPage: 0,
      clubPage: 0,
      error: "",
      registered: true,
      credentialError: false,
      myCode: "SUN-MOCK01",
      friends: [
        { name: "SkyAce", code: "SUN-ACE001", club_id: 1 },
        { name: "GoldenFalcon", code: "SUN-GLD999", club_id: 1 }
      ],
      clubs: [
        { id: 1, name: "Apex Falcons", motto: "High speed diving", members: 24 },
        { id: 2, name: "Golden Horizon", motto: "Chasing sunsets", members: 18 }
      ],
      myClubId: 1,
      chat: [
        { id: 1, name: "SkyAce", text: "Welcome to Sun Chasers! Great flights today!", at: "1h ago" }
      ]
    },
    squadNotice: "",
    dailyFlash: { id: "falcon", price: 675, originalPrice: 1125, discountPct: 40 },
    stipendClaimed: false,
    piggyCoins: 340,
    prestigeLevel: 0,
    prestigeMult: 1.0,
    canFreeSpin: true
  };
}

const hud = new HUD(document.body);
const screens = [
  "main", "shop", "settings", "scores", "pass", "trophies",
  "account", "atlas", "modes", "board", "cups", "live",
  "rank", "practice", "progress", "challenges", "campaign",
  "squad", "paywall", "checkout"
] as const;

console.log("\n=== TESTING ALL MENU SCREENS ===");
for (const scr of screens) {
  const snap = makeBaseSnapshot();
  snap.screen = scr;
  hud.update(snap);
  const card = document.querySelector(".paper-card") as HTMLElement;
  const title = card?.querySelector("h1, h2")?.textContent?.trim() || "(no heading)";
  const buttons = card?.querySelectorAll("button")?.length || 0;
  const inputs = card?.querySelectorAll("input, select")?.length || 0;
  console.log(`✓ Screen [${scr.padEnd(10)}] -> Heading: "${title}" | Buttons: ${buttons} | Inputs: ${inputs}`);
}

console.log("\n=== TESTING GAMEPLAY OVERLAY STATES ===");
const overlayStates = ["playing", "paused", "continue", "ad", "gameover"] as const;
for (const st of overlayStates) {
  const snap = makeBaseSnapshot();
  snap.state = st;
  hud.update(snap);
  const playHud = document.querySelector(".play-hud") as HTMLElement;
  const isPlayVisible = playHud && !playHud.classList.contains("hidden");
  console.log(`✓ State  [${st.padEnd(10)}] -> playHud visible: ${isPlayVisible}`);
}

hud.dispose();
console.log("\nAll screens and states exercised cleanly without crashes!");
