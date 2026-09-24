/**
 * A faithful in-process stand-in for `@poki/netlib`, used by the Poki P2P
 * tests. It reproduces the *observable* behaviour of the real client (which was
 * read out of the shipped dist, not guessed):
 *
 *   • the signalling socket connects eagerly on construction and emits "ready"
 *     when the server's welcome packet arrives — so a bare `new Network(id)`
 *     becomes usable without create()/join();
 *   • `list()` returns the public lobby rows (code, playerCount, maxPlayers,
 *     hasPassword, customData, leader, createdAt) and is empty before "ready";
 *   • `create()` / `join()` resolve with the lobby, emit "lobby" with that row,
 *     and connect you to the peers already inside (emitting "connected" on both
 *     sides);
 *   • `send()` is directed, `broadcast()` reaches everyone else, and messages
 *     arrive as the "message" event with a peer object;
 *   • `setLobbySettings()` merges the new settings into the lobby row that
 *     everybody's list() sees.
 *
 * Everything is synchronous-ish through microtasks, so tests stay deterministic.
 */

type Listener = (...args: unknown[]) => void;

/** State that must survive vi.resetModules(): the fake "server" and the peer
 *  id counter. Without this, two clients can be handed the same peer id and
 *  mistake each other (and themselves) for the same pilot. */
type Shared = { __fakeNetlibSignaler?: Signaler; __fakeNetlibPeerSeq?: number };
const shared = globalThis as Shared;

class Emitter {
  private listeners = new Map<string, Listener[]>();

  on(event: string, fn: Listener): this {
    const list = this.listeners.get(event) ?? [];
    list.push(fn);
    this.listeners.set(event, list);
    return this;
  }

  once(event: string, fn: Listener): this {
    const wrapped: Listener = (...args) => {
      this.off(event, wrapped);
      fn(...args);
    };
    return this.on(event, wrapped);
  }

  off(event: string, fn: Listener): this {
    const list = this.listeners.get(event);
    if (list) this.listeners.set(event, list.filter((f) => f !== fn));
    return this;
  }

  removeAllListeners(event?: string): this {
    if (event) this.listeners.delete(event);
    else this.listeners.clear();
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    for (const fn of [...(this.listeners.get(event) ?? [])]) fn(...args);
  }
}

export type FakeLobby = {
  code: string;
  public: boolean;
  playerCount: number;
  maxPlayers: number;
  hasPassword: boolean;
  customData: Record<string, unknown>;
  leader: string;
  createdAt: string;
  latency?: number;
};

export type FakePeer = { id: string };

/** The shared "signalling server": lobbies plus who is inside them. */
class Signaler {
  private codeCounter = 0;
  readonly lobbies = new Map<string, FakeLobby>();
  readonly members = new Map<string, Set<FakeNetwork>>();
  /** Set to true to make every connection attempt fail (offline case). */
  offline = false;

  nextCode(): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    let n = ++this.codeCounter * 7919;
    for (let i = 0; i < 5; i++) {
      out += alphabet[n % alphabet.length];
      n = Math.floor(n / alphabet.length) + 31;
    }
    return out;
  }

  reset(): void {
    this.lobbies.clear();
    this.members.clear();
    this.codeCounter = 0;
    this.offline = false;
  }
}

/** One fabric per test process, shared even if this module is re-evaluated
 *  (vitest's resetModules gives the mocked factory a different instance than
 *  the test file would otherwise see). */
export const signaler: Signaler = shared.__fakeNetlibSignaler ?? new Signaler();
shared.__fakeNetlibSignaler = signaler;

export class FakeNetwork extends Emitter {
  readonly gameID: string;
  readonly peers = new Map<string, FakePeer>();
  currentLobby: string | undefined;
  readonly log = (..._args: unknown[]) => {};
  private lobbyCode: string | null = null;
  private closed = false;
  private readonly peerId: string;

  constructor(gameID: string, ..._rest: unknown[]) {
    super();
    this.gameID = gameID;
    shared.__fakeNetlibPeerSeq = (shared.__fakeNetlibPeerSeq ?? 0) + 1;
    this.peerId = `peer-${shared.__fakeNetlibPeerSeq}`;
    // The real client opens its signalling socket in the constructor and gets
    // the welcome packet (→ "ready") shortly after.
    queueMicrotask(() => {
      if (this.closed) return;
      if (signaler.offline) {
        this.emit("failed");
        return;
      }
      this.emit("ready");
    });
  }

  get id(): string {
    return this.peerId;
  }

  get currentLobbyInfo(): FakeLobby | undefined {
    return this.currentLobby ? signaler.lobbies.get(this.currentLobby) : undefined;
  }

