
export type SkinRarity = "starter" | "common" | "rare" | "epic" | "legendary" | "mythic";
export type CollectionId = "starter" | "nature" | "elements" | "cosmic" | "seasonal" | "premium" | "tournament" | "achievement";

export type SkinDef = {
  id: string;
  name: string;
  perk: string;
  price: number;
  goldOnly?: boolean;
  vipOnly?: boolean;
  /** Earned, never bought: the label explains how (duels, gauntlets, pass, rank). */
  prizeOnly?: string;
  body: number;
  wing: number;
  belly: number;
  beak: number;
  speedMult: number;
  feverBonus: number;
  daylightBonus: number;
  magnetAlways: boolean;
  /** Gusts and ash storms barely touch this bird (same shield as Storm Ward). */
  weatherProof?: boolean;
  /** Flies under the weather's radar: storms detect at half range, gusts push half as hard. */
  stealth?: boolean;
  rarity?: SkinRarity;
  collection?: CollectionId;
};

/** Display metadata for skin collections, in shop order. */
export const COLLECTIONS: { id: CollectionId; name: string; icon: string }[] = [
  { id: "starter", name: "Starter", icon: "🐣" },
  { id: "nature", name: "Nature", icon: "🌿" },
  { id: "elements", name: "Elements", icon: "🌪" },
  { id: "cosmic", name: "Cosmic", icon: "🌌" },
  { id: "seasonal", name: "Seasonal", icon: "🍂" },
  { id: "premium", name: "Premium", icon: "✦" },
  { id: "tournament", name: "Tournament", icon: "🏆" },
  { id: "achievement", name: "Achievement", icon: "🎖" },
];

