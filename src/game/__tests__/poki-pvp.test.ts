/**
 * Poki PvP end to end, in-process.
 *
 * The Poki edition has no self-hosted room server: multiplayer is WebRTC P2P
 * through `@poki/netlib`. That is the transport Poki players actually get, so
 * it is exercised here over an in-process stand-in for the signaller
 * (`support/fake-netlib.ts`, whose behaviour was read out of the shipped dist):
 *
 *   • quick match finds and joins a real public lobby before creating one;
 *   • two clients exchange real names over the reliable channel (no placeholders);
 *   • ready-up makes the HOST broadcast the authoritative start;
 *   • finish order is assigned by the host and lands on every client;
 *   • the host publishes the lobby phase so the menu never advertises a race in
 *     progress as an open room, and a guest never overwrites the host's entry;
 *   • a browser without WebRTC degrades to the honest local flock instead of a
 *     broken lobby.
 *
 * The compile-time Poki gate (`isPokiMultiplayerAvailable`) is stubbed on for
 * these tests only; every other suite keeps the non-Poki behaviour.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signaler } from "./support/fake-netlib";

vi.mock("@poki/netlib", async () => {
  const fake = await import("./support/fake-netlib");
  return {
    Network: fake.FakeNetwork,
    DefaultSignalingURL: fake.DefaultSignalingURL,
    DefaultRTCConfiguration: fake.DefaultRTCConfiguration,
    DefaultDataChannels: fake.DefaultDataChannels,
  };
});

type Client = {
  connect(code: string, seed: string, remote?: boolean): void;
  disconnect(): void;
  info(): { code: string; seed: string; count: number; state: string; ready: boolean; capacity: number; aiFallback: boolean };
  roster(): {
    id: string;
    name: string;
    skin: string;
    ready: boolean;
    you: boolean;
    place: number;
    finished: boolean;
    finishTime: number;
  }[];
  sendReady(ready: boolean): boolean;
  sendFinish(time: number, distance: number): void;
  startsAt: number;
  tick(dt: number): void;
  send(x: number, y: number, rotation: number, distance: number): void;
  poll(): { id: string; name: string; distance: number }[];
  drainEvents(): { type: string; name?: string; place?: number; seed?: string }[];
  state: string;
  roomCode: string;
  seed: string;
  myPlace: number;
  isAutonomous: boolean;
  connected: boolean;
};

let PokiNetlibClient: new (deviceId: string, name: string, skin: string, hue: number) => Client;
let listPublicLobbies: (gameId?: string, timeoutMs?: number) => Promise<
  { code: string; seated: number; capacity: number; status: string; joinable: boolean; host: string }[]
>;
let closeLobbyBrowser: () => void;

const flush = async (times = 6) => {
  for (let i = 0; i < times; i++) await Promise.resolve();
};

async function boot() {
  vi.resetModules();
  vi.stubEnv("VITE_PORTAL_TARGET", "poki");
  vi.stubGlobal("RTCPeerConnection", class RtcStub {});
  const mod = await import("../PokiNetlib");
  PokiNetlibClient = mod.PokiNetlibClient as unknown as typeof PokiNetlibClient;
  listPublicLobbies = mod.listPublicLobbies as unknown as typeof listPublicLobbies;
  closeLobbyBrowser = mod.closeLobbyBrowser;
}

const live: Client[] = [];
function client(name: string, deviceId = `device-${name.toLowerCase()}`): Client {
  const c = new PokiNetlibClient(deviceId, name, "sunbird", 0.06);
  live.push(c);
  return c;
}

beforeEach(async () => {
  signaler.reset();
  vi.useFakeTimers();
  await boot();
});

afterEach(async () => {
  // Every client that is still connected would keep its lobby alive and leak
  // members into the next test's fabric.
  for (const c of live.splice(0)) {
    try {
      c.disconnect();
    } catch {
      /* already gone */
    }
  }
  await flush(2);
  try {
    closeLobbyBrowser?.();
  } catch {
    /* nothing to close */
  }
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Poki quick match (public lobbies over P2P)", () => {
  it("creates the first public lobby with a real seed and mode", async () => {
    const host = client("Alita");
    host.connect("", "seed-alpha");
    await flush();
    await vi.advanceTimersByTimeAsync(200);

    const lobby = [...signaler.lobbies.values()][0]!;
    expect(lobby.public).toBe(true);
    expect(lobby.maxPlayers).toBe(40);
    expect(lobby.customData).toMatchObject({ mode: "sunbird-race", seed: "seed-alpha", phase: "lobby" });
    expect(host.roomCode).toBe(lobby.code);
    expect(host.info().state).toBe("lobby");
    expect(host.connected).toBe(true);
  });

  it("a second player joins the existing lobby instead of creating another", async () => {
    const host = client("Alita");
    host.connect("", "seed-alpha");
    await flush();
    await vi.advanceTimersByTimeAsync(200);

    const guest = client("Bravo");
    guest.connect("", "seed-beta"); // different local seed: the room's wins
    await flush();
    await vi.advanceTimersByTimeAsync(400);

    expect(signaler.lobbies.size).toBe(1); // no fragmentation into empty rooms
    expect(guest.roomCode).toBe(host.roomCode);
    // The guest adopts the host's course, with a welcome event saying so.
    expect(guest.seed).toBe("seed-alpha");
    expect(guest.drainEvents().some((e) => e.type === "welcome" && e.seed === "seed-alpha")).toBe(true);
  });

  it("both pilots see each other by their real names, never a placeholder", async () => {
    const host = client("Alita");
    host.connect("", "seed-alpha");
    await flush();
    await vi.advanceTimersByTimeAsync(200);

    const guest = client("Bravo");
    guest.connect("", "seed-beta");
    await flush();
    await vi.advanceTimersByTimeAsync(400);

    const hostRoster = host.roster();
    const guestRoster = guest.roster();
    expect(hostRoster.map((p) => p.name)).toEqual(["Bravo"]);
    expect(guestRoster.map((p) => p.name)).toEqual(["Alita"]);
    expect(hostRoster.every((p) => p.name !== "Pilot" && !p.you)).toBe(true);
    expect(host.info().count).toBe(2);
    expect(guest.drainEvents().some((e) => e.type === "join" && e.name === "Alita")).toBe(true);
  });

  it("reconnects to a room code by joining that lobby", async () => {
    const host = client("Alita");
    host.connect("", "seed-alpha");
    await flush();
    await vi.advanceTimersByTimeAsync(200);
    const code = host.roomCode;

    const buddy = client("Bravo");
    buddy.connect(code, "ignored");
    await flush();
    await vi.advanceTimersByTimeAsync(400);

    expect(buddy.roomCode).toBe(code);
    expect(buddy.seed).toBe("seed-alpha"); // the room's seed, not the local one
    expect(host.roster().map((p) => p.name)).toEqual(["Bravo"]);
  });
});

