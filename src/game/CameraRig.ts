import * as THREE from "three";
import { ALT_CLOUDS, ALT_HIGH, ALT_SKY, ALT_STRATO, CAMERA_BASE_Z, CAMERA_LOOKAHEAD, MAX_SPEED } from "./constants";
import { clamp, lerp, smoothstep } from "./math";
import { diveKick } from "./SpeedFeel";
import type { ClipKind } from "./Moments";
import type { Bird } from "./Bird";

/** Replay-angle overlay for shareable beats. Mixes on top of the chase cam. */
export const CLIP_SHOTS = ["chase", "hero", "finish", "crash", "overtake"] as const;
export type ClipShot = (typeof CLIP_SHOTS)[number];

export type ClipPose = {
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  fovDelta: number;
  roll: number;
};

const CLIP_POSES: Record<ClipShot, ClipPose> = {
  chase: { offsetX: 0, offsetY: 0, offsetZ: 0, fovDelta: 0, roll: 0 },
  hero: { offsetX: -4.5, offsetY: 3.2, offsetZ: 6, fovDelta: -4, roll: -0.04 },
  finish: { offsetX: 8, offsetY: 1.4, offsetZ: -3, fovDelta: 5, roll: 0.03 },
  crash: { offsetX: 2.2, offsetY: 1.1, offsetZ: -5, fovDelta: 6, roll: 0.08 },
  overtake: { offsetX: -2.4, offsetY: 0.6, offsetZ: 3.5, fovDelta: 3, roll: -0.06 },
};

export const CHASE_POSE: ClipPose = { ...CLIP_POSES.chase };

export function clipShotFor(kind: ClipKind): ClipShot {
  switch (kind) {
    case "near_miss":
      return "hero";
    case "overtake":
      return "overtake";
    case "last_second":
      return "finish";
    case "crash":
      return "crash";
    case "perfect_run":
      return "hero";
  }
}

export function clipPose(shot: ClipShot, speedNorm: number, altitude: number): ClipPose {
  const base = CLIP_POSES[shot] ?? CLIP_POSES.chase;
  const speed = clamp(Number.isFinite(speedNorm) ? speedNorm : 0, 0, 1.4);
  const alt = clamp(Number.isFinite(altitude) ? altitude : 0, 0, 400);
  const pull = 1 + speed * 0.35 + Math.min(alt, 80) / 240;
  return {
    offsetX: base.offsetX * pull,
    offsetY: base.offsetY * pull,
    offsetZ: base.offsetZ * pull,
    fovDelta: clamp(base.fovDelta * (0.7 + speed * 0.4), -8, 8),
    roll: clamp(base.roll * (0.6 + speed * 0.5), -0.12, 0.12),
  };
}

export function mixClipPose(from: ClipPose, to: ClipPose, t: number): ClipPose {
  const k = clamp(t, 0, 1);
  return {
    offsetX: from.offsetX + (to.offsetX - from.offsetX) * k,
    offsetY: from.offsetY + (to.offsetY - from.offsetY) * k,
    offsetZ: from.offsetZ + (to.offsetZ - from.offsetZ) * k,
    fovDelta: from.fovDelta + (to.fovDelta - from.fovDelta) * k,
    roll: from.roll + (to.roll - from.roll) * k,
  };
}

