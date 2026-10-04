/**
 * Wiring tripwire — the check that a green unit suite cannot be.
 *
 * ## The bug class
 *
 * A pure function can be correct, fully tested, and never called. `Game.ts`
 * filled the results-card snapshot with literals —
 * `celebration: { staged: [], ledger: [], folded: 0, peak: 0 }` under a comment
 * reading "Celebration and proximity are not yet plumbed from game state" —
 * while `ProgressBeats.planCelebration` (42 test references) and
 * `GrowthLedger.growthLedger` (18) sat next to it doing nothing. Every test was
 * green. The game shipped without the feature. The same shape produced a
 * results card with no progress strip and a `<div class="growth-ledger">` that
 * `ui.css` collapses to `min-height: 1px`.
 *
 * A type checker cannot see it (the export exists), a unit test cannot see it
 * (the function is correct), and `madge --circular` cannot see it (a *missing*
 * edge is not a cycle). Only reachability can.
 *
 * ## Why this is an allow-list and not a dead-export lint
 *
 * The obvious implementation — fail CI on any exported symbol with no caller —
 * is wrong for this repo, and would have been wrong within a minute. It fires
 * on all nine `protocol/v1.ts` wire constants and the codec, because the Rust
 * room server and the Cloudflare workers live in the parent monorepo; on
 * `SAVE_SCHEMA`, `REPLAY_VERSION` and `DEVICE_REPORT_DIMENSIONS`, whose only
 * consumer is the tripwire test that exists to police them; on three
 * `ts-prune-ignore` surfaces; and on every build-alias module. That is a wall of
 * suppressions on day one, and a check that cries wolf is a check that gets
 * ignored — which is how `scripts/verify-isolation.mjs` came to assert four
 * modules were live when none of them were.
 *
 * So the registry is **curated and three-part**, and every part is asserted in
 * both directions:
 *
 *  - `WIRED` — live today. Must keep at least one caller outside its own file.
 *    Most of these are the *live half of a module that also has a dead half*
 *    (`MOMENTS` vs `ClipLedger`, `bootStage` vs `onBootProgress`). That pairing
 *    is the point: the natural mistake when tidying a module like `Moments.ts`
 *    is to delete the half that looks unused and take the live half with it.
 *  - `PENDING` — audited, unwired, and awaiting a wire-or-delete decision that
 *    is not this file's to make. Asserted to have **zero** callers, so a
 *    half-wired feature cannot slip through, and so the list cannot rot.
 *  - `EXTERNAL` — consumed outside this checkout. Asserted to *exist*, never
 *    asserted to be called, so the reason they are not in `WIRED` is written
 *    down in the place a future reader will actually find it.
 *
 * Adding a row is a claim someone has to stand behind; a row that goes stale
 * fails in whichever direction it moved.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../..");

/** Live today. Losing the last caller is a regression, not a cleanup. */
const WIRED: Record<string, string> = {
  // The guard this card was written for: `measure()` used a hand-rolled regex
  // and dropped 10 of 16 live call sites. Keep it on the live path.
  // sanitizeMeasure was removed from this registry: it is no longer a
  // CROSS-MODULE liveness claim. `callersOf` deliberately ignores calls from the
  // defining module, and its only remaining caller is `measureViaPoki` in this
  // same file — so it is a live internal helper of poki-canon, not a dead
  // export. This registry answers "does anything outside still use it?", and
  // the honest answer for this one became no when measure() moved behind
  // measureViaPoki. Listing it would assert a liveness that does not exist.

  // SpeedFeel: one consumer, and it is the camera. If this goes, the module's
  // speed curve is decorative.
  "game/SpeedFeel.ts:diveKick": "CameraRig — the only SpeedFeel consumer",

  // Integrity seal. `isSealed` is the dead predicate; these two are the API.
  "game/resilience/crc.ts:openPayload": "SaveData — save load path",
  "game/resilience/crc.ts:sealPayload": "SaveData — save persist path",

    "game/AntiCheat.ts:verifyRunSubmission": "Leaderboard — the only submission gate",

    // 1.3 adaptive difficulty, part 1 of 2. `tuneDifficulty` still computes four
    // multipliers that never leave Engagement.ts and stays PENDING below; this is
    // the one that now reaches a player. Moved out of PENDING by the registry's own
    // bidirectional assertion when RivalGhost gained the call — which is exactly
    // the "a listed symbol that gains a caller is itself a finding" behaviour the
    // registry exists for.
    "game/Engagement.ts:paceSkillFor": "RivalGhost — the pace ghost's skill cap",

  // DeepLinks: the live half. The `sb1:` token pair is PENDING, and the two
  // halves live in one file — deleting the dead half must not take these.
  "game/DeepLinks.ts:buildChallengeUrl": "Game — challenge sharing",
  "game/DeepLinks.ts:readChallengeFromUrl": "Game — challenge deep link",
  "game/DeepLinks.ts:readRoomInviteFromUrl": "Game — room invite deep link",
  "game/DeepLinks.ts:buildRoomInviteUrl": "Game — room invite sharing",
  "game/DeepLinks.ts:normalizeRoomCode": "Game + RoomBrowser — shared room-code parse",

  // Events: the live half. `rollEventProgress`/`emptyEventProgress` are PENDING.
  "game/Events.ts:weeklyEvent": "Game + HUD — the weekly event card",
  "game/Events.ts:monthlyTheme": "Game + HUD — the monthly theme",
  "game/Events.ts:monthKey": "Game — event-clear month bucketing",
  "game/Events.ts:THEME_TRAIL_CLEARS": "Game — theme-trail threshold",

  "game/ContinueOffer.ts:continueOffer": "Game — the continue-offer decision",
  "game/ContinueOffer.ts:continuePlacementLabel": "Game — placement label (also a measure() argument)",

  // Moments: the live half. `ClipLedger`/`pickCta`/`clipFromMoment` are PENDING.
  "game/Moments.ts:MOMENTS": "Game — the reaction table (fireMoment)",
  "game/Moments.ts:MomentLedger": "Game — per-run moment tally",
  "game/Moments.ts:momentShouldReact": "Game — reaction throttle",

  // BootProgress: the live half. `onBootProgress`/`deferredCount`/
  // `resetBootProgress` are PENDING (two are self-declared test hooks).
  "game/BootProgress.ts:bootStage": "App + Game — the boot progress bar",
  "game/BootProgress.ts:defer": "Game — deferred boot work",

  // Sunbird: the live accessor. `GREY_PALETTE` is a dead alias for index 5.
  "game/Sunbird.ts:rivalPalette": "FlockLoading + HUD + Sky + Social — rival colours",

  // Wired by the results-card lane. Ten PENDING rows moved at once, which is
  // what the bidirectional half of this registry exists for: each of these gained
  // a caller in src/game/RunProgress.ts, so each one became a finding. The old
  // descriptions recorded why they were dead; these record what they now drive.
  "game/ProgressBeats.ts:planCelebration": "RunProgress - the beat strip for a finished run",
  "game/ProgressBeats.ts:celebrationView": "RunProgress - celebration rows",
  "game/ProgressBeats.ts:wingsProximity": "RunProgress - the proximity bar",
  "game/GrowthLedger.ts:growthLedger": "RunProgress - growth lines (was a 1px empty div)",
  "game/Missions.ts:missionRows": "RunProgress - the in-flight mission strip",
  "game/Missions.ts:newlyDone": "RunProgress - newly completed missions",
  "game/Missions.ts:nextActionLine": "RunProgress - next action (was a hardcoded empty string)",
  "game/SpeedFeel.ts:streakOpacity": "RunProgress - HUD speed-line opacity",
  "game/Cards.ts:buildGauntletCard": "RunProgress - gauntlet card (was inlined at Game.ts)",
  "game/Cards.ts:buildRivalCard": "RunProgress - rival card (was duplicated at Game.ts)",
};