const BASE_SKINS: SkinDef[] = [
  {
    id: "sunbird",
    name: "Sunbird",
    perk: "Balanced classic",
    price: 0,
    body: 0xff7a45,
    wing: 0xff9a62,
    belly: 0xffe6c4,
    beak: 0xffc447,
    speedMult: 1,
    feverBonus: 0,
    daylightBonus: 0,
    magnetAlways: false,
    collection: "starter",
  },
  {
    id: "bluejay",
    name: "Bluejay",
    perk: "+6% top speed",
    price: 200,
    body: 0x3d8bf2,
    wing: 0x7fb8ff,
    belly: 0xeaf4ff,
    beak: 0x2b2f4a,
    speedMult: 1.06,
    feverBonus: 0,
    daylightBonus: 0,
    magnetAlways: false,
    collection: "nature",
  },
  {
    id: "ember",
    name: "Ember",
    perk: "Fever lasts +4 s",
    price: 450,
    body: 0xe0392a,
    wing: 0xff9a1f,
    belly: 0xffe2a8,
    beak: 0xffd166,
    speedMult: 1,
    feverBonus: 4,
    daylightBonus: 0,
    magnetAlways: false,
    collection: "elements",
  },
  {
    id: "owl",
    name: "Dusk Owl",
    perk: "+10 s of daylight",
    price: 700,
    body: 0x5d4f86,
    wing: 0x8f7fc0,
    belly: 0xf1eaff,
    beak: 0xffb347,
    speedMult: 1,
    feverBonus: 0,
    daylightBonus: 10,
    magnetAlways: false,
    collection: "nature",
  },
  {
    id: "robin",
    name: "Robin",
    perk: "+3% top speed",
    price: 150,
    body: 0xb2543a,
    wing: 0xd97b52,
    belly: 0xffd9b0,
    beak: 0xf2c14e,
    speedMult: 1.03,
    feverBonus: 0,
    daylightBonus: 0,
    magnetAlways: false,
    collection: "nature",
  },
  {
    id: "canary",
    name: "Canary",
    perk: "+4 s of daylight",
    price: 180,
    body: 0xffd53d,
    wing: 0xffe57a,
    belly: 0xfff8d6,
    beak: 0xff9f3a,
    speedMult: 1,
    feverBonus: 0,
    daylightBonus: 4,
    magnetAlways: false,
    collection: "nature",
  },
  {
    id: "swift",
    name: "Storm Swift",
    perk: "+5% top speed",
    price: 260,
    body: 0x4a5568,
    wing: 0x718096,
    belly: 0xe2e8f0,
    beak: 0x2d3748,
    speedMult: 1.05,
    feverBonus: 0,
    daylightBonus: 0,
    magnetAlways: false,
    collection: "nature",
  },
  {
    id: "kingfisher",
    name: "Kingfisher",
    perk: "Fever lasts +2 s · +2% speed",
    price: 320,
    body: 0x00a3c4,
    wing: 0x0bc5ea,
    belly: 0xfefcbf,
    beak: 0xdd6b20,
    speedMult: 1.02,
    feverBonus: 2,
    daylightBonus: 0,
    magnetAlways: false,
    collection: "nature",
  },
  {
    id: "cardinal",
    name: "Cardinal",
    perk: "Fever lasts +3 s",
    price: 380,
    body: 0xc53030,
    wing: 0xe53e3e,
    belly: 0xfed7d7,
    beak: 0xf6ad55,
    speedMult: 1,
    feverBonus: 3,
    daylightBonus: 0,
    magnetAlways: false,
    collection: "nature",
  },
  {
    id: "magpie",
    name: "Magpie",
    perk: "+6 s of daylight",
    price: 420,
    body: 0x1a202c,
    wing: 0x5a6b8c,
    belly: 0xf7fafc,
    beak: 0x2d3748,
    speedMult: 1,
    feverBonus: 0,
    daylightBonus: 6,
    magnetAlways: false,
    collection: "nature",
  },
  {
    id: "heron",
    name: "Grey Heron",
    perk: "+4% speed · +3 s daylight",
    price: 520,
    body: 0x8ba2b5,
    wing: 0xb8c9d9,
    belly: 0xf0f5fa,
    beak: 0xf2c14e,
    speedMult: 1.04,
    feverBonus: 0,
    daylightBonus: 3,
    magnetAlways: false,
    collection: "nature",
  },
  {
    id: "lorikeet",
    name: "Lorikeet",
    perk: "Fever +3 s · +3 s daylight",
    price: 560,
    body: 0x2f855a,
    wing: 0x38b2ac,
    belly: 0xfff3d6,
    beak: 0xed8936,
    speedMult: 1,
    feverBonus: 3,
    daylightBonus: 3,
    magnetAlways: false,
    collection: "nature",
  },
  {
    id: "falcon",
    name: "Peregrine",
    perk: "+7% top speed",
    price: 640,
    body: 0x2c5282,
    wing: 0x2b6cb0,
    belly: 0xebf8ff,
    beak: 0x1a365d,
    speedMult: 1.07,
    feverBonus: 0,
    daylightBonus: 0,
    magnetAlways: false,
    collection: "nature",
  },
  {
    id: "ibis",
    name: "Scarlet Ibis",
    perk: "+8 s of daylight",
    price: 720,
    body: 0xe53e3e,
    wing: 0xfc8181,
    belly: 0xfff5f5,
    beak: 0x742a2a,
    speedMult: 1,
    feverBonus: 0,
    daylightBonus: 8,
    magnetAlways: false,
    collection: "nature",
  },
  {
    id: "quetzal",
    name: "Quetzal",
    perk: "Fever +4 s · +2% speed",
    price: 780,
    body: 0x276749,
    wing: 0x38b2ac,
    belly: 0xd6f5e6,
    beak: 0xf6e05e,
    speedMult: 1.02,
    feverBonus: 4,
    daylightBonus: 0,
    magnetAlways: false,
    collection: "nature",
  },
  {
    id: "harpy",
    name: "Harpy Eagle",
    perk: "+6% speed · +4 s daylight",
    price: 850,
    body: 0x4a5568,
    wing: 0x718096,
    belly: 0xedf2f7,
    beak: 0x2d3748,
    speedMult: 1.06,
    feverBonus: 0,
    daylightBonus: 4,
    magnetAlways: false,
    collection: "nature",
  },
  {
    id: "raven",
    name: "Midnight Raven",
    perk: "Fever +5 s",
    price: 900,
    body: 0x171923,
    wing: 0x2d3748,
    belly: 0x4a5568,
    beak: 0x2d3748,
    speedMult: 1,
    feverBonus: 5,
    daylightBonus: 0,
    magnetAlways: false,
    collection: "nature",
  },
  {
    id: "condor",
    name: "Sun Condor",
    perk: "+5% speed · fever +3 s · +3 s daylight",
    price: 950,
    body: 0x975a16,
    wing: 0xd69e2e,
    belly: 0xfffff0,
    beak: 0xf2c14e,
    speedMult: 1.05,
    feverBonus: 3,
    daylightBonus: 3,
    magnetAlways: false,
    collection: "nature",
  },
  {
    id: "hummingbird",
    name: "Jewel Hummingbird",
    perk: "Duel prize · +4% speed · fever +2 s",
    price: 0,
    prizeOnly: "Win 10 ranked duels",
    body: 0x0bc5ea,
    wing: 0x8a6fff,
    belly: 0xeaffff,
    beak: 0x2d3748,
    speedMult: 1.04,
    feverBonus: 2,
    daylightBonus: 0,
    magnetAlways: false,
    collection: "tournament",
  },
  {
    id: "stormcrow",
    name: "Stormcrow",
    perk: "Gauntlet prize · +5 s daylight · fever +2 s",
    price: 0,
    prizeOnly: "Clear 5 weekly gauntlets",
    body: 0x44337a,
    wing: 0x6b46c1,
    belly: 0xe9d8fd,
    beak: 0xffb020,
    speedMult: 1,
    feverBonus: 2,
    daylightBonus: 5,
    magnetAlways: false,
    collection: "achievement",
  },
  {
    id: "paradise",
    name: "Bird of Paradise",
    perk: "Season prize · +3% speed · +5 s daylight",
    price: 0,
    prizeOnly: "Reach Nest Pass tier 30",
    body: 0xd69e2e,
    wing: 0x00a3c4,
    belly: 0xfff6d6,
    beak: 0xf2c14e,
    speedMult: 1.03,
    feverBonus: 0,
    daylightBonus: 5,
    magnetAlways: false,
    collection: "achievement",
  },
  {
    id: "solstice",
    name: "Solstice",
    perk: "Legend prize · +5% speed · fever +4 s",
    price: 0,
    prizeOnly: "Reach the Sunbird Legend division",
    body: 0xff6b1a,
    wing: 0xffd53d,
    belly: 0xfffaf0,
    beak: 0xf2c14e,
    speedMult: 1.05,
    feverBonus: 4,
    daylightBonus: 0,
    magnetAlways: false,
    collection: "tournament",
  },
  {
    id: "phoenix",
    name: "Phoenix",
    perk: "Always-on coin magnet · ember trail",
    price: 0,
    goldOnly: true,
    body: 0xffb020,
    wing: 0xff4d2a,
    belly: 0xfff3c2,
    beak: 0xffe066,
    speedMult: 1.03,
    feverBonus: 2,
    daylightBonus: 0,
    magnetAlways: true,
    collection: "premium",
  },
  {
    id: "aurora",
    name: "Aurora",
    perk: "VIP exclusive · rainbow fever trail",
    price: 0,
    vipOnly: true,
    body: 0x7fd8c8,
    wing: 0xa78bff,
    belly: 0xeafff6,
    beak: 0xffd166,
    speedMult: 1.02,
    feverBonus: 3,
    daylightBonus: 4,
    magnetAlways: false,
    collection: "premium",
  },
  {
    id: "jet",
    name: "Jet",
    perk: "+8% top speed",
    price: 350,
    body: 0x2d2d2d,
    wing: 0xff4444,
    belly: 0xffcccc,
    beak: 0xff6666,
    speedMult: 1.08,
    feverBonus: 0,
    daylightBonus: 0,
    magnetAlways: false,
    collection: "elements",
  },
  {
    id: "cloudwalker",
    name: "Cloudwalker",
    perk: "+6 s daylight",
    price: 500,
    body: 0xe8f4fd,
    wing: 0xb8d8f8,
    belly: 0xffffff,
    beak: 0xffd166,
    speedMult: 1,
    feverBonus: 0,
    daylightBonus: 6,
    magnetAlways: false,
    collection: "elements",
  },
  {
    id: "stormchaser",
    name: "Stormchaser",
    perk: "+3 s fever duration",
    price: 600,
    body: 0x4a6fa5,
    wing: 0x8ab4d8,
    belly: 0xd4e8f5,
    beak: 0xffa040,
    speedMult: 1.02,
    feverBonus: 3,
    daylightBonus: 0,
    magnetAlways: false,
    collection: "elements",
  },
  {
    id: "snowowl",
    name: "Snow Owl",
    perk: "+8 s daylight",
    price: 550,
    body: 0xf0f0f8,
    wing: 0xc8d0e8,
    belly: 0xffffff,
    beak: 0xffb020,
    speedMult: 1,
    feverBonus: 0,
    daylightBonus: 8,
    magnetAlways: false,
    collection: "seasonal",
  },
  {
    id: "ruby",
    name: "Ruby",
    perk: "+5% speed · +2 s fever",
    price: 400,
    body: 0xcc2244,
    wing: 0xff5577,
    belly: 0xffddee,
    beak: 0xffaa44,
    speedMult: 1.05,
    feverBonus: 2,
    daylightBonus: 0,
    magnetAlways: false,
    collection: "elements",
  },
  {
    id: "golden",
    name: "Golden Eagle",
    perk: "+4% speed · +4 s daylight",
    price: 800,
    body: 0xdaa520,
    wing: 0xffd700,
    belly: 0xfff8dc,
    beak: 0xffa500,
    speedMult: 1.04,
    feverBonus: 0,
    daylightBonus: 4,
    magnetAlways: false,
    collection: "elements",
  },

  // --- Expanded catalogue (Elements · Cosmic · Seasonal · Tournament · Achievement collections) ---
  { id: "ember_wren", name: "Ember Wren", perk: "+3% speed · ember trail", price: 400, body: 0xcc4400, wing: 0xff8844, belly: 0xffddaa, beak: 0xffcc00, speedMult: 1.03, feverBonus: 0, daylightBonus: 0, magnetAlways: false, rarity: "common", collection: "elements" },
  { id: "snow_owl", name: "Boreal Owl", perk: "+8 s daylight", price: 550, body: 0x2fd6a0, wing: 0x8affd8, belly: 0xeafffa, beak: 0xffb020, speedMult: 1, feverBonus: 0, daylightBonus: 8, magnetAlways: false, rarity: "rare", collection: "elements" },
  { id: "storm_rider", name: "Storm Rider", perk: "Weather immunity", price: 700, body: 0x2a3a5a, wing: 0x5a7a9a, belly: 0xd0e0f0, beak: 0xffa040, speedMult: 1.01, feverBonus: 1, daylightBonus: 0, magnetAlways: false, weatherProof: true, rarity: "rare", collection: "elements" },
  { id: "crystal", name: "Crystal Wing", perk: "+5% speed · +2 s daylight", price: 600, body: 0x88ccff, wing: 0xaaeeff, belly: 0xffffff, beak: 0xffd700, speedMult: 1.05, feverBonus: 0, daylightBonus: 2, magnetAlways: false, rarity: "rare", collection: "elements" },
  { id: "nebula", name: "Nebula", perk: "+3% speed · +3 s fever", price: 750, body: 0x6a3a8a, wing: 0xaa66cc, belly: 0xeeddff, beak: 0xffaa44, speedMult: 1.03, feverBonus: 3, daylightBonus: 0, magnetAlways: false, rarity: "epic", collection: "cosmic" },
  { id: "comet", name: "Comet", perk: "+6% speed", price: 500, body: 0x2244aa, wing: 0x66aaff, belly: 0xccddff, beak: 0xffcc00, speedMult: 1.06, feverBonus: 0, daylightBonus: 0, magnetAlways: false, rarity: "common", collection: "cosmic" },
  { id: "supernova", name: "Supernova", perk: "+4% speed · +4 s fever", price: 800, body: 0xff4400, wing: 0xff8800, belly: 0xffeecc, beak: 0xffdd00, speedMult: 1.04, feverBonus: 4, daylightBonus: 0, magnetAlways: false, rarity: "legendary", collection: "cosmic" },
  { id: "void", name: "Void Walker", perk: "+5 s daylight · stealth", price: 650, body: 0x0a0a1a, wing: 0x2a2a4a, belly: 0x4a4a6a, beak: 0x8888aa, speedMult: 1, feverBonus: 0, daylightBonus: 5, magnetAlways: false, stealth: true, rarity: "rare", collection: "cosmic" },
  { id: "spring", name: "Cherry Blossom", perk: "+3 s daylight · +2 s fever", price: 450, body: 0xffaacc, wing: 0xffccee, belly: 0xffffff, beak: 0xffaa44, speedMult: 1, feverBonus: 2, daylightBonus: 3, magnetAlways: false, rarity: "common", collection: "seasonal" },
  { id: "summer", name: "Sunset", perk: "+5% speed · +3 s daylight", price: 500, body: 0xff6644, wing: 0xffaa66, belly: 0xffeedd, beak: 0xffcc00, speedMult: 1.05, feverBonus: 0, daylightBonus: 3, magnetAlways: false, rarity: "common", collection: "seasonal" },
  { id: "autumn", name: "Maple", perk: "+4 s daylight", price: 400, body: 0xcc6600, wing: 0xffaa44, belly: 0xffeedd, beak: 0xff8800, speedMult: 1, feverBonus: 0, daylightBonus: 4, magnetAlways: false, rarity: "common", collection: "seasonal" },
  { id: "winter", name: "Frost", perk: "+6 s daylight · weather immunity", price: 700, body: 0xaaccff, wing: 0xccddff, belly: 0xffffff, beak: 0xffdd00, speedMult: 1, feverBonus: 1, daylightBonus: 6, magnetAlways: false, weatherProof: true, rarity: "rare", collection: "seasonal" },
  { id: "champion", name: "Champion", perk: "+5% speed · +5 s fever", price: 0, body: 0xffd700, wing: 0xffaa00, belly: 0xfff8dc, beak: 0xff6600, speedMult: 1.05, feverBonus: 5, daylightBonus: 0, magnetAlways: false, rarity: "legendary", collection: "tournament", prizeOnly: "Claim a gold cup trophy" },
  { id: "legendary", name: "Legendary", perk: "+8% speed · +4 s daylight", price: 0, body: 0x9933ff, wing: 0xbb66ff, belly: 0xeeddff, beak: 0xffaa44, speedMult: 1.08, feverBonus: 0, daylightBonus: 4, magnetAlways: false, rarity: "legendary", collection: "tournament", prizeOnly: "Claim a diamond cup trophy" },
  { id: "mythic", name: "Mythic", perk: "All stats +5%", price: 0, body: 0xff3366, wing: 0xff6699, belly: 0xffeedd, beak: 0xffcc00, speedMult: 1.05, feverBonus: 3, daylightBonus: 3, magnetAlways: false, rarity: "mythic", collection: "tournament", prizeOnly: "Win 10 duels in a row" },
  { id: "ghost", name: "Ghost", perk: "+4 s daylight · ghost trail", price: 0, body: 0x888899, wing: 0xaaaacc, belly: 0xddeeff, beak: 0xccccdd, speedMult: 1, feverBonus: 0, daylightBonus: 4, magnetAlways: false, rarity: "epic", collection: "achievement", prizeOnly: "Beat your ghost 10 times" },
  { id: "shadow", name: "Shadow", perk: "+3% speed · stealth", price: 0, body: 0x222233, wing: 0x444455, belly: 0x666677, beak: 0x888899, speedMult: 1.03, feverBonus: 0, daylightBonus: 0, magnetAlways: false, stealth: true, rarity: "epic", collection: "achievement", prizeOnly: "Bank 25 zeniths lifetime" },
  { id: "rainbow", name: "Rainbow", perk: "All stats +3%", price: 0, body: 0xff5577, wing: 0x9d6bff, belly: 0xfff0e6, beak: 0xffb020, speedMult: 1.03, feverBonus: 2, daylightBonus: 2, magnetAlways: false, rarity: "legendary", collection: "achievement", prizeOnly: "Own 15 other skins" },
  { id: "golden_eagle", name: "Helios", perk: "+4% speed · +4 s daylight", price: 800, body: 0xffc400, wing: 0xffe066, belly: 0xffffff, beak: 0xff8c00, speedMult: 1.04, feverBonus: 0, daylightBonus: 4, magnetAlways: false, rarity: "epic", collection: "cosmic" },
  { id: "phoenix_ember", name: "Phoenix Ember", perk: "+6% speed · ember trail", price: 900, body: 0xff2200, wing: 0xff6600, belly: 0xffccaa, beak: 0xffaa00, speedMult: 1.06, feverBonus: 0, daylightBonus: 0, magnetAlways: false, rarity: "epic", collection: "cosmic" },
  { id: "ice_dragon", name: "Ice Dragon", perk: "+7 s daylight · weather immunity", price: 850, body: 0x66aaff, wing: 0x88ccff, belly: 0xeeffff, beak: 0xffdd00, speedMult: 1, feverBonus: 1, daylightBonus: 7, magnetAlways: false, weatherProof: true, rarity: "epic", collection: "cosmic" },
  { id: "fire_dragon", name: "Fire Dragon", perk: "+5% speed · +3 s fever", price: 850, body: 0xff4400, wing: 0xff8800, belly: 0xffeecc, beak: 0xffcc00, speedMult: 1.05, feverBonus: 3, daylightBonus: 0, magnetAlways: false, rarity: "epic", collection: "cosmic" },
  { id: "thunder", name: "Thunder", perk: "+4% speed · weather immunity", price: 750, body: 0x334466, wing: 0x6688aa, belly: 0xccddee, beak: 0xffaa44, speedMult: 1.04, feverBonus: 1, daylightBonus: 0, magnetAlways: false, weatherProof: true, rarity: "epic", collection: "cosmic" },
  { id: "wind", name: "Zephyr", perk: "+6% speed · +2 s daylight", price: 650, body: 0x88bbdd, wing: 0xaaddff, belly: 0xeeffff, beak: 0xffcc00, speedMult: 1.06, feverBonus: 0, daylightBonus: 2, magnetAlways: false, rarity: "rare", collection: "cosmic" },
  { id: "earth", name: "Terra", perk: "+5 s daylight · magnet", price: 700, body: 0x668844, wing: 0x88aa66, belly: 0xccddaa, beak: 0xffaa44, speedMult: 1, feverBonus: 0, daylightBonus: 5, magnetAlways: false, rarity: "rare", collection: "cosmic" },
  { id: "moon", name: "Moonbird", perk: "+4 s daylight · stealth", price: 600, body: 0xccccee, wing: 0xeeeeff, belly: 0xffffff, beak: 0xffdd00, speedMult: 1, feverBonus: 0, daylightBonus: 4, magnetAlways: false, stealth: true, rarity: "rare", collection: "cosmic" },
  { id: "sun", name: "Solar", perk: "+3% speed · +3 s fever", price: 550, body: 0xffcc00, wing: 0xffee66, belly: 0xffffcc, beak: 0xff8800, speedMult: 1.03, feverBonus: 3, daylightBonus: 0, magnetAlways: false, rarity: "rare", collection: "cosmic" },
  { id: "star", name: "Starlight", perk: "+5 s daylight · +2 s fever", price: 650, body: 0xffeeff, wing: 0xffffff, belly: 0xffffff, beak: 0xffdd00, speedMult: 1, feverBonus: 2, daylightBonus: 5, magnetAlways: false, rarity: "rare", collection: "cosmic" },
  { id: "cosmos", name: "Cosmos", perk: "+4% speed · +4 s daylight", price: 700, body: 0x2233aa, wing: 0x4466cc, belly: 0xaabbdd, beak: 0xffaa44, speedMult: 1.04, feverBonus: 0, daylightBonus: 4, magnetAlways: false, rarity: "rare", collection: "cosmic" },
  { id: "nova", name: "Nova", perk: "+5% speed · +2 s fever", price: 600, body: 0xff2d8a, wing: 0xff7ab8, belly: 0xffe2f0, beak: 0xffdd44, speedMult: 1.05, feverBonus: 2, daylightBonus: 0, magnetAlways: false, rarity: "rare", collection: "cosmic" },
  { id: "quasar", name: "Quasar", perk: "+3% speed · +5 s daylight", price: 750, body: 0x4466cc, wing: 0x6688ee, belly: 0xaaccff, beak: 0xffaa44, speedMult: 1.03, feverBonus: 0, daylightBonus: 5, magnetAlways: false, rarity: "epic", collection: "cosmic" },
  { id: "pulsar", name: "Pulsar", perk: "+4% speed · +3 s fever", price: 700, body: 0x6644aa, wing: 0x8866cc, belly: 0xccbbff, beak: 0xffaa44, speedMult: 1.04, feverBonus: 3, daylightBonus: 0, magnetAlways: false, rarity: "rare", collection: "cosmic" },
  { id: "aurora_borealis", name: "Aurora Borealis", perk: "+3 s daylight · +3 s fever", price: 800, body: 0x44aa88, wing: 0x66ccaa, belly: 0xaaffcc, beak: 0xffaa44, speedMult: 1, feverBonus: 3, daylightBonus: 3, magnetAlways: false, rarity: "legendary", collection: "cosmic" },
  { id: "solar_flare", name: "Solar Flare", perk: "+6% speed · +2 s fever", price: 850, body: 0xff4400, wing: 0xff8800, belly: 0xffccaa, beak: 0xffaa00, speedMult: 1.06, feverBonus: 2, daylightBonus: 0, magnetAlways: false, rarity: "legendary", collection: "cosmic" },
  { id: "black_hole", name: "Black Hole", perk: "+5 s daylight · magnet", price: 900, body: 0x111122, wing: 0x222244, belly: 0x333355, beak: 0x6666aa, speedMult: 1, feverBonus: 0, daylightBonus: 5, magnetAlways: false, rarity: "mythic", collection: "cosmic" },
  { id: "dark_matter", name: "Dark Matter", perk: "+4% speed · +4 s fever", price: 850, body: 0x1a1a2e, wing: 0x333355, belly: 0x4a4a6a, beak: 0x8888aa, speedMult: 1.04, feverBonus: 4, daylightBonus: 0, magnetAlways: false, rarity: "mythic", collection: "cosmic" },
  { id: "apex_roc", name: "Apex Roc", perk: "+8% speed · +5 s fever · +6 s daylight", price: 2500, body: 0x0f2a3d, wing: 0x1f6f8b, belly: 0xd9f6ff, beak: 0xffc94d, speedMult: 1.08, feverBonus: 5, daylightBonus: 6, magnetAlways: false, rarity: "mythic", collection: "cosmic" },
  { id: "solar_sovereign", name: "Solar Sovereign", perk: "+8% speed · +5 s fever · +8 s daylight", price: 5000, body: 0x3d1e00, wing: 0xff8c1a, belly: 0xfff3d6, beak: 0xffe45e, speedMult: 1.08, feverBonus: 5, daylightBonus: 8, magnetAlways: false, rarity: "mythic", collection: "cosmic" },
  { id: "eclipse_origin", name: "Eclipse Origin", perk: "+8% speed · +5 s fever · +10 s daylight", price: 10000, body: 0x050510, wing: 0x6a0dad, belly: 0xf5ecff, beak: 0xffd700, speedMult: 1.08, feverBonus: 5, daylightBonus: 10, magnetAlways: false, rarity: "mythic", collection: "cosmic" },
];

