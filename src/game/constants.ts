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
export let GRAVITY_GLIDE = 16;
export let GRAVITY_DIVE = 96;
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
export let GROUND_G_GLIDE_DOWN = 30;
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
export let GROUND_STICK_DIVE = 11;
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
export let AIR_DRAG_GLIDE = 0.00042;
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
export let FLARE_BRAKE = 300;
export let FLARE_DURATION = 0.42;
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
 * Where a run begins: on the ground, perched on the opening hill like the rest
 * of the flock (MassRace spawns rival birds at `heightAt + BIRD_RADIUS`).
 *
 * History, because this value has now been both directions. `bird.reset()`
 * parks the bird at `heightAt + BIRD_RADIUS` with `grounded = false` — that
 * reads as airborne to the physics while the body sits *on* the surface, so the
 * first step "landed" again 0.3 s into every run and the opening frame showed
 * a bird embedded in the grass. The 14 m drop-in was the 2026-09 fix for that,
 * and it over-corrected: every run opened with a fall the player never chose,
 * the coach's first cue had to explain a landing nobody made, and the run PEAK
 * (which scores the climb goal, `Game.maxAltitude`) was handed 14 m of
 * altitude for free — ~31% of the real first climb goal (45 m scaled per day,
 * Engagement.ts:79) before the first input.
 *
 * The grounded start fixes all three at once: `Game.startRun` places the bird
 * ON the surface and marks it `grounded` *after* `reset()` (so the first
 * physics step reads ground→ground and no phantom landing beat fires), the
 * tutorial's first instruction — hold to build speed down the drop — starts
 * exactly where the bird is, and the climb goal starts at zero, where it
 * belongs. The absorb-first-touchdown guard in `Game.onLanding` stays as a
 * net for a genuinely rough first-run landing mid-flight.
 *
 * The tune stays for QA: a positive value re-adds the drop-in offset for
 * experiments. Default 0 = perched.
 */
export let START_ALTITUDE = 0;
export let START_SPEED = 48;

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
export let LAUNCH_POP_WINDOW = 0.45;
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
export let LAUNCH_POP_MAX = 26;
/**
 * Share of the crest pop paid as FORWARD speed rather than climb, 0..1.
 *
 * WHY THE POP IS RE-AIMED INSTEAD OF MERELY ENLARGED. Raising `LAUNCH_POP_MAX`
 * was measured first and is a weaker lever than it looks: it adds height, and
 * height is not what this game is short of. The measurement is that the skill
 * gap is a SPEED gap — the expert cruises at 40.5 m/s against the masher's
 * 30.7, and 40.5/30.7 = 1.32 versus the 1.29 distance ratio the suite reports.
 * Every metre of pop spent on climb has to be flown back down before it earns
 * anything, and `AIR_DRAG_GLIDE` takes a cut of it on the way.
 *
 * Routing part of the same payout into forward speed spends the release on the
 * axis the leaderboard sorts on. It is the same energy, from the same gesture,
 * at the same moment; only its direction changes.
 *
 * WHY THIS LEVER AND NOT A "GO FASTER WHEN RELEASED" TERM. That term was built
 * and measured first, and it is wrong in a way worth recording: gating it on
 * `!diving` pays a player who never touches the button MORE than the expert,
 * because a non-presser is released on 100% of its steps. It drove
 * `mean(hold) > mean(coast) * 1.3` from 1.370x to 1.221x — a better headline
 * ratio with the button's importance deleted.
 *
 * The pop is immune to that by construction rather than by tuning:
 * `launchPopQuality` is 0 while the stick has never been released. Measured
 * over 6 seeds, `hold` popped on 0 of 20 launches and a never-touching `coast`
 * on 0 of 75, while the expert popped on 98 of 99. So this constant cannot move
 * the hold/coast margin or the masher floor at all — the two invariants that
 * make the headline ratio mean anything.
 *
 * `RELEASE_MAX_RISE` is untouched by this: the airborne release ceiling is a
 * separate constant on a separate code path. The pop has never been subject to
 * it — a pop fires at the instant of leaving the ground, inside the grounded
 * branch, which has no `applyReleaseKick` call.
 */
