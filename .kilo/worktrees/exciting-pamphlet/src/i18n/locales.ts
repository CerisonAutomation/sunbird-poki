/**
 * Canonical locale table — the single source of truth for *which* languages
 * Sunbird ships.
 *
 * Why this file exists separately from `index.ts`:
 *   • `index.ts` owns runtime behaviour (pack loading, detection, `t()`).
 *   • this file owns the *data* — codes, endonyms, scripts, direction.
 * Splitting them lets build tooling (`scripts/i18n-coverage.mjs`,
 * `scripts/gen-i18n-packs.mjs`) and tests read the table without importing
 * the storage facade or `import.meta.glob`.
 *
 * Codes are the exact two-letter codes Poki's Inspector offers for a game
 * (see `docs/poki/05-localization.md`, rule `LOC-06`): 34 languages. Two
 * locales the game already shipped — Vietnamese and Maltese — are kept as
 * bonus entries (`listed: false`); removing a working translation is a
 * regression, and neither one breaks the Poki list.
 *
 * Naming rule: `name` is the **endonym** (the language written in its own
 * script). The selector shows endonyms rather than flag emoji on purpose —
 * flag glyphs render as two-letter tofu boxes on Windows and as nothing at
 * all on several Android font sets, and a flag is a country, not a language
 * (`ar` is 20+ countries, `pt` and `pt-BR` share one flag). An endonym is
 * readable by exactly the person who needs it: the player who cannot read
 * the language the menu is currently in.
 */

/** Writing system a locale renders in — drives the font fallback stack. */
export type ScriptFamily =
  | "latin"
  | "cyrillic"
  | "greek"
  | "arabic"
  | "hebrew"
  | "devanagari"
  | "bengali"
  | "thai"
  | "han"
  | "kana"
  | "hangul";

export type LocaleMeta = {
  /** BCP-47 primary subtag used as the pack filename and the selector value. */
  code: string;
  /** Endonym — shown in the language selector. */
  name: string;
  /** English name — used in docs, coverage reports and `lang` debugging. */
  english: string;
  /** Right-to-left: flips `document.dir` and the RTL stylesheet. */
  rtl?: boolean;
  /** Script family: selects the font fallback stack (see `--font-*` in index.css). */
  script: ScriptFamily;
  /**
   * True when the code is one of the 34 languages the portal's game inspector
   * offers as selectable (rule `LOC-06`). The two bonus locales we ship beyond
   * that list are `listed: false`.
   *
   * Named for what it means, not for who asked: the field is data in every
   * bundle, and a property called `poki` is a foreign-portal marker that fails
   * `pnpm verify:portals` on the other two portal builds.
   */
  listed: boolean;
};

/**
 * Selector order. English is first because it is the universal fallback and
 * the most likely "get me out of this language" choice; the rest follows the
 * phase order Poki's localization guide recommends (`LOC-04`) — EFIGS +
 * Turkish, then CJK, then Portuguese + Russian — with the remaining locales
 * alphabetical by English name inside their phase so the list is stable and
 * reviewable rather than hand-shuffled.
 */
