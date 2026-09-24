export type ModeId =
  | "daytrip"
  | "race"
  | "zenith"
  | "distance"
  | "coinrush"
  | "perfect"
  | "endless"
  | "massrace"
  | "pvp_sprint"
  | "pvp_endurance"
  | "pvp_knockout"
  | "pvp_draft"
  | "pvp_slalom"
  | "pvp_typhoon"
  | "pvp_zenith"
  | "pvp_coinrush";

export type ModeDef = {
  id: ModeId;
  name: string;
  blurb: string;
  icon: string;
  /** seconds of daylight, or 0 for "no clock" */
  clock: number;
  /** finish line in metres, or 0 for endless */
  finish: number;
  /** what the end screen celebrates */
  scoreBy: "distance" | "altitude" | "coins" | "perfects" | "time";
  /** difficulty ramps with distance */
  escalate: boolean;
};

export type PvpWorldCourse = {
  id: string;
  name: string;
  biomeId: string;
  island: number;
  emoji: string;
  tagline: string;
  difficulty: string;
};

export const PVP_WORLDS: PvpWorldCourse[] = [
  {
    id: "emerald",
    name: "Emerald Circuit",
    biomeId: "green",
    island: 0,
    emoji: "🌿",
    tagline: "Gentle rollers & rhythmic swoops — classic high-speed opener",
    difficulty: "★☆☆☆☆",
  },
  {
    id: "turquoise",
    name: "Turquoise Atoll",
    biomeId: "tropical",
    island: 1,
    emoji: "🏝",
    tagline: "Azure ocean channels and towering tropical palms",
    difficulty: "★★☆☆☆",
  },
  {
    id: "coral",
    name: "Coral Shallows",
    biomeId: "reef",
    island: 2,
    emoji: "🐚",
    tagline: "Pastel lagoons with buoyant warm updrafts",
    difficulty: "★★☆☆☆",
  },
  {
    id: "sunset",
    name: "Sunset Expressway",
    biomeId: "sunset",
    island: 3,
    emoji: "🌇",
    tagline: "Long violet valleys and blazing downhill speedways",
    difficulty: "★★★☆☆",
  },
  {
    id: "dune",
    name: "Dune Highway",
    biomeId: "desert",
    island: 4,
    emoji: "🏜",
    tagline: "Monster golden dunes offering astronomical airtime",
    difficulty: "★★★☆☆",
  },
  {
    id: "midnight",
    name: "Midnight Neon",
    biomeId: "night",
    island: 5,
    emoji: "🌙",
    tagline: "Bioluminescent coastline under the full moon",
    difficulty: "★★★★☆",
  },
  {
    id: "aurora",
    name: "Aurora Speedway",
    biomeId: "aurora",
    island: 6,
    emoji: "🔮",
    tagline: "Gleaming ice shelves launching into cosmic polar auroras",
    difficulty: "★★★★☆",
  },
  {
    id: "magma",
    name: "Magma Run",
    biomeId: "volcano",
    island: 7,
    emoji: "🌋",
    tagline: "Obsidian glass crests and violent superheated thermals",
    difficulty: "★★★★★",
  },
  {
    id: "skyreach",
    name: "Skyreach Apex",
    biomeId: "canyon",
    island: 8,
    emoji: "🦅",
    tagline: "Vast red canyon walls with extreme vertical descents",
    difficulty: "★★★★★",
  },
];

