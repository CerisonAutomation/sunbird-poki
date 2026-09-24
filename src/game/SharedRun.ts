/**
 * Shared runs — asynchronous multiplayer over AUDS share codes.
 *
 * AUDS is Poki's "store any data, get a code back, let players share it"
 * backend, and its documented sweet spot is exactly this: *"Levels,
 * leaderboards, even non-real-time multiplayer."* Sunbird's version is a
 * **run code**: the course seed, the mode and the mark (distance, time,
 * place) of the pilot who flew it. Anyone with the code races the same
 * course against that number, on their own time, with no server of ours in
 * the loop — which is the only kind of multiplayer a Poki build can offer
 * without shipping infrastructure Poki's own platform already provides.
 *
 * Everything here is defensive by default. An AUDS entry is player-authored
 * data arriving from the network, so `unpackShare` validates and clamps every
 * field before the game touches it, and a malformed or hostile payload is
 * rejected rather than rendered.
 *
 * Availability is honest: without a Poki game id (i.e. in every non-Poki
 * build) sharing is simply unavailable, and the UI says so instead of
 * offering a button that cannot work.
 */
import type { PokiAuds } from "../sdk/auds";

/** Key namespace for run shares. Public + listable (top runs of a seed). */
export const SHARE_KEY = "sb:shared:run:v1";

export type SharedRun = {
  /** Payload version — bump when the shape changes. */
  v: 1;
  /** The pilot's own display name as their game knows it (never invented). */
  name: string;
  /** Course + mode seed: the same seed flies the same course. */
  seed: string;
  /** Mode id (see MenuCatalog MODES/PVP_MODES). */
  mode: string;
  /** Their mark, in metres. */
  distance: number;
  /** Their time on the course, in milliseconds. */
  timeMs: number;
  /** Their finishing place when the run was a race, 0 when it was solo. */
  place: number;
  /** Skill/bird id, purely cosmetic for the replay card. */
  bird: string;
};

/** Values must be string | number | boolean (AUDS rule). */
type AudsValues = Record<string, string | number | boolean>;

const NAME_MAX = 14;
const SEED_MAX = 64;
const MODE_MAX = 24;
const BIRD_MAX = 24;
const DISTANCE_MAX = 500_000;
const TIME_MAX = 24 * 60 * 60 * 1000;

function clampInt(value: unknown, max: number, min = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  // Strip control characters: a name is rendered in another player's HUD.
  const stripped = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return stripped.slice(0, max);
}

/**
 * True when this build can publish and read share codes at all: a Poki build
 * with an AUDS game id. Deliberately free of imports — the HUD asks this every
 * frame, and the AUDS module must not enter any other edition's bundle.
 */
export function sharingAvailable(): boolean {
  if (import.meta.env.VITE_PORTAL_TARGET !== "poki") return false;
  const id = import.meta.env.VITE_POKI_GAME_ID as string | undefined;
  return typeof id === "string" && /^[a-z0-9-]+$/i.test(id);
}

/**
 * Resolve the AUDS client lazily.
 *
 * The `import.meta.env` comparison is a compile-time constant: Rollup folds it
 * per target and drops the dynamic import with it, so `auds.poki.io` and the
 * client class only ever exist in the Poki bundle — the same trick that keeps
 * `@poki/netlib` out of the others (Game.makeNet).
 */
async function resolveAuds(): Promise<PokiAuds | null> {
  if (import.meta.env.VITE_PORTAL_TARGET === "poki") {
    const { createAudsIfConfigured } = await import("../sdk/auds");
    return createAudsIfConfigured();
  }
  return null;
}

/** A caller-supplied client (tests) or the lazy build-appropriate one. */
async function clientFor(client?: PokiAuds | null): Promise<PokiAuds | null> {
  return client === undefined ? resolveAuds() : client;
}

