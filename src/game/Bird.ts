import { applyReleaseKick, dampClimbAtCeiling, glideLiftScale, releaseKick, RELEASE_KICK_COOLDOWN } from "./FlightPhysics";
import { type BirdShape } from "./Sunbird";
import * as THREE from "three";
import {
  AIR_DRAG_DIVE,
  FLARE_BRAKE,
  FLARE_BUFFER,
  FLARE_DURATION,
  FLARE_MAX_RISE,
  AIR_DRAG_GLIDE,
  BIRD_RADIUS,
  BOOST_EXTRA_SPEED,
  CAMERA_BASE_Z,
  CAMERA_REVEAL_MAX,
  BIRD_BASE_SCALE,
  GLIDE_LIFT_MAX,
  GLIDE_LIFT_SPEED,
  GRAVITY_DIVE,
  GRAVITY_GLIDE,
  GROUND_FRICTION,
  GROUND_FRICTION_DIVE,
  GROUND_G_DIVE,
  GROUND_G_GLIDE,
  GROUND_STICK_DIVE,
  GROUND_STICK_GLIDE,
  LAND_BAD_MIN_KEEP,
  LAND_FEATHER_FLOOR,
  LAND_GOOD,
  LAND_GOOD_KEEP,
  LAND_PERFECT,
  LAND_PERFECT_GAIN,
  MAX_SPEED,
  MAX_SPEED_FEVER,
  MIN_KEEP_SPEED,
  OCEAN_FLOOR,
  STICK_ACCEL_DIVE,
  STICK_ACCEL_GLIDE,
  SUNFLOWER_VX,
  SUNFLOWER_VY,
  WATER_Y,
} from "./constants";
import { clamp, lerp, lerpAngle } from "./math";
import type { TerrainSystem } from "./TerrainSystem";

export type BirdStepOpts = {
  diving: boolean;
  fever: boolean;
  speedMult: number;
  boost: boolean;
  /**
   * Transient extra cap headroom in m/s, for mode mechanics (draft slingshot,
   * typhoon tailwind, slalom warp, coin turbo).
   *
   * This exists because those mechanics used to write `bird.vx` directly with a
   * `Math.min(234, …)`-style guard. Every one of those literals was above every
   * reachable cap, so the `Math.min` never did anything, and `step()` re-clamped
   * total speed to `cap` on the very next 8.3 ms substep — the boost was deleted
   * before it was ever visible. A mechanic that pays out a banner and a particle
   * burst for no speed is worse than one that is absent, because the player
   * learns the mode rewards nothing.
   *
   * Raising the cap is the only version that survives: the bird still obeys one
   * speed limit, so this cannot compound across frames the way an injected
   * velocity could.
   */
  speedBonus?: number;
  /** wing boost / golden wings — multiplies speed-borne lift */
  liftMult?: number;
  /** long glide — scales air drag down */
  dragMult?: number;
  /** feather — raises the floor on sloppy landings */
  feather?: boolean;
  /** weekly-event gravity multiplier (Feather Week / Heavy Metal) */
  gravityMult?: number;
};

export type BirdSkinColors = {
  body: number;
  wing: number;
  belly: number;
  beak: number;
};

/**
 * How each species wears the shared mesh hierarchy.
 *
 * The numbers are the species' silhouette in three dimensions: wingspan, how
 * far the tail streams, beak length and girth, body bulk, and whether the
 * crest is worn. They mirror the SVG shape tables in `Sunbird.ts` — a raptor is
 * long-winged and short-tailed in both, a wader is the reverse — so the hangar
 * and the sky are the same animal. `songbird` is 1 everywhere, which is the
 * original build and what an un-shaped bird must stay.
 */
type ShapeProportions = {
  span: number;
  tail: number;
  beak: number;
  beakWidth: number;
  bulk: number;
  crest: boolean;
};

export const BIRD_SHAPE_PROPORTIONS: Readonly<Record<BirdShape, ShapeProportions>> = {
  songbird: { span: 1, tail: 1, beak: 1, beakWidth: 1, bulk: 1, crest: true },
  raptor: { span: 1.34, tail: 1.5, beak: 0.72, beakWidth: 0.8, bulk: 0.92, crest: true },
  owl: { span: 0.84, tail: 0.72, beak: 0.6, beakWidth: 0.72, bulk: 1.16, crest: false },
  wader: { span: 0.8, tail: 0.7, beak: 1.7, beakWidth: 0.5, bulk: 0.82, crest: false },
  ember: { span: 1.12, tail: 1.28, beak: 0.78, beakWidth: 0.86, bulk: 0.98, crest: true },
  comet: { span: 1.05, tail: 1.85, beak: 0.66, beakWidth: 0.78, bulk: 0.88, crest: true },
};

export class Bird {
  private readonly terrainNormal = { nx: 0, ny: 1, tx: 1, ty: 0 };
  x = 50;
  y = 30;
  vx = 10;
  vy = 0;
  grounded = false;
  impact = 0;
  rotation = 0;
  asleep = false;
  inWater = false;
  justLanded = false;
  justLaunched = false;
  /** True the frame a sunflower pad launches the bird — consumed by the Game. */
  bounced = false;
  /** Cooldown so a bounce can't instantly re-trigger on the same bloom. */
  bounceCd = 0;
  wasGrounded = false;
  /** 0..1 — how tangential the last touchdown was (1 = butter). */
  landingQuality = 1;
  /** Speed retained by the last touchdown, as a factor. */
  landingKeep = 1;
  /** Terrain slope and speed at the instant of the last take-off. */
  launchSlope = 0;
  launchSpeed = 0;
  /** Seconds airborne on the current flight, and the apex reached. */
  airTime = 0;
  apexY = 0;
  /** Height above the terrain directly below. */
  altitude = 0;

  readonly root = new THREE.Group();
  private readonly squash = new THREE.Group();
  private readonly wingL = new THREE.Group();
  private readonly wingR = new THREE.Group();
  private readonly lidL: THREE.Mesh;
  private readonly lidR: THREE.Mesh;
  private readonly pupilL: THREE.Mesh;
  private readonly pupilR: THREE.Mesh;
  private readonly beak: THREE.Mesh;
  private readonly tail: THREE.Mesh;
  private readonly glow: THREE.PointLight;
  private readonly shadow: THREE.Mesh;
  private readonly bodyMat: THREE.MeshLambertMaterial;
  private readonly wingMat: THREE.MeshLambertMaterial;
  private readonly crests: THREE.Mesh[] = [];
  /** The two tail feathers flanking the fan, scaled with it — see `setShape`. */
  private readonly tailFeathers: THREE.Mesh[] = [];
  /**
   * Rearmost x of the tail assembly in `squash` local space, split by which
   * part moves with the species scale. Measured from the geometry in the
   * constructor; `tailPoint` combines them. Hand-deriving this is how the wake
   * ended up anchored mid-body.
   */
  private readonly tailFanRear: number;
  /** The fan's own origin x — what a species tail scale stretches away from. */
  private readonly tailPivRear: number;
  /** Rearmost x of the two flanking feathers, which never change length. */
  private readonly tailFeatherRear: number;
  /** The species currently worn — see `setShape`. */
  private shape: BirdShape = "songbird";
  /**
   * Species beak scale, held separately because `syncVisual` rewrites
   * `beak.scale` every frame to animate the call opening. Songbird values, so
   * a bird that never calls `setShape` renders exactly as before.
   */
  private readonly beakMult = new THREE.Vector3(1, 1, 1);
  /** Species body bulk, held for the same reason as `beakMult`. */
  private bulk = 1;
  private readonly bellyMat: THREE.MeshLambertMaterial;
  private readonly lidMat: THREE.MeshLambertMaterial;
  private readonly beakMat: THREE.MeshLambertMaterial;

