/**
 * Poki Netlib helpers that are safe to import from non-Poki builds.
 *
 * This module deliberately does NOT import @poki/netlib so the
 * ~87 KB WebRTC/signaling bundle can remain code-split behind the
 * dynamic `import("./PokiNetlib")` in Game.makeNet(). The heavy
 * Network class lives in PokiNetlib.ts and is only fetched on
 * Poki builds (controlled by the compile-time PORTAL_TARGET).
 */
// Direct constant comparison — Vite replaces import.meta.env.VITE_PORTAL_TARGET
// with a string literal at build time so Rollup can DCE the whole poki-only
// block away in non-poki builds (no "RTCPeerConnection" string, no game id).
const IS_POKI: boolean = (import.meta.env.VITE_PORTAL_TARGET as string) === "poki";

/**
 * Poki Netlib game id.
 *
 * Poki's Netlib docs require this to be YOUR_POKI_GAME_ID (a valid UUID
 * assigned when you register the game on developers.poki.com) OR a random
 * UUID for development. Once the game is submitted to Poki, replace this
 * with the real game id Poki assigns — Netlib enforces the id and rejects
 * lobbies created with anything else in production. The string below is a
 * random v4 UUID reserved for this repo's dev/preview builds and will work
 * against public Netlib signaling. Per Netlib's basic-usage guide any UUID
 * is accepted during development.
 */
/** Canonical UUID shape — Netlib rejects anything else in production. */
export function isNetlibGameId(value: string | undefined): boolean {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Random v4 UUID reserved for this repo's dev/preview builds. */
const DEV_NETLIB_GAME_ID = "33c4c5a6-ee70-4726-aa1f-ced8a9578254";

/**
 * Submission supplies `VITE_POKI_NETLIB_GAME_ID` (the id Poki issues); a
 * development build falls back to the fixed dev UUID, so everyone testing the
 * same build finds the same lobbies (a fresh random id per session would mean
 * nobody could ever find a lobby another tab created). A malformed value is
 * treated as absent rather than shipped — Netlib rejects bad ids in
 * production, and failing at build time is better than failing in a lobby.
 */
export const POKI_NETLIB_GAME_ID: string = IS_POKI
  ? isNetlibGameId(import.meta.env.VITE_POKI_NETLIB_GAME_ID as string | undefined)
    ? (import.meta.env.VITE_POKI_NETLIB_GAME_ID as string)
    : DEV_NETLIB_GAME_ID
  : "";

/** @deprecated use POKI_NETLIB_GAME_ID */
export const NETLIB_GAME_ID = POKI_NETLIB_GAME_ID;

/**
 * Can we actually offer Poki Netlib multiplayer on this browser?
 * Returns false outright in non-Poki builds (the entire body is DCE'd);
 * on Poki builds, requires WebRTC datachannel support — RTCPeerConnection
 * is the canonical feature probe.
 */
export function isPokiMultiplayerAvailable(): boolean {
  if (!IS_POKI) return false;
  try {
    return typeof RTCPeerConnection !== "undefined" && typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function";
  } catch {
    return false;
  }
}

/** Short, unambiguous room codes — no 0/O or 1/I confusion when read aloud.
 * Uses the same alphabet on both transports so invite codes are interchangeable. */
export function makePokiRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
