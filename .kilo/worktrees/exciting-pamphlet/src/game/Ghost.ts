import * as THREE from "three";
import { GHOST_MAX_SAMPLES, GHOST_SAMPLE_DT } from "./constants";
import { storage } from "./Storage";

type Sample = [number, number, number, number]; // t, x, y, rotation

export type GhostRecord = { seed: string; distance: number; samples: Sample[] };

const KEY_PREFIX = "sunbird.ghost.";

export class GhostRecorder {
  private samples: Sample[] = [];
  private acc = 0;

  reset(): void {
    this.samples = [];
    this.acc = 0;
  }

  sample(dt: number, t: number, x: number, y: number, rotation: number): void {
    this.acc += dt;
    if (this.acc < GHOST_SAMPLE_DT) return;
    this.acc = 0;
    if (this.samples.length >= GHOST_MAX_SAMPLES) return;
    this.samples.push([Math.round(t * 100) / 100, Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(rotation * 100) / 100]);
  }

  /** Read-only view of this run's samples (for network publishing). */
  snapshot(): readonly Sample[] {
    return this.samples;
  }

  /** Persists this run as the new best ghost if it beat the previous one. */
  commit(seed: string, distance: number): boolean {
    const prev = GhostRecorder.load(seed);
    if (prev && prev.distance >= distance) return false;
    const record: GhostRecord = { seed, distance, samples: this.samples };
    try {
      storage.setItem(KEY_PREFIX + seed, JSON.stringify(record));
      // Evict old ghosts to prevent quota exhaustion.
      GhostRecorder.evictOld();
    } catch {
      /* quota */
    }
    this.samples = [];
    return true;
  }

  /** Remove ghosts older than 30 days, keeping the 10 most recent. */
  private static evictOld(): void {
    const cutoff = Date.now() - 30 * 86_400_000;
    const entries: { key: string; ts: number }[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(KEY_PREFIX)) {
        const ts = parseInt(key.slice(KEY_PREFIX.length), 10) || 0;
        entries.push({ key, ts });
      }
    }
    entries.sort((a, b) => b.ts - a.ts);
    for (let i = 10; i < entries.length; i++) {
      if (entries[i]!.ts < cutoff) storage.removeItem(entries[i]!.key);
    }
  }

  static load(seed: string): GhostRecord | null {
    try {
      const raw = storage.getItem(KEY_PREFIX + seed);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<GhostRecord>;
      if (!Array.isArray(parsed.samples)) return null;
      return {
        seed,
        distance: Number(parsed.distance) || 0,
        samples: (parsed.samples as Sample[]).slice(0, GHOST_MAX_SAMPLES),
      };
    } catch {
      return null;
    }
  }
}

/** Renders a full 3D translucent bird mesh that replays a saved ghost run. */
export class GhostPlayer {
  readonly mesh: THREE.Group;
  private record: GhostRecord | null = null;
  private cursor = 0;
  private flapT = 0;
  private readonly body: THREE.Mesh;
  private readonly belly: THREE.Mesh;
  private readonly beak: THREE.Mesh;
  private readonly tail: THREE.Mesh;
  private readonly wingL: THREE.Group;
  private readonly wingR: THREE.Group;
  private readonly mat: THREE.MeshBasicMaterial;
  private readonly wingMat: THREE.MeshBasicMaterial;
  private readonly accentMat: THREE.MeshBasicMaterial;
  active = false;

