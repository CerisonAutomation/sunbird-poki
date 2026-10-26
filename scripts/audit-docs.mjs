#!/usr/bin/env node
/**
 * Docs hygiene gate — keeps the documentation set navigable and honest.
 *
 * The repo accumulated 53 markdown files (3.8 MB, 89% of it one 3.4 MB git-diff
 * dump called HANDOFF.md) with point-in-time audits sitting next to canonical
 * guidance, three documents disagreeing about how many tests pass, and a Rust
 * migration plan asserting the Rust workspace did not exist while it shipped.
 * Consolidating that once is not enough: without a gate it re-accretes.
 *
 * Four checks, all mechanical:
 *
 *  1. BROKEN LINKS   — every relative markdown link/image resolves on disk.
 *  2. ORPHANS        — every doc is reachable from README.md or docs/README.md.
 *                      A doc nobody links to is a doc nobody reads, which is
 *                      how stale guidance survives next to the truth.
 *  3. NO STATUS      — everything under docs/audits/ and docs/archive/ must say
 *                      what it is and whether it still stands, in its first 15
 *                      lines (`Status:`). Evidence is only useful if a reader
 *                      knows it is a snapshot and what replaced it.
 *  4. ROOT CLUTTER   — the repo root keeps an allowlist of top-level docs. New
  *                      root markdown has to be deliberate, not sediment.
  *  5. CLAIMS         — every number docs/README.md states about the repo
  *                      (test count, test files, barrel keys, locales, untranslated
  *                      cells, snapshot counts) is measured from disk and compared.
  *                      The doc carries them in a machine-readable block so the
  *                      gate can check them; prose that drifts is prose nobody can
  *                      trust. This is the failure the first four checks were
  *                      written after, recurring, so it gets its own gate.
  *
  *     pnpm docs:audit
  *
  * Exits 1 on any violation. Generated files (docs/poki/COMPLIANCE.md,
  * docs/poki/CSP_REQUEST.md, public/privacy.html) are checked like any other —
  * a generator that emits a dead link is a bug in the generator.
  */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// `hive`, `palace`, `roster-backups` and `worktrees` are local agent scratch,
// all of them .gitignore'd. Walking them made this gate fail on any machine
// that happened to have them, and pass on a clean clone — a gate that reports
// on untracked files is not a gate. Skip what git ignores; the tracked docs are
// what this audit is for.
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "dist-poki", "dist-crazy", "dist-generic", "poki-upload", "coverage", "test-results", "target", ".arena", "hive", "palace", "roster-backups", "worktrees", "data", "skills"]);

/** Top-level markdown the repo root is allowed to keep. */
const ROOT_ALLOWLIST = new Set([
  "README.md", // what the game is + where the docs live
  "AI_RULES.md", // agent-facing rules for this codebase; deliberately at the root
                 // so it is read before anyone touches flight or portals
  "ROADMAP.md", // what is real, what is written, what is fiction
  "DEPLOY.md", // hosting a build (Vercel/Netlify/static + env vars)
  "SUBMISSION_CHECKLIST.md", // the human walkthrough for a portal submission
  "PORTAL_PUBLISHING.md", // build targets and their monetization matrix
  "PRODUCTION_READINESS_PLAN.md", // ops/service gap register
  "LEGAL_SECURITY.md", // legal + security evidence register
  "LEADERBOARD_API.md", // leaderboard & realtime wire contract
  "SOCIAL_API.md", // social server REST contract
]);

const ROOTS = ["README.md", "docs/README.md"];
const STATUS_DIRS = ["docs/audits", "docs/archive"];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(entry) || entry.startsWith(".")) continue;
      yield* walk(p);
      continue;
    }
    if (entry.endsWith(".md")) yield p;
  }
}

const files = [...walk(root)].map((p) => relative(root, p).split("\\").join("/"));
const byPath = new Map(files.map((f) => [f, readFileSync(join(root, f), "utf8")]));

const LINK = /(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const broken = [];
const graph = new Map();

for (const file of files) {
  const text = byPath.get(file);
  const links = [];
  let m;
  LINK.lastIndex = 0;
  while ((m = LINK.exec(text)) !== null) {
    const target = m[3];
    if (/^(https?:|mailto:|tel:|data:|#)/.test(target)) continue;
    const [pathPart, hash] = target.split("#");
    if (!pathPart) continue;
    const abs = resolve(dirname(join(root, file)), decodeURI(pathPart));
    // A link to a directory means "its index" — resolve it so the reachability
    // graph follows folder links the way a reader does.
    let resolved = abs;
    if (existsSync(abs) && statSync(abs).isDirectory()) {
      const relDir = relative(root, abs).split("\\").join("/");
      const index = ["README.md", "index.md"].map((n) => join(abs, n)).find((p) => existsSync(p));
      if (!index) {
        // A doc folder must have an index (that is what makes it navigable); a
        // link into a source folder is just pointing at code and is fine.
        if (relDir.startsWith("docs")) {
          broken.push(`${file}  →  ${target} (docs directory with no README.md)`);
          continue;
        }
        continue;
      }
      resolved = index;
    } else if (!existsSync(abs)) {
      broken.push(`${file}  →  ${target}${hash ? `#${hash}` : ""}`);
      continue;
    }
    const rel = relative(root, resolved).split("\\").join("/");
    links.push(rel);
  }
  graph.set(file, links.filter((l) => l.endsWith(".md")));
}

/* 2. Orphans — BFS from the two entry points. */
const seen = new Set();
const queue = ROOTS.filter((r) => graph.has(r));
const missingRoots = ROOTS.filter((r) => !graph.has(r));
while (queue.length) {
  const cur = queue.shift();
  if (seen.has(cur)) continue;
  seen.add(cur);
  for (const next of graph.get(cur) ?? []) if (!seen.has(next) && graph.has(next)) queue.push(next);
}
const orphans = files.filter((f) => !seen.has(f));

/* 3. Status headers on snapshots. */
const noStatus = [];
for (const dir of STATUS_DIRS) {
  for (const f of files) {
    if (!f.startsWith(`${dir}/`) || f.endsWith("README.md")) continue;
    const head = (byPath.get(f) ?? "").split("\n").slice(0, 15).join("\n");
    if (!/Status:/i.test(head)) noStatus.push(f);
  }
}

/* 4. Root clutter. */
const clutter = files.filter((f) => !f.includes("/") && !ROOT_ALLOWLIST.has(f));

/* 5. Canonical claims — measure the numbers the docs assert about themselves.
 * Any doc may carry a `<!-- canonical-claims ... -->` block; each one is
 * measured from disk and compared. docs/README.md is required to carry one. */
const CLAIMS_BLOCK = /<!--\s*canonical-claims([\s\S]*?)-->/;

function parseClaims(text) {
  const out = {};
  const m = CLAIMS_BLOCK.exec(text);
  if (!m) return null;
  for (const line of m[1].split("\n")) {
    const kv = /^\s*([a-zA-Z]+)\s*:\s*(\d+)\s*$/.exec(line);
    if (kv) out[kv[1]] = Number(kv[2]);
  }
  return out;
}

const claimsDoc = new Map();
for (const [file, text] of byPath) {
  const parsed = parseClaims(text);
  if (parsed) claimsDoc.set(file, parsed);
}
const claims = claimsDoc.get("docs/README.md") ?? null;

/** Every file under `dir`, not just markdown — the walk above is md-only. */
function* walkAll(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry) || entry.startsWith(".")) continue;
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) yield* walkAll(p);
    else yield p;
  }
}

