import { describe, expect, it, vi } from "vitest";
import {
  LAST_ROOM_KEY,
  RoomWatcher,
  forgetRoom,
  lastRoom,
  normalizeRoomCode,
  normalizeRooms,
  rememberRoom,
  roomLine,
  roomListUrl,
  roomShareText,
  roomSummaryLine,
  sortRooms,
  summarizeRooms,
  type LiveRoom,
} from "../RoomBrowser";

const st = (seed: Record<string, string> = {}) => {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
};

describe("room list normalisation (a hostile relay cannot draw fake rooms)", () => {
  it("keeps usable rows, drops junk, clamps every number", () => {
    const rooms = normalizeRooms([
      null,
      "nope",
      { code: "" },
      { code: "abcde", seated: 900, capacity: 900, host: "Zed", status: "racing" },
      { code: "ZZZZZ", playerCount: -4, maxPlayers: 1 },
      { code: "QQQQQ\u0000", host: "A\u001b[31mB", capacity: 40, seated: 12 },
    ]);
    expect(rooms.map((r) => r.code)).toEqual(["ABCDE", "ZZZZZ", "QQQQQ"]);
    expect(rooms[0]).toMatchObject({ seated: 40, capacity: 40, status: "racing", joinable: false });
    // seat count can never be negative, capacity never below the game minimum
    expect(rooms[1]).toMatchObject({ seated: 0, capacity: 2, status: "lobby", joinable: true });
    // control characters are stripped from display names
    expect(rooms[2]!.host).toBe("AB");
  });

  it("dedupes repeated codes and caps the list", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ code: `A${i.toString(36).toUpperCase().padStart(4, "0")}` }));
    expect(normalizeRooms(many)).toHaveLength(40);
    expect(normalizeRooms([{ code: "ABCDE" }, { code: "abcde" }])).toHaveLength(1);
  });

  it("reads an ISO createdAt as an age, so P2P lobbies show their uptime", () => {
    const created = new Date(Date.now() - 120_000).toISOString();
    const [room] = normalizeRooms([{ code: "ABCDE", createdAt: created }]);
    expect(room!.ageSeconds).toBeGreaterThanOrEqual(119);
    expect(room!.ageSeconds).toBeLessThanOrEqual(121);
  });

  it("treats an explicit joinable flag as the source of truth, bounded by real seats", () => {
    const [ok, full, hidden] = normalizeRooms([
      { code: "ABCDE", joinable: true, status: "racing", seated: 3, capacity: 40 },
      { code: "FGHJK", joinable: true, seated: 40, capacity: 40 },
      { code: "MNPQR", joinable: false, status: "lobby", seated: 0, capacity: 40 },
    ]);
    // Only a lobby takes a newcomer into ITS race — a race in progress is shown
    // (so pilots see activity) but never offered as a seat nobody can use.
    expect(ok!.joinable).toBe(false);
    expect(full!.joinable).toBe(false); // and never a full room
    expect(hidden!.joinable).toBe(false); // nor one the source disabled
  });
});

describe("ordering and summary", () => {
  it("puts joinable lobbies first, then fuller rooms, then lower latency", () => {
    const rooms = normalizeRooms([
      { code: "RACNG", status: "racing", seated: 20, capacity: 40 },
      { code: "EMPTY", status: "lobby", seated: 1, capacity: 40 },
      { code: "FULLR", status: "lobby", seated: 40, capacity: 40 },
      { code: "BUSY1", status: "lobby", seated: 30, capacity: 40, latency: 90 },
      { code: "BUSY2", status: "lobby", seated: 30, capacity: 40, latency: 20 },
    ]);
    // joinable first → lobbies before races in progress → fuller → lower ping
    expect(sortRooms(rooms).map((r) => r.code)).toEqual(["BUSY2", "BUSY1", "EMPTY", "FULLR", "RACNG"]);
  });

  it("only claims what the numbers support", () => {
    const rooms = normalizeRooms([
      { code: "ABCDE", status: "lobby", seated: 4 },
      { code: "FGHJK", status: "racing", seated: 9 },
    ]);
    expect(summarizeRooms(rooms)).toEqual({ joinable: 1, open: 1, racing: 1, seated: 13 });
    const line = roomSummaryLine(summarizeRooms(rooms));
    expect(line).toContain("1 joinable now");
    expect(line).toContain("13 pilots seated");
    expect(roomSummaryLine(summarizeRooms([]))).toBe("No public rooms open right now");
    expect(roomLine(rooms[0]!)).toBe("4/40 · lobby");
  });
});

