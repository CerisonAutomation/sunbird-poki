/**
 * Cross-portal isolation markers — the machine-checked form of "every version
 * is its own way".
 *
 * A portal bundle must carry its OWN SDK/branding and nothing of any other
 * portal's. This is not hypothetical: the loading-screen failsafe used to hold
 * a raw `window.PokiSDK` fallback behind `if (TARGET !== "poki") return;`, and
 * the minifier folds positive `TARGET === "poki"` branches but NOT that
 * negative early-return — so the string survived into the CrazyGames and
 * generic bundles. The HUD additionally embedded all three portal names in one
 * runtime ternary. Both are now impossible by construction (target-only modules
 * + the edition swap in vite.config.ts); these markers keep them that way.
 *
 * Used by scripts/verify-portal.mjs (built dists, via the zips) and
 * scripts/verify-upload.mjs (the Inspector folder). Add a marker here whenever
 * a new per-target module is introduced.
 */
export const FOREIGN_MARKERS = {
  poki: [
    [/crazygames/i, "CrazyGames marker"],
    [/sdk\.crazygames\.com/, "CrazyGames SDK URL"],
    [/CrazyGames edition/, "CrazyGames edition string"],
  ],
  crazy: [
    [/poki/i, "Poki marker"],
    [/game-cdn\.poki\.com/, "Poki SDK URL"],
    [/netlib\.poki\.io/, "Poki netlib endpoint"],
    [/auds\.poki\.io/, "Poki AUDS endpoint"],
    [/\bPokiSDK\b/, "Poki SDK global"],
    [/Poki edition/, "Poki edition string"],
  ],
  generic: [
    [/poki/i, "Poki marker"],
    [/game-cdn\.poki\.com/, "Poki SDK URL"],
    [/netlib\.poki\.io/, "Poki netlib endpoint"],
    [/auds\.poki\.io/, "Poki AUDS endpoint"],
    [/\bPokiSDK\b/, "Poki SDK global"],
    [/crazygames/i, "CrazyGames marker"],
    [/sdk\.crazygames\.com/, "CrazyGames SDK URL"],
  ],
};

/**
 * Markers that must not appear in ANY portal edition: chat (Poki REQ-31) and
 * the self-hosted backend.
 *
 * Chat (Poki REQ-31: "no chat in multiplayer product surfaces — emotes are the
 * recommended alternative"). The club chat surface is a direct-build feature:
 * portal editions have no chat UI at all (`SQUAD_CHAT` in the edition module),
 * no chat polling, and `SquadClient.sendChat` is a dead return. These markers
 * pin the UI contract — the input, its accessible name and its action wiring —
 * so a future renderer cannot quietly reintroduce a message box into a portal
 * build. (Inert remnants are expected and allowed: the `.chat-box` CSS rule and
 * a minified `case"squad-chat":break;` with nothing to trigger it.)
 */
export const PORTAL_FORBIDDEN_MARKERS = [
  [/Message your club/, "club chat input (REQ-31 forbids chat surfaces)"],
  [/chatText/, "club chat input ref"],
  [/data-action=["']squad-chat/, "club chat send button"],
  [/Club chat history/, "club chat log"],
  [/Friends &amp; club chat|Friends & club chat/, "chat promise in the Squad menu copy"],
  // Player-authored text and ad-removal purchases are both platform policy
  // violations, and both were live in the shipped bundle until the compliance
  // pass:
  //   • REQ-20 — no in-app purchases and no UI implying them ("no 'remove ads'
  //     purchase"). Gold's pitch claimed "No sponsored breaks, ever"; the
  //     bullet now only exists when edition SELL_AD_REMOVAL is true, so a
  //     portal bundle containing this string means the gate regressed.
  //   • Content & player safety — portals broadcast the pilot name to real
  //     players (netlib rooms, rosters, name tags) and must not collect
  //     personal data, so portal editions render the name read-only
  //     (edition CUSTOM_PILOT_NAMES) with a 🎲 roll instead of a text field.
  [/No sponsored breaks/i, "ad-removal purchase claim in the paywall (REQ-20)"],
  [/[Rr]emove ads|No ads,? ever|Ad-?free forever/i, "ad-removal purchase claim (REQ-20)"],
  [/no breaks/i, "\"no breaks\" ad-removal claim in the Gold upsell strip (REQ-20)"],
  [/[Rr]emove breaks/, "\"Remove breaks\" ad-removal purchase button (REQ-20)"],
  [/data-ref=["']pilotName/, "free-text pilot name input (no player-authored text or personal data on portals)"],
  // The self-hosted stack (Rust/TS room server, social service, leaderboard
  // backend) is the DIRECT-BUILD path. Portal editions blank
  // VITE_MULTIPLAYER_URL / VITE_SOCIAL_URL / VITE_LEADERBOARD_URL at build
  // time and must therefore carry no trace of that infrastructure — the Poki
  // edition reaches other pilots over Netlib P2P and stores through AUDS
  // instead. These markers keep the two worlds from bleeding into each other.
  [/\/mp\/v1\//, "self-hosted multiplayer REST path (portal editions ship no backend)"],
  [/sunbird-social/, "self-hosted social service marker"],
  [/\bws:\/\//, "insecure WebSocket URL (portal builds must never hardcode a backend)"],
];

/**
 * Markers every edition of a given portal MUST carry.
 *
 * Isolation has two directions. The forbidden lists above stop another
 * platform's code from leaking in; this one stops a build from quietly
 * *losing its own* platform integration — e.g. a Poki bundle that no longer
 * knows how to do P2P multiplayer, or a CrazyGames bundle without its SDK.
 * An empty list means the edition has no platform integration by design.
 */
export const REQUIRED_MARKERS = {
  poki: [
    [/netlib\.poki\.io/, "Poki Netlib signaling endpoint (P2P multiplayer)"],
    [/auds\.poki\.io/, "Poki AUDS endpoint (leaderboards + share codes)"],
    [/\bPokiSDK\b/, "Poki SDK global"],
  ],
  crazy: [[/crazygames/i, "CrazyGames SDK marker"]],
  generic: [],
};

/** Required markers missing from `html`, as "reason" strings. */
export function missingMarkersIn(html, portal) {
  const table = REQUIRED_MARKERS[portal] ?? [];
  const missing = [];
  for (const [re, why] of table) {
    if (!re.test(html)) missing.push(why);
  }
  return missing;
}

/** Every forbidden marker that appears in `html`, as "reason (matched text)". */
export function foreignMarkersIn(html, portal) {
  const table = FOREIGN_MARKERS[portal];
  if (!table) return [];
  const hits = [];
  for (const [re, why] of [...table, ...PORTAL_FORBIDDEN_MARKERS]) {
    const m = re.exec(html);
    if (m) hits.push(`${why}: "${m[0]}"`);
  }
  return hits;
}
