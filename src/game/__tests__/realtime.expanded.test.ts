import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeWebSocket {
  static readonly OPEN = 1;
  static readonly CONNECTING = 0;
  readyState = FakeWebSocket.CONNECTING;
  url: string;
  onopen: ((ev?: Event) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onerror: ((ev?: Event) => void) | null = null;
  onclose: ((ev?: Event) => void) | null = null;
  sent: string[] = [];
  constructor(url: string) {
    this.url = url;
    instances.push(this);
  }
  send(d: string): void {
    this.sent.push(d);
  }
  close(): void {
    this.readyState = 3;
  }
}

const instances: FakeWebSocket[] = [];

// Test helper: read client privates (timers, socket, identity) without an
// `any` cast. Returns unknown fields — the expect() matchers guard correctness.
function peek(client: unknown): Record<string, unknown> {
  return client as Record<string, unknown>;
}

function openSocket(index = 0): void {
  const ws = instances[index];
  if (ws) {
    ws.readyState = FakeWebSocket.OPEN;
    ws.onopen!(null as never);
  }
}

function receive(index: number, data: unknown): void {
  instances[index]!.onmessage!({ data } as MessageEvent);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
  instances.length = 0;
});

async function loadClient(hue = 0.5) {
  vi.stubEnv("VITE_MULTIPLAYER_URL", "/mp");
  vi.stubGlobal("WebSocket", FakeWebSocket);
  const mod = await import("../Realtime");
  const client = new mod.RealtimeClient("d-test", "Bird", "sunbird", hue);
  client.connect("ROOM", "seed");
  return client;
}

async function createClient(hue = 0.5) {
  vi.stubEnv("VITE_MULTIPLAYER_URL", "/mp");
  vi.stubGlobal("WebSocket", FakeWebSocket);
  const mod = await import("../Realtime");
  return new mod.RealtimeClient("d-test", "Bird", "sunbird", hue);
}

describe("RealtimeClient — connection lifecycle (12 tests)", () => {
  it("starts offline when no multiplayer URL", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.stubEnv("VITE_MULTIPLAYER_URL", "");
    const mod = await import("../Realtime");
    const client = new mod.RealtimeClient("d-test", "Bird", "sunbird", 0.5);
    client.connect("ROOM", "seed");
    expect(client.state).toBe("offline");
    expect(client.connected).toBe(false);
    expect(client.errorText).toBe("No multiplayer server configured");
  });

  it("starts in connecting state when URL is set", async () => {
    const client = await loadClient();
    expect(client.state).toBe("connecting");
    expect(client.roomCode).toBe("ROOM");
    expect(client.seed).toBe("seed");
  });

  it("transitions to lobby on socket open", async () => {
    const client = await loadClient();
    openSocket();
    expect(client.state).toBe("lobby");
    expect(client.connected).toBe(true);
  });

  it("transitions to racing on start message", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "start", at: Date.now() + 3000, seed: "newseed" }));
    expect(client.state).toBe("racing");
    expect(client.seed).toBe("newseed");
    expect(client.startsAt).toBe(Date.now() + 3000);
  });

  it("transitions to error on server error message", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "error", message: "Server full" }));
    expect(client.state).toBe("error");
    expect(client.errorText).toBe("Server full");
  });

  it("falls back to error state on empty error message", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "error", message: "" }));
    expect(client.state).toBe("error");
    expect(client.errorText).toBe("Server refused the connection");
  });

  it("disconnect sets state to offline", async () => {
    const client = await loadClient();
    openSocket();
    client.disconnect();
    expect(client.state).toBe("offline");
    expect(client.connected).toBe(false);
  });

  it("disconnect clears retry timer", async () => {
    const client = await loadClient();
    openSocket();
    instances[0]!.onclose!(null as never);
    client.disconnect();
    expect(peek(client).retryTimer).toBeNull();
  });

  it("connect is idempotent when already in same room", async () => {
    const client = await loadClient();
    openSocket();
    const wsBefore = peek(client).ws;
    client.connect("room", "seed");
    expect(peek(client).ws).toBe(wsBefore);
  });

  it("room code is uppercased", async () => {
    vi.stubEnv("VITE_MULTIPLAYER_URL", "/mp");
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const mod = await import("../Realtime");
    const client = new mod.RealtimeClient("d", "B", "sunbird", 0.5);
    client.connect("abcd", "seed");
    expect(client.roomCode).toBe("ABCD");
  });

  it("reconnect uses exponential backoff", async () => {
    const client = await loadClient();
    openSocket();
    instances[0]!.readyState = 3;
    instances[0]!.onclose!(null as never);
    expect(client.state).toBe("connecting");
    vi.advanceTimersByTime(500);
    expect(instances.length).toBe(2);
    // Open the new socket and close it to trigger another retry
    openSocket(1);
    instances[1]!.readyState = 3;
    instances[1]!.onclose!(null as never);
    vi.advanceTimersByTime(900);
    expect(instances.length).toBe(3);
  });

  it("backoff caps at MAX_BACKOFF", async () => {
    const client = await loadClient();
    openSocket();
    for (let i = 0; i < 20; i++) {
      const wait = peek(client).backoff as number;
      instances[i]!.readyState = 3;
      instances[i]!.onclose!(null as never);
      // Reach the retry, not the next attempt's independent connect timeout.
      vi.advanceTimersByTime(wait);
    }
    expect(peek(client).backoff).toBeLessThanOrEqual(15000);
  });
});