export const MODES: ModeDef[] = [
  {
    id: "daytrip",
    name: "Day Trip",
    blurb: "Chase the sunset across the islands. Reach land to win back daylight.",
    icon: "☀",
    clock: 52,
    finish: 0,
    scoreBy: "distance",
    escalate: false,
  },
  {
    id: "race",
    name: "Time Trial",
    blurb: "Solo against the clock. Finish 4,000 m as quickly as you can.",
    icon: "🏁",
    clock: 0,
    finish: 4000,
    scoreBy: "time",
    escalate: false,
  },
  {
    id: "zenith",
    name: "Skyline",
    blurb: "Ninety seconds to climb above the clouds and bonk the skybox.",
    icon: "🚀",
    clock: 90,
    finish: 0,
    scoreBy: "altitude",
    escalate: false,
  },
  {
    id: "distance",
    name: "Distance",
    blurb: "One fixed sunset. Keep your momentum and go far.",
    icon: "📏",
    clock: 75,
    finish: 0,
    scoreBy: "distance",
    escalate: false,
  },
  {
    id: "coinrush",
    name: "Coin Rush",
    blurb: "Sixty seconds. Every coin counts double.",
    icon: "💰",
    clock: 60,
    finish: 0,
    scoreBy: "coins",
    escalate: false,
  },
  {
    id: "perfect",
    name: "Perfect Run",
    blurb: "Score comes almost entirely from chaining perfect launches.",
    icon: "✦",
    clock: 80,
    finish: 0,
    scoreBy: "perfects",
    escalate: false,
  },
  {
    id: "endless",
    name: "Endless",
    blurb: "No clock. The challenge grows gradually as you travel.",
    icon: "∞",
    clock: 0,
    finish: 0,
    scoreBy: "distance",
    escalate: true,
  },
  {
    id: "massrace",
    name: "Flock Race",
    blurb: "Open Race Lobby for online pilots, private rooms or AI practice.",
    icon: "🐦",
    clock: 0,
    finish: 4000,
    scoreBy: "time",
    escalate: false,
  },
];

export const PVP_MODES: ModeDef[] = [
  {
    id: "pvp_sprint",
    name: "Sprint GP",
    blurb: "1,500 m lightning dash. Pack drafting, high speed, and pure clutch launches.",
    icon: "⚡",
    clock: 0,
    finish: 1500,
    scoreBy: "time",
    escalate: false,
  },
  {
    id: "pvp_slalom",
    name: "Sky Slalom GP",
    blurb: "2,500 m precision slalom. Hit apex launch gates for supersonic warp surges.",
    icon: "🎯",
    clock: 0,
    finish: 2500,
    scoreBy: "time",
    escalate: false,
  },
  {
    id: "pvp_typhoon",
    name: "Typhoon Blitz",
    blurb: "3,000 m supersonic tempest chase. Gale-force tailwinds propel the pack.",
    icon: "🌀",
    clock: 0,
    finish: 3000,
    scoreBy: "time",
    escalate: false,
  },
  {
    id: "pvp_zenith",
    name: "Stratosphere Ascent",
    blurb: "3,200 m vertical dogfight. Colossal thermal updrafts launch into polar auroras.",
    icon: "🔮",
    clock: 0,
    finish: 3200,
    scoreBy: "time",
    escalate: false,
  },
  {
    id: "pvp_draft",
    name: "Tempest Draft",
    blurb: "Double slipstream power (+100% draft). Ride rival wind streams to slingshot.",
    icon: "🌪",
    clock: 0,
    finish: 3500,
    scoreBy: "time",
    escalate: false,
  },
  {
    id: "pvp_coinrush",
    name: "Sunstone Heist",
    blurb: "2,800 m high-stakes treasure sprint. Grabbing sunstones grants instant turbo speed.",
    icon: "💎",
    clock: 0,
    finish: 2800,
    scoreBy: "time",
    escalate: false,
  },
  {
    id: "pvp_knockout",
    name: "Knockout Royale",
    blurb: "Last bird standing! Elimination gates every 500 m to crown the champion.",
    icon: "👑",
    clock: 0,
    finish: 4000,
    scoreBy: "time",
    escalate: false,
  },
  {
    id: "pvp_endurance",
    name: "Grand Migration",
    blurb: "6,000 m epic endurance across 4 biomes. Weather shifts and pack drafting.",
    icon: "🦅",
    clock: 0,
    finish: 6000,
    scoreBy: "time",
    escalate: false,
  },
];

/** Rival count for the mass-race grid (plus you = 41 birds in the air). */
export const MASS_RACE_FIELD = 40;

export function modeById(id: ModeId): ModeDef {
  return MODES.find((m) => m.id === id) ?? PVP_MODES.find((m) => m.id === id) ?? MODES[0]!;
}

export function isRaceMode(id: ModeId): boolean {
  return (
    id === "massrace" ||
    id === "pvp_sprint" ||
    id === "pvp_endurance" ||
    id === "pvp_knockout" ||
    id === "pvp_draft" ||
    id === "pvp_slalom" ||
    id === "pvp_typhoon" ||
    id === "pvp_zenith" ||
    id === "pvp_coinrush"
  );
}

/** Finish distance for the local 2-player split-screen versus, matched to the
 * online mass race so every PvP surface gets the same, unhurried pacing. */
export const RACE_FINISH = 4000;
