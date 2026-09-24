/**
 * PokiNetlibClient — Poki Netlib (WebRTC P2P) multiplayer transport.
 *
 * Implements the same public surface as RealtimeClient so MassRace and Game
 * can drive either backend without forking the gameplay loop:
 *
 *   • Netlib is peer-to-peer over WebRTC datachannels (unreliable + reliable
 *     channels). There is no central server, so the creator of the lobby
 *     acts as the host for coordination events (start, ready count-down,
 *     finish ordering) while every peer broadcasts their own flight state.
 *   • Flight state goes over the 'unreliable' channel at 15 Hz, matching
 *     the WebSocket transport exactly. Ready/emote/finish/join go over
 *     'reliable' so they are never dropped.
 *   • Fallback: if Netlib fails to load or peers never connect, the room
 *     stays in "autonomous" mode with local AI pilots just like the empty
 *     WebSocket path does — multiplayer is always best-effort.
 *
 * See https://github.com/poki/netlib and developers.poki.com/guide/game-dev-tools.
 */
import { Network, type Peer, type LobbyListEntry } from "@poki/netlib";
import { generatePilotName } from "./pilotNameGenerator";
import type {
  NetTransport,
  RemoteSnapshot,
} from "./MassRace";
import { truncate } from "./math";
import { PROTOCOL_VERSION } from "./protocol/v1";
import { isPokiMultiplayerAvailable, makePokiRoomCode as makeRoomCode, POKI_NETLIB_GAME_ID as NETLIB_GAME_ID } from "./PokiMpUtils";
import { gradeStateCadence } from "./RacePolish";
import { normalizeRooms, sortRooms, type LiveRoom } from "./RoomBrowser";

/** Outbound state rate — same 15 Hz cadence as the WS transport. */
const SEND_HZ = 15;
const SEND_DT = 1 / SEND_HZ;
/** Render remote pilots this far in the past so we always interpolate. */
const INTERP_DELAY = 0.12;
const STALE_AFTER = 6;
const MAX_CAPACITY = 40;

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
  /** Round-trip latency in ms from the control channel ping (0 if unavailable). */
  latencyMs: number;
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
  ready: boolean;
  /**
   * True when this "room" is the local AI fallback rather than networked
   * pilots. The roster is populated either way, so without this flag the lobby
   * presents four generated pilots as live players — the one thing
   * `lobbyRivals` promises never to do. Callers use it to label them as AI.
   */
  aiFallback: boolean;
};

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
  /** Finish place as agreed in this room (0 until the host assigns one). */
  place: number;
  emote: string;
  emoteAt: number;
  ready: boolean;
  lastSeen: number;
};

/** Reliable messages between peers. */
type NetMsg =
  | { type: "hello"; name: string; hue: number; skin: string; v: number }
  | { type: "ready"; ready: boolean }
  | { type: "emote"; emote: string }
  | { type: "finish"; time: number; d: number }
  | { type: "start"; at: number; seed: string }
  | { type: "place"; id: string; place: number };

// `isPokiMultiplayerAvailable`, `makeRoomCode`) were re-exported here
// but all callers now import directly from ./PokiMpUtils. Kept as a
// historical note; the module itself is not dead — `POKI_NETLIB_GAME_ID`
// is consumed here (NETLIB_GAME_ID is its alias).

export class PokiNetlibClient implements NetTransport {
  state: PresenceState = "offline";
  roomCode = "";
  myPlace = 0;
  seed = "";
  capacity = MAX_CAPACITY;
  errorText = "";
  startsAt = 0;
  isAutonomous = false;
  private localReady = false;
  private requestedCode = "";
  private requestedSeed = "";
  private heartbeat = 0;
  private autoReadyTimer: number | null = null;
  /** True when we created the lobby (host) — we send the "start" sync. */
  private amHost = false;
  /** A finish-order counter used by the host to assign places authoritatively. */
  private finishOrder = 0;
  /** Last phase published to the public lobby entry (host only). */
  private announcedPhase: "lobby" | "racing" = "lobby";
  private finishedPeers = new Set<string>();

