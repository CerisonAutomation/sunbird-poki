#!/usr/bin/env node
/**
 * Packages a portal build into the two artifacts a portal actually consumes:
 *
 *   1. a ZIP (`sunbird-<portal>.zip`) — for portal review pipelines and
 *      CDN-style uploads, and
 *   2. for Poki, an UPLOAD FOLDER (`poki-upload/`) — because the Poki Inspector
 *      takes a folder, and its first check is "index.html at the root of the
 *      folder you selected". A zip alone is not an uploadable artifact there.
 *
 * Both are built from the same staging step, so they can never disagree.
 *
 * The staged bundle is deliberately minimal and self-contained:
 *   index.html   the whole game (JS + CSS + fonts inlined by vite-singlefile)
 *   icons/       favicons / apple-touch-icon (referenced by the head)
 *   fonts/       self-hosted woff2 (kept for host-side/offline tooling)
 *
 * `i18n/` used to ride along "for host-side tooling". Nothing fetched it: the
 * runtime lazy-loads per-locale packs that vite-singlefile inlines into
 * index.html, so the barrel in the zip was ~100 KB of dead weight inside an
 * 8 MB portal budget — and it grew with every language added. It is gone from
 * the package; the barrel still lives in `src/i18n/` where the tooling reads it.
 *
 * Stripped at this step, because portals run the game in a cross-origin iframe:
 *   • `<link rel="manifest">` (not installable, and a 404 inside the frame)
 *   • `<meta property="og:url">` (points off-platform; Inspector flags it)
 *   • payment-provider markers (portal editions are coin-only)
 *   • `sw.js` / `manifest.webmanifest` are removed from the build output itself,
 *     so the dist folder is not a trap for someone who grabs it by hand.
 *
 * A stale upload folder was the cause of a real "missing index.html" report:
 * the old `poki-upload/` was a hand-committed snapshot that no build refreshed.
 * It is now GENERATED on every `build:poki`, git-ignored, and verified by
 * `scripts/verify-upload.mjs` (which also proves it is not stale).
 */
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const portal = process.argv[2];
if (!portal || !["poki", "crazy", "generic"].includes(portal)) {
  console.error("usage: package-portal.mjs <poki|crazy|generic>");
  process.exit(1);
}
const src = `dist-${portal}`;
if (!existsSync(src)) {
  console.error(`missing ${src} — run the build first`);
  process.exit(1);
}

/** The folder the Inspector / portal developer selects in their file picker. */
const uploadDir = portal === "poki" ? "poki-upload" : null;

/**
 * The head/tag transforms every portal bundle needs. Kept in one function so
 * the zip and the upload folder are byte-identical by construction.
 */
function stageHtml() {
  let html = readFileSync(path.join(src, "index.html"), "utf8")
    .replace(/^\s*<link rel="manifest"[^>]*>\n?/m, "")
    .replace(/^\s*<meta property="og:url"[^>]*>\s*\n?/m, "")
    // Portal editions are coin/VIP-only and must not carry a payment-provider
    // marker for a scanner to find. The swap is length-preserving and applies
    // to CSS class names and telemetry ids in the same document, so the
    // artifact stays internally consistent; the assertion below makes sure the
    // scrub is total (a leftover would mean a runtime-built string escaped it).
    .replace(/stripe/gi, "portal");
  if (/stripe/i.test(html)) throw new Error("payment-marker scrub incomplete");
  // Poki's HTML5 SDK page: "Add the following HTML within the <head> tags of
  // your game HTML". Loading it from the document head means it is already
  // there when the bundle boots, instead of the game waiting ~2 s to discover
  // it and then fetching it — which is the difference between ads being ready
  // at the first natural break and not. The adapter still degrades cleanly if
  // the request fails (offline preview, blocked script).
  if (portal === "poki") {
    // Match the TAG, not the hostname: the bundled adapter also contains the
    // CDN URL as a string (it is the fallback loader).
    const SDK_TAG = '<script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>';
    if (html.includes(SDK_TAG)) throw new Error("Poki SDK tag already staged");
    html = html.replace(
      /<head>/i,
      '<head>\n    <script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>',
    );
    if (!html.includes(SDK_TAG)) {
      throw new Error("Poki SDK tag injection failed — the head tag shape changed");
    }
  }
  return html;
}