describe("Poki race agreement (host-authoritative over P2P)", () => {
  async function pair() {
    const host = client("Alita");
    host.connect("", "seed-alpha");
    await flush();
    await vi.advanceTimersByTimeAsync(200);
    const guest = client("Bravo");
    guest.connect("", "seed-beta");
    await flush();
    await vi.advanceTimersByTimeAsync(400);
    guest.drainEvents();
    return { host, guest };
  }

  it("the host starts the race when everyone is ready", async () => {
    const { host, guest } = await pair();
    host.sendReady(true);
    guest.sendReady(true);
    await flush();
    await vi.advanceTimersByTimeAsync(100);

    expect(host.state).toBe("racing");
    expect(guest.state).toBe("racing");
    expect(guest.drainEvents().some((e) => e.type === "start")).toBe(true);
    // Both sides agree on when it started (the host's clock is authoritative).
    expect(host.startsAt).toBeGreaterThan(0);
    expect(guest.startsAt).toBe(host.startsAt);
  });

  it("a lone host starts immediately rather than waiting for nobody", async () => {
    const host = client("Alita");
    host.connect("", "seed-alpha");
    await flush();
    await vi.advanceTimersByTimeAsync(200);
    host.sendReady(true);
    await flush();
    await vi.advanceTimersByTimeAsync(900);
    expect(host.state).toBe("racing");
  });

  it("the host assigns finish places and every client learns them", async () => {
    const { host, guest } = await pair();
    host.sendReady(true);
    guest.sendReady(true);
    await flush();
    await vi.advanceTimersByTimeAsync(100);

    // The guest crosses first: they are P1, and BOTH sides must know it.
    guest.sendFinish(41.2, 4100);
    await flush();
    await vi.advanceTimersByTimeAsync(50);
    expect(guest.myPlace).toBe(1);
    expect(host.roster().find((p) => p.name === "Bravo")?.place).toBe(1);
    expect(host.roster().find((p) => p.name === "Bravo")?.finished).toBe(true);

    // The host crosses second: P2, broadcast to the room.
    host.sendFinish(39.8, 4200);
    await flush();
    await vi.advanceTimersByTimeAsync(50);
    expect(host.myPlace).toBe(2);
    expect(guest.roster().find((p) => p.name === "Alita")?.place).toBe(2);
    expect(guest.drainEvents().some((e) => e.type === "finish" && e.place === 2)).toBe(true);
  });

  it("keeps the order when the host crosses first", async () => {
    const { host, guest } = await pair();
    host.sendReady(true);
    guest.sendReady(true);
    await flush();
    await vi.advanceTimersByTimeAsync(100);

    host.sendFinish(38.1, 4400);
    await flush();
    await vi.advanceTimersByTimeAsync(50);
    expect(host.myPlace).toBe(1);
    expect(guest.roster().find((p) => p.name === "Alita")?.place).toBe(1);

    guest.sendFinish(40.4, 4300);
    await flush();
    await vi.advanceTimersByTimeAsync(50);
    expect(guest.myPlace).toBe(2);
    expect(host.roster().find((p) => p.name === "Bravo")?.place).toBe(2);
    expect(host.drainEvents().some((e) => e.type === "finish" && e.place === 2)).toBe(true);
  });

  it("flight state streams over the unreliable channel", async () => {
    const { host, guest } = await pair();
    host.sendReady(true);
    guest.sendReady(true);
    await flush();
    await vi.advanceTimersByTimeAsync(100);

    guest.tick(0.2); // the 15 Hz send gate
    guest.send(100, 40, 0.5, 320);
    await flush();
    host.tick(0.5);
    await vi.advanceTimersByTimeAsync(16);
    const seen = host.poll();
    expect(seen.map((s) => s.name)).toContain("Bravo");
  });
});