describe("RealtimeClient — welcome & self identity (3 tests)", () => {
  it("welcome sets selfId, room, seed, capacity", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "welcome", id: "self-123", room: "ROOM", seed: "s", capacity: 24 }));
    expect(client.id).toBe("self-123");
    expect(client.roomCode).toBe("ROOM");
    expect(client.seed).toBe("s");
    expect(client.capacity).toBe(24);
  });

  it("welcome updates capacity when provided", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "welcome", id: "s1", room: "R", seed: "se", capacity: 10 }));
    expect(client.info().capacity).toBe(10);
  });

  it("id falls back to deviceId when no welcome received", async () => {
    const client = await loadClient();
    expect(client.id).toBe("d-test");
  });
});

describe("RealtimeClient — peers dispatch (10 tests)", () => {
  it("peers creates tracks for new peers", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({
      type: "peers",
      peers: [{ id: "p2", name: "Alice", hue: 0.3, skin: "sunbird", ready: false }],
    }));
    const roster = client.roster();
    expect(roster).toHaveLength(1);
    expect(roster[0].name).toBe("Alice");
    expect(roster[0].hue).toBe(0.3);
  });

  it("peers skips self id", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "welcome", id: "self", room: "R", seed: "s", capacity: 40 }));
    receive(0, JSON.stringify({
      type: "peers",
      peers: [
        { id: "self", name: "Me", hue: 0.5, skin: "sunbird" },
        { id: "p2", name: "Other", hue: 0.3, skin: "sunbird" },
      ],
    }));
    expect(client.roster()).toHaveLength(1);
    expect(client.roster()[0].id).toBe("p2");
  });

  it("peers truncates long names to NAME_MAX", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({
      type: "peers",
      peers: [{ id: "p2", name: "ThisIsAReallyReallyLongName", hue: 0.3, skin: "sunbird" }],
    }));
    expect(client.roster()[0].name.length).toBeLessThanOrEqual(14);
  });

  it("peers ignores invalid peer entries", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({
      type: "peers",
      peers: [{ name: "NoId", hue: 0.3, skin: "s" }],
    }));
    expect(client.roster()).toHaveLength(0);
  });

  it("peers updates existing track fields", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({
      type: "peers",
      peers: [{ id: "p2", name: "Alice", hue: 0.3, skin: "sunbird", ready: false }],
    }));
    receive(0, JSON.stringify({
      type: "peers",
      peers: [{ id: "p2", name: "Alicia", hue: 0.7, skin: "glider", ready: true }],
    }));
    const r = client.roster()[0];
    expect(r.name).toBe("Alicia");
    expect(r.hue).toBe(0.7);
    expect(r.skin).toBe("glider");
  });

  it("ready transition emits join event", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({
      type: "peers",
      peers: [{ id: "p2", name: "Bob", hue: 0.3, skin: "s" }],
    }));
    const events = client.drainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("join");
    expect(peek(events[0]).name).toBe("Bob");
  });

  it("ready flip emits ready event", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({
      type: "peers",
      peers: [{ id: "p2", name: "Bob", hue: 0.3, skin: "s", ready: false }],
    }));
    client.drainEvents();
    receive(0, JSON.stringify({
      type: "peers",
      peers: [{ id: "p2", name: "Bob", hue: 0.3, skin: "s", ready: true }],
    }));
    const events = client.drainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("ready");
  });

  it("peers without ready field defaults to not ready", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({
      type: "peers",
      peers: [{ id: "p2", name: "Bob", hue: 0.3, skin: "s" }],
    }));
    expect(client.roster()[0].ready).toBe(false);
  });

  it("peers without hue retains random hue", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({
      type: "peers",
      peers: [{ id: "p2", name: "Bob", hue: 0.5, skin: "s" }],
    }));
    receive(0, JSON.stringify({
      type: "peers",
      peers: [{ id: "p2", name: "Bob", skin: "s" }],
    }));
    expect(client.roster()[0].hue).toBe(0.5);
  });

  it("peers without skin retains default skin", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({
      type: "peers",
      peers: [{ id: "p2", name: "Bob", hue: 0.3 }],
    }));
    expect(client.roster()[0].skin).toBe("sunbird");
  });

  it("multiple peers all get tracks", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({
      type: "peers",
      peers: [
        { id: "p2", name: "A", hue: 0.1, skin: "s" },
        { id: "p3", name: "B", hue: 0.6, skin: "s" },
        { id: "p4", name: "C", hue: 0.9, skin: "s" },
        { id: "p5", name: "D", hue: 0.3, skin: "s" },
      ],
    }));
    expect(client.roster()).toHaveLength(4);
  });

  it("peers with empty array is a no-op", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "peers", peers: [] }));
    expect(client.roster()).toHaveLength(0);
  });
});

describe("RealtimeClient — left dispatch (3 tests)", () => {
  it("left removes peer and emits leave event", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({
      type: "peers",
      peers: [{ id: "p2", name: "Alice", hue: 0.3, skin: "s" }],
    }));
    client.drainEvents();
    receive(0, JSON.stringify({ type: "left", id: "p2" }));
    expect(client.roster()).toHaveLength(0);
    const events = client.drainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("leave");
  });

  it("left with no matching peer is a no-op", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "left", id: "nobody" }));
    expect(client.roster()).toHaveLength(0);
  });

  it("left for unnamed pilot does not emit leave event", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "state", t: 1, pilots: [["anon", 0, 0, 0, 0]] }));
    receive(0, JSON.stringify({ type: "left", id: "anon" }));
    expect(client.roster()).toHaveLength(0);
    expect(client.drainEvents()).toHaveLength(0);
  });

  it("left with missing id is ignored", async () => {
    await loadClient();
    openSocket();
    expect(() => receive(0, JSON.stringify({ type: "left" }))).not.toThrow();
  });
});

