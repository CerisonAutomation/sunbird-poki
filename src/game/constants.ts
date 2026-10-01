export const PHYS_HZ = 120;
export const PHYS_DT = 1 / PHYS_HZ;

/**
 * The most physics steps one frame may be asked to catch up on.
 *
 * The accumulator was drained with no ceiling, so a single slow frame queued
 * every step it had fallen behind by — and each of those steps cost the time
 * that made the next frame slower still. On the CPU-bound mid-range phones the
 * portal actually ships to, that is the difference between a stutter and a
 * locked page. Slightly over a sixth of a second of simulation: long enough
 * that an ordinary dropped frame is fully absorbed and invisible, short enough
 * that a genuine spiral is broken in one frame.
 */
export const MAX_CATCHUP_STEPS = 20;

/* ---------------- momentum flight model ----------------
 * Height comes from momentum, never from "flapping upward".
 *   hold  -> heavier gravity + strong ground suction (carve the valley)
 *   release -> light gravity + lift from speed (ride the arc)
 */
export const GRAVITY_GLIDE = 16;
export const GRAVITY_DIVE = 96;
/** Gravity along the slope while carving the ground. */
/**
 * Along-slope gravity while GLIDING (stick released), UPHILL.
 *
 * Was 30 in the first build and lowered to 14 to soften uphill deceleration —
 * see the original comment, "reduced: less deceleration on uphill slopes".
 * The intent was right and the instrument was wrong: one constant governed
 * both the uphill penalty AND the downhill acceleration, so halving it to fix
 * climbing also halved how fast a released bird builds speed running DOWN a
 * hill. That is the single input the player makes, and it lost more than half
 * its effect as a side effect of an unrelated tuning pass.
 *
 * The two are now separate constants, so uphill stays forgiving at 14 and
 * downhill gets its original response back.
 */
export const GROUND_G_GLIDE = 14;
/**
 * Along-slope gravity while GLIDING, DOWNHILL. Restored to the first build's
 * 30: this is what "the bird was more responsive when released" was made of.
 * Diving is still faster (GROUND_G_DIVE 88), so committing to a dive remains
 * the stronger play and the skill ceiling from 457ff35 is untouched.
 */
export const GROUND_G_GLIDE_DOWN = 30;
export const GROUND_G_DIVE = 88;

/**
 * A floor on how much a HELD stick accelerates a grounded bird.
 *
 * The bird's only grounded acceleration used to be gravity along the slope, so
 * `88 * slope` — and on anything flatter than about 1:10 that is less than the
 * friction it fights. Measured across the nine biomes, 11-20% of every island's
 * run-in sat below 0.12 slope, i.e. flat ground where holding did nothing and
 * letting go actively COST you speed. The `MIN_KEEP_SPEED` floor then supplied
 * the missing velocity, so a dead stretch was a 12 m/s conveyor rather than a
 * mistake.
 *
 * Tiny Wings, this game's own ancestor, pushes a constant downward force
 * whenever the player dives (`ApplyForce(b2Vec2(0,-40))` in Hero.mm), so
 * holding always does something. This is the same idea in the tangent frame:
 * a floor, not an addend, so steep terrain — where the slope term already
 * exceeds it and the feel is already right — is untouched, and uphill
 * deceleration is untouched, because the game is still built on climbs costing
 * you. Only the dead flat ground gains anything.
 */
export const GROUND_STICK_DIVE = 11;
/**
 * The slope below which ground counts as "dead flat" for the purposes of
 * GROUND_STICK_DIVE above.
 *
 * This exists because the floor was applied *everywhere*, not only on flats.
 * `Math.max(GROUND_G_DIVE * downhill, GROUND_STICK_DIVE)` on an uphill gives
 * `max(negative, 11)` = **+11 m/s², i.e. a held stick accelerated the bird up
 * the hill**, which is the exact opposite of the "uphill deceleration is
 * untouched, the game is still built on climbs costing you" the comment above
 * promises. The consequence was not subtle: it made HOLD THE BUTTON FOREVER
 * the optimal strategy for the entire game. Measured over 60 s runs on three
 * seeds before this fix — hold 2.23/2.49/2.17 km, versus 2.16/1.91/2.23 km for
 * a policy that actually reads the terrain. Playing well was *worse* than
 * playing with a brick on the button, and the skill ceiling of a one-button
 * game is the whole game.
 *
 * 0.12 is the "flatter than about 1:10" the comment above already describes —
 * so the floor now covers exactly the dead ground it was written for, and a
 * climb costs speed again whether or not the stick is held.
 */
