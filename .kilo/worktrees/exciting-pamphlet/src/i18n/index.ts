/**
 * Sunbird i18n runtime.
 *
 * Shape of the system:
 *   • `locales.ts` — the canonical table of shipped languages (data only).
 *   • `translations.barrel.json` — the single translation source (Poki
 *     `LOC-02`): one entry per key with `sourceText`, `meta`, `placeholders`
 *     and a `translations` map covering **every** shipped locale.
 *   • `packs/<code>.json` + `pack-keys.json` — generated projection of the
 *     barrel (`scripts/gen-i18n-packs.mjs`). A pack is an **array of texts in
 *     `pack-keys.json` order**, not a `{ key: text }` map: a portal zip is one
 *     file, so all 36 packs are inlined into `index.html` however lazily they
 *     are asked for, and repeating 137 key names 36 times was 111 KB of the
 *     payload. English is imported statically as the universal fallback; every
 *     other locale is its own lazy chunk, fetched once on demand, so adding 16
 *     languages costs the boot bundle nothing.
 *   • this file — detection, pack registry, `t()`, and the number/distance
 *     formatters.
 *
 * Detection contract (Poki `LOC-05`): the player's browser language decides
 * the first paint, an explicit choice always wins afterwards, and "Browser
 * language" is a real, selectable preference that keeps re-detecting — so a
 * player who travels, or who shares a device, is never stranded in a language
 * they picked once by accident.
 */
import { storage } from "../game/Storage";
import {
  LEGACY_CODE_MAP,
  LOCALES,
  LOCALE_CODES,
  isLocaleCode,
  isRTLCode,
  localeMeta,
} from "./locales";
import enPack from "./packs/en.json";
import packKeys from "./pack-keys.json";

export { LOCALES, LOCALE_CODES, localeMeta, isLocaleCode, isRTLCode };
export type { LocaleMeta, ScriptFamily } from "./locales";
export { LISTED_LOCALE_CODES, RTL_CODES, SCRIPT_FAMILIES, LEGACY_CODE_MAP } from "./locales";

/** Every shipped language code. Kept in sync with `locales.ts` by
 * `src/i18n/__tests__/locales.test.ts` (it fails if the two drift). */
export type SupportedLocale =
  | "en" | "fr" | "it" | "de" | "es" | "tr"
  | "zh" | "ja" | "ko"
  | "pt" | "ru"
  | "ar" | "bn" | "bg" | "cs" | "da" | "nl" | "fi" | "el" | "he" | "hi"
  | "hu" | "id" | "ms" | "no" | "pl" | "ro" | "sr" | "sk" | "sv" | "tl"
  | "th" | "uk" | "uz"
  | "vi" | "mt";

/** A locale, or `"auto"` — follow the browser. This is what gets persisted
 * and what the selector offers; `getLocale()` always resolves it to a real
 * language. */
export type LocalePreference = SupportedLocale | "auto";

/**
 * Back-compat alias. Older code (and the e2e specs) read
 * `SUPPORTED_LOCALES.map(l => l.code)` / `l.rtl`; the table now carries
 * `english` and `script` too, and the flag emoji are gone (they render as
 * tofu boxes on Windows — see `locales.ts`).
 */
export const SUPPORTED_LOCALES = LOCALES;

/** Poki's 34 Inspector languages plus the two bonus locales = the shipped set. */
export const LOCALE_COUNT = LOCALES.length;

const LOCALE_STORAGE_KEY = "sunbird.i18n.locale";
/** Preference value meaning "follow the browser". */
export const AUTO_LOCALE: LocalePreference = "auto";

/* ------------------------------------------------------------- detection */

/**
 * Regional/legacy spellings that no amount of prefix matching resolves,
 * because the shipped code and the browser tag share no subtag. Kept next to
 * `LEGACY_CODE_MAP` on purpose: that map migrates *stored* values, this one
 * migrates *browser* values, and a reviewer changing one should see the other.
 */