describe("the relay room endpoint", () => {
  it("resolves against the build's base, relative or absolute", () => {
    expect(roomListUrl("/mp", 40, "https://play.example/game/index.html")).toBe(
      "https://play.example/mp/rooms?limit=40",
    );
    expect(roomListUrl("https://relay.example/mp/", 12, "https://play.example/")).toBe(
      "https://relay.example/mp/rooms?limit=12",
    );
  });

  it("returns nothing rather than fetching a broken URL", () => {
    expect(roomListUrl("", 40, "https://play.example/")).toBe("");
    expect(roomListUrl("   ", 40, "https://play.example/")).toBe("");
    expect(roomListUrl("/mp", 40, "")).toBe("");
  });
});

describe("rejoin memory", () => {
  it("remembers the room code for the rejoin window and then lets it go", () => {
    const s = st();
    rememberRoom("abcde", "seed-1", 1_000, s);
    expect(JSON.parse(s.getItem(LAST_ROOM_KEY) ?? "{}")).toMatchObject({ code: "ABCDE", seed: "seed-1" });
    expect(lastRoom(2_000, 60_000, s)?.code).toBe("ABCDE");
    expect(lastRoom(90_000, 60_000, s)).toBeNull(); // too old to offer
    forgetRoom(s);
    expect(lastRoom(2_000, 60_000, s)).toBeNull();
  });

  it("ignores anything that is not a room code", () => {
    const s = st();
    rememberRoom("", "seed", 1_000, s);
    rememberRoom("<<script>>", "seed", 1_000, s);
    expect(lastRoom(1_500, 60_000, s)).toBeNull();
  });

  it("shares a code a friend can actually type", () => {
    const [room] = normalizeRooms([{ code: "ABCDE", seated: 7, capacity: 40, latency: 41, host: "Nova" }]);
    expect(normalizeRoomCode("abcde")).toBe("ABCDE");
    expect(roomShareText(room!)).toBe("Join me in Sunbird — room ABCDE (7/40 · lobby · 41 ms · Nova)");
  });
});

describe("the polling watcher", () => {
  it("keeps the last good list when a refresh fails, and says so", async () => {
    let fail = false;
    const watcher = new RoomWatcher(async () => {
      if (fail) throw new Error("relay down");
      return normalizeRooms([{ code: "ABCDE", seated: 2 }]);
    });
    await watcher.refresh();
    expect(watcher.snapshot()?.rooms.map((r) => r.code)).toEqual(["ABCDE"]);
    fail = true;
    const after = await watcher.refresh();
    expect(after.rooms).toHaveLength(1); // never blanks a list being read
    expect(after.error).toContain("relay down");
  });

  it("reports each poll to the caller and stops cleanly", async () => {
    vi.useFakeTimers();
    try {
      const seen: number[] = [];
      const fetcher = vi.fn(async (): Promise<LiveRoom[]> => normalizeRooms([{ code: "ABCDE" }]));
      const watcher = new RoomWatcher(fetcher, 1_000, (r) => seen.push(r.rooms.length));
      watcher.start();
      watcher.start(); // idempotent: a render path may call it every frame
      await vi.advanceTimersByTimeAsync(3_200);
      watcher.stop();
      const calls = fetcher.mock.calls.length;
      await vi.advanceTimersByTimeAsync(5_000);
      expect(fetcher.mock.calls.length).toBe(calls); // stopped means stopped
      expect(seen.length).toBeGreaterThanOrEqual(3);
      expect(seen[0]).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