/** Audited, unwired, awaiting a wire-or-delete decision. See `hive/research/unwired.md`. */
const PENDING: Record<string, string> = {
  // 1.1 results card — Game.ts:7486 fills these with literals
  "game/Missions.ts:closestGoalLine": "mission strip footer",
  "game/Career.ts:wingsCrossing": "wing-tier crossing banner",
  "game/HudFeedback.ts:BannerMoment": "banner vocabulary for the above",
  // 1.4 clip camera + recap CTA
  "game/CameraRig.ts:clipShotFor": "the only ClipKind -> ClipShot mapper",
  "game/Moments.ts:clipFromMoment": "clip kind from moment",
  "game/Moments.ts:clipHappyTime": "clip duration",
  "game/Moments.ts:ClipLedger": "clip-worthy ledger",
  "game/Moments.ts:clipShareLine": "clip share text",
  "game/Moments.ts:pickCta": "the CTA that follows the joke",
  // 1.3 adaptive difficulty
    "game/Engagement.ts:tuneDifficulty": "casual-only ease/spice tune",
  // 1.5 speed feel
  "game/SpeedFeel.ts:vignetteIntensity": "warp vignette",
  "game/SpeedFeel.ts:afterimageAlpha": "afterimages",
  "game/SpeedFeel.ts:whooshRate": "whoosh curve (Audio has its own thresholds)",
  "game/SpeedFeel.ts:warpLevel": "HUD band classes",
  "game/SpeedFeel.ts:warpT": "continuous warp intensity",
  "game/SpeedFeel.ts:fxScale": "weak-device particle scale",
  "game/SpeedFeel.ts:WEE_IDLE": "one-off celebration gate state",
  "game/SpeedFeel.ts:weeCheck": "one-off celebration gate (Moments names it in a comment and never calls it)",
  // 1.6 half-done refactor seam; Game.ts still holds the pre-fix copies
  // 1.7 messenger-safe challenge token (ROADMAP claims shipped)
  "game/DeepLinks.ts:packChallengeToken": "sb1: token pack",
  "game/DeepLinks.ts:unpackChallengeToken": "sb1: token unpack",
  // 1.8 rejoin + room share
  "game/RoomBrowser.ts:rememberRoom": "rejoin-after-reload memory",
  "game/RoomBrowser.ts:forgetRoom": "rejoin-after-reload memory",
  "game/RoomBrowser.ts:lastRoom": "rejoin-after-reload memory",
  "game/RoomBrowser.ts:roomShareText": "room share text",
  // 1.9 retention + K-factor
  "game/Funnel.ts:visitKind": "new / d1 / d2_6 / d7plus cohort",
  "game/Funnel.ts:viralCoefficient": "on-device K proxy",
  "game/Funnel.ts:isViralEvent": "viral event guard",
  "game/Funnel.ts:viralEventProps": "viral event props",
  // 1.10 + odds and ends
  "game/SharedRun.ts:topSharedRuns": "per-seed mini board",
  "game/legal.ts:TERMS_URL": "no terms link exists in the UI",
  "game/Events.ts:rollEventProgress": "event progress roll (SaveData has its own counters)",
  "game/Events.ts:emptyEventProgress": "event progress seed",
  "game/Events.ts:EventProgress": "the type for the two above",
  "sdk/poki-canon.ts:clampHappyIntensity": "inlined verbatim at poki.ts happyTime()",
  "sdk/poki-canon.ts:MEASURE_PROGRESS_ACTIONS": "published-vocabulary mirror (pinned by poki-canon.test.ts)",
  "sdk/poki-canon.ts:MEASURE_INTERACTION_ACTIONS": "published-vocabulary mirror (pinned by poki-canon.test.ts)",
  "sdk/poki-canon.ts:MeasureAction": "the `| string` open set, documented at the type",
};

