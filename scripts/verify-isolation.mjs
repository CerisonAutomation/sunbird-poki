#!/usr/bin/env node
/**
 * Source-level isolation check: "Rust stays Rust, Poki stays Poki".
 *
 * The build-time gates (`verify:portals`, `audit:zips`, `verify:upload`) prove
 * what ends up in the shipped bundles. This script proves it at the source
 * level, where the mistakes actually happen — a stray import or a copied
 * constant is what quietly welds two editions together months before anyone
 * notices a marker in a zip.
 *
 * The contract it enforces:
 *
 *   1. `rust/` (the self-hosted, authoritative, direct-build stack) names no
 *      platform integration at all — no netlib, no AUDS, no Poki, no
 *      CrazyGames. It is platform-agnostic infrastructure.
 *   2. `@poki/netlib` (the P2P transport) is imported by exactly one module,
 *      `src/sdk/PokiNetlib.ts`, and that module reaches nothing self-hosted.
 *   3. The self-hosted transport (`src/game/Realtime.ts`) touches the Poki
 *      transport only as a *type* — never a runtime import — so a non-Poki
 *      bundle can never drag WebRTC signalling along with it.
 *   4. The Poki-only modules carry no self-hosted endpoints or storage keys.
 *
 * Run: node scripts/verify-isolation.mjs   (also part of `poki:preflight`)
 *
 * NOT HERE, ON PURPOSE: the rule that only `src/sdk/` may touch the Poki SDK
 * global. That one is enforced in `src/sdk/__tests__/poki-canon.test.ts`
 * ("SDK access is confined to src/sdk/"), which walks the tree rather than
 * checking a file list, so it cannot go stale when a module moves. It needs
 * the same character-level comment/string stripping this file does not have,
 * and duplicating it here would be two gates to keep in sync.
 *
 * Two things this file used to get wrong, kept here so they are not
 * reintroduced:
 *
 *   · It CRASHED (unhandled ENOENT) on a missing input. `rust/` and
 *     `src/game/edition.poki.ts` do not exist in this Poki-only fork — the Rust
 *     server lives in the parent monorepo (README.md) and the three per-portal
 *     edition modules were consolidated into `src/game/edition.ts`. A gate that
 *     dies with a stack trace is not a gate; it is an outage with extra steps.
 *   · It printed "✓ … 0 references" UNCONDITIONALLY, above its own ✗ lines, so
 *     a reader skimming the ✓ output concluded the opposite of the truth, and
 *     the "0" was a hardcoded literal rather than a measurement. Every note is
 *     now computed from the result and only earns a ✓ when its check passed.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const failures = [];
const results = [];
let mark = 0;

/** Start check `n`. Its note is set later with `end`, and it earns a ✓ only
 *  if it recorded no failures. */
function begin(n) {
  mark = failures.length;
  results.push({ n });
}
function end(note) {
  const r = results[results.length - 1];
  r.note = note;
  r.failed = failures.length > mark;
}

function walk(dir, filter) {
  const out = [];
  // A missing root is a fact about this checkout, not a crash: `rust/` is the
  // parent monorepo's. Report its absence; do not throw.
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (entry === "node_modules" || entry === "target" || entry === ".git") continue;
    if (statSync(full).isDirectory()) out.push(...walk(full, filter));
    else if (filter(full)) out.push(full);
  }
  return out;
}

function rel(p) {
  return path.relative(ROOT, p);
}

function read(p) {
  return readFileSync(p, "utf8");
}

/* 1 — the Rust stack is platform-agnostic ---------------------------------- */
begin(1);
const PLATFORM_STRINGS = [
  [/netlib/i, "netlib"],
  [/auds\.poki/i, "AUDS endpoint"],
  [/\bpoki\b/i, "Poki"],
  [/crazygames/i, "CrazyGames"],
];
const rustRoot = path.join(ROOT, "rust");
const rustFiles = walk(rustRoot, (f) => /\.(rs|toml)$/.test(f));
let rustHits = 0;
for (const file of rustFiles) {
  const text = read(file);
  for (const [re, why] of PLATFORM_STRINGS) {
    const hit = re.exec(text);
    if (hit) {
      const line = text.slice(0, hit.index).split("\n").length;
      rustHits++;
      failures.push(`rust/: ${rel(file)}:${line} references ${why} ("${hit[0]}") — the Rust server is the platform-agnostic direct-build stack`);
    }
  }
}
end(
  existsSync(rustRoot)
    ? `rust/: ${rustFiles.length} source files scanned, ${rustHits} platform-integration reference(s)`
    : `rust/: absent in this checkout (it is the parent monorepo's — README.md) — nothing to scan`,
);