  private net: Network | null = null;
  private netReady = false;
  private readonly tracks = new Map<string, Track>();
  private selfId = "";
  private sendAcc = 0;
  private clock = 0;
  /** Our interpolation clock is driven by local time + timestamps from the host. */
  private serverClock = 0;
  /** Inbound state intervals, for the link-quality grade (see Realtime). */
  private readonly stateIntervals: number[] = [];
  private pendingEmotes: { id: string; emote: string }[] = [];
  private pendingEvents: PresenceEvent[] = [];
  private lastSent = { x: 0, y: 0, rot: 0, d: 0 };
  private peerInfo = new Map<string, { name: string; hue: number; skin: string }>();
  private connectedPeers = new Set<string>();
  /** Peers we have already answered a hello to (one reply per peer, ever). */
  private readonly greeted = new Set<string>();
  private boundHandlers: Array<() => void> = [];
  private closedByUs = false;

  constructor(
    private readonly deviceId: string,
    private name: string,
    private skin: string,
    private hue: number,
  ) {
    this.selfId = deviceId;
  }

  get connected(): boolean {
    return this.netReady || this.isAutonomous;
  }

  /** Inbound cadence grade — "unknown" until enough peer state has arrived. */
  get connectionQuality(): "unknown" | "good" | "fair" | "poor" {
    return gradeStateCadence(this.stateIntervals);
  }

  get id(): string {
    return this.selfId || this.net?.id || this.deviceId;
  }

  /** Spawn autonomous local-AI pilots as a fallback room. */
  activateAutonomousRoom(code?: string, seed?: string): void {
    this.shutdownNet();
    this.isAutonomous = true;
    this.roomCode = (code || makeRoomCode()).toUpperCase();
    this.seed = seed || `${Date.now()}`;
    this.state = "lobby";
    this.errorText = "";
    this.tracks.clear();

    const SKINS = ["phoenix", "aurora", "solstice", "stormcrow", "sunbird", "midnight"];
    const mockPeers = Array.from({ length: 4 }, (_, i) => ({
      id: `auto_${i + 1}`,
      name: generatePilotName(),
      skin: SKINS[i % SKINS.length]!,
      hue: (i * 0.21 + 0.08) % 1,
    }));
    for (const p of mockPeers) {
      const t = this.track(p.id);
      t.name = p.name;
      t.skin = p.skin;
      t.hue = p.hue;
      t.ready = false;
    }
  }

  connect(code: string, seed: string): void {
    const requested = code.toUpperCase();
    const same = requested === this.requestedCode && this.netReady;
    if (same && this.net?.currentLobby) return;

    this.disconnect();
    this.closedByUs = false;
    this.requestedCode = requested;
    this.requestedSeed = seed;
    this.roomCode = requested;
    this.seed = seed;
    this.myPlace = 0;
    this.localReady = false;
    this.state = "connecting";
    this.errorText = "";
    this.amHost = !requested; // empty code → we are creating a public lobby
    this.finishOrder = 0;
    this.finishedPeers.clear();

    if (!isPokiMultiplayerAvailable()) {
      this.activateAutonomousRoom(requested, seed);
      return;
    }
    this.open();
  }