/** Consumed outside this checkout. Asserted to exist; never asserted to be called. */
const EXTERNAL: Record<string, string> = {
  "game/protocol/v1.ts:SERVER_MESSAGE_TYPES": "Rust room server + protocol/contract.json",
  "game/protocol/v1.ts:CLIENT_MESSAGE_TYPES": "Rust room server + protocol/contract.json",
  "game/protocol/v1.ts:SERVER_ERROR_CODES": "Rust room server + protocol/contract.json",
  "game/protocol/v1.ts:MOVEMENT_LIMITS": "Rust room server + protocol/contract.json",
  "game/protocol/v1.ts:ERROR_MESSAGE_MAX": "Rust room server + protocol/contract.json",
  "game/protocol/v1.ts:IDEMPOTENCY_MAX": "Rust room server + protocol/contract.json",
  "game/protocol/v1.ts:TOKEN_MIN": "Rust room server + protocol/contract.json",
  "game/protocol/v1.ts:encodeClientMessage": "ts-prune-ignore: phase-2 codec, consumed when authoritative rooms land",
  "game/protocol/v1.ts:parseServerJsonFrame": "ts-prune-ignore: phase-2 codec, consumed when authoritative rooms land",
  "game/Realtime.ts:protocolGatewayInfo": "ts-prune-ignore: mirrored by rust/crates/sunbird-protocol",
  "game/legal.edition.ts:LEGAL_EDITION": "scripts/gen-privacy-page.ts, verify-csp.ts, gen-csp-request.ts",
  "game/legal.ts:composePolicy": "scripts/gen-privacy-page.ts",
  "game/version.ts:SAVE_SCHEMA": "tripwire: version-lockstep.test.ts is its consumer",
  "game/version.ts:REPLAY_VERSION": "tripwire: version-lockstep.test.ts is its consumer",
  "sdk/device-report.ts:DEVICE_REPORT_DIMENSIONS": "tripwire: device-report.test.ts is the 'audit script'",
  "game/BootProgress.ts:resetBootProgress": "self-declared test/teardown hook",
  "game/BootProgress.ts:deferredCount": "self-declared test hook",
  "game/BootProgress.ts:onBootProgress": "public subscription API; the internal DOM bridge is the live path",
  "game/resilience/crc.ts:isSealed": "1-line predicate duplicating openPayload's own check",
  "game/HudFeedback.ts:enqueuePop": "1-line wrapper over the generic enqueue()",
  "game/pvp.ts:medalFor": "inlined at HUD (medal array)",
  "game/Sunbird.ts:GREY_PALETTE": "alias for RIVAL_PALETTES[5]; rivalPalette() is the live accessor",
  "game/legal.ts:privacyPolicyUrl": "Game imports PRIVACY_URL directly",
  "game/legal.ts:EXTERNAL_HOSTS": "empty array; the live allowlist is LEGAL_EDITION.hosts",
  "game/AntiCheat.ts:defaultProfile": "social layer lives in the parent monorepo",
  "game/ContinueOffer.ts:CONTINUE_OFFER_KINDS": "the kind union is already declared inline",
  "game/HUD.ts:SCREEN_TITLES": "screen-titles.test.ts; note HUD head() recomputes the same expression inline",
  "game/Experiments.ts:ExperimentId": "type with no consumer",
  };

