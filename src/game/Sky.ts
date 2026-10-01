import * as THREE from "three";
import { nightFillIntensity } from "./legibility";
import { saturate, smoothstep } from "./math";
import { drawSunDisc } from "./Sunbird";
import type { TerrainPalette } from "./TerrainSystem";

export type SkyStop = {
  top: number;
  horizon: number;
  bottom: number;
  fog: number;
  sun: number;
  farA: number;
  farB: number;
  farC: number;
  water: number;
  waterDeep: number;
  hemiSky: number;
  hemiGround: number;
  /**
   * Height of the sun disc above the horizon, in world units. Negative means
   * the sun is SET and only the moon is up. It lives in the palette rather than
   * in a formula in `update` for one reason: the sun's height and the colours
   * around it are the same fact. A run spends its daylight meter, so `t` falls
   * 1 -> 0 as the player flies, and the run ends at the sunset that spends it.
   * When the height was computed separately it had no way to know that, so it
   * climbed with `t` and the sun was still 22 units up at the exact moment the
   * run ended for running out of light — an entire sunset that never happened.
   * Anchoring it here means a new stop cannot be added with a colour that
   * disagrees with where its sun is.
   */
  sunElev: number;
};

/**
 * Half of one 8-bit colour step. An 8-bit channel quantises in 1/255, so a
 * sprite blended in below this alpha contributes less than half a step and
 * cannot move the output pixel. Sprites under it are skipped rather than
 * rasterised — the guard is the same idea as the deep-space layer skip below,
 * tightened to the point where it is provably invisible.
 */
const HAZE_MIN_ALPHA = 0.5 / 255;

const STOPS: { t: number; s: SkyStop }[] = [
  {
    t: 0,
    s: {
      top: 0x12102c,
      horizon: 0x1c1638,
      bottom: 0x0a0814,
      fog: 0x14101e,
      sun: 0xc8d0ff,
      farA: 0x1e2840,
      farB: 0x181e32,
      farC: 0x12141f,
      water: 0x142848,
      waterDeep: 0x0a1428,
      hemiSky: 0x32385e,
      hemiGround: 0x161820,
      sunElev: -20,
    },
  },
  {
    t: 0.18,
    s: {
      top: 0x3a2460,
      horizon: 0xc45a48,
      bottom: 0x6a2848,
      fog: 0x8a4060,
      sun: 0xffb070,
      farA: 0x6a3a58,
      farB: 0x4a2a58,
      farC: 0x2a2048,
      water: 0x2a4870,
      waterDeep: 0x142240,
      hemiSky: 0xe87850,
      hemiGround: 0x4a2838,
      sunElev: 6,
    },
  },
  {
    t: 0.4,
    s: {
      // Morning. The zenith was 0xe07038, an orange one, and that was the
      // second half of the grey-sky problem: this stop sat between a violet
      // dawn and a blue midday, so BOTH its zenith and its horizon had to
      // cross from warm to cool, and a warm-to-cool crossing always passes
      // through grey. A sky's zenith is blue and its horizon is warm; the two
      // are on opposite sides of the dome, so keeping them that way here is
      // what lets the stops either side stay saturated.
      top: 0x4a86c8,
      // Coral rather than the pale peach this was: a near-white endpoint
      // cannot hold saturation against a blue one no matter what sits between
      // them. Measured over the 0.4 -> 0.7 leg, the old pair bottomed out at
      // 1.8% — a dead grey sky, and one a run flies straight through.
      horizon: 0xe03829,
      bottom: 0xd06850,
      fog: 0xe8a070,
      sun: 0xffe0a0,
      farA: 0xc46a4a,
      farB: 0x8a4a62,
      farC: 0x4a3a62,
      water: 0x3a6a8a,
      waterDeep: 0x1a3a58,
      hemiSky: 0xffb080,
      hemiGround: 0x6a4030,
      sunElev: 40,
    },
  },
  {
    t: 0.7,
    s: {
      top: 0x2e90e0,
      // Deeper saturated blue — no more white-sky wash. The horizon moves with
      // it, to an azure that holds its chroma against the coral sunrise: this
      // pair now keeps 31.5% saturation at the worst point of the leg, where
      // the old pale-peach-to-cyan pair fell to 1.8%.
      horizon: 0x3c7fdd,
      bottom: 0x58a8cc,
      fog: 0x48a0c4,
      sun: 0xfff6c8,
      farA: 0x5aac6e,
      farB: 0x3e7a9a,
      farC: 0x3a5a90,
      water: 0x2a88c0,
      waterDeep: 0x144e7e,
      hemiSky: 0x78c4f8,
      hemiGround: 0x4e7e44,
      sunElev: 84,
    },
  },
  {
    t: 1,
    s: {
      top: 0x58b8f0,
      // Warm late-afternoon but no cream haze — clear golden light.
      horizon: 0xf0c080,
      bottom: 0xe0a870,
      fog: 0x90c8e0,   // clear sky blue instead of the smoggy cream
      sun: 0xfff0a8,
      farA: 0x78c884,
      farB: 0x60a0bc,
      farC: 0x6080b0,
      water: 0x38a0cc,
      waterDeep: 0x1e6088,
      hemiSky: 0xf0d8a0,
      hemiGround: 0x70a050,
      sunElev: 30,
    },
  },
  {
    // This stop exists to solve one problem, and its colour is chosen for that
    // reason rather than for how it looks on its own. Interpolating straight
    // from the t=0.7 blue (0x50a8d8) to the t=1 cream (0xf0c080) MUST pass
    // through grey: blue and cream are near-complements, so every blend on the
    // line between them is desaturated. Measured across that leg, horizon
    // saturation falls 63.0% -> 10.4% at t=0.88 — and the menu was pinned at
    // t=0.86, so the main menu was rendered a hair away from a dead grey sky.
    // A third stop on the far side of the wheel (rose, not a mid-grey) turns
    // the path into the one a real sunset takes — blue, then rose, then gold —
    // and the worst point on the leg rises to 33.7%.
    t: 0.82,
    s: {
      top: 0x6a7ad8,
      horizon: 0xc0509e,
      bottom: 0xb068a0,
      fog: 0x9c88bc,
      sun: 0xffd0a0,
      farA: 0x5f9a78,
      farB: 0x7a7aa8,
      farC: 0x8a5a90,
      water: 0x3a78b4,
      waterDeep: 0x2a3f7a,
      hemiSky: 0xd89ab8,
      hemiGround: 0x5a6a48,
      // Low and red, because this is the part of the day the run ends on.
      sunElev: 18,
    },
  },
];

