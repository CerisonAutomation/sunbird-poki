/**
 * CSP cross-check — the *built* Poki bundle against the host list we ask Poki to
 * allow (rules `REQ-69` and `REQ-66`).
 *
 * Why this exists: the declared host table in `legal.edition.poki.ts` and the
 * generated `docs/poki/CSP_REQUEST.md` are already one list, and a test pins them
 * to the deployed policy header. What nothing checked is the fourth copy — what
 * the shipped bytes actually reach for. A host in the bundle that is not in the
 * request is blocked by the portal CSP at runtime, and it fails in the worst
 * possible way: the game boots, the SDK initialises, the UI looks healthy, and
 * boards, rooms and share codes silently never arrive.
 *
 * Three directions, all of them cheap:
 *
 *   1. every external origin in `dist-poki/` is either declared or an explicit
 *      reference-only string (a namespace identifier, a doc link inside a library
 *      warning) — otherwise the CSP request is missing a host;
 *   2. every declared host is actually used by the bundle — otherwise we are
 *      asking a reviewer to allow a host the game never touches, which reads as an
 *      over-broad request and slows the review;
 *   3. every declared host reached `docs/poki/CSP_REQUEST.md` — otherwise someone
 *      edited the host table and did not run `pnpm gen-csp`.
 *
 *     pnpm verify:csp        # after pnpm build:poki / build:portals
 *
 * Wired into `pnpm verify:portals`, so both `pnpm gate` and `pnpm poki:preflight`
 * run it against a fresh build. The scan is exported so
 * `src/game/__tests__/csp-crosscheck.test.ts` can prove it bites.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { LEGAL_EDITION } from "../src/game/legal.edition.poki";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Text formats that can carry a URL the browser would then act on. */
const SCANNED_EXTENSIONS = new Set([".html", ".js", ".mjs", ".cjs", ".css", ".json", ".svg"]);

/**
 * Files that are policy prose rather than the app. `privacy.html` names every host
 * inside a sentence a player reads, so counting it would let direction 2 pass even
 * if the game stopped using a host entirely.
 */
const PROSE_FILES = new Set(["privacy.html"]);

/**
 * Origins that appear in the bundle but are never requested: an `xmlns` value is a
 * name, and a documentation URL inside a library's warning string is prose. Each
 * entry has to say why, because "it was noise" is how a real host gets waved
 * through by accident. A Poki, Netlib or policy host must never appear here —
 * `csp-crosscheck.test.ts` fails if one does.
 */
export const REFERENCE_ONLY = new Map<string, string>([
  ["www.w3.org", "SVG/XML namespace identifiers — a name, never fetched"],
  ["react.dev", "documentation link inside React's minified error-message builder"],
  ["jcgt.org", "paper citation in a three.js shader comment"],
]);

/**
 * Any scheme-qualified host: `https://`, `wss://`, and the ICE forms `stun:` and
 * `turns:` which take no `//`. The Poki edition uses all four — the SDK script,
 * Netlib signalling, AUDS, and the STUN/TURN relay candidates.
 *
 * The lookbehind is load-bearing. Minified bundles are full of words that *end* in
 * a scheme: `numSunLightShadows:C.sunShadowMap.length` contains `ws:` and
 * `return:t.flatMap(...)` contains `turn:`. Requiring the scheme to start a token
 * drops both, while every real origin — quoted, parenthesised or in an attribute —
 * still matches. The trailing `\.[a-z]{2,}` keeps the capture a hostname rather
 * than a property chain, and the label group is `*` not `+` so two-label hosts
 * (`poki.com`, `react.dev`) can never hide behind a short name.
 */
const ORIGIN =
  /(?<![A-Za-z0-9_$])(?:https?|wss?|stuns?|turns?|ftps?):(?:\/\/)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.[a-z]{2,})/gi;

/** Protocol-relative references (`src="//host/…"`) carry no scheme to match. */
const PROTOCOL_RELATIVE = /(?:src|href)=["']\/\/([a-z0-9.-]+\.[a-z]{2,})/gi;

/** Every external origin in one blob of text, lower-cased, in order of appearance. */
export function originsIn(text: string): string[] {
  const hosts: string[] = [];
  for (const pattern of [ORIGIN, PROTOCOL_RELATIVE]) {
    for (const match of text.matchAll(pattern)) hosts.push(match[1]!.toLowerCase());
  }
  return hosts;
}

export type DeclaredHost = { host: string; purpose: string; directive: string };

export type CrossCheck = {
  scannedFiles: number;
  /** Declared hosts the bundle really uses. */
  used: string[];
  /** Origins found in the bundle that are prose/identifiers, not requests. */
  referenceOnly: string[];
  /** In the bundle, not in the request — the portal CSP would block these. */
  undeclared: { host: string; files: string[] }[];
  /** In the request, not in the bundle — dead weight a reviewer has to read. */
  unused: string[];
  /** Declared but missing from the generated submission document. */
  missingFromRequest: string[];
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SCANNED_EXTENSIONS.has(extname(entry).toLowerCase())) out.push(full);
  }
  return out;
}

