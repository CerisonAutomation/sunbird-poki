import type { NetTransport, RemoteSnapshot } from "./MassRace";
import { truncate } from "./math";
import { gradeStateCadence, type LinkQuality } from "./RacePolish";
import { PROTOCOL_VERSION } from "./protocol/v1";
import { normalizeRooms, roomListUrl, type LiveRoom } from "./RoomBrowser";
import { POKI_MULTIPLAYER } from "./edition";
// PokiMpUtils is a tiny, dependency-free module so importing it here does
// not pull @poki/netlib into non-Poki bundles. The heavy PokiNetlibClient
// class lives in PokiNetlib.ts and is loaded only via dynamic import from
// Game.makeNet() on Poki builds.
import type { PokiNetlibClient } from "./PokiNetlib";
import {
  isPokiMultiplayerAvailable,
  makePokiRoomCode,
} from "./PokiMpUtils";

/**
 * Realtime multiplayer client for up to 40 concurrent pilots.
 *
 * Design notes that matter:
 *  • We send at a fixed 15 Hz, never per-frame — a 41-player room at 60 Hz
 *    would be ~2.4k msgs/sec of pure waste.
 *  • Remote birds are rendered from a 2-sample interpolation buffer held
 *    `INTERP_DELAY` behind server time. That is what makes other players look
 *    smooth instead of teleporting between packets.
 *  • Reconnection uses capped exponential backoff and preserves your seat via
 *    the persistent device id, so a dropped tunnel does not cost you the race.
 *  • Everything degrades: if the socket never opens, `connected` stays false
 *    and MassRace keeps flying local squadron pilots. The UI always states
 *    which one you are in.
 */

// Dev default: the vite /mp proxy is always present (vite.config.ts), so
// local multiplayer Just Works without an env file. Production must opt in
// via VITE_MULTIPLAYER_URL (portals ship with it explicitly emptied).
const URL_BASE = (import.meta.env.VITE_MULTIPLAYER_URL ?? (import.meta.env.DEV ? "/mp" : "")).trim();

/** Outbound state rate. 15 Hz is plenty given client-side interpolation. */
const SEND_HZ = 15;
const SEND_DT = 1 / SEND_HZ;
/** Render remote pilots this far in the past so we always interpolate. */
const INTERP_DELAY = 0.12;
const STALE_AFTER = 6;
const MAX_BACKOFF = 15000;

export type PresenceState = "offline" | "connecting" | "lobby" | "racing" | "error";

export type RoomPeer = {
  id: string;
  name: string;
  hue: number;
  skin: string;
  distance: number;
  place: number;
  finished: boolean;
  finishTime: number;
  emote: string;
  emoteAt: number;
  ready: boolean;
  you: boolean;
};

export type RoomInfo = {
  code: string;
  seed: string;
  count: number;
  capacity: number;
  state: PresenceState;
  startsInMs: number;
  error: string;
  /** Optimistic local ready state. The server only lists other peers. */
  ready: boolean;
  /** This transport has no AI fallback: every peer here is networked. */
  aiFallback: boolean;
};

/** A live multiplayer signal, surfaced as an in-flight toast by the game. */
export type PresenceEvent =
  | { type: "join"; name: string }
  | { type: "leave"; name: string }
  | { type: "ready"; name: string }
  | { type: "finish"; name: string; place: number }
  | { type: "start" }
  | { type: "welcome"; roomCode: string; seed: string }
  | { type: "interrupted"; message: string };

type Keyframe = { t: number; x: number; y: number; rot: number; vx?: number; vy?: number };

type Track = {
  id: string;
  name: string;
  hue: number;
  skin: string;
  buffer: Keyframe[];
  distance: number;
  finished: boolean;
  finishTime: number;
  /** Server-assigned finish place (0 until this pilot finishes). */
  place: number;
  emote: string;
  emoteAt: number;
  ready: boolean;
  lastSeen: number;
};