describe("lobby phase publishing (never sell a race in progress as open)", () => {
  it("the host publishes 'racing' once the room starts", async () => {
    const host = client("Alita");
    host.connect("", "seed-alpha");
    await flush();
    await vi.advanceTimersByTimeAsync(200);
    expect(signaler.lobbies.get(host.roomCode)!.customData.phase).toBe("lobby");

    host.sendReady(true); // lone host → immediate start
    await flush();
    await vi.advanceTimersByTimeAsync(900);
    host.info(); // the game reads info() every frame; the phase rides along
    await flush();

    expect(host.state).toBe("racing");
    expect(signaler.lobbies.get(host.roomCode)!.customData.phase).toBe("racing");
  });

  it("a guest never overwrites the host's lobby entry", async () => {
    const host = client("Alita");
    host.connect("", "seed-alpha");
    await flush();
    await vi.advanceTimersByTimeAsync(200);
    const code = host.roomCode;

    const guest = client("Bravo");
    guest.connect(code, "ignored");
    await flush();
    await vi.advanceTimersByTimeAsync(400);
    signaler.lobbies.get(code)!.customData.phase = "racing";
    guest.info();
    await flush();

    expect(signaler.lobbies.get(code)!.customData.phase).toBe("racing");
    expect(signaler.lobbies.get(code)!.customData.seed).toBe("seed-alpha");
  });
});

