/**
 * Poki AUDS (Arbitrary User Data Store) — Poki's free cloud storage service.
 * Used for portal-build global leaderboards, featured ghosts, per-user
 * settings/loadout sync, and future user-generated content.
 *
 * REST reference (https://developers.poki.com/guide/game-dev-tools):
 *   POST   /v0/<game-id>/userdata/<key>           create (returns id+secret)
 *   GET    /v0/<game-id>/userdata/<key>?q=...     list (sort, limit, includedata)
 *   GET    /v0/<game-id>/userdata/<key>/<id>      fetch by id
 *   POST   /v0/<game-id>/userdata/<key>/<id>      update (requires secret)
 *   DELETE /v0/<game-id>/userdata/<key>/<id>      delete (requires secret)
 *   POST   /v0/<game-id>/userdata/<key>/<id>/_increment   atomic counter
 *
 * Entries default to a 1-year TTL (`expires_in`). Public data (scores,
 * published ghosts/UGC) is POSTed without retaining the secret on the
 * client, so records are effectively immutable once published — matching
 * Poki's intent for world-readable leaderboards and shared content.
 *
 * Per-user private data (settings, loadouts, UGC drafts) stores the
 * returned secret in localStorage keyed by AUDS id, so subsequent writes
 * from the same device can update the entry. When the user signs in via
 * Poki User Accounts (PokiSDK.getInstance().user.isSignedIn) the bearer
 * token can be attached for auth-gated writes.
 *
 * AUDS is only enabled when:
 *   (a) running on Poki (`VITE_PORTAL_TARGET === "poki"`), and
 *   (b) a game id is configured via `VITE_POKI_GAME_ID`.
 *
 * Without a configured id all storage falls back to localStorage.
 */

const AUDS_ORIGIN = "https://auds.poki.io";

/* -------------------------------------------------------------------------- */
/*  Wire types                                                                */
/* -------------------------------------------------------------------------- */

type Value = string | number | boolean;

export interface AudsItem<TData = unknown> {
  id: string;
  key: string;
  meta?: {
    revision?: number;
    created_at?: string;
    expires_at?: string;
    expires_in?: number;
  };
  values: Record<string, Value>;
  data: TData | null;
}

interface AudsListResponse<TData = unknown> {
  total: number;
  items: AudsItem<TData>[];
}

export interface AudsCreateResult {
  id: string;
  secret: string;
  key: string;
}

/* -------------------------------------------------------------------------- */
/*  Well-known AUDS keys                                                      */
/* -------------------------------------------------------------------------- */

/** Namespaced key prefixes — keeps listings, TTL sweeps and bulk ops scoped. */
export const AUDSPREFIX = {
  /** Per-metric global leaderboard score (public). */
  score: "sb:score:",
  /** Featured / top ghost for a given metric (public, chosen per season). */
  ghostFeatured: "sb:ghost:feat:",
  /** Public ghost share (any player-published replay, sorted by score). */
  ghostShare: "sb:ghost:share:",
  /** Per-user settings/preferences sync (private, one-per-Poki-user). */
  settings: "sb:settings:v1",
  /** Per-user cosmetic loadout sync (private, one-per-Poki-user). */
  loadout: "sb:loadout:v1",
  /** Per-user progress (coins, unlocks) — private. */
  progress: "sb:progress:v1",
  /** User-generated-course draft (private until published). */
  ugcDraft: "sb:ugc:draft:",
  /** Published UGC listing (public, listable). */
  ugcPublished: "sb:ugc:pub:",
} as const;

/* -------------------------------------------------------------------------- */
/*  Secret storage — private data is bound to the device + Poki user id       */
/* -------------------------------------------------------------------------- */

// poki_ignore prefix ensures these keys are excluded from Poki's automatic
// cloud-save sync (localStorage is auto-synced for logged-in users; internal
// AUDS credentials must not bloat the 1 MB cloud-save payload).
const SECRET_STORAGE_PREFIX = "poki_ignore-auds-secret:";

function readSecret(key: string, userId?: string): string | null {
  try {
    return localStorage.getItem(SECRET_STORAGE_PREFIX + (userId ?? "anon") + ":" + key);
  } catch {
    return null;
  }
}
function writeSecret(key: string, secret: string, userId?: string): void {
  try {
    localStorage.setItem(SECRET_STORAGE_PREFIX + (userId ?? "anon") + ":" + key, secret);
  } catch { /* storage can be disabled — private sync simply degrades */ }
}
function clearSecret(key: string, userId?: string): void {
  try {
    localStorage.removeItem(SECRET_STORAGE_PREFIX + (userId ?? "anon") + ":" + key);
  } catch { /* ignore */ }
}

/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */

export type PokiAudsConfig = {
  gameId: string;
  /** Optional bearer-token resolver for Poki User Accounts (JWT from getToken).
   *  When provided, authenticated writes attach an `Authorization: Bearer …`
   *  header so AUDS ties ownership to the signed-in Poki user. */
  getToken?: () => Promise<string | null> | string | null;
};