// Sorted on load, because the lookup below finds the FIRST bracket whose `t`
// range contains the value and returns it. That makes a palette's CORRECTNESS
// depend on the order it happens to be typed in: a stop inserted out of order
// is silently never sampled, and the leg it was added to fix renders as if it
// were not there at all. Sorting makes the lookup depend only on the numbers.
STOPS.sort((x, y) => x.t - y.t);

export class Sky {
  readonly group = new THREE.Group();
  readonly fogColor = new THREE.Color(0x8ed0ee);
  readonly hemi: THREE.HemisphereLight;
  readonly sunLight: THREE.DirectionalLight;
  private readonly skyMat: THREE.ShaderMaterial;
  private readonly sun: THREE.Sprite;
  private readonly sunTex: THREE.CanvasTexture;
  private readonly sunGlow: THREE.Sprite;
  private readonly moon: THREE.Mesh;
  private readonly moonGlow: THREE.Sprite;
  private readonly milkyWay: THREE.Sprite;
  private readonly milkyWayTex: THREE.CanvasTexture;
  private readonly nebulas: THREE.Sprite[] = [];
  private readonly nebulaTex: THREE.CanvasTexture;
  private readonly planets: { mesh: THREE.Mesh; ring: THREE.Mesh | null; glow: THREE.Sprite }[] = [];
  private readonly satellite: THREE.Sprite;
  private satellitePhase = 0;
  private readonly haze: THREE.Sprite[] = [];
  private readonly hazeTex: THREE.CanvasTexture;
  private readonly water: THREE.Mesh;
  private readonly waterMat: THREE.ShaderMaterial;
  private readonly palette: TerrainPalette;
  private readonly tmpA = new THREE.Color();
  private readonly tmpB = new THREE.Color();
  // Scratch for the per-frame silhouette floor — reused so the legibility
  // pass never allocates inside the render loop.
  private readonly tmpC = new THREE.Color();
  private tintTop = 0xffffff;
  private tintHorizon = 0xffffff;
  private tintMix = 0;
  private altT = 0;
  private auroraIntensity = 0;
  private hazeTint = 0xffffff;
  private hazeDensity = 1;
  private hazeGlow = false;
  private shadowSpan = 80;
  private readonly topC = new THREE.Color();
  private readonly horizonC = new THREE.Color();
  private readonly bottomC = new THREE.Color();

