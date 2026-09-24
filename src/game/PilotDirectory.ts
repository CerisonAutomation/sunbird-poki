/**
 * Pilot directory — real player lookup on the Poki edition.
 *
 * Direct builds look pilots up in the self-hosted social service
 * (`GET /social/players/:code`). A Poki build has no server of ours, and the
 * lookup panel used to answer "this build has no service" for every code —
 * honest, but useless.
 *
 * AUDS is exactly the tool the docs describe for this: *"levels,
 * leaderboards, even non-real-time multiplayer"*, keyed by shareable codes.
 * So the Poki edition publishes one **public pilot record per code** (name,
 * best distance, skin, when it was last seen) and looks codes up in it. The
 * code stays the only way in — there is no name search, no browse, no list of
 * "players near you" — matching the privacy contract the self-hosted service
 * documents.
 *
 * Everything the network returns is validated before it reaches the UI, and
 * every failure mode is explicit: a missing record is `null` ("no pilot with
 * that code"), never an invented pilot.
 */
import type { PokiAuds } from "../sdk/auds";

/** Public, listable key: one record per pilot code. */
export const PILOT_KEY = "sb:pilot:v1";

export type DirectoryPilot = {
  /** `SUN-XXXXXX` — the only lookup key. */
  code: string;
  name: string;
  /** Best distance in metres, 0 when the pilot has not shared a run yet. */
  bestDistance: number;
  /** Skin id, purely cosmetic in a card. */
  skin: string;
  /** Epoch ms of the publish that produced this record. */
  at: number;
  /** How many times the record has been looked up (public counter). */
  "lookup-count": number;
};

const NAME_MAX = 14;
const SKIN_MAX = 24;
const DISTANCE_MAX = 500_000;
export const PILOT_CODE_RE = /^SUN-[A-Z0-9]{6}$/;

/**
 * True when this build can publish/look up pilots: a Poki build with an AUDS
 * game id. Import-free by design — the AUDS client must not enter another
 * edition's bundle (see scripts/verify-isolation.mjs).
 */
export function directoryAvailable(): boolean {
  if (import.meta.env.VITE_PORTAL_TARGET !== "poki") return false;
  const id = import.meta.env.VITE_POKI_GAME_ID as string | undefined;
  return typeof id === "string" && /^[a-z0-9-]+$/i.test(id);
}

/** `sun-9f3k2a` → `SUN-9F3K2A`; anything that is not a code → null. */
export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return PILOT_CODE_RE.test(code) ? code : null;
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

function clampInt(value: unknown, max: number, min = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** AUDS `values` for a pilot record — scalars only, code included for queries. */
export function pilotValues(pilot: DirectoryPilot): Record<string, string | number | boolean> {
  return {
    code: pilot.code,
    name: pilot.name,
    bestDistance: pilot.bestDistance,
    skin: pilot.skin,
    at: pilot.at,
    "lookup-count": pilot["lookup-count"],
  };
}

/** Coerce a stored record into a DirectoryPilot, or null when it is junk. */
export function readPilot(entry: unknown): DirectoryPilot | null {
  if (!entry || typeof entry !== "object") return null;
  const raw = ((entry as { data?: unknown }).data ?? entry) as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") return null;
  const code = normalizeCode(raw.code);
  if (!code) return null;
  return {
    code,
    name: cleanText(raw.name, NAME_MAX),
    bestDistance: clampInt(raw.bestDistance, DISTANCE_MAX),
    skin: cleanText(raw.skin, SKIN_MAX),
    at: clampInt(raw.at, Number.MAX_SAFE_INTEGER),
    "lookup-count": clampInt(raw["lookup-count"], Number.MAX_SAFE_INTEGER),
  };
}

/* ------------------------------------------------------------------ AUDS -- */

async function clientFor(client?: PokiAuds | null): Promise<PokiAuds | null> {
  if (client !== undefined) return client;
  if (import.meta.env.VITE_PORTAL_TARGET === "poki") {
    const { createAudsIfConfigured } = await import("../sdk/auds");
    return createAudsIfConfigured();
  }
  return null;
}

/**
 * Publish (or refresh) this pilot's public record. One record per code:
 * `putSingleton` keeps the write secret on the device, so the second call
 * updates instead of piling up duplicates.
 */
export async function publishPilot(
  pilot: { code: string; name: string; bestDistance: number; skin: string },
  client?: PokiAuds | null,
): Promise<boolean> {
  const code = normalizeCode(pilot.code);
  if (!code) return false;
  const auds = await clientFor(client);
  if (!auds) return false;
  const record: DirectoryPilot = {
    code,
    name: cleanText(pilot.name, NAME_MAX),
    bestDistance: clampInt(pilot.bestDistance, DISTANCE_MAX),
    skin: cleanText(pilot.skin, SKIN_MAX),
    at: Date.now(),
    "lookup-count": 0,
  };
  const saved = await auds.putSingleton(PILOT_KEY, pilotValues(record), record, {
    existingId: await readExistingId(),
  });
  return saved !== null;
}

/**
 * Look one code up. Returns the pilot, or null when nobody published that
 * code — the caller turns null into "no pilot with that code".
 */
export async function lookupDirectoryPilot(code: string, client?: PokiAuds | null): Promise<DirectoryPilot | null> {
  const clean = normalizeCode(code);
  if (!clean) return null;
  const auds = await clientFor(client);
  if (!auds) return null;
  const list = await auds.list<DirectoryPilot>(PILOT_KEY, { q: `code:${clean}`, limit: 1 });
  if (!list || list.total < 1 || list.items.length === 0) return null;
  const entry = list.items[0]!;
  // A lookup counts itself: public counter, no secret, best-effort — the card
  // must never wait on it.
  if (entry.id) void auds.increment(PILOT_KEY, entry.id, "lookup-count");
  return readPilot(entry);
}

/* ------------------------------------------------------------ local memory -- */

/**
 * The AUDS entry id this device created, so a second publish *updates* the
 * pilot's record instead of leaving a trail of duplicates behind the same
 * code. Resolved through the same lazily-imported client (the static lives on
 * the class, and the class must not enter another edition's bundle).
 */
async function readExistingId(): Promise<string | null> {
  if (import.meta.env.VITE_PORTAL_TARGET === "poki") {
    const { PokiAuds } = await import("../sdk/auds");
    return PokiAuds.readSingletonId(PILOT_KEY);
  }
  return null;
}
