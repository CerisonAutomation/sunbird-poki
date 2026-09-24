/**
 * Feature flags — the production kill-switch + rollout layer, dependency-free.
 *
 * Resolution order (highest wins):
 *   1. URL override  `?ff=nativeShare:off,modeAwareChallenge:on`
 *   2. localStorage  `sunbird.flags` (set via `setFlag()` from the console)
 *   3. compiled default
 *
 * Why it exists: shipping a feature "dark" and rolling it out (or killing it)
 * without a redeploy is the difference between a bad deploy and a bad week.
 * The viral challenge-share upgrade below is gated here as the reference
 * implementation — an A/B holdout can flip `challengeShare` off from the URL
 * and every client honors it immediately.
 */
import { storage } from "./Storage";

export type FlagKey =
  | "challengeShare"
  | "nativeShare"
  | "modeAwareChallenge"
  | "adaptiveDifficulty"
  | "clipWorthy"
  | "oneMoreRun";

const DEFAULTS: Record<FlagKey, boolean> = {
  challengeShare: true,
  nativeShare: true,
  modeAwareChallenge: true,
  adaptiveDifficulty: true,
  clipWorthy: true,
  oneMoreRun: true,
};

const LS_KEY = "sunbird.flags";
const FLAG_RE = /^[a-zA-Z][a-zA-Z0-9]*$/;

let urlOverrides: Partial<Record<FlagKey, boolean>> | null = null;
let lsOverrides: Partial<Record<FlagKey, boolean>> | null = null;

function parse(raw: string | null): Partial<Record<FlagKey, boolean>> {
  const out: Partial<Record<FlagKey, boolean>> = {};
  if (!raw) return out;
  for (const part of raw.split(",")) {
    const [k, v] = part.split(":");
    if (!k || !FLAG_RE.test(k)) continue;
    out[k as FlagKey] = v !== "off" && v !== "0" && v !== "false";
  }
  return out;
}

function cachedLs(): Partial<Record<FlagKey, boolean>> {
  if (lsOverrides) return lsOverrides;
  try {
    lsOverrides = parse(storage.getItem(LS_KEY));
  } catch {
    lsOverrides = {};
  }
  return lsOverrides;
}

/** Resolves a flag to on/off, applying URL then localStorage then default. */
export function flag(key: FlagKey): boolean {
  if (urlOverrides === null) {
    try {
      urlOverrides = parse(new URLSearchParams(window.location.search).get("ff"));
    } catch {
      urlOverrides = {};
    }
  }
  return urlOverrides[key] ?? cachedLs()[key] ?? DEFAULTS[key];
}

/** Persists a flag override (dev/ops console): `setFlag("nativeShare", false)`. */
export function setFlag(key: FlagKey, value: boolean): void {
  try {
    const next = { ...cachedLs(), [key]: value };
    const encoded = Object.entries(next)
      .map(([k, v]) => `${k}:${v ? "on" : "off"}`)
      .join(",");
    storage.setItem(LS_KEY, encoded);
    lsOverrides = next;
  } catch {
    /* private mode — the URL override still works */
  }
}
