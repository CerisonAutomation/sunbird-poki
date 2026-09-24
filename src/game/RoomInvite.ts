/**
 * Room invite links — the shareable URL for a private race room.
 *
 * A party invite is just `#room=<CODE>` appended to any game URL. Opening it
 * seats the player straight into that private room (the same 5-letter code the
 * host sees), no account and no backend: the room server matches pilots by
 * code. Mirrors the `#rival=` challenge link so both deep links live in the
 * same hash and never collide.
 */

const KEY = "room";

/** 5 chars from the room-code alphabet (no 0/O or 1/I). Lenient on input. */
const CODE_RE = /^[A-Z0-9]{5}$/;

/** Consumed once for the session — React StrictMode double-mounts the Game and
 * the first throwaway instance must not swallow the link for the real one. */
let consumed: string | null = null;

/** Normalizes user/pasted input to a room code, or "" when invalid. */
export function normalizeRoomCode(raw: string): string {
  let input = (raw ?? "").trim();
  // Pasted invite URLs must not become the bogus code "HTTPS".
  if (input.includes("#") && (/^https?:/i.test(input) || input.startsWith("#"))) {
    try { input = new URLSearchParams(input.slice(input.indexOf("#") + 1)).get(KEY) ?? ""; }
    catch { return ""; }
  } else if (/^https?:/i.test(input)) return "";
  const code = input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  return CODE_RE.test(code) ? code : "";
}

/** Parses (and consumes) a `#room=` invite from the current URL, if present. */
export function readRoomInviteFromUrl(): string | null {
  if (consumed) return consumed;
  try {
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const code = normalizeRoomCode(params.get(KEY) ?? "");
    if (!code) return null;
    // Consume the key so refresh/share of the page doesn't re-trigger it, and
    // keep any sibling params (e.g. a #rival= challenge) intact.
    params.delete(KEY);
    const rest = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}${rest ? `#${rest}` : ""}`);
    consumed = code;
    return code;
  } catch {
    return null;
  }
}

/** Builds the shareable invite URL for a room code. */
export function buildRoomInviteUrl(code: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#${KEY}=${encodeURIComponent(normalizeRoomCode(code) || code.toUpperCase())}`;
}
