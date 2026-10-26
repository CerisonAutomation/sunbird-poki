/**
 * Cross-portal isolation markers — the machine-checked form of "every version
 * is its own way".
 *
 * A portal bundle must carry its OWN SDK/branding and nothing of any other
 * portal's. This is not hypothetical: the loading-screen failsafe used to hold
 * a raw `window.PokiSDK` fallback behind `if (TARGET !== "poki") return;`, and
 * the minifier folds positive `TARGET === "poki"` branches but NOT that
 * negative early-return — so the string survived into the generic bundle.
 * Both are now impossible by construction (target-only modules + the edition
 * swap in vite.config.ts); these markers keep them that way.
 *
 * Used by scripts/verify-portal.mjs (built dists, via the zips) and
 * scripts/verify-upload.mjs (the Inspector folder). Add a marker here whenever
 * a new per-target module is introduced.
 */
export const FOREIGN_MARKERS = {
  poki: [],
  generic: [
    [/poki/i, "Poki marker"],
    [/game-cdn\.poki\.com/, "Poki SDK URL"],
    [/netlib\.poki\.io/, "Poki netlib endpoint"],
    [/auds\.poki\.io/, "Poki AUDS endpoint"],
    [/\bPokiSDK\b/, "Poki SDK global"],
    [/data-ref=["']pilotName/, "free-text pilot name input (read-only with 🎲 roll)"],
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
 *
 * Note on pilot names: Poki now permits profanity-filtered free-text pilot
 * names (content & player safety policy updated 2026-09), so the
 * `data-ref="pilotName"` input is a LEGITIMATE Poki surface and must NOT be
 * flagged here. It is instead a foreign marker for generic (see
 * FOREIGN_MARKERS above) — the generic edition renders the name read-only.
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
  //   • Ad-removal claims must not survive into ANY portal bundle.
  [/No sponsored breaks/i, "ad-removal purchase claim in the paywall (REQ-20)"],
  [/[Rr]emove ads|No ads,? ever|Ad-?free forever/i, "ad-removal purchase claim (REQ-20)"],
  [/no breaks/i, "\"no breaks\" ad-removal claim in the Gold upsell strip (REQ-20)"],
  [/[Rr]emove breaks/, "\"Remove breaks\" ad-removal purchase button (REQ-20)"],
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

/**
 * Payment-processor markers — the machine-checked form of "portals are
 * coin-only, no payment processor".
 *
 * These are checked against the **pre-scrub** bundle in `package-portal.mjs`,
 * and that placement is the whole point. The packaging step rewrites
 * `/stripe/gi` -> `"portal"` across the whole inlined bundle and *then*
 * asserted that no `stripe` remained, which is a tautology: the string it
 * searched for had just been removed from everywhere, so the assertion was false
 * for every possible input. Worse, it made every downstream `/stripe/` test
 * (`verify-portal.mjs`, `audit-zips.mjs`) incapable of firing, so the headline
 * coin-only claim was true by inspection and not by gate.
 *
 * A scrub can only ever be a cosmetic last line of defence, because the thing
 * it is defending against — a payment SDK — is present as *text* in the bundle
 * before the scrub runs. That is the moment a check can actually see it, so
 * that is where this list is enforced.
 *
 * Honest limit: this is a text scan, so it cannot see a processor whose
 * identifier is assembled at runtime (`"str"+"ipe"`) or base64'd into the
 * bundle. It is a real gate, not a proof — do not describe it as one.
 *
 * Patterns are deliberately specific. Bare /square/, /apple.?pay/ and /shopify/
 * were tried and dropped: the bundle legitimately contains an `apple-pay` CSS
 * utility class, and a marker list that cries wolf gets deleted.
 */
export const PAYMENT_PROVIDER_MARKERS = [
  [/stripe/i, "Stripe"],
  [/pk_(live|test)_/i, "Stripe publishable key"],
  [/paypal/i, "PayPal"],
  [/braintree/i, "Braintree"],
  [/adyen/i, "Adyen"],
  [/paddle/i, "Paddle"],
  [/razorpay/i, "Razorpay"],
  [/lemonsqueezy/i, "Lemon Squeezy"],
  [/gocardless/i, "GoCardless"],
  [/klarna/i, "Klarna"],
  [/coinbase\s?\.?com/i, "Coinbase Commerce"],
  [/checkout\.com/i, "Checkout.com"],
  [/squareup\.com/i, "Square (squareup)"],
  [/\b(xsplit|paysafecard|skrill|neteller)\b/i, "alternative payment provider"],
];

/** Every payment-processor marker that appears in `text`, as "name (matched)"."*/
export function paymentMarkersIn(text) {
  const hits = [];
  for (const [re, why] of PAYMENT_PROVIDER_MARKERS) {
    const m = re.exec(text);
    if (m) hits.push(`${why} ("${m[0]}")`);
  }
  return hits;
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
