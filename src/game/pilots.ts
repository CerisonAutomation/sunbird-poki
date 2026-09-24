/**
 * PilotBook — the pilots you have ACTUALLY flown with.
 *
 * The squad screen used to show a hard-coded list of invented pilots
 * ("Echo Falcon", "Zephyr Sky", …) and invented club chat, and adding a code
 * offline fabricated a wingman name from the code itself ("Wingman-9F3K").
 * All of that read as fake because it was fake.
 *
 * This module is the honest alternative: it remembers the real pilots that
 * appeared in a real room roster while you were racing, keeps their real name,
 * the room code you shared and the best distance they flew, and never invents
 * anything. It works offline (it is local history) and it is the source the
 * Pilot Lookup panel uses when no network lookup is available.
 */
import type { RoomPeer } from "./Realtime";

/** The slice of a room peer this book needs — keeps it testable without net. */
export type SeenPilot = Pick<RoomPeer, "id" | "name"> & Partial<Pick<RoomPeer, "skin" | "distance" | "place" | "finished">>;

export type FlightMate = {
  id: string;
  name: string;
  skin: string;
  /** Room code where this pilot was last seen flying. */
  roomCode: string;
  /** Epoch ms of the last time they were in a room with you. */
  lastSeenAt: number;
  /** Best distance observed, in metres. 0 when they never posted a frame. */
  bestDistance: number;
  /** Finishing place in the last race you shared, 0 when unknown. */
  placed: number;
};

export const PILOT_BOOK_KEY = "sunbird.pilots.flew_with";
/** Enough history to be useful, small enough for localStorage. */
export const PILOT_BOOK_MAX = 40;

const NAME_MAX = 14;

/**
 * A room roster also carries placeholders: the server names unset pilots
 * "Pilot", and an empty string shows up while a seat is being created. Those
 * are not people, so they must never be recorded as such.
 */
export function isRealPilotName(name: unknown): name is string {
  if (typeof name !== "string") return false;
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > NAME_MAX) return false;
  if (/^pilot$/i.test(trimmed)) return false;
  if (/^(you|me|rival|bot|ai)$/i.test(trimmed)) return false;
  return true;
}

export type PilotBookStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function defaultStorage(): PilotBookStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // private mode / blocked storage: memory-only is fine
  }
}

/** Keeps the newest sighting and the best of what both sightings know. */
function mergeMate(prev: FlightMate, next: FlightMate): FlightMate {
  const latest = next.lastSeenAt >= prev.lastSeenAt ? next : prev;
  const older = latest === next ? prev : next;
  return {
    ...latest,
    bestDistance: Math.max(prev.bestDistance, next.bestDistance),
    placed: latest.placed || older.placed,
  };
}

export class PilotBook {
  private entries: FlightMate[] = [];

  constructor(private readonly storage: PilotBookStorage | null = defaultStorage()) {
    this.load();
  }

  private load(): void {
    if (!this.storage) return;
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(PILOT_BOOK_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      this.entries = parsed.filter(isFlightMate).sort((a, b) => b.lastSeenAt - a.lastSeenAt).slice(0, PILOT_BOOK_MAX);
    } catch {
      /* corrupt history is dropped rather than rendered */
    }
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(PILOT_BOOK_KEY, JSON.stringify(this.entries));
    } catch {
      /* quota/blocked: this session still works from memory */
    }
  }

  /** Everything remembered, newest first. */
  all(): FlightMate[] {
    return this.entries;
  }

  /**
   * Records the roster of the room you are in. Call it whenever the room's
   * peers change — it is cheap and returns false when nothing was learned, so
   * the caller only re-renders on real news.
   */
  remember(peers: readonly SeenPilot[], roomCode: string, now: number): boolean {
    if (!roomCode) return false;
    let changed = false;
    for (const peer of peers) {
      if (!isRealPilotName(peer?.name)) continue;
      const name = peer.name.trim();
      const known = this.entries.find((m) => m.name.toLowerCase() === name.toLowerCase());
      const next: FlightMate = {
        id: typeof peer.id === "string" ? peer.id : known?.id ?? name,
        name,
        skin: typeof peer.skin === "string" && peer.skin ? peer.skin : known?.skin ?? "",
        roomCode,
        lastSeenAt: now,
        bestDistance: Math.max(0, Math.round(Number(peer.distance) || 0), known?.bestDistance ?? 0),
        placed: Math.max(0, Math.round(Number(peer.place) || 0)),
      };
      if (known) {
        const merged = mergeMate(known, next);
        if (JSON.stringify(merged) !== JSON.stringify(known)) changed = true;
        Object.assign(known, merged);
      } else {
        this.entries.push(next);
        changed = true;
      }
    }
    if (changed) {
      this.entries.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
      if (this.entries.length > PILOT_BOOK_MAX) this.entries.length = PILOT_BOOK_MAX;
      this.persist();
    }
    return changed;
  }

  /** Real pilots whose name matches `query` (case-insensitive substring). */
  search(query: string): FlightMate[] {
    return searchPilots(this.entries, query);
  }

  forget(name: string): boolean {
    const before = this.entries.length;
    this.entries = this.entries.filter((m) => m.name.toLowerCase() !== name.trim().toLowerCase());
    if (this.entries.length === before) return false;
    this.persist();
    return true;
  }

  clear(): void {
    this.entries = [];
    this.persist();
  }
}

/** Free function so the search rules are testable without a storage backend. */
export function searchPilots(entries: readonly FlightMate[], query: string): FlightMate[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...entries];
  return entries.filter((m) => m.name.toLowerCase().includes(q));
}

function isFlightMate(value: unknown): value is FlightMate {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === "string" &&
    isRealPilotName(v.name) &&
    typeof v.roomCode === "string" &&
    typeof v.lastSeenAt === "number" &&
    Number.isFinite(v.lastSeenAt)
  );
}

/** Human label for how long ago a pilot was seen — never invented, just clock. */
export function seenAgo(lastSeenAt: number, now: number): string {
  const secs = Math.max(0, Math.round((now - lastSeenAt) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
