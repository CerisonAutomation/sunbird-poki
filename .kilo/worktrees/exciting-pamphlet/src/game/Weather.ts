import * as THREE from "three";
import { ISLAND_PERIOD, RAMP_START } from "./constants";
import { hash01, lerp } from "./math";
import type { Bird } from "./Bird";
import type { TerrainSystem } from "./TerrainSystem";

export type WeatherEvents = {
  onThermalEnter: () => void;
  onGustStart: () => void;
  onStormHit: (x: number, y: number) => void;
};

type Thermal = { x: number; w: number; top: number; mesh: THREE.Mesh; active: boolean };
type Storm = { x: number; y: number; sprite: THREE.Sprite; active: boolean; cooldown: number };

/**
 * Biome hazards & helpers:
 *  - Thermals: shimmering columns that lift a gliding bird (release to ride).
 *  - Gusts: periodic headwinds in alpine/aurora (dive to punch through).
 *  - Ash storms: dark clouds on Ember Isle that sap speed (fly under them).
 */
export class Weather {
  readonly group = new THREE.Group();
  gust = 0; // 0..1 current headwind strength
  /** Storm Ward boost / weatherproof skins: gusts and ash storms barely touch the bird. */
  ward = false;
  /** Stealth skins: storms detect at half range, gusts push half as hard. */
  stealth = false;
  /** Weekly-event wind multiplier (Storm Surge doubles gust push). */
  windMult = 1;
  /** Stormfront Royale: every biome behaves like a storm biome — gusts fire
   *  everywhere and ash clouds spawn on every island. Same seed → identical
   *  gauntlet for the whole field. */
  stormfront = false;
  inThermal = false;
  private readonly thermals: Thermal[] = [];
  private readonly storms: Storm[] = [];
  private readonly thermalMat: THREE.ShaderMaterial;
  private readonly stormTex: THREE.CanvasTexture;
  private spawnedIsland = -1;
  private gustTimer = 6;
  private gustPhase: "calm" | "blowing" = "calm";
  private wasInThermal = false;
  private stormCd = 0;