/* ------------------------------------------------------------------ the scan */

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git") continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/**
 * Test files are excluded from caller counting, and that exclusion is the whole
 * point: a unit test referencing a symbol is exactly what hid this bug class.
 * A test is evidence the *function* is correct, never evidence the *game* calls
 * it. Counting tests here would have marked all 14 features as wired.
 */
const isTestFile = (p: string) => p.includes(`${join("__tests__")}`) || /\.(test|spec)\.[cm]?tsx?$/.test(p);

const srcRoot = join(root, "src");
const srcFiles = walk(srcRoot);

/**
 * Parse with the TypeScript compiler that `pnpm typecheck` already runs, so
 * "is this a reference?" is answered by the grammar rather than by a regex.
 *
 * This replaced a hand-rolled comment/string stripper, and the reason is worth
 * recording because the stripper looked fine and was quietly wrong. Stripping
 * strings by hand cannot see a **regex literal**: `Sunbird.ts:307` contains
 * `.replace(/[<>&"]/g, …)`, whose `"` opened a "string" that never closed. From
 * that line on the stripper was desynchronised and blanked the remainder of the
 * file, so `const x = planCelebration` appended at the end of `Sunbird.ts` read
 * as "no caller" and the PENDING half of the registry passed **vacuously**.
 *
 * That is the exact failure this file was written to prevent — a reachability
 * check that reports a clean bill of health on code it never actually read —
 * and it was reproducing it. An AST cannot desynchronise: a comment and a
 * string are not `Identifier` nodes, so "is this a reference" needs no
 * stripping at all. `typescript` is already a declared devDependency (it backs
 * `tsc --noEmit`), so this adds no dependency.
 */
const parsed = new Map<string, ts.SourceFile>();
for (const file of srcFiles) {
  const text = readFileSync(file, "utf8");
  parsed.set(
    file,
    ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS),
  );
}

const shipping = srcFiles.filter((p) => !isTestFile(p));

/** Module ids are `src/`-relative and keep their extension: `game/Moments.ts`. */
const moduleId = (file: string) => relative(srcRoot, file);