  constructor() {
    this.mesh = new THREE.Group();
    this.mat = new THREE.MeshBasicMaterial({
      color: 0x9fd8ff,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.wingMat = new THREE.MeshBasicMaterial({
      color: 0xcdeeff,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    this.accentMat = new THREE.MeshBasicMaterial({
      color: 0xffe0a0,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });

    // Full 3D Bird Body
    this.body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), this.mat);
    this.body.scale.set(1.15, 0.92, 0.92);

    this.belly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), this.wingMat);
    this.belly.position.set(0.08, -0.18, 0);
    this.body.add(this.belly);

    // Beak
    this.beak = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 6), this.accentMat);
    this.beak.rotation.z = -Math.PI / 2;
    this.beak.position.set(0.78, 0.18, 0);
    this.body.add(this.beak);

    // Eyes
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), this.wingMat);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), this.wingMat);
    eyeL.position.set(0.42, 0.38, 0.38);
    eyeR.position.set(0.42, 0.38, -0.38);
    this.body.add(eyeL, eyeR);

    // Head crest
    for (let i = 0; i < 3; i++) {
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.08 - i * 0.015, 0.38 - i * 0.05, 5), this.wingMat);
      crest.position.set(0.18 - i * 0.17, 0.6 + i * 0.03, 0);
      crest.rotation.z = 0.55 + i * 0.35;
      this.body.add(crest);
    }

    // Fanned tail
    this.tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.62, 5), this.wingMat);
    this.tail.rotation.z = Math.PI / 2.4;
    this.tail.position.set(-0.7, 0.05, 0);
    this.body.add(this.tail);

    // Wings
    this.wingL = new THREE.Group();
    this.wingR = new THREE.Group();

    const wMeshL = new THREE.Mesh(new THREE.SphereGeometry(0.46, 8, 6), this.wingMat);
    wMeshL.scale.set(0.95, 0.16, 0.55);
    this.wingL.add(wMeshL);

    const wMeshR = new THREE.Mesh(new THREE.SphereGeometry(0.46, 8, 6), this.wingMat);
    wMeshR.scale.set(0.95, 0.16, 0.55);
    this.wingR.add(wMeshR);

    for (let i = 0; i < 3; i++) {
      const tipL = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 4), this.wingMat);
      tipL.rotation.x = Math.PI / 2;
      tipL.rotation.z = -0.25 - i * 0.18;
      tipL.position.set(-0.28 - i * 0.14, -0.02, 0.34 + i * 0.05);
      this.wingL.add(tipL);

      const tipR = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 4), this.wingMat);
      tipR.rotation.x = -Math.PI / 2;
      tipR.rotation.z = -0.25 - i * 0.18;
      tipR.position.set(-0.28 - i * 0.14, -0.02, -0.34 - i * 0.05);
      this.wingR.add(tipR);
    }

    this.wingL.position.set(-0.05, 0.1, 0.42);
    this.wingR.position.set(-0.05, 0.1, -0.42);

    this.mesh.add(this.body, this.wingL, this.wingR);
    this.mesh.scale.setScalar(1.18);
    this.mesh.visible = false;
  }

  addTo(scene: THREE.Scene): void {
    scene.add(this.mesh);
  }

  load(seed: string): boolean {
    return this.loadRecord(GhostRecorder.load(seed));
  }

  /** Load a ghost record directly (network rival ghosts skip localStorage). */
  loadRecord(record: GhostRecord | null): boolean {
    this.record = record;
    this.cursor = 0;
    this.flapT = 0;
    this.active = Boolean(this.record && this.record.samples.length > 4);
    this.mesh.visible = false;
    return this.active;
  }

  /** Recolor the translucent bird (rival ghosts read amber, yours reads ice-blue). */
  setTint(body: number, wings: number): void {
    this.mat.color.setHex(body);
    this.wingMat.color.setHex(wings);
  }

  bestDistance(): number {
    return this.record?.distance ?? 0;
  }

  /** Returns the ghost's x position at time t, or null once it has finished. */
  update(t: number, dt: number): number | null {
    if (!this.active || !this.record) return null;
    const s = this.record.samples;
    while (this.cursor < s.length - 2 && s[this.cursor + 1]![0] < t) this.cursor++;
    if (this.cursor >= s.length - 1) {
      this.mesh.visible = false;
      return null;
    }
    const a = s[this.cursor]!;
    const b = s[this.cursor + 1]!;
    const span = Math.max(0.0001, b[0] - a[0]);
    const u = Math.max(0, Math.min(1, (t - a[0]) / span));
    const x = a[1] + (b[1] - a[1]) * u;
    const y = a[2] + (b[2] - a[2]) * u;
    const rot = a[3] + (b[3] - a[3]) * u;
    this.mesh.visible = true;
    this.mesh.position.set(x, y, -1.4);
    this.mesh.rotation.z = rot * 0.92;
    this.flapT += dt;
    const flap = Math.sin(this.flapT * 14) * 0.4;
    this.wingL.rotation.z = 0.15 + flap;
    this.wingR.rotation.z = -0.15 - flap;
    return x;
  }

  reset(): void {
    this.cursor = 0;
    this.flapT = 0;
    this.mesh.visible = false;
  }
}
