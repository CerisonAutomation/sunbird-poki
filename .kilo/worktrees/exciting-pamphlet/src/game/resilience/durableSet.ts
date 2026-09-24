/**
 * Quota self-healing storage writes.
 *
 * The old failure mode: `storage.setItem` throws QuotaExceededError mid-save,
 * the caller catches it, and the player keeps playing on a save that stopped
 * persisting — hours of progress silently lost to a full (or partitioned)
 * store. The SaveData observer surfaced the *fact* of the failure but could
 * do nothing about the *cause*.
 *
 * `durableSetItem` fixes the cause with a two-stage defense:
 *
 *   1. EVICT — a priority-ordered set of REGENERABLE keys is cleared
 *      (downloaded ghosts, the crash journal, the local board cache…).
 *      These are caches by contract: losing them costs re-downloads and
 *      re-derivation, never progress. The critical set (the save itself,
 *      payment receipts, the offline outbox, the corrupt-save quarantine)
 *      is never touched.
 *   2. RETRY — the original write goes back in with the freed headroom.
 *
 * If even that fails the store is truly unusable (quota-zero sandbox); the
 * result object says so and the caller keeps its existing degraded-mode path.
 * The pure decision core (`evictionPlan`) is separated for testing.
 */
import { storage } from "../Storage";

/** Tier-0: pure caches — first to die under quota pressure, zero progress loss. */
const CACHE_PREFIXES = ["sunbird.ghost."] as const;
const CACHE_KEYS = [
  "sunbird.crash.journal.v1", // rebuilt from the next session's failures
  "sunbird.board.v1", // device's own board rows — derivable from save highScores
] as const;

/** Tier-1: convenience state — eviction is user-visible but recoverable. */
const CONVENIENCE_KEYS = [
  "sunbird.pilots.flew_with", // re-learned by playing with people
  "sunbird.flags", // experiment assignments — re-rolled safely
] as const;

/**
 * Base protected set: local-only literals that are safe in EVERY edition.
 * Web-only storage (payment receipts, upload outboxes) is NOT listed here —
 * portal bundles must not contain backend-storage markers at all (the portal
 * gate enforces this), and protection belongs to the module that owns the
 * key: callers extend the set via `protectedKeys` with their own constants.
 */
export const BASE_PROTECTED_KEYS: readonly string[] = ["sunbird.pilotname", "sunbird.i18n.locale"];

export interface DurableOptions {
  /** Caller-owned keys the eviction plan must never touch. */
  protectedKeys?: readonly string[];
}

export interface DurableWriteResult {
  ok: boolean;
  /** Keys actually removed to make room (empty when the first write landed). */
  evicted: string[];
  /** True when the write never landed anywhere. */
  degraded: boolean;
}

export const CLEAN_WRITE: DurableWriteResult = { ok: true, evicted: [], degraded: false };

/**
 * Pure: given the key names currently in the store, return the eviction
 * order — caches first, then convenience, protected keys filtered out.
 * (Bytes-saved ordering would need a sync length probe per key; key order is
 * deterministic and good enough — caches are the big blobs in this app.)
 */
export function evictionPlan(present: string[], protectedKeys: readonly string[] = BASE_PROTECTED_KEYS): string[] {
  const plan: string[] = [];
  const deny = new Set(protectedKeys);
  for (const key of present) {
    if (deny.has(key)) continue;
    if (CACHE_PREFIXES.some((p) => key.startsWith(p)) || (CACHE_KEYS as readonly string[]).includes(key)) plan.push(key);
  }
  for (const key of present) {
    if (!plan.includes(key) && (CONVENIENCE_KEYS as readonly string[]).includes(key)) plan.push(key);
  }
  return plan;
}

function presentKeys(): string[] {
  const out: string[] = [];
  try {
    const n = storage.length;
    for (let i = 0; i < n; i++) {
      const k = storage.key(i);
      if (k) out.push(k);
    }
  } catch {
    /* length/key can throw on a dying store — plan will just be empty */
  }
  return out;
}

/**
 * Write through quota pressure. Synchronous (the storage facade is sync by
 * contract); safe to call from any persist path.
 */
export function durableSetItem(key: string, value: string, opts: DurableOptions = {}): DurableWriteResult {
  const protectedKeys = opts.protectedKeys ?? BASE_PROTECTED_KEYS;
  try {
    storage.setItem(key, value);
    return CLEAN_WRITE;
  } catch {
    // Stage 1+2: free regenerable space, retry once.
    const evicted: string[] = [];
    for (const candidate of evictionPlan(presentKeys(), protectedKeys)) {
      if (candidate === key) continue;
      try {
        storage.removeItem(candidate);
        evicted.push(candidate);
        // Probe after each eviction — stop as soon as one write succeeds.
        storage.setItem(key, value);
        return { ok: true, evicted, degraded: false };
      } catch {
        continue; // not enough room yet (or the probe write threw again)
      }
    }
    return { ok: false, evicted, degraded: true };
  }
}
