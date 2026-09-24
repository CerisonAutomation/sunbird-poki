/**
 * The backend base URL, derived in exactly one place.
 *
 * Three modules used to hand-roll the same expression —
 * `env.VITE_LEADERBOARD_URL ?? (env.DEV ? "/mp" : "")` — and one of them
 * (Leaderboard.ts) had drifted to `env.DEV ? "" : ""`, a ternary with two
 * identical branches that read like a bug and hid the real reason it differs:
 * the endpoints genuinely live at different prefixes.
 *
 *   • `/board`, `/score`  — server ROOT (the LEADERBOARD_API.md surface), and
 *     vite proxies both in dev, so the dev prefix is `""`.
 *   • `/mp/ghost`, `/mp/entitlements` — the `/mp` namespace, proxied in dev, so
 *     the dev prefix is `"/mp"`.
 *
 * In production `VITE_LEADERBOARD_URL` must be the host *including* `/mp`
 * (e.g. `https://sunbird-snowy.vercel.app/mp`): `/mp/board` and `/mp/score`
 * exist as legacy aliases, and the ghost/entitlement routes only exist under
 * `/mp`. An empty base in a shipped build means "no backend" — every caller
 * treats it as a silent offline no-op, which is why this never throws.
 *
 * Namespace versions (root vs `/mp` vs `/mp/v1`) and the migration debt are
 * inventoried in `docs/VERSIONS.md` (finding V-5);
 * `src/game/__tests__/version-lockstep.test.ts` pins this helper as the only
 * place allowed to read `VITE_LEADERBOARD_URL`.
 */

/** Loose env read: `import.meta.env` is Vite-only, and tests run without it. */
const ENV = (import.meta as unknown as { env?: Record<string, string | unknown> }).env ?? {};

/**
 * Resolve the backend base, without a trailing slash.
 * @param devPrefix what to use in `vite dev` when no URL is configured —
 *   `""` for root-level routes, `"/mp"` for the `/mp` namespace.
 */
export function backendBase(devPrefix: "" | "/mp"): string {
  const configured = ENV.VITE_LEADERBOARD_URL;
  const url = typeof configured === "string" && configured ? configured : ENV.DEV ? devPrefix : "";
  return String(url || "").replace(/\/$/, "");
}