const TAG_ALIASES: Record<string, string> = {
  nb: "no", // Norwegian Bokmål
  nn: "no", // Norwegian Nynorsk
  iw: "he", // Hebrew, pre-BCP-47 code
  in: "id", // Indonesian, pre-BCP-47 code
  fil: "tl", // Filipino → Tagalog pack
  tgl: "tl",
  sh: "sr", // Serbo-Croatian macro
  mo: "ro", // Moldovan
  "zh-hans": "zh",
  "zh-hant": "zh",
};

function normalizeTag(tag: string): string {
  return tag.trim().replace(/_/g, "-").toLowerCase();
}

/**
 * Match a BCP-47 browser tag against the shipped set (`LOC-05`).
 *
 * Resolution order — most specific first, so nothing surprising wins:
 *   1. exact tag (`de`, `pt-br` if it were shipped)
 *   2. alias table (`nb` → `no`, `iw` → `he`, `fil` → `tl`)
 *   3. base subtag alias (`zh-Hans-CN` → `zh`)
 *   4. shipped code used as a prefix (`sr-Latn-RS` → `sr`)
 *   5. base language match (`pt-PT` → `pt`, `ru-RU` → `ru`)
 *   6. `null` — the caller falls back to English
 *
 * Script subtags are deliberately ignored for CJK: Sunbird ships one Chinese
 * pack, so `zh-Hant-TW` reads Chinese rather than English. That is the honest
 * best answer available with the packs we have.
 */
export function matchLocale(tag: string | null | undefined): SupportedLocale | null {
  if (!tag) return null;
  const normalized = normalizeTag(tag);
  if (!normalized) return null;

  if (isLocaleCode(normalized)) return normalized as SupportedLocale;

  const alias = TAG_ALIASES[normalized];
  if (alias && isLocaleCode(alias)) return alias as SupportedLocale;

  const base = normalized.split("-")[0];
  const legacy = LEGACY_CODE_MAP[base] ?? LEGACY_CODE_MAP[normalized];
  if (legacy && isLocaleCode(legacy)) return legacy as SupportedLocale;
  const baseAlias = TAG_ALIASES[base];
  if (baseAlias && isLocaleCode(baseAlias)) return baseAlias as SupportedLocale;
  if (isLocaleCode(base)) return base as SupportedLocale;

  // A shipped regional code matching this tag's language (`xx-YY` form).
  const prefixed = LOCALES.find((l) => normalized.startsWith(`${l.code.toLowerCase()}-`));
  if (prefixed) return prefixed.code as SupportedLocale;

  const sameLanguage = LOCALES.find((l) => l.code.toLowerCase().split("-")[0] === base);
  if (sameLanguage) return sameLanguage.code as SupportedLocale;

  return null;
}

/**
 * A portal can report the player's language itself, and when it does that
 * answer outranks the browser's: it is the language the player chose on the
 * portal. Poki's is canonical — `PokiSDK.getLanguage()` returns the base tag of
 * its `iso_lang` URL parameter, falling back to `navigator.language`.
 *
 * The provider is injected (rather than imported) so this module never depends
 * on the platform layer, and registered once the SDK adapter exists.
 */
let portalLanguageProvider: (() => string | null) | null = null;

export function setPortalLanguageProvider(provider: (() => string | null) | null): void {
  portalLanguageProvider = provider;
}

/** The portal's own language signal, or null. Never throws. */
export function portalLocaleTag(): string | null {
  try {
    const tag = portalLanguageProvider?.();
    return typeof tag === "string" && tag.trim() ? tag.trim() : null;
  } catch {
    return null;
  }
}

/** The browser's own language list, best first. Never throws (SSR/jsdom). */
export function browserLocales(): string[] {
  try {
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    const portal = portalLocaleTag();
    if (!nav) return portal ? [portal] : [];
    const list = [portal, nav.language, ...(nav.languages ?? [])].filter(
      (v): v is string => typeof v === "string" && v.length > 0,
    );
    // `navigator.languages` can repeat entries or arrive unsorted on some
    // WebViews; de-duplicate while preserving the browser's own priority.
    return [...new Set(list)];
  } catch {
    return [];
  }
}

/**
 * What "Browser language" resolves to right now, or `null` when nothing the
 * browser reports is shipped (the caller then uses English).
 */
