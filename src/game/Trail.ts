import { uploadDensePrefix } from "./bufferUpdates";
import * as THREE from "three";

const TRAIL_MAX = 48;
const TRAIL_LIFE = 0.65;
const TRAIL_SPACING = 0.45;
/** Longest jump the ribbon will BRIDGE. Past this the strip is cut and
 *  restarted, because a quad drawn between two samples that far apart is a
 *  straight line across the screen, not a trail. */
const TRAIL_MAX_GAP = 12;
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
  /**
   * Floating-origin recenter point (see `TerrainSystem.recenter()`). Samples
   * are pushed in true world x — that is what makes them seed-deterministic —
   * so the subtraction happens here, at the single point where a sample
   * becomes a vertex. The mesh itself carries no transform, so without this
   * the whole ribbon sits at x≈4096 the moment the origin rebases, off-screen
   * for the rest of an Endless run.
   */
  private originX = 0;

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
    // Ordering note, because the obvious "fix" here is wrong.
    //
    // The intent is terrain/collectibles -> trail -> particles -> bird, but
    // `renderOrder` only sorts WITHIN a render queue. The ribbon is
    // `transparent: true` and the bird's materials are opaque, so three draws
    // every opaque object first and the ribbon second — the ribbon paints over
    // the bird whatever this number says.
    //
    // Do not "fix" that by flipping `depthTest` on. The terrain is a heightfield
    // at z=0 spanning TERRAIN_HALF_Z, and TRAIL_Z puts the ribbon in front of
    // it, so depth-testing would let hills occlude the wake. `depthTest: false`
    // is deliberate. The ribbon is kept off the bird by ANCHORING it at the
    // tail tip (`Bird.tailPoint`) rather than at the bird's centroid.
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

  /**
   * Shift the ribbon into the new render frame. Called from
   * `Game.maybeRecenter()`; see `originX`.
   */
  setRenderOrigin(originX: number): void {
    this.originX = originX;
  }

  /**
   * Record the ribbon's current head position, in true world coordinates.
   *
   * The caller is responsible for anchoring this BEHIND the bird — the bird's
   * centroid puts the head inside its own body. `Bird.tailPoint()` is the
   * anchor the game uses. This comment used to claim the offset was applied
   * here; it never was, which is why the wake started mid-body.
   */
  push(x: number, y: number): void {
    const last = this.samples[this.samples.length - 1];
    // Too close to the head: a redundant sample that would only add a
    // zero-length quad.
    if (last && Math.abs(x - last.x) < TRAIL_SPACING && Math.abs(y - last.y) < TRAIL_SPACING) return;
    // Too far: the ribbon was not being sampled for a while, and connecting
    // across that gap draws a long straight sweep through the sky.
    //
    // This is not hypothetical. `Game.updateTrailRibbon` only pushes a sample
    // while `show` is true, and `show` is a speed gate (speed > 48, or fever,
    // or boost). A player crossing that threshold — which happens constantly
    // around it — leaves a time gap, and the bird can cover a lot of ground in
    // it: at 2.8 km the gaps were hundreds of units. The old check only
    // de-duplicated CLOSE samples, so every one of those gaps was bridged, and
    // oscillating around the threshold produced loops of ribbon arcing over
    // the top of the screen.
    //
    // Cutting instead is also what the eye expects: a trail that has just
    // resumed is short, and grows. A bridge is not a trail resuming, it is a
    // line drawn between two places the bird was never between.
    if (last && (x - last.x) ** 2 + (y - last.y) ** 2 > TRAIL_MAX_GAP * TRAIL_MAX_GAP) {
      this.samples.length = 0;
    }
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
    this.pos[o] = x - this.originX;
    this.pos[o + 1] = y;
    this.pos[o + 2] = TRAIL_Z;
    this.alpha[i] = a;
  }
}
