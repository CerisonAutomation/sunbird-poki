/**
 * Deep links — every shareable URL the game speaks.
 *
 * Two schemes live in the same URL hash and must never collide:
 *
 * - `#rival=<seed>.<distance>.<name>[&mode=]` — rival challenge links: the
 *   recipient flies the SAME seed (same hills, same thermals, same weather)
 *   against the sender's posted distance. No backend, no account, no expiry —
 *   the world generator IS the referee, because a seed reproduces the exact
 *   same course on every device.
 * - `#room=<CODE>` — private race-room invites: opening one seats the player
 *   straight into that room (the same 5-letter code the host sees), matched
 *   by code on the room server.
 *
 * (Merged from Challenge.ts + RoomInvite.ts, which implemented the same
 * parse-consume-build pattern twice. Private `KEY`/`consumed` names are
 * namespaced per scheme — RIVAL_* vs ROOM_* — so the two cannot collide.)
 */

export type RivalChallenge = {
  seed: string;
  distance: number;
  name: string;
  /** Optional game mode the challenger flew — the recipient races the same
   *  hills in the same mode, not a default daytrip. */
  mode?: string;
};

/* ------------------------------------------------ rival challenges (#rival=) */

const RIVAL_KEY = "rival";
const MODE_KEY = "mode";

/** Consuming the hash is destructive, and React StrictMode double-mounts the
 * Game — the first (throwaway) instance would swallow the link and the real
 * one would see nothing. The parsed challenge lives here for the session. */
let consumedChallenge: RivalChallenge | null = null;

/** Parses (and consumes) a challenge from the current URL, if present. */
export function readChallengeFromUrl(): RivalChallenge | null {
  if (consumedChallenge) return consumedChallenge;
  try {
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const raw = params.get(RIVAL_KEY);
    if (!raw) return null;
    const [seed, dist, ...nameParts] = raw.split(".");
    const distance = Math.floor(Number(dist));
    if (!seed || !/^[a-z0-9-]{1,40}$/i.test(seed)) return null;
    if (!Number.isFinite(distance) || distance <= 0 || distance > 1_000_000) return null;
    const name = decodeURIComponent(nameParts.join(".")).replace(/[^\p{L}\p{N} _.-]/gu, "").slice(0, 14) || "A rival";
    // Optional companion mode, carried as a sibling hash param so old links
    // (three-dot `seed.distance.name`) keep working unchanged.
    const mode = (params.get(MODE_KEY) ?? "").replace(/[^a-z0-9-]/g, "").slice(0, 20) || undefined;
    // Consume the hash so refresh/share of the page doesn't re-trigger it.
    params.delete(RIVAL_KEY);
    params.delete(MODE_KEY);
    const rest = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}${rest ? `#${rest}` : ""}`);
    consumedChallenge = { seed, distance, name, mode };
    return consumedChallenge;
  } catch {
    return null;
  }
}

/** Builds a shareable challenge URL for the given run, optionally pinning the mode.
 *  In production portals, set VITE_SHARE_BASE_URL to the canonical game URL so
 *  shared links go to the real page rather than the localhost dev server. */
export function buildChallengeUrl(seed: string, distance: number, name: string, mode?: string): string {
  const envBase = (import.meta.env.VITE_SHARE_BASE_URL as string | undefined)?.trim();
  const base = envBase ? envBase.replace(/\/$/, "") : `${window.location.origin}${window.location.pathname}`.replace(/\/$/, "");
  const payload = `${seed}.${Math.floor(distance)}.${encodeURIComponent(name)}`;
  return `${base}#${RIVAL_KEY}=${payload}${mode ? `&${MODE_KEY}=${encodeURIComponent(mode)}` : ""}`;
}

const TOKEN_PREFIX = "sb1";

function cleanChallengeName(raw: string): string {
  return raw.replace(/[^\p{L}\p{N} _.-]/gu, "").slice(0, 14) || "A rival";
}

function parseChallengeParts(seed: string, dist: string, nameRaw: string, modeRaw?: string): RivalChallenge | null {
  const distance = Math.floor(Number(dist));
  if (!seed || !/^[a-z0-9-]{1,40}$/i.test(seed)) return null;
  if (!Number.isFinite(distance) || distance <= 0 || distance > 1_000_000) return null;
  const name = cleanChallengeName(nameRaw);
  const mode = (modeRaw ?? "").replace(/[^a-z0-9-]/g, "").slice(0, 20) || undefined;
  return { seed, distance, name, mode };
}

