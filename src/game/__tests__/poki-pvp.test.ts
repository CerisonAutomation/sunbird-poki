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
