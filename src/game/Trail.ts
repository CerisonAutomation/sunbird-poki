import { uploadDensePrefix } from "./bufferUpdates";
import * as THREE from "three";

const TRAIL_MAX = 48;
const TRAIL_LIFE = 0.65;
const TRAIL_SPACING = 0.45;
const TRAIL_Z = 0.28;

type TrailSample = { x: number; y: number; age: number };

/**
 * A smooth, glowing ribbon that streams behind the bird — the classic speed
 * trail. One triangle-strip mesh is rebuilt each frame from a short ring of
 * recent positions, so the whole trail costs a single draw call and no
 * per-particle allocation. Additive blending makes it read as a soft comet
 * wake against the sky.
 */
export class TrailRibbon {
  readonly mesh: THREE.Mesh;

  private readonly samples: TrailSample[] = [];
  private readonly geo: THREE.BufferGeometry;
  private readonly mat: THREE.ShaderMaterial;
  private readonly pos: Float32Array;
  private readonly alpha: Float32Array;
  private readonly color = new THREE.Color(1, 0.95, 0.85);

  // Per-point scratch space (no per-frame allocation).
  private readonly nx: Float32Array;
  private readonly ny: Float32Array;
  private readonly w: Float32Array;
  private readonly al: Float32Array;

  private width = 0.5;
  private peak = 0.55;
  private vis = 0;

  constructor() {
    const maxQuads = TRAIL_MAX - 1;
    this.pos = new Float32Array(maxQuads * 6 * 3);
    this.alpha = new Float32Array(maxQuads * 6);
    this.nx = new Float32Array(TRAIL_MAX);
    this.ny = new Float32Array(TRAIL_MAX);
    this.w = new Float32Array(TRAIL_MAX);
    this.al = new Float32Array(TRAIL_MAX);

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute(
      "position",
      new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.geo.setAttribute(
      "aAlpha",
      new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage),
    );

    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uColor: { value: this.color } },
      vertexShader: `
        attribute float aAlpha;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(uColor, vAlpha);
        }
      `,
    });

    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    // Depth contract: terrain/collectibles -> trail -> particles -> bird.
    // The ribbon is a wake, never a foreground costume.
    this.mesh.renderOrder = 30;
    this.mesh.visible = false;
  }

  addTo(scene: THREE.Scene): void {
    scene.add(this.mesh);
  }

  setColor(r: number, g: number, b: number): void {
    this.color.setRGB(r, g, b);
  }

  setWidth(w: number): void {
    this.width = Math.max(0.05, w);
  }

  setPeak(p: number): void {
    this.peak = Math.max(0, Math.min(1, p));
  }

  /** Record the bird's current position — offset behind bird to prevent bird/trail overlap */
  push(x: number, y: number): void {
    const last = this.samples[this.samples.length - 1];
    if (last && Math.abs(x - last.x) < TRAIL_SPACING && Math.abs(y - last.y) < TRAIL_SPACING) return;
    this.samples.push({ x, y, age: 0 });
    if (this.samples.length > TRAIL_MAX) this.samples.shift();
  }

  /** @param target 0..1 desired visibility (smoothed in/out). */
  update(dt: number, target: number): void {
    for (const p of this.samples) p.age += dt;
    while (this.samples.length && this.samples[0]!.age > TRAIL_LIFE) this.samples.shift();
    this.vis += (Math.max(0, Math.min(1, target)) - this.vis) * Math.min(1, dt * 10);
    this.rebuild();
    this.mesh.visible = this.vis > 0.02 && this.samples.length > 1;
  }

  clear(): void {
    this.samples.length = 0;
    this.vis = 0;
    this.geo.setDrawRange(0, 0);
    this.mesh.visible = false;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }

  /** Rebuild the ribbon strip from the live samples (widest/brightest at the
   * head, tapering to a point and fading out toward the tail). */
  private rebuild(): void {
    const n = this.samples.length;
    if (n < 2) {
      this.geo.setDrawRange(0, 0);
      return;
    }

    for (let i = 0; i < n; i++) {
      const p = this.samples[i]!;
      const prev = this.samples[Math.max(0, i - 1)]!;
      const next = this.samples[Math.min(n - 1, i + 1)]!;
      let dx = next.x - prev.x;
      let dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      this.nx[i] = -dy;
      this.ny[i] = dx;
      const t = Math.min(1, p.age / TRAIL_LIFE);
      // Chaos-free taper: width and alpha both ease out cubic to prevent self-overlap bright spots
      const ease = (1 - t) * (1 - t) * (1 - t);
      this.w[i] = this.width * ease + 0.015;
      this.al[i] = this.vis * this.peak * ease * 0.85;
    }

    let vi = 0;
    for (let i = 0; i < n - 1; i++) {
      const a = this.samples[i]!;
      const b = this.samples[i + 1]!;
      const ax = a.x + this.nx[i]! * this.w[i]!;
      const ay = a.y + this.ny[i]! * this.w[i]!;
      const bx = a.x - this.nx[i]! * this.w[i]!;
      const by = a.y - this.ny[i]! * this.w[i]!;
      const cx = b.x + this.nx[i + 1]! * this.w[i + 1]!;
      const cy = b.y + this.ny[i + 1]! * this.w[i + 1]!;
      const dx = b.x - this.nx[i + 1]! * this.w[i + 1]!;
      const dy = b.y - this.ny[i + 1]! * this.w[i + 1]!;
      const aa = this.al[i]!;
      const ab = this.al[i + 1]!;

      this.setVert(vi++, ax, ay, aa);
      this.setVert(vi++, bx, by, aa);
      this.setVert(vi++, cx, cy, ab);
      this.setVert(vi++, cx, cy, ab);
      this.setVert(vi++, bx, by, aa);
      this.setVert(vi++, dx, dy, ab);
    }

    this.geo.setDrawRange(0, vi);
    uploadDensePrefix(this.geo.getAttribute("position") as THREE.BufferAttribute, vi);
    uploadDensePrefix(this.geo.getAttribute("aAlpha") as THREE.BufferAttribute, vi);
  }

  private setVert(i: number, x: number, y: number, a: number): void {
    const o = i * 3;
    this.pos[o] = x;
    this.pos[o + 1] = y;
    this.pos[o + 2] = TRAIL_Z;
    this.alpha[i] = a;
  }
}
