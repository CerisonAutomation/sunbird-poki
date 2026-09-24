/**
 * AUDS client contract tests.
 *
 * The endpoints below are Poki's published AUDS surface (documented at
 * auds.poki.io). These pin the request shapes so a refactor cannot silently
 * drift from the platform API: the URL layout, the query flags, the
 * secret-less public counter, and the failure behaviour (null, never a
 * fabricated value).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { PokiAuds, AUDSPREFIX } from "../auds";

const GAME = "test-game-1234";

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("auds: increment (public counter endpoint)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ok({ values: { "play-count": 7 } }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("POSTs to the /_increment endpoint with the value key in the query", async () => {
    const auds = new PokiAuds({ gameId: GAME });
    const value = await auds.increment("sb:shared:run:v1", "abc123", "play-count");
    expect(value).toBe(7);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe(`https://auds.poki.io/v0/${GAME}/userdata/sb%3Ashared%3Arun%3Av1/abc123/_increment?key=play-count`);
    expect(init.method).toBe("POST");
    // Documented: the counter endpoint is public — no secret, no body.
    expect(init.body).toBeUndefined();
  });

  it("refuses keys that do not contain 'count' (AUDS rejects those)", async () => {
    const auds = new PokiAuds({ gameId: GAME });
    expect(await auds.increment("sb:shared:run:v1", "abc123", "views")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the numeric value only, null for anything else", async () => {
    fetchMock.mockResolvedValueOnce(ok({ values: { "play-count": "7" } }));
    const auds = new PokiAuds({ gameId: GAME });
    expect(await auds.increment("k", "id", "play-count")).toBeNull();
  });

  it("is honest on failure: non-2xx and thrown errors both resolve null", async () => {
    const auds = new PokiAuds({ gameId: GAME });
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 404 }));
    expect(await auds.increment("k", "id", "play-count")).toBeNull();
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await auds.increment("k", "id", "play-count")).toBeNull();
  });
});

describe("auds: create / list / update / delete contract", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ok({ id: "new-id", secret: "s3cret", key: "k" }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("creates under /userdata/<key> and returns the id + one-time secret", async () => {
    const auds = new PokiAuds({ gameId: GAME });
    const created = await auds.create(AUDSPREFIX.ghostShare + "distance", { distance: 12 }, { foo: 1 });
    expect(created).toEqual({ id: "new-id", secret: "s3cret", key: `${AUDSPREFIX.ghostShare}distance` });
    const [url] = fetchMock.mock.calls[0]! as [string];
    expect(url).toBe(`https://auds.poki.io/v0/${GAME}/userdata/sb%3Aghost%3Ashare%3Adistance`);
  });

  it("clamps list limit into the documented 1..100 window and asks for data", async () => {
    fetchMock.mockResolvedValueOnce(ok({ total: 0, items: [] }));
    const auds = new PokiAuds({ gameId: GAME });
    await auds.list("k", { q: "seed:abc", sort: "-distance", limit: 500 });
    const [url] = fetchMock.mock.calls[0]! as [string];
    expect(url).toContain("q=seed%3Aabc");
    expect(url).toContain("sort=-distance");
    expect(url).toContain("limit=100");
    expect(url).toContain("includedata=1");
  });

  it("cannot update or delete without the stored secret", async () => {
    const auds = new PokiAuds({ gameId: GAME });
    expect(await auds.update("k", "id", { a: 1 }, null)).toBe(false);
    expect(await auds.delete("k", "id")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces a malformed create response as null instead of a half-share", async () => {
    fetchMock.mockResolvedValueOnce(ok({ id: "only-id" }));
    const auds = new PokiAuds({ gameId: GAME });
    expect(await auds.create("k", { a: 1 }, null)).toBeNull();
  });
});