/**
 * Cosmetics are a long-term collection goal. Keeping the original catalogue
 * values separate makes the economy curve intentional and auditable rather
 * than a wall of hand-edited numbers. Earn-only and real-money items retain
 * their existing rules.
 */
function collectionPrice(price: number): number {
  return price === 0 ? 0 : Math.ceil((price * 1.75) / 25) * 25;
}

export const SKINS: SkinDef[] = BASE_SKINS.map((skin) =>
  skin.price === 0 || skin.goldOnly || skin.vipOnly || skin.prizeOnly
    ? skin
    : { ...skin, price: collectionPrice(skin.price) },
);

export function skinById(id: string): SkinDef {
  return SKINS.find((s) => s.id === id) ?? SKINS[0]!;
}

export type BoostDef = {
  id: string;
  name: string;
  desc: string;
  price: number;
  icon: string;
  permanent?: boolean;
};

const BASE_BOOSTS: BoostDef[] = [
  { id: "shield", name: "Sea Shield", desc: "Bounce off the ocean once", price: 60, icon: "🛡" },
  { id: "magnet", name: "Coin Magnet", desc: "Take off with 15 s of magnet", price: 40, icon: "🧲" },
  { id: "sunflask", name: "Sun Flask", desc: "+12 s daylight at takeoff", price: 50, icon: "☀" },
  { id: "headstart", name: "Head Start", desc: "Launch from 300 m at full speed", price: 90, icon: "🚀" },
  { id: "stormward", name: "Storm Ward", desc: "Ash clouds and gusts barely touch you", price: 70, icon: "🌩" },
  { id: "hotwings", name: "Hot Wings", desc: "Take off already in Fever", price: 80, icon: "🔥" },
  { id: "doubletap", name: "Sunburst Trigger", desc: "Double-tap in flight for a powerful burst", price: 420, icon: "⚡", permanent: true },
];

