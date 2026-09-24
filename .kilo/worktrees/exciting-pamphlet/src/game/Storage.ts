/**
 * Cross-safe storage facade — the only way game code touches key-value
 * storage.
 *
 * Why not raw `localStorage`?
 *
 * Poki (and other portals) serve games inside cross-origin iframes. Without
 * `allow-same-origin`, every access to `localStorage` throws SecurityError,
 * and some mobile WebViews partition or quota-zero storage outright. Raw
 * `localStorage` access there means every save silently vanishes on each
 * session (or an unwrapped caller crashes the game).
 *
 * The facade resolves ONE backend in preference order, cached for the
 * lifetime of the page:
 *
 *   1. `localStorage`   — the real thing, whenever the page may own it
 *   2. `sessionStorage` — survives a portal session even when
 *                         `localStorage` throws; data lives until the tab
 *                         closes
 *   3. in-memory `Map`  — last resort when storage is fully disabled; the
 *                         game keeps working for the lifetime of the page
 *
 * Resolution probes each candidate (write + remove a canary key), so a store
 * that exists but refuses writes (quota, sandboxing) is caught too. Callers
 * keep the native `Storage` shape (`getItem` / `setItem` / `length` /
 * `key` / …), so migrating a call site is a one-word change.
 */

export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

const PROBE_KEY = "sunbird.storage.probe";

class MemoryStore implements StorageLike {
  private readonly entries = new Map<string, string>();

  get length(): number {
    return this.entries.size;
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, String(value));
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}

function usable(candidate: StorageLike): boolean {
  try {
    candidate.setItem(PROBE_KEY, "1");
    candidate.removeItem(PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}

let backing: StorageLike | null = null;

function resolve(): StorageLike {
  if (backing) return backing;
  backing = new MemoryStore();
  // In a browser `globalThis.localStorage === window.localStorage` — the
  // duplicates are de-duped below. Listing both keeps test environments
  // (where the two can diverge) and exotic WebViews on a working backend.
  const candidates: StorageLike[] = [];
  const seen = new Set<object>();
  const consider = (candidate: unknown): void => {
    if (typeof candidate !== "object" || candidate === null || seen.has(candidate)) return;
    seen.add(candidate);
    candidates.push(candidate as StorageLike);
  };
  try {
    consider(globalThis.localStorage);
  } catch {
    /* sandboxed cross-origin iframe: the accessor itself throws */
  }
  try {
    consider(window.localStorage);
  } catch {
    /* ditto */
  }
  try {
    consider(globalThis.sessionStorage);
  } catch {
    /* ditto */
  }
  try {
    consider(window.sessionStorage);
  } catch {
    /* ditto */
  }
  for (const candidate of candidates) {
    if (usable(candidate)) {
      backing = candidate;
      return candidate;
    }
  }
  return backing;
}

/**
 * Binds a resolved backend into an object whose methods carry the correct
 * `this` however they are called (the alternative — a forwarding Proxy —
 * breaks brand-checked Web IDL Storage implementations: jsdom throws
 * "setItem called on an object that is not a valid instance of Storage"
 * when the call's `this` is the proxy instead of the real store).
 */
function bindBackend(b: StorageLike): StorageLike {
  return {
    get length(): number {
      return b.length;
    },
    key: (index: number): string | null => b.key(index),
    getItem: (key: string): string | null => b.getItem(key),
    setItem: (key: string, value: string): void => b.setItem(key, value),
    removeItem: (key: string): void => b.removeItem(key),
    clear: (): void => b.clear(),
  };
}

let bound: StorageLike | null = null;
function backend(): StorageLike {
  if (!bound) bound = bindBackend(resolve());
  return bound;
}

/**
 * The resolved storage (see module docs). Resolution is LAZY — first use,
 * not module import — and happens exactly once per page.
 */
export const storage: StorageLike = {
  get length(): number {
    return backend().length;
  },
  key(index: number): string | null {
    return backend().key(index);
  },
  getItem(key: string): string | null {
    return backend().getItem(key);
  },
  setItem(key: string, value: string): void {
    backend().setItem(key, value);
  },
  removeItem(key: string): void {
    backend().removeItem(key);
  },
  clear(): void {
    backend().clear();
  },
};
