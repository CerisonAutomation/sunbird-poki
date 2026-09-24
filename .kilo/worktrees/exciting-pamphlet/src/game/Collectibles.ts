import { uploadDensePrefix } from "./bufferUpdates";
import * as THREE from "three";
import { ALT_CLOUDS, ALT_HIGH, ALT_SKY, MAGNET_RADIUS, MAGNET_RADIUS_NORMAL, RAMP_START } from "./constants";
import { hash01, SeededRandom } from "./math";
import type { TerrainSystem } from "./TerrainSystem";
import type { Bird } from "./Bird";

export type PickupKind =
  | "sun"
  | "rocket"
  | "magnet"
  | "shield"
  | "longglide"
  | "wingboost"
  | "feather"
  | "goldenwings"
  | "cloudboost";

export type CloudKind = "plain" | "boost" | "golden" | "wind" | "super";

export type CollectEvents = {
  onCoin: (x: number, y: number, gem: boolean) => void;
  onCloud: (kind: CloudKind, x: number, y: number) => void;
  onPickup: (kind: PickupKind, x: number, y: number) => void;
  onRing: (x: number, y: number) => void;
  onBalloon: (x: number, y: number) => void;
};

type Coin = { x: number; y: number; taken: boolean; gem: boolean; slot: number };
type Cloud = { kind: CloudKind; x: number; y: number; z: number; taken: boolean; sprite: THREE.Sprite; phase: number; drift: number };
type Pickup = { kind: PickupKind; x: number; y: number; taken: boolean; mesh: THREE.Mesh; phase: number };
type Ring = { x: number; y: number; r: number; taken: boolean; slot: number };
type Balloon = { x: number; y: number; taken: boolean; root: THREE.Group; phase: number; drift: number };

export const PICKUP_STYLE: Record<PickupKind, { color: number; emissive: number; icon: string; label: string }> = {
  sun: { color: 0xffd24a, emissive: 0xff8a00, icon: "☀", label: "Sunlight" },
  rocket: { color: 0xff5a3a, emissive: 0x8a1400, icon: "🚀", label: "Speed Boost" },
  magnet: { color: 0x8a6cff, emissive: 0x2a10a0, icon: "🧲", label: "Magnet" },
  shield: { color: 0x5ad8ff, emissive: 0x0a5a8a, icon: "🛡", label: "Sea Shield" },
  longglide: { color: 0x7fe8c8, emissive: 0x0a6a58, icon: "🪁", label: "Long Glide" },
  wingboost: { color: 0xffa8e0, emissive: 0x8a1060, icon: "🕊", label: "Wing Boost" },
  feather: { color: 0xfff0c0, emissive: 0x6a5a10, icon: "🐦", label: "Feather" },
  goldenwings: { color: 0xffd76a, emissive: 0xa06000, icon: "✨", label: "Golden Wings" },
  cloudboost: { color: 0xc8e8ff, emissive: 0x2a5a8a, icon: "☁", label: "Cloud Boost" },
};

const SPAWN_CELL = 26;
const MAX_COINS_BASE = 512; // base for high tier
const MAX_GEMS = 96;
const MAX_RINGS_BASE = 120; // base for high tier
const MAX_BALLOONS_BASE = 24; // base for high tier
// Legacy constants kept for tests that import them — actual pools use instance fields maxCoins/maxRings/maxBalloons
const _MAX_COINS = MAX_COINS_BASE;
const _MAX_RINGS = MAX_RINGS_BASE;
const _MAX_BALLOONS = MAX_BALLOONS_BASE;
const MAX_COINS = _MAX_COINS;
const MAX_RINGS = _MAX_RINGS;
const MAX_BALLOONS = _MAX_BALLOONS;
// Keep TS happy — these legacy names are imported by tests
void MAX_COINS;
void MAX_RINGS;
void MAX_BALLOONS;
const BALLOON_COLORS = [0xff6b6b, 0xffc14a, 0x6ad8ff, 0xb18cff, 0x7fe8a0];
const coinDummy = new THREE.Object3D();