/** Compare a built edition against the list we intend to submit. */
export function crossCheckBundle(options: {
  distDir: string;
  declared: DeclaredHost[];
  /** Host of the public privacy policy URL, which the CSP must also allow. */
  privacyHost: string;
  /** Text of the submission document, or null when it does not exist. */
  requestDoc: string | null;
}): CrossCheck {
  const { distDir, declared, privacyHost, requestDoc } = options;
  const allowed = new Set(declared.map((h) => h.host.toLowerCase()));
  if (privacyHost) allowed.add(privacyHost.toLowerCase());

  const files = walk(distDir);
  const found = new Map<string, Set<string>>();
  const usedByApp = new Set<string>();

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const prose = PROSE_FILES.has(relative(distDir, file));
    for (const host of originsIn(text)) {
      if (!found.has(host)) found.set(host, new Set());
      found.get(host)!.add(file);
      if (!prose) usedByApp.add(host);
    }
  }

  const undeclared = [...found.entries()]
    .filter(([host]) => !allowed.has(host) && !REFERENCE_ONLY.has(host))
    .map(([host, where]) => ({ host, files: [...where].map((f) => relative(root, f)) }));

  const unused = declared
    .map((h) => h.host.toLowerCase())
    .filter((host) => !usedByApp.has(host));
  if (privacyHost && !usedByApp.has(privacyHost.toLowerCase())) unused.push(privacyHost);

  const missingFromRequest =
    requestDoc === null
      ? [...allowed]
      : [...allowed].filter((host) => !requestDoc.includes(host));

  return {
    scannedFiles: files.length,
    used: [...usedByApp].filter((host) => allowed.has(host)),
    referenceOnly: [...found.keys()].filter((host) => REFERENCE_ONLY.has(host)),
    undeclared,
    unused,
    missingFromRequest,
  };
}

/** The absolute policy URL host, read the same way `gen-csp-request.ts` reads it. */
function privacyHost(): string {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const url =
    (process.env.VITE_PRIVACY_URL ?? "").trim() ||
    /VITE_PRIVACY_URL=(\S+)/.exec(pkg.scripts?.["build:poki"] ?? "")?.[1]?.trim() ||
    "";
  return /^https?:\/\/([^/]+)/.exec(url)?.[1]?.toLowerCase() ?? "";
}

function main(): void {
  const dist = resolve(root, process.argv[2] ?? "dist-poki");
  const requestPath = join(root, "docs/poki/CSP_REQUEST.md");

  if (!existsSync(dist)) {
    console.error(`\n❌ CSP CROSS-CHECK FAILED\n  ${relative(root, dist)}/ does not exist — run \`pnpm build:poki\` first.`);
    process.exit(1);
  }

  const declared = LEGAL_EDITION.hosts.filter((h) => h.edition === "poki");
  if (!declared.length) {
    console.error("\n❌ CSP CROSS-CHECK FAILED\n  the Poki edition declares no external hosts — nothing to request.");
    process.exit(1);
  }
  const policy = privacyHost();
  const result = crossCheckBundle({
    distDir: dist,
    declared,
    privacyHost: policy,
    requestDoc: existsSync(requestPath) ? readFileSync(requestPath, "utf8") : null,
  });

  const problems: string[] = [];
  for (const entry of result.undeclared) {
    problems.push(
      `undeclared origin "${entry.host}" ships in ${entry.files.join(", ")} — it is not in ` +
        "legal.edition.poki.ts, so the portal CSP will block it",
    );
  }
  for (const host of result.unused) {
    problems.push(
      `declared host "${host}" is never used by the bundle — either a build step dropped the code ` +
        "that needs it, or the request is over-broad",
    );
  }
  if (!existsSync(requestPath)) problems.push("docs/poki/CSP_REQUEST.md does not exist — run `pnpm gen-csp`");
  for (const host of result.missingFromRequest) {
    problems.push(`"${host}" is declared but missing from docs/poki/CSP_REQUEST.md — run \`pnpm gen-csp\``);
  }

  if (problems.length) {
    console.error(`\n❌ CSP CROSS-CHECK FAILED (${problems.length})`);
    for (const message of problems) console.error(`  ${message}`);
    console.error("\n  Fix: add the host (with its purpose and directive) to legal.edition.poki.ts,");
    console.error("  run `pnpm gen-csp`, and rebuild — or take the reference out of the bundle.");
    console.error("  A host that is prose rather than a request goes in REFERENCE_ONLY, with the reason.");
    process.exit(1);
  }

  console.log(
    `CSP cross-check — ${result.scannedFiles} text files in ${relative(root, dist)}/ against ${declared.length} declared hosts`,
  );
  console.log(
    `  ✓ every origin in the bundle is declared (${result.used.length}) or reference-only (${result.referenceOnly.length})`,
  );
  console.log(`  ✓ every declared host is used by the bundle, plus the privacy URL ${policy || "(unset)"}`);
  console.log(`  ✓ docs/poki/CSP_REQUEST.md carries all ${declared.length + (policy ? 1 : 0)} requested hosts`);
  console.log("\n✅ THE CSP REQUEST MATCHES THE SHIPPED POKI BUNDLE");
}

// Runs as a script (`pnpm verify:csp`); imported quietly by the test that proves it bites.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