/** Permanent coin multipliers, applied centrally by SaveData.addCoins. */
export const COIN_MULTIPLIER_UPGRADES: Record<string, number> = {
  goldenfeather: 1.1,
};

/** Consumables rise modestly; daily deals remain a valuable return visit. */
export const BOOSTS: BoostDef[] = BASE_BOOSTS.map((boost) => ({
  ...boost,
  price: Math.ceil((boost.price * 1.25) / 5) * 5,
}));

/* ---------- shop trails (coins) — prize trails still come from cups ---------- */

export type ShopTrailDef = {
  id: string;
  label: string;
  desc: string;
  price: number;
  /** CSS colors for the shop swatch, mirrors TRAILS[id].colors */
  css: string[];
};

const BASE_SHOP_TRAILS: ShopTrailDef[] = [
  { id: "trail_ember", label: "Emberline", desc: "A streak of live coals", price: 300, css: ["#ff8a3a", "#ff4a2a", "#ffd27a"] },
  { id: "trail_tide", label: "Tideglass", desc: "Cool sea-green ribbon", price: 350, css: ["#3ae0c8", "#2a9ad8", "#c8fff2"] },
  { id: "trail_bloom", label: "Petalfall", desc: "Drifting pink petals", price: 350, css: ["#ff9ac8", "#ff6a9a", "#ffe0ee"] },
  { id: "trail_gold", label: "Goldleaf", desc: "Pure molten gold", price: 500, css: ["#ffd76a", "#ffb020", "#fff2c8"] },
  { id: "trail_void", label: "Voidwake", desc: "Deep-space violet wake", price: 420, css: ["#6a3aff", "#2a1a6a", "#c8a8ff"] },
  { id: "trail_mint", label: "Mintcloud", desc: "Fresh mint vapor", price: 280, css: ["#7affc8", "#3ad89a", "#e0fff2"] },
  { id: "trail_rose", label: "Rosewind", desc: "Warm rose-gold shimmer", price: 380, css: ["#ffb0a0", "#ff7a6a", "#ffe8d8"] },
  { id: "trail_neon",    label: "Neonpulse",  desc: "Electric arcade glow",      price: 450, css: ["#3affff", "#ff3aff", "#ffff3a"] },
  { id: "trail_spark",   label: "Sparklejet", desc: "Glittering stardust burst",  price: 380, css: ["#fff176", "#ffe57f", "#ffffff"] },
  { id: "trail_aurora",  label: "Aurorawave", desc: "Northern lights ribbon",     price: 490, css: ["#40e0d0", "#7b68ee", "#98fb98"] },
  { id: "trail_lava",    label: "Lavaflow",   desc: "Molten rock and cinders",    price: 420, css: ["#ff4500", "#ff8c00", "#ffd700"] },
  { id: "trail_crystal", label: "Crystaline", desc: "Shattered ice shards",       price: 400, css: ["#b0e0ff", "#e8f4ff", "#6ec6ff"] },
  { id: "trail_shadow",  label: "Shadowrift", desc: "Dark matter in your wake",   price: 460, css: ["#1a0030", "#4a0080", "#9060c8"] },
  { id: "trail_cherry",  label: "Sakuradrift",desc: "Cherry blossom flurry",      price: 360, css: ["#ffb7c5", "#ff85a1", "#fff0f5"] },
  { id: "trail_cosmic",  label: "Cosmicray",  desc: "Supernova particle stream",  price: 500, css: ["#ff6ec7", "#845ef7", "#4cc9f0"] },
];

