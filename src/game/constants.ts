export const PHYS_HZ = 120;
export const PHYS_DT = 1 / PHYS_HZ;

/* ---------------- momentum flight model ----------------
 * Height comes from momentum, never from "flapping upward".
 *   hold  -> heavier gravity + strong ground suction (carve the valley)
 *   release -> light gravity + lift from speed (ride the arc)
 */
export const GRAVITY_GLIDE = 18;
export const GRAVITY_DIVE = 96;
/** Gravity along the slope while carving the ground. */
export const GROUND_G_GLIDE = 30;
export const GROUND_G_DIVE = 88;
/** Quadratic air drag (per unit speed²) — low, so momentum lives a long time. */
export const AIR_DRAG_GLIDE = 0.00042;
export const AIR_DRAG_DIVE = 0.00016;
/** Rolling resistance while on the ground. */
export const GROUND_FRICTION = 0.05;
export const GROUND_FRICTION_DIVE = 0.018;
/** Speed-borne lift while gliding: cancels up to this fraction of gravity. */
export const GLIDE_LIFT_MAX = 0.55;
export const GLIDE_LIFT_SPEED = 62;
/** Downforce that keeps a diving bird glued through convex crests. */
export const STICK_ACCEL_DIVE = 190;
export const STICK_ACCEL_GLIDE = 13;

export const MAX_SPEED = 108;
export const MAX_SPEED_FEVER = 128;
export const BIRD_RADIUS = 0.9;
export const MIN_KEEP_SPEED = 6;

/* Sunflower bounce pads — land on a bloom and spring straight back into the
 * sky. Gentler than the balloon (an airborne rare), so they reward line
 * choices without trivialising the ramps. */
export const SUNFLOWER_VY = 30;
export const SUNFLOWER_VX = 30;

/* Landing quality: how much speed survives touching down.
 * alignment = 1 - |v·n| / |v|   (1 = perfectly tangential kiss) */
export const LAND_PERFECT = 0.985;
export const LAND_GOOD = 0.94;
export const LAND_PERFECT_GAIN = 1.03;
export const LAND_GOOD_KEEP = 1.0;
export const LAND_BAD_MIN_KEEP = 0.55;
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

/* ---------------- altitude zones (world units above terrain) ---------------- */
export const ALT_SKY = 30;
export const ALT_CLOUDS = 72;
export const ALT_HIGH = 135;
/**
 * Soft ceiling on how high a run can climb, and the band over which the climb is
 * damped away.
 *
 * Nothing used to bound altitude. Thermals add vertical speed directly
 * (Weather: `vy += 24 * dt`) and the Zenith mode's ascent super-lift adds more,
 * while glide lift cuts gravity to ~2.7 m/s² at full lift — so a single strong
 * column could arc the bird thousands of units up: past the cloud deck, past
 * everything the camera is framed for (its pull-back saturates at
 * ALT_HIGH * 2.2 = 297 at CAMERA_REVEAL_MAX), and into empty sky with no ground
 * in sight. That is the "it flies way too high" report.
 *
 * 260 with a 50-unit fade keeps the whole Star Wish band reachable untouched
 * (stars sit at ALT_HIGH + 18..72, i.e. 153..207 — damping starts at 210, above
 * every star), then bleeds the remaining climb so the bird arcs over inside the
 * camera's range instead of leaving the world. Damping rather than a hard wall:
 * a hard clamp at the ceiling reads as an invisible lid.
 */
export const ALT_CEILING = 260;
export const ALT_CEILING_FADE = 50;
/**
 * Upward speed the Zenith mode's ascent thermal may reach, in m/s.
 *
 * This was hardcoded to 180 — 1.5x the bird's own top speed (~122 m/s) and
 * roughly 65x its normal climb — which is what turned a warm column into a
 * launch to orbit. Still a deliberate super-lift at 110, but inside the
 * envelope the rest of the world is tuned to.
 */
export const ZENITH_THERMAL_VY = 110;
export const ALT_STRATO = 230;

export const ISLAND_PERIOD = 1100;
export const DROP_START = 710;
export const DROP_BLEND_START = 630;
export const RAMP_START = 845;
export const GAP_START = 928;
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

// A calmer default chase distance gives players more route visibility and
// keeps the bird from dominating the frame on the first seconds of a run.
export const CAMERA_BASE_Z = 28;
/**
 * Base visual scale of the bird. It is the subject of the whole game and the
 * only thing the player tracks, so it reads generously rather than realistically
 * small. Visual only — collision uses BIRD_RADIUS.
 *
 * At 1.4 it still read as small against the terrain at ground level, where the
 * camera is closest and the silhouette is least compensated. 1.65 is the
 * subject-forward size; the camera-distance term in Bird.syncVisual keeps the
 * altitude case readable on top of it.
 */
export const BIRD_BASE_SCALE = 1.65;
/**
 * Highest camera distance the altitude pull reaches: the base dolly plus the
 * speed term plus the four altitude tiers summed in CameraRig.update
 * (24 + 14 + 12 + 22 + 34 + 46). It normalises the bird's readability
 * compensation, so retune it if the framing curve moves.
 */
export const CAMERA_REVEAL_MAX = 152;
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
/**
 * Longest a sponsored break may hold the game before the game abandons it.
 *
 * The ad state is unskippable by design, which is only safe if it can never be
 * permanent. Real breaks — interstitial or rewarded — resolve well inside this,
 * so the valve never fires in normal play; it exists so a platform SDK that
 * never settles cannot leave the player on a dead screen with inert controls.
 * Abandoning a break grants nothing: the reward still comes only from the SDK's
 * own callback.
 */
export const AD_SAFETY_SECONDS = 60;
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
export const BOOST_EXTRA_SPEED = 42;
/** Manual double-tap burst: short, readable, and capped so it cannot replace
 * the hill timing loop. */
export const MANUAL_BOOST_TIME = 1.1;
export const MANUAL_BOOST_SPEED = 30;
export const MANUAL_BOOST_COOLDOWN = 3.5;
export const STALL_SPEED = 8;
export const HEADSTART_DISTANCE = 300;

/* ---------- Stripe (see .env.example) ---------- */
// import.meta.env only exists under Vite — plain Node runners (tsx harnesses
// like scripts/physcheck.ts) import this module too, so read it defensively.
const ENV: Record<string, string | undefined> = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
export const STRIPE_PUBLISHABLE_KEY = ENV.VITE_STRIPE_PUBLISHABLE_KEY ?? "";
export const STRIPE_GOLD_LINK = ENV.VITE_STRIPE_GOLD_LINK ?? "";
export const STRIPE_VIP_LINK = ENV.VITE_STRIPE_VIP_LINK ?? "";
export const STRIPE_STARTER_LINK = ENV.VITE_STRIPE_STARTER_LINK ?? "";
export const STRIPE_RETURN_KEY = "sunbird_stripe";

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