  async list(filter?: Record<string, unknown>, _sort?: unknown, limit?: number): Promise<FakeLobby[]> {
    // Accept both the simple { public: true } shape AND the MongoDB-style
    // { $and: [{ public: { $eq: true } }, ...] } shape that PokiNetlibClient uses.
    const wantsPublic =
      filter?.public === true ||
      (Array.isArray(filter?.$and) &&
        (filter.$and as Record<string, unknown>[]).some(
          (c) =>
            c.public === true ||
            (c.public as Record<string, unknown> | undefined)?.$eq === true,
        ));
    if (!wantsPublic) return [];
    let rows = [...signaler.lobbies.values()].filter((l) => l.public);
    // Apply simple $and conditions the tests rely on: hasPassword, playerCount $gt.
    if (Array.isArray(filter?.$and)) {
      for (const cond of filter.$and as Record<string, unknown>[]) {
        if ((cond.hasPassword as Record<string, unknown> | undefined)?.$eq === false) {
          rows = rows.filter((l) => !l.hasPassword);
        }
        if (typeof (cond.playerCount as Record<string, unknown> | undefined)?.$gt === "number") {
          const min = (cond.playerCount as Record<string, unknown>).$gt as number;
          rows = rows.filter((l) => l.playerCount > min);
        }
        // customData.mode filter
        const modeMatch = (cond as Record<string, unknown>)["customData.mode"] as
          | Record<string, unknown>
          | undefined;
        if (modeMatch?.$eq !== undefined) {
          rows = rows.filter(
            (l) => l.customData?.mode === modeMatch.$eq,
          );
        }
      }
    }
    return typeof limit === "number" ? rows.slice(0, limit) : rows;
  }

  async create(settings: Record<string, unknown> = {}): Promise<string> {
    const code = (settings.code as string) || signaler.nextCode();
    const lobby: FakeLobby = {
      code,
      public: Boolean(settings.public),
      playerCount: 1,
      maxPlayers: Number(settings.maxPlayers ?? 40),
      hasPassword: Boolean(settings.password),
      customData: (settings.customData as Record<string, unknown>) ?? {},
      leader: this.id,
      createdAt: new Date().toISOString(),
      latency: 12,
    };
    signaler.lobbies.set(code, lobby);
    signaler.members.set(code, new Set([this]));
    this.lobbyCode = code;
    this.currentLobby = code;
    queueMicrotask(() => this.emit("lobby", code, { ...lobby }));
    return code;
  }

  async join(code: string): Promise<FakeLobby | undefined> {
    const lobby = signaler.lobbies.get(code);
    if (!lobby) return undefined;
    const members = signaler.members.get(code) ?? new Set<FakeNetwork>();
    const others = [...members];
    members.add(this);
    signaler.members.set(code, members);
    lobby.playerCount = members.size;
    this.lobbyCode = code;
    this.currentLobby = code;
    this.emit("lobby", code, { ...lobby });
    // Both sides see a WebRTC connection being established, then connected.
    for (const other of others) {
      this.peers.set(other.id, { id: other.id });
      other.peers.set(this.id, { id: this.id });
      other.emit("connecting", { id: this.id });
      other.emit("connected", { id: this.id });
      this.emit("connecting", { id: other.id });
      this.emit("connected", { id: other.id });
    }
    return { ...lobby };
  }

  async leave(): Promise<void> {
    this.leaveLobby();
    this.emit("left");
  }

  async setLobbySettings(settings: Record<string, unknown>): Promise<true | Error> {
    const lobby = this.currentLobbyInfo;
    if (!lobby) return new Error("no lobby");
    if (settings.customData) lobby.customData = { ...lobby.customData, ...(settings.customData as Record<string, unknown>) };
    if (typeof settings.maxPlayers === "number") lobby.maxPlayers = settings.maxPlayers;
    queueMicrotask(() => this.emit("lobbyUpdated", lobby.code, { ...settings }));
    return true;
  }

  send(_channel: string, peerID: string, data: string): void {
    const target = signaler.members.get(this.lobbyCode ?? "") ?? new Set<FakeNetwork>();
    for (const member of target) {
      if (member.id !== peerID) continue;
      queueMicrotask(() => member.emit("message", { id: this.id }, _channel, data));
    }
  }

  broadcast(_channel: string, data: string): void {
    const target = signaler.members.get(this.lobbyCode ?? "") ?? new Set<FakeNetwork>();
    for (const member of target) {
      if (member === this) continue;
      queueMicrotask(() => member.emit("message", { id: this.id }, _channel, data));
    }
  }

  close(reason?: string): void {
    if (this.closed) return;
    this.closed = true;
    this.leaveLobby();
    this.emit("close", reason);
  }

  private leaveLobby(): void {
    const code = this.lobbyCode;
    if (!code) return;
    const members = signaler.members.get(code);
    const lobby = signaler.lobbies.get(code);
    if (members) {
      members.delete(this);
      if (lobby) lobby.playerCount = Math.max(0, members.size);
      for (const other of members) {
        other.peers.delete(this.id);
        other.emit("disconnected", { id: this.id });
      }
      // The real service drops an empty lobby.
      if (members.size === 0) {
        signaler.members.delete(code);
        signaler.lobbies.delete(code);
      }
    }
    this.lobbyCode = null;
    this.currentLobby = undefined;
  }
}

export const DefaultSignalingURL = "wss://netlib.poki.io/v0/signaling";
export const DefaultRTCConfiguration = { iceServers: [] };
export const DefaultDataChannels = { reliable: {}, unreliable: {} };
