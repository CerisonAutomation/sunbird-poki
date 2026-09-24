// @vitest-environment node
/**
 * Live PvP integration check — the REAL client class, against the REAL server.
 *
 * Everything else in the suite tests the client in isolation (protocol
 * boundary tests, routing tests) or the server alone (botsim, server tests).
 * This is the only check that exercises the pair a player actually experiences:
 * two `RealtimeClient` instances, one room, live state frames, emotes, finish
 * order and presence events.
 *
 * It needs a running room server, wired exactly like a real build wires it:
 * `VITE_MULTIPLAYER_URL` is read by Realtime.ts at import time, so the test
 * suite must be launched with it pointing at a live, ABSOLUTE ws:// endpoint.
 *
 *   node --import tsx server/src/index.ts &                        # room server
 *   VITE_MULTIPLAYER_URL=ws://127.0.0.1:8790/mp pnpm test:pvp
 *
 * Without an absolute ws:// URL the suite SKIPS with a reason, so a plain
 * `pnpm test` (no server) is never a false failure. CI runs it in a dedicated
 * job that starts the server first — see .github/workflows/ci.yml,
 * job "PvP (two live clients, real protocol)".
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { RealtimeClient } from "../Realtime";

/** Absolute ws:// endpoint configured for this run, or "" to skip. */
const LIVE_URL = String(import.meta.env.VITE_MULTIPLAYER_URL ?? "");
const LIVE = LIVE_URL.startsWith("ws");

/**
 * The client class is browser code: it reads `location` and uses `window`
 * timers. Node 22 ships a global WebSocket, so a two-line shim is enough.
 *
 * The environment is pinned to `node` on purpose. Under vitest's jsdom
 * environment the global WebSocket is still Node's (undici), but its
 * `dispatchEvent` receives jsdom's `Event` — a different realm — and every
 * connection dies with 'The "event" argument must be an instance of Event',
 * i.e. the tests could never speak to a real server.
 */
function installBrowserShim(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!g.window) g.window = globalThis;
  if (!g.location) g.location = new URL("http://localhost/");
  if (typeof g.WebSocket !== "function") {
    throw new Error("this suite needs a global WebSocket (Node 22+) to talk to a real room server");
  }
}

type Client = RealtimeClient & { poll: () => { id: string; x: number; y: number; rotation: number }[] };

function makeClient(name: string): RealtimeClient {
  installBrowserShim();
  return new RealtimeClient(`${name}-device`, name, "sunbird", 0.42);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll until `predicate` holds, or give up (returns false). */
async function until(predicate: () => boolean, timeoutMs = 4000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await wait(50);
  }
  return predicate();
}

const live = LIVE ? describe : describe.skip;

afterEach(() => {
  vi.useRealTimers();
});