  constructor() {
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x4aa0e8) },
        horizonColor: { value: new THREE.Color(0xa8e4ff) },
        bottomColor: { value: new THREE.Color(0x7ec8e8) },
        time: { value: 0 },
        aurora: { value: 0 },
      },
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 bottomColor;
        uniform float time;
        uniform float aurora;
        varying vec3 vWorld;
        void main() {
          vec3 dir = normalize(vWorld);
          float h = dir.y;
          vec3 col = mix(horizonColor, topColor, smoothstep(0.0, 0.62, h));
          col = mix(bottomColor, col, smoothstep(-0.35, 0.08, h));

          // Shimmering Aurora curtains in high altitude / polar skies
          if (aurora > 0.01 && h > 0.06) {
            float w1 = sin(dir.x * 6.5 + time * 1.3 + sin(dir.z * 4.5)) * 0.5 + 0.5;
            float w2 = cos(dir.x * 11.0 - time * 0.85 + dir.y * 5.5) * 0.5 + 0.5;
            float curtain = smoothstep(0.16, 0.74, w1 * w2) * smoothstep(0.06, 0.42, h) * smoothstep(0.96, 0.48, h);
            vec3 auroraCol = mix(vec3(0.18, 0.95, 0.7), vec3(0.85, 0.25, 0.95), w1);
            col += auroraCol * curtain * aurora * 0.92;
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(420, 24, 16), this.skyMat);
    this.group.add(skyMesh);

    // The in-flight sun is the *same* disc as the title screen's: painted by
    // Sunbird.drawSunDisc from SUN_STOPS, so the sun you start under and the
    // sun you fly toward are one object rather than a flat yellow ball.
    const sunCanvas = document.createElement("canvas");
    sunCanvas.width = 256;
    sunCanvas.height = 256;
    drawSunDisc(sunCanvas.getContext("2d")!, 128, 128, 128);
    this.sunTex = new THREE.CanvasTexture(sunCanvas);
    this.sunTex.colorSpace = THREE.SRGBColorSpace;
    this.sun = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.sunTex,
        color: 0xfff2b0,
        fog: false,
        toneMapped: false,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.group.add(this.sun);

    // A halo, not a whiteout. At 76 units with the sprite at its default
    // opacity of 1 and additive blending, the sun's glare washed out the sky
    // and the terrain silhouettes under it. Smaller, and dimmed per-frame below.
    this.sunGlow = makeGlow(0xffc86a, 54);
    this.group.add(this.sunGlow);

    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(7, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xe8eefc, fog: false, toneMapped: false }),
    );
    this.group.add(this.moon);
    this.moonGlow = makeGlow(0xb8c8ff, 32);
    this.group.add(this.moonGlow);


    // Deep-space scenery: a milky way band, drifting nebulae, a few planets
    // and a passing satellite. All of it stays dim at sea level and fades in
    // as the bird climbs toward the stratosphere, so the sky opens into space.
    this.milkyWayTex = makeMilkyWayTexture();
    this.milkyWay = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.milkyWayTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    this.milkyWay.scale.set(520, 300, 1);
    this.milkyWay.position.set(0, 120, -320);
    this.milkyWay.material.rotation = -0.5;
    this.group.add(this.milkyWay);

    this.nebulaTex = makeNebulaTexture();
    const nebulaDefs: { x: number; y: number; z: number; s: number; c: number }[] = [
      { x: -180, y: 150, z: -290, s: 240, c: 0x3a86c8 },
      { x: 190, y: 90, z: -270, s: 200, c: 0xb044c8 },
      { x: -40, y: 210, z: -310, s: 260, c: 0x28c8b0 },
    ];
    for (const n of nebulaDefs) {
      const mat = new THREE.SpriteMaterial({
        map: this.nebulaTex,
        color: n.c,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      const sp = new THREE.Sprite(mat);
      sp.scale.set(n.s, n.s, 1);
      sp.position.set(n.x, n.y, n.z);
      sp.userData.baseX = n.x;
      sp.userData.baseY = n.y;
      this.nebulas.push(sp);
      this.group.add(sp);
    }

    this.planets.push(this.makePlanet(-150, 150, -250, 26, 0xd8a06a, 0xc8905a, 34, 0.18));
    this.planets.push(this.makePlanet(180, 64, -235, 13, 0xb06a5a, 0x8a4a40, 0, 0));
    this.planets.push(this.makePlanet(40, 205, -295, 9, 0xa8d8f0, 0x7ab0d0, 0, 0));
    for (const p of this.planets) {
      this.group.add(p.mesh);
      if (p.ring) this.group.add(p.ring);
      this.group.add(p.glow);
    }

    this.satellite = makeGlow(0xffffff, 6);
    this.satellitePhase = Math.random() * Math.PI * 2;
    this.satellite.material.opacity = 0;
    this.satellite.position.set(0, 180, -240);
    this.group.add(this.satellite);

    // Soft, deep background cloud banks create altitude scale without adding
    // interaction noise. They are parallaxed independently from the hills.
    this.hazeTex = makeHazeTexture();
    for (let i = 0; i < 4; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.hazeTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
      });
      const sprite = new THREE.Sprite(mat);
      const baseX = -260 + i * 90 + (i % 3) * 13;
      const baseY = 16 + (i % 4) * 10;
      sprite.position.set(baseX, baseY, -50 - (i % 3) * 18);
      sprite.scale.set(38 + (i % 3) * 12, 13 + (i % 2) * 5, 1);
      sprite.userData.baseX = baseX;
      sprite.userData.baseY = baseY;
      sprite.userData.parallax = 0.14 + (i % 3) * 0.07;
      sprite.userData.phase = i * 1.73;
      this.haze.push(sprite);
      this.group.add(sprite);
    }

    this.waterMat = new THREE.ShaderMaterial({
      transparent: true,
      fog: false,
      uniforms: {
        time: { value: 0 },
        colorA: { value: new THREE.Color(0x3a98c8) },
        colorB: { value: new THREE.Color(0x1a5888) },
        camX: { value: 0 },
      },
      vertexShader: `
        uniform float time;
        uniform float camX;
        varying vec2 vUv;
        varying float vWave;
        void main() {
          vUv = uv;
          // NOTE: the plane already lives inside a group translated to camX,
          // so do NOT shift p.x by camX again (that doubled the scroll speed).
          // Use the world x only for the wave phase so the swell stays
          // anchored to world coordinates.
          float worldX = position.x + camX;
          vWave = sin(worldX * 0.11 + time * 1.8) * 0.4 + sin(worldX * 0.04 + time * 0.8) * 0.26;
          vec3 p = position;
          p.y += vWave;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 colorA;
        uniform vec3 colorB;
        varying vec2 vUv;
        varying float vWave;
        void main() {
          float foam = smoothstep(0.58, 0.98, vUv.y + vWave * 0.06);
          float crest = smoothstep(0.2, 0.48, vWave);
          vec3 col = mix(colorB, colorA, vUv.y);
          col = mix(col, vec3(0.92, 0.98, 1.0), (foam * 0.35 + crest * 0.2));
          gl_FragColor = vec4(col, 0.88);
        }
      `,
    });
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(2600, 260, 100, 1), this.waterMat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(0, 0.25, 6);
    this.group.add(this.water);

    this.hemi = new THREE.HemisphereLight(0xb0e0ff, 0x5a8a50, 1.1);
    this.sunLight = new THREE.DirectionalLight(0xfff4d0, 1.0);
    this.sunLight.position.set(40, 60, 30);
    this.sunLight.castShadow = true;
    const shadowRes = /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 700 ? 512 : 1024;
    this.sunLight.shadow.mapSize.width = shadowRes;
    this.sunLight.shadow.mapSize.height = shadowRes;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 280;
    this.sunLight.shadow.camera.left = -80;
    this.sunLight.shadow.camera.right = 80;
    this.sunLight.shadow.camera.top = 80;
    this.sunLight.shadow.camera.bottom = -80;
    this.sunLight.shadow.bias = -0.0006;

    this.palette = {
      farA: new THREE.Color(),
      farB: new THREE.Color(),
      farC: new THREE.Color(),
      skyHorizon: new THREE.Color(),
      skyBottom: new THREE.Color(),
    };
  }

  addLights(scene: THREE.Scene): void {
    scene.add(this.hemi);
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);
    scene.add(new THREE.AmbientLight(0xffecd6, 0.38));
  }

  /** Blend a world's signature sky over the time-of-day gradient. */
  setBiomeTint(top: number, horizon: number, mix: number): void {
    this.tintTop = top;
    this.tintHorizon = horizon;
    this.tintMix = mix;
  }

  /** 0..1 how far into space the bird is — deepens the blue and reveals the nebula. */
  setAltitude(t: number): void {
    this.altT = t;
  }

  setAurora(intensity: number): void {
    this.auroraIntensity = saturate(intensity);
  }

  setBiomeAtmosphere(tint: number, density: number, glow: boolean): void {
    this.hazeTint = tint;
    this.hazeDensity = density;
    this.hazeGlow = glow;
  }

  /** Keep the shadow frustum encompassing dramatic high-altitude flights. */
  setFlightAltitude(altitude: number): void {
    const span = Math.max(80, Math.min(340, 80 + altitude * 0.9));
    if (Math.abs(span - this.shadowSpan) < 5) return;
    this.shadowSpan = span;
    const cam = this.sunLight.shadow.camera as THREE.OrthographicCamera;
    cam.left = -span;
    cam.right = span;
    cam.top = span;
    cam.bottom = -span;
    cam.far = span * 3.2;
    cam.updateProjectionMatrix();
  }

  update(daylight: number, camX: number, time: number): TerrainPalette {
    (this.skyMat.uniforms.time!.value as number) = time;
    (this.skyMat.uniforms.aurora!.value as number) = this.auroraIntensity;
    const t = saturate(daylight);
    const { a, b, u } = skyStopsAt(t);
    // Sampled here rather than at the disc because the key light, the sun's own
    // height and its visibility all have to agree, and a second `sampleStops`
    // call per frame for each of them is how they would stop agreeing.
    const elev = a.sunElev + (b.sunElev - a.sunElev) * u;
    const top = this.topC.copy(this.mixHex(a.top, b.top, u));
    const horizon = this.horizonC.copy(this.mixHex(a.horizon, b.horizon, u));
    const bottom = this.bottomC.copy(this.mixHex(a.bottom, b.bottom, u));
    if (this.tintMix > 0) {
      top.lerp(this.tmpC.setHex(this.tintTop), this.tintMix);
      horizon.lerp(this.tmpC.setHex(this.tintHorizon), this.tintMix * 0.85);
      bottom.lerp(this.tmpC.setHex(this.tintHorizon), this.tintMix * 0.5);
    }
    // Climbing drains the sky toward deep space.
    if (this.altT > 0) {
      const deep = this.tmpC.setHex(0x0a1038);
      top.lerp(deep, this.altT * 0.9);
      horizon.lerp(this.tmpC.setHex(0x27407e), this.altT * 0.7);
    }
    (this.skyMat.uniforms.topColor!.value as THREE.Color).copy(top);
    (this.skyMat.uniforms.horizonColor!.value as THREE.Color).copy(horizon);
    (this.skyMat.uniforms.bottomColor!.value as THREE.Color).copy(bottom);
    this.fogColor.copy(this.mixHex(a.fog, b.fog, u));

    this.hemi.color.copy(this.mixHex(a.hemiSky, b.hemiSky, u));
    this.hemi.groundColor.copy(this.mixHex(a.hemiGround, b.hemiGround, u));
    this.sunLight.color.copy(this.mixHex(a.sun, b.sun, u));
    // Balanced key light: bright enough for crisp terrain, not so hot it blows out.
    // On the sun's own fade rather than a second threshold of its own, so the
    // light cannot outlive the disc that is supposed to be casting it.
    this.sunLight.intensity = (0.38 + t * 0.60) * smoothstep(0, 14, elev);
    // Night fill: without it the near terrain crushes to a flat black mass
    // after dusk and the player loses the ground they are about to hit. It is
    // exactly zero above 55% daylight, so the daytime look is untouched, and
    // it eases rather than ramps so the transition never reads as a light
    // switch being thrown. See src/game/legibility.ts.
    this.hemi.intensity = 0.72 + t * 0.40 + nightFillIntensity(t);

    // The sun's height comes from the palette (see `SkyStop.sunElev`), so the
    // disc rises and sets as the run spends its daylight instead of hanging
    // overhead for the whole flight. `t` falls 1 -> 0 across a run, so this arc
    // is traversed backwards: a run launches out of the t=1 late afternoon at
    // 30 units, climbs to the 84-unit midday peak, and comes down through the
    // rose stop to below the horizon — the sunset the run's own clock is
    // counting toward.
    // It also TRAVELS. A disc that only changes height reads as a sprite
    // sliding on a rail; a low sun that has moved is a sun that is going down.
    const sunX = 30 + (1 - t) * 30;
    this.sun.position.set(sunX, elev, -110);
    this.sunGlow.position.copy(this.sun.position);
    (this.sun.material as THREE.SpriteMaterial).color.copy(this.mixHex(a.sun, b.sun, u));
    // The disc also swells as it nears the horizon, which is what sells the
    // last part of the descent — at 20 units the sprite is a hard bright dot.
    this.sun.scale.setScalar((0.7 + t * 0.3) * (1 + (1 - saturate(elev / 84)) * 0.5) * 20);
    // The glow sprite's opacity was never set, so it sat at 1.0 all day. Half
    // strength keeps a warm halo while letting the sky and terrain stay legible.
    // It fades with the disc so the halo does not survive the sunset.
    const bodies = skyBodies(elev);
    (this.sunGlow.material as THREE.SpriteMaterial).opacity = (0.45 + t * 0.12) * bodies.sun;
    this.sun.visible = this.sunGlow.visible = bodies.sun > 0;

    // The moon is up only once the sun has gone down. It used to be gated on
    // `1 - t > 0.15`, which is true for most of a run, so a moon sat in the
    // sky beside a sun that was itself never setting. Two bodies at once is
    // not a lighting choice, it is the sky contradicting itself.
    this.moon.position.set(-8, 20 + (1 - t) * 68, -120);
    this.moonGlow.position.copy(this.moon.position);
    const night = 1 - t;
    this.moon.visible = this.moonGlow.visible = bodies.moon > 0;
    this.moonGlow.material.opacity = night * 0.55 * bodies.moon;

    // Space scenery fades in with altitude (the stratosphere opens out) and is
    // also present at night, so a midnight coast shows the full deep sky.
    const space = Math.max(saturate((0.25 - t) / 0.25), smoothstep(0.35, 0.9, this.altT));
    // When the space layer is fully transparent (daytime below the stratosphere)
    // skip it entirely rather than paying fill-rate + bloom cost on huge
    // additive sprites that contribute nothing. This is the single biggest
    // in-game frame-time win on weaker GPUs.
    const spaceOn = space > 0.005;
    this.milkyWay.visible = spaceOn;
    this.milkyWay.material.opacity = space * 0.32;
    for (const n of this.nebulas) {
      const nx = n.userData.baseX as number;
      const ny = n.userData.baseY as number;
      // Very slow drift so the nebulae feel alive, not painted on.
      n.position.x = nx + Math.sin(time * 0.02 + ny) * 14;
      n.position.y = ny + Math.cos(time * 0.015 + nx) * 10;
      n.visible = spaceOn;
      (n.material as THREE.SpriteMaterial).opacity = space * 0.09;
    }
    for (const p of this.planets) {
      p.mesh.visible = spaceOn;
      if (p.ring) p.ring.visible = spaceOn;
      p.glow.visible = spaceOn;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = space;
      if (p.ring) (p.ring.material as THREE.MeshBasicMaterial).opacity = space * 0.75;
      p.glow.material.opacity = space * 0.5;
    }
    // A satellite slowly crosses the deep sky.
    this.satellite.visible = spaceOn;
    this.satellite.material.opacity = space * 0.9;
    this.satellite.position.set(
      Math.sin(time * 0.05 + this.satellitePhase) * 320,
      150 + Math.cos(time * 0.03 + this.satellitePhase) * 60,
      -240,
    );

    // Background haze kept deliberately thin: altitude-readable banks, never
    // overcast. Density response is cut a second time (~50% again) because the
    // banks read as a grey wash over the hills rather than weather. Gameplay
    // clouds in Collectibles are untouched — these are atmosphere only.
    // Haze stays a very faint depth cue. Keep the horizon open so the bird,
    // terrain silhouette, and daylight meter remain readable on small screens.
    const hazeAlpha = (0.0004 + this.hazeDensity * 0.001) * (1 - this.altT * 0.8) * (0.5 + t * 0.5);
    for (const sprite of this.haze) {
      const mat = sprite.material as THREE.SpriteMaterial;
      const phase = sprite.userData.phase as number;
      const parallax = sprite.userData.parallax as number;
      sprite.position.x = (sprite.userData.baseX as number) - camX * (1 - parallax);
      sprite.position.y = (sprite.userData.baseY as number) + Math.sin(time * (0.09 + parallax * 0.08) + phase) * 1.2;
      mat.color.setHex(this.hazeTint);
      const opacity = hazeAlpha * (0.72 + (phase % 1) * 0.25) * (this.hazeGlow ? 1.12 : 1);
      // Sub-quantisation guard, same reasoning as the space layer above: an
      // 8-bit channel steps in 1/255, so a sprite whose blended contribution
      // is under half a step cannot change the output pixel — it is pure
      // fill-rate and a blended draw for nothing. The density numbers are far
      // below that (hazeAlpha peaks at 0.0014 for density 1, 0.00082 at the
      // densest biome's 0.42, i.e. 0.36 and 0.21 of a step), so this always
      // fires today. It is written against the per-sprite opacity rather than
      // hazeAlpha so it keeps telling the truth if the density curve is ever
      // retuned upwards: the haze comes back on its own instead of silently
      // becoming a lie.
      sprite.visible = opacity >= HAZE_MIN_ALPHA;
      mat.opacity = opacity;
    }

    this.group.position.set(camX, 0, 0);
    // Track the sun's height, so a low sun means long shadows and a set sun
    // means no direct light at all — the terrain currently stays lit from a
    // fixed 72-unit key all night, which is most of why dusk never reads as
    // dusk. The floor keeps the shadow camera's ortho box bounded: a light at
    // true horizon level throws shadows tens of islands long, and they get
    // clipped by the 160-unit box instead of lengthening.
    this.sunLight.position.set(camX + 48, Math.max(24, elev * 1.15), 36);
    this.sunLight.target.position.set(camX + 8, 10, 0);
    this.sunLight.target.updateMatrixWorld();

    this.water.position.set(0, 0.25, 6);
    this.waterMat.uniforms.time!.value = time;
    this.waterMat.uniforms.camX!.value = camX;
    (this.waterMat.uniforms.colorA!.value as THREE.Color).copy(this.mixHex(a.water, b.water, u));
    (this.waterMat.uniforms.colorB!.value as THREE.Color).copy(this.mixHex(a.waterDeep, b.waterDeep, u));

    this.palette.farA.copy(this.mixHex(a.farA, b.farA, u));
    this.palette.farB.copy(this.mixHex(a.farB, b.farB, u));
    this.palette.farC.copy(this.mixHex(a.farC, b.farC, u));
    // Silhouette floor. The distant hill bands are read against the sky
    // The silhouette floor used to live here, on `farA`/`farB`/`farC`. It is
    // applied by `TerrainSystem.setPalette` instead, because that is the last
    // hand to touch these colours: it blends them 55% toward the biome's own
    // band, and grading them beforehand meant most of the work was blended away
    // again. The sky travels on the palette so the floor can be applied to
    // what is actually rendered.
    this.palette.skyHorizon.copy(horizon);
    this.palette.skyBottom.copy(bottom);
    return this.palette;
  }

  dispose(): void {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Sprite) {
        obj.geometry.dispose();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
    this.sunTex.dispose();
    this.hazeTex.dispose();
    this.milkyWayTex.dispose();
    this.nebulaTex.dispose();
  }

  private mixHex(ha: number, hb: number, t: number): THREE.Color {
    return this.tmpA.setHex(ha).lerp(this.tmpB.setHex(hb), t);
  }

  /** A single distant planet — optionally ringed — with a soft glow halo. */
  private makePlanet(
    x: number,
    y: number,
    z: number,
    size: number,
    color: number,
    ringColor: number,
    ringSize: number,
    ringTilt: number,
  ): { mesh: THREE.Mesh; ring: THREE.Mesh | null; glow: THREE.Sprite } {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size, 18, 14),
      new THREE.MeshBasicMaterial({ color, fog: false, toneMapped: false, transparent: true, opacity: 0 }),
    );
    mesh.position.set(x, y, z);
    let ring: THREE.Mesh | null = null;
    if (ringSize > 0) {
      ring = new THREE.Mesh(
        new THREE.RingGeometry(size * 1.35, size * 2.1, 32),
        new THREE.MeshBasicMaterial({
          color: ringColor,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
          fog: false,
          toneMapped: false,
        }),
      );
      ring.position.copy(mesh.position);
      ring.rotation.set(Math.PI / 2 - ringTilt, ringTilt, 0);
    }
    const glow = makeGlow(color, size * 4);
    glow.position.copy(mesh.position);
    glow.material.opacity = 0;
    return { mesh, ring, glow };
  }


}

