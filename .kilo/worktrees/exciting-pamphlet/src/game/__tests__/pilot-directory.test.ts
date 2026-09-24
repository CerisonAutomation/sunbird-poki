/**
 * Pilot-directory tests (AUDS-backed lookup for the Poki edition).
 *
 * A directory is only as good as what it refuses: codes that are not codes,
 * records whose fields are nonsense, and honest nulls when nobody published a
 * code. All three are pinned here, alongside the request shapes the AUDS API
 * expects, so a "better lookup" can never quietly turn into a fabricated one.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  PILOT_KEY,
  PILOT_CODE_RE,
  directoryAvailable,
  lookupDirectoryPilot,
  normalizeCode,
  pilotValues,
  publishPilot,
  readPilot,
  type DirectoryPilot,
} from "../PilotDirectory";
import { PokiAuds } from "../../sdk/auds";

const GAME = "test-game-1234";
const KEY_URL = `https://auds.poki.io/v0/${GAME}/userdata/${encodeURIComponent(PILOT_KEY)}`;

function auds(): PokiAuds {
  return new PokiAuds({ gameId: GAME });
}
function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}
afterEach(() => vi.unstubAllGlobals());

const PILOT: DirectoryPilot = {
  code: "SUN-9F3K2A",
  name: "Wren",
  bestDistance: 4210,
  skin: "sunbird",
  at: 1_700_000_000_000,
  "lookup-count": 3,
};

describe("pilot directory: codes", () => {
  it("normalises a code and rejects anything that is not one", () => {
    expect(normalizeCode(" sun-9f3k2a ")).toBe("SUN-9F3K2A");
    expect(normalizeCode("SUN-9F3K2A")).toBe("SUN-9F3K2A");
    expect(normalizeCode("SUN-9F3K2")).toBeNull(); // too short
    expect(normalizeCode("SUN-9F3K2AB")).toBeNull(); // too long
    expect(normalizeCode("PILOT-9F3K2A")).toBeNull(); // wrong prefix
    expect(normalizeCode("SUN-9F3K2!")).toBeNull(); // not in the alphabet
    expect(normalizeCode(42)).toBeNull();
    expect(normalizeCode(undefined)).toBeNull();
    expect(PILOT_CODE_RE.test("SUN-9F3K2A")).toBe(true);
  });

  it("reads a stored record into a typed pilot, cleaning hostile fields", () => {
    const pilot = readPilot({ values: {}, data: { ...PILOT, name: "  Wr\u0000en the Bold  ", bestDistance: -5, at: "soon" } });
    expect(pilot).toMatchObject({ code: "SUN-9F3K2A", name: "Wren the Bold", bestDistance: 0, at: 0 });
    expect(readPilot({ data: { ...PILOT, code: "nope" } })).toBeNull();
    expect(readPilot(null)).toBeNull();
    expect(readPilot({ data: "string" })).toBeNull();
  });

  it("clamps absurd marks instead of trusting the network", () => {
    const pilot = readPilot({ data: { ...PILOT, bestDistance: 9e12, "lookup-count": -1 } });
    expect(pilot!.bestDistance).toBe(500_000);
    expect(pilot!["lookup-count"]).toBe(0);
  });

  it("sends scalars only — AUDS rejects nested values", () => {
    const values = pilotValues(PILOT);
    for (const value of Object.values(values)) {
      expect(["string", "number", "boolean"]).toContain(typeof value);
    }
    expect(values.code).toBe("SUN-9F3K2A");
    expect(values["lookup-count"]).toBe(3);
  });

  it("is unavailable outside the platform edition (this suite runs non-Poki)", () => {
    expect(directoryAvailable()).toBe(false);
  });
});

describe("pilot directory: network", () => {
  it("looks a code up with a filtered, limited, data-included query", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      ok({ total: 1, items: [{ id: "entry-1", values: {}, data: PILOT }] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const found = await lookupDirectoryPilot("sun-9f3k2a", auds());
    expect(found).toMatchObject({ code: "SUN-9F3K2A", name: "Wren", bestDistance: 4210 });
    const url = fetchMock.mock.calls[0]![0];
    expect(url).toContain(`q=code%3ASUN-9F3K2A`);
    expect(url).toContain("limit=1");
    expect(url).toContain("includedata");
  });

  it("counts the lookup through the public counter, without blocking the result", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("_increment") ? ok({ values: { "lookup-count": 4 } }) : ok({ total: 1, items: [{ id: "entry-1", values: {}, data: PILOT }] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const found = await lookupDirectoryPilot(PILOT.code, auds());
    expect(found).not.toBeNull();
    const urls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(urls.some((u) => u === `${KEY_URL}/entry-1/_increment?key=lookup-count`)).toBe(true);
  });

  it("returns null for an unknown code and for junk, without a request for junk", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ok({ total: 0, items: [] }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await lookupDirectoryPilot("SUN-9F3K2A", auds())).toBeNull();

    fetchMock.mockClear();
    expect(await lookupDirectoryPilot("not-a-code", auds())).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is honest when the directory itself is missing (no client, no game id)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await lookupDirectoryPilot("SUN-9F3K2A", null)).toBeNull();
    expect(await publishPilot({ code: "SUN-9F3K2A", name: "Wren", bestDistance: 1, skin: "s" }, null)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("publishes one record per code (create first, then update)", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ok({ id: "entry-1", secret: "s3cret", key: PILOT_KEY }));
    vi.stubGlobal("fetch", fetchMock);
    const published = await publishPilot({ code: "sun-9f3k2a", name: "Wren", bestDistance: 4210, skin: "sunbird" }, auds());
    expect(published).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe(KEY_URL);
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body)) as { values: Record<string, unknown>; data: Record<string, unknown> };
    expect(body.values.code).toBe("SUN-9F3K2A");
    expect(body.data.bestDistance).toBe(4210);
    // The record remembers its creator's secret (under the poki_ignore prefix so
    // Poki's automatic cloud-save sync skips these credential keys).
    expect(localStorage.getItem(`poki_ignore-auds-secret:anon:${PILOT_KEY}:entry-1`)).toBe("s3cret");
  });

  it("refuses to publish a record without a valid code", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await publishPilot({ code: "hello", name: "Wren", bestDistance: 1, skin: "s" }, auds())).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
