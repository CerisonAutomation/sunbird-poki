#!/usr/bin/env node
/**
 * Simulates the FIRST thing every portal Inspector does: take the folder (or
 * zip) you selected and look for an entry document at its root.
 *
 * This gate exists because a real "missing index.html" upload was reported:
 * the old `poki-upload/` folder was a stale hand-committed snapshot, so the
 * folder the docs pointed at contained an old build (and, before the fix, a
 * tree that did not match `dist-poki/` at all).
 *
 * It checks, in order:
 *   ROOT-01  index.html exists at the ROOT of poki-upload/ and sunbird-poki.zip
 *   ROOT-02  the zip has no wrapping directory (Inspector unzips as-is)
 *   ROOT-03  poki-upload/ is fresh — its index.html hash matches the manifest
 *            hash recorded at packaging time, and it carries the current build
 *            (byte-identical to dist-poki/index.html over its final 4 KB)
 *   ROOT-04  the folder holds only uploadable files (no sw.js / manifest /
 *            sourcemaps / dotfiles / upload-manifest.json)
 *   ROOT-05  the zip and the folder agree byte-for-byte on index.html
 *   ROOT-06  everything index.html references locally is present
 *   ROOT-07  no other portal's markers (SDK global, CDN URL, edition string)
 *            appear in the folder — the Poki edition ships Poki only
 *   ROOT-08  the Poki edition keeps Poki's own integrations (Netlib/AUDS/SDK)
 *   ROOT-09  poki.json points the CLI at this same folder, so the tree that
 *            gets uploaded is the tree that was verified
 *   ROOT-10  the shipped html carries the Poki game id, so AUDS and the
 *            leaderboard are live rather than silently dormant
 *
 * Usage: node scripts/verify-upload.mjs
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { foreignMarkersIn, missingMarkersIn } from "./portal-markers.mjs";

const UPLOAD = "poki-upload";
const ZIP = "sunbird-poki.zip";
const DIST = "dist-poki";

const results = [];
const ok = (id, msg) => results.push({ id, ok: true, msg });
const bad = (id, msg) => results.push({ id, ok: false, msg });
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

/* ROOT-01 ------------------------------------------------------------ */
let folderHtml = null;
const indexPath = path.join(UPLOAD, "index.html");
if (existsSync(indexPath)) {
  folderHtml = readFileSync(indexPath);
  ok("ROOT-01", `${UPLOAD}/index.html present (${(folderHtml.length / 1024).toFixed(0)} KB)`);
} else {
  bad("ROOT-01", `${UPLOAD}/index.html MISSING — the Inspector would say "missing index.html"`);
}