describe("RealtimeClient — state dispatch & interpolation (11 tests)", () => {
  it("state updates serverClock and interpolates position", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "state", t: 100.5, pilots: [["p2", 10, 20, 0, 100]] }));
    const snaps = client.poll();
    expect(snaps).toHaveLength(1);
    expect(snaps[0]!.id).toBe("p2");
    expect(snaps[0]!.x).toBeCloseTo(10, 1);
    expect(snaps[0]!.y).toBeCloseTo(20, 1);
    expect(snaps[0]!.rotation).toBeCloseTo(0, 1);
  });

  it("state with two keyframes interpolates between them", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "state", t: 100, pilots: [["p2", 0, 0, 0, 0]] }));
    receive(0, JSON.stringify({ type: "state", t: 110, pilots: [["p2", 100, 0, 0, 100]] }));
    const snaps = client.poll();
    expect(snaps).toHaveLength(1);
    expect(snaps[0]!.x).toBeCloseTo(98.8, 0);
  });

  it("non-finite coordinates are dropped at boundary", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({
      type: "state",
      t: 1,
      pilots: [
        ["hacker", NaN, NaN, NaN, 999],
        ["clean", 10, 20, 0, 50],
      ],
    }));
    const snaps = client.poll();
    expect(snaps).toHaveLength(1);
    expect(snaps[0]!.id).toBe("clean");
    expect(Number.isFinite(snaps[0]!.x)).toBe(true);
    expect(Number.isFinite(snaps[0]!.y)).toBe(true);
  });

  it("self id is excluded from state updates", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "welcome", id: "self", room: "R", seed: "s", capacity: 40 }));
    receive(0, JSON.stringify({ type: "state", t: 1, pilots: [["self", 99, 99, 0, 99]] }));
    expect(client.poll()).toHaveLength(0);
  });

  it("state buffer is capped at 4 keyframes", async () => {
    const client = await loadClient();
    openSocket();
    for (let i = 0; i < 6; i++) {
      receive(0, JSON.stringify({ type: "state", t: i, pilots: [["p2", i * 10, 0, 0, 0]] }));
    }
    expect(client.poll()).toHaveLength(1);
  });

  it("poll returns empty when no tracks exist", async () => {
    const client = await loadClient();
    openSocket();
    expect(client.poll()).toHaveLength(0);
  });

  it("finished state is preserved in polls", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "finish", id: "p2", time: 15.5, place: 3 }));
    receive(0, JSON.stringify({ type: "state", t: 1, pilots: [["p2", 100, 0, 0, 100]] }));
    const snaps = client.poll();
    expect(snaps).toHaveLength(1);
    expect(snaps[0]!.finished).toBe(true);
  });

  it("state with empty pilots array is a no-op", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "state", t: 1, pilots: [] }));
    expect(client.poll()).toHaveLength(0);
  });

  it("state with no pilots key is a no-op", async () => {
    await loadClient();
    openSocket();
    expect(() => receive(0, JSON.stringify({ type: "state", t: 1 }))).not.toThrow();
  });

  it("multiple pilots in one state message", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({
      type: "state",
      t: 1,
      pilots: [
        ["p2", 10, 0, 0, 50],
        ["p3", 20, 0, 0, 60],
        ["p4", 30, 0, 0, 70],
      ],
    }));
    expect(client.poll()).toHaveLength(3);
  });

  it("state with non-finite distance retains previous distance", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "state", t: 1, pilots: [["p2", 10, 0, 0, 50]] }));
    receive(0, JSON.stringify({ type: "state", t: 2, pilots: [["p2", 20, 0, 0, Infinity]] }));
    const roster = client.roster();
    expect(roster[0]!.distance).toBe(50);
  });

  it("buffer trims oldest when exceeding 4 keyframes", async () => {
    const client = await loadClient();
    openSocket();
    for (let i = 0; i < 10; i++) {
      receive(0, JSON.stringify({ type: "state", t: i, pilots: [["p2", i * 10, 0, 0, 0]] }));
    }
    const track = (client as unknown as { tracks: Map<string, unknown> }).tracks.get("p2");
    const buffer = (track as { buffer: unknown[] }).buffer;
    expect(buffer.length).toBeLessThanOrEqual(4);
  });
});

describe("RealtimeClient — emote dispatch (6 tests)", () => {
  it("emote creates track and queues emote", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "emote", id: "p2", emote: "woot" }));
    const emotes = client.drainEmotes();
    expect(emotes).toHaveLength(1);
    expect(emotes[0]!.emote).toBe("woot");
    expect(emotes[0]!.id).toBe("p2");
  });

  it("emote for self is ignored", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "welcome", id: "self", room: "R", seed: "s", capacity: 40 }));
    receive(0, JSON.stringify({ type: "emote", id: "self", emote: "woot" }));
    expect(client.drainEmotes()).toHaveLength(0);
  });

  it("drainEmotes is empty after second call", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "emote", id: "p2", emote: "hi" }));
    expect(client.drainEmotes()).toHaveLength(1);
    expect(client.drainEmotes()).toHaveLength(0);
  });

  it("multiple emotes drain in order", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "emote", id: "p2", emote: "hi" }));
    receive(0, JSON.stringify({ type: "emote", id: "p3", emote: "yo" }));
    receive(0, JSON.stringify({ type: "emote", id: "p2", emote: "wow" }));
    const drained = client.drainEmotes();
    expect(drained).toHaveLength(3);
    expect(drained[0]!.emote).toBe("hi");
    expect(drained[1]!.emote).toBe("yo");
    expect(drained[2]!.emote).toBe("wow");
  });

  it("emote updates track emoteAt", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "state", t: 1, pilots: [["p2", 10, 0, 0, 100]] }));
    receive(0, JSON.stringify({ type: "emote", id: "p2", emote: "woot" }));
    const roster = client.roster();
    expect(roster[0]!.emote).toBe("woot");
  });

  it("emote without id is ignored", async () => {
    await loadClient();
    openSocket();
    expect(() => receive(0, JSON.stringify({ type: "emote", emote: "woot" }))).not.toThrow();
  });
});

