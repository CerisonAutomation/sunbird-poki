import { uploadDensePrefix } from "./bufferUpdates";
import * as THREE from "three";
import { clamp, lerp } from "./math";

type PType = "dust" | "spark" | "splash" | "confetti" | "wake";

type Particle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  r: number;
  g: number;
  b: number;
  type: PType;
};

const MAX = 700;

export class ParticleFX {
  readonly points: THREE.Points;
  private readonly particles: Particle[] = [];
  /** Free list of reusable Particle objects — no per-spawn allocation, so
   *  long-lived particles never churn V8's old generation (the #1 source of
   *  sawtooth GC jank in particle systems). */
  private readonly pool: Particle[] = [];
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly size: Float32Array;
  private readonly rings: THREE.Mesh[] = [];
  private budget = 1;
  private recycleSlot = 0;

  constructor() {
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 4);
    this.size = new Float32Array(MAX);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.col, 4));
    geo.setAttribute("size", new THREE.BufferAttribute(this.size, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float size;
        attribute vec4 color;
        varying vec4 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (280.0 / max(1.0, -mv.z));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec4 vColor;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float d = length(p);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.12, d) * vColor.a;
          gl_FragColor = vec4(vColor.rgb, a);
        }
      `,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    // Celebration FX may bloom around the bird, but never owns the focal layer.
    this.points.renderOrder = 40;

    for (let i = 0; i < 4; i++) {
      const ringGeo = new THREE.RingGeometry(0.6, 0.85, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xfff1a8,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(ringGeo, ringMat);
      mesh.renderOrder = 42;
      mesh.visible = false;
      this.rings.push(mesh);
    }
  }

  addTo(scene: THREE.Scene): void {
    scene.add(this.points);
    for (const r of this.rings) scene.add(r);
  }

  emitDust(x: number, y: number, speed: number, slope: number): void {
    const n = speed > 40 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      this.spawn({
        x: x - 0.4 + Math.random() * 0.6,
        y: y - 0.5,
        z: (Math.random() - 0.5) * 1.4,
        vx: -speed * 0.15 + (Math.random() - 0.5) * 3,
        vy: 1 + Math.random() * 3 - slope * 2,
        vz: (Math.random() - 0.5) * 2,
        life: 0.35 + Math.random() * 0.25,
        max: 0.5,
        size: 0.7 + Math.random() * 0.5,
        r: 0.78,
        g: 0.62,
        b: 0.38,
        type: "dust",
      });
    }
  }

  emitSparkle(x: number, y: number, r = 1, g = 0.85 + Math.random() * 0.15, b = 0.4): void {
    this.spawn({
      x,
      y,
      z: (Math.random() - 0.5) * 0.8,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
      vz: (Math.random() - 0.5) * 3,
      life: 0.4 + Math.random() * 0.3,
      max: 0.6,
      size: 0.45 + Math.random() * 0.35,
      r,
      g,
      b,
      type: "spark",
    });
  }

  /** Horizontal wind streaks for gusts (drift against travel direction). */
  emitWind(x: number, y: number, strength: number): void {
    this.spawn({
      x: x + 30 + Math.random() * 30,
      y: y - 10 + Math.random() * 26,
      z: (Math.random() - 0.5) * 8,
      vx: -40 - strength * 30,
      vy: (Math.random() - 0.5) * 2,
      vz: 0,
      life: 0.5,
      max: 0.5,
      size: 0.35,
      r: 0.9,
      g: 0.96,
      b: 1,
      type: "wake",
    });
  }

  /** Rising motes inside a thermal column. */
  emitThermal(x: number, y: number, w: number): void {
    this.spawn({
      x: x + (Math.random() - 0.5) * w,
      y,
      z: (Math.random() - 0.5) * 3,
      vx: 0,
      vy: 6 + Math.random() * 5,
      vz: 0,
      life: 1.1,
      max: 1.1,
      size: 0.3 + Math.random() * 0.25,
      r: 1,
      g: 0.95,
      b: 0.75,
      type: "wake",
    });
  }

  emitAsh(x: number, y: number): void {
    for (let i = 0; i < 12; i++) {
      this.spawn({
        x,
        y,
        z: (Math.random() - 0.5) * 3,
        vx: (Math.random() - 0.5) * 10,
        vy: -2 - Math.random() * 6,
        vz: (Math.random() - 0.5) * 4,
        life: 0.6,
        max: 0.6,
        size: 0.5,
        r: 0.35,
        g: 0.25,
        b: 0.3,
        type: "dust",
      });
    }
  }

  emitSplash(x: number, y: number): void {
    // Base spray column — droplets arc upward and fall back with gravity.
    for (let i = 0; i < 46; i++) {
      const a = (Math.random() - 0.5) * Math.PI * 1.5;
      const p = 8 + Math.random() * 18;
      const col = Math.random() < 0.3;
      this.spawn({
        x: x + (Math.random() - 0.5) * 1.8,
        y,
        z: (Math.random() - 0.5) * 4,
        vx: Math.sin(a) * p * 0.55,
        vy: Math.cos(a) * p * (0.55 + Math.random() * 0.6),
        vz: (Math.random() - 0.5) * 10,
        life: 0.65 + Math.random() * 0.6,
        max: 1.1,
        size: 0.7 + Math.random() * 1.1,
        r: col ? 0.55 : 0.75,
        g: col ? 0.82 : 0.92,
        b: 1,
        type: "splash",
      });
    }
    // Fine mist — smaller, lingers above the column.
    for (let i = 0; i < 16; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 3,
        y: y + 1 + Math.random() * 3,
        z: (Math.random() - 0.5) * 5,
        vx: (Math.random() - 0.5) * 6,
        vy: 4 + Math.random() * 8,
        vz: (Math.random() - 0.5) * 4,
        life: 0.7 + Math.random() * 0.5,
        max: 1.1,
        size: 0.35 + Math.random() * 0.35,
        r: 0.85,
        g: 0.95,
        b: 1,
        type: "wake",
      });
    }
  }

  /**
   * Confetti burst. `scale` (0..1) is the celebration's loudness: a lifetime
   * rank-up or a personal best gets the full 40 flakes, a mastery level-up gets
   * a third of them, so the particles say what the audio says.
   */
  emitConfetti(x: number, y: number, scale = 1): void {
    const count = Math.max(6, Math.round(40 * (Number.isFinite(scale) ? Math.min(1, Math.max(0, scale)) : 1)));
    const colors = [
      [1, 0.45, 0.3],
      [1, 0.85, 0.3],
      [0.4, 0.85, 1],
      [0.5, 1, 0.55],
      [1, 0.5, 0.8],
    ];
    for (let i = 0; i < count; i++) {
      const c = colors[i % colors.length]!;
      this.spawn({
        x,
        y,
        z: (Math.random() - 0.5) * 4,
        vx: (Math.random() - 0.5) * 18,
        vy: 6 + Math.random() * 16,
        vz: (Math.random() - 0.5) * 10,
        life: 0.9 + Math.random() * 0.6,
        max: 1.3,
        size: 0.5 + Math.random() * 0.5,
        r: c[0],
        g: c[1],
        b: c[2],
        type: "confetti",
      });
    }
  }

  emitCollect(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      this.spawn({
        x,
        y,
        z: 0,
        vx: (Math.random() - 0.5) * 8,
        vy: 2 + Math.random() * 8,
        vz: (Math.random() - 0.5) * 4,
        life: 0.3,
        max: 0.3,
        size: 0.4,
        r: 1,
        g: 0.84,
        b: 0.25,
        type: "spark",
      });
    }
  }


  emitWingTrails(x: number, y: number, speed: number): void {
    if (this.budget < 0.5) return;
    const a = Math.min(1, speed / 80);
    this.spawn({
      x: x - 0.6,
      y: y + 0.15,
      z: 0.5,
      vx: -speed * 0.2,
      vy: (Math.random() - 0.5) * 1.5,
      vz: 0.8,
      life: 0.24,
      max: 0.24,
        size: 0.5 * a,
      r: 0.9,
      g: 0.95,
      b: 1.0,
      type: "wake",
    });
    this.spawn({
      x: x - 0.6,
      y: y + 0.15,
      z: -0.5,
      vx: -speed * 0.2,
      vy: (Math.random() - 0.5) * 1.5,
      vz: -0.8,
      life: 0.24,
      max: 0.24,
      size: 0.35 * a,
      r: 0.9,
      g: 0.95,
      b: 1.0,
      type: "wake",
    });
  }

  /** Hard thud landing — biome-colored radial splat with upward debris spray.
   *  26 particles mirroring the reference game's 'thud' burst, replacing the
   *  plain emitDust call so bad landings read as a cinematic impact. */
  emitThunk(x: number, y: number, r: number, g: number, b: number): void {
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2;
      const s = 14 + Math.random() * 8;
      const upBias = 8 + Math.random() * 6;
      this.spawn({
        x: x + (Math.random() - 0.5) * 1.5,
        y: y + 0.5,
        z: (Math.random() - 0.5) * 3,
        vx: Math.cos(a) * s,
        vy: Math.abs(Math.sin(a)) * s * 0.6 + upBias,
        vz: (Math.random() - 0.5) * s * 0.4,
        life: 0.85 + Math.random() * 0.5,
        max: 1.2,
        size: 0.95 + Math.random() * 0.8,
        r: r * (0.75 + Math.random() * 0.2),
        g: g * (0.75 + Math.random() * 0.2),
        b: b * (0.75 + Math.random() * 0.2),
        type: "splash",
      });
    }
    this.burstRing(x, y + 0.5, 0xc8a87e);
  }

  /** Scaled perfect-launch burst — replaces the sparkle loop.
   *  chain = launch combo; more chain → more particles and faster speed. */
  emitPerfectBurst(x: number, y: number, chain: number): void {
    const n = 14 + Math.min(16, chain * 2);
    const speed = 22 + chain * 1.5;
    const gold = chain >= 3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const s = speed * (0.5 + Math.random() * 0.65);
      const upBias = 10 + Math.random() * 6;
      this.spawn({
        x,
        y: y + 1,
        z: (Math.random() - 0.5) * 2.5,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s * 0.5 + upBias,
        vz: (Math.random() - 0.5) * s * 0.3,
        life: 0.55 + Math.random() * 0.4,
        max: 0.85,
        size: 0.45 + Math.random() * 0.45,
        r: gold ? 1.0 : 1.0,
        g: gold ? 0.88 + Math.random() * 0.12 : 0.95,
        b: gold ? 0.35 + Math.random() * 0.2 : 1.0,
        type: "spark",
      });
    }
  }

  /** Shield water bounce — big cinematic splash column. Blue/white upward spray
   *  with much more energy than the regular ocean splash. */
  emitWaterBounce(x: number, y: number): void {
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * Math.PI * 2;
      const upward = Math.random() < 0.7;
      const p = upward ? 12 + Math.random() * 22 : 6 + Math.random() * 10;
      this.spawn({
        x: x + (Math.random() - 0.5) * 2,
        y,
        z: (Math.random() - 0.5) * 4,
        vx: Math.cos(a) * p * (upward ? 0.35 : 0.8),
        vy: upward ? Math.abs(Math.sin(a)) * p + 14 : Math.sin(a) * p * 0.3,
        vz: (Math.random() - 0.5) * 10,
        life: 0.55 + Math.random() * 0.5,
        max: 0.9,
        size: 0.55 + Math.random() * 0.7,
        r: 0.65 + Math.random() * 0.25,
        g: 0.88 + Math.random() * 0.1,
        b: 1.0,
        type: "splash",
      });
    }
    this.burstRing(x, y + 1, 0x7fe8ff);
    this.burstRing(x, y + 3, 0xbfffff);
  }

  /** Generic powerup bounce BOP — energetic upward burst, color-matched to the
   *  source (sunflower=gold, balloon=pink, shield=cyan). */
  emitBounceBop(x: number, y: number, r: number, g: number, b: number): void {
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const s = 18 + Math.random() * 12;
      this.spawn({
        x: x + (Math.random() - 0.5) * 1.5,
        y: y + 0.5,
        z: (Math.random() - 0.5) * 3,
        vx: Math.cos(a) * s * 0.6,
        vy: Math.abs(Math.sin(a)) * s + 12,
        vz: (Math.random() - 0.5) * 6,
        life: 0.5 + Math.random() * 0.35,
        max: 0.75,
        size: 0.5 + Math.random() * 0.55,
        r,
        g,
        b,
        type: "confetti",
      });
    }
  }

  /** Fever entry explosion — 44 gold particles, large and energetic, filling
   *  the screen with warmth. Mirrors the reference game's feverStart burst. */
  emitFeverBurst(x: number, y: number): void {
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * Math.PI * 2;
      const s = 28 + Math.random() * 12;
      this.spawn({
        x,
        y: y + 1,
        z: (Math.random() - 0.5) * 5,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s * 0.6 + 6,
        vz: (Math.random() - 0.5) * s * 0.4,
        life: 0.8 + Math.random() * 0.5,
        max: 1.1,
        size: 0.55 + Math.random() * 0.55,
        r: 1.0,
        g: 0.72 + Math.random() * 0.2,
        b: 0.25 + Math.random() * 0.2,
        type: "spark",
      });
    }
  }

  /** Colorful pickup activation burst — replaces plain emitCollect for power-up
   *  pickups so activating a power-up feels distinct from collecting a coin. */
  emitPickup(x: number, y: number, r: number, g: number, b: number): void {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const s = 10 + Math.random() * 8;
      this.spawn({
        x,
        y,
        z: (Math.random() - 0.5) * 2,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s + 4,
        vz: (Math.random() - 0.5) * 4,
        life: 0.35 + Math.random() * 0.2,
        max: 0.5,
        size: 0.4 + Math.random() * 0.4,
        r,
        g,
        b,
        type: "spark",
      });
    }
    this.burstRing(x, y, (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255));
  }

  emitSonicBoom(x: number, y: number): void {
    this.burstRing(x, y, 0xffffff);
    this.burstRing(x + 2, y, 0xafe8ff);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      this.spawn({
        x,
        y,
        z: 0,
        vx: Math.cos(a) * 22,
        vy: Math.sin(a) * 22,
        vz: (Math.random() - 0.5) * 6,
        life: 0.45,
        max: 0.45,
        size: 0.6,
        r: 0.8,
        g: 0.92,
        b: 1.0,
        type: "spark",
      });
    }
  }

  burstRing(x: number, y: number, color = 0xfff2a3): void {
    const ring = this.rings.find((r) => !r.visible) ?? this.rings[0]!;
    ring.visible = true;
    ring.position.set(x, y, 0.8);
    ring.scale.setScalar(0.65);
    const mat = ring.material as THREE.MeshBasicMaterial;
    mat.opacity = 1;
    mat.color.setHex(color);
    ring.userData.life = 1;
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        // O(1) swap-remove (splice would shift the array and allocate), and
        // return the dead particle to the pool for reuse.
        this.particles[i] = this.particles[this.particles.length - 1]!;
        this.particles.pop();
        this.pool.push(p);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.type === "dust" || p.type === "confetti" || p.type === "splash") p.vy -= 18 * dt;
      if (p.type === "spark") {
        const drag = Math.pow(0.92, dt * 60);
        p.vx *= drag;
        p.vy *= drag;
      }
    }

    // Only the live prefix of the buffers is written and uploaded; everything
    // past `n` is hidden by setDrawRange instead of being zeroed each frame.
    const n = Math.min(this.particles.length, MAX);
    for (let i = 0; i < n; i++) {
      const p = this.particles[i]!;
      const o = i * 3;
      this.pos[o] = p.x;
      this.pos[o + 1] = p.y;
      this.pos[o + 2] = p.z;
      const a = p.life / p.max;
      const c = i * 4;
      this.col[c] = p.r;
      this.col[c + 1] = p.g;
      this.col[c + 2] = p.b;
      this.col[c + 3] = p.type === "dust" ? a * 0.55 : p.type === "wake" ? a * 0.5 : a;
      this.size[i] = p.size * (0.5 + a);
    }
    const geo = this.points.geometry;
    geo.setDrawRange(0, n);
    if (n > 0) {
      const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
      const colAttr = geo.getAttribute("color") as THREE.BufferAttribute;
      const sizeAttr = geo.getAttribute("size") as THREE.BufferAttribute;
      uploadDensePrefix(posAttr, n);
      uploadDensePrefix(colAttr, n);
      uploadDensePrefix(sizeAttr, n);
    }
    this.points.visible = n > 0;

    for (const ring of this.rings) {
      if (!ring.visible) continue;
      ring.userData.life = (ring.userData.life as number) - dt * 1.8;
      const life = ring.userData.life as number;
      if (life <= 0) {
        ring.visible = false;
        continue;
      }
      const s = lerp(Number(ring.scale.x), 4.5, 0.12);
      ring.scale.setScalar(s);
      (ring.material as THREE.MeshBasicMaterial).opacity = clamp(life, 0, 0.9);
    }
  }

  setBudget(mult: number): void {
    this.budget = Math.max(0.2, Math.min(1, mult));
  }

  clear(): void {
    for (const p of this.particles) this.pool.push(p);
    this.particles.length = 0;
    for (const r of this.rings) r.visible = false;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
    for (const r of this.rings) {
      r.geometry.dispose();
      (r.material as THREE.Material).dispose();
    }
  }

  private spawn(fields: Particle): void {
    // Adaptive quality sheds decorative particles first. Critical effects
    // still get through because their emitters issue several particles.
    if (this.budget < 1 && Math.random() > this.budget) return;
    // Reuse a pooled object instead of storing the caller's literal: the
    // literal is a short-lived young-gen allocation (scavenged for free), but
    // the *particle* lives for many frames, so keeping it in a pool stops it
    // from being promoted to and churning the old generation.
    let p: Particle;
    if (this.particles.length >= MAX) {
      p = this.particles[this.recycleSlot++ % MAX]!; // O(1) ring replacement at capacity
    } else {
      p = this.pool.pop() ?? {
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 0, size: 0, r: 1, g: 1, b: 1, type: "dust",
      };
    }
    p.x = fields.x;
    p.y = fields.y;
    p.z = fields.z;
    p.vx = fields.vx;
    p.vy = fields.vy;
    p.vz = fields.vz;
    p.life = fields.life;
    p.max = fields.life;
    p.size = fields.size;
    p.r = fields.r;
    p.g = fields.g;
    p.b = fields.b;
    p.type = fields.type;
    if (this.particles.length < MAX) this.particles.push(p);
  }
}
