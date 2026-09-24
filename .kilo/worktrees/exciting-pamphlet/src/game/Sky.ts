import * as THREE from "three";
import { saturate, smoothstep } from "./math";
import { drawSunDisc } from "./Sunbird";
import type { TerrainPalette } from "./TerrainSystem";

type SkyStop = {
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
};

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
    },
  },
  {
    t: 0.4,
    s: {
      top: 0xe07038,
      horizon: 0xffb888,
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
    },
  },
  {
    t: 0.7,
    s: {
      top: 0x2e90e0,
      // Deeper saturated blue — no more white-sky wash.
      horizon: 0x50a8d8,
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
    },
  },
];

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

    this.sunGlow = makeGlow(0xffc86a, 76);
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

    this.palette = { farA: new THREE.Color(), farB: new THREE.Color(), farC: new THREE.Color() };
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
    const { a, b, u } = sampleStops(t);
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
    this.sunLight.intensity = 0.38 + t * 0.60;
    this.hemi.intensity = 0.72 + t * 0.40;

    // Keep the full daylight disc in the upper sky instead of clipping its crown.
    const elev = 22 + t * 64;
    this.sun.position.set(36 + (1 - t) * 28, elev, -110);
    this.sunGlow.position.copy(this.sun.position);
    (this.sun.material as THREE.SpriteMaterial).color.copy(this.mixHex(a.sun, b.sun, u));
    this.sun.scale.setScalar((0.7 + t * 0.3) * 20);

    this.moon.position.set(-8, 20 + (1 - t) * 68, -120);
    this.moonGlow.position.copy(this.moon.position);
    const night = 1 - t;
    this.moon.visible = night > 0.15;
    this.moonGlow.material.opacity = night * 0.55;

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
      mat.opacity = hazeAlpha * (0.72 + (phase % 1) * 0.25) * (this.hazeGlow ? 1.12 : 1);
    }

    this.group.position.set(camX, 0, 0);
    this.sunLight.position.set(camX + 48, 72, 36);
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

function sampleStops(daylight: number): { a: SkyStop; b: SkyStop; u: number } {
  const t = saturate(daylight);
  for (let i = 0; i < STOPS.length - 1; i++) {
    const cur = STOPS[i]!;
    const next = STOPS[i + 1]!;
    if (t >= cur.t && t <= next.t) {
      const u = (t - cur.t) / (next.t - cur.t);
      return { a: cur.s, b: next.s, u };
    }
  }
  const last = STOPS[STOPS.length - 1]!;
  return { a: last.s, b: last.s, u: 0 };
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
