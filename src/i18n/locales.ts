/**
 * Consolidated locale configuration — the ONE shipped language set.
 *
 * This array is the single source of truth, and it is exactly the set of
 * packs in `public/i18n/` (which `scripts/gen-i18n-packs.mjs` derives from
 * the translation barrel). `SupportedLocale` is derived from it rather than
 * hand-written, because the hand-written union had already drifted: it listed
 * `el`, `tr` and `uk` twice, offered `fa` and `ur` with zero translations
 * behind them, and omitted `mt` and `uz`, whose packs shipped unreachable.
 * `src/i18n/__tests__/locales.test.ts` pins the array against the packs, so
 * the two can never diverge again.
 *
 * Poki's localization guide (`docs/poki/05-localization.md`, rule LOC-04)
 * phases this set: EFIGS + Turkish, then CJK, then Brazilian-Portuguese and
 * Russian. All three phases are complete here; the remainder is breadth on
 * top, including the two RTL locales.
 *
 * `rtl` is spelled out on every entry (not omitted on LTR locales) so the
 * `as const` tuple keeps one uniform shape and `.rtl` is always readable.
 */

export const SUPPORTED_LOCALES = [
  { code: "en", name: "English", flag: "🇺🇸", rtl: false },
  { code: "es", name: "Español", flag: "🇪🇸", rtl: false },
  { code: "de", name: "Deutsch", flag: "🇩🇪", rtl: false },
  { code: "fr", name: "Français", flag: "🇫🇷", rtl: false },
  { code: "it", name: "Italiano", flag: "🇮🇹", rtl: false },
  { code: "tr", name: "Türkçe", flag: "🇹🇷", rtl: false },
  { code: "pt", name: "Português", flag: "🇵🇹", rtl: false },
  { code: "zh", name: "简体中文", flag: "🇨🇳", rtl: false },
  { code: "ja", name: "日本語", flag: "🇯🇵", rtl: false },
  { code: "ko", name: "한국어", flag: "🇰🇷", rtl: false },
  { code: "nl", name: "Nederlands", flag: "🇳🇱", rtl: false },
  { code: "pl", name: "Polski", flag: "🇵🇱", rtl: false },
  { code: "ru", name: "Русский", flag: "🇷🇺", rtl: false },
  { code: "sv", name: "Svenska", flag: "🇸🇪", rtl: false },
  { code: "da", name: "Dansk", flag: "🇩🇰", rtl: false },
  { code: "fi", name: "Suomi", flag: "🇫🇮", rtl: false },
  { code: "no", name: "Norsk", flag: "🇳🇴", rtl: false },
  { code: "cs", name: "Čeština", flag: "🇨🇿", rtl: false },
  { code: "sk", name: "Slovenčina", flag: "🇸🇰", rtl: false },
  { code: "hu", name: "Magyar", flag: "🇭🇺", rtl: false },
  { code: "ro", name: "Română", flag: "🇷🇴", rtl: false },
  { code: "bg", name: "Български", flag: "🇧🇬", rtl: false },
  { code: "el", name: "Ελληνικά", flag: "🇬🇷", rtl: false },
  { code: "uk", name: "Українська", flag: "🇺🇦", rtl: false },
  { code: "sr", name: "Српски", flag: "🇷🇸", rtl: false },
  { code: "ar", name: "العربية", flag: "🇸🇦", rtl: true },
  { code: "he", name: "עברית", flag: "🇮🇱", rtl: true },
  { code: "hi", name: "हिन्दी", flag: "🇮🇳", rtl: false },
  { code: "bn", name: "বাংলা", flag: "🇧🇩", rtl: false },
  { code: "id", name: "Bahasa Indonesia", flag: "🇮🇩", rtl: false },
  { code: "ms", name: "Bahasa Melayu", flag: "🇲🇾", rtl: false },
  { code: "vi", name: "Tiếng Việt", flag: "🇻🇳", rtl: false },
  { code: "th", name: "ไทย", flag: "🇹🇭", rtl: false },
  { code: "tl", name: "Filipino", flag: "🇵🇭", rtl: false },
  { code: "mt", name: "Malti", flag: "🇲🇹", rtl: false },
  { code: "uz", name: "Oʻzbekcha", flag: "🇺🇿", rtl: false },
] as const;

/**
 * Derived from the array above, so a locale cannot be typed as supported
 * without actually being shipped — and no code can be listed twice.
 */
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]["code"];
