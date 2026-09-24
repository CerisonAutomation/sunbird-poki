/**
 * RoomBrowser — the shared model behind "who is racing right now?".
 *
 * Pure functions + one small polling class. No DOM, no transport imports: the
 * WebSocket relay and the WebRTC P2P client both hand their room lists to
 * `normalizeRooms`, and the menu renders the same card from either. That keeps
 * a single truth table for what a pilot sees before they commit to a race:
 *
 *   • rooms that cannot be joined are still shown, but marked — never silently
 *     dropped, because "there are players but you cannot get in" is exactly the
 *     thing a newcomer needs to know;
 *   • counts are clamped to the capacities the game actually enforces
 *     (2..40 seats), so a hostile or buggy relay cannot draw a 900-seat room;
 *   • nothing is invented. An empty list draws an empty state, not a teaser.
 *
 * It also remembers the room this device was last in, so a crash, a reload or
 * a tab switch can offer "rejoin" instead of losing the pilot's seat silently.
 */

export type RoomStatus = "lobby" | "racing";

export type LiveRoom = {
  code: string;
  /** Leader display name, "" when the host is unknown (never fabricated). */
  host: string;
  /** Connected pilots, including the host. */
  seated: number;
  /** Seat cap for this room, clamped to the game's own limits. */
  capacity: number;
  status: RoomStatus;
  /** False when the room is full or already past its lobby phase. */
  joinable: boolean;
  /** Round-trip latency in ms when the source measured one. */
  latency: number | null;
  /** Course/format seed, so the menu can say what would be flown. */
  seed: string;
  /** Seconds since the room was created, when the source reports it. */
  ageSeconds: number | null;
};

export const MIN_ROOM_SEATS = 2;
export const MAX_ROOM_SEATS = 40;
export const MAX_BROWSE_ROOMS = 40;
/** Menu refresh cadence for the live list (ms). */
export const ROOM_POLL_MS = 6_000;
/** How long a remembered room stays worth offering as "rejoin" (ms). */
export const REJOIN_WINDOW_MS = 5 * 60_000;
export const LAST_ROOM_KEY = "sunbird.rooms.last";

function intIn(value: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.floor(n)));
}

/** Room codes are five unambiguous characters, upper-cased. */
export function normalizeRoomCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  // Strip control characters before validating: a relay that pads or mangles a
  // code must not make a real room invisible in the list.
  const code = raw.replace(/[\u0000-\u001f\u007f]/g, "").trim().toUpperCase();
  return /^[A-Z0-9]{4,8}$/.test(code) ? code : "";
}