/** AUDS `values` for a run — the filterable/sortable part (scalars only). */
export function shareValues(run: SharedRun): AudsValues {
  return {
    name: run.name,
    seed: run.seed,
    mode: run.mode,
    distance: run.distance,
    timeMs: run.timeMs,
    place: run.place,
    bird: run.bird,
    "play-count": 0,
  };
}

/** The full payload. Kept in `data` so freeform fields cost no scalar budget. */
export function packShare(run: SharedRun): { values: AudsValues; data: SharedRun } {
  const safe: SharedRun = {
    v: 1,
    name: cleanText(run.name, NAME_MAX),
    seed: cleanText(run.seed, SEED_MAX),
    mode: cleanText(run.mode, MODE_MAX),
    distance: clampInt(run.distance, DISTANCE_MAX),
    timeMs: clampInt(run.timeMs, TIME_MAX),
    place: clampInt(run.place, 200),
    bird: cleanText(run.bird, BIRD_MAX),
  };
  return { values: shareValues(safe), data: safe };
}

/**
 * Validate an entry that came back from AUDS. Returns null for anything that
 * is not a well-formed run share, so a bad code is a clean "no such run"
 * rather than a broken race.
 */
export function unpackShare(item: unknown): SharedRun | null {
  if (!item || typeof item !== "object") return null;
  const entry = item as { data?: unknown; values?: Record<string, unknown> };
  const raw = (entry.data ?? entry.values) as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== "object") return null;
  if (raw.v !== 1 && entry.data === undefined) {
    // Older entries only carried scalars in `values`; accept that shape too.
    if (typeof raw.seed !== "string") return null;
  }
  const run: SharedRun = {
    v: 1,
    name: cleanText(raw.name, NAME_MAX),
    seed: cleanText(raw.seed, SEED_MAX),
    mode: cleanText(raw.mode, MODE_MAX),
    distance: clampInt(raw.distance, DISTANCE_MAX),
    timeMs: clampInt(raw.timeMs, TIME_MAX),
    place: clampInt(raw.place, 200),
    bird: cleanText(raw.bird, BIRD_MAX),
  };
  // A share with no seed cannot be raced, and one with no distance is not a
  // mark. Reject rather than showing a card full of zeros.
  if (!run.seed || run.distance <= 0) return null;
  return run;
}

/** Publish a run; resolves to the share code (AUDS id) or null on failure. */
export async function shareRun(run: SharedRun, client?: PokiAuds | null): Promise<string | null> {
  const auds = await clientFor(client);
  if (!auds) return null;
  const { values, data } = packShare(run);
  const created = await auds.create(SHARE_KEY, values, data);
  return created?.id ?? null;
}

/** Read a share code back. Returns null for unknown codes or bad payloads. */
export async function loadSharedRun(code: string, client?: PokiAuds | null): Promise<SharedRun | null> {
  const auds = await clientFor(client);
  if (!auds) return null;
  const clean = code.trim().replace(/\s+/g, "");
  if (!/^[a-z0-9]{10,40}$/i.test(clean)) return null;
  const item = await auds.fetchById<SharedRun>(SHARE_KEY, clean);
  if (!item) return null;
  return unpackShare(item);
}

/** Count a play on a share code (public, atomic, no secret). */
export async function countSharePlay(code: string, client?: PokiAuds | null): Promise<number | null> {
  const auds = await clientFor(client);
  if (!auds) return null;
  return auds.increment(SHARE_KEY, code, "play-count");
}

/** Top marks for a seed — the same code family doubles as a mini board. */
export async function topSharedRuns(seed: string, client?: PokiAuds | null, limit = 10): Promise<SharedRun[]> {
  const auds = await clientFor(client);
  if (!auds) return [];
  const list = await auds.list<SharedRun>(SHARE_KEY, { q: `seed:${cleanText(seed, SEED_MAX)}`, sort: "-distance", limit });
  if (!list) return [];
  return list.items.map((item) => unpackShare(item)).filter((run): run is SharedRun => run !== null);
}
