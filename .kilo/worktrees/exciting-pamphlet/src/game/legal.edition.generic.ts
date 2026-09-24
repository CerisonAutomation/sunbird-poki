/**
 * Legal edition module — the GENERIC / any-portal build.
 *
 * Swapped in for `legal.edition.ts` by the portal-alias plugin in
 * `vite.config.ts`. This edition is the self-contained HTML5 bundle uploaded to
 * portals with no dedicated integration (GameDistribution, Yandex, itch.io,
 * Newgrounds, GameMonetize, …), so it names no portal at all: no SDK host, no
 * data store, no backend. Isolation rule: neither of the two integrated
 * portals' names appears anywhere in this file, because
 * `scripts/verify-portal.mjs` rejects a generic bundle carrying either.
 */
import type { LegalEdition } from "./legal";

export const LEGAL_EDITION: LegalEdition = {
  id: "generic",
  label: "Standalone HTML5 edition",
  multiplayer: {
    body: [
      "This edition ships with no network services of its own. Races are flown against computer-controlled pilots and against recordings of your own previous flights (ghosts) stored on your device.",
      "If the site hosting this build wires up its own leaderboard or multiplayer service, that service is operated by the host under the host's privacy policy — this build contacts no developer server.",
    ],
    rows: [
      ["Exchanged with other players", "Nothing. There is no networked multiplayer in this edition"],
      ["Ghosts and records", "Stored in your own browser storage, never uploaded"],
      [
        "Pilot names",
        "Generated from a fixed curated word list and rerolled with a dice button. This edition has no free-text name field",
      ],
    ],
  },
  analytics: {
    body: [
      "This edition sends no analytics anywhere. The counters the game keeps for its own tuning stay in memory for the length of the session and are discarded when the page closes.",
      "The site hosting this build may load its own analytics or advertising. That is governed by the host's privacy policy, not this one, and nothing in this build feeds it.",
    ],
  },
  payments: {
    body: [
      "This edition has no payments at all: coins are earned by playing. No storefront, no in-app purchase and no ad-removal offer exists in the build.",
    ],
    rows: [["Purchases", "None"]],
  },
  retention: {
    body: [
      "Nothing leaves your device in this edition, so there is no off-device data to retain or delete. Clearing your browser storage removes the game's local save completely.",
    ],
  },
  hosts: [],
};
