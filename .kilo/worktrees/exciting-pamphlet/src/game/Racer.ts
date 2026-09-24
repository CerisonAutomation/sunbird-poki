import * as THREE from "three";
import { Bird } from "./Bird";
import { CameraRig } from "./CameraRig";
import { Collectibles, type CloudKind } from "./Collectibles";
import { BIRD_RADIUS, WATER_Y } from "./constants";
import { LaunchSystem, type LaunchResult } from "./LaunchSystem";
import { lerp } from "./math";
import { PowerUps } from "./PowerUps";
import type { SkinDef } from "./Economy";
import type { ParticleFX } from "./ParticleFX";
import type { TerrainSystem } from "./TerrainSystem";

export type RacerEvents = {
  onLaunch: (r: LaunchResult, racer: Racer) => void;
  onLand: (quality: number, racer: Racer) => void;
  onCoin: (gem: boolean, x: number, y: number, racer: Racer) => void;
  onCloud: (kind: CloudKind, x: number, y: number, racer: Racer) => void;
  onPickup: (kind: string, x: number, y: number, racer: Racer) => void;
  onSplash: (racer: Racer) => void;
};

export type RacerStats = {
  distance: number;
  coins: number;
  perfects: number;
  greats: number;
  topSpeed: number;
  maxAltitude: number;
  bestCombo: number;
  finishedAt: number;
};

/**
 * One competitor: bird + camera + its own collectible set + launch/power state.
 *
 * Both split-screen players are Racers, so they run byte-identical physics on
 * identical terrain — the only difference is the button being pressed.
 */
export class Racer {
  readonly bird = new Bird();
  readonly camera: CameraRig;
  readonly collect: Collectibles;
  readonly launch = new LaunchSystem();
  readonly powers = new PowerUps();
  readonly index: number;
  readonly label: string;
  readonly tint: number;

  startX = 64;
  runTime = 0;
  finished = false;
  splashCd = 0;
  stats: RacerStats = {
    distance: 0,
    coins: 0,
    perfects: 0,
    greats: 0,
    topSpeed: 0,
    maxAltitude: 0,
    bestCombo: 0,
    finishedAt: 0,
  };

  private skin: SkinDef | null = null;
  /** Bird position at the start of the last physics step — the "from" end of
   *  render interpolation, so the split-screen birds don't step at >60 Hz. */
  private prevX = 0;
  private prevY = 0;

  constructor(index: number, label: string, tint: number, terrain: TerrainSystem, scene: THREE.Scene) {
    this.index = index;
    this.label = label;
    this.tint = tint;
    this.camera = new CameraRig(1);
    this.collect = new Collectibles(terrain.seedN + index * 7919, `${terrain.seedStr}:p${index}`);
    scene.add(this.collect.group);
    this.bird.addTo(scene);
    const layer = index + 1;
    this.collect.setLayer(layer);
    this.camera.camera.layers.enable(layer);
  }

  applySkin(skin: SkinDef): void {
    this.skin = skin;
    this.bird.applySkin({ body: skin.body, wing: skin.wing, belly: skin.belly, beak: skin.beak });
  }

  reset(terrain: TerrainSystem, startX: number): void {
    this.startX = startX;
    this.bird.reset(startX, terrain.heightAt(startX) + BIRD_RADIUS);
    this.launch.reset();
    this.powers.reset();
    this.runTime = 0;
    this.finished = false;
    this.splashCd = 0;
    this.stats = {
      distance: 0,
      coins: 0,
      perfects: 0,
      greats: 0,
      topSpeed: 0,
      maxAltitude: 0,
      bestCombo: 0,
      finishedAt: 0,
    };
    this.collect.reset();
    this.camera.snapTo(this.bird);
  }