export function detectedLocale(): SupportedLocale | null {
  for (const tag of browserLocales()) {
    const match = matchLocale(tag);
    if (match) return match;
  }
  return null;
}

/* ---------------------------------------------------------- active state */

let preference: LocalePreference = AUTO_LOCALE;
let currentLocale: SupportedLocale = "en";

/**
 * Re-resolve "Browser language" once a portal reports its own.
 *
 * The portal's answer arrives after this module initialises (the SDK boots
 * asynchronously), so without this a player who picked Portuguese on poki.com
 * would stay on whatever `navigator.language` said. An explicit choice always
 * wins, and nothing happens when the resolution is unchanged. Resolves true
 * when the active locale moved.
 */
export async function refreshAutoLocale(): Promise<boolean> {
  if (preference !== AUTO_LOCALE) return false;
  const next = detectedLocale();
  if (!next || next === currentLocale) return false;
  await setLocale(AUTO_LOCALE);
  return currentLocale === next;
}

function resolvePreference(pref: LocalePreference): SupportedLocale {
  if (pref !== AUTO_LOCALE && isLocaleCode(pref)) return pref as SupportedLocale;
  return detectedLocale() ?? "en";
}

function migrateStoredCode(value: string): string | null {
  const mapped = LEGACY_CODE_MAP[value];
  if (mapped && isLocaleCode(mapped)) return mapped;
  return isLocaleCode(value) ? value : null;
}

function initLocale(): { pref: LocalePreference; resolved: SupportedLocale } {
  try {
    const saved = storage.getItem(LOCALE_STORAGE_KEY);
    if (saved === AUTO_LOCALE) return { pref: AUTO_LOCALE, resolved: resolvePreference(AUTO_LOCALE) };
    if (saved) {
      const migrated = migrateStoredCode(saved);
      if (migrated) {
        // Rewrite a retired code in place so the next boot is a plain read
        // and the selector never shows a stale value.
        if (migrated !== saved) {
          try { storage.setItem(LOCALE_STORAGE_KEY, migrated); } catch { /* read-only store */ }
        }
        return { pref: migrated as SupportedLocale, resolved: migrated as SupportedLocale };
      }
    }
  } catch {
    /* private mode / partitioned iframe: fall through to detection */
  }
  return { pref: AUTO_LOCALE, resolved: resolvePreference(AUTO_LOCALE) };
}

const initial = initLocale();
preference = initial.pref;
currentLocale = initial.resolved;

/* ------------------------------------------------------- document state */

export function isRTL(locale: SupportedLocale = currentLocale): boolean {
  return isRTLCode(locale);
}

/**
 * Publish the active locale to the document: `lang` for screen readers and
 * hyphenation, `dir` for the RTL stylesheet, and `data-script` so CSS can
 * pick a font fallback per writing system without a per-locale selector
 * explosion (one attribute, ten values).
 */
export function updateDocumentDirection(): void {
  if (typeof document === "undefined") return;
  const rtl = isRTL(currentLocale);
  const root = document.documentElement;
  root.dir = rtl ? "rtl" : "ltr";
  root.lang = currentLocale;
  root.dataset.script = localeMeta(currentLocale)?.script ?? "latin";
  root.dataset.locale = currentLocale;
  root.dataset.localeAuto = preference === AUTO_LOCALE ? "true" : "false";
}

/* -------------------------------------------------------------- accessors */

/** The language the UI is currently rendering in (never `"auto"`). */
export function getLocale(): SupportedLocale {
  return currentLocale;
}

/** What the player chose: a language, or `"auto"` for browser detection. */
export function getLocalePreference(): LocalePreference {
  return preference;
}

/** True when the active language came from browser detection, not a choice. */
export function isAutoLocale(): boolean {
  return preference === AUTO_LOCALE;
}

/** Human-readable name of a locale in its own script (selector label). */
export function localeLabel(code: string): string {
  return localeMeta(code)?.name ?? code;
}

/**
 * Switch language — or switch back to following the browser.
 *
 * Loads the target pack FIRST, then flips the active locale: callers re-render
 * after the returned promise resolves, so the UI never paints half-switched
 * text. On pack failure the switch still proceeds (English text renders;
 * direction, `lang` and persistence stay correct) — a flaky network must
 * never strand a player in a broken selector.
 */
