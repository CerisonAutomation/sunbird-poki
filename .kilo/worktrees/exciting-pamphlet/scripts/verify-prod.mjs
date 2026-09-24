#!/usr/bin/env node
/**
 * "Autoperfect production mode" — one command that enforces the production
 * bar, not just the build bar. Runs the full gate (lint → typecheck → tests →
 * build), then a production-readiness audit:
 *
 *   1. Debug artifacts  — shipped client code must carry no `console.log` /
 *      `console.warn` / `console.info`, `debugger`, TODO/FIXME, `@ts-ignore`,
 *      or `eslint-disable`. (Observability `console.error` and the gated
 *      telemetry `console.debug` are allowed.)
 *   2. Determinism      — enforced by the deterministic-sim suite in `npm test`
 *      (same seed ⇒ bit-identical physics, terrain and sunflower pads). A
 *      non-deterministic change can never pass the gate silently.
 *   3. Performance budget — total JS and largest single bundle must stay under
 *      a hard cap, so a stray import can't bloat the shipped payload unnoticed.
 *
 * Exit 0 = production ready. Exit 1 = a concrete, actionable failure list.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const SRC = join(root, "src");
const DIST = join(root, "dist");

// Hard budgets (bytes, raw). Tune deliberately; raise only with a reason.
const MAX_TOTAL_JS = 2_500_000; // 2.5 MB
const MAX_LARGEST_JS = 1_500_000; // 1.5 MB

// Coverage: a *ratchet*, not a blanket bar. A naive "80% everywhere" gate would
// permanently block PRs on this project (the three.js rendering/GL/DOM layer is
// not unit-testable — Game, HUD, Sky, Trail, ParticleFX, MenuSky, Weather,
// Collectibles, Racer, Ghost, Input, Audio, CameraRig, LivingBackground, Fx,
// FinishGate, Leaderboard, Social, Squad, Payments, platform — and drags the
// total down). Instead we enforce the two things that actually matter:
//   (a) every *unit-testable* module (the correctness-critical "source of
//       truth" — determinism, persistence-adjacent, progression, economy,
//       events, and the viral/experiment codec) stays above its own floor, so
//       a future edit can't silently drop a module's coverage, and
//   (b) the *total* coverage can never fall below its committed floor — it
//       only ratchets upward as tests accumulate.
//
// Each floor sits a few points under today's measured coverage so a one-line
// change can't flake the gate, while deleting a test file or gutting a module
// trips it immediately.
const MODULE_FLOORS = {
  "Achievements.ts": 95,
  "Campaign.ts": 95,
  "Challenges.ts": 78,
  "Economy.ts": 95,
  "Engagement.ts": 88,
  "Events.ts": 95,
  "Experiments.ts": 95,
  "FirstFlight.ts": 95,
  "Mastery.ts": 95,
  "Missions.ts": 82,
  "Modes.ts": 95,
  "PowerUps.ts": 88,
  "RoomInvite.ts": 88,
  "SeasonPass.ts": 82,
  "Surprises.ts": 90,
  "Tournaments.ts": 92,
  "math.ts": 82,
  "pvp.ts": 90,
  "season.ts": 90,
};
const TOTAL_LINES_FLOOR = 18; // current 18.02%, ratcheted up over time

const BANNED = [
  { re: /\bconsole\.(log|warn|info)\s*\(/, label: "console.log/warn/info" },
  { re: /^\s*debugger\s*;?\s*(?:\/\/.*)?$/, label: "debugger statement" },
  { re: /\bTODO\b|\bFIXME\b|\bXXX\b/, label: "TODO/FIXME/XXX" },
  { re: /@ts-ignore/, label: "@ts-ignore" },
  { re: /eslint-disable/, label: "eslint-disable" },
];

function fail(msg) {
  console.error(`\n❌ PRODUCTION GATE FAILED\n${msg}\n`);
  process.exit(1);
}

/* 0. The standard gate, fail-fast. */
const run = (cmd, args) => {
  console.log(`\n▶ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { cwd: root, stdio: "inherit" });
};

try {
  run("npm", ["run", "lint"]);
  run("npm", ["run", "typecheck"]);
  run("npm", ["run", "test"]);
  run("npm", ["run", "build:vercel"]);
} catch {
  fail("A standard gate (lint/typecheck/test/build) failed. Fix it before the audit.");
}

/* 2. Coverage ratchet — parse vitest's json-summary and enforce the floors. */
let coveragePct = 0;
try {
  run("npm", ["run", "test:coverage"]);
  const summaryPath = join(root, "coverage", "coverage-summary.json");
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  const totalPct = summary.total?.lines?.pct ?? 0;
  coveragePct = totalPct;
  if (totalPct < TOTAL_LINES_FLOOR) {
    fail(`Total line coverage ${totalPct.toFixed(2)}% regressed below the committed floor of ${TOTAL_LINES_FLOOR}%.`);
  }
  const byBasename = new Map();
  for (const [key, data] of Object.entries(summary)) {
    if (key === "total") continue;
    const base = key.split("/").pop();
    if (base && base.endsWith(".ts")) byBasename.set(base, data);
  }
  const belowFloor = [];
  for (const [file, floor] of Object.entries(MODULE_FLOORS)) {
    const data = byBasename.get(file);
    const pct = data?.lines?.pct ?? 0;
    if (pct < floor) belowFloor.push(`${file}: ${pct.toFixed(1)}% < ${floor}%`);
  }
  if (belowFloor.length) {
    fail(`Module coverage regressed below its floor:\n${belowFloor.join("\n")}`);
  }
} catch (e) {
  fail(`Coverage gate could not run: ${e instanceof Error ? e.message : e}`);
}

/* 3. Debug-artifact audit over shipped client code. */
const violations = [];
function auditDir(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      auditDir(p);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue;
    const text = readFileSync(p, "utf8");
    const rel = relative(root, p);
    text.split("\n").forEach((line, i) => {
      for (const rule of BANNED) {
        if (rule.re.test(line)) {
          violations.push(`${rel}:${i + 1}  ${rule.label}  →  ${line.trim().slice(0, 90)}`);
        }
      }
    });
  }
}
auditDir(SRC);
if (violations.length) {
  fail(`Debug artifacts found in shipped client code:\n${violations.join("\n")}`);
}

/* 4. Performance budget. */
const jsFiles = [];
(function collect(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) collect(p);
    else if (/\.js$/.test(entry)) jsFiles.push({ p, size: st.size });
  }
})(DIST);

const totalJs = jsFiles.reduce((a, b) => a + b.size, 0);
const largest = jsFiles.reduce((a, b) => (b.size > a.size ? b : a), { size: 0 });
if (totalJs > MAX_TOTAL_JS) {
  fail(`Total JS ${(totalJs / 1e6).toFixed(2)} MB exceeds ${(MAX_TOTAL_JS / 1e6).toFixed(2)} MB budget.`);
}
if (largest.size > MAX_LARGEST_JS) {
  fail(`Largest bundle ${(largest.size / 1e6).toFixed(2)} MB exceeds ${(MAX_LARGEST_JS / 1e6).toFixed(2)} MB budget.`);
}

console.log("\n─────────────────────────────────────────────");
console.log("✅ PRODUCTION READY");
console.log(`   debug artifacts : clean`);
console.log(`   determinism     : enforced by deterministic-sim suite (npm test)`);
console.log(`   coverage        : total ${coveragePct.toFixed(1)}% + ${Object.keys(MODULE_FLOORS).length} module floors`);
console.log(`   JS total        : ${(totalJs / 1e6).toFixed(2)} MB / ${(MAX_TOTAL_JS / 1e6).toFixed(2)} MB`);
console.log(`   JS largest      : ${(largest.size / 1e6).toFixed(2)} MB / ${(MAX_LARGEST_JS / 1e6).toFixed(2)} MB`);
console.log("─────────────────────────────────────────────\n");
