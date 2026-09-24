/**
 * Legal edition module — the POKI build.
 *
 * Swapped in for `legal.edition.ts` by the portal-alias plugin in
 * `vite.config.ts`. This is the disclosure a Poki reviewer reads inside the
 * game (Settings → Privacy Policy) and the one the hosted policy page carries
 * for this edition, so it names every host the Poki build can touch and why —
 * the same list `scripts/gen-csp-request.ts` turns into the Content-Security-Policy
 * request. The two cannot drift because they read the same array — and
 * `scripts/verify-csp.ts` (`pnpm verify:csp`) closes the last gap by reading the
 * built `dist-poki/` bundle and failing if it reaches for a host this table does
 * not declare, or declares one the bundle never uses.
 *
 * Isolation rule: no other portal's name appears in this file. A "CrazyGames"
 * string in a Poki bundle is a foreign-portal marker and fails
 * `pnpm verify:portals`.
 */
import type { LegalEdition } from "./legal";

export const LEGAL_EDITION: LegalEdition = {
  id: "poki",
  label: "Poki edition",
  multiplayer: {
    body: [
      "On Poki, multiplayer is peer-to-peer through Poki's own Netlib library: your browser connects directly to the other players' browsers. Poki operates the signalling and relay servers that make the connection possible. Sunbird operates no server in that path.",
      "Races can also be run against a recording of another player's flight (a ghost). That recording is stored through Poki's own data store, keyed by the identifier Poki gives the game — not by anything you typed.",
    ],
    rows: [
      [
        "Exchanged with other players",
        "Your pilot name, your bird's appearance, your in-race position and speed, emotes, and whether you are ready or finished",
      ],
      ["Poki signalling", "netlib.poki.io — lobby creation and joining, operated by Poki"],
      [
        "Connection relay",
        "stun.l.google.com and turn.rtc.poki.com — used only when a direct connection between two players fails",
      ],
      [
        "Poki data store",
        "auds.poki.io — Poki's Arbitrary User Data Store, used for leaderboard entries and shared daily runs, keyed by the identifier Poki gives the game (not by anything you typed)",
      ],
      [
        "Pilot names",
        "Generated from a fixed curated word list and rerolled with a dice button. This edition has no free-text name field, so no player-authored text is ever broadcast to other players",
      ],
    ],
  },
  analytics: {
    body: [
      "Aggregate counters are switched off entirely in this edition: the portal runs its own analytics under its own policy, and the game does not send anything to a developer server.",
      "Portal SDK: when the game runs on Poki, Poki loads its own SDK into the page. Anything that SDK measures is governed by Poki's privacy policy, not this one. Sunbird sends it nothing beyond the standard gameplay lifecycle signals the platform requires (loading started, loading finished, gameplay started, gameplay stopped, ad breaks).",
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
      "Data processed by Poki (signalling, relay, data store) is retained under Poki's own policy. The game itself keeps nothing off-device in this edition.",
    ],
  },
  hosts: [
    {
      host: "game-cdn.poki.com",
      purpose: "Poki SDK script (ads, lifecycle, leaderboard handshake)",
      directive: "script-src",
      edition: "poki",
    },
    {
      host: "netlib.poki.io",
      purpose: "Poki Netlib WebRTC signalling — multiplayer lobby create/join",
      directive: "connect-src",
      edition: "poki",
    },
    {
      host: "turn.rtc.poki.com",
      purpose: "TURN relay when a direct peer connection fails",
      directive: "webrtc",
      edition: "poki",
    },
    {
      host: "stun.l.google.com",
      purpose: "STUN candidate gathering for WebRTC",
      directive: "webrtc",
      edition: "poki",
    },
    {
      host: "auds.poki.io",
      purpose: "Poki Arbitrary User Data Store — leaderboard entries, shared daily runs",
      directive: "connect-src",
      edition: "poki",
    },
  ],
};