/**
 * How lit the sun and the moon are at a given sun height, each in 0..1.
 *
 * There is deliberately ONE threshold, at the horizon, with the two fades on
 * opposite sides of it. The gates used to be `smoothstep(-9, 5, elev)` for the
 * sun and `elev < 6` for the moon, whose visibilities overlapped across eight
 * units of elevation — a moon in the sky beside a sun that had not set, for a
 * measurable slice of every run. Splitting one threshold means the two can
 * never both be lit and can never both be dark, and the handoff is where the
 * eye expects it: the sun touching the horizon.
 */
/**
 * The palette table itself, in lookup order. Exported so "is every stop
 * actually reachable" is answerable: a stop no bracket can ever start is a
 * colour nobody will ever see, and nothing else in the type system says so.
 */
export function skyStops(): { t: number; s: SkyStop }[] {
  return STOPS;
}

export function skyBodies(elev: number): { sun: number; moon: number } {
  return { sun: smoothstep(0, 7, elev), moon: smoothstep(0, -7, elev) };
}

/**
 * Resolve the palette for a daylight level. Exported because the sky's colour
 * and elevation model is pure data, and the properties worth holding it to —
 * that the sun sets, that the sky never goes grey between two stops, that two
 * bodies are never both up — are all checkable without a WebGL context, which
 * a jsdom test does not have.
 */