export const GROUND_STICK_FLAT_SLOPE = 0.12;

/**
 * The same floor for a bird that has RELEASED.
 *
 * `GROUND_STICK_DIVE` exists because a held stick used to do nothing on flat
 * ground. Releasing had the identical hole and nobody noticed, because the
 * `MIN_KEEP_SPEED` floor papered over it: the bird stopped accelerating and slid
 * along at 12 m/s, which looks like it is working right up until you notice it
 * can never leave the ground again.
 *
 * It cannot leave, because the launch test is `v^2 * curvature > gravity +
 * STICK_ACCEL_GLIDE`. At 12 m/s the terrain has to curve away at 0.20/m; across
 * 3900 sampled metres of a real island only 27 of them (0.7%) are that sharp. So
 * a released bird lands, decays onto the conveyor, and stays welded to the
 * terrain for the rest of the run — measured at 68% of a passive minute spent
 * grounded, the altitude gauge reading a flat 0 m, and the climb goal stuck on 0.
 *
 * Kept deliberately small — 1.5, against the diver's 11 — for two measured
 * reasons.
 *
 * The trade must survive: hold for speed and stay glued, release for lift.
 * A floor anywhere near the diver's erases it. `GROUND_STICK_GLIDE` at 4.5
 * measured hold/coast at 1.256x, under the 1.3x the skill-ceiling guard
 * requires, because a bird that never touches the button closes most of the
 * gap by accelerating for free on flat ground. At 1.5 the ratio is 1.381x:
 * the button still clearly matters, which is the entire premise of a
 * one-button game.
 *
 * The other half of the fix did not need this constant at all. Releasing used
 * to be welded, but the weld is really two other things: the launch gate
 * charged full gravity while the same bird airborne gets 55% of it cancelled
 * by speed-borne lift (fixed in `Bird.step`), and a released bird had no
 * downhill term to speak of (fixed by `GROUND_G_GLIDE_DOWN`). With both of
 * those in place a coasting bird launches 15.8 times a minute even at zero.
 * This constant is the margin on top: enough that a bird which settles onto
 * dead flat ground can still accelerate off `MIN_KEEP_SPEED` instead of riding
 * it, and not enough to hand the run to a player who never presses anything.
 *
 * Swept 0 / 0.5 / 1 / 1.5 / 2 / 2.5 / 3 / 4.5 against both constraints at once.
 * 1.5 gave the highest launch count of the sweep (17.8/min) as well as the
 * design margin, so it wins on the thing this constant is actually for.
 */
export const GROUND_STICK_GLIDE = 1.5;

/** Quadratic air drag (per unit speed²) — low, so momentum lives a long time. */
export const AIR_DRAG_GLIDE = 0.00042;
export const AIR_DRAG_DIVE = 0.00016;
/**
 * FLARE — what releasing a dive actually does.
 *
 * Until now it did nothing at all. Measured on a clean one-second hold in clear
 * air: the bird is at -95.4 m/s, and half a second after letting go it is at
 * -97.7. The dive was a one-way door, because lift in this model only ever
 * *reduces* downward gravity — the strongest thing the game could do was take
 * GRAVITY_GLIDE from 16 down to 8.8 m/s², and nothing anywhere pushed back.
 *
 * So the release now adds a one-shot upward impulse, proportional to how fast
 * you were actually falling. It is a flare, not a jet: it SHEDS dive speed, it
 * never lifts you, and at low speed it is nearly nothing, so a gentle tap and a
 * committed plunge are different gestures.
 *
 * 26 m/s against a 95 m/s terminal dive removes about a quarter of the speed —
 * enough that the next crest is reachable and a bad dive is survivable, small
 * enough that diving deep still means committing. `FLARE_REFERENCE` is the
 * falling speed at which the full amount applies; below it the impulse scales
 * down linearly to nothing.
 */
export const FLARE_REFERENCE = 95;
/** How long the pull-out brakes for, and how hard it pushes at the start.
 *
 *  An IMPULSE was not enough, and the measurement is why. A one-frame nudge of
 *  26 m/s took a 95 m/s dive to 69 — and then gravity took it straight back:
 *  -70 at 42ms, -71 at 192ms, -73 at 492ms. The bird never approached zero. It
 *  just descended slightly more slowly, which reads as a softer dive, not as
 *  catching anything.
 *
 *  So the pull-out is a DECAYING BRAKE instead: a sustained upward acceleration
 *  for FLARE_DURATION, strongest the instant the button comes up and falling
 *  linearly to nothing. Linear decay rather than a curve because it gives a
 *  closed-form impulse — BRAKE * DURATION / 2 ≈ 65 m/s, which takes 95 down to
 *  about 30 — and because a smooth curve would be tuning by feel against a
 *  quantity that should be arithmetic.
 *
 *  It can brake a dive to FLARE_MAX_RISE but never past it, so the flare can
 *  never turn into a climb. Releasing is recovery, not a launch pad.
 */
