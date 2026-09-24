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
 *      `src/game/PokiNetlib.ts`, and that module reaches nothing self-hosted.
 *   3. The self-hosted transport (`src/game/Realtime.ts`) touches the Poki
 *      transport only as a *type* — never a runtime import — so a non-Poki
 *      bundle can never drag WebRTC signalling along with it.
 *   4. The Poki-only modules carry no self-hosted endpoints or storage keys.
 *
 * Run: node scripts/verify-isolation.mjs   (also part of `poki:preflight`)
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const failures = [];
const notes = [];

function walk(dir, filter) {
  const out = [];
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
const PLATFORM_STRINGS = [
  [/netlib/i, "netlib"],
  [/auds\.poki/i, "AUDS endpoint"],
  [/\bpoki\b/i, "Poki"],
  [/crazygames/i, "CrazyGames"],
];
const rustFiles = walk(path.join(ROOT, "rust"), (f) => /\.(rs|toml)$/.test(f));
for (const file of rustFiles) {
  const text = read(file);
  for (const [re, why] of PLATFORM_STRINGS) {
    const hit = re.exec(text);
    if (hit) {
      const line = text.slice(0, hit.index).split("\n").length;
      failures.push(`rust/: ${rel(file)}:${line} references ${why} ("${hit[0]}") — the Rust server is the platform-agnostic direct-build stack`);
    }
  }
}
notes.push(`1. rust/: ${rustFiles.length} source files, 0 platform-integration references`);

/* 2 — the P2P transport lives in exactly one module ------------------------ */
const srcFiles = walk(path.join(ROOT, "src"), (f) => f.endsWith(".ts") && !f.includes("__tests__"));
const netlibImporters = srcFiles.filter((f) => /from\s+["']@poki\/netlib["']/.test(read(f)));
const expected = ["src/game/PokiNetlib.ts"];
const unexpected = netlibImporters.map(rel).filter((p) => !expected.includes(p));
if (unexpected.length) {
  failures.push(`@poki/netlib imported outside the Poki transport module: ${unexpected.join(", ")}`);
}
if (!netlibImporters.map(rel).includes(expected[0])) {
  failures.push(`${expected[0]} no longer imports @poki/netlib — the Poki edition would lose P2P multiplayer`);
}
notes.push(`2. @poki/netlib imported by ${netlibImporters.map(rel).join(", ") || "nobody"}`);

/* 3 — no runtime import of the Poki transport from the self-hosted client --- */
const realtime = read(path.join(ROOT, "src/game/Realtime.ts"));
// Type positions are free (they erase at build time); *value* positions are not.
const RUNTIME_USE = [
  [/import\s+(?!type\b)[^;\n]*PokiNetlib/, "non-type import of the Poki transport"],
  [/new\s+PokiNetlibClient/, "construction of the Poki transport"],
  [/instanceof\s+PokiNetlibClient/, "instanceof check on the Poki transport"],
  [/extends\s+PokiNetlibClient/, "subclassing the Poki transport"],
  [/\bPokiNetlibClient\s*\(/, "call into the Poki transport"],
];
for (const [re, why] of RUNTIME_USE) {
  const hit = re.exec(realtime);
  if (hit) {
    const line = realtime.slice(0, hit.index).split("\n").length;
    failures.push(`src/game/Realtime.ts:${line} — ${why} ("${hit[0].trim()}"); non-Poki bundles must not pull WebRTC signalling`);
  }
}
const gameSrc = read(path.join(ROOT, "src/game/Game.ts"));
if (!/await import\(["']\.\/PokiNetlib["']\)/.test(gameSrc)) {
  failures.push('src/game/Game.ts no longer loads the Poki transport via `await import("./PokiNetlib")` — the P2P client would be bundled into every edition');
}
notes.push("3. Poki transport is type-only in Realtime.ts and dynamically imported in Game.ts");

/* 4 — Poki-only modules reach nothing self-hosted ------------------------- */
const POKI_MODULES = [
  "src/game/PokiNetlib.ts",
  "src/game/PokiMpUtils.ts",
  "src/game/edition.poki.ts",
  "src/sdk/auds.ts",
];
const SELF_HOSTED = [
  [/\/mp\/v1\//, "self-hosted multiplayer REST path"],
  [/sunbird-social/i, "self-hosted social service"],
  [/\bws:\/\//, "insecure WebSocket URL"],
  [/MULTIPLAYER_URL/, "self-hosted multiplayer env var"],
];
for (const mod of POKI_MODULES) {
  const text = read(path.join(ROOT, mod));
  for (const [re, why] of SELF_HOSTED) {
    const hit = re.exec(text);
    if (hit) {
      const line = text.slice(0, hit.index).split("\n").length;
      failures.push(`${mod}:${line} references ${why} ("${hit[0]}") — the Poki edition uses P2P + AUDS, never our own servers`);
    }
  }
}
notes.push(`4. ${POKI_MODULES.length} Poki-only modules, 0 self-hosted references`);

/* 5 — one game. No parallel stacks, no R3F/Zustand rewrite. ---------------- */
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
notes.push("5. one-game gate: no parallel Viral/ECS/R3F modules");

/* --------------------------------------------------------------- report -- */
for (const note of notes) console.log(`✓ ${note}`);
if (failures.length) {
  for (const f of failures) console.log(`✗ ${f}`);
  console.log(`\n✗ ISOLATION GATE FAILED — ${failures.length} finding(s).\n`);
  process.exit(1);
}
console.log("\n✅ ISOLATION GATE PASSED — Rust stays platform-agnostic, Poki stays P2P + AUDS.\n");
