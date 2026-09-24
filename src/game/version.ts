/**
 * Every version this build speaks, in one module.
 *
 * The repo has more than one "version" and they answer different questions —
 * which *release* is this, which *save* format, which *wire* protocol, which
 * *replay* payload, which *edition*. They used to live in five unrelated files
 * (and one of them, the build id, was recomputed from `Date.now()` on every
 * build, so the game looked like it changed when nothing had). This module is
 * the single import that answers "which version is running?", and
 * `docs/VERSIONS.md` is the inventory with the bump rules.
 *
 * `src/game/__tests__/version-lockstep.test.ts` fails the build when any two of
 * these disagree with the server's copy of the same number — the realtime
 * gateway *rejects* frames whose protocol version it does not recognise, so a
 * client-only bump there silently breaks every room.
 */

import { SAVE_KEY } from "./constants";
import { PROTOCOL_MIN_VERSION, PROTOCOL_VERSION } from "./protocol/v1";

/** Release semver. Single source of truth: `package.json` (injected by Vite). */
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? "0.0.0";

/** Commit the bundle was cut from; `"dev"` in a source-only checkout. */
export const GIT_SHA: string = import.meta.env.VITE_GIT_SHA ?? "dev";

/** Which edition: `none` (direct/PWA), `poki`, `generic`. */
export const PORTAL_TARGET: string = import.meta.env.VITE_PORTAL_TARGET ?? "none";

/** `<semver>-<portal>-<sha>` — stamped into boot logs and leaderboard rows. */
export const BUILD_ID: string =
  import.meta.env.VITE_BUILD_ID ?? `${APP_VERSION}-${PORTAL_TARGET}-${GIT_SHA}`;

/**
 * Save-format generation, parsed out of the storage key rather than declared
 * twice: `sunbird.save.v2` → `2`. Bumping the schema means bumping the key (old
 * saves stay readable through the v1 migration path, never overwritten).
 */
export const SAVE_SCHEMA: number = Number(/\.v(\d+)$/.exec(SAVE_KEY)?.[1] ?? 0);

/**
 * Replay/ghost payload generation — the `{ v: 2, seed, track, … }` shape the
 * server stamps on publish and *requires* on read (`410` for anything else).
 * The client posts unversioned samples and the server stamps them, so this is
 * the client-side anchor for a contract only one side writes: see the V-4
 * finding in `docs/VERSIONS.md` before changing either number.
 */
export const REPLAY_VERSION = 2;

/** Room wire protocol, re-exported so one import answers the question. */
export { PROTOCOL_MIN_VERSION, PROTOCOL_VERSION };

/** One line for logs and support reports: `sunbird <semver> (<portal>, <sha>)`. */
export function buildStamp(): string {
  return `sunbird ${APP_VERSION} (${PORTAL_TARGET}, ${GIT_SHA})`;
}
