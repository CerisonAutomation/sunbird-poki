/**
 * Rival challenge links — the zero-server viral loop.
 *
 * A challenge is just `#rival=<seed>.<distance>.<name>` appended to any
 * URL of the game. The recipient flies the SAME seed (same hills, same
 * thermals, same weather) against the sender's posted distance. No backend,
 * no account, no expiry — the world generator IS the referee, because a
 * seed reproduces the exact same course on every device.
 */

export type RivalChallenge = {
  seed: string;
  distance: number;
  name: string;
  /** Optional game mode the challenger flew — the recipient races the same
   *  hills in the same mode, not a default daytrip. */
  mode?: string;
};

const KEY = "rival";
const MODE_KEY = "mode";

/** Consuming the hash is destructive, and React StrictMode double-mounts the
 * Game — the first (throwaway) instance would swallow the link and the real
 * one would see nothing. The parsed challenge lives here for the session. */
let consumed: RivalChallenge | null = null;

/** Parses (and consumes) a challenge from the current URL, if present. */
export function readChallengeFromUrl(): RivalChallenge | null {
  if (consumed) return consumed;
  try {
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const raw = params.get(KEY);
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
    params.delete(KEY);
    params.delete(MODE_KEY);
    const rest = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}${rest ? `#${rest}` : ""}`);
    consumed = { seed, distance, name, mode };
    return consumed;
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
  return `${base}#${KEY}=${payload}${mode ? `&${MODE_KEY}=${encodeURIComponent(mode)}` : ""}`;
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