export const FLARE_BRAKE = 300;
export const FLARE_DURATION = 0.42;
/** Largest m/s of extra speed cap any mode surge can grant — slalom warp's 18.
 *
 *  This lives here, not in `Game.ts`, for one reason: the anti-cheat ceiling
 *  derives itself from the same expression `Bird.step` clamps to, and that
 *  expression has a THIRD term — `speedBonus` — that the ceiling was
 *  forgetting. The four surge constants are private to `Game.ts`, so the
 *  ceiling could not see them and sat 18 m/s below what a fever + boost +
 *  max-skin + slalom dive legitimately reaches. Measured: 270.69 m/s of real
 *  flight against a 256.27 m/s gate, i.e. the game quarantined its own best
 *  players. Adding this term moves the gate to 274.27 and the run clears it.
 *
 *  `Game.ts` keeps the individual per-mode values and must keep every one of
 *  them at or below this; `anticheat.test.ts` fails the build if it does not.
 */
export const MAX_MODE_SPEED_BONUS = 18;
/** m/s. The flare brakes toward this and stops — it never lifts into a climb. */
export const FLARE_MAX_RISE = -14;

/**
 * Where a run begins: already flying, not parked on the tarmac.
 *
 * `bird.reset()` places the bird at `heightAt + BIRD_RADIUS` with `vx = 11` and
 * `grounded = false`. That reads as airborne to the physics but is neither: the
 * body is sitting *on* the surface, so the very first step satisfies
 * `y <= surf` and it "lands" again 0.3 s into every run. Measured across four
 * seeds that is what the player sees — a bird embedded in the grass with the
 * altitude gauge on 0 m, which is why the run opens by looking broken.
 *
 * The start is now a shallow drop-in: clear of the terrain by a visible margin
 * and carrying real airspeed, so the first arc lasts ~2.8 s instead of 0.3 s
 * and the opening frame is a bird in flight.
 *
 * The altitude is deliberately small. It is the run PEAK that scores the climb
 * goal (`Game.maxAltitude`), so a generous start would hand out a slice of the
 * 120 m target for doing nothing; 14 m is enough to read as flight and cheap
 * enough that it is 12% of the goal.
 */
export const START_ALTITUDE = 14;
export const START_SPEED = 48;

/** How long a release stays live and can still spend the flare.
 *
 *  Without this the pull-out depended on the player letting go during one
 *  specific frame, which is not a thing a person can do reliably. 180ms covers
 *  a release that lands while the bird is briefly grounded, or on the frame
 *  where vy crosses zero at the bottom of an arc, without being so long that a
 *  player who lets go and immediately presses again gets a free brake.
 */
export const FLARE_BUFFER = 0.18;

/* ---------------- the pop: timing the release at a crest ----------------
 *
 * The one thing a one-button glider must have is a reason to let go, and this
 * game did not have one. Releasing was pure cost: lighter gravity, more air
 * drag, a braking flare. So "hold the button for the entire run" was not just
 * viable, it was optimal — measured at 2.23 km against 2.16 km for a policy
 * that read the terrain. A game whose optimal strategy is a brick on the
 * button has no skill ceiling, and Poki's own quality bar is built on session
 * length and return rate, both of which come from there being something to get
 * better at.
 *
 * The pop is that reason. Release the stick just before the bird leaves a
 * crest and the take-off converts speed into height: the same gesture Tiny
 * Wings is built on, and the one FirstFlight already coaches with "RELEASE at
 * the top to launch" — an instruction the physics previously ignored.
 *
 * It is bounded so it stays a skill expression and not a flight mode:
 *   · it only fires on a genuine crest launch (curvature + prominence), which
 *     is terrain the player has to find;
 *   · quality decays linearly over LAUNCH_POP_WINDOW, so an early release is
 *     worth a fraction and a held stick is worth nothing;
 *   · it scales with the speed you brought into the lip, so it cannot rescue a
 *     slow run — it multiplies good play instead of substituting for it;
 *   · LAUNCH_POP_MAX caps the vertical gain at roughly a third of the launch
 *     speed, so it is a hop with a long tail, not a jump jet.
 */
