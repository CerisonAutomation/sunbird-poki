import * as THREE from "three";
import type { TerrainSystem } from "./TerrainSystem";

/**
 * A "can you beat this?" flag standing in the world at a mark worth flying at.
 *
 * `FinishGate` proved the shape of this: a physical thing at a distance turns the
 * last stretch into a readable target you can judge from over a crest. The gate
 * only exists in race modes, because a race is the only mode that had a number to
 * aim at — but a personal best, today's best, a rival's shared mark and the daily
 * target are numbers too, and in an endless flight they were totals on a card
 * instead of places on the ground.
 *
 * Cheaper than the gate on purpose: one pole, one flag, one additive beam, and up
 * to three of them alive at once (`BEAT_MAX_LINES`). The label texture is only
 * rebuilt when the words actually change, because re-rasterizing a canvas every
 * frame for a flag that says the same thing is how a 60 fps flight becomes 40.
 */
export class BeatLine {
  readonly group = new THREE.Group();
  private readonly pole: THREE.Mesh;
  private readonly flag: THREE.Mesh;
  private readonly beam: THREE.Mesh;
  private readonly flagMat: THREE.MeshBasicMaterial;
  private readonly beamMat: THREE.MeshBasicMaterial;
  private readonly poleMat: THREE.MeshLambertMaterial;
  private tex: THREE.CanvasTexture;
  private label = "";
  private metres = "";
  private tint = 0xffffff;
  private x = 0;
  private pulse = 0;
  passed = false;

  constructor() {
    this.poleMat = new THREE.MeshLambertMaterial({ color: 0xf5f2ea, flatShading: true });
    this.tex = makeFlagTexture("", "", this.tint);
    this.flagMat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, side: THREE.DoubleSide });
    // Additive column so the mark reads through haze and from a long way out —
    // the same trick the finish gate uses, at a third of the height.
    this.beamMat = new THREE.MeshBasicMaterial({
      color: 0xffe9a8,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.pole = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.44, 22, 6), this.poleMat);
    this.pole.position.y = 11;
    this.pole.castShadow = true;

    this.flag = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 4.4), this.flagMat);
    this.flag.rotation.y = Math.PI / 2;
    this.flag.position.set(0, 18.4, -4.4);

    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 90, 12, 1, true), this.beamMat);
    this.beam.position.y = 42;

    this.group.add(this.pole, this.flag, this.beam);
    this.group.visible = false;
  }

  addTo(scene: THREE.Scene): void {
    scene.add(this.group);
  }

  /**
   * Stand the flag at `at` metres into this run. `at <= 0` hides it, which is how
   * an unused slot in the pool stays out of the frame and out of the draw list.
   */
  place(at: number, terrain: TerrainSystem, label: string, metres: string, tint = 0xffffff): void {
    if (!Number.isFinite(at) || at <= 0) {
      this.group.visible = false;
      return;
    }
    this.x = at;
    this.passed = false;
    if (label !== this.label || metres !== this.metres || tint !== this.tint) {
      this.label = label;
      this.metres = metres;
      this.tint = tint;
      this.tex.dispose();
      this.tex = makeFlagTexture(label, metres, tint);
      this.flagMat.map = this.tex;
      this.flagMat.needsUpdate = true;
    }
    this.group.position.set(at, terrain.heightAt(at), 0);
    this.group.visible = true;
  }

  hide(): void {
    this.group.visible = false;
  }

  /** @returns metres remaining to the flag, or -1 when it is not standing. */
  update(dt: number, birdX: number): number {
    if (!this.group.visible) return -1;
    this.pulse += dt;
    const remaining = this.x - birdX;

    // Tension ramp: the nearer the mark, the harder the beam breathes.
    const near = Math.max(0, 1 - Math.abs(remaining) / 320);
    this.beamMat.opacity = 0.08 + near * 0.26 + Math.sin(this.pulse * 3.1) * 0.035 * near;
    this.flag.position.y = 18.4 + Math.sin(this.pulse * 1.7) * 0.3;
    // A flag rips in the wind; the faster the bird, the harder it flutters.
    this.flag.rotation.z = Math.sin(this.pulse * 6) * 0.05 * (0.4 + near);

    if (!this.passed && remaining < 0) {
      this.passed = true;
      this.beamMat.color.setHex(0x9dffb0); // green the instant it is beaten
    }
    return remaining;
  }

  dispose(): void {
    this.pole.geometry.dispose();
    this.flag.geometry.dispose();
    this.beam.geometry.dispose();
    this.poleMat.dispose();
    this.flagMat.dispose();
    this.beamMat.dispose();
    this.tex.dispose();
  }
}

/** Rasterizes the flag: the challenge in words, the mark in metres under it. */
function makeFlagTexture(label: string, metres: string, tint: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 120;
  const g = c.getContext("2d")!;
  const hex = `#${tint.toString(16).padStart(6, "0")}`;

  g.fillStyle = "#1d1a26";
  g.fillRect(0, 0, c.width, c.height);
  // The tinted band is what separates a rival's mark from your own at a glance.
  g.fillStyle = hex;
  g.fillRect(0, 0, c.width, 10);
  g.fillRect(0, c.height - 10, c.width, 10);

  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 6;
  g.strokeStyle = "#1d1a26";

  g.font = "bold 25px sans-serif";
  const words = fit(g, label, 236, 25);
  g.strokeText(words, c.width / 2, 46);
  g.fillStyle = "#fff";
  g.fillText(words, c.width / 2, 46);

  g.font = "bold 34px sans-serif";
  const number = fit(g, metres, 236, 34);
  g.strokeText(number, c.width / 2, 86);
  g.fillStyle = hex;
  g.fillText(number, c.width / 2, 86);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Shrinks the font until the words fit the cloth — a clipped flag reads as a bug. */
function fit(g: CanvasRenderingContext2D, text: string, maxWidth: number, size: number): string {
  let out = text;
  let px = size;
  while (px > 13 && g.measureText(out).width > maxWidth) {
    px -= 1;
    g.font = `bold ${px}px sans-serif`;
    if (g.measureText(out).width > maxWidth && out.length > 12) out = `${out.slice(0, 11)}…`;
  }
  return out;
}