describe("RealtimeClient — finish dispatch (7 tests)", () => {
  it("finish for self sets myPlace", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "welcome", id: "self", room: "R", seed: "s", capacity: 40 }));
    receive(0, JSON.stringify({ type: "finish", id: "self", time: 12.5, place: 1 }));
    expect(client.myPlace).toBe(1);
  });

  it("finish for other emits finish event", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "state", t: 1, pilots: [["p2", 50, 0, 0, 50]] }));
    receive(0, JSON.stringify({ type: "finish", id: "p2", time: 15.5, place: 2 }));
    const events = client.drainEvents();
    const finishEvent = events.find((e) => e.type === "finish");
    expect(finishEvent).toBeDefined();
    expect(finishEvent!.place).toBe(2);
  });

  it("finish clears myPlace on start", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "welcome", id: "self", room: "R", seed: "s", capacity: 40 }));
    receive(0, JSON.stringify({ type: "finish", id: "self", time: 12, place: 1 }));
    expect(client.myPlace).toBe(1);
    receive(0, JSON.stringify({ type: "start", at: Date.now() + 3000, seed: "s" }));
    expect(client.myPlace).toBe(0);
  });

  it("finish with no place defaults to 0", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "state", t: 1, pilots: [["p2", 50, 0, 0, 50]] }));
    receive(0, JSON.stringify({ type: "finish", id: "p2", time: 15.5 }));
    const events = client.drainEvents();
    const finishEvent = events.find((e) => e.type === "finish");
    expect(finishEvent).toBeDefined();
    expect(finishEvent!.place).toBe(0);
  });

  it("finish for self does not emit finish event", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "welcome", id: "self", room: "R", seed: "s", capacity: 40 }));
    receive(0, JSON.stringify({ type: "finish", id: "self", time: 12, place: 1 }));
    expect(client.drainEvents()).toHaveLength(0);
  });

  it("multiple finishes emit multiple events", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "state", t: 1, pilots: [["p2", 50, 0, 0, 50], ["p3", 40, 0, 0, 40]] }));
    receive(0, JSON.stringify({ type: "finish", id: "p2", time: 15, place: 1 }));
    receive(0, JSON.stringify({ type: "finish", id: "p3", time: 16, place: 2 }));
    const events = client.drainEvents();
    const finishes = events.filter((e) => e.type === "finish");
    expect(finishes).toHaveLength(2);
    expect(finishes[0]!.place).toBe(1);
    expect(finishes[1]!.place).toBe(2);
  });

  it("finish sets pilot finished flag", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "state", t: 1, pilots: [["p2", 10, 0, 0, 100]] }));
    receive(0, JSON.stringify({ type: "finish", id: "p2", time: 15, place: 1 }));
    const roster = client.roster();
    expect(roster[0]!.finished).toBe(true);
  });

  it("finish sets pilot finishTime", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "state", t: 1, pilots: [["p2", 10, 0, 0, 100]] }));
    receive(0, JSON.stringify({ type: "finish", id: "p2", time: 15.5, place: 1 }));
    expect(client.roster()[0]!.finishTime).toBe(15.5);
  });
});

describe("RealtimeClient — start event (6 tests)", () => {
  it("start emits start event", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "start", at: Date.now() + 2000, seed: "s" }));
    const events = client.drainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("start");
  });

  it("start resets myPlace to 0", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "welcome", id: "self", room: "R", seed: "s", capacity: 40 }));
    receive(0, JSON.stringify({ type: "finish", id: "self", time: 12, place: 1 }));
    expect(client.myPlace).toBe(1);
    receive(0, JSON.stringify({ type: "start", at: Date.now() + 2000, seed: "s" }));
    expect(client.myPlace).toBe(0);
  });

  it("start uses provided seed if present", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "start", at: Date.now() + 2000, seed: "raceseed" }));
    expect(client.seed).toBe("raceseed");
  });

  it("start without seed retains current seed", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "start", at: Date.now() + 2000 }));
    expect(client.seed).toBe("seed");
  });

  it("start without at is ignored (stays in current state)", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "start", seed: "s" }));
    expect(client.state).toBe("lobby");
  });

  it("a duplicate start cannot rewrite an active race seed", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "start", at: Date.now() + 2000, seed: "s" }));
    expect(client.state).toBe("racing");
    receive(0, JSON.stringify({ type: "start", at: Date.now() + 3000, seed: "s2" }));
    expect(client.state).toBe("racing");
    expect(client.seed).toBe("s");
    expect(client.drainEvents().filter(e => e.type === "start")).toHaveLength(1);
  });
});

