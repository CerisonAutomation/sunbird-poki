/**
 * MenuSky — the living "birds in motion" background for the shell.
 *
 * Deliberately cheap: one 2D canvas, a fixed small flock (no particle spam),
 * capped device pixel ratio, and ~30 Hz ambient update. It pauses completely
 * when the menu is not visible and renders a single static frame under
 * `prefers-reduced-motion`. This is decorative-only and never touches the
 * 3D scene or gameplay.
 *
 * Performance notes (why it stays cheap even with the hero bird):
 *  • All gradients + the two hill silhouettes are built ONCE per resize and
 *    reused every frame (gradient objects + Path2D), so the per-frame cost is
 *    fills and ~20 tiny strokes — zero allocation, zero GC churn.
 *  • resize() is a no-op unless the size/DPR actually changed. Setting
 *    canvas.width clears the canvas, and the old unconditional resize was the
 *    source of visible flashing (blank canvas until the next 30 Hz tick).
 */

import { FLAP_NEUTRAL, drawSunbird } from "./Sunbird.js";

type Flocker = {
  x: number;
  y: number;
  scale: number;
  speed: number;
  flap: number;
  flapRate: number;
  drift: number;
  depth: number;
};

const FLOCK_SIZE = 7;

/** One golden spark in the hero bird's trail. */
type Spark = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; r: number };

export class MenuSky {
  readonly host: HTMLDivElement;
  /** Transparent overlay canvas that draws the hero bird ABOVE the UI card. */
  readonly heroHost: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly heroCanvas: HTMLCanvasElement;
  private readonly hctx: CanvasRenderingContext2D | null;
  private readonly birds: Flocker[] = [];
  private readonly reduceMotion: boolean;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private time = 0;
  /** Independent slow clock for the hero bird (its own drift, not the flock's). */
  private heroT = Math.random() * 100;
  private active = false;
  private heroActive = true;
  private width = 1;
  private height = 1;
  private dpr = 1;

  // Cached per-resize scenery (rebuilt only when the canvas really changes).
  private skyGrad: CanvasGradient | null = null;
  private hazeGrad: CanvasGradient | null = null;
  private sunGrad: CanvasGradient | null = null;
  private sunX = 0;
  private sunY = 0;
  private sunR = 0;
  private hillFar: Path2D | null = null;
  private hillMid: Path2D | null = null;
  private hillNear: Path2D | null = null;
  // The 12 god-ray gradients used to be rebuilt and filled EVERY frame (30 Hz),
  // which is the single most expensive thing in the menu on a phone GPU. They
  // never change shape — only the whole layer rotates — so they are baked into
  // one offscreen canvas per resize and composited with a rotated drawImage.
  private raysCanvas: HTMLCanvasElement | null = null;
  private rayLen = 0;
  // Per-spark `shadowBlur` is brutally slow in 2D canvas; the glow is baked
  // into a tiny radial sprite once and stamped with drawImage instead.
  private sparkSprite: HTMLCanvasElement | null = null;

  // Golden particle trail behind the hero bird.
  private readonly sparks: Spark[] = [];

  constructor() {
    this.reduceMotion =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;

    this.host = document.createElement("div");
    this.host.className = "menu-sky";
    this.host.setAttribute("aria-hidden", "true");

    this.canvas = document.createElement("canvas");
    this.canvas.className = "menu-sky-canvas";
    this.host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");

    this.heroHost = document.createElement("div");
    this.heroHost.className = "menu-hero-layer";
    this.heroHost.setAttribute("aria-hidden", "true");
    this.heroCanvas = document.createElement("canvas");
    this.heroCanvas.className = "menu-sky-canvas";
    this.heroHost.appendChild(this.heroCanvas);
    this.hctx = this.heroCanvas.getContext("2d");

    for (let i = 0; i < FLOCK_SIZE; i++) {
      const depth = i / (FLOCK_SIZE - 1);
      this.birds.push({
        x: Math.random(),
        y: 0.06 + depth * 0.34 + Math.random() * 0.16,
        scale: 0.5 + depth * 0.95,
        speed: 0.012 + depth * 0.03,
        flap: Math.random() * Math.PI * 2,
        flapRate: 7 + Math.random() * 3.5,
        drift: 0.012 + Math.random() * 0.02,
        depth,
      });
    }
  }

