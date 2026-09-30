#!/usr/bin/env node
/**
 * install-git-hooks — put the local gate in front of `git push`.
 *
 * The point is not convenience. GitHub Actions is currently refusing to start
 * any job on this account, so "CI will catch it" is not a claim anyone can
 * make right now. Three real Poki compliance defects sat in the tree for the
 * duration of that outage. A pre-push hook puts the same checks between the
 * working tree and the remote, which restores the guarantee for the one thing
 * that matters: a green push now means a green gate.
 *
 *   node scripts/install-git-hooks.mjs           install
 *   node scripts/install-git-hooks.mjs --remove  uninstall
 *
 * The hook is opt-out: SKIP_LOCAL_CI=1 git push … skips it, for the case where
 * you are pushing a WIP branch or the tree is mid-change and you know why.
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOOKS = join(ROOT, ".git", "hooks");
const HOOK = join(HOOKS, "pre-push");
const MARKER = "# sunbird-local-ci";

const HOOK_BODY = `#!/bin/sh
${MARKER}
# Installed by scripts/install-git-hooks.mjs. Remove with:
#   node scripts/install-git-hooks.mjs --remove
#
# GitHub Actions cannot run on this account right now (billing), so this hook
# runs the same gate locally before anything reaches the remote. Skip with
# SKIP_LOCAL_CI=1 when you are deliberately pushing a work-in-progress branch.

if [ "$SKIP_LOCAL_CI" = "1" ]; then
  echo "pre-push: SKIP_LOCAL_CI=1 — gate skipped"
  exit 0
fi

# The fast gate only. The browser suites (pnpm gate:local:full) take tens of minutes
# and are CPU-bound; putting them on every push would make people bypass the
# hook, which defeats the point. Run those deliberately.
if command -v pnpm >/dev/null 2>&1; then
  pnpm gate:local || exit 1
else
  echo "pre-push: pnpm not found — gate skipped. Install pnpm to enforce it." >&2
fi
`;

if (process.argv.includes("--remove")) {
  if (!existsSync(HOOK)) {
    console.log("no pre-push hook installed.");
  } else if (readFileSync(HOOK, "utf8").includes(MARKER)) {
    rmSync(HOOK);
    console.log("removed pre-push hook.");
  } else {
    console.log("pre-push hook exists but is not ours — left alone.");
  }
  process.exit(0);
}

mkdirSync(HOOKS, { recursive: true });

if (existsSync(HOOK)) {
  const current = readFileSync(HOOK, "utf8");
  if (current.includes(MARKER)) {
    writeFileSync(HOOK, HOOK_BODY);
    chmodSync(HOOK, 0o755);
    console.log("pre-push hook already installed — refreshed.");
    process.exit(0);
  }
  console.error("a pre-push hook already exists and is not ours. Refusing to overwrite it.");
  console.error(`  ${HOOK}`);
  process.exit(1);
}

writeFileSync(HOOK, HOOK_BODY);
chmodSync(HOOK, 0o755);
console.log("installed pre-push hook.");
console.log("");
console.log("  A push now runs:  pnpm ci        (lint · audit:ui · i18n · docs · typecheck · test · circular · verify:prod)");
console.log("  To push anyway:   SKIP_LOCAL_CI=1 git push");
console.log("  Full gate:        pnpm gate:local:full   (+ builds, portal checks, browser suites)");
console.log("  To uninstall:     node scripts/install-git-hooks.mjs --remove");