export class PokiAuds {
  private readonly gameId: string;
  private readonly getToken?: () => Promise<string | null> | string | null;

  constructor(cfg: PokiAudsConfig) {
    this.gameId = cfg.gameId;
    this.getToken = cfg.getToken;
  }

  /* ----- URL helpers ------------------------------------------------------ */

  private url(key: string, suffix = ""): string {
    return `${AUDS_ORIGIN}/v0/${encodeURIComponent(this.gameId)}/userdata/${encodeURIComponent(key)}${suffix}`;
  }

  private async authHeaders(): Promise<HeadersInit> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.getToken) {
      try {
        const tok = await this.getToken();
        if (tok) headers["authorization"] = `Bearer ${tok}`;
      } catch { /* ignore */ }
    }
    return headers;
  }

  /* ----- Public leaderboards --------------------------------------------- */

  /** Submit a public score entry (immutable after POST — no secret retained). */
  async submitScore(args: {
    metric: "distance" | "altitude" | "perfects" | "coins" | "score";
    name: string;
    deviceId: string;
    value: number;
    skin: string;
    distance: number;
    altitude: number;
    perfects: number;
    coins: number;
    mode: string;
    seed: string;
    date: string;
    build?: string;
  }): Promise<string | null> {
    try {
      const key = AUDSPREFIX.score + args.metric;
      const headers = await this.authHeaders();
      const res = await fetch(this.url(key), {
        method: "POST",
        headers,
        body: JSON.stringify({
          values: {
            name: args.name.slice(0, 14),
            value: args.value,
            distance: args.distance,
            device: args.deviceId.slice(0, 12),
            mode: args.mode,
            date: args.date,
            build: args.build ?? "",
          },
          data: {
            skin: args.skin,
            altitude: args.altitude,
            perfects: args.perfects,
            coins: args.coins,
            seed: args.seed,
          },
          // 1-year TTL — leaderboards naturally roll over with new builds.
          expires_in: 365 * 24 * 60 * 60,
        }),
        keepalive: true,
      });
      if (!res.ok) return null;
      const j = (await res.json()) as { id?: string };
      return typeof j.id === "string" ? j.id : null;
    } catch {
      return null;
    }
  }

  /** Fetch top N + caller's approximate rank for a metric. */
  async fetchTop(args: {
    metric: "distance" | "altitude" | "perfects" | "coins" | "score";
    deviceId: string;
    limit?: number;
  }): Promise<{ entries: (AudsItem & { you?: boolean })[]; yourRank: number; total: number } | null> {
    try {
      const key = AUDSPREFIX.score + args.metric;
      const limit = Math.max(1, Math.min(100, args.limit ?? 50));
      const url = `${this.url(key)}?sort=-value&limit=${limit}&includedata`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const j = (await res.json()) as AudsListResponse;
      const items = j.items ?? [];
      let yourRank = 0;
      const myDevicePrefix = args.deviceId.slice(0, 12);
      const entries = items.map((it, i) => {
        const isYou = String(it.values.device ?? "") === myDevicePrefix;
        if (isYou && yourRank === 0) yourRank = i + 1;
        return { ...it, you: isYou };
      });
      return { entries, yourRank, total: Number(j.total) || items.length };
    } catch {
      return null;
    }
  }

  /* ----- Generic CRUD ----------------------------------------------------- */

  /** Create an entry. Stores the returned secret locally for later updates
   *  when `rememberSecret` is true (private/sync data). */
  async create(
    key: string,
    values: Record<string, Value>,
    data: unknown,
    opts: { expiresIn?: number; rememberSecret?: boolean; userId?: string } = {},
  ): Promise<AudsCreateResult | null> {
    try {
      const headers = await this.authHeaders();
      const body: Record<string, unknown> = { values, data };
      if (opts.expiresIn) body.expires_in = opts.expiresIn;
      const res = await fetch(this.url(key), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      const j = (await res.json()) as { id?: string; secret?: string };
      if (!j.id || !j.secret) return null;
      if (opts.rememberSecret) writeSecret(key + ":" + j.id, j.secret, opts.userId);
      return { id: j.id, secret: j.secret, key };
    } catch {
      return null;
    }
  }

  /** Fetch an entry by id. */
  async fetchById<T = unknown>(key: string, id: string): Promise<AudsItem<T> | null> {
    try {
      const res = await fetch(this.url(key, `/${encodeURIComponent(id)}?includedata`));
      if (!res.ok) return null;
      return (await res.json()) as AudsItem<T>;
    } catch {
      return null;
    }
  }

  /** List entries with sort + filter. */
  async list<T = unknown>(
    key: string,
    opts: { q?: string; sort?: string; limit?: number } = {},
  ): Promise<AudsListResponse<T> | null> {
    try {
      const params = new URLSearchParams();
      if (opts.q) params.set("q", opts.q);
      if (opts.sort) params.set("sort", opts.sort);
      params.set("limit", String(Math.max(1, Math.min(100, opts.limit ?? 20))));
      params.set("includedata", "1");
      const res = await fetch(`${this.url(key)}?${params.toString()}`);
      if (!res.ok) return null;
      return (await res.json()) as AudsListResponse<T>;
    } catch {
      return null;
    }
  }

  /** Update an entry — requires its secret (stored by create()). */
  async update(
    key: string,
    id: string,
    values: Record<string, Value>,
    data: unknown,
    opts: { userId?: string } = {},
  ): Promise<boolean> {
    const secret = readSecret(key + ":" + id, opts.userId);
    if (!secret) return false;
    try {
      const headers = await this.authHeaders();
      const res = await fetch(this.url(key, `/${encodeURIComponent(id)}`), {
        method: "POST",
        headers,
        body: JSON.stringify({ secret, values, data }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Delete an entry — requires its secret. */
  async delete(key: string, id: string, opts: { userId?: string } = {}): Promise<boolean> {
    const secret = readSecret(key + ":" + id, opts.userId);
    if (!secret) return false;
    try {
      const headers = await this.authHeaders();
      const res = await fetch(this.url(key, `/${encodeURIComponent(id)}`), {
        method: "DELETE",
        headers,
        body: JSON.stringify({ secret }),
      });
      if (res.ok) clearSecret(key + ":" + id, opts.userId);
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Atomically bump a public counter on an entry.
   *
   * Docs: `POST /v0/<game-id>/userdata/<key>/<id>/_increment?key=<value-key>`.
   * No secret and no body are required — the endpoint is deliberately public
   * so any player can count a view/play. Constraints enforced by AUDS:
   *   • the value key must contain "count" (e.g. `play-count`);
   *   • the existing value must already be a number;
   *   • the counter increases by exactly 1 and the revision does not change.
   * Returns the new value when the response carries it, else null.
   */
  async increment(key: string, id: string, valueKey: string): Promise<number | null> {
    if (!valueKey.toLowerCase().includes("count")) return null;
    try {
      const res = await fetch(`${this.url(key, `/${encodeURIComponent(id)}/_increment`)}?key=${encodeURIComponent(valueKey)}`, {
        method: "POST",
      });
      if (!res.ok) return null;
      const j = (await res.json().catch(() => null)) as { values?: Record<string, unknown> } | null;
      const value = j?.values?.[valueKey];
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  }

  /** Create-or-update a singleton record (one-per-user: settings, loadout).
   *  If no existing id is provided (or the stored secret is missing), we
   *  create a fresh record and remember the new id+secret. */
  async putSingleton<T extends Record<string, unknown>>(
    key: string,
    values: Record<string, Value>,
    data: T,
    opts: { existingId?: string | null; userId?: string; expiresIn?: number } = {},
  ): Promise<{ id: string; created: boolean } | null> {
    if (opts.existingId) {
      const ok = await this.update(key, opts.existingId, values, data, { userId: opts.userId });
      if (ok) return { id: opts.existingId, created: false };
    }
    const created = await this.create(key, values, data, {
      expiresIn: opts.expiresIn,
      rememberSecret: true,
      userId: opts.userId,
    });
    if (!created) return null;
    // Remember the singleton id for next time.
    try {
      localStorage.setItem("poki_ignore-auds-singleton:" + (opts.userId ?? "anon") + ":" + key, created.id);
    } catch { /* ignore */ }
    return { id: created.id, created: true };
  }

  /** Read the singleton id previously stored by putSingleton. */
  static readSingletonId(key: string, userId?: string): string | null {
    try {
      return localStorage.getItem("poki_ignore-auds-singleton:" + (userId ?? "anon") + ":" + key);
    } catch {
      return null;
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Factory                                                                   */
/* -------------------------------------------------------------------------- */

/** Lazily resolve a Poki JWT from the Poki SDK User Accounts API when present. */
async function pokiBearerToken(): Promise<string | null> {
  try {
    // PokiSDK.getToken() — per docs — returns a 1-minute JWT for the
    // current logged-in user, or null if no user is signed in.
    const sdk = (window as unknown as { PokiSDK?: { getToken?(): Promise<string | null> } }).PokiSDK;
    if (typeof sdk?.getToken === "function") {
      return await sdk.getToken();
    }
  } catch { /* ignore */ }
  return null;
}

/** Resolve an AUDS client only when a Poki game id is configured. */
export function createAudsIfConfigured(): PokiAuds | null {
  try {
    const id = (import.meta.env.VITE_POKI_GAME_ID as string | undefined) ?? "";
    if (!id || typeof id !== "string" || !/^[a-z0-9-]+$/i.test(id)) return null;
    return new PokiAuds({ gameId: id, getToken: pokiBearerToken });
  } catch {
    return null;
  }
}