function cleanLabel(raw: unknown, max = 14): string {
  if (typeof raw !== "string") return "";
  // Drop ANSI/terminal escapes first, then any remaining control characters:
  // a host name is display-only, and neither markup nor colour codes belong in
  // a menu heading.
  return raw
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

/**
 * Turns whatever a transport handed us into displayable rooms. Entries without
 * a usable code are discarded; everything else is clamped, never trusted.
 */
export function normalizeRooms(input: unknown, fallbackCapacity = MAX_ROOM_SEATS): LiveRoom[] {
  if (!Array.isArray(input)) return [];
  const out: LiveRoom[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const code = normalizeRoomCode(r.code ?? r.room ?? r.id);
    if (!code || seen.has(code)) continue;
    const capacity = intIn(r.capacity ?? r.maxPlayers ?? r.seats, MIN_ROOM_SEATS, MAX_ROOM_SEATS, fallbackCapacity);
    const seated = intIn(r.seated ?? r.playerCount ?? r.count, 0, capacity, 0);
    const status: RoomStatus = r.status === "racing" || r.racing === true ? "racing" : "lobby";
    const latencyRaw = r.latency ?? r.ping;
    const latency = typeof latencyRaw === "number" && Number.isFinite(latencyRaw) && latencyRaw >= 0
      ? Math.min(9_999, Math.round(latencyRaw))
      : null;
    const ageRaw = r.ageSeconds ?? r.age;
    let ageSeconds =
      typeof ageRaw === "number" && Number.isFinite(ageRaw) && ageRaw >= 0
        ? Math.min(86_400, Math.round(ageRaw))
        : null;
    if (ageSeconds === null && typeof r.createdAt === "string") {
      // A transport may report an ISO timestamp instead of an age (the P2P
      // lobby list does). Parsing it beats showing "unknown" for every row.
      const born = Date.parse(r.createdAt);
      if (Number.isFinite(born)) ageSeconds = Math.min(86_400, Math.max(0, Math.round((Date.now() - born) / 1000)));
    }
    // A source may mark a room joinable, but never against the seat maths: a
    // full lobby and a race in progress are both closed to newcomers.
    const hasSeat = seated < capacity;
    const joinable =
      typeof r.joinable === "boolean"
        ? r.joinable && status === "lobby" && hasSeat
        : status === "lobby" && hasSeat;
    seen.add(code);
    out.push({
      code,
      host: cleanLabel(r.host ?? r.leaderName ?? r.name),
      seated,
      capacity,
      status,
      joinable,
      latency,
      seed: cleanLabel(r.seed, 64),
      ageSeconds,
    });
    if (out.length >= MAX_BROWSE_ROOMS) break;
  }
  return out;
}

/**
 * Order for a newcomer: rooms you can actually enter first, lobbies before
 * races in progress, then fuller rooms (a race that starts sooner) and finally
 * the closest server/p2p path.
 */
export function sortRooms(rooms: LiveRoom[]): LiveRoom[] {
  return [...rooms].sort((a, b) => {
    if (a.joinable !== b.joinable) return a.joinable ? -1 : 1;
    if (a.status !== b.status) return a.status === "lobby" ? -1 : 1;
    if (a.seated !== b.seated) return b.seated - a.seated;
    const la = a.latency ?? 9_999;
    const lb = b.latency ?? 9_999;
    if (la !== lb) return la - lb;
    return a.code.localeCompare(b.code);
  });
}

export type RoomSummary = {
  /** Public rooms a pilot can join right now. */
  joinable: number;
  /** Rooms in their lobby phase, joinable or not. */
  open: number;
  /** Rooms with a race already under way. */
  racing: number;
  /** Total pilots sitting in those rooms (host included). */
  seated: number;
};

export function summarizeRooms(rooms: LiveRoom[]): RoomSummary {
  let joinable = 0;
  let open = 0;
  let racing = 0;
  let seated = 0;
  for (const r of rooms) {
    if (r.joinable) joinable += 1;
    if (r.status === "lobby") open += 1;
    else racing += 1;
    seated += r.seated;
  }
  return { joinable, open, racing, seated };
}

/** One-line description used by the menu cards and the share/clipboard text. */
export function roomLine(room: LiveRoom): string {
  const phase = room.status === "racing" ? "racing now" : "lobby";
  const parts = [`${room.seated}/${room.capacity}`, phase];
  if (room.latency !== null) parts.push(`${room.latency} ms`);
  if (room.host) parts.push(room.host);
  return parts.join(" · ");
}

/**
 * Header line for the whole list. Drops any clause it cannot back with data,
 * so an empty field never renders as "0 pilots racing" when nobody is racing.
 */
export function roomSummaryLine(summary: RoomSummary): string {
  if (summary.open === 0 && summary.racing === 0) return "No public rooms open right now";
  const bits: string[] = [];
  if (summary.joinable > 0) bits.push(`${summary.joinable} joinable now`);
  if (summary.open > 0) bits.push(`${summary.open} in lobby`);
  if (summary.racing > 0) bits.push(`${summary.racing} already racing`);
  bits.push(`${summary.seated} pilot${summary.seated === 1 ? "" : "s"} seated`);
  return bits.join(" · ");
}

/**
 * The relay's public room endpoint, resolved against whatever base this build
 * uses (`/mp` behind the dev proxy, or an absolute server origin). Returns ""
 * when there is no base to talk to, so callers do not fetch a broken URL.
 */
export function roomListUrl(base: string, limit = MAX_BROWSE_ROOMS, baseHref?: string): string {
  const trimmed = base.trim();
  if (!trimmed) return "";
  const href = baseHref ?? (typeof location !== "undefined" ? location.href : "");
  if (!href) return "";
  try {
    const url = new URL(trimmed, href);
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/rooms`;
    url.search = `limit=${Math.max(1, Math.min(100, Math.round(limit)))}`;
    return url.toString();
  } catch {
    return "";
  }
}

export function roomShareText(room: LiveRoom): string {
  return `Join me in Sunbird — room ${room.code} (${roomLine(room)})`;
}

/* ------------------------------------------------------------ rejoin memory */

export type RememberedRoom = { code: string; seed: string; at: number };

type BrowserStorage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

function store(): BrowserStorage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

/** Remembers the room this device was in so a reload can offer a way back. */
export function rememberRoom(code: string, seed: string, at = Date.now(), s: BrowserStorage | null = store()): void {
  const clean = normalizeRoomCode(code);
  if (!clean || !s) return;
  try {
    const payload: RememberedRoom = { code: clean, seed: cleanLabel(seed, 64), at };
    s.setItem(LAST_ROOM_KEY, JSON.stringify(payload));
  } catch {
    /* private mode: the rejoin offer is simply skipped */
  }
}

export function forgetRoom(s: BrowserStorage | null = store()): void {
  try {
    s?.removeItem(LAST_ROOM_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * The last room, if it is recent enough to still matter (and not the room the
 * pilot is looking at already).
 */
export function lastRoom(
  now = Date.now(),
  maxAge = REJOIN_WINDOW_MS,
  s: BrowserStorage | null = store(),
): RememberedRoom | null {
  if (!s) return null;
  try {
    const raw = s.getItem(LAST_ROOM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RememberedRoom>;
    const code = normalizeRoomCode(parsed.code);
    const at = typeof parsed.at === "number" && Number.isFinite(parsed.at) ? parsed.at : 0;
    if (!code || at <= 0) return null;
    const age = now - at;
    if (age < 0 || age > maxAge) return null;
    return { code, seed: cleanLabel(parsed.seed, 64), at };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ watcher */

export type RoomFetchResult = { rooms: LiveRoom[]; error: string };

/**
 * Polls a room list while the menu is on screen. Keeps the last good answer
 * when a refresh fails, so a hiccup never blanks a list a pilot is reading —
 * but reports the failure so the UI can show "showing last known rooms".
 */
export class RoomWatcher {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private inFlight = false;
  private result: RoomFetchResult | null = null;

  constructor(
    private readonly fetchRooms: () => Promise<LiveRoom[]>,
    private readonly intervalMs: number = ROOM_POLL_MS,
    private onChange?: (result: RoomFetchResult) => void,
  ) {}

  snapshot(): RoomFetchResult | null {
    return this.result;
  }

  async refresh(): Promise<RoomFetchResult> {
    if (this.inFlight) return this.result ?? { rooms: [], error: "" };
    this.inFlight = true;
    try {
      const rooms = sortRooms(normalizeRooms(await this.fetchRooms()));
      this.result = { rooms, error: "" };
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Room list unavailable";
      this.result = { rooms: this.result?.rooms ?? [], error: message.slice(0, 80) };
    } finally {
      this.inFlight = false;
    }
    this.onChange?.(this.result);
    return this.result;
  }

  /** Start (or keep) polling. Safe to call repeatedly from a render path. */
  start(): void {
    if (this.running) return;
    this.running = true;
    void this.refresh();
    const tick = () => {
      if (!this.running) return;
      this.timer = setTimeout(async () => {
        if (!this.running) return;
        // A hidden tab (or a backgrounded game) must not keep hammering the
        // relay; the next visible refresh catches up immediately.
        if (typeof document === "undefined" || document.visibilityState !== "hidden") {
          await this.refresh();
        }
        tick();
      }, this.intervalMs);
    };
    tick();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
