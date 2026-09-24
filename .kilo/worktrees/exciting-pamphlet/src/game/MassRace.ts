import * as THREE from "three";
import { Bird } from "./Bird";
import { BIRD_RADIUS } from "./constants";
import { LaunchSystem } from "./LaunchSystem";
import { clamp, lerp, SeededRandom, truncate } from "./math";
import type { TerrainSystem } from "./TerrainSystem";
import { generatePilotName } from "./pilotNameGenerator";

export const MAX_RIVALS = 40;

/** Metres behind the player before catch-up starts. Casual only. */
export const PACK_CATCHUP_START = 350;
export const PACK_CATCHUP_END = 800;
export const PACK_CATCHUP_RAMP = 150;
export const PACK_CATCHUP_RATE = 3.5;
export const PACK_CATCHUP_CAP = 195;

/** Extra vx this frame for a rival `lagMetres` behind the player. */
export function packCatchupDelta(lagMetres: number, dt: number, intensity = 1): number {
  if (!Number.isFinite(lagMetres) || !Number.isFinite(dt) || dt <= 0) return 0;
  if (lagMetres <= PACK_CATCHUP_START || lagMetres >= PACK_CATCHUP_END) return 0;
  const amp = clamp(Number.isFinite(intensity) ? intensity : 1, 0.5, 1.6);
  return dt * clamp((lagMetres - PACK_CATCHUP_START) / PACK_CATCHUP_RAMP, 0, 1) * PACK_CATCHUP_RATE * amp;
}

export function applyPackCatchup(vx: number, lagMetres: number, dt: number, intensity = 1): number {
  if (!Number.isFinite(vx)) return 0;
  return Math.min(PACK_CATCHUP_CAP, vx + packCatchupDelta(lagMetres, dt, intensity));
}

const OPTIMAL_LEAD = 70;

export type RivalKind = "local" | "remote";

export type AIArchetype = "apex" | "draft_hunter" | "soarer" | "daredevil" | "pacer" | "berserker" | "tactician";

export type Rival = {
  id: string;
  name: string;
  kind: RivalKind;
  bird: Bird;
  launch: LaunchSystem;
  prevX: number;
  prevY: number;
  lead: number;
  wobbleAmp: number;
  wobbleRate: number;
  wobblePhase: number;
  reaction: number;
  reactionT: number;
  diving: boolean;
  skill: number;
  hue: number;
  finished: boolean;
  finishTime: number;
  alive: boolean;
  ghost: boolean;
  archetype: AIArchetype;
  draftTime: number;
  lastEmoteTime: number;
  eliminated: boolean;
};

export type Standing = {
  id: string;
  name: string;
  distance: number;
  kind: RivalKind | "you";
  place: number;
  you: boolean;
  finished: boolean;
};

export type RosterBird = {
  id: string;
  name: string;
  hue: number;
  progress: number;
  place: number;
  you: boolean;
  remote: boolean;
  ghost: boolean;
  finished: boolean;
  emote: string;
};

export type RivalNameTag = {
  id: string;
  name: string;
  worldX: number;
  worldY: number;
  distance: number;
  place: number;
  remote: boolean;
  drafting: boolean;
  /** Active emote ("" when none) — rendered over the bird, not just in the ticker. */
  emote: string;
};

const DRAFT_BEHIND = 26;
const DRAFT_LATERAL = 6;
const DRAFT_MAX = 0.55;

export type RemoteSnapshot = { id: string; name: string; x: number; y: number; rotation: number; finished?: boolean };

export interface NetTransport {
  readonly connected: boolean;
  send(x: number, y: number, rotation: number, distance: number): void;
  poll(): RemoteSnapshot[];
}

/** Fallback short names for shuffle() and legacy callers; spawn() now uses the full pilot generator. */
const NAMES = [
  "Aria", "Kestrel", "Nomi", "Tavi", "Wren", "Bex", "Juno", "Pike", "Sable", "Fen",
  "Rook", "Vale", "Ivy", "Cass", "Odin", "Lux", "Nyx", "Brann", "Skye", "Ozzy",
  "Mira", "Dune", "Perch", "Halo", "Yuki", "Kite", "Ash", "Sol", "Vex", "Pip",
  "Corin", "Delta", "Echo", "Faye", "Gull", "Hex", "Iris", "Jax", "Koa", "Lark",
];

const tmpObj = new THREE.Object3D();
const tmpColor = new THREE.Color();
const tmpBellyColor = new THREE.Color();
const tmpWingColor = new THREE.Color();
const tmpTailColor = new THREE.Color();

export class MassRace {
  readonly group = new THREE.Group();
  rivals: Rival[] = [];