describe("RealtimeClient — send throttling (18 tests)", () => {
  it("send only fires when connected", async () => {
    const client = await createClient();
    client.connect("ROOM", "seed");
    client.tick(1);
    client.send(10, 20, 0.5, 100);
    expect(instances[0]!.sent).toHaveLength(0);
  });

  it("send respects 15 Hz SEND_DT interval", async () => {
    const client = await loadClient();
    openSocket();
    client.tick(1 / 60);
    client.send(10, 20, 0.5, 100);
    expect(instances[0]!.sent).toHaveLength(0);
    client.tick(1 / 15 + 0.01);
    client.send(10, 20, 0.5, 100);
    expect(instances[0]!.sent).toHaveLength(1);
  });

  it("send skips redundant coordinates", async () => {
    const client = await loadClient();
    openSocket();
    client.tick(1);
    client.send(10, 20, 0.5, 100);
    expect(instances[0]!.sent).toHaveLength(1);
    client.tick(1);
    client.send(10.01, 20.01, 0.5, 100);
    expect(instances[0]!.sent).toHaveLength(1);
  });

  it("send quantizes x to 1 decimal", async () => {
    const client = await loadClient();
    openSocket();
    client.tick(1);
    client.send(10.156, 20.943, 0.567, 100.7);
    expect(JSON.parse(instances[0]!.sent[0]!).x).toBe(10.2);
  });

  it("send quantizes y to 1 decimal", async () => {
    const client = await loadClient();
    openSocket();
    client.tick(1);
    client.send(10.156, 20.943, 0.567, 100.7);
    expect(JSON.parse(instances[0]!.sent[0]!).y).toBe(20.9);
  });

  it("send quantizes rotation to 2 decimals", async () => {
    const client = await loadClient();
    openSocket();
    client.tick(1);
    client.send(10.156, 20.943, 0.567, 100.7);
    expect(JSON.parse(instances[0]!.sent[0]!).r).toBe(0.57);
  });

  it("send rounds distance to integer", async () => {
    const client = await loadClient();
    openSocket();
    client.tick(1);
    client.send(10.156, 20.943, 0.567, 100.7);
    expect(JSON.parse(instances[0]!.sent[0]!).d).toBe(101);
  });

  it("sendEmote only fires when connected", async () => {
    const client = await createClient();
    client.connect("ROOM", "seed");
    client.sendEmote("woot");
    expect(instances[0]!.sent).toHaveLength(0);
  });

  it("sendEmote fires when connected", async () => {
    const client = await loadClient();
    openSocket();
    client.sendEmote("woot");
    expect(instances[0]!.sent).toHaveLength(1);
    const parsed = JSON.parse(instances[0]!.sent[0]!);
    expect(parsed.type).toBe("emote");
    expect(parsed.emote).toBe("woot");
  });

  it("sendReady only fires when not connected", async () => {
    const client = await createClient();
    client.connect("ROOM", "seed");
    client.sendReady(true);
    expect(instances[0]!.sent).toHaveLength(0);
  });

  it("sendReady fires when connected", async () => {
    const client = await loadClient();
    openSocket();
    expect(client.sendReady(true)).toBe(true);
    expect(instances[0]!.sent).toHaveLength(1);
    const parsed = JSON.parse(instances[0]!.sent[0]!);
    expect(parsed.type).toBe("ready");
    expect(parsed.ready).toBe(true);
    expect(client.info().ready).toBe(true);
  });

  it("keeps local ready state in sync when a pilot changes their mind", async () => {
    const client = await loadClient();
    openSocket();
    client.sendReady(true);
    expect(client.info().ready).toBe(true);
    client.sendReady(false);
    expect(client.info().ready).toBe(false);
  });

  it("sendFinish only fires when not connected", async () => {
    const client = await createClient();
    client.connect("ROOM", "seed");
    client.sendFinish(15.5, 2000);
    expect(instances[0]!.sent).toHaveLength(0);
  });

  it("sendFinish fires when connected", async () => {
    const client = await loadClient();
    openSocket();
    client.sendFinish(15.5, 2000);
    expect(instances[0]!.sent).toHaveLength(1);
    const parsed = JSON.parse(instances[0]!.sent[0]!);
    expect(parsed.type).toBe("finish");
    expect(parsed.time).toBe(15.5);
    expect(parsed.d).toBe(2000);
  });

  it("send quantizes time to 2 decimals", async () => {
    const client = await loadClient();
    openSocket();
    client.tick(1);
    client.sendFinish(15.56789, 2000.9);
    const parsed = JSON.parse(instances[0]!.sent[0]!);
    expect(parsed.time).toBe(15.57);
    expect(parsed.d).toBe(2001);
  });

  it("send after disconnect is a no-op (the leave frame is the last word)", async () => {
    const client = await loadClient();
    openSocket();
    client.disconnect();
    // Leaving on purpose announces itself once, so the room frees the seat
    // instead of holding it for the reconnect grace window — a deliberate
    // departure must not look like a dropped socket to everyone else.
    expect(instances[0]!.sent.map((raw) => JSON.parse(raw).type)).toEqual(["leave"]);
    client.tick(1);
    client.send(10, 20, 0.5, 100);
    client.sendEmote("👋");
    client.sendReady(true);
    client.sendFinish(12, 900);
    expect(instances[0]!.sent).toHaveLength(1);
  });

  it("send does not fire when still connecting", async () => {
    const client = await createClient();
    client.connect("ROOM", "seed");
    client.tick(1);
    client.send(10, 20, 0.5, 100);
    expect(instances[0]!.sent).toHaveLength(0);
  });

  it("sendEmote does not fire when still connecting", async () => {
    const client = await createClient();
    client.connect("ROOM", "seed");
    client.sendEmote("woot");
    expect(instances[0]!.sent).toHaveLength(0);
  });

  it("sendReady does not fire when still connecting", async () => {
    const client = await createClient();
    client.connect("ROOM", "seed");
    client.sendReady(true);
    expect(instances[0]!.sent).toHaveLength(0);
  });

  it("sendFinish does not fire when still connecting", async () => {
    const client = await createClient();
    client.connect("ROOM", "seed");
    client.sendFinish(15.5, 2000);
    expect(instances[0]!.sent).toHaveLength(0);
  });

  it("send with large coordinates still sends", async () => {
    const client = await loadClient();
    openSocket();
    client.tick(1);
    client.send(999999, -999999, 3.14, 5000);
    const parsed = JSON.parse(instances[0]!.sent[0]!);
    expect(parsed.x).toBe(999999);
    expect(parsed.y).toBe(-999999);
  });
});

