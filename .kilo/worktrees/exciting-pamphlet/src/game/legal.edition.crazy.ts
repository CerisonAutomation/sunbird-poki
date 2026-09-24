/**
 * Legal edition module — the CRAZYGAMES build.
 *
 * Swapped in for `legal.edition.ts` by the portal-alias plugin in
 * `vite.config.ts`. Isolation rule: no other portal's name, SDK URL or data
 * store appears in this file — a foreign marker fails `pnpm verify:portals`,
 * and a player on this portal would be reading about infrastructure their
 * build never touches.
 */
import type { LegalEdition } from "./legal";

export const LEGAL_EDITION: LegalEdition = {
  id: "crazy",
  label: "CrazyGames edition",
  multiplayer: {
    body: [
      "On this portal, races against other players run through the portal's own multiplayer services, which the portal operates and the developer does not. Where those services are unavailable, the game says so plainly and races against computer-controlled pilots instead of pretending other players are present.",
      "Races can also be run against a recording of another player's flight (a ghost), shared through a short run code. The recording contains only the flight path — no name you typed, no account, no contact details.",
    ],
    rows: [
      [
        "Exchanged with other players",
        "Your pilot name, your bird's appearance, your in-race position and speed, emotes, and whether you are ready or finished",
      ],
      ["Portal services", "Operated by the portal under its own privacy policy"],
      [
        "Pilot names",
        "Generated from a fixed curated word list and rerolled with a dice button. This edition has no free-text name field, so no player-authored text is ever broadcast to other players",
      ],
    ],
  },
  analytics: {
    body: [
      "Aggregate counters are switched off entirely in this edition: the portal runs its own analytics under its own policy, and the game does not send anything to a developer server.",
      "Portal SDK: the portal loads its own SDK into the page. Anything that SDK measures is governed by the portal's privacy policy, not this one. Sunbird sends it nothing beyond the standard gameplay lifecycle signals the platform requires (loading started, loading finished, gameplay started, gameplay stopped, ad breaks).",
    ],
  },
  payments: {
    body: [
      "This edition has no payments at all: coins are earned by playing, and the portal's own advertising is the only commercial surface. There is no purchase of any kind inside the game, including no ad-removal purchase.",
      "Rewarded videos are optional every time, always shown beside a standard non-ad alternative, and are scheduled entirely by the portal.",
    ],
    rows: [
      ["Purchases", "None. No storefront, no in-app purchase, no ad-removal offer"],
      ["Advertising", "Handled by the portal's own SDK under the portal's policy"],
    ],
  },
  retention: {
    body: [
      "Anything processed by the portal's services is retained under the portal's own policy. The game itself keeps nothing off-device in this edition.",
    ],
  },
  hosts: [
    {
      host: "sdk.crazygames.com",
      purpose: "Portal SDK script (ads, lifecycle, portal services)",
      directive: "script-src",
      edition: "crazy",
    },
  ],
};