const CLOUD_TINT: Record<CloudKind, string> = {
  plain: "255,255,255",
  boost: "196,240,255",
  golden: "255,226,150",
  wind: "205,255,232",
  super: "228,206,255",
};

export class Collectibles {
  readonly group = new THREE.Group();
  private readonly coinPool: Coin[] = [];
  private readonly cloudPool: Cloud[] = [];
  private readonly pickupPool: Pickup[] = [];
  private readonly activeCoins: Coin[] = [];
  private readonly activeClouds: Cloud[] = [];
  private readonly activePickups: Pickup[] = [];
  private readonly coinGeo: THREE.CylinderGeometry;
  private readonly gemGeo: THREE.OctahedronGeometry;
  private readonly coinMat: THREE.MeshLambertMaterial;
  private readonly gemMat: THREE.MeshLambertMaterial;
  private readonly coinMesh: THREE.InstancedMesh;
  private readonly gemMesh: THREE.InstancedMesh;
  private coinCursor = 0;
  private gemCursor = 0;
  private readonly pickupGeo: THREE.IcosahedronGeometry;
  private readonly pickupMats = new Map<PickupKind, THREE.MeshLambertMaterial>();
  private readonly cloudTex = new Map<CloudKind, THREE.CanvasTexture>();
  private readonly ringPool: Ring[] = [];
  private readonly activeRings: Ring[] = [];
  private readonly ringGeo: THREE.TorusGeometry;
  private readonly ringMat: THREE.MeshLambertMaterial;
  private readonly ringMesh: THREE.InstancedMesh;
  private ringCursor = 0;
  private readonly balloonPool: Balloon[] = [];
  private readonly activeBalloons: Balloon[] = [];
  private readonly balloonMats: THREE.MeshLambertMaterial[] = [];
  private readonly knotMat: THREE.MeshLambertMaterial;
  private readonly seedN: number;
  private readonly seedStr: string;
  private spawnedUntil = -1;
  private layer = 0;
  /** X position of the most-recently spawned ring course, used to enforce a
   *  minimum gap between courses so they never visually overlap. */
  private lastRingCourseX = -Infinity;
  private readonly qualityTier: "lite" | "mid" | "high";
  private maxCoins: number;
  private maxRings: number;
  private maxBalloons: number;

  constructor(seedN: number, seedStr = String(seedN), qualityTier: "lite" | "mid" | "high" = "high") {
    this.seedN = seedN;
    this.seedStr = seedStr;
    this.qualityTier = qualityTier;
    void this.qualityTier;
    // Performance: lite = fewer coins/rings/balloons
    this.maxCoins = qualityTier === "lite" ? 384 : qualityTier === "mid" ? 448 : MAX_COINS_BASE;
    this.maxRings = qualityTier === "lite" ? 80 : qualityTier === "mid" ? 100 : MAX_RINGS_BASE;
    this.maxBalloons = qualityTier === "lite" ? 16 : qualityTier === "mid" ? 20 : MAX_BALLOONS_BASE;
    this.coinGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 12);
    this.gemGeo = new THREE.OctahedronGeometry(0.95, 0);
    this.coinMat = new THREE.MeshLambertMaterial({ color: 0xffd24a, emissive: 0x553300 });
    this.gemMat = new THREE.MeshLambertMaterial({ color: 0x9ae8ff, emissive: 0x1a5a8a, flatShading: true });
    // Hundreds of coin meshes are one of the largest draw-call costs. Coins
    // and sky gems each share an InstancedMesh, while their collision data is
    // still independent in the lightweight Coin records below.
    this.coinMesh = new THREE.InstancedMesh(this.coinGeo, this.coinMat, this.maxCoins);
    this.gemMesh = new THREE.InstancedMesh(this.gemGeo, this.gemMat, MAX_GEMS);
    this.coinMesh.count = 0;
    this.gemMesh.count = 0;
    this.coinMesh.frustumCulled = false;
    this.gemMesh.frustumCulled = false;
    this.group.add(this.coinMesh, this.gemMesh);
    this.coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.gemMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    uploadDensePrefix(this.coinMesh.instanceMatrix, this.coinMesh.count);
    uploadDensePrefix(this.gemMesh.instanceMatrix, this.gemMesh.count);
    this.pickupGeo = new THREE.IcosahedronGeometry(0.85, 0);
    for (const k of Object.keys(PICKUP_STYLE) as PickupKind[]) {
      const s = PICKUP_STYLE[k];
      this.pickupMats.set(k, new THREE.MeshLambertMaterial({ color: s.color, emissive: s.emissive, flatShading: true }));
    }
    for (const k of Object.keys(CLOUD_TINT) as CloudKind[]) this.cloudTex.set(k, makeCloudTexture(CLOUD_TINT[k]));