  private flapT = 0;
  private squashAmt = 1;
  private stretchAmt = 1;
  private wingTuck = 0;
  /** Smoothed dive pitch offset in radians (0 when not diving). See step(). */
  private divePitch = 0;
  /** m/s of upward impulse applied by the most recent flare, 0 if none this
   *  step. Public so a sound or a particle can react to the pull-out. */
  flareAmount = 0;
  /**
   * m/s of upward impulse bought by the RELEASE itself this step, 0 if none.
   *
   * Deliberately separate from `flareAmount`. `flareAmount` is the sustained
   * brake, measured in m/s^2 and bounded by FLARE_BRAKE; this is the one-shot
   * kick, measured in m/s. They fire in disjoint situations — the brake on a
   * dive worth arresting, the kick from a drift or a launch — so a single
   * number cannot honestly describe both, and the audio/haptic cue scales off
   * whichever actually engaged.
   */
  releaseKickAmount = 0;
  /** Seconds left before another release can buy a kick. See
   *  `RELEASE_KICK_COOLDOWN` — without it the kick is farmable. */
  private kickCooldown = 0;
  /** Whether the previous physics step was a dive. The flare fires on the
   *  falling edge, so a held dive does not re-apply it every step. */
  private wasDiving = false;
  /** Seconds of pull-out brake remaining. See the flare in step(). */
  private flareTimer = 0;
  /** Seconds during which a release is still "live" and can spend the flare. */
  private releaseBuffer = 0;
  /**
   * Render interpolation: the state as of the PREVIOUS physics step.
   *
   * `step()` is fixed at 120 Hz and `syncVisual` runs at display rate, so
   * reading `vx`/`vy`/`rotation` straight into the mesh drew a 120 Hz
   * staircase — the wing roll, the pupils, the beak and the tail flutter all
   * stepped with the physics rather than with the screen. On a 144 Hz display
   * that is a visible tick on every visual channel at once, which is what
   * "the bird's movement is jaggery" is.
   *
   * Recorded here, inside `step`, rather than once per frame: `step` may run
   * any number of times in a frame, so this is always exactly one `PHYS_DT`
   * behind, which is the interval the render alpha is expressed in.
   */
  private prevVx = 0;
  private prevVy = 0;
  private prevRotation = 0;
  /** X one physics step ago. `Game` keeps the mirror of this for the mesh
   *  position; both must be sampled inside `step` for the same reason. */
  private prevX = 0;
  /** The velocity and position actually used for the last draw, exposed so the
   *  interpolation can be asserted directly — see flight-smoothness.test.ts. */
  private drawnVx = 0;
  private drawnVy = 0;
  /** The heading the mesh was last DRAWN at, so the wake stays attached to the
   *  sprite the player can see rather than to the raw physics angle. */
  private drawRotation = 0;
  /**
   * This frame's camera distance, pushed in by the game after the camera
   * settles. Drives the readability compensation in syncVisual so the bird
   * stays legible when the camera dollies back at altitude.
   */
  private viewDistance = CAMERA_BASE_Z;
  private blink = 0;
  private glowPulse = 0;
  /**
   * Floating-origin recenter point (see TerrainSystem.recenter()). Physics
   * state (this.x/this.y) always stays true world x; only the rendered
   * mesh position below shifts, so terrain sampling and gameplay math are
   * unaffected.
   */
  private originX = 0;