  // Instanced multi-component 3D Bird renderer
  private bodyMesh: THREE.InstancedMesh;
  private bellyMesh: THREE.InstancedMesh;
  private beakMesh: THREE.InstancedMesh;
  private eyeMesh: THREE.InstancedMesh;
  private wingLMesh: THREE.InstancedMesh;
  private wingRMesh: THREE.InstancedMesh;
  private tailMesh: THREE.InstancedMesh;

  private readonly bodyGeo = new THREE.SphereGeometry(0.62, 8, 6);
  private readonly bellyGeo = new THREE.SphereGeometry(0.42, 6, 5);
  private readonly beakGeo = new THREE.ConeGeometry(0.16, 0.42, 6);
  private readonly eyeGeo = new THREE.SphereGeometry(0.12, 6, 5);
  private readonly wingGeo = new THREE.SphereGeometry(0.44, 6, 5);
  private readonly tailGeo = new THREE.ConeGeometry(0.18, 0.55, 5);

  private readonly bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  private readonly bellyMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  private readonly beakMat = new THREE.MeshLambertMaterial({ color: 0xffc447, flatShading: true });
  private readonly eyeMat = new THREE.MeshBasicMaterial({ color: 0x2a1c28 });
  private readonly wingMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: true, opacity: 0.95 });
  private readonly tailMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

  private capacity = 0;
  private transport: NetTransport | null = null;
  private flapT = 0;
  draft = 0;
  draftBehind = DRAFT_BEHIND;
  draftMax = DRAFT_MAX;
  private emotes = new Map<string, { text: string; at: number }>();
  private clock = 0;
  /** Alternates full/dead-reckon frames for far-behind rivals (tiered fidelity). */
  private tierTick = 0;

  /**
   * Whether trailing rivals receive the catch-up push (see `step`). On for
   * casual fields, off wherever a result is rated or compared against other
   * people. Public because the UI has to be able to say which one is true.
   */
  private packBalancing = true;
  /** Casual FlowTuner intensity on catch-up. 1 = shipped feel. */
  private packIntensity = 1;

  constructor() {
    this.bodyMesh = new THREE.InstancedMesh(this.bodyGeo, this.bodyMat, 1);
    this.bellyMesh = new THREE.InstancedMesh(this.bellyGeo, this.bellyMat, 1);
    this.beakMesh = new THREE.InstancedMesh(this.beakGeo, this.beakMat, 1);
    this.eyeMesh = new THREE.InstancedMesh(this.eyeGeo, this.eyeMat, 1);
    this.wingLMesh = new THREE.InstancedMesh(this.wingGeo, this.wingMat, 1);
    this.wingRMesh = new THREE.InstancedMesh(this.wingGeo, this.wingMat, 1);
    this.tailMesh = new THREE.InstancedMesh(this.tailGeo, this.tailMat, 1);

    this.group.add(
      this.bodyMesh,
      this.bellyMesh,
      this.beakMesh,
      this.eyeMesh,
      this.wingLMesh,
      this.wingRMesh,
      this.tailMesh
    );
    this.group.visible = false;
  }

  addTo(scene: THREE.Scene): void {
    scene.add(this.group);
  }

  attachTransport(t: NetTransport | null): void {
    this.transport = t;
  }

  get active(): boolean {
    return this.group.visible && this.rivals.length > 0;
  }

  configureMode(modeId: string): void {
    if (modeId === "pvp_draft") {
      this.draftBehind = 38;
      this.draftMax = 0.85;
    } else if (modeId === "pvp_typhoon") {
      this.draftBehind = 34;
      this.draftMax = 0.75;
    } else if (modeId === "pvp_slalom") {
      this.draftBehind = 30;
      this.draftMax = 0.65;
    } else if (modeId === "pvp_zenith") {
      this.draftBehind = 32;
      this.draftMax = 0.6;
    } else if (modeId === "pvp_coinrush") {
      this.draftBehind = 28;
      this.draftMax = 0.6;
    } else {
      this.draftBehind = DRAFT_BEHIND;
      this.draftMax = DRAFT_MAX;
    }
  }

  eliminateTrailing(_thresholdDistance?: number): Rival | null {
    const active = this.rivals.filter(r => !r.eliminated && !r.finished && r.kind === "local");
    if (active.length === 0) return null;
    active.sort((a, b) => a.bird.x - b.bird.x);
    const lowest = active[0];
    if (lowest) {
      lowest.eliminated = true;
      lowest.alive = false;
      return lowest;
    }
    return null;
  }

  spawn(count: number, seed: string, terrain: TerrainSystem, startX: number): void {
    const n = clamp(Math.floor(count), 0, MAX_RIVALS);
    this.ensureCapacity(n);
    this.rivals = [];
    // 7-archetype mix: top pilots are apex/berserker/tactician; mid pack fills
    // in soarer/daredevil/draft_hunter; tail is padded with pacers.
    const ARCHETYPES: AIArchetype[] = [
      "apex", "draft_hunter", "soarer", "daredevil", "pacer", "berserker", "tactician",
    ];

    // Generate unique pilot names seeded from the race seed for determinism.
    const nameRng = new SeededRandom(`${seed}:names`);
    const usedNames = new Set<string>();

    for (let i = 0; i < n; i++) {
      const bird = new Bird();
      bird.reset(startX, terrain.heightAt(startX) + BIRD_RADIUS);
      const tierRank = i / Math.max(1, n);
      // Three-tier skill distribution: top 15% are elites, next 25% are strong,
      // the lower 60% are the approachable mid-to-tail field.
      const baseSkill =
        tierRank < 0.15 ? 0.88 + nameRng.range(0, 0.11)
        : tierRank < 0.4  ? 0.70 + nameRng.range(0, 0.14)
        :                    0.34 + nameRng.range(0, 0.32);
      const skill = clamp(baseSkill, 0.22, 1.0);

      // Elite slots bias toward apex/berserker/tactician; tail toward pacer.
      let archetype: AIArchetype;
      if (tierRank < 0.15) {
        archetype = (["apex", "berserker", "tactician"] as AIArchetype[])[i % 3]!;
      } else {
        archetype = ARCHETYPES[i % ARCHETYPES.length]!;
      }

      const errorSpread = (1 - skill) * 38;
      const lead = clamp(OPTIMAL_LEAD + nameRng.range(-errorSpread, errorSpread), 18, 125);

      // Generate a unique pilot name.
      let pilotName: string;
      let attempts = 0;
      do {
        pilotName = generatePilotName();
        attempts++;
      } while (usedNames.has(pilotName) && attempts < 10);
      usedNames.add(pilotName);

      this.rivals.push({
        id: `ai-${i}`,
        name: pilotName,
        kind: "local",
        bird,
        launch: new LaunchSystem(),
        prevX: bird.x,
        prevY: bird.y,
        lead,
        wobbleAmp: (1 - skill) * 15 + 1.5,
        wobbleRate: nameRng.range(0.30, 1.30),
        wobblePhase: nameRng.range(0, Math.PI * 2),
        // Apex and tactician have tighter reaction loops; daredevil is reckless-fast.
        reaction:
          archetype === "apex" ? 0.06 - skill * 0.04 + nameRng.range(0, 0.02)
          : archetype === "tactician" ? 0.09 - skill * 0.05 + nameRng.range(0, 0.03)
          : archetype === "daredevil" ? 0.08 - skill * 0.05 + nameRng.range(0, 0.04)
          : 0.14 - skill * 0.10 + nameRng.range(0, 0.04),
        reactionT: nameRng.range(0, 0.14),
        diving: false,
        skill,
        hue: nameRng.next(),
        finished: false,
        finishTime: 0,
        alive: true,
        ghost: false,
        archetype,
        draftTime: 0,
        lastEmoteTime: 0,
        eliminated: false,
      });
    }
    this.group.visible = n > 0;
  }

  clear(): void {
    for (const r of this.rivals) r.bird.dispose();
    this.rivals = [];
    this.group.visible = false;
    this.resetCounts(0);
  }

  kick(id: string): boolean {
    const i = this.rivals.findIndex((r) => r.id === id);
    if (i < 0) return false;
    const [r] = this.rivals.splice(i, 1)!;
    r!.bird.dispose();
    return true;
  }

  shuffle(seed: string): void {
    const n = this.rivals.length;
    if (!n) return;
    const rng = new SeededRandom(`${seed}:shuffle:${Date.now() % 100000}`);
    const names = [...NAMES].sort(() => rng.next() - 0.5);
    for (let i = 0; i < this.rivals.length; i++) {
      const r = this.rivals[i]!;
      r.name = names[i % names.length]!;
      r.skill = Math.min(1, Math.max(0.12, rng.next() * 0.9 + 0.1));
      r.hue = rng.next();
      r.finished = false;
      r.finishTime = 0;
    }
  }

  applyGhosts(rows: { name: string; distance: number }[], gate: number): number {
    const span = gate > 0 ? gate : 4000;
    const locals = this.rivals.filter((r) => r.kind === "local");
    let seated = 0;
    for (const row of rows) {
      const slot = locals[seated];
      if (!slot) break;
      const name = truncate(row.name.trim(), 14);
      if (!name) continue;
      const skill = clamp(0.3 + 0.6 * (row.distance / span), 0.3, 1);
      slot.name = name;
      slot.ghost = true;
      slot.skill = skill;
      slot.lead = clamp(OPTIMAL_LEAD + (1 - skill) * 40 * (seated % 2 === 0 ? 1 : -1), 18, 132);
      slot.wobbleAmp = (1 - skill) * 16 + 3;
      seated++;
    }
    return seated;
  }

  get remoteCount(): number {
    let n = 0;
    for (const r of this.rivals) if (r.kind === "remote") n++;
    return n;
  }

  /** Enables or disables the trailing-rival catch-up push. */
  setPackBalancing(on: boolean): void {
    this.packBalancing = on;
  }

  /** True while trailing rivals are being helped — the UI discloses this. */
  get packBalancingOn(): boolean {
    return this.packBalancing;
  }

  /** Casual-only intensity on the catch-up push. Ranked races never call this. */
  setPackIntensity(mult: number): void {
    this.packIntensity = clamp(mult, 0.5, 1.6);
  }

  setFieldSkill(mult: number): void {
    for (const r of this.rivals) {
      r.skill = Math.min(1, Math.max(0.1, r.skill * mult));
      r.lead = Math.min(132, Math.max(18, r.lead + (mult > 1 ? 6 : -6)));
    }
  }

  get fieldSize(): number {
    return this.rivals.length;
  }

  step(dt: number, terrain: TerrainSystem, finishLine: number, time: number, playerX?: number, playerY?: number): void {
    if (!this.group.visible) return;
    this.clock += dt;
    // Far-behind rivals alternate full/dead-reckon frames (see below).
    this.tierTick = (this.tierTick + 1) % 2;

    for (const r of this.rivals) {
      r.prevX = r.bird.x;
      r.prevY = r.bird.y;
      if (r.kind === "remote" || r.finished || r.eliminated) continue;

      // TIERED FIDELITY: a rival this far behind the player is off-camera,
      // cannot draft or interact, and its only jobs are staying plausible
      // and not missing the line. Dead-reckon it on the off frame — half
      // the field's physics cost with no visible difference (syncVisual
      // interpolates prev/current either way). Ahead-of-player rivals always
      // run full rate so no overtake or finish is ever missed.
      if (playerX !== undefined && playerX - r.bird.x > 300 && this.tierTick !== 0) {
        r.bird.justLaunched = false;
        r.bird.justLanded = false;
        r.bird.x += r.bird.vx * dt;
        const ground = terrain.heightAt(r.bird.x) + BIRD_RADIUS;
        if (r.bird.y < ground) {
          r.bird.y = ground;
          r.bird.vy = Math.abs(r.bird.vy) * 0.3;
        }
        if (finishLine > 0 && r.bird.x >= finishLine && !r.finished) {
          r.finished = true;
          r.finishTime = time;
        }
        continue;
      }

      r.reactionT -= dt;
      if (r.reactionT <= 0) {
        r.reactionT = r.reaction;
        const slope = terrain.slopeAt(r.bird.x);
        const distToCrest = terrain.distanceToCrest(r.bird.x);
        const judged = r.lead + Math.sin(time * r.wobbleRate + r.wobblePhase) * r.wobbleAmp;

        // Neural-level downslope & upslope awareness:
        let wantDive = false;
        if (slope < -0.05) {
          // Entering downslope: dive to carve and build kinetic speed!
          wantDive = true;
        } else if (slope > 0.04) {
          // On upslope: release to launch skyward!
          wantDive = false;
        } else {
          // Transition / crest: approach-based decision
          wantDive = distToCrest > judged;
        }

        // Per-archetype decision overrides
        switch (r.archetype) {
          case "apex":
            // Elite pilot: corrects for terrain slope more aggressively, ignores wobble noise.
            if (slope < -0.08) wantDive = true;
            else if (slope > 0.06) wantDive = false;
            break;
          case "soarer":
            // Prefers altitude; never dives unless falling fast.
            if (r.bird.vy > 3.5) wantDive = false;
            if (r.bird.altitude > 30 && slope >= 0) wantDive = false;
            break;
          case "daredevil":
            // Goes full dive-bomb at any reasonable altitude; loves crests.
            if (r.bird.altitude > 18) wantDive = true;
            if (distToCrest < 25) wantDive = false; // release right before crest for launch
            break;
          case "berserker":
            // Extremely aggressive: dives on every downslope, full throttle.
            if (slope < -0.03) wantDive = true;
            if (slope > 0.07) wantDive = false;
            break;
          case "tactician":
            // Energy-conservative: climbs patiently on uphills, then unleashes.
            if (slope > 0.02) wantDive = false;   // gain height
            if (slope < -0.06) wantDive = true;   // cash in altitude as speed
            break;
          case "draft_hunter":
            // Actively aligns behind the player or any rival for slipstream.
            if (playerX !== undefined) {
              const dx = playerX - r.bird.x;
              if (dx > 0 && dx < this.draftBehind && Math.abs(r.bird.y - (playerY ?? 0)) < 8) {
                wantDive = slope < 0 || distToCrest > 35;
              }
            }
            break;
          case "pacer":
            // Default pacer — uses the standard terrain-reading logic (no override).
            break;
        }

        r.diving = wantDive;
      }

      // Check slipstream drafting behind rivals or the player
      let draftingBehind = false;
      if (playerX !== undefined && playerY !== undefined) {
        const dx = playerX - r.bird.x;
        const dy = Math.abs((playerY ?? 0) - r.bird.y);
        if (dx > 0 && dx <= this.draftBehind && dy <= DRAFT_LATERAL) {
          draftingBehind = true;
        }
      }
      if (!draftingBehind) {
        for (const other of this.rivals) {
          if (other.id === r.id || other.finished || other.eliminated) continue;
          const dx = other.bird.x - r.bird.x;
          const dy = Math.abs(other.bird.y - r.bird.y);
          if (dx > 0 && dx <= this.draftBehind && dy <= DRAFT_LATERAL) {
            draftingBehind = true;
            break;
          }
        }
      }

      if (draftingBehind) {
        r.draftTime = (r.draftTime || 0) + dt;
        // Accelerate inside the slipstream!
        r.bird.vx = Math.min(210, r.bird.vx + dt * 5 * (0.8 + r.skill * 0.4));
        if (r.draftTime > 1.6 && r.bird.speed() > 22) {
          // Slingshot breakout!
          r.draftTime = 0;
          r.bird.vx = Math.min(225, r.bird.vx + 4.8);
          if (time - (r.lastEmoteTime || 0) > 8 && Math.random() < 0.28) {
            r.lastEmoteTime = time;
            this.showEmote(r.id, "🚀");
          }
        }
      } else {
        r.draftTime = Math.max(0, (r.draftTime || 0) - dt * 2);
      }

      // Dynamic pacer / pack drama + rubber-band catch-up:
      if (playerX !== undefined) {
        const lag = playerX - r.bird.x;
        // Standard pacer surge
        if ((r.archetype === "pacer" || lag > 150) && lag > 75 && lag < 450) {
          r.bird.vx = Math.min(185, r.bird.vx + dt * (lag > 220 ? 4.5 : 2.2));
        }
        // Pack balancing (the honest name for rubber-banding): a rival 350+ m
        // behind gets a catch-up push proportional to the gap, so a casual field
        // stays a *field* instead of a strung-out line nobody can see.
        //
        // Casual only. `setPackBalancing(false)` turns it off for ranked races,
        // duels and live rooms, where a hidden assist would be deciding a result
        // somebody is being rated on - and the lobby says so out loud either way
        // (see `renderRaceLobby`). An assist the player was never told about is
        // not a difficulty curve, it is a lie with a velocity vector.
        if (this.packBalancing && lag > 350 && lag < 800) {
          r.bird.vx = applyPackCatchup(r.bird.vx, lag, dt, this.packIntensity);
        }
        // Berserker pushes even harder when trailing
        if (r.archetype === "berserker" && lag > 100 && lag < 600) {
          r.bird.vx = Math.min(210, r.bird.vx + dt * 3.8);
        }
        // Tactician conserves speed when comfortably ahead to stay in "launch position"
        if (r.archetype === "tactician" && lag < -120) {
          r.bird.vx = Math.max(60, r.bird.vx - dt * 1.5);
        }
      }

      // AI emotes on overtake / archetype personality moments
      if (playerX !== undefined && r.bird.x > playerX && time - (r.lastEmoteTime || 0) > 12) {
        if (Math.random() < 0.22) {
          r.lastEmoteTime = time;
          // Archetype-flavoured taunt on overtake
          const taunt =
            r.archetype === "berserker" ? "💥" :
            r.archetype === "apex"      ? "⚡" :
            r.archetype === "tactician" ? "🎯" :
            r.archetype === "soarer"    ? "🌤️" :
            "👑";
          this.showEmote(r.id, taunt);
        }
      }

      r.launch.observeInput(r.diving, time);
      r.launch.tick(dt);
      r.bird.step(dt, { diving: r.diving, fever: false, speedMult: 0.92 + r.skill * 0.22, boost: false }, terrain);
      if (r.bird.justLaunched) r.launch.evaluate(r.bird, terrain, time);
      if (r.bird.justLanded && r.bird.landingQuality < 0.8) r.launch.breakCombo();

      if (finishLine > 0 && r.bird.x >= finishLine && !r.finished) {
        r.finished = true;
        r.finishTime = time;
      }
    }

    if (this.transport?.connected) this.applyRemote(this.transport.poll());
  }

  private applyRemote(snapshots: RemoteSnapshot[]): void {
    for (const snap of snapshots) {
      if (typeof snap.id !== "string" || !snap.id) continue;
      if (!Number.isFinite(snap.x) || !Number.isFinite(snap.y) || !Number.isFinite(snap.rotation)) continue;
      let rival = this.rivals.find((r) => r.id === snap.id);
      if (!rival) {
        rival =
          this.rivals.find((r) => r.kind === "local" && !r.ghost) ??
          this.rivals.find((r) => r.kind === "local");
        if (!rival) continue;
        rival.id = snap.id;
        rival.kind = "remote";
        rival.ghost = false;
      }
      rival.name = typeof snap.name === "string" ? truncate(snap.name, 14) : rival.name;
      rival.bird.x = snap.x;
      rival.bird.y = snap.y;
      rival.bird.rotation = snap.rotation;
      if (snap.finished) rival.finished = true;
    }
  }

  draftFor(x: number, y: number, dt: number): number {
    if (!this.group.visible) {
      this.draft = 0;
      return 1;
    }
    let best = 0;
    let packCount = 0;
    for (const r of this.rivals) {
      if (r.eliminated) continue;
      const dx = r.bird.x - x;
      if (dx <= 0 || dx > this.draftBehind) continue;
      const dy = Math.abs(r.bird.y - y);
      if (dy > DRAFT_LATERAL) continue;
      const along = 1 - dx / this.draftBehind;
      const lateral = 1 - dy / DRAFT_LATERAL;
      const factor = along * lateral;
      best = Math.max(best, factor);
      packCount++;
    }
    // Flock drafting train: drafting behind multiple birds enhances the slipstream up to +35%!
    const packMultiplier = packCount > 1 ? Math.min(1.35, 1 + (packCount - 1) * 0.15) : 1;
    const targetDraft = Math.min(1, best * packMultiplier);
    // Time-based exponential smoothing: a fixed per-frame factor would make the
    // draft build and release ~2.4x faster on a 144 Hz display than at 60 Hz.
    // Rate 9.75/s reproduces the old 0.15-per-frame feel exactly at 60 fps.
    this.draft += (targetDraft - this.draft) * (1 - Math.exp(-dt * 9.75));
    return 1 - this.draft * this.draftMax;
  }

  checkCloseCall(x: number, y: number, speed: number): { name: string; id: string } | null {
    if (!this.group.visible || speed < 16) return null;
    for (const r of this.rivals) {
      const dx = Math.abs(r.bird.x - x);
      const dy = Math.abs(r.bird.y - y);
      if (dx < 3.2 && dy < 2.2) {
        return { name: r.name, id: r.id };
      }
    }
    return null;
  }

  roster(playerX: number, startX: number, finishDistance: number, playerName: string, playerHue = 0.06): RosterBird[] {
    const span = finishDistance > 0 ? finishDistance : 4000;
    const list: RosterBird[] = this.rivals.filter(r => !r.eliminated).map((r) => ({
      id: r.id,
      name: r.name,
      hue: r.hue,
      progress: clamp((r.bird.x - startX) / span, 0, 1),
      place: 0,
      you: false,
      remote: r.kind === "remote",
      ghost: r.ghost && r.kind !== "remote",
      finished: r.finished,
      emote: this.emoteFor(r.id),
    }));
    list.push({
      id: "you",
      name: playerName,
      hue: playerHue,
      progress: clamp((playerX - startX) / span, 0, 1),
      place: 0,
      you: true,
      remote: false,
      ghost: false,
      finished: false,
      emote: this.emoteFor("you"),
    });
    list.sort((a, b) => b.progress - a.progress);
    list.forEach((r, i) => (r.place = i + 1));
    return list;
  }

  /** Visible rival name tag positions near the player for floating HUD badges */
  getVisibleNameTags(cameraX: number, playerX: number, playerY: number, startX: number): RivalNameTag[] {
    if (!this.group.visible) return [];
    const tags: RivalNameTag[] = [];
    const rivals = this.rivals;

    for (const r of rivals) {
      if (Math.abs(r.bird.x - cameraX) > 120) continue;
      const dx = r.bird.x - playerX;
      const dy = Math.abs(r.bird.y - playerY);
      // Per-mode zone (Tempest Draft widens it to 38m) — the tag must match
      // the physics zone, not the mode-default constant.
      const isDrafting = dx > 0 && dx <= this.draftBehind && dy <= DRAFT_LATERAL;

      // Place by counting birds ahead (rivals + player). Same answer as the
      // 41-row standings sort this used to run EVERY frame, without the sort
      // or the allocation — on the per-frame hot path.
      let place = 0;
      if (!r.eliminated) {
        place = 1 + (playerX > r.bird.x ? 1 : 0);
        for (const o of rivals) {
          if (!o.eliminated && o.bird.x > r.bird.x) place++;
        }
      }

      tags.push({
        id: r.id,
        name: r.name,
        worldX: r.bird.x,
        worldY: r.bird.y + 1.6,
        distance: Math.round(Math.max(0, r.bird.x - startX)),
        place,
        remote: r.kind === "remote",
        drafting: isDrafting,
        emote: this.emoteFor(r.id),
      });
    }
    return tags;
  }

  /** Show an emote over a bird ("you" for the player). Visible immediately —
   *  the stamp uses the current clock, and `emoteFor` expires it 2.5 s later,
   *  so no step() is needed for the bubble to exist. The sender's own
   *  feedback is `HUD.pulseEmote()` (Game.sendEmote), which does not depend on
   *  the sim clock advancing. */
  showEmote(id: string, text: string): void {
    this.emotes.set(id, { text, at: this.clock });
  }

  private emoteFor(id: string): string {
    const e = this.emotes.get(id);
    if (!e) return "";
    if (this.clock - e.at > 2.5) {
      this.emotes.delete(id);
      return "";
    }
    return e.text;
  }

  standings(playerX: number, playerStartX: number, playerName: string, limit = 8): { rows: Standing[]; place: number; total: number } {
    const rows: Standing[] = this.rivals.filter(r => !r.eliminated).map((r) => ({
      id: r.id,
      name: r.name,
      distance: Math.max(0, r.bird.x - playerStartX),
      kind: r.kind,
      place: 0,
      you: false,
      finished: r.finished,
    }));
    rows.push({
      id: "you",
      name: playerName,
      distance: Math.max(0, playerX - playerStartX),
      kind: "you",
      place: 0,
      you: true,
      finished: false,
    });
    rows.sort((a, b) => b.distance - a.distance);
    rows.forEach((r, i) => (r.place = i + 1));
    const place = rows.findIndex((r) => r.you) + 1;

    const youIdx = place - 1;
    const merged: Standing[] = [];
    const push = (r: Standing): void => {
      if (merged.length < limit && !merged.some((m) => m.id === r.id)) merged.push(r);
    };
    for (const r of rows.slice(0, Math.min(3, rows.length))) push(r);
    const from = clamp(youIdx - 1, 0, Math.max(0, rows.length - 1));
    for (const r of rows.slice(from)) push(r);
    for (const r of rows) push(r);
    return { rows: merged, place, total: rows.length };
  }

  /**
   * Render actual 3D birds with body, belly, beak, eyes, left wing, right wing, and tail
   * in single-pass instanced draw calls!
   */
  syncVisual(dt: number, cameraX: number, interp = 1): void {
    if (!this.group.visible) return;
    this.flapT += dt;

    let n = 0;
    for (const r of this.rivals) {
      if (r.eliminated) continue;
      if (Math.abs(r.bird.x - cameraX) > 260) continue;
      const flap = Math.sin(this.flapT * 14 + r.hue * 9) * 0.45;
      tmpColor.setHSL(r.hue, 0.68, r.kind === "remote" ? 0.68 : 0.58);

      const x = lerp(r.prevX, r.bird.x, interp);
      const y = lerp(r.prevY, r.bird.y, interp);
      const z = -3.5 - (r.hue - 0.5) * 5;
      const rotZ = r.bird.rotation * 0.9;

      // 1. Body
      tmpObj.position.set(x, y, z);
      tmpObj.rotation.set(0, 0, rotZ);
      tmpObj.scale.set(1.1, 0.9, 0.9);
      tmpObj.updateMatrix();
      this.bodyMesh.setMatrixAt(n, tmpObj.matrix);
      this.bodyMesh.setColorAt(n, tmpColor);

      // 2. Belly (lightened underbody)
      tmpObj.position.set(x + 0.08, y - 0.15, z + 0.02);
      tmpObj.scale.set(0.9, 0.65, 0.7);
      tmpObj.updateMatrix();
      this.bellyMesh.setMatrixAt(n, tmpObj.matrix);
      tmpBellyColor.copy(tmpColor).offsetHSL(0, -0.1, 0.15);
      this.bellyMesh.setColorAt(n, tmpBellyColor);

      // 3. Beak (bright amber cone)
      tmpObj.position.set(x + 0.72, y + 0.15, z);
      tmpObj.rotation.set(0, 0, rotZ - Math.PI / 2);
      tmpObj.scale.set(1, 1, 1);
      tmpObj.updateMatrix();
      this.beakMesh.setMatrixAt(n, tmpObj.matrix);

      // 4. Eyes (dark focal point)
      tmpObj.position.set(x + 0.4, y + 0.35, z + 0.35);
      tmpObj.rotation.set(0, 0, rotZ);
      tmpObj.scale.set(1, 1, 1);
      tmpObj.updateMatrix();
      this.eyeMesh.setMatrixAt(n, tmpObj.matrix);

      // 5. Left Wing (flapping upwards)
      tmpObj.position.set(x - 0.05, y + 0.15, z + 0.42);
      tmpObj.rotation.set(0, 0, rotZ + flap);
      tmpObj.scale.set(0.95, 0.2, 0.6);
      tmpObj.updateMatrix();
      this.wingLMesh.setMatrixAt(n, tmpObj.matrix);
      tmpWingColor.copy(tmpColor).offsetHSL(0, 0, 0.1);
      this.wingLMesh.setColorAt(n, tmpWingColor);

      // 6. Right Wing (flapping downwards)
      tmpObj.position.set(x - 0.05, y + 0.15, z - 0.42);
      tmpObj.rotation.set(0, 0, rotZ - flap);
      tmpObj.scale.set(0.95, 0.2, 0.6);
      tmpObj.updateMatrix();
      this.wingRMesh.setMatrixAt(n, tmpObj.matrix);
      this.wingRMesh.setColorAt(n, tmpWingColor);

      // 7. Tail (fanned tail feathers)
      tmpObj.position.set(x - 0.65, y + 0.05, z);
      tmpObj.rotation.set(0, 0, rotZ + Math.PI / 2.5);
      tmpObj.scale.set(1, 0.8, 1);
      tmpObj.updateMatrix();
      this.tailMesh.setMatrixAt(n, tmpObj.matrix);
      tmpTailColor.copy(tmpColor).offsetHSL(0, 0, -0.08);
      this.tailMesh.setColorAt(n, tmpTailColor);

      n++;
    }

    this.resetCounts(n);
    this.updateMatrixFlags();
  }

  private resetCounts(n: number): void {
    this.bodyMesh.count = n;
    this.bellyMesh.count = n;
    this.beakMesh.count = n;
    this.eyeMesh.count = n;
    this.wingLMesh.count = n;
    this.wingRMesh.count = n;
    this.tailMesh.count = n;
  }

  private updateMatrixFlags(): void {
    this.bodyMesh.instanceMatrix.needsUpdate = true;
    this.bellyMesh.instanceMatrix.needsUpdate = true;
    this.beakMesh.instanceMatrix.needsUpdate = true;
    this.eyeMesh.instanceMatrix.needsUpdate = true;
    this.wingLMesh.instanceMatrix.needsUpdate = true;
    this.wingRMesh.instanceMatrix.needsUpdate = true;
    this.tailMesh.instanceMatrix.needsUpdate = true;

    if (this.bodyMesh.instanceColor) this.bodyMesh.instanceColor.needsUpdate = true;
    if (this.bellyMesh.instanceColor) this.bellyMesh.instanceColor.needsUpdate = true;
    if (this.wingLMesh.instanceColor) this.wingLMesh.instanceColor.needsUpdate = true;
    if (this.wingRMesh.instanceColor) this.wingRMesh.instanceColor.needsUpdate = true;
    if (this.tailMesh.instanceColor) this.tailMesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.clear();
    this.bodyGeo.dispose();
    this.bellyGeo.dispose();
    this.beakGeo.dispose();
    this.eyeGeo.dispose();
    this.wingGeo.dispose();
    this.tailGeo.dispose();

    this.bodyMat.dispose();
    this.bellyMat.dispose();
    this.beakMat.dispose();
    this.eyeMat.dispose();
    this.wingMat.dispose();
    this.tailMat.dispose();

    this.bodyMesh.dispose();
    this.bellyMesh.dispose();
    this.beakMesh.dispose();
    this.eyeMesh.dispose();
    this.wingLMesh.dispose();
    this.wingRMesh.dispose();
    this.tailMesh.dispose();
  }

  private ensureCapacity(n: number): void {
    if (n <= this.capacity) {
      this.resetCounts(n);
      return;
    }
    this.group.remove(
      this.bodyMesh,
      this.bellyMesh,
      this.beakMesh,
      this.eyeMesh,
      this.wingLMesh,
      this.wingRMesh,
      this.tailMesh
    );

    this.bodyMesh.dispose();
    this.bellyMesh.dispose();
    this.beakMesh.dispose();
    this.eyeMesh.dispose();
    this.wingLMesh.dispose();
    this.wingRMesh.dispose();
    this.tailMesh.dispose();

    this.bodyMesh = new THREE.InstancedMesh(this.bodyGeo, this.bodyMat, n);
    this.bellyMesh = new THREE.InstancedMesh(this.bellyGeo, this.bellyMat, n);
    this.beakMesh = new THREE.InstancedMesh(this.beakGeo, this.beakMat, n);
    this.eyeMesh = new THREE.InstancedMesh(this.eyeGeo, this.eyeMat, n);
    this.wingLMesh = new THREE.InstancedMesh(this.wingGeo, this.wingMat, n);
    this.wingRMesh = new THREE.InstancedMesh(this.wingGeo, this.wingMat, n);
    this.tailMesh = new THREE.InstancedMesh(this.tailGeo, this.tailMat, n);

    this.group.add(
      this.bodyMesh,
      this.bellyMesh,
      this.beakMesh,
      this.eyeMesh,
      this.wingLMesh,
      this.wingRMesh,
      this.tailMesh
    );

    this.capacity = n;
  }
}
