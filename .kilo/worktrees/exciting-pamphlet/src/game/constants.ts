export const PHYS_HZ = 120;
export const PHYS_DT = 1 / PHYS_HZ;

/* ---------------- momentum flight model ----------------
 * Height comes from momentum, never from "flapping upward".
 *   hold  -> heavier gravity + strong ground suction (carve the valley)
 *   release -> light gravity + lift from speed (ride the arc)
 *
 * TUNED 2026-09-24 v2 for ZERO BOREDOM:
 * - Glide gravity UP (18→24) so long hangs sink fast
 * - Lift MAX down (0.46→0.35) → lower ceiling, hill-to-hill not sky-to-sky
 * - Air drag UP (0.0003→0.00062) → speed decays in long glides, must dive
 * - Ground friction still low → never stuck uphill, but air is punishing if idle
 * - Sunflower + landing keep UP → momentum lives when you play well
 */
export const GRAVITY_GLIDE = 24;
export const GRAVITY_DIVE = 98;
/** Gravity along the slope while carving the ground — low so uphill is not a trap. */
export const GROUND_G_GLIDE = 18;
export const GROUND_G_DIVE = 58;
/** Quadratic air drag — higher = long passive glides bleed speed and sink. */
export const AIR_DRAG_GLIDE = 0.00062;
export const AIR_DRAG_DIVE = 0.00014;
/** Rolling resistance while on the ground — low so you roll out of valleys. */
export const GROUND_FRICTION = 0.024;
export const GROUND_FRICTION_DIVE = 0.008;
/** Speed-borne lift while gliding: cancels up to this fraction of gravity. */
export const GLIDE_LIFT_MAX = 0.35;
export const GLIDE_LIFT_SPEED = 52;
/** Downforce that keeps a diving bird glued through convex crests. */
export const STICK_ACCEL_DIVE = 210;
export const STICK_ACCEL_GLIDE = 18;

export const MAX_SPEED = 118;
export const MAX_SPEED_FEVER = 142;
export const BIRD_RADIUS = 0.9;
export const MIN_KEEP_SPEED = 10;

/* Sunflower bounce pads — land on a bloom and spring straight back into the
 * sky. Bumped for more fun: a good line should feel like a trampoline, not a speed bump. */
export const SUNFLOWER_VY = 36;
export const SUNFLOWER_VX = 36;

/* Landing quality: how much speed survives touching down.
 * alignment = 1 - |v·n| / |v|   (1 = perfectly tangential kiss) */
export const LAND_PERFECT = 0.985;
export const LAND_GOOD = 0.94;
export const LAND_PERFECT_GAIN = 1.04;
export const LAND_GOOD_KEEP = 1.02;
export const LAND_BAD_MIN_KEEP = 0.7;
export const LAND_FEATHER_FLOOR = 0.88;

/* ---------------- launch rating ---------------- */
export const LAUNCH_MIN_SPEED = 26;
export const LAUNCH_RELEASE_WINDOW = 1.35;
export const RATING_GOOD = 0.42;
export const RATING_GREAT = 0.68;
export const RATING_PERFECT = 0.84;
export const LAUNCH_BOOST_GOOD = 1.02;
export const LAUNCH_BOOST_GREAT = 1.07;
export const LAUNCH_BOOST_PERFECT = 1.145;
export const LAUNCH_COMBO_STEP = 0.012;
export const LAUNCH_COMBO_MAX = 0.09;
export const COMBO_GRACE = 9;

/* ---------------- altitude zones (world units above terrain) ----------------
 * Lowered again v2: sky 26, clouds 52, high 88, strato 140 — player stays in
 * readable terrain, not 200m hangtime. High rewards still exist but require
 * perfect launches + thermals, not just holding.
 */
export const ALT_SKY = 26;
export const ALT_CLOUDS = 52;
export const ALT_HIGH = 88;
export const ALT_STRATO = 140;

/* ---------------- island rhythm — TIGHTER = LESS BOREDOM ----------------
 * ISLAND_PERIOD 1100→920: islands every 920 units, not 1100 → 20% more hills
 * GAP_START 928→760: ocean starts earlier but is SHORTER (920-760=160 vs 172)
 * DROP/RAMP earlier so you launch sooner, less flat cruising.
 */