const hasExportModifier = (node: ts.Node): boolean =>
  ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

/** module path -> the symbols it exports. Read off the AST, not off a regex. */
const exportsByModule = new Map<string, Set<string>>();
for (const file of shipping) {
  const sf = parsed.get(file)!;
  const names = new Set<string>();
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt) || ts.isInterfaceDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt) || ts.isEnumDeclaration(stmt)) {
      if (hasExportModifier(stmt) && stmt.name) names.add(stmt.name.text);
    } else if (ts.isVariableStatement(stmt)) {
      if (!hasExportModifier(stmt)) continue;
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) names.add(decl.name.text);
      }
    } else if (ts.isExportAssignment(stmt)) {
      names.add("default");
    } else if (ts.isExportDeclaration(stmt)) {
      // `export { a, b }` and `export { a } from "./x"` are both re-exports.
      if (!stmt.exportClause || !ts.isNamedExports(stmt.exportClause)) continue;
      for (const el of stmt.exportClause.elements) names.add(el.name.text);
    }
  }
  exportsByModule.set(moduleId(file), names);
}

/**
 * One pass over every shipping file, bucketing each genuine identifier
 * reference by name and file. Built once because the registry asks ~100
 * questions; walking the AST per question took 52s, and a check that is too
 * slow to run gets skipped.
 *
 * Excluded, each for a concrete reason:
 *  - import/export specifiers: an unused `import { diveKick }` is not a call
 *    site, and counting it satisfies the whole registry. Found by deleting a
 *    real call while leaving its import and watching the suite stay green.
 *  - property names and property-access names (`{ planCelebration: 1 }`,
 *    `foo.planCelebration`): those name a *different* symbol that happens to
 *    share a spelling.
 *
 * Comments and string literals need no handling: neither is an `Identifier`.
 */