  constructor(private readonly seedN: number) {
    this.thermalMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { time: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        void main(){
          float edge = smoothstep(0.0,0.25,vUv.x)*smoothstep(1.0,0.75,vUv.x);
          float rise = fract(vUv.y*4.0 - time*0.9);
          float band = smoothstep(0.0,0.3,rise)*smoothstep(1.0,0.6,rise);
          float top = 1.0 - smoothstep(0.7,1.0,vUv.y);
          float a = edge * (0.05 + band*0.12) * top;
          gl_FragColor = vec4(1.0,0.97,0.85,a);
        }
      `,
    });
    this.stormTex = makeStormTexture();
  }

  addTo(scene: THREE.Scene): void {
    scene.add(this.group);
  }

  reset(): void {
    this.ward = false;
    this.stealth = false;
    for (const t of this.thermals) {
      t.active = false;
      t.mesh.visible = false;
    }
    for (const s of this.storms) {
      s.active = false;
      s.sprite.visible = false;
    }
    this.spawnedIsland = -1;
    this.gust = 0;
    this.gustTimer = 6;
    this.gustPhase = "calm";
    this.inThermal = false;
    this.wasInThermal = false;
  }

  update(dt: number, time: number, bird: Bird, terrain: TerrainSystem, diving: boolean, ev: WeatherEvents): void {
    this.thermalMat.uniforms.time!.value = time;
    const island = terrain.islandIndex(bird.x + 300);
    for (let i = this.spawnedIsland + 1; i <= island; i++) this.spawnIsland(i, terrain);
    this.spawnedIsland = Math.max(this.spawnedIsland, island);

    const biome = terrain.biomeAt(bird.x);
    const airborne = !bird.grounded && !bird.inWater && !bird.asleep;

    // thermals
    this.inThermal = false;
    for (const t of this.thermals) {
      if (!t.active) continue;
      if (t.x < bird.x - 80) {
        t.active = false;
        t.mesh.visible = false;
        continue;
      }
      const inside = Math.abs(bird.x - t.x) < t.w * 0.5 && bird.y < t.top;
      if (inside && airborne) {
        this.inThermal = true;
        if (!diving) {
          // Stronger lift — thermals are the anti-bore: release to ride, not just float
          bird.vy += 32 * dt;
          bird.vx += 5 * dt;
          // Slight upward draft even when sinking fast
          if (bird.vy < 0) bird.vy += 18 * dt;
        } else {
          bird.vy += 8 * dt;
        }
      }
    }
    if (this.inThermal && !this.wasInThermal) ev.onThermalEnter();
    this.wasInThermal = this.inThermal;

    // gusts
    if (biome.hazard === "gust" || this.stormfront) {
      this.gustTimer -= dt;
      if (this.gustPhase === "calm" && this.gustTimer <= 0) {
        this.gustPhase = "blowing";
        this.gustTimer = 2.6 + hash01(Math.floor(bird.x), this.seedN) * 1.5;
        ev.onGustStart();
      } else if (this.gustPhase === "blowing" && this.gustTimer <= 0) {
        this.gustPhase = "calm";
        this.gustTimer = 7 + hash01(Math.floor(bird.x) + 3, this.seedN) * 6;
      }
      const target = this.gustPhase === "blowing" ? 1 : 0;
      this.gust = lerp(this.gust, target, 1 - Math.pow(0.02, dt));
      if (this.gust > 0.05 && airborne && !diving) bird.vx -= (this.ward ? 1.8 : 7.5) * (this.stealth ? 0.5 : 1) * this.windMult * this.gust * dt;
    } else {
      this.gust = lerp(this.gust, 0, 1 - Math.pow(0.02, dt));
      this.gustPhase = "calm";
    }

    // ash storms
    this.stormCd = Math.max(0, this.stormCd - dt);
    for (const s of this.storms) {
      if (!s.active) continue;
      if (s.x < bird.x - 60) {
        s.active = false;
        s.sprite.visible = false;
        continue;
      }
      s.sprite.position.y = s.y + Math.sin(time * 0.8 + s.x) * 0.5;
      const dx = Math.abs(bird.x - s.x);
      const dy = Math.abs(bird.y - s.y);
      const reach = this.stealth ? 0.5 : 1; // stealth birds slip under the cloud's radar
      if (dx < 5.2 * reach && dy < 2.6 * reach && this.stormCd <= 0) {
        this.stormCd = 1.2;
        bird.vx *= this.ward ? 0.95 : 0.78;
        if (!this.ward) bird.vy = Math.min(bird.vy, 2);
        ev.onStormHit(s.x, s.y);
      }
    }
  }

  dispose(): void {
    this.thermalMat.dispose();
    this.stormTex.dispose();
    for (const t of this.thermals) t.mesh.geometry.dispose();
    for (const s of this.storms) (s.sprite.material as THREE.Material).dispose();
  }

  private spawnIsland(island: number, terrain: TerrainSystem): void {
    const biome = terrain.biomeAt(island * ISLAND_PERIOD + 10);
    const base = island * ISLAND_PERIOD;
    const usable = RAMP_START - 120;
    for (let i = 0; i < biome.thermals; i++) {
      const r = hash01(island * 17 + i, this.seedN + 11);
      let x = base + 120 + ((i + 0.5) / biome.thermals) * usable + (r - 0.5) * 60;
      if (island === 0) x = Math.max(x, 330);
      // prefer just past a crest so a launch carries you into it
      for (let k = 0; k < 20; k++) {
        if (terrain.slopeAt(x) < -0.05) break;
        x += 3;
      }
      if (terrain.localX(x) > RAMP_START - 20) continue;
      const ground = terrain.heightAt(x);
      this.placeThermal(x, 11 + r * 6, ground + 40 + r * 14, ground);
    }
    // an extra thermal right before the ocean ramp on tough islands
    if (island >= 2) {
      const x = base + RAMP_START - 60;
      const ground = terrain.heightAt(x);
      this.placeThermal(x, 14, ground + 46, ground);
    }
    if (biome.hazard === "storm") {
      const n = 3 + Math.min(3, Math.floor(island / 5));
      for (let i = 0; i < n; i++) {
        const r = hash01(island * 31 + i, this.seedN + 23);
        const x = base + 160 + ((i + 0.5) / n) * (usable - 40) + (r - 0.5) * 50;
        if (terrain.localX(x) > RAMP_START - 30) continue;
        const ground = terrain.heightAt(x);
        this.placeStorm(x, ground + 14 + r * 12);
      }
    }
  }

  private placeThermal(x: number, w: number, top: number, ground: number): void {
    let t = this.thermals.find((th) => !th.active);
    if (!t) {
      const geo = new THREE.PlaneGeometry(1, 1);
      const mesh = new THREE.Mesh(geo, this.thermalMat);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      t = { x, w, top, mesh, active: true };
      this.thermals.push(t);
    }
    t.x = x;
    t.w = w;
    t.top = top;
    t.active = true;
    const h = top - ground;
    t.mesh.scale.set(w, h, 1);
    t.mesh.position.set(x, ground + h / 2, -1.5);
    t.mesh.visible = true;
  }

  private placeStorm(x: number, y: number): void {
    let s = this.storms.find((st) => !st.active);
    if (!s) {
      const mat = new THREE.SpriteMaterial({ map: this.stormTex, transparent: true, depthWrite: false, opacity: 0.95 });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(11, 5.4, 1);
      this.group.add(sprite);
      s = { x, y, sprite, active: true, cooldown: 0 };
      this.storms.push(s);
    }
    s.x = x;
    s.y = y;
    s.active = true;
    s.sprite.position.set(x, y, -0.5);
    s.sprite.visible = true;
  }
}

function makeStormTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const g = c.getContext("2d")!;
  const blobs: [number, number, number][] = [
    [110, 72, 50],
    [150, 68, 44],
    [78, 74, 38],
    [180, 78, 34],
    [128, 50, 36],
  ];
  for (const [x, y, r] of blobs) {
    const grd = g.createRadialGradient(x, y, 4, x, y, r);
    grd.addColorStop(0, "rgba(70,50,70,0.95)");
    grd.addColorStop(0.6, "rgba(50,35,55,0.6)");
    grd.addColorStop(1, "rgba(40,30,45,0)");
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // ember glints
  g.fillStyle = "rgba(255,120,40,0.9)";
  for (let i = 0; i < 12; i++) {
    g.beginPath();
    g.arc(60 + Math.random() * 140, 60 + Math.random() * 40, 1.5 + Math.random() * 1.5, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