/**
 * Dynamic chase camera.
 *
 * Close and low while carving, pulled back as speed builds, and lifted right
 * out into the sky on a big launch so the player can see how high they got.
 * Everything is critically damped — the camera never snaps.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private lookX = 50;
  private lookY = 20;
  private camX = 40;
  private camY = 24;
  private camZ = CAMERA_BASE_Z;
  private fov = 50;
  private shake = 0;
  private shakeX = 0;
  private shakeY = 0;
  private intro = 1;
  private punchZ = 0;
  private reduceMotion = false;
  private baseFov = 50;
  /**
   * Distance actually used for this frame's framing. The bird reads it for its
   * readability compensation, so the two cannot drift apart the way a second
   * copy of the altitude-pull formula would.
   */
  viewDistance = CAMERA_BASE_Z;
  /** Cinematic layer: dolly-zoom on launches + settling roll. */
  private dolly = 0;
  private dollyVel = 0;
  private rollTilt = 0;
  private orbit = 0;
  private orbitTarget = 0;
  /** Short mix of a clip overlay on top of the live chase. */
  private clipMix = 0;
  private clipShot: ClipShot | null = null;
  private clipSpeed = 0;
  private clipAlt = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1400);
    this.camera.position.set(40, 26, CAMERA_BASE_Z);
  }

  /** Split-screen viewports are short and wide; widen the lens to compensate. */
  setBaseFov(fov: number): void {
    this.baseFov = fov;
  }

  setIntro(v: number): void {
    this.intro = v;
  }

  setReduceMotion(v: boolean): void {
    this.reduceMotion = v;
    if (v) this.shake = 0;
  }

  bump(amount: number): void {
    if (this.reduceMotion) return;
    this.shake = Math.min(2.2, this.shake + amount);
  }

  punch(amount: number): void {
    this.punchZ = Math.max(this.punchZ, this.reduceMotion ? amount * 0.4 : amount);
  }

  /**
   * Cinematic dolly-zoom: the rig pulls back while the lens narrows, so the
   * bird stays the same on-screen size but the world warps behind it. Fired on
   * a perfect launch — the single most cinematic beat in the game.
   */
  dollyZoom(strength: number): void {
    if (this.reduceMotion) return;
    this.dollyVel += strength;
  }

  /** A brief banked camera roll used when a big launch fires. */
  tilt(amount: number): void {
    if (this.reduceMotion) return;
    this.orbitTarget = clamp(amount, -0.32, 0.32);
  }

  /**
   * Pulse a clip-camera overlay for a shareable beat. Reduce-motion skips it;
   * the chase cam is never replaced, only mixed for ~0.55 s.
   */
  pulseClip(shot: ClipShot, speedNorm = 0.6, altitude = 20): void {
    if (this.reduceMotion) return;
    this.clipShot = shot;
    this.clipMix = 1;
    this.clipSpeed = speedNorm;
    this.clipAlt = altitude;
  }

  snapTo(bird: Bird): void {
    this.lookX = bird.x + 10;
    this.lookY = bird.y + 5;
    this.camX = bird.x - 2;
    this.camY = bird.y + 8;
    this.camZ = CAMERA_BASE_Z;
    this.shake = 0;
    this.punchZ = 0;
    this.intro = 0;
    this.dolly = this.dollyVel = this.orbit = this.orbitTarget = this.rollTilt = 0;
    this.shakeX = this.shakeY = 0;
    this.apply();
  }

  /**
   * Attract framing (menu backdrop): pull back for a wider cinematic view
   * and pin the demo bird to the open left margin at a fixed screen
   * fraction, so it can never hide behind the centered menu card whatever
   * the speed or altitude. Gameplay framing untouched.
   */
  update(dt: number, bird: Bird, playing: boolean, groundY = 0, attract = false, fever = false): void {
    const speed = bird.speed();
    const sNorm = clamp(speed / MAX_SPEED, 0, 1.2);
    const alt = bird.altitude;

    // How far out we frame: speed pulls back a little, altitude a lot.
    const altPull =
      smoothstep(ALT_SKY * 0.5, ALT_SKY, alt) * 12 +
      smoothstep(ALT_SKY, ALT_CLOUDS, alt) * 22 +
      smoothstep(ALT_CLOUDS, ALT_HIGH, alt) * 34 +
      smoothstep(ALT_HIGH, ALT_HIGH * 2.2, alt) * 46;

    // Spring-damped dolly + punch decay run before framing so the attract
    // branch below can derive the lookahead from the settled zoom.
    this.dollyVel += -this.dolly * 34 * dt;
    this.dollyVel *= Math.pow(0.02, dt);
    this.dolly += this.dollyVel * dt;
    this.punchZ *= Math.pow(0.03, dt);
    // Portrait phones show much less horizontal world at the same camera
    // distance. Pull back gently on narrow aspects so the bird and the next
    // landing both stay readable instead of crowding the edges.
    const portraitPull = clamp((0.9 - this.camera.aspect) * 18, 0, 10);
    const flightHeight = Math.max(0, bird.y - groundY);
    const groundFrame = attract ? 0 : smoothstep(15, 55, flightHeight);
    const horizontalFit = clamp(bird.vx * 0.8, 28, 72) / (2 * Math.tan(this.baseFov * Math.PI / 360) * this.camera.aspect * 0.6);
    const fitZoom = (flightHeight + 16) / (2 * Math.tan(this.baseFov * Math.PI / 360) * 0.70);
    const zoom = Math.max(attract ? 0 : Math.max(fitZoom, horizontalFit) * groundFrame + portraitPull, CAMERA_BASE_Z + sNorm * 14 + altPull + portraitPull - this.punchZ + this.dolly * 5 + (attract ? 12 : 0));
    // Published for the bird's readability compensation (see Bird.syncVisual).
    this.viewDistance = zoom;

    // A touch more lookahead keeps the bird in the left third of the frame so
    // the player reads the hills ahead, not the bird's back. In attract the
    // lookahead is proportional: a fixed fraction of the visible half-width
    // puts the bird at ~28% screen width on any viewport (fixed offsets
    // drift behind the card as speed/altitude change the zoom).
    const visibleHalfWidth = Math.tan((this.fov * Math.PI) / 360) * zoom * this.camera.aspect;
    const gameplayAhead = 9.5 + speed * CAMERA_LOOKAHEAD + altPull * 0.12;
    // Portrait screens expose far less horizontal world than desktop. A fixed
    // look-ahead was wider than the entire phone camera, sending the bird off
    // the left edge. Keep it in the readable left third at every aspect ratio.
    // Keep the subject comfortably inside the portrait safe area. At 0.48 the
    // bird sits almost on the left edge of a phone (and can disappear behind
    // the rounded viewport/cutout). A tighter lead keeps the bird readable
    // while still leaving enough terrain visible ahead for timing landings.
    const ahead = attract ? 0.72 * visibleHalfWidth : Math.min(gameplayAhead, 0.32 * visibleHalfWidth);
    const targetLookX = bird.x + ahead;
    // When very high, bias the look point downward so the landscape stays in frame
    // and the player can time their descent to the next landing.
    const downBias =
      smoothstep(ALT_SKY, ALT_HIGH, alt) * 14 +
      smoothstep(ALT_HIGH, ALT_STRATO, alt) * 24;
    // Slightly lower look point + higher camera = a gentle top-down tilt: the
    // bird frames against the ground (readable landings) instead of the sky.
    const targetLookY = lerp(bird.y + 3.2 - downBias, (bird.y + groundY) * 0.5, groundFrame);

    // Rising fast? Lead the climb. Falling from height? Lead the descent.
    const vLead = clamp(bird.vy * 0.12, -14, 18) * smoothstep(6, 40, alt) * (1 - groundFrame);

    // Attract tracks snappily: at demo speed the lazy menu damping lags the
    // look point ~25 units behind, which eats the margin and slides the bird
    // back under the card. Gameplay damping untouched.
    const k = 1 - Math.pow(playing || attract ? 0.006 : 0.05, dt);
    const kSlow = 1 - Math.pow(playing ? 0.02 : 0.05, dt);
    this.lookX = lerp(this.lookX, targetLookX, k);
    this.lookY = lerp(this.lookY, targetLookY + vLead * 0.35, kSlow);

    // Keep the ground on screen when we are miles up, but never below it.
    // Camera rides a little higher so the bird frames against the terrain
    // rather than tree canopies at low altitude.
    const wantY = lerp(bird.y + 8.5 + altPull * 0.16, targetLookY + 8.5, groundFrame) + vLead;
    const floorY = groundY + 6.5;

    // Attract bypasses the intro sweep (it never decays in the menu, so it
    // would sit as a permanent offset and push the bird back under the
    // card). Run-start sweeps in gameplay are untouched.
    const introK = attract ? 0 : this.intro;
    this.camX = lerp(this.camX, bird.x - 1.5 + introK * 6, k);
    this.camY = lerp(this.camY, Math.max(floorY, wantY) + introK * 4, kSlow);
    this.camZ = lerp(this.camZ, zoom + introK * 10, Math.min(1, kSlow * (zoom > this.camZ ? 2.8 : 1.4)));

    // Banked roll settles back to level so the horizon never stays crooked.
    this.orbitTarget = lerp(this.orbitTarget, 0, 1 - Math.pow(0.08, dt));
    this.orbit = lerp(this.orbit, this.orbitTarget, 1 - Math.pow(0.02, dt));
    // Airborne pitch reads as the bird "hanging" at apex.
    this.rollTilt = lerp(this.rollTilt, this.reduceMotion ? 0 : clamp(-bird.vy * 0.004, -0.09, 0.09) * (1 - groundFrame), 1 - Math.pow(0.05, dt));

    // Dynamic FOV: widens with speed, kicks +8 in fever (spec: FOV+8 fever),
    // and counter-narrows during a dolly-zoom so the subject holds size
    // while the background stretches.
    //
    // On top of that, a hard dive at speed gets its own kick (SpeedFeel.ts
    // owns the curve): falling is where players *feel* acceleration, and a
    // plain speed ramp cannot show it because speed alone barely changes
    // during a dive. The lens widening by a few degrees as the bird drops
    // sells the fall far better than any particle could. Skipped entirely
    // under reduced motion, where the FOV budget is already halved.
    const targetFov =
      this.baseFov +
      sNorm * (this.reduceMotion ? 4 : 18) +
      (fever && !this.reduceMotion ? 8 : 0) +
      (this.reduceMotion ? 0 : diveKick(bird.vy, sNorm)) -
      this.dolly * 9;
    this.fov = lerp(this.fov, targetFov, 1 - Math.pow(0.06, dt));
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }

    this.clipMix *= Math.pow(0.012, dt);
    if (this.clipMix < 0.02) {
      this.clipMix = 0;
      this.clipShot = null;
    }

    this.shake *= Math.pow(0.04, dt);
    // Sine-sum shake for organic, non-repeating motion instead of random jitter.
    const t = performance.now() * 0.001;
    this.shakeX = (Math.sin(t * 23.7) * 0.7 + Math.sin(t * 31.3) * 0.3) * this.shake;
    this.shakeY = (Math.cos(t * 29.1) * 0.7 + Math.cos(t * 37.9) * 0.3) * this.shake;
    this.apply();
  }

  resize(aspect: number): void {
    if (this.camera.aspect === aspect) return;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  private apply(): void {
    const overlay: ClipPose = this.clipShot && this.clipMix > 0
      ? mixClipPose(CHASE_POSE, clipPose(this.clipShot, this.clipSpeed, this.clipAlt), this.clipMix)
      : CHASE_POSE;
    this.camera.position.set(
      this.camX + this.shakeX + overlay.offsetX,
      this.camY + this.shakeY + overlay.offsetY,
      this.camZ + overlay.offsetZ,
    );
    this.camera.lookAt(this.lookX, this.lookY, 0);
    this.camera.rotation.z = this.shakeX * 0.01 + this.orbit + overlay.roll;
    this.camera.rotation.x += this.rollTilt;
    if (overlay.fovDelta !== 0 && Math.abs(this.clipMix) > 0) {
      this.camera.fov = this.fov + overlay.fovDelta * this.clipMix;
      this.camera.updateProjectionMatrix();
    }
  }
}
