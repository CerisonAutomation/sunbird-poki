#!/usr/bin/env node
/**
 * Deep portal-zip audit — the pass beyond scripts/verify-portal.mjs.
 *
 * verify-portal.mjs is the shippability GATE (fast, per-zip). This script is
 * the forensic inspection: zip anatomy, cross-zip separation, banned-string
 * sweep, full external-URL inventory, lifecycle-signal presence, and the
 * sandbox-storage fix. Run it after `pnpm build:portals`:
 *
 *   node scripts/audit-zips.mjs
 *
 * Exit 0 = every check passed. Any failure is printed with the zip and the
 * exact evidence.
 */
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { foreignMarkersIn, missingMarkersIn } from "./portal-markers.mjs";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const PORTALS = ["poki"];
const MAX_ZIP_BYTES = 8_000_000; // Poki initial-download target

const failures = [];
const notes = [];
const fail = (portal, msg) => failures.push(`${portal}: ${msg}`);
const note = (msg) => notes.push(msg);

function unzip(portal, mode) {
  const zipPath = join(root, `sunbird-${portal}.zip`);
  const args =
    mode === "html"
      ? ["-p", zipPath, "index.html"] // archive FIRST, then member
      // `-Z1` lists entry names only, one per line — no length/date columns, so
      // the anatomy parse below cannot be broken by the `unzip -l` date format.
      // GNU unzip prints YYYY-MM-DD; BSD unzip (macOS) prints MM-DD-YYYY, which
      // silently emptied the listing and failed every anatomy check locally.
      : ["-Z1", zipPath];
  return execFileSync("unzip", args, { maxBuffer: 64 * 1024 * 1024 }).toString("utf8");
}

const zips = {};
for (const portal of PORTALS) {
  const zipPath = join(root, `sunbird-${portal}.zip`);
  if (!existsSync(zipPath)) {
    fail(portal, "zip missing — run `pnpm build:portals` first.");
    continue;
  }
  const html = unzip(portal, "html");
  const listing = unzip(portal, "list");
  const bytes = statSync(zipPath).size;
  zips[portal] = { html, listing, bytes, hash: createHash("sha256").update(html).digest("hex").slice(0, 16) };
}

if (PORTALS.every((p) => zips[p])) {
  /* ------------------------------------------------- cross-zip separation */
  const hashes = PORTALS.map((p) => zips[p].hash);
  if (new Set(hashes).size !== PORTALS.length) {
    fail("-", "portal zips are NOT distinct — at least two bundles are identical (portals got cross-wired).");
  } else {
    note(`distinct bundles: ${PORTALS.map((p) => `${p}=${zips[p].hash}`).join("  ")}`);
  }

  const sdkHost = { poki: "game-cdn.poki.com" };
  for (const p of PORTALS) {
    const own = sdkHost[p];
    if (own && !zips[p].html.includes(own)) fail(p, `own SDK host ${own} missing from bundle.`);
  }
  // Cross-portal isolation — the machine-checked form of "every version is its
  // own way" (REQ-51: separate artifacts per portal). Every bundle carries its
  // OWN SDK/branding and none of another portal's. This used to be a `note`:
  // the foreign SDK literal shipped in every bundle behind a negative
  // `TARGET !== "poki"` guard the minifier could not fold. Target-only code now
  // lives in target-only modules (see scripts/portal-markers.mjs), so a foreign
  // marker is a hard failure — not an accepted inert string.
  for (const p of PORTALS) {
    for (const missed of missingMarkersIn(zips[p].html, p)) {
      fail(p, `required platform marker missing: ${missed}`);
    }
    for (const hit of foreignMarkersIn(zips[p].html, p)) {
      fail(p, `foreign portal marker in bundle — ${hit}. Portals must not cross-contaminate.`);
    }
  }
}