  step(dt: number, diving: boolean, terrain: TerrainSystem, fx: ParticleFX, ev: RacerEvents): void {
    if (this.finished) diving = false;
    this.runTime += dt;
    // Snapshot before physics advances so the render can interpolate between
    // the previous and current step (mirrors the single-player bird).
    this.prevX = this.bird.x;
    this.prevY = this.bird.y;
    this.powers.tick(dt);
    this.launch.tick(dt);
    this.launch.observeInput(diving, this.runTime);

    this.bird.step(
      dt,
      {
        diving,
        fever: false,
        speedMult: this.skin?.speedMult ?? 1,
        boost: this.powers.boostOn(),
        liftMult: this.powers.liftMult(),
        dragMult: this.powers.dragMult(),
        feather: this.powers.featherOn(),
      },
      terrain,
    );

    if (this.bird.justLaunched) {
      const res = this.launch.evaluate(this.bird, terrain, this.runTime);
      if (res.rating !== "none") ev.onLaunch(res, this);
      if (res.rating === "perfect") this.stats.perfects += 1;
      else if (res.rating === "great") this.stats.greats += 1;
      this.stats.bestCombo = Math.max(this.stats.bestCombo, this.launch.best);
    }
    if (this.bird.justLanded) {
      if (this.bird.landingQuality < 0.8) this.launch.breakCombo();
      ev.onLand(this.bird.landingQuality, this);
      if (this.bird.impact > 5) fx.emitDust(this.bird.x, this.bird.y, this.bird.speed(), 0);
    }
    if (this.bird.grounded && this.bird.speed() > 12) {
      fx.emitDust(this.bird.x, terrain.heightAt(this.bird.x) + 0.3, this.bird.speed(), 0);
    }

    this.splashCd -= dt;
    if (this.bird.inWater && this.splashCd <= 0) {
      this.splashCd = 0.6;
      this.launch.breakCombo();
      fx.emitSplash(this.bird.x, WATER_Y);
      ev.onSplash(this);
    }

    this.collect.update(dt, this.bird, terrain, this.powers.magnetOn(), this.runTime, this.powers.magnetScale(), {
      onCoin: (x, y, gem) => {
        this.stats.coins += (gem ? 5 : 1) * this.powers.coinMult();
        ev.onCoin(gem, x, y, this);
      },
      onCloud: (kind, x, y) => {
        this.applyCloud(kind);
        ev.onCloud(kind, x, y, this);
      },
      onPickup: (kind, x, y) => {
        this.powers.add(kind);
        if (kind === "rocket") {
          this.bird.vx += 30;
          this.bird.vy += 5;
        }
        if (kind === "shield") this.powers.shield = Math.min(2, this.powers.shield + 1);
        ev.onPickup(kind, x, y, this);
      },
      onRing: () => {
        // AI pilots thread rings too — same small surge, keeps the field honest.
        this.bird.vx += 8;
      },
      onBalloon: () => {
        // Same bounce as the player, so a balloon never gifts an unfair lead.
        this.bird.vy = Math.max(this.bird.vy, 42);
        this.bird.vx += 14;
        this.bird.grounded = false;
      },
    });

    const sp = this.bird.speed();
    if (sp > this.stats.topSpeed) this.stats.topSpeed = sp;
    if (this.bird.altitude > this.stats.maxAltitude) this.stats.maxAltitude = this.bird.altitude;
    this.stats.distance = Math.max(this.stats.distance, this.bird.x - this.startX);
  }

  /** Cloud gameplay: each type feeds the momentum loop in its own way. */
  applyCloud(kind: CloudKind): void {
    const cb = this.powers.cloudBoostOn() ? 1.6 : 1;
    switch (kind) {
      case "boost":
        this.powers.add("longglide");
        break;
      case "wind":
        this.bird.vx += 14 * cb;
        break;
      case "super":
        this.powers.add("wingboost");
        this.powers.add("longglide");
        break;
      case "golden":
        this.stats.coins += 10;
        break;
      default:
        this.bird.vx += 3 * cb;
        break;
    }
    if (this.powers.cloudBoostOn()) this.bird.vx += 6;
  }

  syncVisual(dt: number, diving: boolean, time: number, terrain: TerrainSystem, interp = 1): void {
    const ox = lerp(this.prevX, this.bird.x, interp);
    const oy = lerp(this.prevY, this.bird.y, interp);
    this.bird.syncVisual(dt, diving, this.powers.has("goldenwings"), time, terrain, ox, oy);
  }

  updateCamera(dt: number, playing: boolean, terrain: TerrainSystem): void {
    this.camera.update(dt, this.bird, playing, terrain.landingGround(this.bird.x, this.bird.vx));
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.collect.group);
    this.collect.dispose();
    this.bird.dispose();
  }
}