export const ISLAND_PERIOD = 920;
export const DROP_START = 600;
export const DROP_BLEND_START = 520;
export const RAMP_START = 700;
export const GAP_START = 760;
export const OCEAN_FLOOR = -18;
export const WATER_Y = 0.4;

export const CHUNK_SIZE = 72;
export const CHUNK_RES = 1.8;
export const TERRAIN_HALF_Z = 11;
export const TERRAIN_FACE_DEPTH = 42;
export const VISIBLE_CHUNKS_BACK = 4;
export const VISIBLE_CHUNKS_FWD = 14;

export const DAYLIGHT_MAX = 52;
export const DAYLIGHT_ISLAND_REFILL = 15;
export const DAYLIGHT_OCEAN_PENALTY = 4.5;

export const FEVER_NEED = 3;
export const FEVER_DURATION = 9;
export const NEST_MULT_PER_LEVEL = 0.12;

export const COIN_VALUE = 1;
export const CLOUD_BONUS = 40;
export const MAGNET_RADIUS = 15;
export const MAGNET_RADIUS_NORMAL = 1.7;

export const CAMERA_BASE_Z = 24;
export const CAMERA_LOOKAHEAD = 0.22;

export const SAVE_KEY_V1 = "sunbird.save.v1";
export const SAVE_KEY = "sunbird.save.v2";
/** Where an unreadable save is parked before a clean boot, so player data is
 *  never destroyed by the corruption-recovery path. */
export const SAVE_KEY_CORRUPT = "sunbird.save.corrupt";

export const DAYLIGHT_MAX_GOLD = 62;
export const CONTINUE_COST = 80;
export const CONTINUE_DAYLIGHT = 16;
export const CONTINUE_TIMEOUT = 15;
export const AD_DURATION = 4;
// Poki controls ad frequency on the portal; this applies only to dev/standalone builds.
export const INTERSTITIAL_EVERY = 3;

export const DAILY_STIPEND = 250;
/** Portal shop: coins granted per watched rewarded ad (kept modest so the
 *  2500+ mythic tier stays a long-term chase, not an ad-weekend grind). */
export const SHOP_AD_COINS = 60;
/** Portal shop: rewarded-coin claims allowed per session (anti-farm cap). */
export const SHOP_AD_SESSION_CAP = 5;

export const PIGGY_BANK_MIN_SMASH = 50;
export const PIGGY_BANK_CAP = 1000;

export const ZENITH_ALT = 42;

/* ---------------- power-ups ---------------- */
export const PU_LONGGLIDE = 9;
export const PU_WINGBOOST = 8;
export const PU_SPEED = 2.2;
export const PU_FEATHER = 12;
export const PU_MAGNET = 12;
export const PU_GOLDENWINGS = 10;
export const PU_CLOUDBOOST = 14;
export const ZENITH_SLOWMO = 0.22;
export const ZENITH_DURATION = 0.55;

export const PICKUP_SUN_TIME = 6;
export const MAGNET_TIME = 12;
export const BOOST_TIME = 1.6;
export const BOOST_EXTRA_SPEED = 52;
/** Manual double-tap burst: bumped so it actually saves a bad uphill, not just decorates it. */
export const MANUAL_BOOST_TIME = 1.35;
export const MANUAL_BOOST_SPEED = 38;
export const MANUAL_BOOST_COOLDOWN = 2.8;
export const STALL_SPEED = 6.5;
export const HEADSTART_DISTANCE = 300;

export const VIP_DAYS = 30;
export const ADS_PER_DAY = 4;
export const AD_MIN_RUN_GAP = 2;

/* ---------- Season pass ---------- */
export const SEASON_TIERS = 50;
export const SEASON_XP_PER_TIER = 260;
export const VIP_DAILY_GIFT = 100;

/* ---------- Ghost rival ---------- */
export const GHOST_SAMPLE_DT = 0.1;
export const GHOST_MAX_SAMPLES = 6000;

/* ---------- Referral ---------- */
export const REFERRAL_BONUS = 60;
