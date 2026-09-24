import { glideLiftScale } from "./FlightPhysics";
import * as THREE from "three";
import {
  AIR_DRAG_DIVE,
  AIR_DRAG_GLIDE,
  BIRD_RADIUS,
  BOOST_EXTRA_SPEED,
  GLIDE_LIFT_MAX,
  GLIDE_LIFT_SPEED,
  GRAVITY_DIVE,
  GRAVITY_GLIDE,
  GROUND_FRICTION,
  GROUND_FRICTION_DIVE,
  GROUND_G_DIVE,
  GROUND_G_GLIDE,
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
  private readonly bellyMat: THREE.MeshLambertMaterial;
  private readonly lidMat: THREE.MeshLambertMaterial;
  private readonly beakMat: THREE.MeshLambertMaterial;

  private flapT = 0;
  private squashAmt = 1;
  private stretchAmt = 1;
  private wingTuck = 0;
  private blink = 0;
  private glowPulse = 0;
  private currentSkin: BirdSkinColors = {
    body: 0xff7a45,
    wing: 0xff9a62,
    belly: 0xffe6c4,
    beak: 0xffc447,
  };

  constructor() {
    this.bodyMat = new THREE.MeshLambertMaterial({ color: 0xff7a45, emissive: 0xff7a45, emissiveIntensity: 0.08 });
    this.wingMat = new THREE.MeshLambertMaterial({ color: 0xff9a62 });
    this.bellyMat = new THREE.MeshLambertMaterial({ color: 0xffe6c4 });
    this.beakMat = new THREE.MeshLambertMaterial({ color: 0xffc447 });
    const eyeW = new THREE.MeshBasicMaterial({ color: 0xfffaf2 });
    const eyeP = new THREE.MeshBasicMaterial({ color: 0x2a1c28 });
    this.lidMat = new THREE.MeshLambertMaterial({ color: 0xff7a45, emissive: 0xff7a45, emissiveIntensity: 0.08 });

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
    for (let i = 0; i < 3; i++) {
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.09 - i * 0.015, 0.42 - i * 0.06, 5), this.wingMat);
      crest.position.set(0.18 - i * 0.17, 0.62 + i * 0.03, 0);
      crest.rotation.z = 0.55 + i * 0.35;
      this.squash.add(crest);
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
    }

    this.glow = new THREE.PointLight(0xffe08a, 0, 18, 2);
    this.glow.position.set(0, 0.4, 1);
    this.root.add(this.glow);
    this.root.scale.setScalar(1.18);

    const shadowGeo = Bird.makeShadowGeometry();
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x1a1020,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;

    // Best practice: no shadows on the bird by default — shadow maps are the
    // #1 mobile GPU killer. The ground silhouette (MeshBasicMaterial) is cheap
    // and reads as shadow. High-quality desktop can opt-in via quality.ts.
    this.squash.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = false;
        o.receiveShadow = false;
        // Keep frustum culling on for the bird — it's always on screen, but
        // the check is cheap and saves work when the bird is off-screen in menus.
        o.frustumCulled = true;
      }
    });
    // PointLight is expensive (affects all Lambert materials). Only visible in
    // fever — otherwise intensity 0 so it costs nothing. No shadow casting ever.
    this.glow.castShadow = false;
    this.glow.visible = false;

    this.root.add(this.squash);
    // The bird is the primary gameplay affordance. Render it above foreground
    // props so narrow screens never lose the player silhouette to terrain
    // depth sorting or translucent haze.
    this.root.renderOrder = 50;
    this.squash.traverse((o) => {
      if (o instanceof THREE.Mesh) o.renderOrder = 50;
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
    this.squashAmt = 1;
    this.stretchAmt = 1;
    this.wingTuck = 0;
    this.flapT = 0;
    this.root.rotation.set(0, 0, 0);
    this.lidL.scale.y = 0.08;
    this.lidR.scale.y = 0.08;
  }

  speed(): number {
    return Math.hypot(this.vx, this.vy);
  }

  applySkin(skin: BirdSkinColors): void {
    this.currentSkin = skin;
    this.bodyMat.color.setHex(skin.body);
    this.bodyMat.emissive.setHex(skin.body);
    this.wingMat.color.setHex(skin.wing);
    this.bellyMat.color.setHex(skin.belly);
    this.lidMat.color.setHex(skin.body);
    this.lidMat.emissive.setHex(skin.body);
    this.beakMat.color.setHex(skin.beak);
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
    const was = this.grounded;
    this.wasGrounded = was;

    const diving = opts.diving && !this.asleep;
    const gMult = opts.gravityMult ?? 1;
    const cap =
      (opts.fever ? MAX_SPEED_FEVER : MAX_SPEED) * opts.speedMult + (opts.boost ? BOOST_EXTRA_SPEED : 0);

    if (was) {
      /* ---------- carving the surface ---------- */
      const n = terrain.normalAt(this.x, this.terrainNormal);
      let vt = this.vx * n.tx + this.vy * n.ty;

      // gravity along the slope: downhill (ty<0) accelerates, uphill decelerates.
      // TUNED: uphill is less punishing — when ty>0 (uphill) and speed is low,
      // gravity penalty is scaled down and a small assist pushes you over the crest
      // so you never get bored crawling up a hill.
      const gGround = diving ? GROUND_G_DIVE : GROUND_G_GLIDE;
      const uphill = n.ty > 0 ? n.ty : 0; // 0..1, how steep uphill
      const downhill = n.ty < 0 ? -n.ty : 0;
      // Downhill still accelerates full, uphill is softened when slow (anti-bore)
      const uphillPenaltyScale = uphill > 0.08 ? (vt < 18 ? 0.55 : vt < 28 ? 0.75 : 1) : 1;
      vt += -gGround * (uphill > 0 ? n.ty * uphillPenaltyScale : n.ty) * dt;
      // Small push over crests when slow — never lets you stall on a hill
      if (uphill > 0.12 && vt < 18) {
        const assist = (18 - vt) * uphill * 0.9 * dt;
        vt += assist;
      }
      // Downhill gets a tiny extra kick so you feel the slope
      if (downhill > 0.15) vt += downhill * 2.2 * dt;

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
      if (curv > 0) {
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
      /* ---------- ballistic flight — ANTI-BORE TUNED ---------- */
      const sp = Math.max(0.001, this.speed());
      let lift = diving
        ? 0
        : Math.min(0.85, GLIDE_LIFT_MAX * clamp(sp / GLIDE_LIFT_SPEED, 0, 1) * (opts.liftMult ?? 1)) * glideLiftScale(this.airTime);

      // Anti-bore: after 2.5s in air, lift decays extra if slow; after 3.5s sink hard
      if (!diving && this.airTime > 2.5) {
        const slowFactor = clamp((18 - sp) / 12, 0, 1); // 0 when fast, 1 when slow (<6)
        const timeFactor = clamp((this.airTime - 2.5) / 2.5, 0, 1);
        lift *= 1 - slowFactor * timeFactor * 0.6; // slow + long = lose lift
      }
      // Hard sink after 3.8s if still gliding — forces decision: dive or thermal
      let extraSink = 0;
      if (!diving && this.airTime > 3.8) {
        extraSink = (this.airTime - 3.8) * 4.5; // extra gravity
      }

      this.vy -= ((diving ? GRAVITY_DIVE : GRAVITY_GLIDE) * gMult * (1 - lift) + extraSink) * dt;

      const k = (diving ? AIR_DRAG_DIVE : AIR_DRAG_GLIDE) * (opts.dragMult ?? 1);
      // Extra drag when gliding long and slow — prevents infinite float
      const longGlideDrag = !diving && this.airTime > 2 ? (this.airTime - 2) * 0.00018 : 0;
      const decay = Math.max(0, 1 - (k + longGlideDrag) * sp * dt);
      this.vx *= decay;
      this.vy *= decay;

      const s2 = this.speed();
      if (s2 > cap) {
        this.vx *= cap / s2;
        this.vy *= cap / s2;
      }

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
      this.vx = Math.max(this.vx, 7);
      if (this.y > WATER_Y - 0.2 && this.vy > 0) {
        this.vy *= 0.4;
      }
    }

    // Sunflower bounce: land on a bloom (or roll onto one) and spring back up.
    this.bounceCd = Math.max(0, this.bounceCd - dt);
    if (this.bounceCd <= 0 && this.grounded && !this.inWater) {
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

    const targetAngle = this.grounded
      ? Math.atan(terrain.slopeAt(this.x))
      : clamp(Math.atan2(this.vy, Math.max(6, this.vx)), -1.15, 0.95) + (diving ? -0.12 : 0);
    // snappier on the ground so the bird reads as glued; softer in the air
    this.rotation = lerpAngle(this.rotation, targetAngle, 1 - Math.pow(this.grounded ? 0.0004 : 0.02, dt));
  }

  syncVisual(dt: number, diving: boolean, fever: boolean, time: number, terrain: TerrainSystem, ox?: number, oy?: number): void {
    const sp = this.speed();
    // Render interpolation: the mesh draws at a smoothed position between two
    // fixed physics steps (ox/oy), so a >60 Hz display never sees the bird
    // step. The sim state (this.x/y) stays untouched.
    const px = ox ?? this.x;
    const py = oy ?? this.y;
    // 3D dynamic banking: subtle roll and pitch that gives true depth
    const bankX = Math.sin(time * 3.2) * 0.04 + clamp(this.vy * 0.012, -0.22, 0.22);
    const bankY = clamp(this.vx * 0.002, 0, 0.16) + (diving ? 0.06 : 0);
    this.root.position.set(px, py, 0);
    this.root.rotation.z = this.rotation * 0.92;
    this.root.rotation.x = bankX;
    this.root.rotation.y = bankY;

    // Pupil directional lookahead
    const pDx = clamp(this.vx * 0.0012, -0.01, 0.04);
    const pDy = clamp(this.vy * 0.002, -0.03, 0.03);
    this.pupilL.position.set(0.12 + pDx, 0.02 + pDy, 0.04);
    this.pupilR.position.set(0.12 + pDx, 0.02 + pDy, -0.04);

    // Beak opening on fast glides / high launches
    const beakOpen = clamp((sp - 35) / 55, 0, 0.35);
    this.beak.scale.set(1 + beakOpen * 0.2, 1 + beakOpen * 0.35, 1);

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
    this.squash.scale.set(this.stretchAmt * speedStretch, this.squashAmt, 1);
    this.squash.rotation.x = Math.sin(time * 3.2) * 0.04;

    if (this.asleep) {
      this.lidL.scale.y = lerp(this.lidL.scale.y, 1, 0.12);
      this.lidR.scale.y = lerp(this.lidR.scale.y, 1, 0.12);
    } else {
      this.blink -= dt;
      if (this.blink < 0) this.blink = 2.2 + Math.random() * 2.5;
      const closed = this.blink < 0.12 ? 0.9 : 0.08;
      // Eye squint at high speed — adds personality and reads as intensity.
      const speedSquint = clamp((sp - 60) / 60, 0, 0.35);
      const target = Math.max(closed, speedSquint);
      this.lidL.scale.y = lerp(this.lidL.scale.y, target, 0.4);
      this.lidR.scale.y = lerp(this.lidR.scale.y, target, 0.4);
    }

    this.glowPulse += dt * 6;
    // Only enable PointLight during fever — otherwise it's a hidden cost that
    // lights every Lambert material in the scene (terrain, pylons, etc).
    this.glow.visible = fever;
    this.glow.intensity = fever ? 2.6 + Math.sin(this.glowPulse) * 0.9 : 0;
    this.glow.color.setHex(fever ? 0xffe08a : 0xfff4dc);
    if (fever) {
      this.bodyMat.emissive.set(0x552200);
      this.wingMat.emissive.set(0x441800);
      this.bellyMat.emissive.set(0x332200);
    } else {
      this.bodyMat.emissive.setHex(this.currentSkin.body);
      this.wingMat.emissive.set(0x000000);
      this.bellyMat.emissive.set(0x000000);
    }

    const h = terrain.heightAt(px);
    const alt = Math.max(0, py - h);
    this.shadow.position.set(px, h + 0.08, 0);
    const s = clamp(1.3 - alt * 0.045, 0.25, 1.3);
    // The silhouette breathes with the wings: span narrows at the top of each
    // stroke and folds to a dart when tucked (dive/sleep). Local y maps to
    // world wingspan after the flat rotation, so only y is modulated.
    const span = s * (1 - 0.45 * this.wingTuck) * (1 - 0.14 * (flap / 0.55));
    this.shadow.scale.set(s, span, 1);
    this.shadow.rotation.z = Math.atan(terrain.slopeAt(px));
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.28 * s * (this.inWater ? 0.15 : 1);
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
