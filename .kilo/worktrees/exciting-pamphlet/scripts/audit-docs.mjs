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
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "dist-poki", "dist-crazy", "dist-generic", "poki-upload", "coverage", "test-results", "target", ".arena"]);

/** Top-level markdown the repo root is allowed to keep. */
const ROOT_ALLOWLIST = new Set([
  "README.md", // what the game is + where the docs live
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

const fail = [];
if (missingRoots.length) fail.push(`missing doc entry point(s): ${missingRoots.join(", ")}`);
if (broken.length) fail.push(`broken links (${broken.length}):\n    ${broken.slice(0, 25).join("\n    ")}`);
if (orphans.length) fail.push(`orphan docs, not linked from ${ROOTS.join(" or ")} (${orphans.length}):\n    ${orphans.slice(0, 25).join("\n    ")}`);
if (noStatus.length) fail.push(`snapshot docs without a Status: line in the first 15 lines (${noStatus.length}):\n    ${noStatus.slice(0, 25).join("\n    ")}`);
if (clutter.length) fail.push(`unexpected top-level markdown (${clutter.length}):\n    ${clutter.join("\n    ")}\n  Move it under docs/ (canonical), docs/audits/ (evidence) or docs/archive/ (superseded), and add it to docs/README.md.`);

console.log(`docs — ${files.length} markdown files, ${graph.size} indexed, ${[...graph.values()].flat().length} internal links`);
console.log(`  ${ROOTS.join(" + ")} reach ${seen.size} docs`);
for (const dir of STATUS_DIRS) console.log(`  ${dir}/: ${files.filter((f) => f.startsWith(`${dir}/`)).length} snapshots`);

if (fail.length) {
  console.error(`\n❌ DOCS GATE FAILED\n  ${fail.join("\n  ")}\n`);
  process.exit(1);
}
console.log("\n✅ DOCS GATE PASSED — no broken links, no orphans, every snapshot dated and statused.");