describe("RealtimeClient — tick & staleness (5 tests)", () => {
  it("tick advances clock", async () => {
    const client = await loadClient();
    openSocket();
    client.tick(1.5);
    expect(client.info().code).toBe("ROOM");
  });

  it("stale peers are reaped after STALE_AFTER seconds", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({
      type: "peers",
      peers: [{ id: "p2", name: "Alice", hue: 0.3, skin: "s" }],
    }));
    expect(client.roster()).toHaveLength(1);
    receive(0, JSON.stringify({ type: "start", at: Date.now(), seed: "seed" }));
    client.tick(7);
    expect(client.roster()).toHaveLength(0);
  });

  it("recently seen peers survive staleness check", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({
      type: "peers",
      peers: [{ id: "p2", name: "Alice", hue: 0.3, skin: "s" }],
    }));
    client.tick(3);
    expect(client.roster()).toHaveLength(1);
  });

  it("stale peers exactly at STALE_AFTER survive", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({
      type: "peers",
      peers: [{ id: "p2", name: "Alice", hue: 0.3, skin: "s" }],
    }));
    client.tick(6);
    expect(client.roster()).toHaveLength(1);
  });

  it("stale peers just over STALE_AFTER are reaped", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({
      type: "peers",
      peers: [{ id: "p2", name: "Alice", hue: 0.3, skin: "s" }],
    }));
    receive(0, JSON.stringify({ type: "start", at: Date.now(), seed: "seed" }));
    client.tick(6.01);
    expect(client.roster()).toHaveLength(0);
  });

  it("active peers survive multiple ticks with state updates", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({
      type: "peers",
      peers: [{ id: "p2", name: "Alice", hue: 0.3, skin: "s" }],
    }));
    for (let t = 0; t < 5; t++) {
      client.tick(0.5);
      receive(0, JSON.stringify({ type: "state", t, pilots: [["p2", t * 10, 0, 0, 0]] }));
    }
    client.tick(0.5);
    expect(client.roster()).toHaveLength(1);
  });
});

describe("RealtimeClient — roster & info (12 tests)", () => {
  it("roster shows correct count", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({
      type: "peers",
      peers: [
        { id: "p2", name: "A", hue: 0.1, skin: "s" },
        { id: "p3", name: "B", hue: 0.6, skin: "s" },
      ],
    }));
    expect(client.roster()).toHaveLength(2);
  });

  it("info reflects current state", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({
      type: "peers",
      peers: [{ id: "p2", name: "A", hue: 0.3, skin: "s" }],
    }));
    const info = client.info();
    expect(info.code).toBe("ROOM");
    expect(info.seed).toBe("seed");
    expect(info.count).toBe(2);
    expect(info.capacity).toBe(40);
    expect(info.state).toBe("lobby");
    expect(info.error).toBe("");
  });

  it("info startsInMs computed from startsAt", async () => {
    const client = await loadClient();
    openSocket();
    const future = Date.now() + 5000;
    receive(0, JSON.stringify({ type: "start", at: future, seed: "s" }));
    expect(client.info().startsInMs).toBeCloseTo(5000, -1);
  });

  it("info startsInMs is 0 when no start scheduled", async () => {
    const client = await loadClient();
    openSocket();
    expect(client.info().startsInMs).toBe(0);
  });

  it("info startsInMs is 0 when start time is in the past", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "start", at: Date.now() - 1000, seed: "s" }));
    expect(client.info().startsInMs).toBe(0);
  });

  it("roster is empty when no peers", async () => {
    const client = await loadClient();
    openSocket();
    expect(client.roster()).toHaveLength(0);
  });

  it("emote appears in roster when recent", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "emote", id: "p2", emote: "woot" }));
    const roster = client.roster();
    expect(roster[0]!.emote).toBe("woot");
  });

  it("emote expires after 2.5 seconds", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "emote", id: "p2", emote: "woot" }));
    client.tick(2.6);
    const roster = client.roster();
    expect(roster[0]!.emote).toBe("");
  });

  it("emote just under 2.5s is still visible", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "emote", id: "p2", emote: "woot" }));
    client.tick(2.4);
    expect(client.roster()[0]!.emote).toBe("woot");
  });

  it("info count is tracks + 1 when connected", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({
      type: "peers",
      peers: [{ id: "p2", name: "A", hue: 0.3, skin: "s" }],
    }));
    expect(client.info().count).toBe(2);
  });

  it("info count is tracks + 0 when not connected", async () => {
    const client = await loadClient();
    receive(0, JSON.stringify({
      type: "peers",
      peers: [{ id: "p2", name: "A", hue: 0.3, skin: "s" }],
    }));
    expect(client.info().count).toBe(1);
  });

  it("info error is populated in error state", async () => {
    const client = await loadClient();
    receive(0, JSON.stringify({ type: "error", message: "Full" }));
    expect(client.info().error).toBe("Full");
  });
});

