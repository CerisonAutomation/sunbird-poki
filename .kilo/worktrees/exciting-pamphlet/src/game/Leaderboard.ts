import { backendBase } from "./apiBase";
import { dateSeed, truncate } from "./math";
import { generatePilotName } from "./pilotNameGenerator";
import { storage } from "./Storage";
import { createAudsIfConfigured, type PokiAuds } from "../sdk/auds";
import { breakerKeyFor, fetchJson } from "./resilience/fetchJson";
import { OfflineOutbox } from "./resilience/OfflineOutbox";
import { BUILD_ID } from "./version";

/**
 * Global leaderboard.
 *
 * Three backends (ordered by priority at runtime):
 *
 *  • CUSTOM HTTP — when VITE_LEADERBOARD_URL is set, the client talks to a
 *    traditional GET /board + POST /score backend (self-hosted social
 *    server, Vercel Functions, etc.). This is the dev default.
 *  • POKI AUDS  — on Poki builds with VITE_POKI_GAME_ID, posts scores to
 *    Poki's AUDS (Arbitrary User Data Store) per (metric) key and queries
 *    the public sort=-value list. No secret kept client-side — rows are
 *    effectively immutable once posted, which matches public leaderboards.
 *  • LOCAL      — when no backend is configured we keep a persistent
 *    on-device board (with a friendly benchmark table pre-seeded).
 *
 * The UI always states which backend is live (`BoardPage.online` and the
 * `board-badge` in renderBoard).
 */

// Dev uses the social server root (vite proxies /board & /score to the local
// Node social server). Production portal builds default to "" (offline local
// board) unless VITE_LEADERBOARD_URL or AUDS is configured.
// `/board` and `/score` are server-ROOT routes (and vite proxies both in dev),
// so the dev prefix is "" — not "/mp" like the ghost/entitlement routes. The
// old inline `import.meta.env.DEV ? "" : ""` said the same thing twice and read
// like a typo; apiBase.ts is now the one place that documents the contract.
const API = backendBase("");
const SALT = import.meta.env.VITE_LEADERBOARD_SALT ?? "";
const AUDS: PokiAuds | null =
  (import.meta.env.VITE_PORTAL_TARGET as string | undefined) === "poki"
    ? createAudsIfConfigured()
    : null;