export const LOCALES: LocaleMeta[] = [
  // ── Phase 0 — universal fallback ────────────────────────────────────
  { code: "en", name: "English", english: "English", script: "latin", listed: true },

  // ── Phase 1 — EFIGS + Turkish (LOC-04 first batch) ──────────────────
  { code: "fr", name: "Français", english: "French", script: "latin", listed: true },
  { code: "it", name: "Italiano", english: "Italian", script: "latin", listed: true },
  { code: "de", name: "Deutsch", english: "German", script: "latin", listed: true },
  { code: "es", name: "Español", english: "Spanish", script: "latin", listed: true },
  { code: "tr", name: "Türkçe", english: "Turkish", script: "latin", listed: true },

  // ── Phase 2 — CJK ───────────────────────────────────────────────────
  { code: "zh", name: "简体中文", english: "Chinese (Simplified)", script: "han", listed: true },
  { code: "ja", name: "日本語", english: "Japanese", script: "kana", listed: true },
  { code: "ko", name: "한국어", english: "Korean", script: "hangul", listed: true },

  // ── Phase 3 — Portuguese + Russian (LOC-04 final batch) ─────────────
  { code: "pt", name: "Português", english: "Portuguese", script: "latin", listed: true },
  { code: "ru", name: "Русский", english: "Russian", script: "cyrillic", listed: true },

  // ── The rest of the Poki list, alphabetical by English name ─────────
  { code: "ar", name: "العربية", english: "Arabic", script: "arabic", rtl: true, listed: true },
  { code: "bn", name: "বাংলা", english: "Bengali", script: "bengali", listed: true },
  { code: "bg", name: "Български", english: "Bulgarian", script: "cyrillic", listed: true },
  { code: "cs", name: "Čeština", english: "Czech", script: "latin", listed: true },
  { code: "da", name: "Dansk", english: "Danish", script: "latin", listed: true },
  { code: "nl", name: "Nederlands", english: "Dutch", script: "latin", listed: true },
  { code: "fi", name: "Suomi", english: "Finnish", script: "latin", listed: true },
  { code: "el", name: "Ελληνικά", english: "Greek", script: "greek", listed: true },
  { code: "he", name: "עברית", english: "Hebrew", script: "hebrew", rtl: true, listed: true },
  { code: "hi", name: "हिन्दी", english: "Hindi", script: "devanagari", listed: true },
  { code: "hu", name: "Magyar", english: "Hungarian", script: "latin", listed: true },
  { code: "id", name: "Indonesia", english: "Indonesian", script: "latin", listed: true },
  { code: "ms", name: "Melayu", english: "Malay", script: "latin", listed: true },
  { code: "no", name: "Norsk", english: "Norwegian", script: "latin", listed: true },
  { code: "pl", name: "Polski", english: "Polish", script: "latin", listed: true },
  { code: "ro", name: "Română", english: "Romanian", script: "latin", listed: true },
  { code: "sr", name: "Srpski", english: "Serbian", script: "latin", listed: true },
  { code: "sk", name: "Slovenčina", english: "Slovak", script: "latin", listed: true },
  { code: "sv", name: "Svenska", english: "Swedish", script: "latin", listed: true },
  { code: "tl", name: "Tagalog", english: "Tagalog", script: "latin", listed: true },
  { code: "th", name: "ไทย", english: "Thai", script: "thai", listed: true },
  { code: "uk", name: "Українська", english: "Ukrainian", script: "cyrillic", listed: true },
  { code: "uz", name: "Oʻzbekcha", english: "Uzbek", script: "latin", listed: true },

  // ── Bonus locales already shipped before the Poki list was adopted ──
  { code: "vi", name: "Tiếng Việt", english: "Vietnamese", script: "latin", listed: false },
  { code: "mt", name: "Malti", english: "Maltese", script: "latin", listed: false },
];

/** Every shipped code, in selector order. */
export const LOCALE_CODES: string[] = LOCALES.map((l) => l.code);

/** The 34 codes Poki's Inspector offers for a game page. */
export const LISTED_LOCALE_CODES: string[] = LOCALES.filter((l) => l.listed).map((l) => l.code);

/** Right-to-left codes — Arabic and Hebrew. */
export const RTL_CODES: string[] = LOCALES.filter((l) => l.rtl).map((l) => l.code);

/** Distinct script families in use (drives the font-stack test). */
export const SCRIPT_FAMILIES: ScriptFamily[] = [
  ...new Set(LOCALES.map((l) => l.script)),
] as ScriptFamily[];

const BY_CODE = new Map(LOCALES.map((l) => [l.code, l]));

export function localeMeta(code: string): LocaleMeta | undefined {
  return BY_CODE.get(code);
}

/**
 * Plain boolean, NOT a `value is string` predicate: narrowing an already-`string`
 * argument with one makes TypeScript collapse the negative branch to `never`
 * inside `matchLocale`, where the whole point is to keep resolving the tag.
 */
export function isLocaleCode(value: unknown): boolean {
  return typeof value === "string" && BY_CODE.has(value);
}

export function isRTLCode(code: string): boolean {
  return BY_CODE.get(code)?.rtl === true;
}

/**
 * Retired codes → their replacement. Players who chose "Português (Brasil)"
 * or "简体中文" before the codes were aligned to Poki's list keep their
 * language across the rename instead of being dropped back to English.
 * Applied to the persisted preference at boot and rewritten in place.
 */
export const LEGACY_CODE_MAP: Record<string, string> = {
  "pt-BR": "pt",
  "zh-CN": "zh",
  "zh-Hans": "zh",
  "iw": "he",
  "in": "id",
  fil: "tl",
  nb: "no",
  nn: "no",
  sh: "sr",
  mo: "ro",
};