export async function setLocale(next: LocalePreference): Promise<void> {
  if (next !== AUTO_LOCALE && !isLocaleCode(next)) return;
  preference = next;
  const resolved = resolvePreference(next);
  await loadPack(resolved);
  currentLocale = resolved;
  try {
    storage.setItem(LOCALE_STORAGE_KEY, next);
  } catch {
    /* private mode */
  }
  updateDocumentDirection();
  // Notify even when the pack was already resident (cached switch): React
  // bindings key on this version, and imperative UIs re-render on it.
  packVersion += 1;
  for (const fn of packListeners) fn();
}

// Initial document direction/lang set.
if (typeof window !== "undefined") {
  updateDocumentDirection();
}

/* --------------------------------------------------------- pack registry */

type Pack = Record<string, string>;

/** A pack on disk: texts positionally aligned with `PACK_KEYS`. */
type PackFile = string[];

/** The canonical key order, shipped once instead of 36 times. */
const PACK_KEYS = packKeys as unknown as PackFile;

/**
 * Positional pack → lookup map. An empty slot means "this locale has no text
 * for that key", so it is *omitted* rather than stored: `t()` then falls back
 * to English for that key exactly as it did when packs were maps and a missing
 * translation was simply an absent property.
 */
function toRecord(values: PackFile): Pack {
  const out: Pack = {};
  const n = Math.min(PACK_KEYS.length, values.length);
  for (let i = 0; i < n; i += 1) {
    const text = values[i];
    if (typeof text === "string" && text.length > 0) out[PACK_KEYS[i]] = text;
  }
  return out;
}

/** Is this a pack we can trust? Position is meaning, so length is integrity. */
function isPackFile(value: unknown): value is PackFile {
  return Array.isArray(value) && value.length === PACK_KEYS.length;
}

/** Eager fallback pack (English). Generated from the barrel; total by the
 * coverage contract (every shipped locale, every key — locales.test.ts). */
const EN = toRecord(enPack as unknown as PackFile);

const packs = new Map<string, Pack>([["en", EN]]);

/** Vite-native per-file dynamic imports: each pack becomes its own chunk. */
const PACK_MODULES = import.meta.glob("./packs/*.json") as Record<
  string,
  () => Promise<{ default: PackFile }>
>;

let packVersion = 0;
const packListeners = new Set<() => void>();

/** Is `locale`'s pack already in memory? */
export function isPackLoaded(locale: string): boolean {
  return packs.has(locale);
}

/** Resolves when `locale`'s pack is resident (immediately when already
 * loaded, e.g. English or a repeat switch). False when the pack cannot be
 * fetched — callers keep English text rather than raw keys. */
export async function loadPack(locale: string): Promise<boolean> {
  if (packs.has(locale)) return true;
  const load = PACK_MODULES[`./packs/${locale}.json`];
  if (!load) return false;
  try {
    const mod = await load();
    // A pack that is not aligned with the key list would translate every
    // string after the mismatch into its neighbour's text — silently, and in
    // whichever language the player chose. Refuse it and stay on English.
    if (!isPackFile(mod.default)) return false;
    packs.set(locale, toRecord(mod.default));
    packVersion += 1;
    for (const fn of packListeners) fn();
    return true;
  } catch {
    return false; // offline + not yet cached: English fallback stays honest
  }
}

/** Internal: current pack for `t()`, falling back to English per key. */
function packFor(locale: string): Pack {
  return packs.get(locale) ?? EN;
}

/**
 * Resolves once the STARTUP locale's pack has loaded. Fired at boot before
 * the game mounts; a no-op await for English (already resident).
 */
export function whenLocaleReady(): Promise<void> {
  return loadPack(currentLocale).then(() => undefined);
}

/**
 * Warm a pack without switching to it — used to prefetch the locale the
 * browser will resolve to, so the first paint after an auto-detect is never
 * English-then-translated.
 */
export function preloadLocale(locale?: string): void {
  void loadPack(locale ?? currentLocale);
}

/** Subscribe to pack arrivals (locale switches / late loads). */
export function subscribePacks(fn: () => void): () => void {
  packListeners.add(fn);
  return () => packListeners.delete(fn);
}

