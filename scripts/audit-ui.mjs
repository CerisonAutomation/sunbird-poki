#!/usr/bin/env node
/**
 * audit-ui — a static UX/UI audit over the HUD source.
 *
 * The browser suites (playwright layout specs) need a real Chromium, which CI
 * and this container do not always have. This audit covers the failures that
 * matter and do not need pixels: dead buttons, null element refs, missing
 * accessible names, inline layout that cannot respond to media queries,
 * buttons whose class has no stylesheet rule, and critical surfaces without a
 * narrow-screen rule.
 *
 * Exit code 1 on any ERROR. Warnings are printed and summarised.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const GAME_DIR = path.join(ROOT, "src/game");
const HUD = path.join(GAME_DIR, "HUD.ts");
/** Every stylesheet the HUD can be styled from. */
const CSS_FILES = [
  path.join(ROOT, "src/index.css"),
  path.join(GAME_DIR, "ui.css"),
  path.join(GAME_DIR, "menu-polish.css"),
].filter((f) => fs.existsSync(f));

const errors = [];
const warnings = [];
const notes = [];

const read = (p) => fs.readFileSync(p, "utf8");
const rel = (p) => path.relative(ROOT, p);

// ---------------------------------------------------------------- sources ---
const uiFiles = fs
  .readdirSync(GAME_DIR)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
  .map((f) => path.join(GAME_DIR, f));