describe("the menu's live room list, straight from the signaller", () => {
  it("lists real lobbies with seats, phase and joinability", async () => {
    const host = client("Alita");
    host.connect("", "seed-alpha");
    await flush();
    await vi.advanceTimersByTimeAsync(200);

    const rooms = await listPublicLobbies("test-game", 500);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toMatchObject({ code: host.roomCode, seated: 1, capacity: 40, status: "lobby", joinable: true });
  });

  it("reports a race in progress honestly, and a full lobby as closed", async () => {
    const host = client("Alita");
    host.connect("", "seed-alpha");
    await flush();
    await vi.advanceTimersByTimeAsync(200);
    signaler.lobbies.get(host.roomCode)!.customData.phase = "racing";

    let rooms = await listPublicLobbies("test-game", 500);
    expect(rooms[0]).toMatchObject({ status: "racing", joinable: false });

    signaler.lobbies.get(host.roomCode)!.playerCount = 40;
    rooms = await listPublicLobbies("test-game", 500);
    expect(rooms[0]!.joinable).toBe(false);
  });

  it("an unreachable signaller fails loudly instead of hanging the search", async () => {
    signaler.offline = true;
    await expect(listPublicLobbies("test-game", 200)).rejects.toThrow();
    // …and the next attempt starts from a clean connection.
    signaler.offline = false;
    const rooms = await listPublicLobbies("test-game", 500);
    expect(Array.isArray(rooms)).toBe(true);
  });
});

describe("a browser with no WebRTC", () => {
  it("falls back to the honest local flock instead of a dead lobby", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("RTCPeerConnection", undefined as unknown as typeof RTCPeerConnection);
    await boot();
    vi.stubGlobal("RTCPeerConnection", undefined as unknown as typeof RTCPeerConnection);

    const solo = client("Alita");
    solo.connect("", "seed-alpha");
    await flush();
    expect(solo.isAutonomous).toBe(true);
    expect(solo.state).toBe("lobby");
    expect(solo.roster().length).toBeGreaterThan(0); // local AI flock, clearly not live pilots
    // "Clearly" is the transport's job to say, not the reader's to infer: these
    // pilots are generated locally, and the lobby tags them "AI pilot" only
    // because this flag travels with the room info. Without it they reached the
    // player dressed as live humans.
    expect(solo.info().aiFallback).toBe(true);
    expect(await listPublicLobbies("test-game", 200)).toEqual([]);
  });
});

/**
 * The lobby filter is a SERVER-SIDE contract that the client cannot see.
 *
 * github.com/poki/netlib → internal/signaling/stores/postgres.go builds its
 * query converter with
 *   filter.WithNestedJSONB("custom_data",
 *     "code", "playerCount", "createdAt", "updatedAt", "latency")
 * Every key outside that exemption list is silently redirected into the
 * lobby's `custom_data` JSONB, and a dotted key fails the whole query with
 * "invalid column name". Verified against Poki's own converter
 * (github.com/poki/mongodb-filter-to-postgres v1.0.8):
 *
 *   {"customData.mode":{"$eq":…}}  -> ERROR invalid column name
 *   {"public":{"$eq":true}}        -> "custom_data"->>'public'   (matches nothing)
 *   {"playerCount":{"$gt":0}}      -> "playerCount" > $n         (real column)
 *
 * So a filter can look perfectly reasonable and still return zero rooms. That
 * is not a hypothetical: the client shipped exactly that filter, quick-match
 * never found a lobby, and every player silently got a fresh empty room.
 */
