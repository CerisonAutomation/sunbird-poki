import { afterEach, describe, expect, it, vi } from "vitest";
import { crc32, crc32Hex, isSealed, openPayload, sealPayload } from "../resilience/crc";
import { BASE_PROTECTED_KEYS, CLEAN_WRITE, durableSetItem, evictionPlan } from "../resilience/durableSet";

describe("crc32", () => {
  it("matches known vectors", () => {
    expect(crc32("")).toBe(0);
    expect(crc32("a")).toBe(0xe8b7be43);
    expect(crc32("123456789")).toBe(0xcbf43926);
  });
  it("hex form is 8 chars and stable", () => {
    expect(crc32Hex("sunbird")).toBe(crc32Hex("sunbird"));
    expect(crc32Hex("sunbird")).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("seal/open payload", () => {
  it("round-trips", () => {
    const raw = JSON.stringify({ bestDistance: 1234.5, ownedSkins: ["sunbird"] });
    const sealed = sealPayload(raw);
    const opened = openPayload(sealed);
    expect(opened.ok).toBe(true);
    expect(JSON.parse(opened.data)).toEqual(JSON.parse(raw));
  });

  it("detects a truncated/flipped payload as corrupt", () => {
    const sealed = sealPayload(JSON.stringify({ bestDistance: 1234 }));
    // Flip a byte inside the data string.
    const env = JSON.parse(sealed) as { v: number; crc: string; data: string };
    const flipped = JSON.stringify({ ...env, data: env.data.replace("1234", "9234") });
    const opened = openPayload(flipped);
    expect(opened.ok).toBe(false);
    expect(opened.reason).toBe("checksum");
  });

  it("detects a corrupted checksum", () => {
    const sealed = sealPayload(JSON.stringify({ a: 1 }));
    const env = JSON.parse(sealed) as { crc: string };
    env.crc = "00000000";
    expect(openPayload(JSON.stringify(env)).ok).toBe(false);
  });

  it("passes legacy bare JSON through untouched (backward compat)", () => {
    const legacy = "{\"bestDistance\":42,\"old\":\"format\"}";
    const opened = openPayload(legacy);
    expect(opened.ok).toBe(true);
    expect(opened.data).toBe(legacy);
    expect(isSealed(legacy)).toBe(false);
    expect(isSealed(sealPayload(legacy))).toBe(true);
  });

  it("a truncated envelope (unparseable wrapper) is corrupt, not a throw", () => {
    const sealed = sealPayload(JSON.stringify({ a: 1 }));
    expect(openPayload(sealed.slice(0, sealed.length - 3))).toEqual({ ok: false, data: "", reason: "checksum" });
  });
});

describe("evictionPlan", () => {
  it("orders caches before convenience and filters protected keys", () => {
    const plan = evictionPlan(
      [
        "sunbird.pilots.flew_with",
        "sunbird.save.v2", // caller-protected — must never appear
        "sunbird.ghost.seed123",
        "sunbird.board.v1",
        "sunbird.pilotname", // base-protected
        "sunbird.flags",
        "random.other.app.key", // foreign key — not ours to evict
      ],
      ["sunbird.save.v2", "sunbird.save.v1"],
    );
    expect(plan).toEqual(["sunbird.ghost.seed123", "sunbird.board.v1", "sunbird.pilots.flew_with", "sunbird.flags"]);
  });

  it("never plans eviction of the caller's protected keys", () => {
    const plan = evictionPlan([...BASE_PROTECTED_KEYS, "sunbird.save.v2"], [...BASE_PROTECTED_KEYS, "sunbird.save.v2"]);
    expect(plan).toEqual([]);
  });
});

describe("durableSetItem", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("writes straight through when storage is healthy", () => {
    localStorage.setItem("sunbird.ghost.x", "big cache");
    const r = durableSetItem("some.key", "value");
    expect(r).toEqual(CLEAN_WRITE);
    expect(localStorage.getItem("some.key")).toBe("value");
    expect(localStorage.getItem("sunbird.ghost.x")).toBe("big cache"); // untouched
  });

  it("on quota failure, evicts caches and RETRIES the write", () => {
    localStorage.setItem("sunbird.ghost.big", "{\"blob\":1}");
    localStorage.setItem("sunbird.board.v1", "[1,2,3]");
    const real = Storage.prototype.setItem; // capture BEFORE spying
    // Faithful quota simulation: writes to the critical key fail WHILE the
    // big regenerable blobs still occupy the store — evicting them frees
    // real headroom, after which the retry lands.
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, k: string, v: string) {
      const tight =
        k === "critical.key" && (localStorage.getItem("sunbird.ghost.big") !== null || localStorage.getItem("sunbird.board.v1") !== null);
      if (tight) throw new DOMException("QuotaExceededError", "QuotaExceededError");
      real.call(this, k, v);
    });
    const r1 = durableSetItem("critical.key", "payload");
    // Ghosts + board were evicted to make room, write succeeded on retry.
    expect(r1.ok).toBe(true);
    expect(r1.degraded).toBe(false);
    expect(r1.evicted).toContain("sunbird.ghost.big");
    expect(localStorage.getItem("sunbird.ghost.big")).toBeNull();
    expect(localStorage.getItem("critical.key")).toBe("payload");
    vi.restoreAllMocks();
  });

  it("a quota-zero store reports degraded honestly (no silent loss)", () => {
    localStorage.clear();
    const real = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === "critical.key2") throw new DOMException("QuotaExceededError", "QuotaExceededError");
      real.call(this, k, v);
    });
    const r2 = durableSetItem("critical.key2", "payload2");
    expect(r2.ok).toBe(false);
    expect(r2.degraded).toBe(true);
    expect(localStorage.getItem("critical.key2")).toBeNull();
    vi.restoreAllMocks();
  });

  it("a healthy store is left alone — no eviction probes", () => {
    const spy = vi.spyOn(Storage.prototype, "removeItem");
    durableSetItem("easy.key", "v");
    expect(spy).not.toHaveBeenCalled();
  });
});
