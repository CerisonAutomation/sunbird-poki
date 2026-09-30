/**
 * Poki cloud gamesaves — how a key is kept out of the player's synced save.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `src/game/Storage.ts` hardcoded the `poki_ignore.` prefix and re-derived
 * `VITE_PORTAL_TARGET === "poki"` inline. Both are platform facts, not game
 * facts: the game should say "this key is device-local" and let the platform
 * decide what that means on each host. It also duplicated the build check
 * `sdk/env.ts` already owns.
 *
 * THE RULE
 * --------
 * Poki syncs `localStorage` to the player's account automatically once they are
 * signed in ("cloud gamesaves"), and the documented way to keep something out
 * of that sync is to prefix the key with `poki_ignore`. Two reasons to exclude
 * a key:
 *
 *   • it is a CACHE that belongs to one device (the leaderboard page cache,
 *     recorded ghost flights, squad caches) — syncing it wastes the 1 MB
 *     gamesave budget and can resurrect stale rows on another device; and
 *   • it is per-device state that must never silently follow the player to a
 *     shared computer (AUDS entry secrets, the analytics journal).
 *
 * Growth is why this matters at all: the leaderboard cache alone holds up to
 * 400 rows, and the gamesave limit is 1 MB gzipped — exceeding it makes Poki
 * switch cloud saves off for that player entirely, losing their real progress.
 * Real progress (settings, coins, unlocks, mission state) keeps its plain key
 * and syncs.
 *
 * WHAT IS AND IS NOT DOCUMENTED
 * -----------------------------
 * `poki_ignore` is Poki's documented prefix, but the rest deserves precision:
 * there is no SDK method that reports cloud-sync state, and `src/sdk/poki.ts`
 * records that the only cloud-related string in the shipped core is a read-only
 * URL flag (`cloudsavegames=y`). So this is a naming convention honoured by the
 * portal, not a verified API — which is exactly why it lives in one file with
 * that caveat attached, rather than inlined at a call site where it reads like
 * a guarantee.
 */
import { POKI_BUILD } from "./env";

/** The prefix Poki's cloud sync skips. */
const CLOUD_SAVE_IGNORE_PREFIX = "poki_ignore";

/** True on a build where Poki is syncing `localStorage` to the account. */
export function cloudSaveActive(): boolean {
  return POKI_BUILD;
}

/**
 * A device-local logical key, as the key to actually write.
 *
 * On a non-Poki build this is the identity: no other host syncs
 * `localStorage`, so renaming the key would only orphan existing saves for no
 * benefit.
 */
export function cloudSaveKey(logicalKey: string): string {
  return `${CLOUD_SAVE_IGNORE_PREFIX}.${logicalKey}`;
}