  private open(): void {
    try {
      const network = new Network(NETLIB_GAME_ID);
      this.net = network;

      const onReady = async () => {
        this.netReady = true;
        this.selfId = network.id || this.deviceId;
        this.state = "lobby";
        this.errorText = "";
        try {
          if (this.requestedCode) {
            // join() returns the LobbyListEntry for the lobby we joined
            network.join(this.requestedCode).then((info) => {
              if (info) {
                this.roomCode = this.requestedCode.toUpperCase();
                this.capacity = info.maxPlayers || MAX_CAPACITY;
                this.amHost = info.leader === network.id;
                // Compare against what we ASKED for: onLobby has already
                // adopted the room's seed by the time join() resolves, so the
                // old comparison could never differ and the "welcome" event
                // (which is what tells the game to switch course/format) never
                // fired on this transport.
                const prevSeed = this.requestedSeed || this.seed;
                const incoming = String(info.customData?.seed ?? this.seed);
                // Announce a seed change only when we are NOT the host —
                // i.e. we joined a friend's room whose format/course differs
                // from what we selected locally. Hosting or reconnecting must
                // not fire a spurious "welcome" event.
                if (!this.amHost && incoming && incoming !== prevSeed) {
                  this.pendingEvents.push({ type: "welcome", roomCode: this.roomCode, seed: incoming });
                }
                this.seed = incoming;
              }
              this.state = "lobby";
              this.sendHelloAll();
            }).catch((err) => {
              this.fail(`Could not join room ${this.requestedCode}: ${String(err).slice(0, 80)}`);
            });
          } else {
            // QUICK MATCH: browse public lobbies before creating. Join the
            // first non-full sunbird-race lobby (preferring the lowest
            // latency slot). Only create a new public lobby when nothing
            // is available so pilots find each other instead of fragmenting
            // into a forest of empty rooms.
            let joined = false;
            try {
              // Push mode + availability filtering to the signaling server
              // (MongoDB-style operators) so we only receive joinable sunbird
              // lobbies — avoids downloading lobbies from other games sharing
              // the same game-id bucket, and reduces client-side sort cost.
              const lobbies = await network.list(
                {
                  $and: [
                    { public: { $eq: true } },
                    { hasPassword: { $eq: false } },
                    { playerCount: { $gt: 0 } },
                    { "customData.mode": { $eq: "sunbird-race" } },
                  ],
                },
                { playerCount: -1 },
                20,
              );
              const candidate = (lobbies ?? [])
                .filter((l) =>
                  l &&
                  l.code &&
                  l.playerCount < (l.maxPlayers || MAX_CAPACITY),
                )
                .sort((a, b) => {
                  // prefer fuller rooms (faster start) and then lower latency
                  const fillA = a.playerCount / Math.max(1, a.maxPlayers || MAX_CAPACITY);
                  const fillB = b.playerCount / Math.max(1, b.maxPlayers || MAX_CAPACITY);
                  if (Math.abs(fillA - fillB) > 0.05) return fillB - fillA;
                  return (a.latency ?? 9999) - (b.latency ?? 9999);
                })[0];
              if (candidate) {
                const info = await network.join(candidate.code);
                if (info) {
                  this.roomCode = candidate.code.toUpperCase();
                  this.capacity = info.maxPlayers || candidate.maxPlayers || MAX_CAPACITY;
                  this.amHost = info.leader === network.id;
                  // Same as the by-code path: the seed we asked for, not the
                  // one onLobby just adopted, is the thing to compare against.
                  const prevSeed = this.requestedSeed || this.seed;
                  const incoming = String(info.customData?.seed ?? candidate.customData?.seed ?? this.seed);
                  // Quick-match found a public lobby running a different
                  // format/world than we asked for — adopt it.
                  if (!this.amHost && incoming && incoming !== prevSeed) {
                    this.pendingEvents.push({ type: "welcome", roomCode: this.roomCode, seed: incoming });
                  }
                  this.seed = incoming;
                  joined = true;
                  this.state = "lobby";
                  this.sendHelloAll();
                }
              }
            } catch {
              /* list or join failed — fall through to create */
            }
            if (!joined) {
              network.create({
                public: true,
                maxPlayers: this.capacity,
                customData: { seed: this.seed, mode: "sunbird-race", v: PROTOCOL_VERSION, phase: "lobby" },
                codeFormat: "short",
                codeLength: 5,
              }).then((lobbyCode: string) => {
                this.roomCode = lobbyCode.toUpperCase();
                this.requestedCode = this.roomCode;
                this.amHost = true;
              }).catch((err) => {
                this.fail(`Failed to create room: ${String(err).slice(0, 80)}`);
              });
            }
          }
        } catch (err) {
          this.fail(String(err).slice(0, 120));
        }
      };

      const onLobby = (code: string, info: LobbyListEntry) => {
        // Fires for our own create()/join() resolution and for lobby
        // updates (maxPlayers, customData changes, etc). The leader field
        // is authoritative.
        this.roomCode = code.toUpperCase();
        this.requestedCode = this.roomCode;
        this.capacity = info.maxPlayers || MAX_CAPACITY;
        this.amHost = info.leader === network.id;
        if (info.customData?.seed && typeof info.customData.seed === "string") {
          this.seed = info.customData.seed;
        }
        // Note: we do NOT broadcast a hello here — 'connected' (per-peer)
        // and the join()/create() resolution paths handle directed hellos.
        // A lobby-wide hello on every lobby update is N*N noise that can
        // re-fire "joined" toasts for peers we already see.
      };

      const onLeader = (leader: string) => {
        this.amHost = leader === network.id;
      };

      const onConnecting = (_peer: Peer) => {
        // waiting for ICE to complete; nothing to do yet
      };

      const onConnected = (peer: Peer) => {
        this.connectedPeers.add(peer.id);
        // Send a directed hello to the newly-connected peer (broadcast would
        // re-notify everyone, spurious join events). Peers answer hello with
        // a hello of their own so both sides get the 'join' event.
        try {
          network.send("reliable", peer.id, JSON.stringify({ type: "hello", name: this.name, hue: this.hue, skin: this.skin, v: PROTOCOL_VERSION }));
        } catch {
          /* ignore */
        }
      };

      const onDisconnected = (peer: Peer) => {
        this.connectedPeers.delete(peer.id);
        this.greeted.delete(peer.id);
        const t = this.tracks.get(peer.id);
        if (t && t.name) {
          this.pendingEvents.push({ type: "leave", name: t.name });
        }
        this.tracks.delete(peer.id);
        this.peerInfo.delete(peer.id);
      };

      const onLeft = () => {
        this.state = "offline";
        this.roomCode = "";
        this.pendingEvents.push({ type: "interrupted", message: "You left the room" });
      };

      const onClose = (_reason?: string) => {
        if (!this.closedByUs && this.state !== "error") {
          this.fail("Connection closed");
        }
      };

      const onFailed = () => {
        this.fail("Could not reach the Poki lobby service");
      };

      const onSignalingError = (e: { message?: string }) => {
        this.fail(`Lobby error: ${e?.message ?? "unknown"}`);
      };

      const onMessage = (peer: Peer, channel: string, data: string | Blob | ArrayBuffer | ArrayBufferView) => {
        if (channel !== "reliable" && channel !== "unreliable") return;
        if (typeof data !== "string") return; // binary not used in this protocol
        let msg: NetMsg | { type: "state"; x: number; y: number; r: number; d: number; t: number } | null = null;
        try {
          msg = JSON.parse(data) as typeof msg;
        } catch {
          return;
        }
        if (!msg || typeof (msg as { type: string }).type !== "string") return;
        try {
          if ((msg as { type: string }).type === "state") {
            const s = msg as { type: "state"; x: number; y: number; r: number; d: number; t: number };
            if (!Number.isFinite(s.x) || !Number.isFinite(s.y) || !Number.isFinite(s.r)) return;
            const t = this.track(peer.id);
            const peerInfo = this.peerInfo.get(peer.id);
            if (peerInfo) {
              t.name = peerInfo.name;
              t.hue = peerInfo.hue;
              t.skin = peerInfo.skin;
            }
            t.distance = Number.isFinite(s.d) ? s.d : t.distance;
            // Use packet's timestamp (sender's clock offset by our render delay)
            // so serverClock only advances on real inbound data and the
            // interpolator doesn't skip forward or back.
            const ts = Number.isFinite(s.t) ? s.t : 0;
            if (ts > 0) t.lastSeen = this.clock;
            // Remote render clock takes the max of seen peer timestamps
            if (ts > this.serverClock) this.serverClock = ts;
            const prev = t.buffer[t.buffer.length - 1];
            const dt = prev ? Math.max(1e-4, ts - prev.t) : 1;
            // Inbound cadence: the same signal the WebSocket transport grades,
            // so the lobby's link badge means the same thing on both.
            if (prev) {
              this.stateIntervals.push(dt);
              while (this.stateIntervals.length > 12) this.stateIntervals.shift();
            }
            const vx = prev ? (s.x - prev.x) / dt : 0;
            const vy = prev ? (s.y - prev.y) / dt : 0;
            t.buffer.push({ t: ts, x: s.x, y: s.y, rot: s.r, vx, vy });
            while (t.buffer.length > 4) t.buffer.shift();
            return;
          }
          const m = msg as NetMsg;
          switch (m.type) {
            case "hello": {
              const name = truncate(String(m.name ?? "Pilot"), 14);
              const hue = Number.isFinite(m.hue) ? m.hue : Math.random();
              const skin = String(m.skin ?? "sunbird");
              this.peerInfo.set(peer.id, { name, hue, skin });
              const first = !this.greeted.has(peer.id);
              this.greeted.add(peer.id);
              const existing = this.tracks.get(peer.id);
              const t = this.track(peer.id);
              t.name = name;
              t.hue = hue;
              t.skin = skin;
              if (!existing) {
                this.pendingEvents.push({ type: "join", name });
              }
              // Answer the FIRST hello from a peer so both sides sync identity
              // even if we missed their "connected" event (a reconnect). Every
              // later hello is just an identity update and must NOT be answered:
              // a reply to a reply is an endless ping-pong that burns the
              // datachannel for the whole session.
              if (first) {
                try {
                  network.send("reliable", peer.id, JSON.stringify({ type: "hello", name: this.name, hue: this.hue, skin: this.skin, v: PROTOCOL_VERSION }));
                } catch { /* ignore */ }
              }
              break;
            }
            case "ready": {
              const t = this.track(peer.id);
              const was = t.ready;
              t.ready = Boolean(m.ready);
              if (t.ready && !was && t.name) {
                this.pendingEvents.push({ type: "ready", name: t.name });
              }
              // Host: when all peers (including us) are ready, broadcast a start.
              // Six seconds — the same shared countdown the relay server gives —
              // so a race never launches "instantly" the moment a pilot readies.
              if (this.amHost && this.localReady && this.allReady() && this.state === "lobby") {
                const at = Date.now() + 6000;
                const seed = this.seed;
                this.broadcastReliable({ type: "start", at, seed });
                this.startsAt = at;
                this.state = "racing";
                this.pendingEvents.push({ type: "start" });
              }
              break;
            }
            case "emote": {
              const t = this.track(peer.id);
              t.emote = m.emote;
              t.emoteAt = this.clock;
              this.pendingEmotes.push({ id: peer.id, emote: m.emote });
              break;
            }
            case "finish": {
              const t = this.track(peer.id);
              if (!this.finishedPeers.has(peer.id)) {
                this.finishedPeers.add(peer.id);
                t.finished = true;
                t.finishTime = m.time;
                if (this.amHost) {
                  // The next finisher takes the next place — including the very
                  // first one. (An extra +1 here used to hand the guest P2 when
                  // they finished first, and then the host took P2 as well:
                  // two pilots, nobody P1.)
                  const place = ++this.finishOrder;
                  t.place = place;
                  this.broadcastReliable({ type: "place", id: peer.id, place });
                  this.pendingEvents.push({ type: "finish", name: t.name || "Pilot", place });
                }
              }
              break;
            }
            case "place": {
              // Host-assigned place for a peer (or us if id matches self). The
              // place is kept on the track so the roster reports what really
              // happened, exactly like the server's roster does.
              if (m.id === this.id) {
                this.myPlace = m.place;
              } else {
                const t = this.tracks.get(m.id);
                if (t) {
                  t.finished = true;
                  t.place = m.place;
                  this.pendingEvents.push({ type: "finish", name: t.name || "Pilot", place: m.place });
                }
              }
              break;
            }
            case "start": {
              if (!Number.isFinite(m.at)) break;
              if (this.state === "racing") break;
              this.startsAt = m.at;
              this.seed = m.seed || this.seed;
              this.state = "racing";
              this.pendingEvents.push({ type: "start" });
              break;
            }
          }
        } catch {
          /* drop malformed frame */
        }
      };

      network.on("ready", onReady);
      network.on("lobby", onLobby);
      network.on("leader", onLeader);
      network.on("connecting", onConnecting);
      network.on("connected", onConnected);
      network.on("disconnected", onDisconnected);
      network.on("reconnecting", () => { /* noop */ });
      network.on("reconnected", () => { /* noop */ });
      network.on("left", onLeft);
      network.on("close", onClose);
      network.on("failed", onFailed);
      network.on("signalingerror", onSignalingError);
      network.on("rtcerror", () => { /* best effort */ });
      network.on("message", onMessage);

      this.boundHandlers.push(() => {
        try { network.off("ready", onReady); } catch { /* */ }
        try { network.off("lobby", onLobby); } catch { /* */ }
        try { network.off("leader", onLeader); } catch { /* */ }
        try { network.off("connecting", onConnecting); } catch { /* */ }
        try { network.off("connected", onConnected); } catch { /* */ }
        try { network.off("disconnected", onDisconnected); } catch { /* */ }
        try { network.off("left", onLeft); } catch { /* */ }
        try { network.off("close", onClose); } catch { /* */ }
        try { network.off("failed", onFailed); } catch { /* */ }
        try { network.off("signalingerror", onSignalingError); } catch { /* */ }
        try { network.off("message", onMessage); } catch { /* */ }
      });
    } catch (err) {
      this.fail(String(err).slice(0, 120));
      this.activateAutonomousRoom(this.requestedCode, this.requestedSeed);
    }
  }

