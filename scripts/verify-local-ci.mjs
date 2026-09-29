#!/usr/bin/env node
/**
 * local-ci — the CI gate, runnable without GitHub Actions.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every job on this repo's `main` currently aborts in 3–4 seconds with:
 *
 *   "The job was not started because recent account payments have failed or
 *    your spending limit needs to be increased."
 *
 * That is an account-level billing state, not a code problem, and it cannot be
 * fixed from inside a repository. It is also not merely inconvenient: while CI
 * is down, the guarantee CI was providing — "what is on the remote passed the
 * gate" — is simply absent. That is how three real Poki compliance defects
 * (GM-02/03/08) sat in the tree while the handoff reported a green pipeline.
 *
 * This script restores that guarantee locally. It runs the same checks in the
 * same order, and it is the one place that knows which CI job each step belongs
 * to, so the two cannot drift by accident.
 *
 * USAGE
 *   node scripts/verify-local-ci.mjs            # the fast gate (default)
 *   node scripts/verify-local-ci.mjs --full     # + browser suites (slow, ~40min)
 *   node scripts/verify-local-ci.mjs --list     # print the steps, run nothing
 *   node scripts/verify-local-ci.mjs --only=test,typecheck
 *
 * The fast gate is what belongs in a pre-push hook: it is the set of checks
 * that take under a minute and catch essentially every regression that would
 * turn a remote red. The browser suites are slow and CPU-bound, so they belong
 * in a deliberate run rather than on every push.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Each step names the CI job it stands in for, so when one goes red you know
 * which workflow to look at. `fast: true` means it belongs in the pre-push
 * gate; the browser suites are `fast: false` and only run under --full.
 */
const STEPS = [
  { name: "install",    job: "every job",                cmd: ["pnpm", "install", "--frozen-lockfile"], fast: false, pre: true },
  { name: "lint",       job: "verify",                   cmd: ["pnpm", "lint"], fast: true },
  { name: "ui-audit",   job: "verify",                   cmd: ["pnpm", "audit:ui"], fast: true },
  { name: "i18n",       job: "verify",                   cmd: ["pnpm", "i18n:audit"], fast: true },
  { name: "docs",       job: "verify",                   cmd: ["pnpm", "docs:audit"], fast: true },
  { name: "typecheck",  job: "verify",                   cmd: ["pnpm", "typecheck"], fast: true },
  { name: "test",       job: "verify",                   cmd: ["pnpm", "test"], fast: true },
  { name: "circular",   job: "verify-prod",              cmd: ["pnpm", "circular:check"], fast: true },
  { name: "prod-verify",job: "verify-prod",              cmd: ["pnpm", "verify:prod"], fast: true },
  { name: "build",      job: "verify (Vercel/PWA)",      cmd: ["pnpm", "build"], fast: false },
  { name: "build-poki", job: "portals + artifact",       cmd: ["pnpm", "build:poki"], fast: false },
  { name: "portals",    job: "portals",                  cmd: ["pnpm", "verify:portals"], fast: false },
  { name: "csp",        job: "portals",                  cmd: ["pnpm", "verify:csp"], fast: false },
  { name: "zips",       job: "portals",                  cmd: ["pnpm", "audit:zips"], fast: false },
  { name: "upload",     job: "portals + artifact",       cmd: ["pnpm", "verify:upload"], fast: false },
  { name: "thumbnail",  job: "portals",                  cmd: ["pnpm", "verify:thumbnail"], fast: false },
  { name: "isolation",  job: "portals",                  cmd: ["pnpm", "isolation:check"], fast: false },
  // Browser suites. SwiftShader rasterises on the CPU, so these are minutes
  // each, not seconds — which is exactly why they are not in the push hook.
  { name: "orientation",job: "orientation",              cmd: ["pnpm", "test:orientation"], fast: false, browser: true },
  { name: "mobile",     job: "mobile",                   cmd: ["pnpm", "test:mobile"], fast: false, browser: true },
  { name: "policy",     job: "policy",                   cmd: ["pnpm", "test:policy"], fast: false, browser: true },
  { name: "artifact",   job: "artifact",                 cmd: ["pnpm", "test:artifact"], fast: false, browser: true },
];

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const only = (() => {
  const i = args.indexOf("--only");
  return i === -1 ? null : new Set(args[i + 1].split(",").map((s) => s.trim()));
})();

