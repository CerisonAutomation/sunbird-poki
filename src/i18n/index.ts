import { storage } from "../game/Storage";
// Runtime translation source: per-locale packs projected from the barrel
// (see scripts/gen-i18n-packs.mjs). All locales including English are loaded
// dynamically to avoid circular dependency warnings and improve code splitting.
import { SUPPORTED_LOCALES, type SupportedLocale } from "./locales";
import packKeys from "./pack-keys.json";

// Re-exported so every existing `from "./i18n"` import keeps working. The data
// itself lives in ./locales, which has no imports and so is safe to load in
// Node (the e2e specs and tooling read it without a bundler).
export { SUPPORTED_LOCALES };
export type { SupportedLocale };

const LOCALE_STORAGE_KEY = "sunbird.i18n.locale";

/**
 * Match a BCP-47 browser tag against the shipped set (LOC-05: "ideally detect
 * the player's browser language and serve the content accordingly").
 *
 * Exact tag → same-language region variant → base language, so a Brazilian
 * player sending `pt-BR` and a Portuguese player sending `pt-PT` both land on
 * `pt`, `zh-Hant` lands on `zh` rather than English, and `ru-RU` lands on `ru`.
 * Returns null when nothing matches (the caller falls back to English).
 */
export function matchLocale(tag: string | null | undefined): SupportedLocale | null {
  if (!tag) return null;
  const normalized = tag.trim().replace(/_/g, "-").toLowerCase();
  if (!normalized) return null;
  const exact = SUPPORTED_LOCALES.find((l) => l.code.toLowerCase() === normalized);
  if (exact) return exact.code;
  const prefix = SUPPORTED_LOCALES.find((l) => normalized.startsWith(`${l.code.toLowerCase()}-`));
  if (prefix) return prefix.code;
  // Fold a regional tag down to its base language: `pt-BR`, `zh-Hant-TW`,
  // `ru-RU` and `nb-NO` all resolve here rather than falling through to
  // English. An earlier revision short-circuited `no`/`nb`/`nn` to `null`,
  // which made Norwegian permanently unmatchable even though it ships.
  const base = normalized.split("-")[0];
  const sameLanguage = SUPPORTED_LOCALES.find((l) => l.code.toLowerCase().split("-")[0] === base);
  if (sameLanguage) return sameLanguage.code;
  return null;
}

let currentLocale: SupportedLocale = "en";

function initLocale(): SupportedLocale {
  try {
    const saved = storage.getItem(LOCALE_STORAGE_KEY);
    if (saved && SUPPORTED_LOCALES.some((l) => l.code === saved)) {
      return saved as SupportedLocale;
    }
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    const candidates = [nav?.language, ...(nav?.languages ?? [])].filter(Boolean) as string[];
    for (const candidate of candidates) {
      const match = matchLocale(candidate);
      if (match) return match;
    }
  } catch {
    /* private mode */
  }
  return "en";
}

currentLocale = initLocale();

export function isRTL(locale = currentLocale): boolean {
  return SUPPORTED_LOCALES.find((l) => l.code === locale)?.rtl === true;
}

export function updateDocumentDirection(): void {
  if (typeof document === "undefined") return;
  const rtl = isRTL(currentLocale);
  document.documentElement.dir = rtl ? "rtl" : "ltr";
  document.documentElement.lang = currentLocale;
}

export function getLocale(): SupportedLocale {
  return currentLocale;
}

/**
 * Adopt the language the portal reports for this player.
 *
 * The localization guide asks for the player's language to be served
 * automatically, and on Poki that is `PokiSDK.getLanguage()` rather than
 * `navigator.language` — it reflects the player's Poki account and region, not
 * just the browser. An explicit in-game choice always wins, so this only runs
 * when nothing has been saved yet, and it returns whether it changed anything
 * so the caller can re-render.
 */
export async function adoptPortalLocale(language: string | null): Promise<boolean> {
  if (!language) return false;
  try {
    if (storage.getItem(LOCALE_STORAGE_KEY)) return false;
  } catch {
    /* private mode: fall through and adopt */
  }
  const match = matchLocale(language);
  if (!match || match === currentLocale) return false;
  await setLocale(match);
  return true;
}

/**
 * Switch locale. Loads the target pack FIRST, then flips the active locale —
 * callers re-render after the returned promise resolves, so UI never paints
 * half-switched text. On pack failure the switch still proceeds (English
 * text renders; direction and persistence stay correct).
 */
export async function setLocale(locale: SupportedLocale): Promise<void> {
  if (!SUPPORTED_LOCALES.some((l) => l.code === locale)) return;
  await loadPack(locale);
  currentLocale = locale;
  try {
    storage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* private mode */
  }
  updateDocumentDirection();
  // Notify even when the pack was already resident (cached switch): React
  // bindings key on this version, and imperative UIs re-render on it.
  packVersion += 1;
  for (const fn of packListeners) fn();
}

/* --------------------------------------------------------- pack registry */

type Pack = Record<string, string>;

/** Lazy fallback pack (English). Generated from the barrel; total by the
 * coverage contract (every shipped locale, every key — locales.test.ts). */
let EN: Pack = {};

const packs = new Map<string, Pack>();

/** Vite-native per-file dynamic imports: each pack becomes its own chunk. */
const PACK_MODULES = import.meta.glob("./packs/*.json") as Record<
  string,
  () => Promise<{ default: Pack }>
>;

let packVersion = 0;
const packListeners = new Set<() => void>();

/**
 * Initial document direction set.
 *
 * This calls `loadPack` during module evaluation, so it MUST stay below the
 * registry above: `const packs`, `packVersion` and `packListeners` are in the
 * temporal dead zone until their declarations are evaluated, and calling
 * `loadPack("en")` from above them threw
 * `ReferenceError: Cannot access 'packs' before initialization` on every cold
 * boot — in the real game and in 24 test files.
 */
