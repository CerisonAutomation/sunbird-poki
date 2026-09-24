#!/usr/bin/env node
/**
 * Generate per-locale runtime packs from the barrel.
 *
 * The barrel (`src/i18n/translations.barrel.json`) is the single source of
 * truth: one entry per key carrying `sourceText` + `translations` for every
 * shipped locale. That shape is ideal for reviewers and coverage tooling, but
 * statically importing it puts ALL locales into the boot bundle (~94 KB).
 *
 * This script projects the barrel into **positional** per-locale packs
 * (`src/i18n/packs/<locale>.json` — an array of texts in `pack-keys.json`
 * order), which the runtime lazy-loads one locale at a time. English is
 * generated too: it is the eager fallback pack and the only one imported
 * statically.
 *
 * Why arrays and not `{ key: text }` maps: a portal zip is a single file, so
 * `import.meta.glob` inlines **all 36** packs into `index.html` no matter how
 * lazily the runtime asks for them. With maps, every pack repeated the same
 * 137 key names — 111 KB of the 297 KB payload was key text, i.e. ~0.25 KB of
 * every key's ~0.75 KB cost. Shipping the key list once (`pack-keys.json`,
 * ~3 KB) and only the values per locale cuts the i18n payload by about a
 * third, which is what keeps the remaining untranslated strings affordable
 * (see `docs/archive/GAME_BACKLOG_2026-09-23.md` §2).
 *
 * Position is meaning: a pack whose length differs from `pack-keys.json` is
 * rejected at load time (`loadPack`) and again by `locales.test.ts`.
 *
 * Regenerate after editing the barrel:
 *
 *     node scripts/gen-i18n-packs.mjs
 *
 * `src/i18n/__tests__/locales.test.ts` re-derives the packs in memory and
 * fails on drift, so a barrel edit without regeneration cannot ship.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const barrelPath = join(root, "src/i18n/translations.barrel.json");
const outDir = join(root, "src/i18n/packs");

const barrel = JSON.parse(readFileSync(barrelPath, "utf8"));
// Locale codes come from the entries themselves (the union of every
// entry's `translations` keys) — NOT from the barrel's top-level per-file
// mirror keys, which is a partial listing and has missed tr/ru before.
const codes = [...new Set(Object.values(barrel.barrel).flatMap((e) => Object.keys(e.translations ?? {})))].sort();

mkdirSync(outDir, { recursive: true });

// The one canonical order. Sorted so regeneration is stable no matter how the
// barrel is edited, and so a diff of a pack reads as "this string changed"
// rather than "everything moved".
const keys = Object.keys(barrel.barrel).sort();
const keysPath = join(root, "src/i18n/pack-keys.json");
writeFileSync(keysPath, JSON.stringify(keys) + "\n");

let written = 0;
for (const code of codes) {
  const values = keys.map((key) => {
    const entry = barrel.barrel[key];
    const text = entry.translations[code] ?? entry.translations.en ?? entry.sourceText;
    // An empty slot means "no text for this locale": the runtime skips it and
    // falls back to English for that key, exactly as an absent map entry did.
    return typeof text === "string" ? text : "";
  });
  const file = join(outDir, `${code}.json`);
  writeFileSync(file, JSON.stringify(values) + "\n");
  written += 1;
  const filled = values.filter((v) => v.length > 0).length;
  console.log(`  packs/${code}.json — ${filled}/${keys.length} strings`);
}

console.log(
  `i18n packs regenerated: ${written} locales × ${keys.length} barrel keys (positional, + pack-keys.json)`,
);