export let LAUNCH_POP_DRIVE = 0;
/** Launch speed at which the pop reaches full strength. */
export let LAUNCH_POP_SPEED = 70;
/** Rolling resistance while on the ground. */
export let GROUND_FRICTION = 0.05;
export const GROUND_FRICTION_DIVE = 0.018;
/** Speed-borne lift while gliding: cancels up to this fraction of gravity. */
export let GLIDE_LIFT_MAX = 0.55;
export let GLIDE_LIFT_SPEED = 62;
/** Downforce that keeps a diving bird glued through convex crests. */
export let STICK_ACCEL_DIVE = 190;
export const STICK_ACCEL_GLIDE = 13;

export let MAX_SPEED = 108;
export const MAX_SPEED_FEVER = 128;
/**
 * The highest `speedMult` any skin may carry. The anti-cheat ceiling multiplies
 * by this, so it is a ceiling on the *content* as well as on the gate: a skin
 * added above it would be legal to fly and illegal to submit. Pinned by
 * `anticheat.test.ts`, which fails if `SKINS` ever exceeds it.
 */
export const MAX_SKIN_SPEED_MULT = 1.08;
export const BIRD_RADIUS = 0.9;
export let MIN_KEEP_SPEED = 12; // higher floor: bird never stalls on uphill terrain

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

/**
 * KNOWN DEFECT (measured, deliberately NOT fixed here — read before touching
 * the launch gate).
 *
 * `Bird.step`'s grounded branch can fire `justLaunched` for a take-off that
 * never happened. Reproduced from the real start state (airborne, x=64,
 * START_ALTITUDE, START_SPEED), coasting:
 *
 *   seed `a`  t=15.2667 spd=12.0 | t=15.2833 spd=12.0 | t=15.3000 spd=12.3
 *   seed `b`  t=14.9917 spd=21.4 | t=15.0083 spd=21.9 | t=15.0333 spd=21.6
 *
 * The bird is 0.0003 m above the surface for each: it skims, is re-projected
 * onto the tangent, and falls straight back, all inside 33 ms. `Game.onLaunch`
 * runs once per event, so one non-event produced three coach updates and three
 * `slopeChain.launch` calls. The crest pop is speed-scaled and contributes ~0
 * at 12-22 m/s, so no visible hop justifies any of it. The scorer correctly
 * rejects all of them (`LAUNCH_MIN_SPEED` is 26), which bounds the damage: the
 * launch combo survives and no points are awarded.
 *
 * Root cause: `needed = vt^2 * curvature` collapses at low ground speed, so
 * almost any positive curvature satisfies the gate once the bird is being
 * dragged along at MIN_KEEP_SPEED.
 *
 * THREE fixes were implemented, measured, and REVERTED. Recording them so the
 * next attempt does not repeat the work:
 *
 *   1. Speed floor (`vt >= LAUNCH_MIN_SPEED`). Removes the phantoms cleanly,
 *      but 26 and 24 broke `hold > coast x 1.3` outright and 16-22 left a
 *      three-launch burst on seed `b`. The `hold` policy depends on those
 *      low-speed launches, so the gate and the skill ceiling are coupled.
 *   2. Re-arm timer (require N s of continuous ground contact). Did not work:
 *      the bird reliably re-grounds for exactly 0.108 s and fires again, so any
 *      window only paced the scrape.
 *   3. Clearance gate (require the preceding flight to have reached X m). The
 *      signal separates cleanly — latching peak height at touchdown gives 27.8 m
 *      and 10.0 m for genuine launches on seed `a`, 0.000 m for every phantom —
 *      but wiring it suppressed ALL launches and broke the ceiling, because the
 *      latch is written at the end of `step` while the gate reads it at the
 *      start of the next, and the ordering interacts with the ballistic branch's
 *      own `grounded = true` on touchdown.
 *
 * The invariant at stake is `skill-ceiling.test.ts` — a one-button game where
 * holding the button forever is optimal is not a game. That is load-bearing for
 * session length, the leaderboard and the shop. It is not worth trading for a
 * defect whose entire player-visible effect is a few redundant coach updates.
 *
 * The correct fix is to make the grounded branch recognise that a "launch"
 * which leaves the bird within a rounding error of the surface never happened,
 * WITHOUT altering which inputs produce a genuine departure. That means the
 * decision has to move to the ballistic branch — fire `justLaunched` on the
 * first step the bird is actually clear of the surface, rather than optimistically
 * on the way out of the grounded branch.
 */

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
export let ALT_CEILING = 260;
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
export let ISLAND_PERIOD = 1912;
export let DROP_START = 1233;
export const DROP_BLEND_START = 1094;
export const RAMP_START = 1470;
export let GAP_START = 1615;
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