/** Monotonic pack-registry version — React sync knob (useTranslations). */
export function getPackVersion(): number {
  return packVersion;
}

/* ------------------------------------------------------------ translation */

/**
 * Translate `key` into the current locale.
 *
 * Precedence: current pack → English pack → `defaultText` → the key itself.
 * A key that resolves to itself is a *visible* bug (it prints `hud.menu.play`
 * on screen), which is why `scripts/i18n-coverage.mjs` and the barrel tests
 * make "every shipped locale covers every key" a build failure instead.
 *
 * Placeholders accept both `{{var}}` and `{var}` so strings authored for
 * either convention interpolate identically.
 */
export function t(key: string, params?: Record<string, string | number>, defaultText?: string): string {
  try {
    const pack = packFor(currentLocale);
    const rawText = pack[key] ?? EN[key] ?? defaultText;
    if (!rawText) return defaultText ?? key;
    if (!params) return rawText;
    let result = rawText;
    for (const [k, v] of Object.entries(params)) {
      const strVal = String(v);
      // `{{var}}` first so `{var}` cannot nibble the inner of a double-brace
      // token. The previous `{${k}}}` pattern was `{name}}` and never matched
      // `{name}` — which is why the pace-ghost toast printed the placeholder.
      result = result.split(`{{${k}}}`).join(strVal).split(`{${k}}`).join(strVal);
    }
    return result;
  } catch {
    return defaultText ?? key;
  }
}

/** Translate into an explicit locale, ignoring the active one. Used by the
 * coverage tooling and by any surface that must render two languages at once
 * (e.g. showing a rival's own language name next to yours). */
export function tIn(locale: string, key: string, defaultText?: string): string {
  const pack = packs.get(locale);
  return pack?.[key] ?? EN[key] ?? defaultText ?? key;
}

/* ------------------------------------------------------------- formatting */

/** Locale-aware number formatting. Falls back to a plain integer when the
 * runtime has no ICU data for the tag (never throws on a device). */
export function formatNumberLocalized(num: number, locale: SupportedLocale = currentLocale): string {
  try {
    return new Intl.NumberFormat(locale).format(num);
  } catch {
    return String(Math.round(num));
  }
}

/**
 * Locale-aware distance formatting (meters → kilometers at 1 000 m).
 *
 * Units stay metric here: the km/mi switch is a separate player setting
 * (`settings.distUnit`) handled by the caller, so a locale never silently
 * overrides an explicit preference.
 */
export function formatDistanceLocalized(meters: number, locale: SupportedLocale = currentLocale): string {
  const rounded = Math.max(0, Math.round(meters));
  if (rounded >= 1000) {
    const km = (rounded / 1000).toFixed(1);
    return `${formatNumberLocalized(Number(km), locale)} km`;
  }
  return `${formatNumberLocalized(rounded, locale)} m`;
}

/**
 * Locale-aware plural selection, so "1 coin / 2 coins" is correct in Russian
 * (three plural forms) and Arabic (six) rather than hardcoded to English's
 * two. Returns the CLDR category: `zero|one|two|few|many|other`.
 */
export function pluralCategory(count: number, locale: SupportedLocale = currentLocale): string {
  try {
    return new Intl.PluralRules(locale).select(count);
  } catch {
    return count === 1 ? "one" : "other";
  }
}

/**
 * Pick a pluralised variant from the barrel. Convention: a key `x` may ship
 * siblings `x.one`, `x.few`, … and always `x.other`. Missing categories fall
 * back to `x.other`, then to the bare key — so a language with more forms
 * than the author supplied still reads correctly.
 */
export function tPlural(key: string, count: number, params?: Record<string, string | number>): string {
  const category = pluralCategory(count, currentLocale);
  const pack = packFor(currentLocale);
  const variant = pack[`${key}.${category}`] ?? EN[`${key}.${category}`]
    ?? pack[`${key}.other`] ?? EN[`${key}.other`]
    ?? pack[key] ?? EN[key];
  if (!variant) return key;
  return t(`${key}.${category}`, { ...params, count }, variant);
}