/* 2 — the P2P transport lives in exactly one module ------------------------ */
begin(2);
const srcFiles = walk(path.join(ROOT, "src"), (f) => f.endsWith(".ts") && !f.includes("__tests__"));
const netlibImporters = srcFiles.filter((f) => /from\s+["']@poki\/netlib["']/.test(read(f)));
const expected = ["src/sdk/PokiNetlib.ts"];
const unexpected = netlibImporters.map(rel).filter((p) => !expected.includes(p));
if (unexpected.length) {
  failures.push(`@poki/netlib imported outside the Poki transport module: ${unexpected.join(", ")}`);
}
if (!netlibImporters.map(rel).includes(expected[0])) {
  failures.push(`${expected[0]} no longer imports @poki/netlib — the Poki edition would lose P2P multiplayer`);
}
end(`@poki/netlib imported by ${netlibImporters.length} module(s): ${netlibImporters.map(rel).join(", ") || "nobody"}`);

/* 3 — no runtime import of the Poki transport from the self-hosted client --- */
begin(3);
const realtime = read(path.join(ROOT, "src/game/Realtime.ts"));
// Type positions are free (they erase at build time); *value* positions are not.
//
// The import clause is matched across NEWLINES. The previous pattern used
// `[^;\n]*`, which cannot cross a line break, so a prettier-formatted
// multi-line import — entirely plausible in a lint-enforced repo — welded
// WebRTC signalling into every non-Poki edition while this gate stayed green.
// An import counts as a runtime import if it is not type-only, where
// "type-only" means the statement opens with `import type` or EVERY specifier
// in the clause is marked `type`.
// Imports are anchored to the start of a line (the `m` flag) so the word
// "import" inside a comment — and this file's own header comment says "loaded
// only via dynamic import from Game.makeNet()" — cannot open a match. The
// clause is bounded by `[^;]` rather than `[^;\n]`: bounding it by the
// semicolon is what lets a prettier-formatted MULTI-LINE import be seen at all,
// while still confining the match to one statement.
for (const m of realtime.matchAll(/^\s*import\s+([^;]*?)\s*from\s*["']([^"']+)["']/gm)) {
  if (!/PokiNetlib/.test(m[1])) continue;
  const specs = m[1]
    .replace(/[{}]/g, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const typeOnly = /^import\s+type\b/.test(m[0]) || (specs.length > 0 && specs.every((s) => /^type\s/.test(s)));
  if (!typeOnly) {
    const line = realtime.slice(0, m.index).split("\n").length;
    failures.push(
      `src/game/Realtime.ts:${line} — non-type import of the Poki transport (${m[0].replace(/\s+/g, " ").slice(0, 80)}); non-Poki bundles must not pull WebRTC signalling`,
    );
  }
}
// A re-export is just as much a runtime edge as an import: `export { X } from
// "../sdk/PokiNetlib"` puts the class in the module graph whether or not this file
// imported it. The old pattern missed those entirely.
for (const m of realtime.matchAll(/^\s*export\s+([^;]*?)\s*from\s*["']([^"']*PokiNetlib[^"']*)["']/gm)) {
  const line = realtime.slice(0, m.index).split("\n").length;
  failures.push(
    `src/game/Realtime.ts:${line} — re-export of the Poki transport (${m[0].replace(/\s+/g, " ").slice(0, 80)}); non-Poki bundles must not pull WebRTC signalling`,
  );
}
// Value-position uses of the transport class, independent of how it was imported.
const RUNTIME_USE = [
  [/new\s+PokiNetlibClient/, "construction of the Poki transport"],
  [/instanceof\s+PokiNetlibClient/, "instanceof check on the Poki transport"],
  [/extends\s+PokiNetlibClient/, "subclassing the Poki transport"],
  [/\bPokiNetlibClient\s*\(/, "call into the Poki transport"],
];
let valueHits = 0;
for (const [re, why] of RUNTIME_USE) {
  const hit = re.exec(realtime);
  if (hit) {
    const line = realtime.slice(0, hit.index).split("\n").length;
    valueHits++;
    failures.push(`src/game/Realtime.ts:${line} — ${why} ("${hit[0].trim()}"); non-Poki bundles must not pull WebRTC signalling`);
  }
}
const gameSrc = read(path.join(ROOT, "src/game/Game.ts"));
if (!/await import\(["']\.\.\/sdk\/PokiNetlib["']\)/.test(gameSrc)) {
  failures.push('src/game/Game.ts no longer loads the Poki transport via `await import("../sdk/PokiNetlib")` — the P2P client would be bundled into every edition');
}
end(
  `Poki transport is ${valueHits === 0 ? "type-only" : `used at runtime (${valueHits} site(s))`} in Realtime.ts and dynamically imported in Game.ts`,
);

/* 4 — Poki-only modules reach nothing self-hosted ------------------------- */
begin(4);
const POKI_MODULES = [
  "src/sdk/PokiNetlib.ts",
  "src/sdk/PokiMpUtils.ts",
  // Was `src/game/edition.poki.ts`. The three per-portal edition modules were
  // consolidated into one `edition.ts` in this Poki-only fork, so listing the
  // old name made this check read a file that no longer exists.
  "src/game/edition.ts",
  "src/sdk/auds.ts",
];
const SELF_HOSTED = [
  [/\/mp\/v1\//, "self-hosted multiplayer REST path"],
  [/sunbird-social/i, "self-hosted social service"],
  [/\bws:\/\//, "insecure WebSocket URL"],
  [/MULTIPLAYER_URL/, "self-hosted multiplayer env var"],
];
let selfHostedHits = 0;
let scanned = 0;
for (const mod of POKI_MODULES) {
  if (!existsSync(path.join(ROOT, mod))) {
    failures.push(`${mod} is missing — the Poki-only module list is stale, so this check is not covering what it claims`);
    continue;
  }
  scanned++;
  const text = read(path.join(ROOT, mod));
  for (const [re, why] of SELF_HOSTED) {
    const hit = re.exec(text);
    if (hit) {
      const line = text.slice(0, hit.index).split("\n").length;
      selfHostedHits++;
      failures.push(`${mod}:${line} references ${why} ("${hit[0]}") — the Poki edition uses P2P + AUDS, never our own servers`);
    }
  }
}
end(`${scanned}/${POKI_MODULES.length} Poki-only modules scanned, ${selfHostedHits} self-hosted reference(s)`);

/* 5 — one game. No parallel stacks, no R3F/Zustand rewrite. ---------------- */
begin(5);
const FORBIDDEN_MODULES = [
  ["src/game/Viral.ts", "Moments.ts (clip table + ClipLedger)"],
  ["src/game/ViralEvents.ts", "Funnel.ts (viral event schema)"],
  ["src/game/AdaptiveDifficulty.ts", "Engagement.ts (tuneDifficulty on FlowTuner)"],
  ["src/game/ClipCamera.ts", "CameraRig.ts (pulseClip / clipPose)"],
  ["src/game/OneMoreRun.ts", "Moments.ts (pickCta)"],
  ["src/game/PackBalance.ts", "MassRace.ts (applyPackCatchup)"],
  ["src/game/Haptics.ts", "Moments.ts haptic patterns + Game.haptic()"],
  ["src/game/Game.tsx", "Game.ts (imperative Three loop, not R3F)"],
  ["src/game/GameScene.tsx", "Game.ts"],
  ["src/ui/HUD.tsx", "src/game/HUD.ts"],
];
for (const [file, instead] of FORBIDDEN_MODULES) {
  if (existsSync(path.join(ROOT, file))) {
    failures.push(`${file} exists — that is a second copy of a job already owned by ${instead}. Enhance the existing module.`);
  }
}
for (const dir of ["src/game/ecs", "src/game/store", "src/game/entities"]) {
  if (existsSync(path.join(ROOT, dir))) {
    failures.push(`${dir}/ exists — Sunbird is vanilla Three + Game.ts, not an R3F/Zustand/ECS rewrite`);
  }
}
const pkg = JSON.parse(read(path.join(ROOT, "package.json")));
const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
for (const dep of ["zustand", "@react-three/fiber", "@react-three/drei"]) {
  if (allDeps[dep]) {
    failures.push(`package.json depends on ${dep} — that is the R3F/Zustand template, not this Poki game`);
  }
}
// Phaser and Poki's Phaser 3 plugin. Poki publishes an engine plugin per
// engine; the Phaser one is a `Phaser.Game` scene plugin whose whole API is
// `scene.plugins.get('poki')`. Sunbird is Three.js — an imperative `Game.ts`
// loop with no scene manager — so there is nothing for it to attach to. Its
// only real function is injecting and initialising the Poki SDK
// asynchronously, which `src/sdk/platform.ts` already does directly and on
// purpose (a static remote <script> fails the portal zip audit).
//
// It is listed here because it is an easy, plausible-looking install: the
// documentation page for it is the first result for "Poki SDK", and adding it
// would be pure bundle cost against a size-gated build. Banned rather than
// merely discouraged.
for (const dep of ["phaser", "@poki/phaser-3", "@poki/cocos", "@poki/godot", "@poki/defold"]) {
  if (allDeps[dep]) {
    failures.push(
      `package.json depends on ${dep} — that is an engine plugin for a different engine; Sunbird is Three.js and drives the Poki SDK through src/sdk/`,
    );
  }
}
end(`one-game gate: ${FORBIDDEN_MODULES.length} parallel-stack modules absent, no R3F/Zustand dependency`);

/* --------------------------------------------------------------- report -- */
// A ✓ is only ever printed for a check that passed. Previously every note was
// pushed unconditionally and printed with a ✓ ABOVE the ✗ lines, so a failing
// run read as a pass to anyone skimming it.
for (const r of results) {
  if (!r.note) continue;
  if (r.failed) console.log(`· ${r.n}. ${r.note}  ← FAILED, see below`);
  else console.log(`✓ ${r.n}. ${r.note}`);
}
if (failures.length) {
  for (const f of failures) console.log(`✗ ${f}`);
  console.log(`\n✗ ISOLATION GATE FAILED — ${failures.length} finding(s).\n`);
  process.exit(1);
}
console.log("\n✅ ISOLATION GATE PASSED — Rust stays platform-agnostic, Poki stays P2P + AUDS.\n");