  private allReady(): boolean {
    if (!this.localReady) return false;
    for (const t of this.tracks.values()) {
      if (!t.ready) return false;
    }
    return true;
  }

  private broadcastReliable(msg: NetMsg): void {
    if (!this.net || !this.netReady) return;
    try {
      this.net.broadcast("reliable", JSON.stringify(msg));
    } catch {
      /* ignore */
    }
  }

  /** Announce ourselves on the reliable channel once after join. Used
   *  after join() resolves and as the reply to directed peer hellos. */
  private sendHelloAll(): void {
    // Broadcast once so existing peers discover us, but wait a tick for the
    // peer map to be populated so late joiners get a complete picture.
    window.setTimeout(() => {
      if (!this.netReady) return;
      this.broadcastReliable({ type: "hello", name: this.name, hue: this.hue, skin: this.skin, v: PROTOCOL_VERSION });
    }, 120);
  }

  private fail(message: string): void {
    this.state = "error";
    this.errorText = message;
  }

  private shutdownNet(): void {
    for (const off of this.boundHandlers) {
      try { off(); } catch { /* */ }
    }
    this.boundHandlers = [];
    if (this.net) {
      try { this.net.removeAllListeners(); } catch { /* */ }
      try { this.net.close("leave"); } catch { /* */ }
    }
    this.net = null;
    this.netReady = false;
    this.connectedPeers.clear();
    this.peerInfo.clear();
    this.greeted.clear();
  }