  constructor() {
    this.bodyMat = new THREE.MeshLambertMaterial({ color: 0xff7a45, emissiveIntensity: 0 });
    this.wingMat = new THREE.MeshLambertMaterial({ color: 0xff9a62 });
    this.bellyMat = new THREE.MeshLambertMaterial({ color: 0xffe6c4 });
    this.beakMat = new THREE.MeshLambertMaterial({ color: 0xffc447 });
    // Keep the whites lit by the scene instead of self-illuminating. MeshBasic
    // made the eyes read as two glare spots against the dusk sky.
    const eyeW = new THREE.MeshLambertMaterial({ color: 0xfff4df, emissiveIntensity: 0 });
    const eyeP = new THREE.MeshBasicMaterial({ color: 0x2a1c28 });
    this.lidMat = new THREE.MeshLambertMaterial({ color: 0xff7a45, emissiveIntensity: 0 });

    this.squash.add(this.makeBody());

    this.lidL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), this.lidMat);
    this.lidR = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), this.lidMat);
    this.lidL.position.set(0.42, 0.42, 0.38);
    this.lidR.position.set(0.42, 0.42, -0.38);
    this.lidL.scale.set(1, 0.08, 1);
    this.lidR.scale.set(1, 0.08, 1);
    this.squash.add(this.lidL, this.lidR);

    const eyeWhiteL = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), eyeW);
    const eyeWhiteR = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), eyeW);
    eyeWhiteL.position.set(0.42, 0.38, 0.38);
    eyeWhiteR.position.set(0.42, 0.38, -0.38);
    this.pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), eyeP);
    this.pupilR = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), eyeP);
    this.pupilL.position.set(0.12, 0.02, 0.04);
    this.pupilR.position.set(0.12, 0.02, -0.04);
    eyeWhiteL.add(this.pupilL);
    eyeWhiteR.add(this.pupilR);
    this.squash.add(eyeWhiteL, eyeWhiteR);

    this.beak = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 6), this.beakMat);
    this.beak.rotation.z = -Math.PI / 2;
    this.beak.position.set(0.78, 0.18, 0);
    this.squash.add(this.beak);

    this.buildWing(this.wingL, 1);
    this.buildWing(this.wingR, -1);
    this.squash.add(this.wingL, this.wingR);

    // Crest: three little head feathers give the silhouette real character.
    // Held on `this.crests` so `setShape` can take them off a species that does
    // not wear one — an owl with a sunbird crest is not an owl.
    for (let i = 0; i < 3; i++) {
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.09 - i * 0.015, 0.42 - i * 0.06, 5), this.wingMat);
      crest.position.set(0.18 - i * 0.17, 0.62 + i * 0.03, 0);
      crest.rotation.z = 0.55 + i * 0.35;
      this.squash.add(crest);
      this.crests.push(crest);
    }

    // Fanned three-feather tail reads far better in 3/4 view than one cone.
    this.tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.62, 5), this.wingMat);
    this.tail.rotation.z = Math.PI / 2.4;
    this.tail.position.set(-0.7, 0.05, 0);
    this.squash.add(this.tail);
    for (const side of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 5), this.wingMat);
      f.rotation.z = Math.PI / 2.55;
      f.rotation.y = 0.35 * side;
      f.position.set(-0.64, 0.02, 0.16 * side);
      this.squash.add(f);
      this.tailFeathers.push(f);
    }
    // Measured, not derived by hand. The tail is a fan plus two feathers at
    // different angles and offsets, and this is the number the wake is
    // anchored on, so it is read off the real geometry rather than worked out
    // on paper. Measured in `squash` local space — geometry bounds pushed
    // through each mesh's own local matrix — so it does not depend on where
    // the root happens to be scaled at construction time.
    //
    // The fan and the feathers are kept apart because only the fan is
    // species-scaled, and a mesh scale is applied about that mesh's OWN origin
    // rather than the bird's: scaling the feathers by `p.tail` would have left
    // them floating away from the fan they are supposed to flank. The fan's
    // rear therefore moves about the fan's pivot, which `tailPivRear` records.
    const rearOf = (m: THREE.Mesh): number => {
      m.geometry.computeBoundingBox();
      // `Object3D.matrix` is only recomposed on demand — read it before
      // asking, or every mesh measures as unrotated and untranslated.
      m.updateMatrix();
      return m.geometry.boundingBox!.clone().applyMatrix4(m.matrix).min.x;
    };
    this.tailFanRear = rearOf(this.tail);
    this.tailPivRear = this.tail.position.x;
    this.tailFeatherRear = Math.min(...this.tailFeathers.map(rearOf));

    this.glow = new THREE.PointLight(0xffe08a, 0, 18, 2);
    this.glow.position.set(0, 0.4, 1);
    this.root.add(this.glow);
    this.root.scale.setScalar(BIRD_BASE_SCALE);

    const shadowGeo = Bird.makeShadowGeometry();
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x1a1020,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;

    this.squash.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    this.root.add(this.squash);
    // The bird is the primary gameplay affordance. Render it above foreground
    // props so narrow screens never lose the player silhouette to terrain
    // depth sorting or translucent haze.
    // Final focal layer: wake and celebration FX always remain behind the
    // readable bird silhouette, eyes, and beak.
    this.root.renderOrder = 100;
    this.squash.traverse((o) => {
      if (o instanceof THREE.Mesh) o.renderOrder = 100;
    });
    this.shadow.renderOrder = 10;
  }

  /**
   * Top-down gull silhouette (x = flight direction, y = wingspan) drawn as a
   * flat shape: swept wings, fanned tail with a notch. Replaces the old blob
   * disc so the ground shadow reads as the actual bird. Kept the same overall
   * extent (~2.6 wingspan) so the altitude fade logic below is untouched.
   */
  private static makeShadowGeometry(): THREE.BufferGeometry {
    const s = new THREE.Shape();
    s.moveTo(1.0, 0); // beak
    s.quadraticCurveTo(0.55, 0.55, 0.05, 1.3); // right leading edge → wingtip
    s.lineTo(-0.28, 1.26); // wingtip trailing corner
    s.quadraticCurveTo(-0.45, 0.6, -0.6, 0.18); // right trailing edge
    s.lineTo(-0.95, 0.12); // tail fan, right
    s.lineTo(-0.8, 0); // tail notch
    s.lineTo(-0.95, -0.12); // tail fan, left
    s.lineTo(-0.6, -0.18);
    s.quadraticCurveTo(-0.45, -0.6, -0.28, -1.26);
    s.lineTo(0.05, -1.3);
    s.quadraticCurveTo(0.55, -0.55, 1.0, 0);
    return new THREE.ShapeGeometry(s);
  }

  addTo(scene: THREE.Scene): void {
    scene.add(this.root);
    scene.add(this.shadow);
  }

  /** The camera's settled distance for this frame (see syncVisual). */
  setViewDistance(distance: number): void {
    this.viewDistance = distance;
  }

  /** Floating-origin recenter — see TerrainSystem.recenter(). */
  setRenderOrigin(x: number): void {
    this.originX = x;
  }

  reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = 11;
    this.vy = 0;
    this.grounded = false;
    this.impact = 0;
    this.altitude = 0;
    this.airTime = 0;
    this.apexY = y;
    this.launchSpeed = 0;
    this.launchSlope = 0;
    this.asleep = false;
    this.inWater = false;
    this.justLanded = false;
    this.justLaunched = false;
    this.bounced = false;
    this.bounceCd = 0;
    this.wasGrounded = false;
    this.rotation = 0;
    this.prevRotation = 0;
    this.drawRotation = 0;
    this.prevX = this.x;
    this.drawnVx = this.vx;
    this.drawnVy = this.vy;
    this.kickCooldown = 0;
    this.flareAmount = 0;
    this.releaseKickAmount = 0;
    this.squashAmt = 1;
    this.stretchAmt = 1;
    this.wingTuck = 0;
    this.divePitch = 0;
    this.flapT = 0;
    this.root.rotation.set(0, 0, 0);
    this.lidL.scale.y = 0.08;
    this.lidR.scale.y = 0.08;
    // The species is the loadout's business, applied by Game.applySkin — but a
    // reset must not leave the previous bird's proportions on this one, so the
    // proportions themselves are cleared and the shape re-applied.
    this.wingL.scale.set(1, 1, 1);
    this.wingR.scale.set(1, 1, 1);
    this.tail.scale.set(1, 1, 1);
    this.beak.scale.set(1, 1, 1);
    this.squash.scale.set(1, 1, 1);
    this.beakMult.set(1, 1, 1);
    this.bulk = 1;
    for (const crest of this.crests) crest.visible = true;
    this.shape = "songbird";
  }

  speed(): number {
    return Math.hypot(this.vx, this.vy);
  }

  /**
   * World position of the tail tip — where a wake should be anchored.
   *
   * `x`/`y` are the BODY CENTROID (the body sphere's centre), which is the
   * right anchor for physics and the wrong one for a trail. The tail tip sits
   * 1.65 world units behind the centroid at base scale and up to 4.0 for the
   * comet, so a ribbon anchored at the centroid starts inside the bird and
   * paints over its body — the "trail is half way through the bird" report.
   *
   * The tail is scaled about its own pivot at x=-0.7, not about the bird, so
   * the offset has to be interpolated between the pivot and the tip using the
   * tail's own scale, then run through the same squash and readability scale
   * the mesh is drawn with. Skipping either is how a species-specific trail
   * would drift off its own bird.
   *
   * The whole point is that the anchor moves with the visual, so this must be
   * read AFTER `syncVisual`, and called with the same interpolated x/y the
   * mesh was drawn at — see `Game.updateTrailRibbon`.
   */
  /**
   * The velocity the mesh was last DRAWN at, i.e. the interpolated value rather
   * than the raw physics one. Read-only, and exposed so the render
   * interpolation can be asserted directly instead of inferred from a picture —
   * see `flight-smoothness.test.ts`.
   */
  get interpolatedVyForTest(): number {
    return this.drawnVy;
  }

  /** The same, horizontally. */
  get interpolatedVxForTest(): number {
    return this.drawnVx;
  }

  /** `vy` as of the previous physics step — the other end of the blend. */
  get prevVyForTest(): number {
    return this.prevVy;
  }

  /** `x` as of the previous physics step. */
  get prevXForTest(): number {
    return this.prevX;
  }

  /**
   * Force the render-interpolation pair, for testing the draw at a heading the
   * simulation has not happened to produce. Exposed rather than poked at
   * through a cast, because the +/-pi seam is unreachable by driving the bird
   * there honestly — it depends on the terrain facing at the right x.
   */
  setHeadingPairForTest(prev: number, cur: number): void {
    this.prevRotation = prev;
    this.rotation = cur;
  }

  tailPoint(x: number, y: number): { x: number; y: number } {
    // The fan's species scale stretches it about the fan's own origin, so its
    // rear is interpolated between the pivot and the measured tip; the feathers
    // are fixed. Whichever reaches further back is the real rear of the bird.
    const fan = this.tailPivRear + (this.tailFanRear - this.tailPivRear) * this.tail.scale.x;
    const rear = Math.min(fan, this.tailFeatherRear);
    // Then everything above `squash` scales about the bird's origin, so the
    // measured extent just multiplies through — body bulk, speed stretch and
    // the readability scale included, because the wake has to stay attached to
    // the bird the player can actually see.
    const back = rear * this.squash.scale.x * this.root.scale.x;
    // The angle the MESH was drawn at, not the raw physics heading. The caller
    // already passes the interpolated x/y (see `Game.updateTrailRibbon`); using
    // the un-interpolated angle here instead would leave the wake attached to a
    // heading the sprite is no longer at, which is the same detachment the
    // interpolated position argument exists to prevent. `drawRotation` equals
    // `rotation` whenever the render is not interpolating, so this is exactly
    // the old behaviour on any caller that passes no alpha.
    const c = Math.cos(this.drawRotation);
    const s = Math.sin(this.drawRotation);
    return { x: x + back * c, y: y + back * s };
  }

  applySkin(skin: BirdSkinColors): void {
    this.bodyMat.color.setHex(skin.body);
    this.bodyMat.emissive.set(0, 0, 0);
    this.wingMat.color.setHex(skin.wing);
    this.bellyMat.color.setHex(skin.belly);
    this.lidMat.color.setHex(skin.body);
    this.lidMat.emissive.set(0, 0, 0);
    this.beakMat.color.setHex(skin.beak);
  }

  /**
   * Dress the bird as its species.
   *
   * The shop draws a raptor with a hooked beak and a long tail; if the bird you
   * then fly is the same oval in the same colours, the preview is selling
   * something the game does not deliver. So the species adjusts the actual
   * proportions of the existing mesh hierarchy — wingspan, tail length, beak,
   * body bulk, and whether the crest is worn at all.
   *
   * Scaling rather than rebuilding: the geometry is shared across every bird
   * (one Bird is allocated per run, see Game), so a species change has to be
   * free of allocation on the render path. Restores the songbird's numbers
   * exactly, which is what `reset` expects when a new run starts.
   */
  setShape(shape: BirdShape): void {
    if (shape === this.shape) return;
    this.shape = shape;
    const p = BIRD_SHAPE_PROPORTIONS[shape];
    this.wingL.scale.set(p.span, 1, p.span);
    this.wingR.scale.set(p.span, 1, p.span);
    this.tail.scale.set(p.tail, p.tail, 1);
    // Beak and bulk are ALSO written every frame by `syncVisual` (beak opens
    // with the call, the body stretches with speed), so the species factor has
    // to be kept here and multiplied in at that point. Setting the scale here
    // and letting `syncVisual` overwrite it next frame is what silently
    // discarded the wader's 1.7x beak and the owl's 1.16 bulk — the shop drew
    // them, the run did not have them.
    this.beakMult.set(p.beakWidth, p.beak, p.beakWidth);
    this.bulk = p.bulk;
    this.beak.scale.copy(this.beakMult);
    this.squash.scale.set(p.bulk, p.bulk, 1);
    // An owl is a round bird with no crest to speak of; a phoenix is not.
    for (const child of this.crests) child.visible = p.crest;
  }

  /**
   * Momentum flight model.
   *
   * Grounded: the bird carves along the surface. Gravity resolved along the
   * tangent accelerates it downhill and bleeds speed uphill — that exchange
   * *is* the game. It leaves the ground only when the surface curves away
   * faster than the available downforce can hold it (a real ballistic launch
   * off a crest), which is why holding sticks you down and releasing flies.
   *
   * Airborne: pure ballistics plus quadratic drag, with speed-borne lift while
   * gliding. Nothing ever pushes the bird upward on its own.
   */
  step(dt: number, opts: BirdStepOpts, terrain: TerrainSystem): void {
    this.justLanded = false;
    this.justLaunched = false;
    this.impact = 0;
    this.flareAmount = 0;
    this.releaseKickAmount = 0;
    this.kickCooldown = Math.max(0, this.kickCooldown - dt);

    // One PHYS_DT of render history, recorded per STEP so it is exactly one
    // step behind however many steps this frame runs. See `prevVx`.
    this.prevVx = this.vx;
    this.prevVy = this.vy;
    this.prevRotation = this.rotation;
    this.prevX = this.x;

    // Record the release ONCE, here, before the grounded/ballistic branch —
    // so it is latched whether the bird is flying or still on the ground.
    //
    // The flare used to require `wasDiving && !diving && vy < 0` on one
    // frame, which failed in two ways players actually hit. Releasing while
    // the bird sat on the ground changed nothing at all, because that whole
    // check lived inside the ballistic branch. And releasing on the one frame
    // where vy happened to be >= 0 — the bottom of an arc — missed the edge
    // entirely and could never fire, because `wasDiving` had already been
    // consumed. That is "sometimes the release does nothing", and no amount of
    // tuning the brake fixes it, because the brake was never given the chance
    // to run.
    const was = this.grounded;
    this.wasGrounded = was;

    // Per-world flight feel. The terrain already knows which biome the bird is
    // over, so the world's character comes from the same source as its hills —
    // no new plumbing, and it can never disagree with the ground being drawn.
    const biome = terrain.biomeAt(this.x);

    const diving = opts.diving && !this.asleep;

    // Latch the release here — after `diving` resolves, and crucially BEFORE
    // the grounded/ballistic branch below, so a release while the bird is still
    // on the ground is recorded rather than discarded.
    if (this.wasDiving && !diving) this.releaseBuffer = FLARE_BUFFER;
    this.wasDiving = diving;
    this.releaseBuffer = Math.max(0, this.releaseBuffer - dt);
    const gMult = opts.gravityMult ?? 1;
    const cap =
          (opts.fever ? MAX_SPEED_FEVER : MAX_SPEED) * opts.speedMult +
          (opts.boost ? BOOST_EXTRA_SPEED : 0) +
          (opts.speedBonus ?? 0);

    if (was) {
      /* ---------- carving the surface ---------- */
      const n = terrain.normalAt(this.x, this.terrainNormal);
      let vt = this.vx * n.tx + this.vy * n.ty;

      // Gravity along the slope: downhill (ty<0) accelerates, uphill decelerates.
      const gGround = diving ? GROUND_G_DIVE : GROUND_G_GLIDE;
      // ...but downhill-only, with a floor in BOTH states, so that flat ground is
      // not a place where the input does nothing. Uphill keeps the full slope
      // penalty in both states — the climb is still the thing the run is about.
      //
      // The glide floor is new, and it is what makes the run loop at all. Holding
      // has had a floor since GROUND_STICK_DIVE; releasing had none, so a gliding
      // bird on the ground had `accel = 14 * slope` fighting `0.05 * v` and settled
      // onto the MIN_KEEP_SPEED conveyor (12 m/s) the moment it hit flat or uphill
      // ground. That was terminal, not a slow patch: the launch gate needs
      // `v^2 * curvature > gravity + STICK_ACCEL_GLIDE`, so at 12 m/s the terrain
      // would have to curve away at 0.20/m to let go — which 0.7% of sampled
      // positions on a real island do. Measured over a full passive minute the bird
      // spent 68% of the run grounded and hit exactly 12.0 m/s four separate times,
      // and the climb goal never left 0.
      //
      // The floor is deliberately ~2.5x weaker than the diver's. Holding must stay
      // the stronger gesture — it is 11 against this, with `GROUND_G_GLIDE` (14)
      // supplying far less than `GROUND_G_DIVE` (88) on the same slope — so the
      // choice stays a trade: dive for speed and stay glued, release for lift.
      const downhill = -n.ty;
      const accel = Math.max(gGround * downhill, diving ? GROUND_STICK_DIVE : GROUND_STICK_GLIDE);
      vt += accel * dt;

      const fr = diving ? GROUND_FRICTION_DIVE : GROUND_FRICTION;
      vt *= 1 - fr * dt;

      // Recovery floor, not a weak spring: the old blend could go negative
      // on an uphill and trap a new player forever in the tutorial valley.
      vt = Math.max(MIN_KEEP_SPEED, vt);
      if (vt > cap) vt = cap;

      this.vx = vt * n.tx;
      this.vy = vt * n.ty;
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // Follow the surface, then test whether it curves away from under us.
      const surf = terrain.heightAt(this.x) + BIRD_RADIUS;
      this.y = surf;
      const n2 = terrain.normalAt(this.x, this.terrainNormal);
      const curv = terrain.curvatureAt(this.x); // >0 convex (crest), <0 concave (valley)
      let launched = false;
      // curvatureAt() is a narrow local probe (e = 1.1) — high-frequency
      // terrain noise alone can spike it positive with no real lip underfoot.
      // Gate on the same crest-prominence rule the AI's distanceToCrest()
      // cache uses, so a launch only fires off a genuine climb-then-drop.
      if (curv > 0 && terrain.hasCrestProminence(this.x)) {
        const needed = vt * vt * curv; // centripetal pull required to stay glued
        const available = (diving ? GRAVITY_DIVE : GRAVITY_GLIDE) * gMult * n2.ny + (diving ? STICK_ACCEL_DIVE : STICK_ACCEL_GLIDE);
        if (needed > available) launched = true;
      }
      if (launched) {
        this.grounded = false;
        this.justLaunched = true;
        this.launchSlope = terrain.slopeAt(this.x);
        this.launchSpeed = Math.abs(vt);
        this.airTime = 0;
        this.apexY = this.y;
        this.vx = vt * n2.tx;
        this.vy = vt * n2.ty;
      } else {
        this.grounded = true;
        this.vx = vt * n2.tx;
        this.vy = vt * n2.ty;
      }
    } else {
      /* ---------- ballistic flight ---------- */
      const sp = Math.max(0.001, this.speed());

      // The flare: what releasing the button actually does.
      //
      // Before this, release did nothing measurable. Lift only ever *reduces*
      // downward gravity, so a 95 m/s dive kept accelerating into the ground
      // after you let go — a one-way door, and the reason the pull-out felt
      // like a jolt rather than a recovery. This adds a one-shot upward impulse
      // on the falling edge, scaled by how fast you were genuinely falling.
      //
      // Three properties keep it a flare and not a jet:
      //  - it only fires on the DIVE -> GLIDE transition, so holding still
      //    produces one impulse rather than one per step;
      //  - it decays linearly to nothing over FLARE_DURATION, so the pull-out
      //    has an end and a player cannot chain releases into a sustained climb;
      //  - FLARE_MAX_RISE clamps it, so it can arrest a dive and can never
      //    convert one into a launch.
      //
      // (This list previously claimed the flare was "scaled by dive speed" and
      // that a `vy < 0` guard meant "releasing while already climbing adds
      // nothing". Neither matched the code: the strength was never speed-scaled,
      // and the `vy < 0` guard is what silently dropped most releases. Corrected
      // here so the comment describes the flare that actually runs.)
      //
      // The fall is captured BEFORE any gravity runs, because by the time this
      // is reached the bird has already been accelerated downward this step.
      // A release inside the buffer window, waiting for a moment it can be
      // spent. See `noteRelease` for why this is a latch and not an edge.
      // Armed by the latch, not by a condition on this frame's motion.
      //
      // This used to require `this.vy < 0`, so the flare only fired when the
      // bird happened to still be falling inside the 180ms buffer. Every other
      // release silently expired the buffer and did *nothing*: releasing at the
      // top of a dive, or while climbing, or the instant after the pull-out —
      // i.e. precisely the moment FirstFlight coaches with "RELEASE at the top
      // to launch". The instruction and the physics disagreed, so the game
      // taught the one input timing that was guaranteed to be dropped.
      //
      // Arming on the transition alone is safe, and the safety properties are
      // unchanged:
      //  - still one-shot, because the latch (`wasDiving && !diving`) fires once
      //    per press and the buffer is cleared here;
      //  - still a brake, not a jet, because `flareTimer` decays linearly to
      //    zero over FLARE_DURATION, so releases cannot be chained;
      //  - still bounded, because FLARE_MAX_RISE clamps the result, so a
      //    release made while level gives the same capped pull-out a release
      //    out of a committed dive does — never more.
      //
      // THE RELEASE IMPULSE, and the bug it fixes.
      //
      // Arming the brake was never the whole release. The brake is a *brake*:
      // it arrests a fall, and by design it is spent without effect whenever
      // there is no fall to arrest (`vy >= FLARE_MAX_RISE` below). So every
      // release made from level or climbing flight produced EXACTLY NOTHING.
      //
      // Releasing at the crest of a ramp is precisely such a release — it is a
      // release from climbing flight. Measured over 57 real ramp launches, 95%
      // leave the bird at `vy >= 0`, so "release at the end of a ramp" landed
      // in the dead branch almost every time and the bird did not jump. That is
      // the whole "the release doesn't work on the last ramp" report: not a weak
      // impulse, a literally absent one.
      //
      // So the release is now two things, chosen by what the bird is doing:
      //  - a real dive (below FLARE_MAX_RISE) is still the brake's job, and the
      //    brake is untouched;
      //  - anything from a drift up to a launch gets `applyReleaseKick`, a
      //    bounded upward impulse. See FlightPhysics for the numbers, the
      //    cooldown that stops it being chained, and why the ceiling is applied
      //    as a `Math.min` that can only RAISE vy — the previous clamp could
      //    slam a +30 climb to -14 in one frame, and that must not come back.
      if (this.releaseBuffer > 0 && !diving) {
        this.releaseBuffer = 0;
        this.flareTimer = FLARE_DURATION;
        this.releaseKickAmount = releaseKick(this.vy, this.kickCooldown);
        this.vy = applyReleaseKick(this.vy, this.kickCooldown);
        this.kickCooldown = RELEASE_KICK_COOLDOWN;
      }

      // The pull-out: a DECAYING BRAKE, not an impulse.
      //
      // An impulse was measurably not enough. A 26 m/s one-frame nudge took a
      // 95 m/s dive to 69 and then gravity took it straight back — -70 at 42ms,
      // -73 at 492ms, never approaching zero. The player released and kept
      // diving, which is exactly the complaint: the pull-out does not catch.
      //
      // What a flare actually is, aerodynamically, is a sustained brake. So it
      // is one now: strongest the frame the button comes up, falling linearly
      // to nothing over FLARE_DURATION. The decay is the point — it means the
      // pull-out has an end, so it is a recovery rather than a free lift, and a
      // player cannot chain releases into sustained climb.
      //
      // Clamped to FLARE_MAX_RISE so it can arrest a dive and never convert one
      // into a launch. Divided by dt-free scaling: the acceleration is
      // BRAKE * (remaining/duration), applied over dt.
      this.flareAmount = 0;
      if (this.flareTimer > 0) {
        // The brake only ever ARRESTS A FALL. A bird that is already climbing
        // has nothing to arrest, and the clamp below would have slammed a +30
        // climb to -14 in a single frame — a 44 m/s discontinuity, invisible
        // in the code and very obvious in the hand. That is reachable: dive,
        // launch off a lip, and let go at the top of the arc, which is exactly
        // the timing the coach line teaches.
        if (this.vy >= 0) {
          this.flareTimer = 0;
        } else {
          const strength = FLARE_BRAKE * (this.flareTimer / FLARE_DURATION);
          this.vy += strength * dt;
          this.flareTimer = Math.max(0, this.flareTimer - dt);
          if (this.vy > FLARE_MAX_RISE) {
            this.vy = FLARE_MAX_RISE;
            this.flareTimer = 0;
          }
          this.flareAmount = strength;
        }
      }
      const lift = diving
        ? 0
        // `biome.liftMult` is what makes one island feel different to fly over
        // another. Without it every world glided identically no matter what the
        // hills and sky were doing, which is why the fork's islands read as
        // reskins of each other: the terrain changed and the FLIGHT did not.
        : Math.min(0.85, GLIDE_LIFT_MAX * clamp(sp / GLIDE_LIFT_SPEED, 0, 1) * (opts.liftMult ?? 1) * biome.liftMult) * glideLiftScale(this.airTime);
      this.vy -= (diving ? GRAVITY_DIVE : GRAVITY_GLIDE) * gMult * (1 - lift) * dt;

      const k = (diving ? AIR_DRAG_DIVE : AIR_DRAG_GLIDE) * (opts.dragMult ?? 1);
      const decay = Math.max(0, 1 - k * sp * dt);
      this.vx *= decay;
      this.vy *= decay;

      const s2 = this.speed();
      if (s2 > cap) {
        this.vx *= cap / s2;
        this.vy *= cap / s2;
      }

      // The one place altitude is bounded. Every lift source (thermals, the
      // Zenith ascent super-lift, sunflowers) writes vertical speed directly, so
      // clamping the climb here — rather than at each of those sites — is what
      // keeps the bird inside the world the camera is framed for. See
      // ALT_CEILING.
      this.vy = dampClimbAtCeiling(this.vy, this.y - terrain.heightAt(this.x) - BIRD_RADIUS);

      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.airTime += dt;
      if (this.y > this.apexY) this.apexY = this.y;

      /* ---------- touchdown ---------- */
      const surf = terrain.heightAt(this.x) + BIRD_RADIUS;
      if (this.y <= surf) {
        const n = terrain.normalAt(this.x, this.terrainNormal);
        const vn = this.vx * n.nx + this.vy * n.ny;
        let vt = this.vx * n.tx + this.vy * n.ty;
        const sp3 = Math.max(0.001, this.speed());

        // 1 = kissed the slope perfectly tangentially, 0 = slammed straight in
        const align = clamp(1 - Math.abs(vn) / sp3, 0, 1);
        this.landingQuality = align;
        // Tucking absorbs the impact — holding through a landing is how you
        // keep momentum, which is exactly the technique we want to teach.
        let floor = opts.feather ? LAND_FEATHER_FLOOR : LAND_BAD_MIN_KEEP;
        if (diving) floor = Math.max(floor, 0.86);
        let keep: number;
        if (align >= LAND_PERFECT) keep = LAND_PERFECT_GAIN;
        else if (align >= LAND_GOOD) keep = LAND_GOOD_KEEP;
        else keep = lerp(floor, LAND_GOOD_KEEP, clamp(align / LAND_GOOD, 0, 1));
        this.landingKeep = keep;

        this.impact = Math.max(0, -vn);
        vt = vt * keep;
        if (vt < MIN_KEEP_SPEED) vt = MIN_KEEP_SPEED;

        this.y = surf;
        this.grounded = true;
        this.justLanded = true;
        this.airTime = 0;
        this.vx = vt * n.tx;
        this.vy = vt * n.ty;
      }
    }

    const ocean = terrain.isOcean(this.x);
    this.inWater = ocean && this.y < WATER_Y + 0.6;
    if (this.inWater) {
      if (this.y < OCEAN_FLOOR + 2) this.y = OCEAN_FLOOR + 2;
      this.vy *= 0.55;
      this.vy += 38 * dt;
      this.vx *= 0.9;
      // Same floor as everywhere else the bird's forward speed is clamped
      // (see MIN_KEEP_SPEED above) — a lower 7 here let water uniquely stall
      // the bird below the speed the rest of the game guarantees.
      this.vx = Math.max(this.vx, MIN_KEEP_SPEED);
      if (this.y > WATER_Y - 0.2 && this.vy > 0) {
        this.vy *= 0.4;
      }
    }

    // Sunflower bounce: land on a bloom (or roll onto one) and spring back up.
    this.bounceCd = Math.max(0, this.bounceCd - dt);
    // Require wasGrounded so a touchdown that lands exactly on a pad still
    // gets one full step where `grounded` reads true — otherwise the bounce
    // below flips grounded back to false within the very step that just set
    // it, and anything watching for a landing (e.g. pilot.ts's predictLanding,
    // which keys off `grounded` rather than the one-frame `justLanded` pulse)
    // never observes this touchdown's landingQuality at all. Deferring the
    // bounce by a single physics step (~8ms) is imperceptible to a player.
    if (this.bounceCd <= 0 && this.grounded && this.wasGrounded && !this.inWater) {
      const pad = terrain.bouncePadAt(this.x);
      if (pad) {
        this.bounceCd = 0.6;
        this.bounced = true;
        this.grounded = false;
        this.inWater = false;
        this.vy = SUNFLOWER_VY;
        this.vx = Math.max(this.vx, SUNFLOWER_VX);
        this.y = pad.y + BIRD_RADIUS + 0.4;
      }
    }

    if (this.asleep) {
      this.vx *= 0.9;
      if (this.grounded) this.vx *= 0.8;
    }

    this.altitude = Math.max(0, this.y - terrain.heightAt(this.x) - BIRD_RADIUS);

    // The dive pitch is a RAMP, not a boolean step.
    //
    // `(diving ? -0.12 : 0)` put a hard 7° discontinuity into `targetAngle` the
    // instant the stick went down and again the instant it came up, and the
    // 0.003-retention rotation filter then took ~176 ms to absorb each one. Two
    // visible ticks per dive, on top of the bird already being at full dive
    // gravity (16 → 96) within a single 8.3 ms physics step — which is why a
    // flick read as "nothing happened, then everything happened".
    //
    // A time constant turns the same offset into a weight that rises and falls
    // through the same filter as the rest of the rotation, so the nose leads the
    // input instead of trailing it by two-tenths of a second.
    // Ramp INTO the dive slowly (50 ms τ) so the nose leads the input rather
    // than lagging two ticks. Snap OUT fast (20 ms τ) so the release reads
    // immediately — the player should see the nose lift the frame they let go.
    const kDive = diving
      ? 1 - Math.exp(-dt / 0.05)
      : 1 - Math.exp(-dt / 0.02);
    this.divePitch += ((diving ? -0.12 : 0) - this.divePitch) * kDive;
    const targetAngle = this.grounded
      ? Math.atan(terrain.slopeAt(this.x))
      : clamp(Math.atan2(this.vy, Math.max(6, this.vx)), -1.15, 0.95) + this.divePitch;
    // ground: fast snap to slope; air: responsive to velocity direction
    this.rotation = lerpAngle(this.rotation, targetAngle, 1 - Math.pow(this.grounded ? 0.00008 : 0.003, dt));
  }

  syncVisual(dt: number, diving: boolean, fever: boolean, time: number, terrain: TerrainSystem, ox?: number, oy?: number, interp = 1): void {
    // Render interpolation. `ox`/`oy` arrive already interpolated by the game;
    // the velocity and heading the visuals are built from are interpolated
    // here, from the per-step history `step()` records. Before this, every one
    // of these channels read the raw 120 Hz physics value, so on a display
    // faster than 120 Hz the roll, the heading, the pupil dart, the beak and
    // the tail flutter all advanced in visible steps — the sprite juddering
    // while its position, which WAS interpolated, glided smoothly past it.
    // Interpolating the whole visual state together is what makes the bird
    // move as one object.
    const rvx = lerp(this.prevVx, this.vx, interp);
    const rvy = lerp(this.prevVy, this.vy, interp);
    const rrot = lerpAngle(this.prevRotation, this.rotation, interp);
    this.drawnVx = rvx;
    this.drawnVy = rvy;
    this.drawRotation = rrot;
    const sp = Math.hypot(rvx, rvy);
    // Render interpolation: the mesh draws at a smoothed position between two
    // fixed physics steps (ox/oy), so a >60 Hz display never sees the bird
    // step. The sim state (this.x/y) stays untouched.
    const px = ox ?? this.x;
    const py = oy ?? this.y;
    // 3D dynamic banking: subtle roll and pitch that gives true depth
    const bankX = Math.sin(time * 3.2) * 0.04 + clamp(rvy * 0.012, -0.22, 0.22);
    const bankY = clamp(rvx * 0.002, 0, 0.16) + (diving ? 0.06 : 0);
    this.root.position.set(px - this.originX, py, 0);
    this.root.rotation.z = rrot;
    this.root.rotation.x = bankX;
    this.root.rotation.y = bankY;

    // Pupil directional lookahead
    const pDx = clamp(rvx * 0.0012, -0.01, 0.04);
    const pDy = clamp(rvy * 0.002, -0.03, 0.03);
    this.pupilL.position.set(0.12 + pDx, 0.02 + pDy, 0.04);
    this.pupilR.position.set(0.12 + pDx, 0.02 + pDy, -0.04);

    // Beak opening on fast glides / high launches
    const beakOpen = clamp((sp - 35) / 55, 0, 0.35);
    // The call opening is an animation ON TOP of the species' beak, not a
    // replacement for it — hence the multiply by `beakMult`.
    this.beak.scale.set(
      this.beakMult.x * (1 + beakOpen * 0.2),
      this.beakMult.y * (1 + beakOpen * 0.35),
      this.beakMult.z,
    );

    // Tail wind flutter
    const tailFlutter = Math.sin(time * 24 + sp * 0.2) * 0.12 * clamp(sp / 40, 0.2, 1.2);
    this.tail.rotation.x = tailFlutter;

    this.flapT += dt * (diving ? 2 : 16 + sp * 0.08);
    this.wingTuck = lerp(this.wingTuck, diving || this.asleep ? 1 : 0, 1 - Math.pow(0.0008, dt));
    const flap = Math.sin(this.flapT) * 0.55 * (1 - this.wingTuck);
    this.wingL.rotation.z = lerp(0.15 + flap, 1.15, this.wingTuck);
    this.wingR.rotation.z = lerp(-0.15 - flap, -1.15, this.wingTuck);
    this.wingL.rotation.y = lerp(0.35, 0.05, this.wingTuck);
    this.wingR.rotation.y = lerp(-0.35, -0.05, this.wingTuck);

    if (this.justLanded && this.impact > 4) {
      this.squashAmt = clamp(1 - this.impact * 0.035, 0.55, 1);
      this.stretchAmt = 1 + (1 - this.squashAmt) * 0.8;
    }
    this.squashAmt = lerp(this.squashAmt, 1, 1 - Math.pow(0.002, dt));
    this.stretchAmt = lerp(this.stretchAmt, 1, 1 - Math.pow(0.002, dt));
    const speedStretch = 1 + clamp(this.speed() / 180, 0, 0.18);
    // Likewise: speed stretch and landing squash are animations on top of the
    // species' bulk, so the owl stays a round bird while it stretches.
    this.squash.scale.set(this.bulk * this.stretchAmt * speedStretch, this.bulk * this.squashAmt, 1);
    this.squash.rotation.x = Math.sin(time * 3.2) * 0.04;

    // `syncVisual` runs at DISPLAY rate, not the fixed 120 Hz physics rate, so
    // a bare per-frame lerp constant here is frame-rate dependent: the eyelid
    // closed ~2.4x faster on a 144 Hz screen than a 60 Hz one. Everything
    // else in this file that touches a per-frame constant is inside `step`,
    // which is fixed-step, so these two were the only offenders. Retention
    // form, so the lid takes the same time in wall-clock terms on any display.
    const kLidShut = 1 - Math.pow(0.0002, dt);
    const kLidTrack = 1 - Math.pow(0.00002, dt);
    if (this.asleep) {
      this.lidL.scale.y = lerp(this.lidL.scale.y, 1, kLidShut);
      this.lidR.scale.y = lerp(this.lidR.scale.y, 1, kLidShut);
    } else {
      this.blink -= dt;
      if (this.blink < 0) this.blink = 2.2 + Math.random() * 2.5;
      const closed = this.blink < 0.12 ? 0.9 : 0.08;
      // Eye squint at high speed — adds personality and reads as intensity.
      const speedSquint = clamp((sp - 60) / 60, 0, 0.35);
      const target = Math.max(closed, speedSquint);
      this.lidL.scale.y = lerp(this.lidL.scale.y, target, kLidTrack);
      this.lidR.scale.y = lerp(this.lidR.scale.y, target, kLidTrack);
    }

    this.glowPulse += dt * 6;
    // Fever should feel special without washing out the bird's face or nearby
    // terrain. The previous 2.6–3.5 point-light pulse was visible as eye glare.
    this.glow.intensity = fever ? 0.85 + Math.sin(this.glowPulse) * 0.2 : 0;
    this.glow.color.setHex(0xffe08a);
    // Outside fever that intensity is 0, and three.js does NOT compile a
    // zero-intensity light out: a light that is off in practice still makes
    // every MeshLambertMaterial in the game carry NUM_POINT_LIGHTS = 1 and run
    // the point-light branch (normalize + length + two pow) on every lit
    // fragment — terrain, decor, coins, pickups, balloons, race birds — in
    // exchange for a glow that is off almost always. Hiding it instead of
    // dimming it drops NUM_POINT_LIGHTS to 0 for those programs.
    // Driven from `intensity > 0`, not from `fever`, so the light returns the
    // moment the pulse is non-zero, and it is exactly what intensity 0 already
    // contributed: nothing. Fever is player-facing feedback, so the pop is
    // asserted in __tests__/fever-glow.test.ts rather than assumed.
    this.glow.visible = this.glow.intensity > 0;
    if (fever) {
      this.bodyMat.emissive.set(0x552200);
      this.bodyMat.emissiveIntensity = 0.45;
      this.wingMat.emissive.set(0x441800);
      this.wingMat.emissiveIntensity = 0.4;
      this.bellyMat.emissive.set(0x332200);
      this.bellyMat.emissiveIntensity = 0.35;
    } else {
      this.bodyMat.emissive.set(0, 0, 0);
      this.bodyMat.emissiveIntensity = 0;
      this.wingMat.emissive.set(0, 0, 0);
      this.wingMat.emissiveIntensity = 0;
      this.bellyMat.emissive.set(0, 0, 0);
      this.bellyMat.emissiveIntensity = 0;
    }

    const h = terrain.heightAt(px);
    const alt = Math.max(0, py - h);
    this.shadow.position.set(px - this.originX, h + 0.08, 0);
    const s = clamp(1.3 - alt * 0.045, 0.42, 1.3);
    // The silhouette breathes with the wings: span narrows at the top of each
    // stroke and folds to a dart when tucked (dive/sleep). Local y maps to
    // world wingspan after the flat rotation, so only y is modulated.
    const span = s * (1 - 0.45 * this.wingTuck) * (1 - 0.14 * (flap / 0.55));
    this.shadow.scale.set(s, span, 1);
    this.shadow.rotation.z = Math.atan(terrain.slopeAt(px));
    // The ground shadow is the "where am I" cue, so its fade has to stop before
    // it stops being one. It used to bottom out at 0.25 scale and 0.07 opacity
    // — invisible precisely when the bird is smallest, i.e. high up.
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = (0.17 + 0.11 * s) * (this.inWater ? 0.15 : 1);

    // Readability. The base is deliberately generous: the bird is the subject
    // and the only thing the player is tracking, and at 1.18 it read as small
    // even at ground level. The camera-distance term then keeps it legible as
    // the camera dollies back at altitude. Both are visual only — position and
    // collision use BIRD_RADIUS, so this cannot affect flight physics.
    const behind = clamp((this.viewDistance - CAMERA_BASE_Z) / (CAMERA_REVEAL_MAX - CAMERA_BASE_Z), 0, 1);
    this.root.scale.setScalar(BIRD_BASE_SCALE * (1 + behind * 0.95));
  }

  dispose(): void {
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
    this.shadow.geometry.dispose();
    (this.shadow.material as THREE.Material).dispose();
  }

  private makeBody(): THREE.Mesh {
    const geo = new THREE.SphereGeometry(0.62, 12, 10);
    const body = new THREE.Mesh(geo, this.bodyMat);
    body.scale.set(1.15, 0.92, 0.92);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), this.bellyMat);
    belly.position.set(0.08, -0.18, 0);
    belly.scale.set(1.05, 0.8, 0.9);
    body.add(belly);
    return body;
  }

  private buildWing(group: THREE.Group, side: number): void {
    // Two-layer wing: broad primary + darker secondary layer underneath,
    // plus three feather tips so the flap reads with depth from any angle.
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.48, 10, 8), this.wingMat);
    wing.scale.set(0.95, 0.18, 0.55);
    group.add(wing);
    const under = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), this.bodyMat);
    under.scale.set(0.85, 0.14, 0.48);
    under.position.set(-0.08, -0.05, 0.05 * side);
    group.add(under);
    for (let i = 0; i < 3; i++) {
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.38, 4), this.wingMat);
      tip.rotation.x = (Math.PI / 2) * side;
      tip.rotation.z = -0.25 - i * 0.18;
      tip.position.set(-0.28 - i * 0.14, -0.02, (0.34 + i * 0.05) * side);
      group.add(tip);
    }
    group.position.set(-0.05, 0.12, 0.45 * side);
    group.rotation.y = 0.35 * side;
  }
}