live("live PvP (two real clients, real server)", () => {
  const clients: RealtimeClient[] = [];
  /** Unique room per test: a static code would also match seats left over from
   *  an earlier run during the server's reconnect grace window, and the roster
   *  assertions would then see the wrong pilots. */
  const roomCode = () => `P${Date.now().toString(36).slice(-5)}${Math.floor(Math.random() * 1296).toString(36)}`.toUpperCase().slice(0, 5);
  const pair = () => {
    const stamp = Date.now().toString(36).slice(-4);
    const a = makeClient(`Avia${stamp}`);
    const b = makeClient(`Bora${stamp}`);
    clients.push(a, b);
    return { a, b, room: roomCode() };
  };

  afterEach(() => {
    for (const c of clients.splice(0)) {
      try { c.disconnect(); } catch { /* already gone */ }
    }
  });

  it("joins a private room by code and sees the other pilot", async () => {
    const { a, b, room } = pair();
    // Same room code => same room, with the host's seed adopted (codeIsRemote).
    a.connect(room, "seed-host:courses", false);
    await until(() => a.state === "lobby", 6000);
    b.connect(room, "seed-host:courses", true);

    expect(await until(() => a.roster().length >= 1 && b.roster().length >= 1)).toBe(true);
    const seenByA = a.roster().filter((p) => !p.you);
    expect(seenByA.length).toBeGreaterThanOrEqual(1);
    expect(seenByA[0]!.name).toContain("Bora");
    // The joiner learns the host's seed — this is what keeps both players on
    // the same terrain instead of two different courses.
    expect(b.seed).toBe("seed-host:courses");
  });

  it("streams live state frames that survive the client's interpolation buffer", async () => {
    const { a, b, room } = pair();
    a.connect(room, "seed-state", false);
    await until(() => a.state === "lobby", 6000);
    b.connect(room, "seed-state", true);
    await until(() => a.roster().length >= 1);
    await until(() => b.roster().length >= 1);
    // The room relays pilot motion once it is racing (the lobby carries
    // presence only), so both pilots ready up first — exactly what the
    // Ready button does.
    a.sendReady(true);
    b.sendReady(true);
    expect(await until(() => a.state === "racing" && b.state === "racing", 6000)).toBe(true);

    // B flies: these are the frames the other player must render.
    let x = 0;
    const t = setInterval(() => {
      x += 12;
      // Exactly what the game's frame loop does: advance the send clock, then
      // push a throttled state frame.
      b.tick(1 / 15);
      b.send(x, 40 + Math.sin(x / 40) * 5, 0.1, x);
    }, 66);
    try {
      // The interpolation buffer holds 2 samples ~120 ms behind, so give it a
      // couple of ticks before asserting.
      const moved = await until(() => {
        const snap = (a as Client).poll().find((s) => s.id !== a.id);
        return Boolean(snap && Number.isFinite(snap.x) && snap.x > 0);
      }, 3000);
      expect(moved).toBe(true);
      const snap = (a as Client).poll().find((s) => s.id !== a.id)!;
      expect(Number.isFinite(snap.y)).toBe(true);
      expect(Number.isFinite(snap.rotation)).toBe(true);
    } finally {
      clearInterval(t);
    }
  });

  it("seats two matchmaking players (no code, same seed) into the SAME room", async () => {
    const { a, b } = pair();
    // This is the public Quick Match path: no room code, just the seed that
    // encodes format+course. The server groups them; if it ever put them in
    // different rooms, online racing would be an empty room every time.
    const seed = `matchmake-${Date.now().toString(36)}`;
    a.connect("", seed, false);
    await until(() => a.state === "lobby", 6000);
    b.connect("", seed, false);

    expect(await until(() => a.roster().length >= 1 && b.roster().length >= 1, 6000)).toBe(true);
    expect(a.info().code).toBe(b.info().code);
    expect(a.info().code.length).toBeGreaterThan(0);
  });

  it("drops a pilot from the room when they leave", async () => {
    const { a, b, room } = pair();
    a.connect(room, "seed-leave", false);
    await until(() => a.state === "lobby", 6000);
    b.connect(room, "seed-leave", true);
    expect(await until(() => a.roster().length >= 1, 6000)).toBe(true);

    b.disconnect();
    expect(await until(() => a.roster().length === 0, 6000)).toBe(true);
  });

  it("relays emotes between pilots", async () => {
    const { a, b, room } = pair();
    a.connect(room, "seed-emote", false);
    await until(() => a.state === "lobby", 6000);
    b.connect(room, "seed-emote", true);
    await until(() => a.roster().length >= 1);

    b.sendEmote("👋");
    expect(await until(() => a.drainEmotes().some((e) => e.emote === "👋"))).toBe(true);
  });

  it("broadcasts a race start with a countdown both clients agree on", async () => {
    const { a, b, room } = pair();
    a.connect(room, "seed-start", false);
    await until(() => a.state === "lobby", 6000);
    b.connect(room, "seed-start", true);
    await until(() => a.roster().length >= 1 && b.roster().length >= 1);

    a.sendReady(true);
    b.sendReady(true);

    const started = await until(() => a.state === "racing" && b.state === "racing", 6000);
    expect(started).toBe(true);
    expect(await until(() => a.info().startsInMs > 0 || b.info().startsInMs > 0)).toBe(true);
    const events = a.drainEvents().map((e) => e.type);
    expect(events).toContain("start");
  });

  it("reports a finish with a server-assigned place the other pilot sees", async () => {
    const { a, b, room } = pair();
    a.connect(room, "seed-finish", false);
    await until(() => a.state === "lobby", 6000);
    b.connect(room, "seed-finish", true);
    await until(() => a.roster().length >= 1 && b.roster().length >= 1);
    a.sendReady(true);
    b.sendReady(true);
    await until(() => a.state === "racing", 6000);

    b.sendFinish(61.5, 1500);
    const announced = await until(() => a.drainEvents().some((e) => e.type === "finish"));
    expect(announced).toBe(true);
    const peer = a.roster().find((p) => !p.you);
    expect(peer?.finished).toBe(true);
    expect(peer?.place).toBeGreaterThan(0);
  });
});

if (!LIVE) {
  // A skip that says why, so "0 tests ran" is never mistaken for a pass.
  it.skip(`live PvP suite skipped — VITE_MULTIPLAYER_URL must be an absolute ws:// URL (got "${LIVE_URL}"). Run: VITE_MULTIPLAYER_URL=ws://127.0.0.1:8790/mp pnpm test:pvp`, () => {});
}
