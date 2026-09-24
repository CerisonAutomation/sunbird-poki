#!/usr/bin/env node
/**
 * The Inspector QA modules, run as one gate.
 *
 * The Inspector walks a build through a fixed set of modules before review:
 * Event Log, External Resources, Image Optimization, Scaling. Three of the four
 * have a local equivalent that reads the *shipping* folder rather than a dev
 * server, and this runs them in the order the Inspector presents them so a
 * submission can be checked in one command:
 *
 *   • folder shape / root index.html   -> verify-upload.mjs   (ROOT-01..10)
 *   • external resources              -> audit-zips.mjs      (no off-Poki hosts)
 *   • image optimization              -> verify-thumbnail.mjs (weight + contrast)
 *
 * Scaling is not here: it is a browser measurement, covered by `test:orientation`
 * (640x360 / 836x470 / 1031x580) and `test:mobile`, which need a renderer and so
 * stay in `pnpm gate` rather than in this static pass.
 *
 * Usage: pnpm build:poki && node scripts/verify-inspector-qa.mjs
 */
import { execFileSync } from "node:child_process";

const MODULES = [
  ["Event Log / folder shape", "node", ["scripts/verify-upload.mjs"]],
  ["External Resources", "node", ["scripts/audit-zips.mjs"]],
  ["Image Optimization", "node", ["scripts/verify-thumbnail.mjs"]],
];

let failed = 0;
for (const [module, cmd, args] of MODULES) {
  try {
    execFileSync(cmd, args, { stdio: "pipe" });
    console.log(`✓ ${module}`);
  } catch (error) {
    failed += 1;
    const tail = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim().split("\n").slice(-4).join(" / ");
    console.error(`✗ ${module}: ${tail}`);
  }
}

if (failed) {
  console.error(`\n❌ INSPECTOR QA FAILED — ${failed} of ${MODULES.length} modules`);
  process.exit(1);
}
console.log(`\n✅ INSPECTOR QA PASSED — ${MODULES.length} modules on the shipping folder`);
console.log("   Scaling is covered by `pnpm test:orientation` and `pnpm test:mobile` (browser-measured).\n");