for (const portal of PORTALS) {
  const z = zips[portal];
  if (!z) continue;
  const { html, listing, bytes } = z;

  /* ------------------------------------------------------------- anatomy */
  // `unzip -Z1` prints bare entry names, one per line (see `unzip` above).
  const files = listing.split("\n").map((line) => line.trim()).filter(Boolean);
  // Allowed anatomy: the single-file game, its icons and fonts, plus the
  // bundled locale barrel (`i18n/`, ~12 KB). The barrel is the artifact the
  // poki-upload folder and the host-side tooling consume, it is loaded from a
  // relative path, and shipping it inside the zip keeps the bundle
  // self-contained in the guide's sense (no external resource requests). Any
  // OTHER entry is a packaging mistake.
  const badFile = files.find(
    (f) => !f.startsWith("icons/") && !f.startsWith("fonts/") && !f.startsWith("i18n/") && f !== "index.html",
  );
  if (badFile) fail(portal, `unexpected zip entry "${badFile}" (portals want ONLY index.html + icons/ + fonts/ + i18n/).`);
  const icons = files.filter((f) => f.startsWith("icons/")).length;
  const fonts = files.filter((f) => f.startsWith("fonts/")).length;
  if (!files.includes("index.html")) fail(portal, "index.html missing from zip.");
  if (icons < 3) fail(portal, `only ${icons} icon files in zip.`);
  if (fonts < 2) fail(portal, `only ${fonts} font files in zip.`);

  /* ---------------------------------------------------------------- size */
  if (bytes > MAX_ZIP_BYTES) fail(portal, `${(bytes / 1e6).toFixed(2)} MB exceeds the 8 MB portal bar.`);
  const gzipish = (Buffer.byteLength(html) / 1024).toFixed(0);
  note(`${portal}: zip ${(bytes / 1024).toFixed(0)} KB · html ${gzipish} KB · sha256 ${z.hash}`);

  /* ----------------------------------------------------- banned strings */
  // Hard failures only. Each pattern was tuned against real match contexts
  // in minified output: member calls (.prompt()), reads (location.href==="x")
  // and method-name strings (sendBeacon) are NOT violations and are reported
  // as notes below instead of failures.
  const banned = [
    [/stripe/i, "payment-provider marker 'stripe' (scrubbed by package-portal.mjs)"],
    [/cerison\.itch\.io|itch\.io/i, "external itch.io store reference (must be stripped from portal bundles)"],
    [/sunbird\.receipts/, "direct-build coin receipt storage (must not ship in portal editions)"],
    [/upstash/i, "Upstash backend marker"],
    [/pk_(live|test)_/, "Stripe publishable key"],
    [/api\.stripe\.com|hooks\.stripe\.com|js\.stripe\.com/, "Stripe endpoint"],
    [/<link[^>]+rel=["']manifest/i, "PWA manifest reference"],
    [/navigator\.serviceWorker/, "service worker API usage (portals forbid workers in their iframes)"],
    [/\bsw\.js\b/, "service worker script reference (the portal zip ships no sw.js)"],
    [/(https?|wss?):\/\/(localhost|127\.0\.0\.1|\[::1\])/, "requestable loopback URL"],
    // Our own multiplayer backend must never appear: the portal edition ships
    // with VITE_MULTIPLAYER_URL blanked. The ONE WebSocket URL that may ship is
    // the platform's own Netlib signaling endpoint (`wss://netlib.poki.io/…`),
    // which the guide recommends for P2P multiplayer (TOOL-04) and which the
    // vendor library carries as its default — it is not game infrastructure we
    // control, and it is unreachable unless a player opts into a race.
    [/\bws:\/\/(?!netlib\.poki\.io)|(?<!\bws:\/\/)\bwss:\/\/(?!netlib\.poki\.io)/, "hardcoded WebSocket backend URL (multiplayer must be blank in portal builds)"],
    // Loopback/private addresses are allowed: they appear inside the vendored
    // WebRTC candidate filtering (loopback candidates are dropped on purpose).
    // A public IP literal in the bundle would still be a finding.
    [/\b(?!127\.|10\.|192\.168\.|0\.0\.0\.0)\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, "public IP address literal"],
    [/sourceMappingURL/, "source map reference (build ships sourcemap:false)"],
    [/window\.open\(/, "window.open (popups are banned on portals)"],
    [/document\.write\(/, "document.write"],
    // Bare global dialog calls only — `obj.prompt()` (PWA install) is not one.
    [/(?<![.\w$])(alert|confirm|prompt)\(/, "native browser dialog call (portals want in-game UI)"],
    // Assign/replace only — a read like `location.href==="string"` is fine.
    [/location\.href\s*=[^=]|location\.replace\(/, "navigation away from the game iframe"],
  ];
  for (const [re, why] of banned) {
    if (re.test(html)) {
      const ctx = html.match(new RegExp(`.{0,60}${re.source}.{0,60}`))?.[0] ?? "";
      fail(portal, `banned pattern: ${why}\n        context: …${ctx.replace(/\n/g, " ")}…`);
    }
  }

  /* ------------------------------------------------ soft findings (notes) */
  const soft = [
    [/navigator\.sendBeacon/, "sendBeacon method string (Telemetry guard — endpoint() is '' in portal builds, so it can never fire)"],
    [/\blocalhost\b|\b127\.0\.0\.1\b/, "loopback string (local-dev debug-hostname regex — never a request)"],
    [/\bserviceworker\b/i, "worker-type string literal (React DOM's internal switch — not a registration)"],
  ];
  for (const [re, why] of soft) {
    if (re.test(html)) note(`${portal}: soft finding — ${why}`);
  }

  /* ------------------------------------------------ static remote assets */
  if (/(href|src)="\//.test(html)) fail(portal, 'absolute "/asset" reference (breaks portal CDN subpaths).');
  // The target portal's own SDK script is the single static remote reference a
  // build is allowed: Poki's HTML5 guide requires the SDK tag in the page head
  // verbatim, and it is the platform's own host rather than a third-party CDN
  // asset. Anything else — a font host, a tracker, another portal's SDK — fails.
  const allowSdk = portal === "poki"
    ? /^https:\/\/game-cdn\.poki\.com\/scripts\/v2\/poki-sdk\.js$/
    : null;
  const staticRemote = [...html.matchAll(/<(?:script|link|img|iframe)[^>]+(?:src|href|content)=["'](https?:[^"']+)["']/g)]
    .map((m) => m[1])
    .filter((url) => !(allowSdk && allowSdk.test(url)));
  if (staticRemote.length) fail(portal, `static remote reference(s): ${[...new Set(staticRemote)].join(", ")}`);

  /* ------------------------------------------------- lifecycle + fixes */
  // Every portal edition must ship the storage facade and the gameplay-event
  // signals *of its own SDK*: the Poki adapter is compiled out of the
  // generic bundle by design, so the SDK-specific markers are checked against
  // the bundle that is supposed to contain them.
  const mustHaveEverywhere = [
    ["sunbird.storage.probe", "cross-safe Storage facade (sandboxed-iframe fix)"],
    ["sessionStorage", "sessionStorage fallback of the Storage facade"],
    ["sunbird.cloud.", "cloud-save key prefix"],
    ["gameplayStart", "gameplay-start signal"],
    ["gameplayStop", "gameplay-stop signal"],
    ["commercialBreak", "commercial-break lifecycle (both SDKs expose it)"],
  ];
  for (const [needle, why] of mustHaveEverywhere) {
    if (!html.includes(needle)) fail(portal, `missing required string: "${needle}" — ${why}`);
  }
  const mustHavePerPortal = {
    poki: [
      ["gameLoadingStart", "Poki loading-start signal (the P0 pre-asset marker)"],
      ["gameLoadingFinished", "Poki loading-finished signal"],
      ["rewardedBreak", "Poki rewarded-break API"],
      ["game-cdn.poki.com", "Poki SDK loader"],
    ],
    generic: [
      // Generic builds ship no SDK at all, so there is no portal marker to look
      // for; the meaningful assertion is the opposite one (no reachable SDK —
      // checked above) plus proof the local adapter is what handles the
      // platform surface. `cloudSaveLocal` is the LocalAdapter capability set.
      ['"cloudSaveLocal"', "local platform adapter (generic builds run with no SDK)"],
      ["sunbird.cloud.", "local cloud-save fallback"],
    ],
  };
  for (const [needle, why] of mustHavePerPortal[portal] ?? []) {
    if (!html.includes(needle)) fail(portal, `missing required string: "${needle}" — ${why}`);
  }
  if (portal === "generic" && html.includes("game-cdn.poki.com")) {
    // Allowed ONLY as inert literals; verified above against <script> tags.
    note("generic: portal SDK literals present (inert) — confirm they are not in any tag (checked above).");
  }

  /* -------------------------------------------------- URL inventory */
  const urls = [...new Set([...html.matchAll(/https?:\/\/[^\s"'<>()\\]+/g)].map((m) => m[0]).map((u) => u.replace(/[),.;]+$/, "")))];
  const KNOWN_OK = [
    "https://game-cdn.poki.com/scripts/v2/poki-sdk.js",
  ];
  const suspicious = urls.filter((u) => !KNOWN_OK.includes(u) && !/w3\.org|schema\.org|xmlns/.test(u));
  if (suspicious.length) {
    // Inventory is printed as evidence; anything beyond the inert SDK
    // literals and namespace URLs is a reviewable finding.
    for (const u of suspicious) note(`${portal}: URL found in bundle: ${u}`);
  }
}

/* --------------------------------------------------------------- report */
console.log("\n=== PORTAL-ZIP AUDIT (deep) ===\n");
if (notes.length) {
  console.log("Inventory / notes:");
  for (const n of notes) console.log(`  · ${n}`);
  console.log("");
}
if (failures.length) {
  console.error("❌ AUDIT FAILED");
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("✅ ZIP AUDIT PASSED — all zips separate, clean, and portal-ready.\n");