export function skyStopsAt(daylight: number): {
  a: SkyStop;
  b: SkyStop;
  u: number;
  ta: number;
  tb: number;
} {
  const t = saturate(daylight);
  for (let i = 0; i < STOPS.length - 1; i++) {
    const cur = STOPS[i]!;
    const next = STOPS[i + 1]!;
    if (t >= cur.t && t <= next.t) {
      const u = (t - cur.t) / (next.t - cur.t);
      return { a: cur.s, b: next.s, u, ta: cur.t, tb: next.t };
    }
  }
  const last = STOPS[STOPS.length - 1]!;
  return { a: last.s, b: last.s, u: 0, ta: last.t, tb: last.t };
}

function makeMilkyWayTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 512, 512);
  g.translate(256, 256);
  g.rotate(-0.55);
  const band = g.createLinearGradient(0, -110, 0, 110);
  band.addColorStop(0, "rgba(150,170,220,0)");
  band.addColorStop(0.35, "rgba(200,205,240,0.32)");
  band.addColorStop(0.5, "rgba(215,215,245,0.5)");
  band.addColorStop(0.65, "rgba(200,205,240,0.32)");
  band.addColorStop(1, "rgba(150,170,220,0)");
  g.fillStyle = band;
  g.fillRect(-420, -110, 840, 220);
  // A smooth atmospheric band, without the old 1,400 speckle dots.
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeNebulaTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 256, 256);
  const grd = g.createRadialGradient(128, 128, 8, 128, 128, 128);
  grd.addColorStop(0, "rgba(255,255,255,0.7)");
  grd.addColorStop(0.35, "rgba(255,255,255,0.28)");
  grd.addColorStop(0.7, "rgba(255,255,255,0.08)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeHazeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const blobs: [number, number, number][] = [
    [65, 78, 46],
    [105, 62, 58],
    [151, 72, 54],
    [196, 82, 39],
    [130, 44, 34],
  ];
  for (const [x, y, r] of blobs) {
    const g = ctx.createRadialGradient(x, y, 4, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.96)");
    g.addColorStop(0.55, "rgba(255,255,255,0.52)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGlow(color: number, size: number): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,0.95)");
  grd.addColorStop(0.25, hexAlpha(color, 0.55));
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    toneMapped: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(size, size, 1);
  return s;
}

function hexAlpha(hex: number, a: number): string {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return "rgba(" + r + "," + g + "," + b + "," + a + ")";
}
