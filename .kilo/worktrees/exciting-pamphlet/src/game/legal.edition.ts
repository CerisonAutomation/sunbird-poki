/**
 * Legal edition module — the DIRECT / web build (default).
 *
 * One file per distribution target, swapped in by the portal-alias plugin in
 * `vite.config.ts` exactly like `edition.ts` and `Payments.portal.ts`. The rule
 * this exists to enforce: a portal bundle may name only its OWN portal. A
 * shared privacy policy that lists every edition's hosts puts `auds.poki.io`
 * into the CrazyGames build and "CrazyGames" into the Poki build — both are
 * foreign-portal markers that `scripts/verify-portal.mjs` rejects, and both
 * would be *wrong* on the page a player reads: a CrazyGames player has no Poki
 * data store, and a Poki player has no Stripe receipt.
 *
 * `scripts/gen-privacy-page.ts` imports all four editions directly and composes
 * the union, so the hosted public policy stays complete while every bundle
 * stays honest about the edition it actually is.
 */
import type { LegalEdition } from "./legal";

export const LEGAL_EDITION: LegalEdition = {
  id: "web",
  label: "Direct web build",
  multiplayer: {
    body: [
      "On a direct web deployment, multiplayer can be relayed by the developer's own room server, but only when that server has been configured for the deployment you are using. When it is not configured, the game says so plainly and races against computer-controlled pilots instead of pretending other players are present.",
    ],
    rows: [
      [
        "Exchanged with other players",
        "Your pilot name, your bird's appearance, your in-race position and speed, emotes, and whether you are ready or finished",
      ],
      [
        "Developer room server",
        "Only on deployments that configure one. Stores the fields listed under \"Exchanged with other players\" plus scores and ghost flights",
      ],
    ],
  },
  analytics: {
    body: [
      "The game can emit aggregate, anonymous counters — an event name plus a coarse game mode and distance — for service-quality trends.",
      "Where it is enabled, those counters are held in the server's memory only. They are never written to disk, never attributed to a player, and are discarded when the process restarts.",
    ],
  },
  payments: {
    // Honest about what ships, not about what is planned. There is no payment
    // provider in this build at all — the four stub entry points that used to
    // return null here were deleted rather than left as markers — and the economy
    // is coins: no storefront SDK, no card form and no processor origin is ever
    // contacted by this build. Selling paid unlocks is an open action (LEGAL_SECURITY.md L-3),
    // so the policy describes it as a deployment option in the conditional, and
    // the host table below stays empty until code actually loads one.
    body: [
      "This build has no payment processor in it. Unlocks are bought with coins earned by playing: the game loads no storefront SDK, no wallet and no card form, and no card detail is entered anywhere inside it.",
      "Where a deployment chooses to wire its own hosted checkout, card number, expiry and security code are entered on that processor's own page and never reach this game or its servers; the game would store only a local receipt reference so an unlock can be restored on the same device.",
    ],
    rows: [
      ["Purchases in this build", "Coins earned by playing. No storefront SDK, no card entry, no in-game payment processor"],
      ["Receipts", "A local reference per unlock, kept in your own browser storage"],
      ["Seller of record", "The operator of the deployment you are playing on"],
    ],
  },
  retention: {
    body: [
      "Data held by a configured backend is bounded: ghost flights are capped per player, room state is discarded when a room closes, and aggregate counters live only as long as the process does.",
    ],
  },
  /**
   * No fixed external host. This edition talks only to a same-origin base — the
   * deployment's own `api/` functions — or to a leaderboard/room/social server
   * the operator pinned at build time, which that operator's own policy covers.
   * A host belongs in this table when the *client* actually contacts it, which
   * is why the two Stripe origins that used to sit here were removed: nothing in
   * `src/` loads them (`pnpm test` pins the agreement between this table and the
   * deployed CSP in `vercel.json`, so re-enabling a processor forces the
   * disclosure to be updated in the same commit).
   */
  hosts: [],
};