const uiSources = uiFiles.filter((f) => read(f).includes("data-action=") || read(f).includes("data-ref="));
/** Removes `${…}` template expressions, including nested braces and strings. */
const stripInterpolations = (text) =>
  text.replace(/\$\{(?:[^{}"'`]|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\{[^{}]*\})*\}/g, " ");

const hudSrc = read(HUD);
const css = CSS_FILES.map(read).join("\n");
const gameSrc = uiFiles.filter((f) => path.basename(f) !== "HUD.ts").map(read).join("\n");

const hudStripped = stripInterpolations(hudSrc);

// ------------------------------------------------------- declared actions ---
/** data-action="x" → where it is rendered. */
const declared = new Map();
const stripped = new Map(uiSources.map((f) => [f, stripInterpolations(read(f))]));
for (const file of uiSources) {
  const src = stripped.get(file);
  for (const m of src.matchAll(/data-action="([a-z0-9-]+)"/g)) {
    if (!declared.has(m[1])) declared.set(m[1], new Set());
    declared.get(m[1]).add(rel(file));
  }
  // Dynamic actions: data-action="${expr}" cannot be checked statically.
  for (const m of src.matchAll(/data-action="\$\{[^}]+\}"/g)) notes.push(`dynamic action in ${rel(file)}: ${m[0]}`);
}

/** case "x": handlers in the game shell. */
const handled = new Set();
for (const m of gameSrc.matchAll(/case "([a-z0-9-]+)":/g)) handled.add(m[1]);
// Actions the HUD handles internally (its own delegated listeners).
const hudInternal = new Set();
for (const m of hudSrc.matchAll(/dataset\.action === "([a-z0-9-]+)"/g)) hudInternal.add(m[1]);

for (const [action, files] of declared) {
  if (!handled.has(action) && !hudInternal.has(action)) {
    errors.push(`dead button: data-action="${action}" (${[...files].join(", ")}) has no handler in Game.ts or HUD.ts`);
  }
}

// -------------------------------------------------------- element refs ------
const refsDeclared = new Set();
for (const m of hudStripped.matchAll(/data-ref="([A-Za-z0-9_-]+)"/g)) refsDeclared.add(m[1]);
const refsGrabbed = new Set();
for (const m of hudSrc.matchAll(/grab\("([A-Za-z0-9_-]+)"\)/g)) refsGrabbed.add(m[1]);
// Refs read through helpers (querySelector by data-ref) are not "grabbed".
const refsQueried = new Set();
for (const m of hudSrc.matchAll(/readValue<[^>]*>\("([A-Za-z0-9_-]+)"\)|readValue\("([A-Za-z0-9_-]+)"\)/g)) {
  refsQueried.add(m[1] ?? m[2]);
}
for (const m of hudSrc.matchAll(/\[data-ref=\\?"([A-Za-z0-9_-]+)\\?"\]/g)) refsQueried.add(m[1]);
for (const m of hudSrc.matchAll(/data-ref="\$\{([^}]+)\}"/g)) notes.push(`dynamic ref: ${m[0]}`);

for (const ref of refsGrabbed) {
  if (!refsDeclared.has(ref)) {
    errors.push(`null ref: grab("${ref}") but no data-ref="${ref}" exists in the HUD markup`);
  }
}
// Dynamic data-ref lookups by name (shop preview etc.) are allowed.
const dynamicRefTargets = new Set(["shopHeroName"]);
// Refs this audit cannot see a consumer for, because the consumer is the TEST
// SUITE — it queries these by data-ref, and this script only scans app code.
// They are real hooks, not dead markup: deleting one breaks
// pilot-lookup / pilot-name-surface / menu-continuity (unit) or
// portal-policy (e2e). Declared here so they are an explicit contract instead
// of a permanent warning nobody reads.
const testHookRefs = new Set(["pilotCode", "pilotNameInput", "roomCode"]);
for (const ref of refsDeclared) {
  if (
    !refsGrabbed.has(ref) &&
    !refsQueried.has(ref) &&
    !dynamicRefTargets.has(ref) &&
    !testHookRefs.has(ref)
  ) {
    warnings.push(`unused ref: data-ref="${ref}" is neither grabbed nor queried`);
  }
}

// ---------------------------------------------------- accessible buttons ----
// Raw markup, so a runtime-computed label is recognised as such.
const buttons = [...hudSrc.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)];
let unlabelled = 0;
for (const [full, inner] of buttons) {
  if (/\$\{/.test(inner)) continue; // label computed at runtime
  const text = inner.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/gi, "").trim();
  if (!text && !/aria-label=/.test(full)) {
    unlabelled += 1;
    errors.push(`unlabelled button: no text and no aria-label → ${full.slice(0, 90).replace(/\s+/g, " ")}…`);
  }
}
notes.push(`${buttons.length} buttons scanned, ${unlabelled} without an accessible name`);

// ------------------------------------------------------------- inline CSS ---
const inlineStyles = [...hudSrc.matchAll(/style="([^"]*)"/g)].map((m) => m[1]);
const nowrapInline = inlineStyles.filter((s) => /nowrap/.test(s));
if (nowrapInline.length) {
  errors.push(`inline nowrap: ${nowrapInline.length} element(s) cannot wrap on a narrow screen (${nowrapInline[0].slice(0, 60)}…)`);
}
const layoutInline = inlineStyles.filter((s) => /(display\s*:\s*flex|flex\s*:|position\s*:\s*(absolute|fixed))/.test(s));
if (layoutInline.length) {
  warnings.push(`${layoutInline.length} inline layout declaration(s) — they cannot be overridden by media queries`);
}
notes.push(`${inlineStyles.length} inline style attributes in HUD markup`);

// ------------------------------------------------------------ stylesheet ----
const cssClasses = new Set([...css.matchAll(/\.([a-z][a-z0-9_-]*)/gi)].map((m) => m[1]));
const usedClasses = new Set();
for (const m of hudStripped.matchAll(/class="([^"]*)"/g)) {
  for (const part of m[1].split(/\s+/)) {
    // Names ending in "-" are the static half of a dynamic `r-${i}` class.
    if (/^[a-z][a-z0-9_-]*$/i.test(part) && !part.endsWith("-")) usedClasses.add(part);
  }
}
// Classes toggled from JS but not written in markup.
for (const m of hudSrc.matchAll(/classList\.(?:toggle|add|remove)\("([a-z0-9_-]+)"/g)) usedClasses.add(m[1]);
const dynamicClasses = new Set(["on", "off", "hidden", "empty", "done", "live", "win", "podium", "dim", "mine", "gold", "rematch", "storm", "is-ready", "is-waiting", "is-claimed"]);
// Classes styled through a parent rule (` .mm-actions button `) or as a
// modifier of a styled base class — they are not unstyled, they are composed.
const parentStyled = new Set(["mm-ai", "mm-keep", "pause-mute", "mm-cancel", "mm-instant", "shop-section-birds", "nest-row"]);
const unstyled = [...usedClasses].filter((c) => !cssClasses.has(c) && !dynamicClasses.has(c) && !parentStyled.has(c));
if (unstyled.length) warnings.push(`${unstyled.length} class(es) used without a rule in ui.css: ${unstyled.slice(0, 12).join(", ")}`);

const mediaBlocks = [...css.matchAll(/@media[^{]+\{([^}]*)\}/g)].map((m) => m[1]);
notes.push(`${mediaBlocks.length} @media block(s) in ui.css`);

// Critical surfaces must have a narrow-screen rule somewhere.
const narrowNeeded = [".multiplier-claim", ".mm-actions", ".result-actions", ".paper-card", ".friend-row"];
for (const sel of narrowNeeded) {
  const hasNarrow = mediaBlocks.some((b) => b.includes(sel) || (sel === ".paper-card" && /\.paper-card|\.menu-card/.test(b)));
  const hasFlexWrap = new RegExp(`\\${sel}\\s*\\{[^}]*flex-wrap`, "s").test(css);
  if (!hasNarrow && !hasFlexWrap) {
    errors.push(`responsive gap: ${sel} has neither a narrow-screen @media rule nor a wrapping flex layout`);
  }
}

// Tap targets: every button class in markup should be styled, and the shell
// should define a minimum height somewhere for touch comfort.
const buttonClasses = new Set();
for (const [full] of buttons) {
  const m = /class="([^"]*)"/.exec(stripInterpolations(full));
  if (!m) continue;
  for (const c of m[1].split(/\s+/)) {
    if (/^[a-z][a-z0-9_-]*$/i.test(c)) buttonClasses.add(c);
  }
}
const unstyledButtons = [...buttonClasses].filter((c) => !cssClasses.has(c) && !dynamicClasses.has(c) && !parentStyled.has(c));
if (unstyledButtons.length) errors.push(`unstyled button class(es): ${unstyledButtons.join(", ")}`);
const minHeights = [...css.matchAll(/min-height\s*:\s*(\d+)px/g)].map((m) => Number(m[1]));
notes.push(`min-height floors in ui.css: ${[...new Set(minHeights)].sort((a, b) => a - b).join(", ") || "none"}`);
if (!minHeights.some((h) => h >= 44)) warnings.push("no 44px tap-target floor declared in ui.css");

// ------------------------------------------------------------- duplicate ids --
const ids = [...hudSrc.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) errors.push(`duplicate DOM ids: ${[...new Set(dupes)].join(", ")}`);

// ------------------------------------------------------------------ report ---
console.log("\nUX/UI AUDIT");
console.log(`  sources: ${uiSources.map(rel).join(", ")}`);
console.log(`  stylesheets: ${CSS_FILES.map(rel).join(", ")}`);
console.log(`  ${declared.size} declared actions · ${handled.size} handled · ${refsDeclared.size} refs · ${usedClasses.size} classes`);
for (const n of notes) console.log(`  · ${n}`);
if (warnings.length) {
  console.log(`\n  ⚠ ${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`    - ${w}`);
}
if (errors.length) {
  console.log(`\n  ✖ ${errors.length} error(s):`);
  for (const e of errors) console.log(`    - ${e}`);
  console.log("\n❌ UI AUDIT FAILED\n");
  process.exit(1);
}
console.log(`\n✅ UI AUDIT PASSED — no dead buttons, no null refs, no unlabelled controls, ${warnings.length} warning(s).\n`);