    // Sky rings: floating hoops on the high line. A torus is created in the
    // XY plane; rotating it about Y turns the hole to face the bird's +x
    // heading so every instance reads as a gate to thread.
    this.ringGeo = new THREE.TorusGeometry(4.4, 0.34, 10, 44);
    this.ringGeo.rotateY(Math.PI / 2);
    this.ringMat = new THREE.MeshLambertMaterial({ color: 0xffcf3e, emissive: 0x7a4200 });
    this.ringMesh = new THREE.InstancedMesh(this.ringGeo, this.ringMat, this.maxRings);
    this.ringMesh.count = 0;
    this.ringMesh.frustumCulled = false;
    this.group.add(this.ringMesh);
    this.ringMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    uploadDensePrefix(this.ringMesh.instanceMatrix, this.ringMesh.count);

    this.knotMat = new THREE.MeshLambertMaterial({ color: 0x7a4a20 });
    for (const c of BALLOON_COLORS) {
      this.balloonMats.push(new THREE.MeshLambertMaterial({ color: c, emissive: 0x1a0a00 }));
    }
  }

  /** Render layer, so split-screen players only see their own pickups. */
  setLayer(layer: number): void {
    this.layer = layer;
    this.group.traverse((o) => o.layers.set(layer));
  }

  reset(): void {
    this.spawnedUntil = -1;
    this.lastRingCourseX = -Infinity;
    this.coinMesh.count = this.gemMesh.count = this.ringMesh.count = 0;
    for (const c of this.activeCoins) {
      c.taken = true;
    }
    uploadDensePrefix(this.coinMesh.instanceMatrix, this.coinMesh.count);
    uploadDensePrefix(this.gemMesh.instanceMatrix, this.gemMesh.count);
    for (const c of this.activeClouds) {
      c.taken = true;
      c.sprite.visible = false;
    }
    for (const p of this.activePickups) {
      p.taken = true;
      p.mesh.visible = false;
    }
    for (const r of this.activeRings) {
      r.taken = true;
    }
    for (const b of this.activeBalloons) {
      b.taken = true;
      b.root.visible = false;
    }
    uploadDensePrefix(this.ringMesh.instanceMatrix, this.ringMesh.count);
    this.activeCoins.length = 0;
    this.activeClouds.length = 0;
    this.activePickups.length = 0;
    this.activeRings.length = 0;
    this.activeBalloons.length = 0;
  }

  update(dt: number, bird: Bird, terrain: TerrainSystem, magnetOn: boolean, time: number, magnetScale: number, ev: CollectEvents): void {
    // Spawn complete cells exactly once. The old fractional boundary rounded
    // DOWN inside spawnRange, re-creating the last cell on every physics tick.
    const ahead = Math.ceil((bird.x + 420) / SPAWN_CELL) * SPAWN_CELL;
    if (ahead > this.spawnedUntil) {
      this.spawnRange(Math.max(this.spawnedUntil, bird.x - 20), ahead, terrain);
      this.spawnedUntil = ahead;
    }

    this.coinMesh.count = this.gemMesh.count = 0;
    const magnet = magnetOn ? MAGNET_RADIUS * magnetScale : MAGNET_RADIUS_NORMAL;
    for (let i = this.activeCoins.length - 1; i >= 0; i--) {
      const c = this.activeCoins[i]!;
      if (c.taken || c.x < bird.x - 30) {
        c.taken = true;
        this.activeCoins.splice(i, 1);
        continue;
      }
      const dx = bird.x - c.x;
      const dy = bird.y - c.y;
      const d = Math.hypot(dx, dy);
      if (d < magnet && d > 0.01) {
        const pull = magnetOn ? 52 * magnetScale : 18;
        c.x += (dx / d) * pull * dt;
        c.y += (dy / d) * pull * dt;
      }
      if (d < (c.gem ? 2.4 : 1.7)) {
        c.taken = true;
        this.activeCoins.splice(i, 1);
        ev.onCoin(c.x, c.y, c.gem);
        continue;
      }
      const mesh = c.gem ? this.gemMesh : this.coinMesh;
      this.writeCoin(c, time, mesh.count++);
    }
    uploadDensePrefix(this.coinMesh.instanceMatrix, this.coinMesh.count);
    uploadDensePrefix(this.gemMesh.instanceMatrix, this.gemMesh.count);

    for (let i = this.activeClouds.length - 1; i >= 0; i--) {
      const c = this.activeClouds[i]!;
      if (c.taken || c.x < bird.x - 60) {
        c.taken = true;
        c.sprite.visible = false;
        this.activeClouds.splice(i, 1);
        continue;
      }
      c.phase += dt;
      c.x += c.drift * dt;
      c.sprite.position.set(c.x, c.y + Math.sin(c.phase) * 0.6, c.z);
      if (c.kind !== "plain") {
        const p = 1 + Math.sin(c.phase * 2.4) * 0.05;
        c.sprite.scale.set(9.6 * p, 4.6 * p, 1);
      }
      if (Math.hypot(bird.x - c.x, bird.y - c.y) < 3.8 && Math.abs(c.z) < 8) {
        c.taken = true;
        c.sprite.visible = false;
        this.activeClouds.splice(i, 1);
        ev.onCloud(c.kind, c.x, c.y);
      }
    }

    for (let i = this.activePickups.length - 1; i >= 0; i--) {
      const p = this.activePickups[i]!;
      if (p.taken || p.x < bird.x - 30) {
        p.taken = true;
        p.mesh.visible = false;
        this.activePickups.splice(i, 1);
        continue;
      }
      p.phase += dt;
      p.mesh.position.set(p.x, p.y + Math.sin(p.phase * 2.2) * 0.35, 0);
      p.mesh.rotation.y += dt * 1.8;
      p.mesh.rotation.x += dt * 0.9;
      p.mesh.scale.setScalar(1 + Math.sin(p.phase * 4) * 0.08);
      if (Math.hypot(bird.x - p.x, bird.y - p.y) < 2.6) {
        p.taken = true;
        p.mesh.visible = false;
        this.activePickups.splice(i, 1);
        ev.onPickup(p.kind, p.x, p.y);
      }
    }

    this.ringMesh.count = 0;
    for (let i = this.activeRings.length - 1; i >= 0; i--) {
      const r = this.activeRings[i]!;
      if (r.taken || r.x < bird.x - 40) {
        r.taken = true;
        this.activeRings.splice(i, 1);
        continue;
      }
      // Threading the gate: crossing the ring's plane while inside its radius.
      if (Math.abs(bird.x - r.x) < 2.2 && Math.abs(bird.y - r.y) < r.r - 0.4) {
        r.taken = true;
        this.activeRings.splice(i, 1);
        ev.onRing(r.x, r.y);
      } else this.writeRing(r, time, this.ringMesh.count++);
    }
    uploadDensePrefix(this.ringMesh.instanceMatrix, this.ringMesh.count);

    for (let i = this.activeBalloons.length - 1; i >= 0; i--) {
      const b = this.activeBalloons[i]!;
      if (b.taken || b.x < bird.x - 40) {
        b.taken = true;
        b.root.visible = false;
        this.activeBalloons.splice(i, 1);
        continue;
      }
      b.phase += dt;
      b.x += b.drift * dt;
      b.root.position.set(b.x, b.y + Math.sin(b.phase * 1.4) * 1.1, 0);
      b.root.rotation.z = Math.sin(b.phase * 0.9) * 0.06;
      // Pop on contact — a soft reward that launches you back into the sky.
      if (Math.hypot(bird.x - b.x, bird.y - b.y) < 4.4) {
        b.taken = true;
        b.root.visible = false;
        this.activeBalloons.splice(i, 1);
        ev.onBalloon(b.x, b.y);
      }
    }
  }

  dispose(): void {
    this.coinMesh.dispose();
    this.gemMesh.dispose();
    this.ringMesh.dispose();
    this.coinGeo.dispose();
    this.gemGeo.dispose();
    this.coinMat.dispose();
    this.gemMat.dispose();
    this.pickupGeo.dispose();
    for (const m of this.pickupMats.values()) m.dispose();
    for (const t of this.cloudTex.values()) t.dispose();
    for (const c of this.cloudPool) (c.sprite.material as THREE.Material).dispose();
    this.ringGeo.dispose();
    this.ringMat.dispose();
    for (const b of this.balloonPool) {
      b.root.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    }
    for (const m of this.balloonMats) m.dispose();
    this.knotMat.dispose();
  }

  /* --------------------------------------------------------------- spawning */

  /**
   * Coins are never scattered — they are laid along the line a good player
   * would fly, so following them teaches the ideal trajectory:
   *   • lines hugging a downhill (dive here)
   *   • arcs leaping off a crest (release here)
   *   • tall arcs above big ramps tracing a perfect launch
   *   • rare gems parked in the cloud layers as a reward for flying high
   */
  private spawnRange(x0: number, x1: number, terrain: TerrainSystem): void {
    const step = SPAWN_CELL;
    const start = Math.ceil(x0 / step) * step;
    for (let x = start; x < x1; x += step) {
      if (x < 40 || terrain.isOcean(x)) continue;
      const cell = Math.floor(x / step);
      const rng = new SeededRandom(`${this.seedStr}:c:${cell}`);
      const slope = terrain.slopeAt(x);
      const curv = terrain.curvatureAt(x);
      const hh = terrain.heightAt(x);
      const lx = terrain.localX(x);
      const inRampZone = lx > RAMP_START - 30;

      // A crest: curvature convex and slope rolling from up to down.
      const isCrest = curv > 0.004 && Math.abs(slope) < 0.35;
      // A steep downhill — the place you want to be holding.
      const isDive = slope < -0.34;
      // A launch ramp — steep upslope heading toward a lip.
      const isRamp = slope > 0.42;

      if (isDive && !inRampZone && rng.next() < 0.92) {
        // follow the slope: dense line teaching dive
        for (let i = 0; i < 6; i++) {
          const cx = x + i * 4.2;
          this.placeCoin(cx, terrain.heightAt(cx) + 2.2, false);
        }
      } else if (isRamp && rng.next() < 0.94) {
        // trace the launch arc off the lip — 8 coins, longer arc
        const v = 54;
        const ang = Math.atan(terrain.slopeAt(x + 12));
        for (let i = 1; i <= 8; i++) {
          const t = i * 0.13;
          const cx = x + 12 + Math.cos(ang) * v * t;
          const cy = terrain.heightAt(x + 12) + 2 + Math.sin(ang) * v * t - 0.5 * 28 * t * t;
          if (cy > terrain.heightAt(cx) + 1.2) this.placeCoin(cx, cy, false);
        }
      } else if (isCrest && rng.next() < 0.68) {
        // hop arc over crest — 6 coins, more visible
        for (let i = 0; i < 6; i++) {
          const cx = x - 8 + i * 3.8;
          const bump = Math.sin((i / 5) * Math.PI) * 5.5;
          this.placeCoin(cx, terrain.heightAt(cx) + 2.4 + bump, false);
        }
      }

      // Sky rewards: gems and clouds live where only a good launch reaches.
      if (rng.next() < 0.5) {
        const tier = rng.next();
        const alt = tier < 0.55 ? ALT_SKY : tier < 0.86 ? ALT_CLOUDS : ALT_HIGH;
        const jitter = rng.range(-14, 22);
        const z = rng.range(-18, 12);
        this.placeCloud(this.pickCloudKind(rng, alt), x + rng.range(-10, 10), hh + alt + jitter, rng.next() * 6, rng.range(-1.5, 1.5), z);
      }
      if (rng.next() < 0.13) {
        const alt = rng.next() < 0.5 ? ALT_CLOUDS : ALT_HIGH;
        this.placeCoin(x + rng.range(-6, 6), hh + alt + rng.range(0, 30), true);
      }

      // Sky rings — COURSES every ~90m, 4-7 hoops, so long air has objectives.
      // V2 anti-bore: 18%→28% spawn, gap 130→85, 4-6→4-7 hoops, 30→26 spacing.
      const courseGap = x - this.lastRingCourseX > 85;
      if (courseGap && rng.next() < 0.28) {
        this.lastRingCourseX = x;
        const count = 4 + Math.floor(rng.next() * 4); // 4–7 hoops
        const shape = rng.next();
        const climb = shape < 0.34 ? 2.2 : shape < 0.68 ? -2.6 : 0.2;
        const phase = rng.next() * Math.PI * 2;
        const startY = terrain.heightAt(x) + 14 + rng.range(0, 12);
        for (let i = 0; i < count; i++) {
          const rx = x + i * 26 + rng.range(-2, 2);
          const roll = Math.sin(phase + i * 0.9) * 2.4;
          const ry = Math.max(terrain.heightAt(rx) + 6, startY + climb * i + roll);
          this.placeRing(rx, ry, 4.4);
        }
      }

      // Balloons: more frequent — pop for huge bounce, breaks long glides.
      if (rng.next() < 0.11) {
        const alt = ALT_CLOUDS + rng.range(-8, 32);
        this.placeBalloon(x + rng.range(-12, 12), hh + alt, rng.next() * 6, rng.range(-1.2, 1.2));
      }

      // Extra coin arcs in air — give glides purpose.
      if (!inRampZone && rng.next() < 0.22 && terrain.heightAt(x) > 5) {
        const arcH = 4 + rng.next() * 6;
        for (let i = 0; i < 4; i++) {
          const cx = x + i * 5;
          const cy = hh + 6 + Math.sin((i / 3) * Math.PI) * arcH;
          if (cy > terrain.heightAt(cx) + 2) this.placeCoin(cx, cy, false);
        }
      }

      // Power-ups sit on crests and just past ramps so they reward good lines.
      if (!inRampZone && x > 150) {
        const r = rng.next();
        if (isCrest && r < 0.16) this.placePickup(this.pickPowerup(rng), x, hh + 3.2);
        else if (isRamp && r > 0.93) this.placePickup("rocket", x + 16, hh + 14);
        else if (r > 0.985) this.placePickup("sun", x, hh + 3);
      }
      if (lx > 700 && lx < RAMP_START && rng.next() < 0.06) this.placePickup("shield", x, hh + 3);
    }

    // Opening run: a friendly coin line teaching dive-then-release.
    if (this.spawnedUntil < 0) {
      for (let i = 0; i < 10; i++) {
        const x = 80 + i * 9;
        this.placeCoin(x, terrain.heightAt(x) + 2.3, false);
      }
    }
  }

  private pickCloudKind(rng: SeededRandom, alt: number): CloudKind {
    const r = rng.next();
    const high = alt >= ALT_HIGH;
    if (high) {
      if (r < 0.3) return "super";
      if (r < 0.6) return "golden";
      if (r < 0.8) return "wind";
      return "boost";
    }
    if (r < 0.1) return "golden";
    if (r < 0.24) return "boost";
    if (r < 0.34) return "wind";
    return "plain";
  }

  private pickPowerup(rng: SeededRandom): PickupKind {
    const pool: PickupKind[] = [
      "longglide",
      "wingboost",
      "magnet",
      "feather",
      "cloudboost",
      "longglide",
      "wingboost",
      "goldenwings",
    ];
    return pool[rng.int(0, pool.length)]!;
  }

  private placeCoin(x: number, y: number, gem: boolean): void {
    const coin = this.allocCoin(gem);
    if (coin.slot < 0) return;
    coin.x = x;
    coin.y = y;
    coin.gem = gem;
    coin.taken = false;
    this.writeCoin(coin, 0);
    this.activeCoins.push(coin);
  }

  private placeCloud(kind: CloudKind, x: number, y: number, phase: number, drift: number, z = -2): void {
    const cloud = this.allocCloud(kind);
    cloud.kind = kind;
    cloud.x = x;
    cloud.y = y;
    cloud.z = z;
    cloud.phase = phase;
    cloud.drift = drift;
    cloud.taken = false;
    cloud.sprite.material.map = this.cloudTex.get(kind)!;
    cloud.sprite.material.needsUpdate = true;
    cloud.sprite.scale.set(kind === "plain" ? 9.2 : 9.6, kind === "plain" ? 4.4 : 4.6, 1);
    cloud.sprite.visible = true;
    cloud.sprite.position.set(x, y, z);
    this.activeClouds.push(cloud);
  }

  private placePickup(kind: PickupKind, x: number, y: number): void {
    const p = this.allocPickup(kind);
    p.x = x;
    p.y = y;
    p.phase = hash01(Math.floor(x), this.seedN) * 6;
    p.taken = false;
    p.mesh.visible = true;
    p.mesh.position.set(x, y, 0);
    this.activePickups.push(p);
  }

  private allocCoin(gem: boolean): Coin {
    const idle = this.coinPool.find((c) => c.taken && c.gem === gem);
    if (idle) return idle;
    const slot = gem ? this.gemCursor++ : this.coinCursor++;
    if (slot >= (gem ? MAX_GEMS : this.maxCoins)) {
      // Pool pressure only occurs far behind the camera. Reuse an old inactive
      // visual slot rather than allocating a new draw call.
      const fallback = this.coinPool.find((c) => c.gem === gem && c.taken);
      if (fallback) return fallback;
      return { x: 0, y: -9999, taken: true, gem, slot: -1 };
    }
    const coin: Coin = { x: 0, y: 0, taken: true, gem, slot };
    this.coinPool.push(coin);
    return coin;
  }

  private writeCoin(c: Coin, time: number, slot = c.slot): void {
    if (c.slot < 0) return;
    const mesh = c.gem ? this.gemMesh : this.coinMesh;
    coinDummy.position.set(c.x, c.y + Math.sin(time * 5 + c.x * 0.35) * 0.22, 0);
    coinDummy.rotation.set(c.gem ? time * 0.8 : 0, c.gem ? time * 1.6 : time * 3.2, c.gem ? time * 0.45 : Math.PI / 2);
    coinDummy.scale.setScalar(1);
    coinDummy.updateMatrix();
    mesh.setMatrixAt(slot, coinDummy.matrix);
  }

  private placeRing(x: number, y: number, r: number): void {
    const ring = this.allocRing();
    if (ring.slot < 0) return;
    ring.x = x;
    ring.y = y;
    ring.r = r;
    ring.taken = false;
    this.writeRing(ring, 0);
    this.activeRings.push(ring);
  }

  private allocRing(): Ring {
    const idle = this.ringPool.find((r) => r.taken);
    if (idle) return idle;
    const slot = this.ringCursor++;
    if (slot >= this.maxRings) {
      const fallback = this.ringPool.find((r) => r.taken);
      if (fallback) return fallback;
      return { x: 0, y: -9999, r: 4.4, taken: true, slot: -1 };
    }
    const ring: Ring = { x: 0, y: 0, r: 4.4, taken: true, slot };
    this.ringPool.push(ring);
    return ring;
  }

  private writeRing(r: Ring, time: number, slot = r.slot): void {
    if (r.slot < 0) return;
    const pulse = 1 + Math.sin(time * 3 + r.x * 0.2) * 0.06;
    coinDummy.position.set(r.x, r.y, 0);
    coinDummy.rotation.set(0, 0, 0);
    coinDummy.scale.setScalar(pulse);
    coinDummy.updateMatrix();
    this.ringMesh.setMatrixAt(slot, coinDummy.matrix);
  }

  private placeBalloon(x: number, y: number, phase: number, drift: number): void {
    // Hard cap keeps the balloon pool bounded even under dense spawn windows.
    if (this.activeBalloons.length >= this.maxBalloons) return;
    const b = this.allocBalloon();
    b.x = x;
    b.y = y;
    b.phase = phase;
    b.drift = drift;
    b.taken = false;
    b.root.visible = true;
    b.root.position.set(x, y, 0);
    this.activeBalloons.push(b);
  }

  private allocBalloon(): Balloon {
    const idle = this.balloonPool.find((b) => b.taken || !b.root.visible);
    if (idle) return idle;
    const root = new THREE.Group();
    const mat = this.balloonMats[this.balloonPool.length % this.balloonMats.length]!;
    const body = new THREE.Mesh(new THREE.SphereGeometry(2.1, 14, 12), mat);
    body.position.y = 2.1;
    body.castShadow = true;
    const knot = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.8, 6), this.knotMat);
    knot.rotation.x = Math.PI;
    knot.position.y = 0.4;
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 5, 5), this.knotMat);
    string.position.y = -2.3;
    root.add(body, knot, string);
    root.traverse((o) => o.layers.set(this.layer));
    this.group.add(root);
    const b: Balloon = { x: 0, y: 0, taken: true, root, phase: 0, drift: 0 };
    this.balloonPool.push(b);
    return b;
  }

  private allocCloud(kind: CloudKind): Cloud {
    const idle = this.cloudPool.find((c) => c.taken || !c.sprite.visible);
    if (idle) return idle;
    const mat = new THREE.SpriteMaterial({ map: this.cloudTex.get(kind)!, transparent: true, depthWrite: false, opacity: 0.94 });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(9.2, 4.4, 1);
    sprite.layers.set(this.layer);
    this.group.add(sprite);
    const cloud: Cloud = { kind, x: 0, y: 0, z: -2, taken: false, sprite, phase: 0, drift: 0 };
    this.cloudPool.push(cloud);
    return cloud;
  }

  private allocPickup(kind: PickupKind): Pickup {
    const idle = this.pickupPool.find((p) => (p.taken || !p.mesh.visible) && p.kind === kind);
    if (idle) return idle;
    const mesh = new THREE.Mesh(this.pickupGeo, this.pickupMats.get(kind)!);
    mesh.layers.set(this.layer);
    this.group.add(mesh);
    const p: Pickup = { kind, x: 0, y: 0, taken: false, mesh, phase: 0 };
    this.pickupPool.push(p);
    return p;
  }
}

function makeCloudTexture(tint: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 256, 128);
  const blobs: [number, number, number][] = [
    [110, 72, 50],
    [150, 68, 44],
    [78, 74, 38],
    [180, 78, 34],
    [128, 50, 36],
  ];
  for (const [x, y, r] of blobs) {
    const grd = g.createRadialGradient(x, y, 4, x, y, r);
    grd.addColorStop(0, `rgba(${tint},0.96)`);
    grd.addColorStop(0.6, `rgba(${tint},0.56)`);
    grd.addColorStop(1, `rgba(${tint},0)`);
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