/**
 * The day, in seconds of flight.
 *
 * This is not a free choice: an island is `ISLAND_PERIOD` metres away, and the
 * day has to be long enough to REACH one, or the island refill is unreachable
 * and "each new island refills it" is a promise the player never sees kept.
 * That is exactly what was wrong. At 52 s and 1,912 m, a flight needs ~64 s to
 * cross an island at the ~30 m/s the sim sustains, so instrumented runs died at
 * 1.17-1.74 km — short of the 1.91 km boundary — and the bar only ever went
 * down. The refill logic was correct and simply never ran.
 *
 * It also has to be long enough to CHAIN. Arriving at an island costs `cost`
 * seconds; the refill returns 29% of the cap, so the run can continue only if
 * `(max - cost) + 0.29*max >= cost` — that is `max >= 1.55 * cost`. At 30 m/s
 * that is 99 s, and the margin only holds while the player keeps moving: 120 s
 * still fails a flight that dawdles, splashes, or stalls, which is the fail
 * state this meter exists to create.
 */
export let DAYLIGHT_MAX = 120;
/**
 * What crossing an island gives back, as a share of your current day.
 *
 * This used to be a flat 15 seconds, tuned against a 52-second day — about 29%
 * of the bar. But `daylightMax()` is not 52 for most of a run: the Climb
 * Breaker adds to `climbDaylight` on every island, sun flasks add to
 * `boostDaylight`, and gold/perks raise the base. Measured on a live flight
 * that had picked up boosts, the max had reached ~141 while the island still
 * paid 15 — the refill had shrunk to 10.6% of the bar. Crossing an island
 * looked like nothing happened, while the results card promised "Each new
 * island refills it".
 *
 * Scaling by the cap fixes it at the root: the number the player reads is the
 * share of the meter that moves, and that share is now the same at every
 * upgrade tier. At base stats it is unchanged — 0.29 x 52 = 15.1, which rounds
 * to the 15 this constant used to be, so nothing about an unupgraded run
 * differs.
 */
export const DAYLIGHT_ISLAND_REFILL_FRACTION = 0.29;
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
export let ISLAND_REFILL_CEILING = 120;
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
export let DAYLIGHT_OCEAN_PENALTY = 3;
export let DAYLIGHT_SPLASH_INTERVAL = 0.7;

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
export const FEVER_DURATION = 11;
export const NEST_MULT_PER_LEVEL = 0.12;

export let COIN_VALUE = 1;
export let CLOUD_BONUS = 40;
export let MAGNET_RADIUS = 15;
export const MAGNET_RADIUS_NORMAL = 1.7;

// A calmer default chase distance gives players more route visibility and
// keeps the bird from dominating the frame on the first seconds of a run.
export let CAMERA_BASE_Z = 28;
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
export let BIRD_BASE_SCALE = 1.65;
/**
 * Highest camera distance the altitude pull reaches: the base dolly plus the
 * speed term plus the four altitude tiers summed in CameraRig.update
 * (24 + 14 + 12 + 22 + 34 + 46). It normalises the bird's readability
 * compensation, so retune it if the framing curve moves.
 */
