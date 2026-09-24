/**
 * Durable offline outbox — "the run finished in a tunnel" is not data loss.
 *
 * Score uploads were fire-and-forget: offline or mid-outage POSTs simply
 * vanished, and the player's best run never reached the global ladder even
 * though the device KNEW about it. The outbox fixes the durability half:
 *
 *   - `enqueue`  persists the payload to storage (best-effort, never throws)
 *                with per-key dedup (a new best for the same key REPLACES the
 *                queued older one — the endpoint keeps the best row anyway).
 *   - `drain`    hands entries to a sender one at a time; success removes,
 *                failure keeps and stops (fail-fast ordering: newest first).
 *   - caps       size (default 24) and age (7 days) so the queue can never
 *                grow unbounded or resurrect week-old garbage onto a board.
 *
 * Storage itself is treated as adversarial: every access is guarded, because
 * this runs exactly when storage is least reliable (private-mode iframes,
 * quota-zero portals). If storage dies the queue degrades to in-memory —
 * same-session retries still work; only cross-session durability is lost,
 * and that is the honest best possible under a broken store.
 */
import { storage } from "../Storage";

export interface OutboxEntry {
  /** Dedup/replace key (e.g. "score:distance"). */
  id: string;
  /** Serialized payload ready to send. */
  payload: string;
  at: number;
  tries: number;
  /** Monotonic enqueue counter — breaks `at` ties so "newest first" stays
   * true even for entries queued within the same millisecond. */
  seq: number;
}

export interface OutboxOptions {
  /** Storage key (namespacing per purpose). */
  storeKey?: string;
  cap?: number;
  ttlMs?: number;
  now?: () => number;
}

export type EnqueueResult = "added" | "replaced" | "dropped-full" | "memory-only";

const DEFAULT_STORE_KEY = "sunbird.outbox.v1";
const DEFAULT_CAP = 24;
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class OfflineOutbox {
  private entries: OutboxEntry[] = [];
  private loaded = false;
  private seq = 0;
  private readonly storeKey: string;
  private readonly cap: number;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(opts: OutboxOptions = {}) {
    this.storeKey = opts.storeKey ?? DEFAULT_STORE_KEY;
    this.cap = Math.max(1, opts.cap ?? DEFAULT_CAP);
    this.ttlMs = Math.max(60_000, opts.ttlMs ?? DEFAULT_TTL_MS);
    this.now = opts.now ?? Date.now;
  }

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = storage.getItem(this.storeKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      this.entries = parsed
        .filter(
          (e): e is OutboxEntry =>
            !!e && typeof e === "object" && typeof (e as OutboxEntry).id === "string" && typeof (e as OutboxEntry).payload === "string",
        )
        .map((e) => ({
          id: e.id,
          payload: e.payload,
          at: Number(e.at) || this.now(),
          tries: Number(e.tries) || 0,
          seq: Number(e.seq) || ++this.seq,
        }));
      // Resume the sequence above anything loaded from storage.
      this.seq = Math.max(this.seq, ...this.entries.map((e) => e.seq), 0);
    } catch {
      this.entries = []; // corrupt queue: better empty than throwing at boot
    }
  }

  private persist(): boolean {
    try {
      storage.setItem(this.storeKey, JSON.stringify(this.entries));
      return true;
    } catch {
      return false; // quota/blocked store — memory copy keeps this session safe
    }
  }

  /** Queue a payload. Newest wins for the same id; cap evicts OLDEST. */
  enqueue(id: string, payload: string): EnqueueResult {
    this.load();
    this.prune();
    const entry: OutboxEntry = { id, payload, at: this.now(), tries: 0, seq: ++this.seq };
    const existing = this.entries.findIndex((e) => e.id === id);
    let result: EnqueueResult;
    if (existing >= 0) {
      this.entries[existing] = entry;
      result = "replaced";
    } else if (this.entries.length >= this.cap) {
      // Drop the oldest — it is the least valuable (superseded) entry.
      this.entries.shift();
      this.entries.push(entry);
      result = "dropped-full";
    } else {
      this.entries.push(entry);
      result = "added";
    }
    return this.persist() ? result : "memory-only";
  }

  get size(): number {
    this.load();
    return this.entries.length;
  }

  /** Drop expired entries; chained calls are cheap. Returns removed count. */
  prune(): number {
    this.load();
    const cutoff = this.now() - this.ttlMs;
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => e.at >= cutoff);
    const removed = before - this.entries.length;
    if (removed > 0) this.persist();
    return removed;
  }

  /**
   * Send entries newest-first via `sender`. `true` = delivered, remove it.
   * Stops at the first failure so ordering and endpoint load stay sane.
   * Each attempted entry's `tries` counter is persisted even on failure, so
   * callers can implement give-up policies (maxTries below).
   */
  async drain(sender: (entry: OutboxEntry) => Promise<boolean>, maxTries = 6): Promise<number> {
    this.load();
    this.prune();
    let sent = 0;
    // Newest first (timestamp, then enqueue sequence): the player cares most
    // about their latest best.
    const ordered = [...this.entries].sort((a, b) => (b.at - a.at) || (b.seq - a.seq));
    for (const entry of ordered) {
      if (entry.tries >= maxTries) continue; // poisoned entry — wait for prune
      let ok = false;
      try {
        ok = await sender(entry);
      } catch {
        ok = false;
      }
      entry.tries += 1;
      if (ok) {
        this.entries = this.entries.filter((e) => e.id !== entry.id);
        sent += 1;
        this.persist();
      } else {
        this.persist(); // persist the bumped tries counter
        break;
      }
    }
    return sent;
  }

  /** Test/ops helper: pending entries, newest first. */
  pending(): readonly OutboxEntry[] {
    this.load();
    return [...this.entries].sort((a, b) => (b.at - a.at) || (b.seq - a.seq));
  }
}
