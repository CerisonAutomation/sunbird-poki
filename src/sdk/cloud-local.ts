/**
 * The localStorage cloud-save backend — a neutral module, deliberately not an
 * adapter.
 *
 * `localCloudFallback` used to live inside `local.ts` beside the `LocalAdapter`
 * class, which made the Poki adapter import a *different adapter's module* to
 * reach five one-line storage helpers. That is an inversion, and it is also an
 * import edge that only ever existed to serve a misfiling: the object has no
 * adapter behaviour in it at all — no `PlatformAdapter` member, no portal, no
 * capability to declare. It is the storage implementation behind
 * `PlatformAdapter`'s cloud-save five, used by whichever adapter is live.
 *
 * So it lives here, in a leaf module with one dependency (`../game/Storage`),
 * and both adapters import it. That leaves `platform.ts` composed of two
 * adapters that are themselves leaves — which is what lets Rollup DCE the
 * non-target adapter wholesale instead of having to reason about a cycle.
 */
import { storage, type StorageLike } from "../game/Storage";

const PREFIX = "sunbird.cloud.";

/**
 * Cross-safe storage backend: localStorage → sessionStorage → memory, in
 * that order (see Storage.ts). In a sandboxed portal iframe the raw
 * localStorage accessor throws, so the cloud-save fallback must survive
 * that — previously it silently no-opped there.
 */
function ls(): StorageLike {
  return storage;
}

/** Shared localStorage-backed cloud save (used by both adapters). */
export const localCloudFallback = {
  save(key: string, value: unknown): Promise<void> {
    try {
      ls()?.setItem(`${PREFIX}${key}`, JSON.stringify(value));
    } catch {
      /* quota/privacy mode — degrade silently */
    }
    return Promise.resolve();
  },
  load<T>(key: string): Promise<T | null> {
    try {
      const raw = ls()?.getItem(`${PREFIX}${key}`);
      if (raw === null || raw === undefined) return Promise.resolve(null);
      return Promise.resolve(JSON.parse(raw) as T);
    } catch {
      return Promise.resolve(null);
    }
  },
  remove(key: string): Promise<void> {
    try {
      ls()?.removeItem(`${PREFIX}${key}`);
    } catch {
      /* ignore */
    }
    return Promise.resolve();
  },
  clear(): Promise<void> {
    try {
      const doomed: string[] = [];
      const store = ls();
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && k.startsWith(PREFIX)) doomed.push(k);
      }
      for (const k of doomed) store.removeItem(k);
    } catch {
      /* ignore */
    }
    return Promise.resolve();
  },
  has(key: string): Promise<boolean> {
    try {
      return Promise.resolve(ls()?.getItem(`${PREFIX}${key}`) !== null);
    } catch {
      return Promise.resolve(false);
    }
  },
};