/** Seconds before the lip within which a release still counts. */
export const LAUNCH_POP_WINDOW = 0.45;
/**
 * Peak upward velocity (m/s) added by a perfectly timed release.
 *
 * Deliberately in proportion with the rating layer rather than on top of it.
 * `LaunchSystem` already pays a perfect lip `LAUNCH_BOOST_PERFECT` (1.145x)
 * plus `vy + 7`; 26 at full timing and full speed is the *physics* half of the
 * same gesture, and the two together read as one payoff rather than two. 44
 * measured slightly better on the fitness harness (1.77x vs 1.73x against a
 * masher) and was rejected for feel: a +38 m/s vertical kick next to a +7
 * rating bonus stops being a glider.
 *
 * Note the two windows are intentionally different lengths. The rating window
 * (LAUNCH_RELEASE_WINDOW, 1.35 s) is generous because it drives praise, and
 * praise should be easy to earn. The pop window (0.45 s) is tight because it
 * drives distance, and distance is what the leaderboard sorts on.
 */
export const LAUNCH_POP_MAX = 26;
/** Launch speed at which the pop reaches full strength. */
export const LAUNCH_POP_SPEED = 70;
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
/**
 * The highest `speedMult` any skin may carry. The anti-cheat ceiling multiplies
 * by this, so it is a ceiling on the *content* as well as on the gate: a skin
 * added above it would be legal to fly and illegal to submit. Pinned by
 * `anticheat.test.ts`, which fails if `SKINS` ever exceeds it.
 */
export const MAX_SKIN_SPEED_MULT = 1.08;
export const BIRD_RADIUS = 0.9;
export const MIN_KEEP_SPEED = 12; // higher floor: bird never stalls on uphill terrain

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
/**
 * How much a tuck (stick held through touchdown) softens a bad landing.
 *
 * This used to be `if (diving) floor = Math.max(floor, 0.86)` — a *floor*, not
 * a bonus. It meant that holding the button turned the worst possible landing
 * in the game, a dead-vertical slam, into a 14% speed loss, versus 45% for the
 * same slam with the stick released. Landing alignment is one of the two skill
 * dimensions this game has, and holding the button deleted it: there was no
 * touchdown bad enough to punish a player who simply never let go.
 *
 * A tuck is now worth a fixed, modest amount on top of the same floor everyone
 * else gets. Absorbing an impact still rewards the player who commits to it,
 * but a slam is still a slam, and a tangential kiss (LAND_PERFECT_GAIN) is
 * still worth roughly half a run more than a crash.
 */
export const LAND_TUCK_BONUS = 0.08;
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
/**
 * Depth of the soft band below ALT_CEILING over which a climb is damped out.
 *
 * Was 50 in the first build against a 260 ceiling — a fade from 210 to 260.
 * It became 20 against a 230 ceiling, i.e. 210 to 230: the same start, two
 * and a half times sharper, and a hard stop 30 m lower. At 220 m a climb now
 * lost 50% where it used to lose 20%, and at 230 it lost everything.
 *
 * That is a wall, and the player's own screenshot shows them pinned against
 * it: "229 m peak" against a 230 m ceiling. A good launch did not feel like a
 * good launch because the game deleted the top of it.
 *
 * Restored to the first build's pairing, 260 ceiling with a 50 fade: the two
 * were tuned together and moving only one pushes the damp band's start down
 * onto the Star Wish band, which flight-ceiling.test.ts correctly refuses
 * (stars top out at 207; the band must start above them, at 210).
 */
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

/**
 * The island template. These five are ONE template and must scale together.
 *
 * `buildSegments` spends a budget of `RAMP_START - cursor` and always fills it,
 * so the number of hills on an island is set by `RAMP_START` alone. Move
 * `ISLAND_PERIOD` on its own and the extra length becomes an un-arched shoulder
 * — a longer, emptier island, which is worse than a short one. This is why the
 * 2026-09-26 "longer islands" pass scaled all five by the same factor.
 *
 * Scale: x1.32 on the previous 1450 pitch. An island is now ~1,900 m — about
 * twenty seconds of real flying against a 52 s day, so a day is a handful of
 * islands rather than a sprint through two.
 */
export const ISLAND_PERIOD = 1912;
export const DROP_START = 1233;
export const DROP_BLEND_START = 1094;
export const RAMP_START = 1470;
export const GAP_START = 1615;
export const OCEAN_FLOOR = -18;
export const WATER_Y = 0.4;

