/**
 * Shared-run tests — the AUDS "asynchronous multiplayer" feature.
 *
 * Two layers:
 *   1. pure codec (pack/unpack) — clamping, cleaning and rejection rules;
 *   2. network shape — which endpoint each operation hits, with a stubbed
 *      fetch, so the AUDS contract cannot drift unnoticed.
 *
 * Anything a player can type into a share code arrives from the network, so
 * the rejection tests matter as much as the happy paths.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  SHARE_KEY,
  countSharePlay,
  loadSharedRun,
  packShare,
  shareRun,
  topSharedRuns,
  unpackShare,
  type SharedRun,
} from "../SharedRun";
import { PokiAuds } from "../../sdk/auds";

const GAME = "test-game-1234";
const GAME_URL = `https://auds.poki.io/v0/${GAME}/userdata/${encodeURIComponent(SHARE_KEY)}`;

function auds(): PokiAuds {
  return new PokiAuds({ gameId: GAME });
}

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

const RUN: SharedRun = {
  v: 1,
  name: "Wren",
  seed: "2026-09-18:pvp_sprint:emerald",
  mode: "pvp_sprint",
  distance: 1234.4,
  timeMs: 43210,
  place: 3,
  bird: "sunbird",
};

afterEach(() => vi.unstubAllGlobals());

describe("shared runs: codec", () => {
  it("round-trips a run through values + data", () => {
    const { values, data } = packShare(RUN);
    expect(values.seed).toBe(RUN.seed);
    expect(values.distance).toBe(1234); // whole metres, scalar-only values
    expect(values["play-count"]).toBe(0); // counter value must exist to increment
    expect(unpackShare({ values, data })).toMatchObject({ name: "Wren", distance: 1234, place: 3 });
  });

  it("clamps and cleans player-authored fields before anything is stored", () => {
    const { values, data } = packShare({
      ...RUN,
      name: "  \u0000Wr\u001ben the Bold and the Long   ",
      distance: -50,
      timeMs: Number.NaN,
      place: -1,
      bird: "x".repeat(80),
    });
    expect(data.name).toBe("Wren the Bold "); // control chars stripped, then clamped to 14
    expect(values.distance).toBe(0); // negative distance cannot be published as a mark
    expect(values.timeMs).toBe(0);
    expect(values.place).toBe(0);
    expect(data.bird).toHaveLength(24);
  });

  it("rejects entries with no seed or no mark", () => {
    expect(unpackShare({ data: { ...RUN, seed: "" } })).toBeNull();
    expect(unpackShare({ data: { ...RUN, distance: 0 } })).toBeNull();
    expect(unpackShare(null)).toBeNull();
    expect(unpackShare({ data: "nope" })).toBeNull();
    expect(unpackShare({})).toBeNull();
  });

  it("accepts the older scalars-only shape", () => {
    const { values } = packShare(RUN);
    expect(unpackShare({ values })).toMatchObject({ seed: RUN.seed, distance: 1234 });
  });

  it("clamps hostile magnitudes instead of trusting them", () => {
    const run = unpackShare({ data: { ...RUN, distance: 9e12, place: 99999, timeMs: 9e12 } });
    expect(run!.distance).toBe(500_000);
    expect(run!.place).toBe(200);
    expect(run!.timeMs).toBe(24 * 60 * 60 * 1000);
  });
});

describe("shared runs: network shape", () => {
  it("publishes to the share key and returns the code", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ok({ id: "4f2a9c1b8e", secret: "s3cret", key: SHARE_KEY }));
    vi.stubGlobal("fetch", fetchMock);
    const code = await shareRun(RUN, auds());
    expect(code).toBe("4f2a9c1b8e");
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe(GAME_URL);
    expect(init.method).toBe("POST");
  });

  it("loads a code by id and rejects junk codes without a request", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ok({ id: "4f2a9c1b8e", values: {}, data: RUN }));
    vi.stubGlobal("fetch", fetchMock);
    const run = await loadSharedRun(" 4f2a9c1b8e ", auds());
    expect(run).toMatchObject({ name: "Wren", mode: "pvp_sprint" });
    expect(fetchMock.mock.calls[0]![0]).toBe(`${GAME_URL}/4f2a9c1b8e?includedata`);

    fetchMock.mockClear();
    expect(await loadSharedRun("hi", auds())).toBeNull();
    expect(await loadSharedRun("", auds())).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats an unknown code and a broken payload as 'no such run'", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response("missing", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await loadSharedRun("4f2a9c1b8e", auds())).toBeNull();

    fetchMock.mockResolvedValue(ok({ id: "4f2a9c1b8e", data: { v: 1, seed: "" } }));
    expect(await loadSharedRun("4f2a9c1b8e", auds())).toBeNull();
  });

  it("counts a play through the public counter endpoint", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ok({ values: { "play-count": 12 } }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await countSharePlay("4f2a9c1b8e", auds())).toBe(12);
    expect(fetchMock.mock.calls[0]![0]).toBe(`${GAME_URL}/4f2a9c1b8e/_increment?key=play-count`);
  });

  it("lists a seed's marks sorted by distance, best first", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      ok({ total: 2, items: [{ values: {}, data: RUN }, { values: {}, data: { ...RUN, name: "Bex", distance: 900 } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const runs = await topSharedRuns(RUN.seed, auds(), 5);
    expect(runs.map((r) => r.distance)).toEqual([1234, 900]);
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain(`q=seed%3A${encodeURIComponent(RUN.seed)}`);
    expect(url).toContain("sort=-distance");
    expect(url).toContain("limit=5");
  });

  it("is unavailable (returns nothing) when the build has no game id", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await shareRun(RUN, null)).toBeNull();
    expect(await loadSharedRun("4f2a9c1b8e", null)).toBeNull();
    expect(await countSharePlay("4f2a9c1b8e", null)).toBeNull();
    expect(await topSharedRuns(RUN.seed, null)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