const refsByName = new Map<string, Map<string, number[]>>();
for (const file of shipping) {
  const sf = parsed.get(file)!;
  const add = (name: string, line: number): void => {
    let byFile = refsByName.get(name);
    if (!byFile) refsByName.set(name, (byFile = new Map()));
    const lines = byFile.get(file);
    if (lines) lines.push(line);
    else byFile.set(file, [line]);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      const parent = node.parent;
      const isSpecifier = parent !== undefined && (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent) || ts.isNamespaceImport(parent) || ts.isImportClause(parent));
      const isMemberName = parent !== undefined && ts.isPropertyAccessExpression(parent) && parent.name === node;
      const isPropertyKey = parent !== undefined && ts.isPropertyAssignment(parent) && parent.name === node;
      const isQualifiedRight = parent !== undefined && ts.isQualifiedName(parent) && parent.right === node;
      if (!isSpecifier && !isMemberName && !isPropertyKey && !isQualifiedRight) {
        add(node.text, sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

/** Lines in `file` where `name` appears as code. */
function referencePositions(file: string, name: string): number[] {
  return refsByName.get(name)?.get(file) ?? [];
}

/** Callers of `name` outside its own module, in shipping code only. */
function callersOf(module: string, name: string): string[] {
  const byFile = refsByName.get(name);
  if (!byFile) return [];
  const found: string[] = [];
  for (const file of byFile.keys()) {
    const mod = moduleId(file);
    if (mod === module) continue;
    found.push(mod);
  }
  return found.sort();
}

type Row = { key: string; module: string; name: string; why: string };
const rows = (reg: Record<string, string>): Row[] =>
  Object.entries(reg).map(([key, why]) => {
    const at = key.lastIndexOf(":");
    return { key, module: key.slice(0, at), name: key.slice(at + 1), why };
  });

const wiredRows = rows(WIRED);
const pendingRows = rows(PENDING);
const externalRows = rows(EXTERNAL);
const allRows = [...wiredRows, ...pendingRows, ...externalRows];

describe("wiring registry", () => {
  it("scans the source tree it thinks it does (scanner sanity, not a tautology)", () => {
    // If the walk, the parse or the export discovery ever stop matching, every
    // assertion below would pass vacuously and report a clean bill of health on
    // a codebase it never read. This is the failure mode that makes a
    // reachability check worse than no check at all — and it is not
    // hypothetical here: the string-stripper this replaced silently blanked
    // every file containing a regex literal with a quote in it.
    expect(shipping.length).toBeGreaterThan(100);
    expect(exportsByModule.size).toBeGreaterThan(100);
    expect(exportsByModule.get("game/Moments.ts")?.has("MOMENTS")).toBe(true);
    // Prose must not count as code. The canary is PLANTED, not found: Career.ts
    // carries a comment naming `__wiringScannerCanary`, an identifier that
    // deliberately does not exist as an export anywhere in this tree. A scanner
    // that read comments as references would report a caller for it.
    //
    // This replaces an organic canary — `wingsProximity`, named in Career.ts:35
    // and in no code — which had to be swapped the moment the results-card lane
    // wired that symbol for real. An organic canary is spent by unrelated good
    // work, and with the PENDING set thinned there is no second one available.
    // A planted canary cannot be spent.
    const career = join(root, "src/game/Career.ts");
    const canary = "__wiringScannerCanary";
    expect(readFileSync(career, "utf8")).toContain(canary);
    expect(referencePositions(career, canary)).toEqual([]);
    expect(exportsByModule.get("game/Career.ts")?.has(canary)).toBeFalsy();
  });

  it("reads every shipping file, including the ones holding regex literals", () => {
    // The regression test for the desync above. `Sunbird.ts:307` contains
    // `.replace(/[<>&"]/g, …)`; a hand-rolled stripper opened a string on that
    // quote and blanked the rest of the file, which made an appended
    // `planCelebration` reference invisible and the PENDING half vacuous.
    // Parsing is per-file and cannot leak state, so assert the last statement
    // of a known-deep file is still reachable as code.
    const sunbird = join(root, "src/game/Sunbird.ts");
    const sf = parsed.get(sunbird)!;
    expect(sf).toBeDefined();
    // `round` is declared before the regex and used by code after it.
    const afterRegex = referencePositions(sunbird, "round").filter((l) => l > 307);
    expect(afterRegex.length, "nothing found after Sunbird.ts:307 — the scan stopped early").toBeGreaterThan(0);
  });

  it("has no duplicate or malformed entries", () => {
    const seen = new Set<string>();
    for (const r of allRows) {
      expect(r.key, `malformed registry key: ${r.key}`).toMatch(/^[^:]+\.[jt]s:[A-Za-z_$][\w$]*$/);
      expect(seen.has(r.key), `duplicate registry entry: ${r.key}`).toBe(false);
      seen.add(r.key);
    }
    const overlap = wiredRows.filter((w) => pendingRows.some((p) => p.name === w.name));
    expect(overlap.map((o) => o.key)).toEqual([]);
  });

  it("references only exports that still exist", () => {
    // A rename is not a silent event: the row must be updated with it.
    const missing = allRows
      .filter((r) => !exportsByModule.get(r.module)?.has(r.name))
      .map((r) => `${r.key} — no such export (renamed or deleted?)`);
    expect(missing).toEqual([]);
  });
});

describe("WIRED — live features keep their callers", () => {
  it.each(wiredRows.map((r) => [r.key, r] as const))("%s keeps at least one caller", (_key, r) => {
    expect(callersOf(r.module, r.name), `${r.name} (${r.why}) lost its last caller`).not.toEqual([]);
  });
});

describe("PENDING — audited-unwired stays unwired until decided", () => {
  it.each(pendingRows.map((r) => [r.key, r] as const))("%s has no caller yet", (_key, r) => {
    // Zero callers is the *expected* state, so a failure here means someone
    // wired it — which is good news, and the row must move to WIRED (or be
    // deleted) in the same commit. That is the anti-rot half of the registry.
    const callers = callersOf(r.module, r.name);
    expect(callers, `${r.name} (${r.why}) now has a caller: ${callers.join(", ")} — move the row`).toEqual([]);
  });
});

describe("EXTERNAL — consumed outside this checkout", () => {
  it.each(externalRows.map((r) => [r.key, r] as const))("%s exists and is documented", (_key, r) => {
    // Existence only. Asserting these are called would be the exact false
    // positive this file was written to avoid: the Rust room server, the
    // Cloudflare workers and the tripwire tests are the real consumers.
    expect(exportsByModule.get(r.module)?.has(r.name), `${r.name} vanished — re-check the reason`).toBe(true);
    expect(r.why.length, `${r.key} needs a reason`).toBeGreaterThan(10);
  });
});
