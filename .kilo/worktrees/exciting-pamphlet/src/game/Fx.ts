import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/**
 * Post-processing layer — the "more powerful effect" pass.
 *
 * An UnrealBloom pipeline lifts every trigger into a glow event: coins, gems,
 * fever, golden hour, the sun itself. Intensity is driven by a 0..1 glow level
 * that the game raises on big moments and lets decay, so bloom breathes with
 * the run instead of sitting at a static value.
 *
 * Kept behind a single render path so split-screen versus (two viewports) and
 * low-power devices fall back to a plain `renderer.render()` untouched.
 */
export class Fx {
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;

  /** Smoothed glow 0..1 (strength is derived from it). */
  private glow = 0;
  /** Ambient level, set each frame from game state (fever, golden hour…). */
  private base = 0;
  /** Transient spark that decays — bumped on trigger moments. */
  private spark = 0;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
  ) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0, 0.6, 0.65);
    this.composer.addPass(this.bloom);
    // OutputPass re-applies the renderer's ACES tone mapping + sRGB so the
    // composed frame matches the plain render path when glow is at rest.
    this.composer.addPass(new OutputPass());
  }

  /** Ambient glow level 0..1 (drives the resting sheen). */
  setBase(v: number): void {
    this.base = Math.max(0, Math.min(1, v));
  }

  /** Transient glow bump — trigger moments. Decays over ~1 s. */
  pulse(amount: number): void {
    this.spark = Math.min(1.4, this.spark + amount);
    this.glow = Math.max(this.glow, this.base + this.spark * 0.8);
  }

  resize(w: number, h: number, dpr: number): void {
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
  }

  render(dt: number): void {
    this.spark *= Math.pow(0.02, dt); // fast decay, slow afterglow
    const target = Math.min(1.2, this.base + this.spark);
    // Ease glow: snappy attack, lingering falloff.
    const k = target > this.glow ? 10 : 2.4;
    this.glow += (target - this.glow) * Math.min(1, dt * k);
    this.bloom.strength = this.glow * 0.9;
    this.composer.render(dt);
  }

  dispose(): void {
    this.bloom.dispose();
    this.composer.dispose();
  }
}