describe("RealtimeClient — malformed frame handling (12 tests)", () => {
  it("non-JSON message is ignored", async () => {
    const client = await loadClient();
    openSocket();
    expect(() => receive(0, "not json")).not.toThrow();
    expect(client.state).toBe("lobby");
  });

  it("JSON with wrong type is ignored", async () => {
    await loadClient();
    openSocket();
    expect(() => receive(0, JSON.stringify({ type: "weird" }))).not.toThrow();
  });

  it("peers with no peers key is ignored", async () => {
    const client = await loadClient();
    openSocket();
    expect(() => receive(0, JSON.stringify({ type: "peers" }))).not.toThrow();
    expect(client.roster()).toHaveLength(0);
  });

  it("state with non-array pilots is ignored", async () => {
    await loadClient();
    openSocket();
    expect(() => receive(0, JSON.stringify({ type: "state", t: 1, pilots: "not-an-array" }))).not.toThrow();
  });

  it("parse error with undefined data does not throw", async () => {
    await loadClient();
    openSocket();
    expect(() => receive(0, undefined)).not.toThrow();
  });

  it("left without id is ignored", async () => {
    await loadClient();
    openSocket();
    expect(() => receive(0, JSON.stringify({ type: "left" }))).not.toThrow();
  });

  it("finish without id is ignored", async () => {
    await loadClient();
    openSocket();
    expect(() => receive(0, JSON.stringify({ type: "finish", time: 10 }))).not.toThrow();
  });

  it("emote with non-string emote is handled", async () => {
    await loadClient();
    openSocket();
    expect(() => receive(0, JSON.stringify({ type: "emote", id: "p2", emote: 123 }))).not.toThrow();
  });

  it("start without at is ignored (state unchanged)", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "start", seed: "s" }));
    expect(client.state).toBe("lobby");
  });

  it("welcome without id is ignored", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "welcome", room: "R", seed: "s", capacity: 40 }));
    expect(peek(client).selfId).toBe("");
    expect(client.state).toBe("lobby");
  });

  it("welcome without seed retains old seed", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "welcome", id: "s1", room: "R", capacity: 40 }));
    expect(client.seed).toBe("seed");
  });

  it("error with non-string message uses fallback", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "error", message: 123 }));
    expect(client.state).toBe("error");
    expect(client.errorText).toBe("Server refused the connection");
  });
});

describe("RealtimeClient — connection failure handling (5 tests)", () => {
  it("onerror sets errorText", async () => {
    const client = await loadClient();
    openSocket();
    instances[0]!.onerror!(null as never);
    expect(client.errorText).toBe("Connection problem");
  });

  it("onclose without closedByUs schedules retry", async () => {
    const client = await loadClient();
    openSocket();
    instances[0]!.onclose!(null as never);
    expect(client.state).toBe("connecting");
    vi.advanceTimersByTime(500);
    expect(instances.length).toBe(2);
  });

  it("onclose with closedByUs does not retry", async () => {
    const client = await loadClient();
    openSocket();
    // disconnect nullifies onclose, so we simulate the full close-then-reconnect path
    client.disconnect();
    expect(client.state).toBe("offline");
    expect(peek(client).ws).toBeNull();
    vi.advanceTimersByTime(20000);
    expect(instances.length).toBe(1);
  });

  it("tracks are cleared on unexpected close", async () => {
    const client = await loadClient();
    openSocket();
    receive(0, JSON.stringify({ type: "state", t: 1, pilots: [["p2", 10, 0, 0, 0]] }));
    expect(client.poll()).toHaveLength(1);
    instances[0]!.onclose!(null as never);
    expect(client.poll()).toHaveLength(0);
  });

  it("reconnect after close creates fresh connection", async () => {
    await loadClient();
    openSocket();
    const ws = instances[0]!;
    ws.readyState = 3;
    ws.onclose!(null as never);
    vi.advanceTimersByTime(500);
    expect(instances.length).toBe(2);
    expect(instances[1]).not.toBe(ws);
  });

  it("onclose clears ws reference", async () => {
    const client = await loadClient();
    openSocket();
    instances[0]!.onclose!(null as never);
    expect(peek(client).ws).toBeNull();
  });
});

describe("RealtimeClient — multiplayer configured check (3 tests)", () => {
  it("isMultiplayerConfigured returns true when URL is set", async () => {
    vi.stubEnv("VITE_MULTIPLAYER_URL", "/mp");
    const mod = await import("../Realtime");
    expect(mod.isMultiplayerConfigured()).toBe(true);
  });

  it("isMultiplayerConfigured returns false when URL is empty", async () => {
    vi.stubEnv("VITE_MULTIPLAYER_URL", "");
    const mod = await import("../Realtime");
    expect(mod.isMultiplayerConfigured()).toBe(false);
  });

  it("isMultiplayerConfigured returns false when URL is whitespace", async () => {
    vi.stubEnv("VITE_MULTIPLAYER_URL", "  ");
    const mod = await import("../Realtime");
    expect(mod.isMultiplayerConfigured()).toBe(false);
  });
});

describe("RealtimeClient — URL construction (5 tests)", () => {
  it("sets device, name, skin, hue query params", async () => {
    vi.stubEnv("VITE_MULTIPLAYER_URL", "/mp");
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const mod = await import("../Realtime");
    const client = new mod.RealtimeClient("my-device", "Alice", "glider", 120);
    client.connect("ABCD", "myseed");
    const url = new URL(instances[0]!.url, "http://localhost");
    expect(url.searchParams.get("device")).toBe("my-device");
    expect(url.searchParams.get("name")).toBe("Alice");
    expect(url.searchParams.get("skin")).toBe("glider");
    expect(url.searchParams.get("hue")).toBe("120.000");
    expect(url.searchParams.get("room")).toBe("ABCD");
    expect(url.searchParams.get("seed")).toBe("myseed");
  });

  it("room code is uppercased in URL", async () => {
    vi.stubEnv("VITE_MULTIPLAYER_URL", "/mp");
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const mod = await import("../Realtime");
    const client = new mod.RealtimeClient("d", "B", "sunbird", 0.5);
    client.connect("abcd", "seed");
    expect(instances[0]!.url).toContain("room=ABCD");
  });

  it("hue is formatted to 3 decimal places", async () => {
    vi.stubEnv("VITE_MULTIPLAYER_URL", "/mp");
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const mod = await import("../Realtime");
    const client = new mod.RealtimeClient("d", "B", "sunbird", 0.123);
    client.connect("ROOM", "seed");
    expect(instances[0]!.url).toContain("hue=0.123");
  });

  it("room query param is omitted when code is empty", async () => {
    vi.stubEnv("VITE_MULTIPLAYER_URL", "/mp");
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const mod = await import("../Realtime");
    const client = new mod.RealtimeClient("d", "B", "sunbird", 0.5);
    client.connect("", "seed");
    expect(instances[0]!.url).not.toContain("room=");
  });

  it("seed query param is omitted when seed is empty", async () => {
    vi.stubEnv("VITE_MULTIPLAYER_URL", "/mp");
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const mod = await import("../Realtime");
    const client = new mod.RealtimeClient("d", "B", "sunbird", 0.5);
    client.connect("ROOM", "");
    expect(instances[0]!.url).not.toContain("seed=");
  });
});