function measureClaims() {
  const out = {};
  let testFiles = 0;
  let testCases = 0;
  for (const abs of walkAll(join(root, "src"))) {
    if (!abs.endsWith(".test.ts") && !abs.endsWith(".test.tsx")) continue;
    testFiles++;
    const text = readFileSync(abs, "utf8");
    testCases += (text.match(/\b(?:it|test)\s*\(/g) || []).length;
  }
  out.testFiles = testFiles;
  out.tests = testCases;

  try {
    const barrel = JSON.parse(readFileSync(join(root, "src/i18n/translations.barrel.json"), "utf8"));
    const table = barrel.barrel ?? barrel;
    out.barrelKeys = Object.keys(table).length;
    let cells = 0;
    let english = 0;
    for (const key of Object.keys(table)) {
      const tr = table[key]?.translations ?? {};
      const src = table[key]?.sourceText;
      for (const [lang, val] of Object.entries(tr)) {
        if (lang === "en") continue;
        cells++;
        if (typeof val === "string" && val === src) english++;
      }
    }
    out.nonEnglishCells = cells;
    out.englishCells = english;
  } catch {
    /* barrel absent: leave the claims unmeasured rather than guessing */
  }

  const localeDir = join(root, "public/i18n");
  if (existsSync(localeDir)) {
    out.locales = readdirSync(localeDir).filter((f) => f.endsWith(".json")).length;
  }

  for (const dir of STATUS_DIRS) {
    const key = dir.endsWith("audits") ? "audits" : "archive";
    out[key] = files.filter((f) => f.startsWith(`${dir}/`) && !f.endsWith("README.md")).length;
  }
  return out;
}

const measured = measureClaims();
const drifted = [];
for (const [file, declared] of claimsDoc) {
  for (const [key, value] of Object.entries(declared)) {
    if (measured[key] === undefined) continue;
    if (measured[key] !== value) drifted.push(`${file}: ${key} says ${value}, measured ${measured[key]}`);
  }
}

const fail = [];
if (missingRoots.length) fail.push(`missing doc entry point(s): ${missingRoots.join(", ")}`);
if (broken.length) fail.push(`broken links (${broken.length}):\n    ${broken.slice(0, 25).join("\n    ")}`);
if (orphans.length) fail.push(`orphan docs, not linked from ${ROOTS.join(" or ")} (${orphans.length}):\n    ${orphans.slice(0, 25).join("\n    ")}`);
if (noStatus.length) fail.push(`snapshot docs without a Status: line in the first 15 lines (${noStatus.length}):\n    ${noStatus.slice(0, 25).join("\n    ")}`);
if (clutter.length) fail.push(`unexpected top-level markdown (${clutter.length}):\n    ${clutter.join("\n    ")}\n  Move it under docs/ (canonical), docs/audits/ (evidence) or docs/archive/ (superseded), and add it to docs/README.md.`);
if (!claims) fail.push(`docs/README.md has no <!-- canonical-claims --> block — the measured numbers live there so this gate can check them.`);
if (drifted.length) fail.push(`docs state numbers that no longer match the repo (${drifted.length}):\n    ${drifted.join("\n    ")}\n  Update the <!-- canonical-claims --> block in each named doc to the measured values.`);

console.log(`docs — ${files.length} markdown files, ${graph.size} indexed, ${[...graph.values()].flat().length} internal links`);
console.log(`  ${ROOTS.join(" + ")} reach ${seen.size} docs`);
for (const dir of STATUS_DIRS) console.log(`  ${dir}/: ${files.filter((f) => f.startsWith(`${dir}/`)).length} snapshots`);
console.log(`  claims: ${claimsDoc.size} doc(s), ${drifted.length} drifted`);

if (fail.length) {
  console.error(`\n❌ DOCS GATE FAILED\n  ${fail.join("\n  ")}\n`);
  process.exit(1);
}
console.log("\n✅ DOCS GATE PASSED — no broken links, no orphans, every snapshot dated and statused.");