let zipListing = [];
try {
  zipListing = execFileSync("unzip", ["-Z1", ZIP], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  ok("ROOT-01", `${ZIP} present, ${zipListing.length} entries`);
} catch {
  bad("ROOT-01", `${ZIP} missing or unreadable — run \`pnpm build:poki\``);
}

/* ROOT-02 ------------------------------------------------------------ */
if (zipListing.length) {
  const hasRootIndex = zipListing.includes("index.html");
  const wrapped = zipListing.every((e) => e.includes("/")) && !hasRootIndex;
  if (hasRootIndex) ok("ROOT-02", "zip has index.html at the root (no wrapping directory)");
  else if (wrapped) bad("ROOT-02", `zip is wrapped in a directory: ${zipListing[0]} — unzip before uploading`);
  else bad("ROOT-02", `zip has no root index.html (entries: ${zipListing.slice(0, 5).join(", ")})`);

  const nonUploadable = zipListing.filter((e) => /(^|\/)(sw\.js|manifest\.webmanifest|\.DS_Store)$/.test(e) || e.startsWith("."));
  if (nonUploadable.length) bad("ROOT-04", `zip carries non-uploadable entries: ${nonUploadable.join(", ")}`);
  else ok("ROOT-04", "zip carries no sw.js / manifest / dotfiles");

  if (folderHtml) {
    let zipBuf = null;
    try {
      // maxBuffer: the single-file build is ~1.7 MB, well over execFile's 1 MB default.
      zipBuf = execFileSync("unzip", ["-p", ZIP, "index.html"], { maxBuffer: 64 * 1024 * 1024 });
    } catch {
      // No root index.html in the archive — already reported by ROOT-02; this
      // must not crash the gate.
      zipBuf = null;
    }
    if (!zipBuf) bad("ROOT-05", `cannot compare: ${ZIP} has no index.html at its root`);
    else if (sha(zipBuf) === sha(folderHtml)) ok("ROOT-05", "zip and folder ship the same index.html (sha256 match)");
    else
      bad(
        "ROOT-05",
        `zip index.html (${zipBuf.length} B) ≠ ${UPLOAD}/index.html (${folderHtml.length} B) — re-run \`pnpm build:poki\``,
      );
  }
}

/* ROOT-03 ------------------------------------------------------------ */
const manifestPath = path.join(UPLOAD, "upload-manifest.json");
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const builtAt = Date.parse(manifest.builtAt ?? 0);
  const ageMin = Number.isFinite(builtAt) ? (Date.now() - builtAt) / 60000 : Infinity;
  const age = Number.isFinite(ageMin) ? (ageMin < 90 ? `${Math.round(ageMin)} min` : `${(ageMin / 60).toFixed(1)} h`) : "unknown";

  if (manifest.staged?.sha256 && folderHtml && sha(folderHtml) === manifest.staged.sha256) {
    ok("ROOT-03", `${UPLOAD}/ matches its packaging manifest (built ${age} ago)`);
  } else {
    bad("ROOT-03", `${UPLOAD}/index.html was edited after packaging — re-run \`pnpm build:poki\``);
  }

  if (existsSync(DIST) && manifest.source?.sha256) {
    const distSha = sha(readFileSync(path.join(DIST, "index.html")));
    if (distSha === manifest.source.sha256)
      ok("ROOT-03", `${UPLOAD}/ is current with ${DIST}/index.html (same source hash)`);
    else
      bad(
        "ROOT-03",
        `${UPLOAD}/ is STALE: built from a different ${DIST}/index.html — the folder you would upload does not contain the current build. Run \`pnpm build:portals\`.`,
      );
  } else if (!existsSync(DIST)) {
    bad("ROOT-03", `${DIST}/ missing — run \`pnpm build:poki\` to prove ${UPLOAD}/ is current`);
  }

  // Independent of the manifest: a stale folder is caught by content, not by
  // trust. The packaging transforms only touch the <head> (manifest link,
  // og:url) and payment markers, so the tail of the single-file build — the
  // body markup and the closing tags — must be byte-identical in both copies.
  if (folderHtml && existsSync(path.join(DIST, "index.html"))) {
    const tail = readFileSync(path.join(DIST, "index.html")).subarray(-4096);
    if (folderHtml.includes(tail)) {
      ok("ROOT-03", `shipped folder is byte-identical to ${DIST}/ over its final 4 KB (fresh code, not a stale snapshot)`);
    } else {
      bad("ROOT-03", `${UPLOAD}/ does not carry the current build's code — it is a stale snapshot. Run \`pnpm build:poki\`.`);
    }
  }
} else {
  bad("ROOT-03", `${UPLOAD}/upload-manifest.json missing — folder was not produced by \`pnpm build:portals\``);
}

/* ROOT-04 (folder half) ----------------------------------------------- */
if (existsSync(UPLOAD)) {
  // The same anatomy `package-portal.mjs`'s ENTRY_DIRS produces, plus the
  // manifest this script reads. `animated/` is deliberately absent from both:
  // the promo art lives in `promo/` and must not ride along in the upload.
  const allowedTop = new Set(["index.html", "icons", "fonts", "upload-manifest.json"]);
  const top = readdirSync(UPLOAD);
  const unexpected = top.filter((e) => !allowedTop.has(e));
  if (unexpected.length) bad("ROOT-04", `${UPLOAD}/ has unexpected entries: ${unexpected.join(", ")}`);
  else ok("ROOT-04", `${UPLOAD}/ root holds only: ${top.sort().join(", ")}`);

  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
      d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)],
    );
  const files = walk(UPLOAD);
  const junk = files.filter(
    (f) => /(^|\/)(sw\.js|manifest\.webmanifest|\.DS_Store)$/.test(f) || /\.map$/.test(f) || /\/\.[^/]+$/.test(f),
  );
  if (junk.length) bad("ROOT-04", `${UPLOAD}/ carries junk: ${junk.join(", ")}`);
  else ok("ROOT-04", `${UPLOAD}/ holds ${files.length} files, none of them junk`);
}