type ServerMsg =
  | { type: "welcome"; id: string; room: string; seed: string; capacity: number }
  | { type: "peers"; peers: { id: string; name: string; hue: number; skin: string; ready?: boolean }[] }
  | { type: "left"; id: string }
  | { type: "state"; t: number; pilots: [string, number, number, number, number][] }
  | { type: "emote"; id: string; emote: string }
  | { type: "finish"; id: string; time: number; place: number }
  | { type: "start"; at: number; seed: string }
  | { type: "error"; message: string };

/** Protocol-v1 gateway: live alongside the Rust authoritative service. The
 * browser still speaks the legacy simple protocol today, which the Rust server
 * serves on `/ws`; v1 (`/v1/ws`) is the migration target. */
export type ProtocolGatewayInfo = {
  supportedVersion: number;
  enabled: boolean;
  reason: string;
};

// ts-prune-ignore-next -- phase-2 surface, mirrored by rust/crates/sunbird-protocol
export function protocolGatewayInfo(): ProtocolGatewayInfo {
  return {
    supportedVersion: PROTOCOL_VERSION,
    enabled: true,
    reason: "authoritative-rooms-live",
  };
}

/**
 * The relay's public room list — who is racing right now.
 *
 * Reads only: the response carries room codes, seat counts and a host *name*,
 * never player ids, seat ids or tokens. A build with no relay configured gets
 * an empty list (and the menu says so) rather than a fabricated one.
 */