  startNow(): void {
    if (this.isAutonomous || !this.connected) {
      this.state = "racing";
      this.startsAt = Date.now() + 100;
      this.pendingEvents.push({ type: "start" });
    } else if (this.amHost && this.tracks.size > 0) {
      // Host authority: launch the room with the SAME shared 6s countdown the
      // guests get — never an instant local launch that leaves the field
      // behind. Our own "start" event comes back through pendingEvents.
      const at = Date.now() + 6000;
      this.broadcastReliable({ type: "start", at, seed: this.seed });
      this.startsAt = at;
      this.state = "racing";
      this.pendingEvents.push({ type: "start" });
    } else {
      this.sendReady(true);
    }
  }

  disconnect(): void {
    this.closedByUs = true;
    if (this.autoReadyTimer !== null) {
      window.clearTimeout(this.autoReadyTimer);
      this.autoReadyTimer = null;
    }
    this.shutdownNet();
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
    this.amHost = false;
    this.finishOrder = 0;
    this.finishedPeers.clear();
  }

  setIdentity(name: string, skin: string, hue: number): void {
    this.name = name;
    this.skin = skin;
    this.hue = hue;
    if (this.netReady && this.net) {
      this.broadcastReliable({ type: "hello", name, hue, skin, v: PROTOCOL_VERSION });
    }
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
        for (const peer of this.tracks.values()) peer.ready = false;
      }
      return true;
    }
    if (!this.connected || this.state !== "lobby") return false;
    this.localReady = ready;
    this.broadcastReliable({ type: "ready", ready });
    // Host who is alone: start immediately (single-player practice).
    if (this.amHost && ready && this.tracks.size === 0) {
      const at = Date.now() + 800;
      this.startsAt = at;
      this.state = "racing";
      this.broadcastReliable({ type: "start", at, seed: this.seed });
      this.pendingEvents.push({ type: "start" });
    }
    return true;
  }

  /** Drives the send cadence and ages out silent peers. Call every frame. */
  tick(dt: number): void {
    this.clock += dt;
    this.sendAcc += dt;
    if (this.state === "racing") {
      for (const [id, t] of this.tracks) {
        if (this.clock - t.lastSeen > STALE_AFTER) this.tracks.delete(id);
      }
    }
    this.heartbeat += dt;
    if (this.connected && this.heartbeat >= 15) {
      this.heartbeat = 0;
      this.broadcastReliable({ type: "ready", ready: this.localReady });
    }
  }

  send(x: number, y: number, rotation: number, distance: number): void {
    if (!this.connected && !this.isAutonomous) return;
    if (this.isAutonomous) return; // AI pilots don't need network
    if (this.sendAcc < SEND_DT) return;
    this.sendAcc = 0;
    const moved =
      Math.abs(x - this.lastSent.x) > 0.05 ||
      Math.abs(y - this.lastSent.y) > 0.05 ||
      Math.abs(rotation - this.lastSent.rot) > 0.01;
    if (!moved) return;
    this.lastSent = { x, y, rot: rotation, d: distance };
    if (!this.net || !this.netReady) return;
    try {
      this.net.broadcast("unreliable", JSON.stringify({
        type: "state",
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        r: Math.round(rotation * 100) / 100,
        d: Math.round(distance),
        t: this.clock,
      }));
    } catch {
      /* socket died */
    }
  }

  sendEmote(emote: string): void {
    if (this.isAutonomous) return;
    this.broadcastReliable({ type: "emote", emote });
  }

  sendFinish(time: number, distance: number): void {
    if (this.isAutonomous) return;
    if (this.amHost) {
      // As the host, record our own finish before broadcasting so we take the
      // next place in the same ordering as everybody else.
      this.myPlace = ++this.finishOrder;
      this.finishedPeers.add(this.id);
      this.broadcastReliable({ type: "place", id: this.id, place: this.myPlace });
      this.broadcastReliable({ type: "finish", time: Math.round(time * 100) / 100, d: Math.round(distance) });
    } else {
      this.broadcastReliable({ type: "finish", time: Math.round(time * 100) / 100, d: Math.round(distance) });
    }
  }

  /** Interpolated snapshots for the renderer. */
  poll(): RemoteSnapshot[] {
    const out: RemoteSnapshot[] = [];
    const renderAt = (this.serverClock || this.clock) - INTERP_DELAY;
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

  drainEmotes(): { id: string; emote: string }[] {
    const out = this.pendingEmotes;
    this.pendingEmotes = [];
    return out;
  }

  drainEvents(): PresenceEvent[] {
    const out = this.pendingEvents;
    this.pendingEvents = [];
    return out;
  }

  roster(): RoomPeer[] {
    const peers: RoomPeer[] = [];
    for (const t of this.tracks.values()) {
      const peer = this.net?.peers.get(t.id);
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
        latencyMs: peer?.latency ? Math.round(peer.latency.average) : 0,
        you: false,
      });
    }
    return peers;
  }

  info(): RoomInfo {
    this.syncLobbyPhase();
    const count = this.tracks.size + (this.connected || this.isAutonomous ? 1 : 0);
    return {
      code: this.roomCode,
      seed: this.seed,
      count,
      capacity: this.capacity,
      state: this.state,
      startsInMs: this.startsAt > 0 ? Math.max(0, this.startsAt - Date.now()) : 0,
      error: this.errorText,
      ready: this.localReady,
      aiFallback: this.isAutonomous,
    };
  }

  /** Public lobbies this client can see right now (shares the room model). */
  async listPublic(): Promise<LiveRoom[]> {
    if (!this.net || !this.netReady) return [];
    try {
      const lobbies = await this.net.list({ public: true }, { createdAt: -1 }, 20);
      return sortRooms(normalizeRooms(lobbies.map(lobbyToRoomInput)));
    } catch {
      return [];
    }
  }

  /**
   * Keep the lobby's public description honest: while a race is running the
   * lobby is NOT an open room, and a pilot browsing the menu must see that.
   * Best-effort and idempotent — the host publishes, guests read.
   */
  private syncLobbyPhase(): void {
    const phase: "lobby" | "racing" = this.state === "racing" ? "racing" : "lobby";
    if (phase === this.announcedPhase || !this.amHost || !this.netReady || !this.net?.currentLobby) return;
    this.announcedPhase = phase;
    void this.net
      .setLobbySettings({
        customData: { seed: this.seed, mode: "sunbird-race", v: PROTOCOL_VERSION, phase },
      })
      .catch(() => {
        /* leadership may have moved; the next host republishes */
      });
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
}