/**
 * How far the flight may travel before the render origin is rebased.
 *
 * GPU vertex and instanced-prop buffers are float32, so baked render-space
 * coordinates start to jitter and crack between chunks once world-x gets large
 * — most visibly on a long Endless run, which is the one mode with no natural
 * end. 4,096 m is roughly two of the game's long islands: rare enough that the
 * chunk rebuild it costs is a non-event, early enough that no player will ever
 * see the artefact. See `Game.maybeRecenter`.
 */
export const RENDER_RECENTER_THRESHOLD = 4096;

export const CHUNK_SIZE = 72;
export const CHUNK_RES = 1.8;
export const TERRAIN_HALF_Z = 11;
export const TERRAIN_FACE_DEPTH = 42;
export const VISIBLE_CHUNKS_BACK = 4;
export const VISIBLE_CHUNKS_FWD = 14;

export const DAYLIGHT_MAX = 52;
export const DAYLIGHT_ISLAND_REFILL = 15;
/**
 * How high you may be and still collect an island's refill.
 *
 * The refill pays for FLIGHT — speed you convert into height on the hills and
 * spend on the launch. Paying it for altitude you never earned made the
 * stratosphere the optimal line: a player cruising above this ceiling banked
 * +15 s per island without touching a hill, so the game's only fail state
 * stopped being one. Set well above the ridge line (which tops out around
 * 60) so an honest high glide still counts.
 */
export const ISLAND_REFILL_CEILING = 120;
/**
 * Sun lost per splash, and how often it is taken.
 *
 * The two were tuned as a pair and read as one number, which is how they became
 * wrong: 4.5 s every 0.55 s is 8.2 daylight-seconds per real second, so a
 * two-second dip in the sea cost a third of a full island's refill and ended
 * most runs outright. Water should be the most expensive thing in the game —
 * it is, at 4.3x the rate the day accrues — but a mistake you can swim out of
 * should cost you a mistake's worth, not the run.
 */
export const DAYLIGHT_OCEAN_PENALTY = 3;
export const DAYLIGHT_SPLASH_INTERVAL = 0.7;

/**
 * Climb Breaker — the compensation for a biome that is a wall rather than a
 * slope (see `biomeClimb`). Granted on crossing into one, and sized by how big
 * the wall is.
 *
 * Three things at once, because a wall is three things at once: the arches
 * suddenly get shorter and rougher, a new hazard class arrives, and the help
 * (thermals, sunflower pads) thins out. Sun buys time, the ward buys the
 * hazards, and the raised cap keeps the sun from being spent on the crossing
 * that earned it.
 */
export const CLIMB_DAYLIGHT_BONUS = 22;
export const CLIMB_REFILL_MULT = 0.6;

/**
 * The GO countdown before a solo run's clock starts.
 *
 * The day is 52 seconds of real time, and it used to begin on the very first
 * physics step — so a new player watched it tick down while still reading the
 * HUD and the coach line. Versus and networked starts bring their own
 * (a shared countdown, or the room's server clock), so this is solo only.
 */
export const SOLO_START_COUNTDOWN = 3;

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

/**
 * Minimum gap between commercial breaks, and the minimum time a session must
 * have been in play before the first one.
 *
 * Not our invention — these are the shipped core's own ad-timing defaults
 * (`adTiming: { timeBetweenAds: 120000, startAdsAfter: 120000, preroll: false }`).
 * Asking sooner is not "asking more often", it is asking for something the
 * core refuses ("commercialBreak too soon after previous one" / "not possible
 * before gameplayStart"), which resolves empty. Matching the real limits means
 * the run-start request is one the portal can actually serve, instead of a
 * silent no-op that still cost the player a beat at the start of their run.
 */
export const COMMERCIAL_BREAK_MIN_GAP_MS = 120_000;

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

/**
 * Payments were removed with the multi-portal/Stripe tree.
 *
 * These four `STRIPE_*` constants had no consumers anywhere in `src/` — the
 * portal build routes payments through `Payments.portal.ts`, which is a coin
 * economy with no provider at all, because Poki rule REQ-20 forbids in-app
 * purchases outright. They lingered only because nothing failed: an unused
 * export is invisible to the type checker, and `scripts/package-portal.mjs`
 * scrubs the literal "stripe" from the shipped HTML, so the dead code never
 * even reached a bundle. A payment-provider name in a portal build is exactly
 * the marker the zip audit exists to catch, so the constants go.
 */
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