if (typeof window !== "undefined") {
  updateDocumentDirection();
  // Preload English pack as fallback
  void loadPack("en");
}

/** Resolves when `locale`'s pack is resident (immediately when already
 * loaded, e.g. English or a repeat switch). False when the pack cannot be
 * fetched — callers keep English text rather than raw keys. */
export async function loadPack(locale: string): Promise<boolean> {
  if (packs.has(locale)) return true;

  // One pack per supported locale, same filename as the code. The old mapping
  // special-cased `pt-BR` → `pt` and `zh-CN` → `zh` because the locale list
  // carried region codes; `matchLocale()` already folds a regional tag
  // ("pt-BR", "zh-CN") down to its base before this runs, so the indirection
  // only ever hid a missing pack.
  const load = PACK_MODULES[`./packs/${locale}.json`];
  if (!load) return false;
  try {
    const mod = await load();
    // A slot is `string | null`: the generator collapses every cell that is
    // byte-identical to English down to `null` rather than storing the same
    // characters twice. Skipping those slots leaves the key absent from the
    // pack, so `t()`'s `pack[key] ?? EN[key]` resolves it to English — the
    // same result, without the duplicated bytes in the shipped payload.
    const packArray = (mod.default as unknown) as (string | null)[];
    // Convert array pack to object pack using pack-keys mapping
    const packObj: Pack = {};
    for (let i = 0; i < packArray.length; i++) {
      const key = packKeys[i];
      const text = packArray[i];
      if (key && text != null) {
        packObj[key] = text;
      }
    }
    packs.set(locale, packObj);
    // Also cache as EN if this is English for fallback
    if (locale === "en") {
      EN = packObj;
    }
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

/** Subscribe to pack arrivals (locale switches / late loads). */
export function subscribePacks(fn: () => void): () => void {
  packListeners.add(fn);
  return () => packListeners.delete(fn);
}

/** Monotonic pack-registry version — React sync knob (useTranslations). */
export function getPackVersion(): number {
  return packVersion;
}

/**
 * Translate `key` into the current locale.
 * Precedence (matches the barrel-era behavior): current-pack text →
 * English pack text → defaultText → key. Supports {{var}} / {var}.
 */
export function t(key: string, params?: Record<string, string | number>, defaultText?: string): string {
  try {
    const pack = packFor(currentLocale);
    const rawText = pack[key] ?? EN[key] ?? defaultText;
    if (!rawText) return defaultText ?? key;
    if (!params) return rawText;
    // Pluralisation happens BEFORE interpolation so a translator can put the
    // form in the middle of the sentence, where most languages put it.
    const forms = params["forms"];
    const resolved: Record<string, string | number> = { ...params };
    if (typeof forms === "string" && forms.includes("|")) {
      resolved["n"] = plural(Number(params["count"] ?? params["n"] ?? 0), forms);
      delete resolved["forms"];
    }
    let result = rawText;
    for (const [k, v] of Object.entries(params)) {
      const strVal = String(resolved[k] ?? v);
      result = result.split(`{{${k}}}`).join(strVal).split(`{${k}}`).join(strVal);
    }
    return result;
  } catch {
    return defaultText ?? key;
  }
}

/**
 * Plural forms, CLDR-style.
 *
 * Assembling plurals in English (`n === 1 ? "day" : "days"`) and interpolating
 * the noun afterwards is wrong in every language that is not English, and
 * actively broken in the ones with three or more forms: Russian needs
 * one/few/many, Arabic needs six. The tournament card shipped exactly that, so
 * it read "ends in 2 day" wherever the translator had no other option.
 *
 * The translator supplies the FORMS and the rule picks one:
 *
 *   t("hud.cup.endsIn", { n: 2, forms: "day|days" })   // 2 days
 *   t("hud.cup.endsIn", { n: 5, forms: "день|дня|дней" }) // 5 дней
 *
 * `forms` is pipe-separated and may be a single form. A locale that has not
 * been translated falls back to the English source, which is two forms, so
 * English keeps working and a partial translation is never worse than today.
 */
const ONE_FORM_LANGS = new Set(["ja", "zh", "ko", "th", "vi", "id", "ms"]);

function pluralFormIndex(count: number, locale: string): number {
  if (ONE_FORM_LANGS.has(locale)) return 0;
  const lang = locale.split("-")[0]!;
  // Slavic three-form rule (ru, uk, pl and friends).
  if (["ru", "uk", "be", "pl"].includes(lang)) {
    const n = Math.abs(count);
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 0;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 1;
    return 2;
  }
  return count === 1 ? 0 : 1;
}

/** The pluralised noun for `count` in the active locale. */
export function plural(count: number, forms: string, locale = currentLocale): string {
  const list = forms.split("|");
  if (list.length === 1) return list[0]!;
  return list[Math.min(pluralFormIndex(count, locale), list.length - 1)]!;
}

/**
 * International number formatting — the currency readouts (coin counter, wallet
 * totals, run bonuses) go through this so grouping and the decimal separator
 * follow the player's chosen language rather than the browser's.
 *
 * A `formatDistanceLocalized` used to sit beside this one with a *different*
 * contract from `formatDistance` in `./math` (one fraction digit instead of
 * two) and no callers. Distance formatting now lives in `formatDistance(m,
 * locale)`, which keeps its English output byte-identical for the layout
 * fixtures and localises only the digits. There is one distance formatter.
 */
export function formatNumberLocalized(num: number, locale = currentLocale): string {
  try {
    return new Intl.NumberFormat(locale).format(num);
  } catch {
    return String(Math.round(num));
  }
}
