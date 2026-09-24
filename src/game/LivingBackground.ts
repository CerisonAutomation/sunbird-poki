import * as THREE from "three";

/**
 * LivingBackground — distant migratory flocks drifting through the play sky.
 *
 * The whole flock renders as exactly THREE instanced draw calls (body, left
 * wing, right wing) regardless of bird count, so it is effectively free on
 * low-end hardware. Depth is conveyed with aerial perspective: far birds are
 * smaller and paler, near birds darker — no transparency sorting needed.
 *
 * Motion is slow and directional (flocks migrate leftward past the player),
 * with per-bird wingbeat phase so the flock never strobes in unison.
 */

// One tighter flock: enough life in the sky without cluttering the backdrop with dots.
const FLOCKS = 1;
const BIRDS_PER_FLOCK = 4;
const TOTAL = FLOCKS * BIRDS_PER_FLOCK;

type FlockState = {
  x: number;
  y: number;
  speed: number;
  depth: number;
  phase: number;
  wobble: number;
};

const dummy = new THREE.Object3D();
const tmpColor = new THREE.Color();

export class LivingBackground extends THREE.Group {
  private readonly bodyMesh: THREE.InstancedMesh;
  private readonly wingL: THREE.InstancedMesh;
  private readonly wingR: THREE.InstancedMesh;
  private readonly clouds: THREE.Sprite[] = [];
  private readonly cloudTex: THREE.CanvasTexture;
  private readonly flocks: FlockState[] = [];
  private readonly bodyGeo: THREE.BufferGeometry;
  private readonly wingGeo: THREE.BufferGeometry;
  private readonly birdMat: THREE.MeshBasicMaterial;
  private readonly shooters: THREE.Sprite[] = [];
  private shootT = 5;
  private reducedMotion = false;
  private t = 0;
  private anchorX = 0;