/* ROOT-06 ------------------------------------------------------------ */
if (folderHtml) {
  const html = folderHtml.toString("utf8");
  const refs = new Set();
  for (const m of html.matchAll(/(?:src|href)\s*=\s*["'](\.\/[^"']+)["']/g)) refs.add(m[1]);
  for (const m of html.matchAll(/url\(\s*["']?(\.\/[^"')]+)["']?\s*\)/g)) refs.add(m[1]);
  const missing = [...refs].filter((r) => !existsSync(path.join(UPLOAD, r.replace(/^\.\//, ""))));
  if (missing.length) bad("ROOT-06", `referenced but absent: ${missing.join(", ")}`);
  else ok("ROOT-06", `all ${refs.size} local asset references resolve inside ${UPLOAD}/`);
}

/* ROOT-07 ------------------------------------------------------------ */
// Cross-portal isolation for the shipped artifact ("every version is its own
// way"). The Inspector folder is the Poki edition: it carries Poki's SDK and
// no other portal's markers. A hit here means a shared module leaked
// target-only code again — see scripts/portal-markers.mjs for the history.
if (folderHtml) {
  const hits = foreignMarkersIn(folderHtml.toString("utf8"), "poki");
  if (hits.length) bad("ROOT-07", `foreign portal marker in ${UPLOAD}/ — ${hits.join("; ")}`);
  else ok("ROOT-07", `${UPLOAD}/ carries no other portal's markers (Poki only)`);

  /* ROOT-08 --------------------------------------------------------- */
  // …and the Poki edition keeps its own platform integration: Netlib for P2P
  // races, AUDS for boards/share codes, the Poki SDK for the platform hooks.
  const missed = missingMarkersIn(folderHtml.toString("utf8"), "poki");
  if (missed.length) bad("ROOT-08", `${UPLOAD}/ is missing Poki platform integration — ${missed.join("; ")}`);
  else ok("ROOT-08", `${UPLOAD}/ keeps Poki's own integrations (Netlib P2P · AUDS · SDK)`);
}

/* ROOT-09 ------------------------------------------------------------ */
// The CLI uploads whatever `poki.json`'s `build_dir` names, so it has to name
// the directory every check above just validated. It pointed at `dist-poki`
// (vite's raw output) while this gate checked `poki-upload/`: the gate stayed
// green and the CLI pushed a tree with no SDK-01 head tag and a dangling
// manifest link. Keep the verified artifact and the uploaded artifact equal.
try {
  const { build_dir: buildDir } = JSON.parse(readFileSync("poki.json", "utf8"));
  if (buildDir === UPLOAD) ok("ROOT-09", `poki.json build_dir is ${UPLOAD}/ — the CLI uploads the verified folder`);
  else bad("ROOT-09", `poki.json build_dir is "${buildDir}" but this gate validates ${UPLOAD}/ — the CLI would push an unverified tree`);
} catch {
  bad("ROOT-09", "poki.json missing or unreadable — `poki upload` would fall back to build_dir \"dist\"");
}

/* ROOT-10 ------------------------------------------------------------ */
// AUDS and the Poki leaderboard only exist when the build carries the
// Poki-issued game id: without it every AUDS call is skipped and the
// integration is dormant rather than broken — which is exactly the kind of
// absence nobody notices until the board is empty in production. The id is
// baked in by `build:poki` from the same `poki.json` the CLI uploads with.
if (folderHtml) {
  let gameId = "";
  try {
    gameId = JSON.parse(readFileSync("poki.json", "utf8")).game_id ?? "";
  } catch {
    /* reported below */
  }
  const html = folderHtml.toString("utf8");
  if (!gameId) bad("ROOT-10", "poki.json has no game_id — the shipped build cannot carry AUDS");
  else if (!html.includes(gameId)) {
    bad("ROOT-10", `${UPLOAD}/index.html does not carry the game id (${gameId}) — AUDS and the Poki leaderboard would be dormant`);
  } else if (!html.includes("auds.poki.io")) {
    bad("ROOT-10", `${UPLOAD}/index.html has the game id but no AUDS host — the board would never load`);
  } else {
    ok("ROOT-10", `ships the Poki game id (${gameId.slice(0, 8)}…) with AUDS live`);
  }
}

/* ----------------------------------------------------------------- report -- */
const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.id} ${r.msg}`);
const size = existsSync(indexPath) ? `${(statSync(indexPath).size / 1048576).toFixed(2)} MB` : "n/a";
console.log(`\n${failed.length ? `✗ ${failed.length} upload gate failure(s)` : "✓ UPLOAD READY"} — ${UPLOAD}/index.html ${size}, at the folder root.`);
if (failed.length) process.exit(1);