/** A Netlib lobby entry, in the shape the shared room model expects. */
function lobbyToRoomInput(l: LobbyListEntry): Record<string, unknown> {
  return {
    code: l.code,
    seated: l.playerCount,
    capacity: l.maxPlayers,
    // The host publishes the phase in customData; an un-updated lobby is a
    // lobby, which is the truthful default for a fresh room.
    status: l.customData?.phase === "racing" ? "racing" : "lobby",
    // Password-protected lobbies are visible but not offered to newcomers.
    joinable: !l.hasPassword && l.playerCount < l.maxPlayers,
    latency: typeof l.latency === "number" ? l.latency : null,
    seed: typeof l.customData?.seed === "string" ? l.customData.seed : "",
    createdAt: typeof l.createdAt === "string" ? l.createdAt : undefined,
  };
}

/** Cached signalling connection used only to *browse* public lobbies. */
let browseNet: Network | null = null;
let browseReady = false;

/**
 * Public lobbies, straight from the P2P signalling service's listing API.
 *
 * Feeds the menu's live list and the matchmaking search so a pilot can see real
 * rooms with real seat counts instead of a spinner. Browsing opens its own
 * short-lived connection and never joins anything; failures are reported as an
 * empty list so the UI stays honest.
 */
export async function listPublicLobbies(
  gameId: string = NETLIB_GAME_ID,
  timeoutMs = 8000,
): Promise<LiveRoom[]> {
  if (!isPokiMultiplayerAvailable()) return [];
  const net = browseNet ?? new Network(gameId);
  browseNet = net;
  try {
    if (!browseReady) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          net.removeAllListeners("ready");
          net.removeAllListeners("failed");
          reject(new Error("Signalling timed out"));
        }, timeoutMs);
        net.once("ready", () => {
          clearTimeout(timer);
          net.removeAllListeners("failed");
          browseReady = true;
          resolve();
        });
        net.once("failed", () => {
          clearTimeout(timer);
          net.removeAllListeners("ready");
          reject(new Error("Signalling failed"));
        });
      });
    }
    const entries = await net.list({ public: true }, { createdAt: -1 }, 20);
    return sortRooms(normalizeRooms(entries.map(lobbyToRoomInput)));
  } catch (err) {
    // Drop the connection so the next attempt starts clean instead of reusing
    // a network that will never become ready.
    closeLobbyBrowser();
    throw err;
  }
}

/** Tear the browser connection down (leaving the PvP screen). */
export function closeLobbyBrowser(): void {
  try {
    browseNet?.close("browse");
  } catch {
    /* already closed */
  }
  browseNet = null;
  browseReady = false;
}