describe("RealtimeClient — edge cases (4 tests)", () => {
  it("hue of 0 works", async () => {
    const client = await loadClient(0);
    openSocket();
    expect(client.connected).toBe(true);
  });

  it("hue of 1 works", async () => {
    const client = await loadClient(1);
    openSocket();
    expect(client.connected).toBe(true);
  });

  it("hue of 360 works", async () => {
    const client = await loadClient(360);
    openSocket();
    expect(client.connected).toBe(true);
  });

  it("setIdentity updates name, skin, hue", async () => {
    const client = await loadClient();
    client.setIdentity("NewName", "glider", 0.8);
    expect(peek(client).name).toBe("NewName");
    expect(peek(client).skin).toBe("glider");
    expect(peek(client).hue).toBe(0.8);
  });
});


describe("live room journey regressions", () => {
  it("keeps the public socket after the server assigns a room code", async () => {
    const client = await createClient();
    client.connect("", "today"); openSocket();
    receive(0, JSON.stringify({ type: "welcome", id: "you", room: "ABCDE", seed: "today", capacity: 40 }));
    client.connect("", "today");
    expect(instances).toHaveLength(1);
    expect(client.roomCode).toBe("ABCDE");
  });
  it("keeps a private socket after adopting the host's different terrain seed", async () => {
    const client = await createClient();
    client.connect("ABCDE", "guest-terrain"); openSocket();
    receive(0, JSON.stringify({ type: "welcome", id: "you", room: "ABCDE", seed: "host-terrain", capacity: 40 }));
    client.connect("ABCDE", "guest-terrain");
    expect(instances).toHaveLength(1);
    expect(client.seed).toBe("host-terrain");
  });
  it("does not invent departures for motionless lobby pilots", async () => {
    const client = await loadClient(); openSocket();
    receive(0, JSON.stringify({ type: "peers", peers: [{ id: "friend", name: "Friend" }] }));
    client.tick(65);
    expect(client.roster()).toHaveLength(1);
    receive(0, JSON.stringify({ type: "left", id: "friend" }));
    expect(client.roster()).toHaveLength(0);
  });
  it("refreshes lobby liveness without movement or changing ready state", async () => {
    const client = await loadClient(); openSocket();
    client.sendReady(true); client.tick(15);
    expect(JSON.parse(instances[0]!.sent.at(-1)!)).toEqual({ type: "ready", ready: true });
  });
  it("disconnect clears delayed start events, readiness, and visible room identity", async () => {
    const client = await loadClient(); openSocket(); client.sendReady(true);
    receive(0, JSON.stringify({ type: "start", at: Date.now() + 6000, seed: "seed" }));
    client.disconnect();
    expect(client.drainEvents()).toEqual([]);
    expect(client.info()).toMatchObject({ code: "", ready: false, startsInMs: 0 });
  });
});


it("an invalid deployment socket URL becomes visible error state, not an uncaught exception", async () => {
  vi.stubEnv("VITE_MULTIPLAYER_URL", "https://[");
  vi.stubGlobal("WebSocket", FakeWebSocket);
  const { RealtimeClient } = await import("../Realtime");
  const client = new RealtimeClient("test", "Pilot", "sunbird", 0);
  expect(() => client.connect("ABCDE", "seed")).not.toThrow();
  expect(client.info()).toMatchObject({ state: "error", error: "Could not reach the race server" });
});


describe("race interruption boundaries", () => {
  it("ends a stuck connection attempt and ignores its late open callback", async () => {
    const client = await loadClient();
    vi.advanceTimersByTime(10000);
    expect(client.state).toBe("error");
    expect(client.errorText).toContain("timed out");
    openSocket();
    expect(client.state).toBe("error");
    client.disconnect();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not silently rejoin another race after a mid-race disconnect", async () => {
    const client = await loadClient(); openSocket();
    receive(0, JSON.stringify({ type: "start", at: Date.now() + 3000, seed: "s" }));
    instances[0]!.onclose!();
    expect(client.state).toBe("error");
    expect(client.myPlace).toBe(0);
    expect(client.drainEvents()).toEqual([{ type: "interrupted", message: client.errorText }]);
    vi.advanceTimersByTime(60000);
    expect(instances).toHaveLength(1);
    client.connect("ROOM", "s");
    expect(instances).toHaveLength(2);
    expect(client.state).toBe("connecting");
    client.disconnect();
  });
  it("does not retry a server-rejected room forever", async () => {
    const client = await loadClient(); openSocket();
    receive(0, JSON.stringify({ type: "error", message: "Room full" }));
    instances[0]!.onclose!();
    vi.advanceTimersByTime(60000);
    expect(instances).toHaveLength(1);
    expect(client.errorText).toBe("Room full");
    expect(client.state).toBe("error");
  });
});