export let CAMERA_REVEAL_MAX = 152;
export let CAMERA_LOOKAHEAD = 0.22;

export const SAVE_KEY_V1 = "sunbird.save.v1";
export const SAVE_KEY = "sunbird.save.v2";
/** Where an unreadable save is parked before a clean boot, so player data is
 *  never destroyed by the corruption-recovery path. */
export const SAVE_KEY_CORRUPT = "sunbird.save.corrupt";

export const DAYLIGHT_MAX_GOLD = 130;
export const CONTINUE_COST = 80;
export const CONTINUE_DAYLIGHT = 22;
/**
 * Seconds the second-wind offer stays open. 10, not 15: the countdown is a
 * decision window and the platform's strongest games keep it tight. A player
 * who wants the revive taps within the first seconds; a player who does not
 * is held in front of a ticking clock at the exact moment they choose between
 * "one more run" and leaving — the first-session audit measured the whole
 * average session at ~95 s, so five seconds of extra forced waiting here is
 * ~5 % of the average player's entire stay. "End the flight" skips it instantly
 * for anyone who reads; this protects everyone else.
 *
 * 2026-10-04: 10 → 14. The card carries three options plus a context reason
 * line, and the standing readability rule (more time to read on-screen text)
 * applies hardest at the exact moment a decision is demanded. The skip path is
 * instant, so the extra seconds cost decided players nothing.
 *
 * 2026-10-04 (merge): 14 → 20 and the daylight grant 16 → 22, taking the
 * concurrent Poki-portal session's values. The readability rule is the
 * standing directive and 20 serves it harder; the floor test
 * (CONTINUE_TIMEOUT >= 14) still holds; the skip path stays instant.
 */
export const CONTINUE_TIMEOUT = 20;
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
/**
 * Placeholder break length (no-portal builds only; the portal serves its own).
 *
 * 4 s was not a break, it was a blink — it ended before a player could read the
 * panel, which made the "unskippable" contract meaningless in testing: nothing
 * that short can be skipped, so nothing about it could be verified by feel. 10 s
 * is a real (small) break: long enough that the unskippable contract and its
 * escape-hatch countdown are actually observable, short enough to respect the
 * session budget above.
 */
export const AD_DURATION = 10;
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

/* ---------------- live tuning surface ----------------
 *
 * Every binding in this block is `let` rather than `const` for one reason: the
 * dev tuning panel writes them, and an ES module binding is *live*. Bird.ts
 * reads GRAVITY_GLIDE inside `step`, Game.ts reads COIN_VALUE when a coin
 * lands, CameraRig reads CAMERA_BASE_Z every frame — all of them see a new value
 * the instant it is assigned, with no re-import and no edit at a single call
 * site. As `const` they would have given the panel sliders that move a number on
 * screen and never move the simulation.
 *
 * These are bindings and not properties of a settings object, which is the only
 * reason the write path has to live here: a module cannot reassign another
 * module's `let`, so `applyLiveTune` below is the single writer in the app.
 */
