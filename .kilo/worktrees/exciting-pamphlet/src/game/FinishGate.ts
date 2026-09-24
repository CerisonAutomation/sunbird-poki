import * as THREE from "three";
import type { TerrainSystem } from "./TerrainSystem";

/**
 * A physical finish line for the race modes.
 *
 * Before this existed the finish was pure logic — you flew 4 km toward an
 * invisible trigger with nothing to aim at. A visible gate turns the last
 * stretch of a race into a readable, dramatic target: you can see it coming
 * over the crest, judge whether to dive or hold, and feel the pass.
 */
export class FinishGate {
  readonly group = new THREE.Group();
  private readonly pylonL: THREE.Mesh;
  private readonly pylonR: THREE.Mesh;
  private readonly banner: THREE.Mesh;
  private readonly beam: THREE.Mesh;
  private readonly bannerMat: THREE.MeshBasicMaterial;
  private readonly beamMat: THREE.MeshBasicMaterial;
  private readonly pylonMat: THREE.MeshLambertMaterial;
  private readonly tex: THREE.CanvasTexture;
  private x = 0;
  private passed = false;
  private pulse = 0;

  constructor() {
    this.tex = makeCheckerTexture();
    this.pylonMat = new THREE.MeshLambertMaterial({ color: 0xf5f2ea, flatShading: true });
    this.bannerMat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, side: THREE.DoubleSide });
    // Additive light column so the gate reads from a long way out.
    this.beamMat = new THREE.MeshBasicMaterial({
      color: 0xffe9a8,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const pylonGeo = new THREE.CylinderGeometry(0.9, 1.25, 26, 7);
    this.pylonL = new THREE.Mesh(pylonGeo, this.pylonMat);
    this.pylonR = new THREE.Mesh(pylonGeo, this.pylonMat);
    this.pylonL.position.z = -9;
    this.pylonR.position.z = 9;
    this.pylonL.castShadow = true;
    this.pylonR.castShadow = true;

    this.banner = new THREE.Mesh(new THREE.PlaneGeometry(18.6, 5.2), this.bannerMat);
    this.banner.rotation.y = Math.PI / 2;
    this.banner.position.y = 15;

    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(9.4, 9.4, 150, 18, 1, true), this.beamMat);
    this.beam.position.y = 60;

    this.group.add(this.pylonL, this.pylonR, this.banner, this.beam);
    this.group.visible = false;
  }

  addTo(scene: THREE.Scene): void {
    scene.add(this.group);
  }

  /** Places the gate on the terrain. `x <= 0` hides it (endless modes). */
  place(x: number, terrain: TerrainSystem): void {
    if (x <= 0) {
      this.group.visible = false;
      return;
    }
    this.x = x;
    this.passed = false;
    const ground = terrain.heightAt(x);
    this.group.position.set(x, ground, 0);
    this.pylonL.position.y = 13;
    this.pylonR.position.y = 13;
    this.group.visible = true;
  }

  hide(): void {
    this.group.visible = false;
  }

  /** @returns metres remaining, or -1 when inactive/passed. */
  update(dt: number, birdX: number): number {
    if (!this.group.visible) return -1;
    this.pulse += dt;
    const remaining = this.x - birdX;

    // Pulse harder the closer you get — a natural tension ramp.
    const near = Math.max(0, 1 - Math.abs(remaining) / 400);
    this.beamMat.opacity = 0.1 + near * 0.3 + Math.sin(this.pulse * 3) * 0.04 * near;
    this.bannerMat.opacity = 0.85 + Math.sin(this.pulse * 4) * 0.15 * near;
    this.banner.position.y = 15 + Math.sin(this.pulse * 1.6) * 0.35;

    if (!this.passed && remaining < 0) {
      this.passed = true;
      this.beamMat.color.setHex(0x9dffb0); // turns green the moment you cross
    }
    return remaining;
  }

  dispose(): void {
    this.pylonL.geometry.dispose();
    this.banner.geometry.dispose();
    this.beam.geometry.dispose();
    this.pylonMat.dispose();
    this.bannerMat.dispose();
    this.beamMat.dispose();
    this.tex.dispose();
  }
}

function makeCheckerTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 72;
  const g = c.getContext("2d")!;
  const sq = 18;
  for (let y = 0; y < c.height; y += sq) {
    for (let x = 0; x < c.width; x += sq) {
      g.fillStyle = ((x / sq + y / sq) | 0) % 2 === 0 ? "#1d1a26" : "#fdfbf5";
      g.fillRect(x, y, sq, sq);
    }
  }
  g.fillStyle = "#ffce4a";
  g.fillRect(0, 0, c.width, 5);
  g.fillRect(0, c.height - 5, c.width, 5);
  g.font = "bold 30px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 6;
  g.strokeStyle = "#1d1a26";
  g.strokeText("FINISH", c.width / 2, c.height / 2);
  g.fillStyle = "#fff";
  g.fillText("FINISH", c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
