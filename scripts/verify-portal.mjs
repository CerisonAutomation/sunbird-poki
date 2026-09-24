#!/usr/bin/env node
/**
 * Portal compliance gate — asserts the submission zip obeys Poki's rules.
 * Fails loudly with a concrete reason; exit 0 means shippable.
 *
 * Checks the shipped zip (sunbird-poki.zip):
 *   1. Zip exists and fits the size bar (Poki's 8 MB initial-load target).
 *   2. Staged index.html carries no manifest link (portals are not installable).
 *   3. No js.stripe.com request URL (external payments are banned on portals).
 *   4. No absolute href="/…"/src="/…" (portals serve from deep CDN subpaths).
 *   5. Correct SDK profile: the Poki bundle ships its portal integration.
 *      The ONLY static remote reference any zip may carry is the target
 *      portal's own SDK script tag — Poki's HTML5 guide requires it verbatim
 *      in the page head, and it is the platform's own host, so it is not the
 *      "external asset" rule REQ-40 forbids. Every other remote reference
 *      fails the gate, and generic exposes no reachable SDK loader path.
 *   6. icons/ + fonts/ ship inside the zip (self-contained, offline-safe).
 *   7. No third-party backend markers anywhere in the bundle: portals ship
 *      local/coin-only editions, so Stripe endpoints, live/test publishable
 *      keys, the Upstash-backed leaderboard Worker, and the social server
 *      must not survive into any portal zip.
 */
import { execFileSync } from "node:child_process";
import { foreignMarkersIn, missingMarkersIn } from "./portal-markers.mjs";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const MAX_ZIP_BYTES = 8_000_000; // Poki initial-download target (strictest bar)
const PORTALS = ["poki"];
const SDK_URL = {
  poki: "game-cdn.poki.com",
  generic: null,
};

/**
 * The one remote reference each portal's build is ALLOWED to load statically.
 *
 * Poki's SDK guide is explicit that the game loads the SDK in the page head
 * (`<script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js">`), so the
 * Poki zip legitimately contains that tag. Anything else remote — a font CDN,
 * an analytics beacon, another portal's SDK — still fails.
 */
const STATIC_REMOTE_ALLOW = {
  poki: [/^https:\/\/game-cdn\.poki\.com\/scripts\/v2\/poki-sdk\.js$/],
  generic: [],
};

function fail(msg) {
  console.error(`\n❌ PORTAL GATE FAILED\n${msg}\n`);
  process.exit(1);
}

function zipHtml(portal) {
  try {
    return execFileSync("unzip", ["-p", join(root, `sunbird-${portal}.zip`), "index.html"], {
      maxBuffer: 32 * 1024 * 1024,
    }).toString("utf8");
  } catch {
    fail(`sunbird-${portal}.zip is missing or has no index.html — run pnpm build:portals first.`);
  }
}

function zipList(portal) {
  try {
    return execFileSync("unzip", ["-l", join(root, `sunbird-${portal}.zip`)]).toString("utf8");
  } catch {
    fail(`sunbird-${portal}.zip is unreadable.`);
  }
}

const failures = [];
for (const portal of PORTALS) {
  const zipPath = join(root, `sunbird-${portal}.zip`);
  if (!existsSync(zipPath)) {
    failures.push(`${portal}: zip missing — run pnpm build:portals.`);
    continue;
  }
  const zipBytes = statSync(zipPath).size;
  if (zipBytes > MAX_ZIP_BYTES) {
    failures.push(`${portal}: ${(zipBytes / 1e6).toFixed(1)} MB exceeds ${(MAX_ZIP_BYTES / 1e6).toFixed(0)} MB bar.`);
  }
  const html = zipHtml(portal);
  const list = zipList(portal);
  if (/manifest/i.test(html)) failures.push(`${portal}: manifest reference survived in staged index.html.`);
  if (/stripe/i.test(html)) failures.push(`${portal}: payment-provider marker survived (portal builds are coin-only).`);
  if (/(href|src)="\/[^"]*"/.test(html)) failures.push(`${portal}: absolute /asset reference (breaks CDN subpaths).`);
  if (!/icons\//.test(list) || !/fonts\//.test(list)) failures.push(`${portal}: icons/ or fonts/ missing from zip.`);
  // SDK profile: the build must SHIP its own portal integration, and must not
  // STATICALLY load anything remote (a <script src="http…"> runs unconditionally
  // — portals block those). Which SDK URL flows into the dynamic loader is
  // gated in code (scriptFor() returns null for every non-target), so the mere
  // presence of the other host as an inert string literal is not a load.
  const want = SDK_URL[portal];
  if (want && !html.includes(want)) failures.push(`${portal}: portal SDK (${want}) missing from bundle.`);
  const allow = STATIC_REMOTE_ALLOW[portal] ?? [];
  const staticRemote = [...html.matchAll(/<(?:script|link|img)[^>]+(?:src|href)="(https?:[^"]+)"/g)]
    .map((m) => m[1])
    .filter((url) => !allow.some((re) => re.test(url)));
  if (staticRemote.length) failures.push(`${portal}: static remote reference(s): ${[...new Set(staticRemote)].join(", ")}.`);
  // Generic obeys the same static rule: ensureSdk() returns before touching
  // scriptFor() for "generic"/"none", so the SDK loader is unreachable there
  // by construction (see the note on the URL constants in src/sdk/platform.ts).
  // Third-party backend markers: the portal editions are local/coin-only, so
  // the Upstash-backed leaderboard Worker, Stripe endpoints and keys, and
  // their dev fallbacks must not survive into the bundle. The build blanks
  // VITE_SOCIAL_URL / multiplayer URLs, and this
  // check is the regression tripwire for that (the bundle is inlined into
  // index.html, so the html string IS the full bundle).
  const FORBIDDEN_MARKERS = [
    "upstash",
    "api.stripe.com",
    "hooks.stripe.com",
    "js.stripe.com",
    "pk_live_",
    "pk_test_",
    // External store link (index.html og:url) — stripped by package-portal.mjs;
    // this is the regression tripwire if it ever survives into a zip.
    "cerison.itch.io",
    // Direct-build coin receipt storage must not ship in portal editions —
    // the build-time alias swaps in Payments.portal.ts, which has none.
    "sunbird\\.receipts",
  ];
  for (const marker of FORBIDDEN_MARKERS) {
    if (new RegExp(marker, "i").test(html)) {
      failures.push(`${portal}: third-party backend marker "${marker}" in bundle (portals are self-contained).`);
    }
  }
  // Cross-portal isolation ("every version is its own way"): this bundle may
  // name only its OWN portal. A foreign SDK global, CDN URL or edition string
  // here means a shared module leaked target-only code — see portal-markers.mjs.
  for (const hit of foreignMarkersIn(html, portal)) {
    failures.push(`${portal}: foreign portal marker in bundle — ${hit}.`);
  }
  // …and the bundle must still carry its OWN platform integration. Isolation
  // cuts both ways: no foreign markers in, no lost netlib/AUDS/PokiSDK out.
  for (const missed of missingMarkersIn(html, portal)) {
    failures.push(`${portal}: required platform marker missing — ${missed}.`);
  }
  console.log(`✓ sunbird-${portal}.zip  ${(zipBytes / 1024).toFixed(0)} KB  ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB html`);
}

if (failures.length) fail(failures.join("\n"));
console.log("\n✅ PORTAL GATE PASSED — all three zips shippable.\n");