export async function fetchPublicRooms(base: string = URL_BASE, limit = 40): Promise<LiveRoom[]> {
  const url = roomListUrl(base, limit);
  if (!url) return [];
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Room list unavailable (${res.status})`);
  const body = (await res.json()) as { rooms?: unknown };
  return normalizeRooms(body.rooms);
}

/** Multiplayer is available when either:
 *   • a WebSocket relay URL is configured (VITE_MULTIPLAYER_URL, the
 *     Rust-authoritative server used by the direct build), OR
 *   • we're building for Poki and the browser supports WebRTC (Netlib P2P).
 *
 * The Poki build ships with VITE_MULTIPLAYER_URL emptied, so without Netlib
 * the check would incorrectly report "no multiplayer" and hide the PvP UI.
 */
export function isMultiplayerConfigured(): boolean {
  if (URL_BASE.length > 0) return true;
  // `POKI_MULTIPLAYER` is a compile-time per-target constant (edition module),
  // so the Poki transport never reaches — or names — another build's bundle.
  if (POKI_MULTIPLAYER) return isPokiMultiplayerAvailable();
  return false;
}

/** Short, unambiguous room codes — no 0/O or 1/I confusion when read aloud.
 * Uses the same alphabet on both transports so invite codes are interchangeable. */
export function makeRoomCode(): string {
  if (POKI_MULTIPLAYER) return makePokiRoomCode();
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

/** Union type covering both transports so Game.ts can instantiate whichever
 * is configured without branching at every call site. */
export type AnyRealtimeClient = RealtimeClient | PokiNetlibClient;

export class RealtimeClient implements NetTransport {
  state: PresenceState = "offline";
  roomCode = "";
  /** Our server-assigned finish place among live pilots (0 = none yet). */
  myPlace = 0;
  seed = "";
  capacity = 40;
  errorText = "";
  startsAt = 0;
  isAutonomous = false;
  private localReady = false;
  private requestedCode = "";
  private requestedSeed = "";
  /** True when the current connect() used an explicit room code (private
   *  room / invite link). On the welcome frame for such a connect the host's
   *  seed is authoritative and we emit a "welcome" event so Game.ts adopts
   *  their format+course. Matchmaking connects (seed-only) trust their own
   *  seed and ignore echoed seed changes. */
  private joinedByCode = false;

  private heartbeat = 0;
  private autoReadyTimer: number | null = null;

  private ws: WebSocket | null = null;
  private readonly tracks = new Map<string, Track>();
  private selfId = "";
  private sendAcc = 0;
  private clock = 0;
  private serverClock = 0;
  private lastStateFrameAt = -1;
  private readonly stateIntervals: number[] = [];
  private backoff = 500;
  private retryTimer: number | null = null;
  private connectTimer: number | null = null;
  private closedByUs = false;
  private pendingEmotes: { id: string; emote: string }[] = [];
  private pendingEvents: PresenceEvent[] = [];
  private lastSent = { x: 0, y: 0, rot: 0, d: 0 };

  constructor(
    private readonly deviceId: string,
    private name: string,
    private skin: string,
    private hue: number,
  ) {}

  get connected(): boolean {
    return (this.ws?.readyState === WebSocket.OPEN && this.state !== "error") || this.isAutonomous;
  }

  get id(): string {
    return this.selfId || this.deviceId;
  }

  activateAutonomousRoom(code?: string, seed?: string): void {
    // Deliberately empty of peers. This method had no caller and its only job
    // was to fill the roster with four hardcoded "pilots" (Zephyr Wing, Echo
    // Falcon, …) that the lobby then presented as live players. The AI fallback
    // that actually runs lives in the Poki transport, and it discloses itself
    // through RoomInfo.aiFallback.
    this.clearConnectTimer();
    if (this.retryTimer !== null) {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.isAutonomous = true;
    this.roomCode = (code || makeRoomCode()).toUpperCase();
    this.seed = seed || `${Date.now()}`;
    this.state = "lobby";
    this.errorText = "";
    this.tracks.clear();
  }

  /** Joins (or creates) a room. `code` empty = matchmake into a public room.
   *  When `codeIsRemote` is true the code was supplied by another player
   *  (friend invite / code entry), so on welcome we adopt their seed rather
   *  than forcing our own selection. */
  connect(code: string, seed: string, codeIsRemote = false): void {
    if (!URL_BASE) {
      this.state = "offline";
      this.errorText = "No multiplayer server configured";
      return;
    }
    // Idempotent: opening the lobby pre-seats us in a room; starting the race
    // must reuse that live socket, not tear it down and rejoin (which looked
    // like "PvP never has anyone in it" — we kept leaving the room we'd
    // just matched into).
    const requested = code.toUpperCase();
    const sameRoom = requested === this.requestedCode && (requested !== "" || seed === this.requestedSeed);
    if (sameRoom && this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.disconnect();
    this.closedByUs = false;
    this.requestedCode = code.toUpperCase();
    this.requestedSeed = seed;
    this.joinedByCode = codeIsRemote;
    this.roomCode = this.requestedCode;
    this.seed = seed;
    this.myPlace = 0;
    this.localReady = false;
    this.state = "connecting";
    this.errorText = "";
    this.open();
  }

  private open(): void {
    // URL_BASE may be absolute (wss://host) or relative (/mp behind the dev
    // proxy / same-origin edge). Resolve against the page and force ws(s).
    let socket: WebSocket;
    try {
      // `location` is always defined in the browser/jsdom contexts this runs
      // in — no fallback literal (a "http://localhost/" string in the bundle
      // gets flagged by portal scanners, even though it would never load).
      const url = new URL(URL_BASE, location.href);
      url.protocol = url.protocol === "https:" ? "wss:" : url.protocol === "http:" ? "ws:" : url.protocol;
      url.searchParams.set("device", this.deviceId);
      url.searchParams.set("name", this.name);
      url.searchParams.set("skin", this.skin);
      url.searchParams.set("hue", this.hue.toFixed(3));
      if (this.roomCode) url.searchParams.set("room", this.roomCode);
      if (this.seed) url.searchParams.set("seed", this.seed);

      socket = new WebSocket(url.toString());
    } catch {
      this.fail("Could not reach the race server");
      return;
    }
    this.ws = socket;
    this.clearConnectTimer();
    this.connectTimer = window.setTimeout(() => {
      if (this.ws !== socket) return;
      this.connectTimer = null;
      this.ws = null;
      socket.close();
      this.fail("Connection timed out. Leave the room and try again.");
    }, 10000);

    socket.onopen = () => {
      if (this.ws !== socket) return;
      this.clearConnectTimer();
      this.backoff = 500;
      this.state = "lobby";
      this.errorText = "";
    };
    socket.onmessage = (ev) => { if (this.ws === socket) this.onMessage(ev); };
    socket.onerror = () => {
      // `onclose` always follows; keep the retry logic in one place.
      this.errorText = "Connection problem";
    };
    socket.onclose = () => {
      if (this.ws !== socket) return;
      this.clearConnectTimer();
      const interrupted = this.state === "racing";
      const refused = this.state === "error";
      this.ws = null;
      this.localReady = false;
      this.startsAt = 0;
      this.tracks.clear();
      this.pendingEvents = [];
      this.pendingEmotes = [];
      if (this.closedByUs) {
        this.state = "offline";
        return;
      }
      if (interrupted) {
        // Protocol v0 cannot resume a race fairly. Never rejoin a new round
        // while the old simulation continues and pretend it is still live.
        this.myPlace = 0;
        this.fail("Race connection lost. Return to the lobby to race again.");
        this.pendingEvents.push({ type: "interrupted", message: this.errorText });
        return;
      }
      if (refused) return; // a rejected room is not a transient network outage
      this.state = "connecting";
      this.scheduleRetry();
    };
  }

  private scheduleRetry(): void {
    if (this.retryTimer !== null) return;
    const wait = this.backoff;
    this.backoff = Math.min(MAX_BACKOFF, Math.round(this.backoff * 1.8));
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null;
      if (!this.closedByUs) this.open();
    }, wait);
  }

  private fail(message: string): void {
    this.state = "error";
    this.errorText = message;
  }

  private clearConnectTimer(): void {
    if (this.connectTimer !== null) window.clearTimeout(this.connectTimer);
    this.connectTimer = null;
  }

  startNow(): void {
    if (this.isAutonomous || !this.connected) {
      this.state = "racing";
      this.startsAt = Date.now() + 100;
      this.pendingEvents.push({ type: "start" });
    } else {
      this.push({ type: "ready", ready: true });
    }
  }

  disconnect(): void {
    this.clearConnectTimer();
    // Tell the room we are leaving on purpose. Without this the server can
    // only see a dropped socket, so it holds the seat for the reconnect grace
    // window (30 s) and every other pilot still counts us as "connected" —
    // the room showed a ghost where a player had just left. A drop (crash,
    // tunnel change) still gets the grace window and is reaped by the server.
    this.push({ type: "leave" });
    this.closedByUs = true;
    if (this.retryTimer !== null) {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.autoReadyTimer !== null) {
      window.clearTimeout(this.autoReadyTimer);
      this.autoReadyTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      try {
        this.ws.close();
      } catch {
        /* already closing */
      }
      this.ws = null;
    }
    this.tracks.clear();
    this.pendingEvents = [];
    this.pendingEmotes = [];
    this.localReady = false;
    this.startsAt = 0;
    this.myPlace = 0;
    this.heartbeat = 0;
    this.roomCode = "";
    this.state = "offline";
    this.isAutonomous = false;
  }

  setIdentity(name: string, skin: string, hue: number): void {
    this.name = name;
    this.skin = skin;
    this.hue = hue;
  }

  private onMessage(ev: MessageEvent): void {
    let msg: ServerMsg;
    try {
      msg = JSON.parse(String(ev.data)) as ServerMsg;
    } catch {
      return; // Malformed frames are ignored rather than killing the session.
    }

    // A frame that parses but is malformed (missing a field the switch below
    // trusts, e.g. `{"type":"peers"}` with no `peers` array) must be dropped
    // just like an unparseable one — never let a hostile/buggy server throw
    // inside the socket handler.
    try {
      this.dispatch(msg);
    } catch {
      /* drop the malformed frame */
    }
  }

  private dispatch(msg: ServerMsg): void {
    switch (msg.type) {
      case "welcome":
        if (typeof msg.id !== "string") break;
        this.selfId = msg.id;
        this.roomCode = msg.room;
        this.seed = msg.seed || this.seed;
        this.capacity = msg.capacity || 40;
        this.state = "lobby";
        // When joining a friend's room by code, the host's seed is
        // authoritative — announce it so Game.ts adopts their format+course
        // instead of forcing the local default. Only fire on the first
        // welcome after a by-code connect; reconnects and seed-based
        // matchmaking (where we already chose our own seed) stay silent.
        if (this.joinedByCode && this.seed && this.seed !== this.requestedSeed) {
          this.pendingEvents.push({ type: "welcome", roomCode: this.roomCode, seed: this.seed });
        }
        this.joinedByCode = false;
        break;
      case "peers": {
        // `peers` is the room's authoritative roster, so anyone missing from it
        // has left. Dropping them here (not only on an explicit `left` frame)
        // keeps the lobby truthful: pilots still saw a departed player as
        // "connected" whenever the server's leave notice was coalesced,
        // missed during a reconnect, or the pilot switched rooms.
        const present = new Set<string>();
        for (const p of msg.peers) {
          if (typeof p.id === "string" && p.id !== this.selfId) present.add(p.id);
        }
        for (const id of [...this.tracks.keys()]) {
          if (present.has(id)) continue;
          const gone = this.tracks.get(id);
          if (gone && gone.name && gone.name !== "Pilot") this.pendingEvents.push({ type: "leave", name: gone.name });
          this.tracks.delete(id);
        }
        for (const p of msg.peers) {
          if (typeof p.id !== "string" || p.id === this.selfId) continue;
          const existing = this.tracks.get(p.id);
          const t = this.track(p.id);
          const wasReady = t.ready;
          t.name = typeof p.name === "string" ? truncate(p.name, 14) : t.name;
          t.hue = Number.isFinite(p.hue) ? p.hue : t.hue;
          t.skin = p.skin || t.skin;
          t.ready = Boolean(p.ready);
          t.lastSeen = this.clock;
          // New pilot seated → join signal; readied flag flipped → ready signal.
          if (!existing) {
            this.pendingEvents.push({ type: "join", name: t.name });
          } else if (t.ready && !wasReady) {
            this.pendingEvents.push({ type: "ready", name: t.name });
          }
        }
        break;
      }
      case "left": {
        const t = this.tracks.get(msg.id);
        if (t && t.name && t.name !== "Pilot") {
          this.pendingEvents.push({ type: "leave", name: t.name });
        }
        this.tracks.delete(msg.id);
        break;
      }
      case "state": {
        if (this.lastStateFrameAt >= 0) {
          const interval = this.clock - this.lastStateFrameAt;
          if (interval > 0 && interval < 3) {
            this.stateIntervals.push(interval);
            while (this.stateIntervals.length > 12) this.stateIntervals.shift();
          }
        }
        this.lastStateFrameAt = this.clock;
        this.serverClock = msg.t;
        for (const [id, x, y, rot, dist] of msg.pilots) {
          // Validate at the boundary: a non-finite coordinate (NaN/Infinity)
          // wouldn't throw, but it would poison the interpolation buffer and
          // corrupt the rival's rendered position forever.
          if (typeof id !== "string" || id === this.selfId) continue;
          if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(rot)) continue;
          const t = this.track(id);
          t.distance = Number.isFinite(dist) ? dist : t.distance;
          t.lastSeen = this.clock;
          // Derive velocity from the last keyframe for dead-reckoning.
          const prev = t.buffer[t.buffer.length - 1];
          const dt = prev ? Math.max(1e-4, msg.t - prev.t) : 1;
          const vx = prev ? (x - prev.x) / dt : 0;
          const vy = prev ? (y - prev.y) / dt : 0;
          t.buffer.push({ t: msg.t, x, y, rot, vx, vy });
          // Four keyframes: enough for smooth interpolation + 1 extra for dead-reckoning.
          while (t.buffer.length > 4) t.buffer.shift();
        }
        break;
      }
      case "emote": {
        if (msg.id === this.selfId) break;
        const t = this.track(msg.id);
        t.emote = msg.emote;
        t.emoteAt = this.clock;
        this.pendingEmotes.push({ id: msg.id, emote: msg.emote });
        break;
      }
      case "finish": {
        // The DO is the referee: it assigns places by arrival order of finish
        // messages. When the echo for OUR finish lands, keep the official
        // place so the result screen can correct the local estimate.
        if (msg.id === this.selfId) {
          this.myPlace = msg.place || 0;
          break;
        }
        const t = this.track(msg.id);
        t.finished = true;
        t.finishTime = msg.time;
        // Keep the rival's official place. Without this `roster()` reported
        // place 0 for every peer, so the lobby could never show who came in
        // where — the room flock said "finished" and nothing more.
        t.place = Number.isFinite(msg.place) ? msg.place : 0;
        this.pendingEvents.push({ type: "finish", name: t.name, place: t.place });
        break;
      }
      case "start":
        if (!Number.isFinite(msg.at) || this.state === "racing") break;
        this.myPlace = 0;
        this.startsAt = msg.at;
        this.seed = msg.seed || this.seed;
        this.state = "racing";
        // A new race clears the previous round: without this, a rematch in the
        // same room kept every pilot's old finish time/place on the roster and
        // the lobby showed last race's results as if they were live.
        for (const t of this.tracks.values()) {
          t.finished = false;
          t.finishTime = 0;
          t.place = 0;
          t.distance = 0;
          t.buffer.length = 0;
        }
        this.pendingEvents.push({ type: "start" });
        break;
      case "error":
        this.fail(typeof msg.message === "string" && msg.message.length > 0 ? msg.message : "Server refused the connection");
        break;
      default:
        break;
    }
  }

  private track(id: string): Track {
    let t = this.tracks.get(id);
    if (!t) {
      t = {
        id,
        name: "Pilot",
        hue: Math.random(),
        skin: "sunbird",
        buffer: [],
        distance: 0,
        finished: false,
        finishTime: 0,
        place: 0,
        emote: "",
        emoteAt: -99,
        ready: false,
        lastSeen: this.clock,
      };
      this.tracks.set(id, t);
    }
    return t;
  }

  /** Drives the send cadence and ages out silent peers. Call every frame. */
  tick(dt: number): void {
    this.clock += dt;
    this.sendAcc += dt;
    // Lobby pilots do not send movement frames. Presence is removed by the
    // server's explicit left frame, not by a six-second movement timeout.
    if (this.state === "racing") for (const [id, t] of this.tracks) {
      if (this.clock - t.lastSeen > STALE_AFTER) this.tracks.delete(id);
    }
    this.heartbeat += dt;
    if (this.connected && this.heartbeat >= 15) {
      this.heartbeat = 0;
      // Ready is also the legacy server's supported liveness message.
      this.push({ type: "ready", ready: this.localReady });
    }
  }

  send(x: number, y: number, rotation: number, distance: number): void {
    if (!this.connected) return;
    if (this.sendAcc < SEND_DT) return;
    this.sendAcc = 0;
    // Skip perfectly redundant frames (sitting in a menu, finished, etc).
    const moved =
      Math.abs(x - this.lastSent.x) > 0.05 ||
      Math.abs(y - this.lastSent.y) > 0.05 ||
      Math.abs(rotation - this.lastSent.rot) > 0.01;
    if (!moved) return;
    this.lastSent = { x, y, rot: rotation, d: distance };
    this.push({
      type: "state",
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      r: Math.round(rotation * 100) / 100,
      d: Math.round(distance),
    });
  }

  sendEmote(emote: string): void {
    this.push({ type: "emote", emote });
  }

  sendFinish(time: number, distance: number): void {
    this.push({ type: "finish", time: Math.round(time * 100) / 100, d: Math.round(distance) });
  }

  sendReady(ready: boolean): boolean {
    if (this.isAutonomous) {
      this.localReady = ready;
      if (this.autoReadyTimer !== null) {
        window.clearTimeout(this.autoReadyTimer);
        this.autoReadyTimer = null;
      }
      if (ready) {
        let delay = 350;
        const peers = Array.from(this.tracks.values());
        for (const peer of peers) {
          window.setTimeout(() => {
            if (!this.localReady) return;
            peer.ready = true;
            this.pendingEvents.push({ type: "ready", name: peer.name });
            if (peers.every((p) => p.ready)) {
              this.startsAt = Date.now() + 1000;
              this.autoReadyTimer = window.setTimeout(() => {
                if (this.localReady && this.state === "lobby") {
                  this.state = "racing";
                  this.pendingEvents.push({ type: "start" });
                }
              }, 1000);
            }
          }, delay);
          delay += 400;
        }
      } else {
        for (const peer of this.tracks.values()) {
          peer.ready = false;
        }
      }
      return true;
    }
    if (!this.connected || this.state !== "lobby") return false;
    this.localReady = ready;
    this.push({ type: "ready", ready });
    return true;
  }

  private push(payload: Record<string, unknown>): void {
    if (!this.connected) return;
    try {
      this.ws?.send(JSON.stringify(payload));
    } catch {
      /* socket died mid-send; onclose will handle the retry */
    }
  }

  /**
   * Interpolated snapshots for the renderer. We sample `INTERP_DELAY` behind
   * the newest packet, which converts jittery 15 Hz network data into smooth
   * 60 Hz motion.
   */
  poll(): RemoteSnapshot[] {
    const out: RemoteSnapshot[] = [];
    const renderAt = this.serverClock - INTERP_DELAY;
    for (const t of this.tracks.values()) {
      const b = t.buffer;
      if (b.length === 0) continue;

      let a = b[0]!;
      let c = b[b.length - 1]!;
      for (let i = 0; i < b.length - 1; i++) {
        if (b[i]!.t <= renderAt && b[i + 1]!.t >= renderAt) {
          a = b[i]!;
          c = b[i + 1]!;
          break;
        }
      }
      let rx: number;
      let ry: number;
      let rrot: number;
      if (renderAt > c.t) {
        // Dead reckoning: extrapolate from last keyframe using stored velocity.
        // Cap at 200ms ahead so a stalled remote bird doesn't fly off to infinity.
        const ahead = Math.min(0.2, renderAt - c.t);
        rx = c.x + (c.vx ?? 0) * ahead;
        ry = c.y + (c.vy ?? 0) * ahead;
        rrot = c.rot;
      } else {
        const span = Math.max(1e-4, c.t - a.t);
        const u = Math.max(0, Math.min(1, (renderAt - a.t) / span));
        rx = a.x + (c.x - a.x) * u;
        ry = a.y + (c.y - a.y) * u;
        rrot = a.rot + (c.rot - a.rot) * u;
      }
      out.push({
        id: t.id,
        name: t.name,
        x: rx,
        y: ry,
        rotation: rrot,
        finished: t.finished,
      });
    }
    return out;
  }

  /** Emotes received since the last call (drained). */
  drainEmotes(): { id: string; emote: string }[] {
    const out = this.pendingEmotes;
    this.pendingEmotes = [];
    return out;
  }

  /** Live presence signals (join/leave/ready/finish/start) since the last call. */
  drainEvents(): PresenceEvent[] {
    const out = this.pendingEvents;
    this.pendingEvents = [];
    return out;
  }

  /** Inbound race-state cadence; unknown until enough live frames arrive. */
  get connectionQuality(): LinkQuality {
    return gradeStateCadence(this.stateIntervals);
  }

  roster(): RoomPeer[] {
    const peers: RoomPeer[] = [];
    for (const t of this.tracks.values()) {
      peers.push({
        id: t.id,
        name: t.name,
        hue: t.hue,
        skin: t.skin,
        distance: t.distance,
        place: t.place,
        finished: t.finished,
        finishTime: t.finishTime,
        emote: this.clock - t.emoteAt < 2.5 ? t.emote : "",
        emoteAt: t.emoteAt,
        ready: t.ready,
        you: false,
      });
    }
    return peers;
  }

  info(): RoomInfo {
    return {
      code: this.roomCode,
      seed: this.seed,
      count: this.tracks.size + (this.connected || this.isAutonomous ? 1 : 0),
      capacity: this.capacity,
      state: this.state,
      startsInMs: this.startsAt > 0 ? Math.max(0, this.startsAt - Date.now()) : 0,
      error: this.errorText,
      ready: this.localReady,
      aiFallback: false,
    };
  }
}