export const SHOP_TRAILS: ShopTrailDef[] = BASE_SHOP_TRAILS.map((trail) => ({
  ...trail,
  price: Math.ceil((trail.price * 1.5) / 25) * 25,
}));

/** Deterministic daily deal: one boost at half price, same for everyone all day. */
export function dailyDealBoost(dateStr: string): { id: string; price: number } {
  let h = 5381;
  for (let i = 0; i < dateStr.length; i++) h = ((h << 5) + h + dateStr.charCodeAt(i)) >>> 0;
  const def = BOOSTS[h % BOOSTS.length]!;
  return { id: def.id, price: Math.max(10, Math.floor(def.price / 2 / 5) * 5) };
}

/** Deterministic daily flash sale: one bird skin at 40% off, same for all pilots each day. */
export function dailyFlashBird(dateStr: string): { id: string; price: number; originalPrice: number; discountPct: number } {
  const candidates = SKINS.filter(s => s.price > 0 && !s.goldOnly && !s.vipOnly && !s.prizeOnly);
  let h = 7919;
  for (let i = 0; i < dateStr.length; i++) h = ((h << 5) + h + dateStr.charCodeAt(i)) >>> 0;
  const def = candidates[h % candidates.length] || candidates[0]!;
  const price = Math.max(50, Math.floor((def.price * 0.6) / 5) * 5);
  return { id: def.id, price, originalPrice: def.price, discountPct: 40 };
}