  constructor() {
    super();

    // Body: a small stretched diamond pointing +x (direction of travel).
    this.bodyGeo = new THREE.BufferGeometry();
    this.bodyGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          // top diamond
          0.9, 0.02, 0, -0.7, 0.02, 0.12, -0.7, 0.02, -0.12,
          // bottom diamond
          0.9, -0.02, 0, -0.7, -0.02, 0.12, -0.7, -0.02, -0.12,
        ],
        3,
      ),
    );
    this.bodyGeo.setIndex([0, 1, 2, 3, 5, 4]);

    // Wing: pivots at the origin (wing root), extends along +z. Flapping is a
    // rotation around the x-axis applied per-instance, so one geometry serves
    // both sides (mirrored by rotation sign).
    this.wingGeo = new THREE.BufferGeometry();
    this.wingGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          0.35, 0, 0.05, // root-front
          -0.45, 0, 0.05, // root-back
          0.05, 0.06, 1.25, // wing tip (slightly swept back, raised)
        ],
        3,
      ),
    );
    this.wingGeo.setIndex([0, 1, 2]);
    this.wingGeo.computeVertexNormals();

    this.birdMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    this.bodyMesh = new THREE.InstancedMesh(this.bodyGeo, this.birdMat, TOTAL);
    this.wingL = new THREE.InstancedMesh(this.wingGeo, this.birdMat, TOTAL);
    this.wingR = new THREE.InstancedMesh(this.wingGeo, this.birdMat, TOTAL);
    for (const m of [this.bodyMesh, this.wingL, this.wingR]) {
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.add(m);
    }

    // Soft background cloud sprites at varying depths.
    this.cloudTex = makeCloudTexture();
    for (let i = 0; i < 5; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.cloudTex,
        transparent: true,
        // Menu depth cue only: keep the sky airy instead of overcast.
        opacity: 0.018 + (i / 5) * 0.028,
        depthWrite: false,
        fog: false,
      });
      const sp = new THREE.Sprite(mat);
      const scale = 14 + (i / 5) * 22;
      sp.scale.set(scale, scale * 0.42, 1);
      sp.userData = {
        ox: (i / 5) * 220 - 60,
        oy: 30 + (i % 4) * 11,
        depth: 0.04 + (i / 5) * 0.18,
      };
      this.clouds.push(sp);
      this.add(sp);
    }

    // One flock — single depth layer, keeps the sky clean.
    this.flocks.push({
      x: -40,
      y: 34,
      speed: 2.6,
      depth: 0.5,
      phase: 0,
      wobble: 0.8,
    });
    // Shooting-star streaks (pooled sprites)
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.SpriteMaterial({ map: this.cloudTex, color: 0xfff6d8, transparent: true, opacity: 0, depthWrite: false, fog: false });
      const sp = new THREE.Sprite(mat);
      sp.scale.set(14, 2.2, 1);
      sp.userData = { t: 99, dur: 0.9 };
      this.shooters.push(sp);
      this.add(sp);
    }

    this.writeInstances(0);
  }

  /** Reduced-motion users get a static flock painting instead of drift. */
  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    if (reduced) this.writeInstances(this.t);
  }

  update(dt: number, camX: number, camY: number): void {
    if (!this.reducedMotion) this.t += dt;
    this.anchorX = camX;
    this.writeInstances(this.t);
    for (const sp of this.clouds) {
      const d = sp.userData as { ox: number; oy: number; depth: number };
      let wx = d.ox - (this.reducedMotion ? 0 : this.t * d.depth * 6);
      const span = 260;
      wx = ((wx - camX + span * 0.5) % span + span) % span - span * 0.5;
      sp.position.set(camX + wx, d.oy + camY * 0.05, -46 - d.depth * 60);
    }
    this.writeTraffic(this.t, camX, camY, dt);
  }

  private writeTraffic(_time: number, camX: number, camY: number, dt: number): void {
    const still = this.reducedMotion;
    if (!still) {
      this.shootT -= dt;
      if (this.shootT <= 0) {
        this.shootT = 6 + Math.random() * 9;
        const sp = this.shooters[Math.floor(Math.random() * this.shooters.length)]!;
        sp.position.set(camX + 40 + Math.random() * 60, camY + 42 + Math.random() * 22, -70);
        sp.rotation.z = -0.5;
        (sp.material as THREE.SpriteMaterial).opacity = 0.9;
        sp.userData.t = 0;
        sp.visible = true;
      }
    }
    for (const sp of this.shooters) {
      const u = sp.userData as { t: number; dur: number };
      if (!sp.visible) continue;
      u.t += dt;
      const k = u.t / u.dur;
      if (k >= 1) { sp.visible = false; continue; }
      sp.position.x -= dt * 90;
      sp.position.y -= dt * 34;
      (sp.material as THREE.SpriteMaterial).opacity = 0.9 * (1 - k);
    }
  }

  private writeInstances(time: number): void {
    let idx = 0;
    for (let f = 0; f < this.flocks.length; f++) {
      const flock = this.flocks[f]!;
      const scale = 0.55 + flock.depth * 0.75;
      // aerial perspective: near = dark slate, far = pale sky-tinted
      tmpColor.setHSL(0.62, 0.12, 0.32 + (1 - flock.depth) * 0.34);

      // flock drifts leftward; wraps around the camera anchor
      const span = 240;
      let fx = flock.x - time * flock.speed * (2 + flock.depth * 3);
      fx = ((fx - this.anchorX + span * 0.5) % span + span) % span - span * 0.5;
      const fy = flock.y + Math.sin(time * 0.35 + flock.phase) * flock.wobble * 2;

      for (let b = 0; b < BIRDS_PER_FLOCK; b++) {
        // loose V-formation: two trailing arms behind the leader
        const row = Math.ceil(b / 2);
        const side = b === 0 ? 0 : b % 2 === 0 ? 1 : -1;
        const ox = b === 0 ? 0 : -row * 2.6 * scale;
        const oz = side * row * 2.2 * scale;
        const bob = Math.sin(time * 1.3 + flock.phase + b * 1.7) * 0.45;
        const bx = this.anchorX + fx + ox;
        const by = fy + bob;
        const bz = -40 - flock.depth * 38 + oz * 0.4;

        const flap = Math.sin(time * (4.5 + flock.depth * 2) + flock.phase + b * 0.9);
        const flapAngle = this.reducedMotion ? 0.25 : flap * 0.65;

        // body
        dummy.position.set(bx, by, bz);
        dummy.rotation.set(0, 0, flap * 0.06);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        this.bodyMesh.setMatrixAt(idx, dummy.matrix);
        this.bodyMesh.setColorAt(idx, tmpColor);

        // left wing (+z), flapping up
        dummy.rotation.set(-flapAngle, 0, 0);
        dummy.updateMatrix();
        this.wingL.setMatrixAt(idx, dummy.matrix);
        this.wingL.setColorAt(idx, tmpColor);

        // right wing (-z): mirror geometry via rotation around x by PI-flap
        dummy.rotation.set(Math.PI + flapAngle, 0, 0);
        dummy.updateMatrix();
        this.wingR.setMatrixAt(idx, dummy.matrix);
        this.wingR.setColorAt(idx, tmpColor);

        idx++;
      }
    }
    this.bodyMesh.instanceMatrix.needsUpdate = true;
    this.wingL.instanceMatrix.needsUpdate = true;
    this.wingR.instanceMatrix.needsUpdate = true;
    if (this.bodyMesh.instanceColor) this.bodyMesh.instanceColor.needsUpdate = true;
    if (this.wingL.instanceColor) this.wingL.instanceColor.needsUpdate = true;
    if (this.wingR.instanceColor) this.wingR.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.bodyGeo.dispose();
    this.wingGeo.dispose();
    this.birdMat.dispose();
    this.bodyMesh.dispose();
    this.wingL.dispose();
    this.wingR.dispose();
    this.cloudTex.dispose();
    for (const sp of this.clouds) sp.material.dispose();
    for (const sp of this.shooters) sp.material.dispose();
  }
}

function makeCloudTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 256, 128);
  const blobs: [number, number, number][] = [
    [108, 74, 46],
    [150, 66, 40],
    [78, 76, 34],
    [182, 80, 30],
    [128, 48, 32],
  ];
  for (const [x, y, r] of blobs) {
    const grd = g.createRadialGradient(x, y, 4, x, y, r);
    grd.addColorStop(0, "rgba(255,255,255,0.92)");
    grd.addColorStop(0.6, "rgba(255,255,255,0.5)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