async function signScore(deviceId: string, distance: number, score: number): Promise<string> {
  if (!SALT || !crypto?.subtle) return "";
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SALT), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${deviceId}|${distance}|${score}`));
    return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "";
  }
}
const KEY = "sunbird.board.v1";
const NAME_KEY = "sunbird.pilotname";

export type BoardScope = "global" | "daily" | "week" | "friends";
export type BoardMetric = "distance" | "altitude" | "perfects" | "coins" | "score";

export type BoardEntry = {
  id: string;
  name: string;
  value: number;
  distance: number;
  altitude: number;
  perfects: number;
  coins: number;
  score: number;
  skin: string;
  date: string;
  you: boolean;
};

export type BoardPage = {
  scope: BoardScope;
  metric: BoardMetric;
  entries: BoardEntry[];
  yourRank: number;
  total: number;
  online: boolean;
  stale: boolean;
  error: string;
};

export type ScoreSubmission = {
  deviceId: string;
  name: string;
  skin: string;
  distance: number;
  altitude: number;
  perfects: number;
  coins: number;
  score: number;
  seed: string;
  mode: string;
};

type StoredRow = ScoreSubmission & { date: string };

export function isLeaderboardOnline(): boolean {
  return API.length > 0 || AUDS !== null;
}

/** Stable string identifying which backend is live for UI display. */
export function leaderboardBackend(): "http" | "auds" | "local" {
  if (API.length > 0) return "http";
  if (AUDS) return "auds";
  return "local";
}

export function loadPilotName(_fallbackId: string): string {
  try {
    const v = storage.getItem(NAME_KEY);
    if (v && v.trim()) return truncate(v.trim(), 14);
  } catch {
    /* private mode */
  }
  const auto = generatePilotName();
  try {
    storage.setItem(NAME_KEY, auto);
  } catch {
    /* private mode */
  }
  return auto;
}

export function savePilotName(name: string): string {
  const clean = truncate(name.replace(/[^\p{L}\p{N} _.-]/gu, "").trim(), 14) || "Pilot";
  try {
    storage.setItem(NAME_KEY, clean);
  } catch {
    /* private mode */
  }
  return clean;
}

function metricOf(row: { distance: number; altitude: number; perfects: number; coins: number; score?: number }, m: BoardMetric): number {
  if (m === "altitude") return row.altitude;
  if (m === "perfects") return row.perfects;
  if (m === "coins") return row.coins;
  if (m === "score") return row.score ?? 0;
  return row.distance;
}

const valueForMetric = metricOf;

/** The device's current personal-best for each metric (from the local store),
 *  used to avoid spamming AUDS with runs that didn't beat anything. */
function localBestByDevice(): Map<BoardMetric, number> {
  const out = new Map<BoardMetric, number>();
  for (const r of readLocal()) {
    for (const m of ["distance", "altitude", "perfects", "coins", "score"] as BoardMetric[]) {
      const v = valueForMetric(r, m);
      if (v > (out.get(m) ?? 0)) out.set(m, v);
    }
  }
  return out;
}

/* ----------------------------------------------------------- local store */

function readLocal(): StoredRow[] {
  try {
    const raw = storage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed as StoredRow[];
  } catch {
    return [];
  }
}

function writeLocal(rows: StoredRow[]): void {
  try {
    storage.setItem(KEY, JSON.stringify(rows.slice(0, 400)));
  } catch {
    /* quota */
  }
}

/**
 * Rival pilots for the offline board. These are generated once per device from
 * a fixed table so the local ladder has texture, and every generated row is
 * flagged so the UI can mark it as a practice benchmark rather than a person.
 */
const BENCH_NAMES = [
  "Aria", "Kestrel", "Nomi", "Tavi", "Wren", "Bex", "Juno", "Pike", "Sable", "Fen",
  "Rook", "Vale", "Ivy", "Cass", "Odin", "Lux", "Nyx", "Brann", "Skye", "Ozzy",
];

function benchmarkRows(): StoredRow[] {
  const today = dateSeed();
  return BENCH_NAMES.map((name, i) => {
    // Deterministic spread from 380 m up to ~4.6 km so the ladder has a real curve.
    const t = i / (BENCH_NAMES.length - 1);
    const distance = Math.round(380 + Math.pow(t, 1.7) * 4200);
    return {
      deviceId: `bench-${i}`,
      name: `${name} ⟡`,
      skin: "sunbird",
      distance,
      altitude: Math.round(38 + t * 240),
      perfects: Math.round(1 + t * 22),
      coins: Math.round(8 + t * 120),
      score: Math.round(distance * 1.4),
      seed: today,
      mode: "daytrip",
      date: today,
    };
  });
}

/* ------------------------------------------------------------- service */

export class Leaderboard {
  private cache = new Map<string, BoardPage>();
  private inflight = new Map<string, Promise<BoardPage>>();
  private lastError = "";
  /** Score uploads that failed while offline queue here (deduped per
   * run/metric, capped, 7-day TTL) and drain on the next online moment. */
  private readonly outbox = new OfflineOutbox({ storeKey: "sunbird.outbox.score.v1" });
  private readonly onOnline = () => this.uploadBest();

  constructor(private readonly deviceId: string) {
    if (readLocal().length === 0) writeLocal(benchmarkRows());
    // A run finished offline still belongs on the global board — retry the
    // push the moment connectivity returns.
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.onOnline);
    }
  }

  dispose(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.onOnline);
    }
  }

  /** Cached page for instant paint; `fetch()` refreshes it in the background. */
  peek(scope: BoardScope, metric: BoardMetric): BoardPage | null {
    return this.cache.get(`${scope}:${metric}`) ?? null;
  }

  async fetch(scope: BoardScope, metric: BoardMetric): Promise<BoardPage> {
    const key = `${scope}:${metric}`;
    const running = this.inflight.get(key);
    if (running) return running;

    const task = (async (): Promise<BoardPage> => {
      // Backend 1: custom HTTP (self-hosted / Vercel functions).
      if (API) {
        this.uploadBest();
        try {
          const url = `${API}/board?scope=${scope}&metric=${metric}&device=${encodeURIComponent(this.deviceId)}`;
          const { data } = await fetchJson<{ entries?: unknown; rank?: unknown; total?: unknown }>(url, {
            headers: { accept: "application/json" },
            breaker: breakerKeyFor(url),
          });
          const entries = Array.isArray(data.entries) ? data.entries.map((e) => this.normalize(e, metric)) : [];
          this.lastError = "";
          const page: BoardPage = {
            scope,
            metric,
            entries,
            yourRank: Number(data.rank) || entries.findIndex((e) => e.you) + 1,
            total: Number(data.total) || entries.length,
            online: true,
            stale: false,
            error: "",
          };
          this.cache.set(key, page);
          return page;
        } catch (e) {
          this.lastError = e instanceof Error ? e.message : "network error";
        }
      }
      // Backend 2: Poki AUDS (only on poki builds with game id configured).
      // Friends/daily scopes fall back to local — AUDS keys are flat and we
      // only publish the global all-metric tables there.
      if (AUDS && scope === "global") {
        try {
          const res = await AUDS.fetchTop({ metric, deviceId: this.deviceId, limit: 50 });
          if (res) {
            this.lastError = "";
            const entries: BoardEntry[] = res.entries.map((it) => ({
              id: String(it.values.device ?? it.id),
              name: truncate(String(it.values.name ?? "Pilot"), 14),
              value: Number(it.values.value ?? 0),
              distance: Number(it.values.distance ?? (metric === "distance" ? it.values.value : 0)),
              altitude: Number((it.data as Record<string, unknown> | undefined)?.altitude ?? (metric === "altitude" ? it.values.value : 0)),
              perfects: Number((it.data as Record<string, unknown> | undefined)?.perfects ?? (metric === "perfects" ? it.values.value : 0)),
              coins: Number((it.data as Record<string, unknown> | undefined)?.coins ?? (metric === "coins" ? it.values.value : 0)),
              score: Number((it.data as Record<string, unknown> | undefined)?.score ?? (metric === "score" ? it.values.value : 0)),
              skin: String((it.data as Record<string, unknown> | undefined)?.skin ?? "ember"),
              date: String(it.values.date ?? dateSeed()),
              you: Boolean(it.you),
            }));
            // If we didn't find ourselves in the top 50, fall back to local
            // best for "your rank" — AUDS doesn't return a global rank for
            // a player outside the first page, so we honestly show "—" in
            // that case instead of guessing.
            const page: BoardPage = {
              scope,
              metric,
              entries,
              yourRank: res.yourRank,
              total: res.total,
              online: true,
              stale: false,
              error: "",
            };
            this.cache.set(key, page);
            return page;
          }
        } catch (e) {
          this.lastError = e instanceof Error ? e.message : "auds error";
        }
      }
      // Backend 3: local on-device (offline / fallback).
      const page = this.localPage(scope, metric);
      this.cache.set(key, page);
      return page;
    })();

    this.inflight.set(key, task);
    try {
      return await task;
    } finally {
      this.inflight.delete(key);
    }
  }

  /** Records a finished run. Always stored locally; POSTed when online. */
  submit(sub: ScoreSubmission): void {
    const row: StoredRow = { ...sub, date: dateSeed() };
    const rows = readLocal().filter((r) => r.deviceId !== sub.deviceId || r.date !== row.date);
    rows.push(row);
    rows.sort((a, b) => b.distance - a.distance);
    writeLocal(rows);
    this.cache.clear();

    // Only submit when this run beat the device's existing best for the
    // metric — otherwise we'd spam AUDS / the HTTP backend with a flood of
    // mediocre runs and pollute the public board.
    const metrics: BoardMetric[] = ["distance", "altitude", "perfects", "coins"];
    const bestLocal = localBestByDevice();

    if (API) {
      void signScore(row.deviceId, row.distance, row.score)
        .then(async (sig) => {
          const body = JSON.stringify(sig ? { ...row, sig } : row);
          try {
            // Idempotent by contract: the server keeps the best row per
            // pilot, so a retried POST cannot regress the board.
            await fetchJson(`${API}/score`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body,
              keepalive: true,
              breaker: breakerKeyFor(API),
              idempotent: true,
              attempts: 2,
            });
          } catch {
            // The local row already persisted; queue the upload for the next
            // online moment instead of dropping it.
            this.outbox.enqueue(`score:${row.date}:${row.deviceId}`, body);
          }
        })
        .catch(() => undefined); // signing failed — nothing more to do
    }

    if (AUDS) {
      // Publish each metric the run actually set a new personal best for.
      for (const m of metrics) {
        const v = valueForMetric(row, m);
        const prev = bestLocal.get(m) ?? 0;
        if (v <= prev) continue;
        void AUDS.submitScore({
          metric: m,
          name: row.name,
          deviceId: row.deviceId,
          value: v,
          skin: row.skin,
          distance: row.distance,
          altitude: row.altitude,
          perfects: row.perfects,
          coins: row.coins,
          mode: row.mode,
          seed: row.seed,
          date: row.date,
          // Which build set this score. AUDS always carried the field and the
          // client never filled it, so every row read `build: ""`: once physics
          // or scoring changes, there was no way to tell an old-format score
          // from a new one (or to roll a board over per release). It is a semver
          // + edition + commit sha — no device id, no PII.
          build: BUILD_ID,
        }).catch(() => {
          /* AUDS failure must not surface — local board always works */
        });
      }
    }
  }

  /**
   * Re-push this device's local best run to the server. Idempotent: the server
   * keeps the best row per pilot (by distance), so replaying a stale upload
   * can never regress the board. Fired when connectivity returns and when the
   * board is opened, so a run finished offline still reaches the global ladder.
   */
  private uploadBest(): void {
    // Deliver anything that queued while offline, newest first. Idempotent
    // endpoint, so replays are harmless; a failure keeps the entry queued.
    void this.outbox.drain(async (entry) => {
      try {
        await fetchJson(`${API}/score`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: entry.payload,
          keepalive: true,
          breaker: breakerKeyFor(API),
          idempotent: true,
          attempts: 2,
        });
        return true;
      } catch {
        return false;
      }
    });
    const rows = readLocal().filter((r) => r.deviceId === this.deviceId);
    if (rows.length === 0) return;
    const best = rows.reduce((a, b) => (b.distance > a.distance ? b : a), rows[0]!);
    void signScore(best.deviceId, best.distance, best.score)
      .then(async (sig) => {
        const body = JSON.stringify(sig ? { ...best, sig } : best);
        try {
          await fetchJson(`${API}/score`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
            keepalive: true,
            breaker: breakerKeyFor(API),
            idempotent: true,
            attempts: 2,
          });
        } catch {
          this.outbox.enqueue(`score:best:${best.date}:${best.deviceId}`, body);
        }
      })
      .catch(() => undefined);
  }

  private normalize(raw: unknown, metric: BoardMetric): BoardEntry {
    const r = (raw ?? {}) as Record<string, unknown>;
    const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const base = {
      distance: num(r.distance),
      altitude: num(r.altitude),
      perfects: num(r.perfects),
      coins: num(r.coins),
      score: num(r.score),
    };
    const id = String(r.deviceId ?? r.id ?? "");
    return {
      id,
      name: truncate(String(r.name ?? "Pilot"), 14),
      value: metricOf(base, metric),
      ...base,
      skin: String(r.skin ?? "sunbird"),
      date: String(r.date ?? ""),
      you: id === this.deviceId,
    };
  }

  private localPage(scope: BoardScope, metric: BoardMetric): BoardPage {
    const today = dateSeed();
    let rows = readLocal();
    if (scope === "daily") rows = rows.filter((r) => r.date === today);
    if (scope === "week") {
      // Rolling 7 days ending today — matches the server's window exactly, so
      // the same flights appear on both backends.
      const from = new Date(`${today}T00:00:00Z`);
      from.setUTCDate(from.getUTCDate() - 6);
      const fromStr = from.toISOString().slice(0, 10);
      rows = rows.filter((r) => r.date >= fromStr && r.date <= today);
    }
    if (scope === "friends") rows = rows.filter((r) => r.deviceId === this.deviceId || r.deviceId.startsWith("friend-"));

    // Keep only each pilot's personal best for the selected metric.
    const best = new Map<string, StoredRow>();
    for (const r of rows) {
      const prev = best.get(r.deviceId);
      if (!prev || metricOf(r, metric) > metricOf(prev, metric)) best.set(r.deviceId, r);
    }

    const sorted = [...best.values()].sort((a, b) => metricOf(b, metric) - metricOf(a, metric));
    const entries: BoardEntry[] = sorted.slice(0, 50).map((r) => ({
      id: r.deviceId,
      name: r.name,
      value: metricOf(r, metric),
      distance: r.distance,
      altitude: r.altitude,
      perfects: r.perfects,
      coins: r.coins,
      score: r.score ?? 0,
      skin: r.skin,
      date: r.date,
      you: r.deviceId === this.deviceId,
    }));
    const rank = sorted.findIndex((r) => r.deviceId === this.deviceId) + 1;
    return {
      scope,
      metric,
      entries,
      yourRank: rank,
      total: sorted.length,
      online: false,
      stale: Boolean(API) && this.lastError.length > 0,
      error: API ? this.lastError : "",
    };
  }
}