/**
 * The Gold pitch. The ad-removal bullet only exists in editions that are
 * allowed to sell ad removal (`SELL_AD_REMOVAL`): portal editions let the
 * platform own ad frequency and forbid in-app purchases (Poki REQ-20), so
 * there the ternary folds to `[]` and the claim never reaches the bundle —
 * `scripts/portal-markers.mjs` fails the build if that ever regresses.
 */
const GOLD_FEATURES = [
  "Phoenix skin — permanent coin magnet & ember trail",
  "2× coins on every flight",
  "+10 s longer days",
  // Use import.meta.env directly so Vite's define folds this to false in portal
  // builds, letting Rollup DCE the string ("No sponsored breaks") from the bundle.
  // Typed in src/vite-env.d.ts, so no cast — and no lint suppression — is needed.
  ...(import.meta.env.VITE_SELL_AD_REMOVAL ? ["No sponsored breaks, ever"] : []),
  // NOTE: On portal builds (Poki) SELL_AD_REMOVAL=false and the continue screen
  // always shows the rewarded ad path (portal owns monetisation). The "free second
  // wind" perk is architecturally correct but invisible on Poki — don't try to
  // surface it there. If Gold is ever cross-marketed to Poki players, add a
  // compensating perk (e.g. +20% coin bonus) that works within portal rules.
  "Unlimited free second winds — the sun never wins",
  "Fly yesterday's hills or wild random seeds",
  "Unlocks the Nest Pass premium reward track",
];