/**
 * Compact offline token for paste / QR / AUDS. Independent of the `#rival=`
 * URL so a messenger that strips hashes still carries the challenge. Format:
 * `sb1:<seed>:<distance>:<name>[:mode]` — old `#rival=` links stay valid.
 */
export function packChallengeToken(challenge: RivalChallenge): string {
  const seed = challenge.seed.replace(/[^a-z0-9-]/gi, "").slice(0, 40);
  const distance = Math.max(1, Math.floor(challenge.distance));
  const name = encodeURIComponent(cleanChallengeName(challenge.name));
  const mode = challenge.mode ? `:${encodeURIComponent(challenge.mode.replace(/[^a-z0-9-]/g, "").slice(0, 20))}` : "";
  return `${TOKEN_PREFIX}:${seed}:${distance}:${name}${mode}`;
}

/** Inverse of `packChallengeToken`. Returns null for anything hostile or old. */
export function unpackChallengeToken(raw: string): RivalChallenge | null {
  const clean = raw.trim().replace(/\s+/g, "");
  const parts = clean.split(":");
  if (parts[0] !== TOKEN_PREFIX || parts.length < 4 || parts.length > 5) return null;
  try {
    const name = decodeURIComponent(parts[3] ?? "");
    const mode = parts[4] ? decodeURIComponent(parts[4]) : undefined;
    return parseChallengeParts(parts[1] ?? "", parts[2] ?? "", name, mode);
  } catch {
    return null;
  }
}

/* ------------------------------------------------- room invites (#room=) */

const ROOM_KEY = "room";

/**
 * Room codes are 4 OR 5 chars from the room-code alphabet (no 0/O or 1/I).
 * Lenient on input, strict on length.
 *
 * This was `^[A-Z0-9]{5}$` — exactly five — and that pinned live PvP shut.
 * The two code sources disagree about length, and only one of them was
 * consulted here:
 *
 *   • `createRoom` asks the signalling service for `codeLength: 5`, and the
 *     service IGNORES that and mints FOUR (`netlib.poki.io` returned "4FN7",
 *     "TWD6" and "C7JH" across real runs).
 *   • `makePokiRoomCode()` — the locally generated code used by every
 *     non-Poki edition — really is five.
 *
 * The host path never runs a code through this function: `createRoom` adopts
 * whatever the service returned, so "Create Private Room" produced a working
 * `TWD6` card. The JOIN path does run it, in `Game`'s `join-room` handler, and
 * rejected that same `TWD6` with "Enter a 5-letter room code". So the host
 * always got a room and the guest could never enter it — the whole join leg of
 * live PvP was dead while every one of the tests that hosted a room stayed
 * green. Accepting both lengths is what makes the two paths agree.
 */
const CODE_RE = /^[A-Z0-9]{4,5}$/;

/** Consumed once for the session — React StrictMode double-mounts the Game and
 * the first throwaway instance must not swallow the link for the real one. */
let consumedRoomCode: string | null = null;

/** Normalizes user/pasted input to a room code, or "" when invalid. */
export function normalizeRoomCode(raw: string): string {
  let input = (raw ?? "").trim();
  // Pasted invite URLs must not become the bogus code "HTTPS".
  if (input.includes("#") && (/^https?:/i.test(input) || input.startsWith("#"))) {
    try { input = new URLSearchParams(input.slice(input.indexOf("#") + 1)).get(ROOM_KEY) ?? ""; }
    catch { return ""; }
  } else if (/^https?:/i.test(input)) return "";
  const code = input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  return CODE_RE.test(code) ? code : "";
}

/** Parses (and consumes) a `#room=` invite from the current URL, if present. */
export function readRoomInviteFromUrl(): string | null {
  if (consumedRoomCode) return consumedRoomCode;
  try {
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const code = normalizeRoomCode(params.get(ROOM_KEY) ?? "");
    if (!code) return null;
    // Consume the key so refresh/share of the page doesn't re-trigger it, and
    // keep any sibling params (e.g. a #rival= challenge) intact.
    params.delete(ROOM_KEY);
    const rest = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}${rest ? `#${rest}` : ""}`);
    consumedRoomCode = code;
    return code;
  } catch {
    return null;
  }
}

/** Builds the shareable invite URL for a room code. */
export function buildRoomInviteUrl(code: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#${ROOM_KEY}=${encodeURIComponent(normalizeRoomCode(code) || code.toUpperCase())}`;
}