const liveApply = {
  GRAVITY_GLIDE: (v: number) => { GRAVITY_GLIDE = v; },
  GRAVITY_DIVE: (v: number) => { GRAVITY_DIVE = v; },
  GROUND_G_GLIDE_DOWN: (v: number) => { GROUND_G_GLIDE_DOWN = v; },
  GROUND_STICK_DIVE: (v: number) => { GROUND_STICK_DIVE = v; },
  STICK_ACCEL_DIVE: (v: number) => { STICK_ACCEL_DIVE = v; },
  GLIDE_LIFT_MAX: (v: number) => { GLIDE_LIFT_MAX = v; },
  GLIDE_LIFT_SPEED: (v: number) => { GLIDE_LIFT_SPEED = v; },
  AIR_DRAG_GLIDE: (v: number) => { AIR_DRAG_GLIDE = v; },
  FLARE_BRAKE: (v: number) => { FLARE_BRAKE = v; },
  FLARE_DURATION: (v: number) => { FLARE_DURATION = v; },
  START_SPEED: (v: number) => { START_SPEED = v; },
  START_ALTITUDE: (v: number) => { START_ALTITUDE = v; },
  MAX_SPEED: (v: number) => { MAX_SPEED = v; },
  MIN_KEEP_SPEED: (v: number) => { MIN_KEEP_SPEED = v; },
  GROUND_FRICTION: (v: number) => { GROUND_FRICTION = v; },
  LAUNCH_POP_MAX: (v: number) => { LAUNCH_POP_MAX = v; },
  LAUNCH_POP_DRIVE: (v: number) => { LAUNCH_POP_DRIVE = v; },
  LAUNCH_POP_SPEED: (v: number) => { LAUNCH_POP_SPEED = v; },
  LAUNCH_POP_WINDOW: (v: number) => { LAUNCH_POP_WINDOW = v; },
  ALT_CEILING: (v: number) => { ALT_CEILING = v; },
  COIN_VALUE: (v: number) => { COIN_VALUE = v; },
  CLOUD_BONUS: (v: number) => { CLOUD_BONUS = v; },
  MAGNET_RADIUS: (v: number) => { MAGNET_RADIUS = v; },
  DAYLIGHT_MAX: (v: number) => { DAYLIGHT_MAX = v; },
  ISLAND_REFILL_CEILING: (v: number) => { ISLAND_REFILL_CEILING = v; },
  DAYLIGHT_OCEAN_PENALTY: (v: number) => { DAYLIGHT_OCEAN_PENALTY = v; },
  DAYLIGHT_SPLASH_INTERVAL: (v: number) => { DAYLIGHT_SPLASH_INTERVAL = v; },
  ISLAND_PERIOD: (v: number) => { ISLAND_PERIOD = v; },
  GAP_START: (v: number) => { GAP_START = v; },
  DROP_START: (v: number) => { DROP_START = v; },
  CAMERA_BASE_Z: (v: number) => { CAMERA_BASE_Z = v; },
  CAMERA_LOOKAHEAD: (v: number) => { CAMERA_LOOKAHEAD = v; },
  CAMERA_REVEAL_MAX: (v: number) => { CAMERA_REVEAL_MAX = v; },
  BIRD_BASE_SCALE: (v: number) => { BIRD_BASE_SCALE = v; },
};

/** Names `applyLiveTune` accepts. Derived, so a knob cannot be added to one map
 *  and forgotten in the other. */
export type LiveTunable = keyof typeof liveApply;

/**
 * Compiled default of each tunable, read once while this module initialises —
 * i.e. before any override can reach it, which is what makes it the value a
 * panel reset returns to.
 */
export const LIVE_TUNE_DEFAULTS: Record<LiveTunable, number> = {
  GRAVITY_GLIDE, GRAVITY_DIVE, GROUND_G_GLIDE_DOWN, GROUND_STICK_DIVE,
  STICK_ACCEL_DIVE, GLIDE_LIFT_MAX, GLIDE_LIFT_SPEED, AIR_DRAG_GLIDE,
  FLARE_BRAKE, FLARE_DURATION, START_SPEED, START_ALTITUDE, MAX_SPEED,
  MIN_KEEP_SPEED, GROUND_FRICTION, LAUNCH_POP_MAX, LAUNCH_POP_DRIVE, LAUNCH_POP_SPEED,
  LAUNCH_POP_WINDOW, ALT_CEILING, COIN_VALUE, CLOUD_BONUS, MAGNET_RADIUS,
  DAYLIGHT_MAX, ISLAND_REFILL_CEILING, DAYLIGHT_OCEAN_PENALTY,
  DAYLIGHT_SPLASH_INTERVAL, ISLAND_PERIOD, GAP_START, DROP_START,
  CAMERA_BASE_Z, CAMERA_LOOKAHEAD, CAMERA_REVEAL_MAX, BIRD_BASE_SCALE,
};

/** Write one tunable. The only way anything outside this module can change a
 *  physics constant while the game is running. */
export function applyLiveTune(key: LiveTunable, value: number): void {
  liveApply[key](value);
}