export const GOLD = {
  sku: "sunbird_gold" as const,
  price: "● 500",
  coinPrice: 500,
  name: "Sunbird Gold",
  features: GOLD_FEATURES,
};

/** One-time starter pack: the classic >90%-of-first-purchases offer. Shown
 * after the player has proven engagement (3+ runs) and priced as an easy
 * yes. Contents are deliberately generous — the first purchase is the hard
 * one; its job is to convert, not to profit. */
export const STARTER_PACK = {
  sku: "sunbird_starter" as const,
  price: "● 250",
  coinPrice: 250,
  name: "First Flight Pack",
  coins: 1200,
  trailId: "trail_gold",
  features: ["1,200 coins — four nest levels on day one", "Goldleaf trail — pure molten gold, equipped instantly", "Sun Flask armed for your next flight"],
};

export const VIP = {
  sku: "sunbird_vip" as const,
  price: "● 1,500",
  /** Pure coin unlock — earnable directly through gameplay. */
  coinPrice: 1500,
  name: "Sunbird VIP",
  features: [
    "Exclusive Aurora bird skin with a rainbow trail",
    "Daily login gift of 100 coins — 3,000+ a month",
    "Two second winds per flight instead of one",
    "Nest multiplier boosted +25% while active",
    "Double bounty on won rival challenges",
    "♛ crown on your name in every leaderboard & race",
  ],
};