if (has("--list")) {
  console.log("local-ci steps\n");
  for (const s of STEPS) {
    const tag = s.pre ? "pre " : s.fast ? "fast " : s.browser ? "slow " : "     ";
    console.log(`  ${tag} ${s.name.padEnd(11)} ${s.job.padEnd(22)} ${s.cmd.join(" ")}`);
  }
  console.log("\npre = runs before the fast gate only; fast = in the pre-push gate; slow = --full only");
  process.exit(0);
}

if (!existsSync(join(ROOT, "node_modules"))) {
  console.error("node_modules is missing — run `pnpm install` first.");
  process.exit(1);
}

const full = has("--full");
// `--full` implies the install/build steps; the fast gate assumes a tree that
// already has them, because re-installing on every push is its own problem.
let steps = only
  ? STEPS.filter((s) => only.has(s.name))
  : STEPS.filter((s) => (full ? true : s.fast) && !s.pre);

if (only) {
  const unknown = [...only].filter((n) => !STEPS.some((s) => s.name === n));
  if (unknown.length) {
    console.error(`unknown step(s): ${unknown.join(", ")}  (try --list)`);
    process.exit(1);
  }
}

const c = { dim: "\x1b[2m", red: "\x1b[31m", green: "\x1b[32m", bold: "\x1b[1m", off: "\x1b[0m" };
console.log(`${c.bold}local-ci${c.off} — ${steps.length} step(s)${full ? " (full)" : " (fast gate)"}`);
if (!full) console.log(`${c.dim}CI is down: GitHub Actions is refusing to start jobs on a billing failure.`);
console.log(`${c.dim}This runs the same checks locally so a green push means a green gate.${c.off}\n`);

const results = [];
for (const step of steps) {
  const started = process.hrtime.bigint();
  process.stdout.write(`  ${step.name.padEnd(12)} ${c.dim}${step.job.padEnd(22)}${c.off} `);
  const r = spawnSync(step.cmd[0], step.cmd.slice(1), { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  const ok = r.status === 0;
  results.push({ step, ok, ms, out: `${r.stdout ?? ""}${r.stderr ?? ""}` });
  console.log(`${ok ? `${c.green}pass${c.off}` : `${c.red}FAIL${c.off}`} ${c.dim}${(ms / 1000).toFixed(1)}s${c.off}`);
  if (!ok) {
    // Print only the tail: a failing step's full output can bury the reason in
    // build noise, and the reason is always at the end.
    const tail = results.at(-1).out.split("\n").filter((l) => l.trim()).slice(-25).join("\n");
    console.log(`\n${c.red}--- ${step.name} (${step.cmd.join(" ")}) ---${c.off}\n${tail}\n`);
  }
}

const failed = results.filter((r) => !r.ok);
const total = results.reduce((s, r) => s + r.ms, 0) / 1000;
console.log(`\n${c.bold}${results.length - failed.length}/${results.length} passed${c.off} in ${total.toFixed(1)}s`);

if (failed.length) {
  console.log(`\n${c.red}not pushing:${c.off} ${failed.map((f) => f.step.name).join(", ")}`);
  console.log(`${c.dim}These are the same checks .github/workflows/ci.yml runs. Fix them, or if the`);
  console.log(`failure is environmental (browsers, network), re-run with --only= to isolate a step.${c.off}`);
  process.exit(1);
}
console.log(`${c.green}gate green${c.off}${c.dim} — this is what CI would have said.${c.off}`);