  resize(width: number, height: number): void {
    if (width < 2 || height < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    // No-op when nothing changed — the old unconditional path cleared the
    // canvas every HUD update and caused visible flashing.
    if (width === this.width && height === this.height && dpr === this.dpr) return;
    this.dpr = dpr;
    this.width = width;
    this.height = height;
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    if (this.ctx) this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.heroCanvas.width = Math.floor(width * dpr);
    this.heroCanvas.height = Math.floor(height * dpr);
    this.heroCanvas.style.width = `${width}px`;
    this.heroCanvas.style.height = `${height}px`;
    if (this.hctx) this.hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.buildScenery();
    // Paint immediately so a resize never leaves a blank frame behind.
    this.draw(0);
  }

  setActive(active: boolean): void {
    if (active === this.active) return;
    this.active = active;
    this.host.classList.toggle("on", active);
    this.heroHost.classList.toggle("on", active && this.heroActive);
    if (active && !this.reduceMotion) this.start();
    else this.stop();
    if (active) this.draw(0);
  }

  setHeroActive(active: boolean): void {
    if (this.heroActive === active) return;
    this.heroActive = active;
    this.heroHost.classList.toggle("on", this.active && active);
    if (!active && this.hctx) {
      this.hctx.clearRect(0, 0, this.width, this.height);
    }
  }

  dispose(): void {
    this.stop();
    this.host.remove();
    this.heroHost.remove();
  }

  private start(): void {
    if (this.raf) return;
    this.last = performance.now();
    const tick = (now: number): void => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.acc += dt;
      // Ambient layer: 30 Hz is indistinguishable here and halves the cost.
      if (this.acc >= 1 / 30) {
        const step = this.acc;
        this.acc = 0;
        this.time += step;
        this.draw(step);
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.acc = 0;
  }

  /** Gradients + hill silhouettes are rebuilt only on a real resize. */
  private buildScenery(): void {
    const { ctx, width: w, height: h } = this;
    if (!ctx) return;

    // Warm Poki sunset palette: purple-grey top → burnt orange middle → warm peach horizon
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0,    "#4a3d6e");   // cool dusk purple at zenith
    sky.addColorStop(0.28, "#8a6070");   // mauve mid-sky
    sky.addColorStop(0.55, "#d4845a");   // burnt orange near horizon
    sky.addColorStop(0.78, "#e8a87c");   // warm amber
    sky.addColorStop(1,    "#f2c99a");   // peach glow at ground
    this.skyGrad = sky;

    // Haze bloom near the ground (warm golden ground fog)
    const haze = ctx.createLinearGradient(0, h * 0.6, 0, h);
    haze.addColorStop(0, "rgba(255, 210, 140, 0)");
    haze.addColorStop(1, "rgba(255, 195, 120, 0.30)");
    this.hazeGrad = haze;

    // Sun radial: placed at 62% across, 42% down (off-centre, matches Poki video)
    const sx = w * 0.62;
    const sy = h * 0.42;
    const sunR = Math.min(w, h) * 0.18;
    const sunGrad = ctx.createRadialGradient(sx, sy, sunR * 0.1, sx, sy, sunR * 2.2);
    sunGrad.addColorStop(0,   "rgba(255, 252, 230, 1.0)");
    sunGrad.addColorStop(0.2, "rgba(255, 240, 180, 0.95)");
    sunGrad.addColorStop(0.5, "rgba(255, 210, 100, 0.45)");
    sunGrad.addColorStop(0.8, "rgba(255, 185, 80,  0.18)");
    sunGrad.addColorStop(1,   "rgba(255, 160, 60,  0)");
    // Cache the glow with the rest of the per-resize scenery.
    this.sunGrad = sunGrad;
    this.sunX = sx;
    this.sunY = sy;
    this.sunR = sunR;

    // Bake the rotating god-rays once per resize (see field note).
    this.bakeRays();
    this.bakeSparkSprite();

    // Rolling hills: three layers with Poki video palette
    this.hillFar  = this.buildHill(0.60, 1.4, 1.9);   // back: purple moors
    this.hillMid  = this.buildHill(0.68, 1.2, 2.6);   // mid: teal meadow
    this.hillNear = this.buildHill(0.78, 1.0, 3.8);   // front: dark green
  }

  /** The god-ray layer, baked once per resize into an offscreen canvas. */
  private bakeRays(): void {
    const { width: w, height: h, sunR } = this;
    const rayLen = Math.min(w, h) * 0.85;
    this.rayLen = rayLen;
    if (typeof document === "undefined") { this.raysCanvas = null; return; }
    const size = Math.max(4, Math.ceil(rayLen * 2 * this.dpr));
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) { this.raysCanvas = null; return; }
    const c = size / 2;
    ctx.translate(c, c);
    ctx.scale(this.dpr, this.dpr);
    const rayCount = 12;
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;
      const halfW = (0.04 + (i % 3) * 0.018) * Math.PI;
      ctx.save();
      ctx.rotate(angle);
      const ray = ctx.createLinearGradient(sunR, 0, rayLen, 0);
      ray.addColorStop(0,   "rgba(255, 240, 180, 0.22)");
      ray.addColorStop(0.5, "rgba(255, 220, 120, 0.10)");
      ray.addColorStop(1,   "rgba(255, 200,  80, 0)");
      ctx.beginPath();
      ctx.moveTo(sunR, 0);
      ctx.arc(0, 0, rayLen, -halfW, halfW);
      ctx.closePath();
      ctx.fillStyle = ray;
      ctx.fill();
      ctx.restore();
    }
    this.raysCanvas = canvas;
  }

  /** A tiny radial glow sprite stamped per spark (replaces shadowBlur). */
  private bakeSparkSprite(): void {
    if (typeof document === "undefined") { this.sparkSprite = null; return; }
    const s = 32;
    const canvas = document.createElement("canvas");
    canvas.width = s;
    canvas.height = s;
    const ctx = canvas.getContext("2d");
    if (!ctx) { this.sparkSprite = null; return; }
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255, 250, 220, 1)");
    g.addColorStop(0.35, "rgba(255, 210, 110, 0.85)");
    g.addColorStop(0.7, "rgba(255, 180, 60, 0.35)");
    g.addColorStop(1, "rgba(255, 160, 40, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    this.sparkSprite = canvas;
  }

  private buildHill(baseY: number, amp: number, freq: number): Path2D | null {
    if (typeof Path2D === "undefined") return null;
    const { width: w, height: h } = this;
    const p = new Path2D();
    const y0 = h * baseY;
    p.moveTo(0, h);
    for (let x = 0; x <= w; x += 12) {
      const t = x / w;
      const y =
        y0 -
        Math.sin(t * Math.PI * freq + freq * 0.7) * (h * 0.045 * amp) -
        Math.sin(t * 7.3 + freq) * (h * 0.016 * amp);
      p.lineTo(x, y);
    }
    p.lineTo(w, h);
    p.closePath();
    return p;
  }

  private draw(dt: number): void {
    const w = this.width;
    const h = this.height;
    const ctx = this.ctx;
    if (!ctx) return;
    if (!this.skyGrad) this.buildScenery();

    // Sky background
    if (this.skyGrad) {
      ctx.fillStyle = this.skyGrad;
      ctx.fillRect(0, 0, w, h);
    }

    // Sun glow (behind everything else)
    const { sunX: sx, sunY: sy, sunR, sunGrad } = this;
    if (sunGrad) {
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, 0, w, h);
    }

    // Sun disc
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, sy, sunR, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 252, 210, 0.97)";
    ctx.fill();
    ctx.restore();

    // God-rays: the baked layer rotates as a single composited drawImage —
    // per-frame gradient creation + 12 arc fills used to dominate menu cost.
    if (this.raysCanvas) {
      const half = this.rayLen;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(this.time * 0.018);
      ctx.drawImage(this.raysCanvas, -half, -half, half * 2, half * 2);
      ctx.restore();
    }

    // Warm cloud bands (drift slowly)
    this.band(ctx, w, h, 0.33, 0.14, "rgba(255, 220, 170, 0.22)", 0.09);
    this.band(ctx, w, h, 0.25, 0.16, "rgba(255, 210, 155, 0.16)", 0.14);
    this.band(ctx, w, h, 0.44, 0.12, "rgba(230, 180, 140, 0.18)", 0.07);

    // Rolling hills — three layers matching the Poki video palette
    if (this.hillFar) {
      ctx.fillStyle = "#5e4878";   // back: cool purple moors
      ctx.fill(this.hillFar);
    }
    if (this.hillMid) {
      ctx.fillStyle = "#3a6b5a";   // mid: teal meadow
      ctx.fill(this.hillMid);
    }
    if (this.hillNear) {
      ctx.fillStyle = "#2e5445";   // front: deep forest green
      ctx.fill(this.hillNear);
    }

    // Ground haze bloom
    if (this.hazeGrad) {
      ctx.fillStyle = this.hazeGrad;
      ctx.fillRect(0, h * 0.6, w, h * 0.4);
    }

    // Distant flock
    for (const bird of this.birds) {
      if (dt > 0) this.step(bird, dt);
      this.drawFlocker(ctx, bird, w, h);
    }

    if (dt > 0) this.heroT += dt;
    this.drawHero();
  }

  /* ------------------------------------------------------- hero bird layer */

  /**
   * The hero canvas (z-index 3, above the paper card) carries ONE big
   * canonical sunbird flying left→right across the sky, passing in front of
   * the sun, trailing golden sparks — matching the Poki promotional video.
   * Under reduced motion: renders a single graceful static pose, no particles.
   */
  private drawHero(): void {
    const w = this.width;
    const h = this.height;
    const ctx = this.hctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    if (!this.heroActive || w < 2 || h < 2) return;

    const t = this.heroT;
    const wide = w >= 840;

    // Continuous left→right flight path with gentle sinusoidal drift,
    // passing at sun height (~40% down) on the wide layout.
    const speed = 0.04;                          // viewport-widths per second
    const xFrac = ((t * speed) % 1.24) - 0.12;  // wraps [-0.12 … 1.12]
    const cx = w * xFrac;
    const cy = wide
      ? h * (0.40 + 0.06 * Math.sin(t * 0.18 + 1.1))
      : h * (0.14 + 0.04 * Math.sin(t * 0.22 + 0.8));
    const size = Math.min(w, h) * (wide ? 0.16 : 0.11);
    const flap = FLAP_NEUTRAL + Math.sin(t * 2.3) * 0.52;

    // Store position for the particle emitter (called per-frame after draw).
    const tailX = cx - size * 0.55;   // tail is behind the body
    const tailY = cy + size * 0.18;

    // Emit new sparks from the tail (skip under reduced motion).
    if (!this.reduceMotion && xFrac > -0.05 && xFrac < 1.05) {
      for (let i = 0; i < 3; i++) {
        const angle = Math.PI + (Math.random() - 0.5) * 0.9;
        const spd = (1.5 + Math.random() * 2.5) * (size / 60);
        this.sparks.push({
          x: tailX + (Math.random() - 0.5) * size * 0.12,
          y: tailY + (Math.random() - 0.5) * size * 0.08,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd - 0.4 * (size / 60),
          life: 1,
          maxLife: 0.55 + Math.random() * 0.45,
          r: (1.2 + Math.random() * 2.0) * (size / 60),
        });
      }
    }

    // Update + draw sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i]!;
      const dt = 1 / 30;
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.vy += 0.08 * (size / 60);  // gentle gravity
      sp.life -= dt / sp.maxLife;
      if (sp.life <= 0) { this.sparks.splice(i, 1); continue; }
      const alpha = sp.life * 0.9;
      const radius = sp.r * (0.7 + sp.life * 0.5) * 3; // sprite carries the glow falloff
      if (this.sparkSprite) {
        // One stamped gradient sprite per spark; shadowBlur here cost a full
        // blur pass per particle per frame on phones.
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.drawImage(this.sparkSprite, sp.x - radius, sp.y - radius, radius * 2, radius * 2);
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.r * (0.7 + sp.life * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = "rgb(255, 210, 100)";
        ctx.fill();
        ctx.restore();
      }
    }

    // Draw the bird on top of the sparks
    ctx.save();
    ctx.translate(cx, cy);
    drawSunbird(ctx, size, flap, 0.95);
    ctx.restore();
  }

  /* ---------------------------------------------------------- distant flock */

  private step(bird: Flocker, dt: number): void {
    bird.x += bird.speed * dt;
    if (bird.x > 1.12) {
      bird.x = -0.12;
      bird.y = 0.06 + bird.depth * 0.34 + Math.random() * 0.16;
    }
    bird.flap += bird.flapRate * dt;
  }

  private band(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    baseY: number,
    height: number,
    color: string,
    drift: number,
  ): void {
    const y = h * baseY;
    const offset = (this.time * drift) % 1;
    ctx.fillStyle = color;
    for (let i = -1; i < 4; i++) {
      const cx = (i + offset) * (w / 3);
      const cw = w * 0.42;
      const ch = h * height;
      ctx.beginPath();
      ctx.ellipse(cx, y, cw, ch, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawFlocker(ctx: CanvasRenderingContext2D, bird: Flocker, w: number, h: number): void {
    const x = bird.x * w;
    const y = bird.y * h + Math.sin(this.time * 0.9 + bird.flap * 0.15) * (h * 0.004);
    // The shared bird is `size` px WIDE (64 units end to end), where the old
    // menu-local one spanned ~1.81 * size. Scaled up to match, so the flock
    // reads exactly as big on screen as it did before the extraction.
    const size = Math.max(11, 16 * bird.scale);
    // Centred on FLAP_NEUTRAL, not on zero: that is the pose the title-screen
    // bird is drawn in, so a ±0.5 beat sweeps the wings symmetrically through
    // it instead of hanging below it for most of the cycle.
    const flap = FLAP_NEUTRAL + Math.sin(bird.flap) * 0.5;

    // Every flock member is the same sunbird: near ones show full plumage,
    // far ones fade toward a deep-orange silhouette so they still read as
    // the hero bird at a distance.
    const dim = 0.5 + bird.depth * 0.5;
    ctx.save();
    ctx.translate(x, y);
    // The one canonical bird — same shape as the lobby and roster birds.
    drawSunbird(ctx, size, flap, dim);
    ctx.restore();
  }
}
