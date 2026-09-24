import { storage } from "../game/Storage";
// Runtime translation source: per-locale packs projected from the barrel
// (see scripts/gen-i18n-packs.mjs). All locales including English are loaded
// dynamically to avoid circular dependency warnings and improve code splitting.
import { SUPPORTED_LOCALES, type SupportedLocale } from "./locales";

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
 * player sending `pt` or `pt-PT` still lands on `pt-BR`, `zh-Hant` lands on
 * `zh-CN` rather than English, and `ru-RU` lands on `ru`. Returns null when
 * nothing matches (the caller falls back to English).
 */
export function matchLocale(tag: string | null | undefined): SupportedLocale | null {
  if (!tag) return null;
  const normalized = tag.trim().replace(/_/g, "-").toLowerCase();
  if (!normalized) return null;
  // Keep the selector on the canonical BCP-47 labels even though the compact
  // runtime packs retain `pt` and `zh` filenames for backwards compatibility.
  if (normalized === "pt" || normalized.startsWith("pt-")) return "pt-BR";
  if (normalized === "zh" || normalized.startsWith("zh-")) return "zh-CN";
  const exact = SUPPORTED_LOCALES.find((l) => l.code.toLowerCase() === normalized);
  if (exact) return exact.code;
  const prefix = SUPPORTED_LOCALES.find((l) => normalized.startsWith(`${l.code.toLowerCase()}-`));
  if (prefix) return prefix.code;
  const base = normalized.split("-")[0];
  const sameLanguage = SUPPORTED_LOCALES.find((l) => l.code.toLowerCase().split("-")[0] === base);
  if (sameLanguage) return sameLanguage.code;
  // Regional spellings the base tag does not cover directly.
  if (base === "nb" || base === "nn" || base === "no") return null;
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

// Initial document direction set
if (typeof window !== "undefined") {
  updateDocumentDirection();
  // Preload English pack as fallback
  void loadPack("en");
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

/** Resolves when `locale`'s pack is resident (immediately when already
 * loaded, e.g. English or a repeat switch). False when the pack cannot be
 * fetched — callers keep English text rather than raw keys. */
export async function loadPack(locale: string): Promise<boolean> {
  if (packs.has(locale)) return true;
  
  // Special case for English - load from same pattern as other locales
  const packLocale = locale === "pt-BR" ? "pt" : locale === "zh-CN" ? "zh" : locale;
  const load = PACK_MODULES[`./packs/${packLocale}.json`];
  if (!load) return false;
  try {
    const mod = await load();
    packs.set(locale, mod.default);
    // Also cache as EN if this is English for fallback
    if (locale === "en") {
      EN = mod.default;
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
    let result = rawText;
    for (const [k, v] of Object.entries(params)) {
      const strVal = String(v);
      result = result.split(`{{${k}}}`).join(strVal).split(`{${k}}`).join(strVal);
    }
    return result;
  } catch {
    return defaultText ?? key;
  }
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
