/**
 * Generates `docs/poki/CSP_REQUEST.md` — the Content-Security-Policy submission
 * text for the Poki game settings page.
 *
 * Why generated: Poki's external-resources policy asks for the exact links a
 * build needs plus a short explanation of what each is used for, and it will
 * not store any custom CSP until a privacy policy URL is on file. Both facts
 * already live in code (`legal.edition.poki.ts` host table, `PRIVACY_POLICY_URL`
 * in `legal.ts`), so a hand-written request document would be a third copy of
 * the same truth and would drift the first time a host changed. This reads the
 * shipped arrays and writes the document.
 *
 *     pnpm gen-csp            # regenerate before a submission
 *
 * The output is written for a human to paste into the portal's form: one row
 * per host with its directive and reason, ready-to-paste values per directive,
 * and the surrounding notes (privacy URL, re-upload after review).
 */
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LEGAL_EDITION } from "../src/game/legal.edition.poki";
import { PRIVACY_POLICY_VERSION } from "../src/game/legal";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "docs/poki/CSP_REQUEST.md");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  version?: string;
  scripts?: Record<string, string>;
};

/**
 * The absolute public policy URL, which is what a portal reviewer must be given.
 *
 * Taken from the environment when this runs inside a portal build, and otherwise
 * read back out of the `build:poki` script in package.json — the same single
 * place the build itself gets it from, so the submission document can never
 * quote a URL the shipped bundle does not use. A relative `/privacy` would be
 * worthless here: inside the portal iframe the game's origin is the portal CDN.
 */
function policyUrl(): string {
  const fromEnv = (process.env.VITE_PRIVACY_URL ?? "").trim();
  if (fromEnv) return fromEnv;
  const fromBuild = /VITE_PRIVACY_URL=(\S+)/.exec(pkg.scripts?.["build:poki"] ?? "")?.[1]?.trim();
  if (!fromBuild) {
    throw new Error(
      "no absolute privacy URL: set VITE_PRIVACY_URL, or keep it in the build:poki script",
    );
  }
  return fromBuild;
}
const PRIVACY_POLICY_URL = policyUrl();

/** How many rules the Poki audit checks — read, never hand-typed, so this document cannot go stale. */
const ruleCount = (
  JSON.parse(readFileSync(join(root, "docs/poki/requirements.json"), "utf8")) as { rules?: unknown[] }
).rules?.length ?? 0;

const hosts = LEGAL_EDITION.hosts;
if (!hosts.length) throw new Error("the Poki edition declares no external hosts — nothing to request");

const byDirective = new Map<string, typeof hosts>();
for (const h of hosts) {
  const list = byDirective.get(h.directive) ?? [];
  list.push(h);
  byDirective.set(h.directive, list);
}

const DIRECTIVE_ORDER = ["script-src", "connect-src", "webrtc"];
const rank = (d: string): number => {
  const i = DIRECTIVE_ORDER.indexOf(d);
  return i < 0 ? DIRECTIVE_ORDER.length : i;
};
const directives = [...byDirective.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

const table = hosts
  .map((h) => `| \`${h.host}\` | \`${h.directive}\` | ${h.purpose} |`)
  .join("\n");

const paste = directives
  .map((d) => {
    const list = byDirective.get(d)!;
    const value = list.map((h) => `https://${h.host}`).join(" ");
    return `**${d}**\n\n\`\`\`\n${value}\n\`\`\`\n\n${list.map((h) => `- \`${h.host}\` — ${h.purpose}`).join("\n")}`;
  })
  .join("\n\n");

const webrtc = byDirective.get("webrtc") ?? [];
const iceNote = webrtc.length
  ? `WebRTC has no CSP directive of its own; the ICE servers below must be allowed by the portal's
network policy (or by an \`webrtc:\` allow-list if the form provides one). They are only contacted
when a direct peer-to-peer connection between two players fails, and never by a solo flight.

${webrtc.map((h) => `- \`${h.host}\` — ${h.purpose}`).join("\n")}`
  : "No ICE/TURN servers are used by this edition.";

const doc = `# Poki Content-Security-Policy request

**Generated:** ${new Date().toISOString().slice(0, 10)} by \`pnpm gen-csp\` — do not edit by hand.
**Source of truth:** \`src/game/legal.edition.poki.ts\` (host table) and \`src/game/legal.ts\` (policy URL).
**Build:** Sunbird ${pkg.version ?? "1.0.0"} · privacy policy version ${PRIVACY_POLICY_VERSION}

Poki's external-resources policy requires the exact links a build needs, a short
explanation of each, and an up-to-date privacy policy hosted on a public page and
linked from inside the game. This document is that submission.

## 1. Privacy policy URL (required before any custom CSP is stored)

\`\`\`
${PRIVACY_POLICY_URL}
\`\`\`

The page is generated from the same data module the in-game Settings → Privacy
Policy screen renders, and that screen links to this URL — so the policy is both
"hosted on a live webpage accessible to all players" and "linked inside the game".
It is self-contained: no stylesheet, script, font or analytics request of any kind.

## 2. External hosts this build needs

| Host | Directive | Why the game contacts it |
|---|---|---|
${table}

Nothing else is contacted. The build carries no analytics endpoint, no developer
backend, no font CDN and no remote asset: every asset is inlined into the
single-file bundle by \`scripts/package-portal.mjs\`. \`pnpm verify:portals\` fails
the build if a foreign portal's markers appear in it, and its \`verify:csp\` step
reads the built bundle and fails if the game reaches for a host this document does
not list — or lists a host the bundle never uses.

## 3. Values to paste, per directive

${paste}

## 4. ICE / relay servers (multiplayer)

${iceNote}

## 5. Usage explanation (short form for the request box)

> Sunbird is a single-file HTML5 flight game. It needs \`game-cdn.poki.com\` to load
> the Poki SDK (advertising, lifecycle events, leaderboard handshake). Multiplayer
> is peer-to-peer through Poki Netlib, which requires \`netlib.poki.io\` for lobby
> signalling and, only when a direct connection fails, a STUN/TURN relay
> (\`stun.l.google.com\`, \`turn.rtc.poki.com\`). \`auds.poki.io\` is Poki's own
> Arbitrary User Data Store, used for leaderboard entries and for sharing a daily
> run as a ghost; it is keyed by the identifier Poki assigns the game, never by
> anything the player types. The game contacts no other host, collects no personal
> data, has no account system, no chat and no in-app purchases.

## 6. After approval

Re-upload the build once the CSP has been reviewed — the portal caches the
previous bundle, so a stored policy does not take effect on the old upload.

Verification commands for this submission:

\`\`\`
pnpm gen-csp           # regenerate this document from the shipped host table
pnpm verify:csp        # the built dist-poki bundle against this host list
pnpm poki:preflight    # builds every portal target and gates isolation, zips, upload folder
pnpm poki:audit        # ${ruleCount}-rule Poki compliance audit (docs/poki/COMPLIANCE.md)
\`\`\`
`;

writeFileSync(out, doc);
console.log(
  `CSP request written — ${hosts.length} hosts across ${directives.length} directives → docs/poki/CSP_REQUEST.md`,
);
