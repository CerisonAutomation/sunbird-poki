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