describe("lobby filter keys survive the real signaling converter", () => {
  // Must match WithNestedJSONB(...) in netlib's postgres.go exactly.
  const EXEMPT = new Set(["code", "playerCount", "createdAt", "updatedAt", "latency"]);

  it("rejects the dotted and non-exempt keys that silently matched nothing", () => {
    expect(() => signaler.matchFilter({ public: { $eq: true } })).not.toThrow();
    // `public` is a real column but is NOT exempt, so it compiles to
    // "custom_data"->>'public' and can never match. It must not be used.
    expect(signaler.matchFilter({ public: { $eq: true } })).toBe(false);
    expect(signaler.matchFilter({ hasPassword: { $eq: false } })).toBe(false);
  });

  it("treats a dotted key as a hard error, exactly like the server does", () => {
    expect(() => signaler.matchFilter({ "customData.mode": { $eq: "x" } })).toThrow(
      /invalid column name/,
    );
  });

  it("accepts exempt columns and our own top-level customData keys", () => {
    const lobby = {
      code: "ABC12",
      public: true,
      playerCount: 3,
      maxPlayers: 40,
      hasPassword: false,
      customData: { mode: "sunbird-race" },
      leader: "p1",
      createdAt: "2026-01-01T00:00:00.000Z",
      latency: 12,
    };
    // `code`, `playerCount`, `createdAt` and `latency` are exempt AND present on
    // the client-side lobby shape. `updatedAt` is a real server column that
    // LobbyListEntry carries but this fixture does not model.
    for (const key of ["code", "playerCount", "createdAt", "latency"]) {
      expect(lobby).toHaveProperty(key);
      expect(EXEMPT.has(key)).toBe(true);
    }
    // These two are real columns on the server but are NOT exempt, so filtering
    // on them silently searches custom_data and never matches.
    expect(EXEMPT.has("public")).toBe(false);
    expect(EXEMPT.has("hasPassword")).toBe(false);
    expect(signaler.matchFilter({ mode: { $eq: "sunbird-race" } }, lobby)).toBe(true);
    expect(signaler.matchFilter({ mode: { $eq: "other" } }, lobby)).toBe(false);
    expect(signaler.matchFilter({ playerCount: { $gt: 0 } }, lobby)).toBe(true);
    expect(signaler.matchFilter({ playerCount: { $gt: 9 } }, lobby)).toBe(false);
  });
});

/**
 * A lobby the player cannot escape is worse than an honest one.
 *
 * The header of PokiNetlib.ts has always promised that multiplayer degrades to
 * a local AI flock when the network cannot deliver. That promise was not
 * implemented: `fail()` only set state = "error", and there was no watchdog at
 * all for the case the promise most obviously covers — a lobby that opens fine
 * and is then never joined by anyone.
 */
describe("a room the network cannot deliver", () => {
  it("falls back to a local race instead of an error banner when signaling fails", async () => {
    const solo = client("Rhea");
    solo.connect("", "seed-sig");
    await flush();
    // Now break the service and let the failure land.
    (solo as unknown as { fail: (m: string, d?: boolean) => void }).fail("signal lost");
    await flush();
    expect(solo.state).toBe("lobby");
    expect(solo.isAutonomous).toBe(true);
    expect(solo.roster().length).toBeGreaterThan(0);
    expect(solo.connected).toBe(true);
  });

  it("refuses to pretend a bad invite code became a room", async () => {
    const solo = client("Vex");
    solo.connect("ZZZZZ", "seed-invite"); // a code the fake has never heard of
    await flush(12);
    // The player asked for a friend's room. Handing them a bot race while the UI
    // shows that code would be a lie, so this one must surface, not degrade.
    expect(solo.isAutonomous).toBe(false);
    expect(solo.state).not.toBe("lobby");
  });

  it("never reports a dead room as connected", async () => {
    const solo = client("Juno");
    solo.connect("", "seed-dead");
    await flush();
    const impl = solo as unknown as {
      netReady: boolean;
      state: string;
      fail: (m: string, d?: boolean) => void;
    };
    impl.fail("gone", false); // the non-degrading path leaves state = "error"
    expect(impl.state).toBe("error");
    expect(solo.connected).toBe(false);
  });

  it("starts a local race when a host lobby is never joined", async () => {
    const host = client("Kai");
    host.connect("", "seed-watchdog");
    await flush();
    expect(host.isAutonomous).toBe(false);

    // Sit in the lobby well past the watchdog window with nobody arriving.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(host.isAutonomous).toBe(true);
    expect(host.state).toBe("lobby");
    expect(host.roster().length).toBeGreaterThan(0);
  });

  it("does not time out a guest who is waiting for their friend", async () => {
    const host = client("Host");
    host.connect("", "seed-host");
    await flush();
    const guest = client("Guest");
    guest.connect(host.roomCode, "seed-host");
    await flush(12);

    // The guest is in someone else's room with nobody else there yet — that is
    // a correct lobby, not a failure, and must never be replaced by bots.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(guest.isAutonomous).toBe(false);
  });
});

