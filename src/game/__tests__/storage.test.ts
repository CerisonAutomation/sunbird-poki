import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Re-import the facade so its one-time backend resolution re-runs against
 * whatever storage state the test has staged.
 */
async function freshFacade() {
  vi.resetModules();
  return import("../Storage");
}

/**
 * Makes a storage accessor throw SecurityError — the exact failure mode of
 * `localStorage` inside a sandboxed cross-origin portal iframe (Poki).
 * Returns a restore function.
 */
function blockStorage(name: "localStorage" | "sessionStorage"): () => void {
  const onWindow = Object.getOwnPropertyDescriptor(window, name);
  const onGlobal = Object.getOwnPropertyDescriptor(globalThis, name);
  const broken: PropertyDescriptor = {
    configurable: true,
    get() {
      throw new DOMException("blocked by sandbox", "SecurityError");
    },
  };
  try {
    Object.defineProperty(window, name, broken);
  } catch {
    /* environment keeps the original */
  }
  try {
    Object.defineProperty(globalThis, name, broken);
  } catch {
    /* environment keeps the original */
  }
  return () => {
    try {
      if (onWindow) Object.defineProperty(window, name, onWindow);
      else delete (window as unknown as Record<string, unknown>)[name];
    } catch {
      /* best effort */
    }
    try {
      if (onGlobal) Object.defineProperty(globalThis, name, onGlobal);
      else delete (globalThis as unknown as Record<string, unknown>)[name];
    } catch {
      /* best effort */
    }
  };
}

describe("Storage facade", () => {
  const restores: Array<() => void> = [];

  afterEach(() => {
    while (restores.length) restores.pop()!();
    vi.resetModules();
  });

  it("prefers localStorage when it is usable", async () => {
    const { storage } = await freshFacade();
    storage.setItem("facade.k", "v1");
    expect(storage.getItem("facade.k")).toBe("v1");
    // The value must land in real localStorage — not a shadow store.
    expect(localStorage.getItem("facade.k")).toBe("v1");
    expect(sessionStorage.getItem("facade.k")).toBeNull();
    storage.removeItem("facade.k");
  });

  it("falls back to sessionStorage when localStorage throws (sandboxed iframe)", async () => {
    restores.push(blockStorage("localStorage"));
    const { storage } = await freshFacade();
    storage.setItem("facade.k", "v2");
    expect(storage.getItem("facade.k")).toBe("v2");
    // The session store is the real one — the value is visible outside the
    // facade too, proving we are not in the memory fallback.
    expect(sessionStorage.getItem("facade.k")).toBe("v2");
    storage.removeItem("facade.k");
  });

  it("falls back to in-memory storage when both storages throw", async () => {
    restores.push(blockStorage("localStorage"));
    restores.push(blockStorage("sessionStorage"));
    const { storage } = await freshFacade();
    storage.setItem("facade.k", "v3");
    expect(storage.getItem("facade.k")).toBe("v3");
    expect(storage.length).toBe(1);
    expect(storage.key(0)).toBe("facade.k");
    storage.removeItem("facade.k");
    expect(storage.length).toBe(0);
    expect(storage.getItem("facade.k")).toBeNull();
  });

  it("resolves once and keeps the chosen backend (no re-probing)", async () => {
    const { storage } = await freshFacade();
    const local = localStorage; // capture the object before any blocking
    storage.setItem("facade.a", "1");
    expect(local.getItem("facade.a")).toBe("1");
    restores.push(blockStorage("localStorage"));
    // The already-resolved backend must keep working even after the
    // accessor is blocked — resolution is cached, not re-probed.
    expect(storage.getItem("facade.a")).toBe("1");
    storage.removeItem("facade.a");
  });

  it("exposes the native Storage shape (length/key/clear)", async () => {
    const { storage } = await freshFacade();
    storage.setItem("facade.one", "1");
    storage.setItem("facade.two", "2");
    expect(storage.length).toBeGreaterThanOrEqual(2);
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k) keys.push(k);
    }
    expect(keys).toContain("facade.one");
    expect(keys).toContain("facade.two");
    storage.removeItem("facade.one");
    storage.removeItem("facade.two");
  });
});

/**
 * Cloud-gamesave boundary (docs/poki/15-user-accounts.md, UA-07 … UA-09).
 *
 * Poki syncs `localStorage` to the player's account once they are signed in, and
 * the documented way to keep something out of that sync is the `poki_ignore`
 * prefix. The mapping has to happen at the storage facade, not at each call
 * site, or one forgotten key silently ships a device cache — or, worse, an AUDS
 * secret — to the cloud and eats the 1 MB budget.
 *
 * These assertions run against the real module with the Poki build flag set, so
 * a regression in `physicalKey()`/`LOCAL_ONLY_PREFIXES` fails here rather than in
 * production, where a stale cloud save is very hard to notice.
 */
describe("Poki cloud-gamesave boundary", () => {
  const keys = [
    "sunbird.board.v1",
    "sunbird.ghost.pack",
    "sunbird.journal.v1",
    "sunbird.squad.local_cache",
    "auds-singleton:anon:distance",
    "auds-secret:anon:distance",
    "sunbird.storage.probe",
  ];

  it("prefixes every local-only key with poki_ignore on a Poki build", async () => {
    vi.stubEnv("VITE_PORTAL_TARGET", "poki");
    const { physicalKey } = await freshFacade();
    for (const key of keys) {
      expect(physicalKey(key), `${key} must not sync to the cloud`).toBe(`poki_ignore.${key}`);
    }
    vi.unstubAllEnvs();
  });

  it("leaves player progress keys untouched, so they DO sync", async () => {
    vi.stubEnv("VITE_PORTAL_TARGET", "poki");
    const { physicalKey } = await freshFacade();
    for (const key of ["sunbird.save.v1", "sunbird.pilotname", "sunbird.settings.v1"]) {
      expect(physicalKey(key), `${key} is progress and must follow the player`).toBe(key);
    }
    vi.unstubAllEnvs();
  });

  it("uses the plain key on every non-Poki build", async () => {
    vi.stubEnv("VITE_PORTAL_TARGET", "none");
    const { physicalKey } = await freshFacade();
    for (const key of keys) expect(physicalKey(key)).toBe(key);
    vi.unstubAllEnvs();
  });

  it("removes both spellings, so a legacy key cannot come back", async () => {
    vi.stubEnv("VITE_PORTAL_TARGET", "poki");
    const { storage } = await freshFacade();
    localStorage.setItem("sunbird.board.v1", "legacy");
    localStorage.setItem("poki_ignore.sunbird.board.v1", "migrated");
    storage.setItem("sunbird.board.v1", "fresh");
    storage.removeItem("sunbird.board.v1");
    expect(localStorage.getItem("sunbird.board.v1")).toBeNull();
    expect(localStorage.getItem("poki_ignore.sunbird.board.v1")).toBeNull();
    vi.unstubAllEnvs();
  });
});
