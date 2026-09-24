#!/usr/bin/env node
/**
 * i18n debt ratchet — counts player-facing English that is NOT translated.
 *
 * Why this exists: the game ships 36 locales (34 of them the codes the portal
 * inspector offers, rule LOC-06) and the barrel carries 100% coverage for every
 * key it holds. Coverage of the *barrel* is not coverage of the *game*: any
 * string rendered as a literal is English on every device, and it fails a
 * non-English player exactly where the translated strings succeed. Those
 * literals are also invisible to the coverage gate, so the debt only ever grew.
 *
 * This script makes the debt a number, per category, and refuses to let it
 * rise:
 *
 *     pnpm i18n:audit           # compare against docs/i18n-debt.json
 *     pnpm i18n:audit -- --bless # re-record the current counts as the baseline
 *
 * Translating a batch is then a one-line diff in the baseline, which is the
 * reviewable artefact: "we shipped 15 more keys and the debt went down by 23".
 *
 * Categories (each a precise pattern, so the count is stable rather than
 * heuristic):
 *   toast        — hud.toast(...) whose text is a literal, not a t() call
 *   screenTitle  — head("…") screen headings in the HUD render layer
 *   ariaLabel    — aria-label="…" written as a literal (screen-reader users are
 *                  players too, and they get English-only announcements)
 *   buttonLabel  — <button …>Plain words</button> with no interpolation and no t()
 *
 * Run from the repo root. Exits 1 when any category is above its baseline.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = join(root, "docs/i18n-debt.json");
const bless = process.argv.includes("--bless");

/** Files scanned. The render layer plus every module that can raise a toast. */
const TARGETS = ["src/game"];

const CATEGORIES = [
  {
    id: "toast",
    label: "hud.toast() with literal copy",
    // A toast whose first argument is not a t() call. Both `hud.toast("x")` and
    // `hud.toast(\`x ${y}\`)` count; `hud.toast(t("k", …))` does not.
    re: /(?:this\.)?(?:hud|this\.hud)\.toast\(\s*(?!t\(|\s*$)/g,
  },
  {
    id: "screenTitle",
    label: 'head("…") screen titles',
    re: /\bhead\(\s*"(?:[^"\\]|\\.)*"/g,
  },
  {
    id: "ariaLabel",
    label: 'aria-label="…" literals',
    re: /aria-label="[^"${]*[A-Za-z]{3}[^"${]*"/g,
  },
  {
    id: "buttonLabel",
    label: "<button>Plain words</button>",
    // Only buttons whose whole label is static words: no `${`, no tag inside.
    re: /<button\b[^>]*>[A-Za-z][A-Za-z0-9 ,'’&·.!?:-]{2,}<\/button>/g,
  },
];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      yield* walk(p);
      continue;
    }
    if (/\.tsx?$/.test(entry)) yield p;
  }
}

const counts = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0]));
const offenders = Object.fromEntries(CATEGORIES.map((c) => [c.id, []]));

for (const target of TARGETS) {
  for (const file of walk(join(root, target))) {
    const rel = relative(root, file);
    const text = readFileSync(file, "utf8");
    for (const cat of CATEGORIES) {
      cat.re.lastIndex = 0;
      let m;
      while ((m = cat.re.exec(text)) !== null) {
        const line = text.slice(0, m.index).split("\n").length;
        counts[cat.id]++;
        if (offenders[cat.id].length < 12) {
          offenders[cat.id].push(`${rel}:${line}  ${m[0].slice(0, 78).replace(/\s+/g, " ")}`);
        }
      }
    }
  }
}

const total = Object.values(counts).reduce((a, b) => a + b, 0);
let baseline = { generated: "", note: "", categories: {}, total: 0 };
try {
  baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
} catch {
  if (!bless) {
    console.error(`❌ no baseline at ${relative(root, BASELINE)} — run: pnpm i18n:audit -- --bless`);
    process.exit(1);
  }
}

if (bless) {
  baseline = {
    generated: new Date().toISOString().slice(0, 10),
    note:
      "Player-facing strings still rendered as English literals. Ratchet: this file may only go down. " +
      "Translate a batch (barrel key + 36 locales in src/i18n/translations.barrel.json, then " +
      "node scripts/gen-i18n-packs.mjs), wire the t() call, re-bless.",
    categories: counts,
    total,
  };
  writeFileSync(BASELINE, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`✓ i18n debt baseline recorded — ${total} untranslated strings`);
  for (const cat of CATEGORIES) console.log(`  ${counts[cat.id].toString().padStart(4)}  ${cat.id} — ${cat.label}`);
  process.exit(0);
}

const regressions = CATEGORIES.filter((c) => counts[c.id] > (baseline.categories?.[c.id] ?? 0));
console.log(`i18n debt — ${total} untranslated player-facing strings (baseline ${baseline.total ?? "?"})`);
for (const cat of CATEGORIES) {
  const before = baseline.categories?.[cat.id] ?? 0;
  const delta = counts[cat.id] - before;
  const flag = delta > 0 ? "▲" : delta < 0 ? "▼" : "=";
  console.log(`  ${flag} ${counts[cat.id].toString().padStart(4)}  ${cat.id.padEnd(12)} ${cat.label} (baseline ${before})`);
}

if (regressions.length) {
  console.error(`\n❌ I18N DEBT ROSE — ${regressions.map((c) => `${c.id} +${counts[c.id] - (baseline.categories?.[c.id] ?? 0)}`).join(", ")}`);
  for (const cat of regressions) {
    console.error(`\n  ${cat.id} — newest offenders:`);
    for (const o of offenders[cat.id]) console.error(`    ${o}`);
  }
  console.error(
    "\n  Fix: add the key to src/i18n/translations.barrel.json (all 36 locales), run\n" +
      "  `node scripts/gen-i18n-packs.mjs`, render it with t(key, params, defaultText).\n" +
      "  Only re-bless (`pnpm i18n:audit -- --bless`) when the count genuinely went DOWN.",
  );
  process.exit(1);
}

if (total < (baseline.total ?? 0)) {
  console.log(`\n✓ debt fell by ${baseline.total - total} — re-bless to lock the win in: pnpm i18n:audit -- --bless`);
} else {
  console.log("\n✅ I18N RATCHET HELD — no new untranslated player-facing strings.");
}