export type Promo = { type: "gold" } | { type: "vip" } | { type: "coins"; amount: number };

export const PROMO_CODES: Record<string, Promo> = {
  ZENITH: { type: "gold" },
  SUNBIRD: { type: "gold" },
  NEST250: { type: "coins", amount: 250 },
  FEATHER: { type: "coins", amount: 100 },
  AURORA: { type: "vip" },
  KONAMI: { type: "coins", amount: 500 },
  EASTER: { type: "coins", amount: 100 },
};

export type SkinView = {
  def: SkinDef;
  owned: boolean;
  equipped: boolean;
  locked: boolean;
  lockReason: "gold" | "vip" | null;
  affordable: boolean;
  dealPrice?: number;
};

export type BoostView = {
  def: BoostDef;
  armed: boolean;
  affordable: boolean;
  /** Present when this boost is today's half-price deal. */
  dealPrice?: number;
};

export type ShopTrailView = {
  def: ShopTrailDef;
  owned: boolean;
  equipped: boolean;
  affordable: boolean;
};

export type WheelSector = {
  id: string;
  label: string;
  icon: string;
  kind: "coins" | "boost" | "vault";
  value: number | string;
  color: string;
};

export const WHEEL_SECTORS: WheelSector[] = [
  { id: "c100", label: "100 Coins", icon: "●", kind: "coins", value: 100, color: "#ff8c00" },
  { id: "c250", label: "250 Coins", icon: "●", kind: "coins", value: 250, color: "#e0392a" },
  { id: "magnet", label: "Coin Magnet", icon: "🧲", kind: "boost", value: "magnet", color: "#3d8bf2" },
  { id: "c500", label: "500 Coins", icon: "●", kind: "coins", value: 500, color: "#2f855a" },
  { id: "headstart", label: "Head Start", icon: "🚀", kind: "boost", value: "headstart", color: "#6b46c1" },
  { id: "c1000", label: "1,000 JACKPOT!", icon: "💎", kind: "coins", value: 1000, color: "#d69e2e" },
  { id: "vault", label: "Vault Key", icon: "🥚", kind: "vault", value: 1, color: "#d63384" },
  { id: "c150", label: "150 Coins", icon: "●", kind: "coins", value: 150, color: "#00a3c4" },
];
