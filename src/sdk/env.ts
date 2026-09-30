/**
 * Every `VITE_POKI_*` build variable, read and validated in exactly one place.
 *
 * This module is a LEAF on purpose: no imports, no SDK reference, no AUDS, no
 * netlib, and nothing that survives to the network. Two modules that must stay
 * importable from any edition — `src/game/PilotDirectory.ts` and
 * `src/game/SharedRun.ts` — read `VITE_POKI_GAME_ID` on hot paths, and both
 * document that they carry no imports so the AUDS client (and `auds.poki.io`
 * with it) never enters a non-Poki bundle. A leaf is the only shape that can
 * be imported by them without breaking that.
 *
 * Every value below is a compile-time constant after Vite's `define` step, so
 * importing this from shared code does not create a runtime edge: the caller
 * still folds to a literal and Rollup still drops the branch.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `VITE_POKI_GAME_ID` was read in three places — `src/sdk/auds.ts`,
 * `src/game/PilotDirectory.ts` and `src/game/SharedRun.ts` — each with its own
 * copy of the same `/^[a-z0-9-]+$/i` check and its own `as string | undefined`
 * cast. Three copies of a validation rule is three places for it to be wrong,
 * and the casts were needed only because these three variables were the ones
 * missing from `src/vite-env.d.ts`, whose own header explains that declaring
 * them is what keeps `as any` (which `verify:prod` refuses) out of shipped
 * client code.
 */

/**
 * Poki's game-id shape: the lowercase-hex-with-dashes form Poki issues, which
 * also covers a random UUID used in local development.
 */
const POKI_ID_RE = /^[a-z0-9-]+$/i;

/**
 * The Poki-issued game id AUDS writes are scoped to, or null when this build
 * has none.
 *
 * Null is the honest answer for every non-Poki build and for a Poki build
 * whose id was misconfigured — and it is what each caller's "is this feature
 * available?" check wants, which is why the three of them stopped asking
 * separately.
 */
export function pokiGameId(): string | null {
  const id = import.meta.env.VITE_POKI_GAME_ID ?? "";
  return id && POKI_ID_RE.test(id) ? id : null;
}

/**
 * The raw `VITE_POKI_NETLIB_GAME_ID`, unvalidated — or "" when unset.
 *
 * Deliberately NOT validated here. Netlib enforces a strict canonical-UUID
 * shape in production, which is a different (and stricter) rule than the
 * game-id check above serves, so applying `POKI_ID_RE` here would quietly
 * loosen it. The strict check lives with its only consumer, `isNetlibGameId`
 * in `PokiMpUtils`, and this is the single place the variable is read.
 *
 * Poki issues the AUDS id and the Netlib id separately, so this is genuinely a
 * different value rather than a second reading of the same one.
 */
export function pokiNetlibGameId(): string {
  return import.meta.env.VITE_POKI_NETLIB_GAME_ID ?? "";
}

/**
 * The Poki leaderboard the run score is submitted to, during the
 * `init({ submitScore })` handshake.
 *
 * The name has to match the board as configured in Poki for Developers, so it
 * is build configuration rather than a constant buried in the adapter: setting
 * `VITE_POKI_LEADERBOARD` re-points a build at a renamed board with no code
 * change. The default stays the board this game has always submitted to.
 */
export const POKI_LEADERBOARD = import.meta.env.VITE_POKI_LEADERBOARD?.trim() || "distance";

/**
 * True on a build that targets the Poki portal.
 *
 * A constant rather than a function, so it folds: a non-Poki bundle loses the
 * branch and everything behind it.
 */
export const POKI_BUILD = import.meta.env.VITE_PORTAL_TARGET === "poki";