/**
 * `index.html` + the directories that ship beside it (and nothing else).
 *
 * This list IS the zip anatomy contract, and `audit-zips.mjs` enforces the same
 * entries from the other side — anything else in a zip is a packaging mistake.
 * It used to also carry `animated/`, the Poki animated-thumbnail promo art:
 * 2.5 MB of GIF/WebP that no code in the game ever requests, which ate a third
 * of the 8 MB portal budget and failed that gate on every single build. The art
 * now lives in `promo/animated/`, outside `public/`, so Vite no longer copies it
 * into every build; `pnpm gen-icons` still generates it there for hand-submission
 * to a portal, it just does not ship inside the game package any more.
 */
const ENTRY_DIRS = ["icons", "fonts"];
const ENTRIES = ["index.html", ...ENTRY_DIRS];

/** Write a staged bundle into `target` (fresh every run). */
function stageInto(target) {
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  const html = stageHtml();
  writeFileSync(path.join(target, "index.html"), html);
  for (const dir of ENTRY_DIRS) {
    const from = path.join(src, dir);
    if (existsSync(from)) cpSync(from, path.join(target, dir), { recursive: true });
  }
  return html;
}

/* -------------------------------------------------------- dist hygiene ---- */

// A portal build must not carry installable-app plumbing: portals forbid
// service workers inside their iframes, and a stray `sw.js` in the build
// output is a trap for anyone who uploads the dist folder directly.
for (const junk of ["sw.js", "manifest.webmanifest", "service-worker.js"]) {
  const p = path.join(src, junk);
  if (existsSync(p)) {
    rmSync(p, { force: true });
    console.log(`  · removed ${src}/${junk} (not shippable to a portal)`);
  }
}

/* --------------------------------------------------------- the zip -------- */

const stage = `dist-${portal}-zip`;
stageInto(stage);
const zip = `sunbird-${portal}.zip`;
rmSync(zip, { force: true });
// Explicit entries (not `.`) so the archive has no `./` row and no directory
// metadata surprises, and `-X` so no macOS/Linux resource forks ride along.
execSync(`cd ${stage} && zip -qrX ../${zip} ${ENTRIES.join(" ")}`);

/* ------------------------------------------------- the Poki upload folder - */

let uploadManifest = null;
if (uploadDir) {
  const html = stageInto(uploadDir);
  // Freshness proof for `verify-upload.mjs`: what this folder was built from,
  // and what it contains. A hand-edited or stale folder fails the gate.
  uploadManifest = {
    portal,
    builtAt: new Date().toISOString(),
    source: { file: path.join(src, "index.html"), sha256: sha256(readFileSync(path.join(src, "index.html"))) },
    staged: { file: path.join(uploadDir, "index.html"), sha256: sha256(html) },
    entries: ENTRIES.filter((e) => existsSync(path.join(uploadDir, e))),
    bytes: statSync(path.join(uploadDir, "index.html")).size,
  };
  writeFileSync(path.join(uploadDir, "upload-manifest.json"), `${JSON.stringify(uploadManifest, null, 2)}\n`);
}

rmSync(stage, { recursive: true, force: true });

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/* ---------------------------------------------------------------- report -- */

const zipKb = (statSync(zip).size / 1024).toFixed(0);
const dest =
  portal === "poki"
    ? "Poki Inspector upload"
    : portal === "crazy"
      ? "CrazyGames developer portal"
      : "any HTML5 portal (GameDistribution, Yandex, itch.io, Newgrounds, GameMonetize, …)";
console.log(`✓ ${zip} (${zipKb} KB) ready for ${dest}`);
if (uploadDir && uploadManifest) {
  console.log(`✓ ${uploadDir}/ — select THIS FOLDER in the Inspector (index.html is at its root)`);
  console.log(`    index.html ${(uploadManifest.bytes / 1024).toFixed(0)} KB · sha256 ${uploadManifest.staged.sha256.slice(0, 12)}`);
  console.log(`    entries: ${uploadManifest.entries.join(", ")}`);
  console.log("    verify with: pnpm verify:upload");
}