/**
 * A live race must never be silently replaced by bots.
 *
 * `fail()` degrades to a local AI room so a dead lobby is still playable — but
 * `activateAutonomousRoom()` clears every peer track and resets state, so
 * running it while humans are connected replaces them with bots mid-flight.
 * That is a worse outcome than an honest error, and the opposite of what
 * "multiplayer is always best-effort" should mean.
 */
describe("a failure with peers on the wire", () => {
  it("surfaces an error instead of degrading a live room", async () => {
    const host = client("Vale");
    host.connect("", "seed-live");
    await flush();
    const guest = client("Wren");
    guest.connect(host.roomCode, "seed-live");
    await flush(12);

    const impl = host as unknown as {
      fail: (m: string, d?: boolean) => void;
      state: string;
      tracks: Map<string, unknown>;
    };
    impl.fail("socket dropped");
    // Peers are present, so this must NOT have become a bot room.
    expect(impl.state).toBe("error");
    expect(impl.tracks.size).toBeGreaterThan(0);
  });


});

/**
 * A room that hangs with no error is the worst failure this transport can have.
 *
 * Both of these were found by reading the code, not by the suite: the fake
 * delivers every message in FIFO order and never drops one, so neither the
 * ghost-track nor the reaped-peer path was reachable from a test until now.
 */
describe("seats and ghosts in the lobby", () => {
  it("does not wait on a track whose peer is gone", async () => {
    const host = client("Hana");
    host.connect("", "seed-ghost");
    await flush();
    const ghost = client("Ghost");
    ghost.connect(host.roomCode, "seed-ghost");
    await flush(12);
    host.sendReady(true);
    ghost.sendReady(true);
    await vi.advanceTimersByTimeAsync(200);

    // Drop the ghost from the signaling layer WITHOUT a `disconnected` event —
    // what a mobile handover or network change actually looks like. Its track
    // is created by any inbound state frame and would otherwise sit at
    // ready:false forever, deadlocking the countdown for BOTH players.
    const impl = host as unknown as {
      connectedPeers: Set<string>;
      tracks: Map<string, { ready: boolean }>;
    };
    const ghostId = ghost.info().code ? [...impl.connectedPeers][0] : undefined;
    if (ghostId) impl.connectedPeers.delete(ghostId);

    // allReady() must now ignore that seat instead of waiting on it.
    const allReady = (host as unknown as { allReady: () => boolean }).allReady;
    expect(allReady.call(host)).toBe(true);
    expect(impl.tracks.size).toBe(0);
  });

  it("retires a reaped peer's seat instead of freezing its bird", async () => {
    const host = client("Ivo");
    host.connect("", "seed-reap");
    await flush();
    // The stale sweep is racing-only (a lobby track is cleared by `allReady`
    // instead), and tracks only exist once state frames flow — which needs a
    // race. Drive both directly rather than staging a whole match.
    const impl = host as unknown as {
      clock: number;
      state: string;
      tracks: Map<string, { id: string; name: string; lastSeen: number; ready: boolean }>;
      tick: (dt: number) => void;
      pendingEvents: { type: string; name?: string }[];
    };
    impl.state = "racing";
    impl.tracks.set("peer-gone", {
      id: "peer-gone",
      name: "Rook",
      lastSeen: impl.clock - 999, // older than STALE_AFTER
      ready: true,
    });

    impl.tick(0.016);
    // Deleted, AND announced — the same `leave` a clean disconnect emits.
    // Without the event, MassRace keeps the rival frozen on the field and the
    // returning peer's id then matches nothing, so applyRemote takes over a
    // live AI bird and the host's standings silently diverge from every guest.
    expect(impl.tracks.size).toBe(0);
    expect(impl.pendingEvents.some((e) => e.type === "leave" && e.name === "Rook")).toBe(true);
  });

});
