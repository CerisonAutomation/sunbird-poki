/**
 * Consolidated locale configuration — Poki-optimized language set.
 * 
 * Poki supports 25+ languages. This list follows Poki's priority:
 * EFIGS + Turkish (core), CJK (Asian markets), major European languages,
 * then high-reach languages (Arabic, Hindi, Indonesian, Vietnamese, Thai).
 * 
 * RTL languages marked for proper layout support.
 */
export type SupportedLocale =
  // Core EFIGS + Turkish
  | "en" | "es" | "de" | "fr" | "it" | "tr"
  // Portuguese variants
  | "pt-BR" | "pt-PT"
  // CJK (East Asian)
  | "zh-CN" | "zh-TW" | "ja" | "ko"
  // European languages
  | "nl" | "pl" | "ru" | "sv" | "da" | "fi" | "no" | "cs" | "sk" | "hu" | "ro" | "bg" | "el" | "uk" | "sr"
  // RTL languages
  | "ar" | "he" | "fa" | "ur"
  // South/Southeast Asian
  | "hi" | "bn" | "id" | "ms" | "vi" | "th" | "tl"
  // Other high-reach
  | "el" | "tr" | "uk";

export const SUPPORTED_LOCALES: { code: SupportedLocale; name: string; flag: string; rtl?: boolean }[] = [
  // Core EFIGS + Turkish
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "tr", name: "Türkçe", flag: "🇹🇷" },
  
  // Portuguese
  { code: "pt-BR", name: "Português (Brasil)", flag: "🇧🇷" },
  { code: "pt-PT", name: "Português (Portugal)", flag: "��" },
  
  // CJK
  { code: "zh-CN", name: "简体中文", flag: "��" },
  { code: "zh-TW", name: "繁體中文", flag: "��" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "ko", name: "한국어", flag: "🇰🇷" },
  
  // European
  { code: "nl", name: "Nederlands", flag: "🇳🇱" },
  { code: "pl", name: "Polski", flag: "🇵🇱" },
  { code: "ru", name: "Русский", flag: "��" },
  { code: "sv", name: "Svenska", flag: "��" },
  { code: "da", name: "Dansk", flag: "🇩🇰" },
  { code: "fi", name: "Suomi", flag: "��" },
  { code: "no", name: "Norsk", flag: "��" },
  { code: "cs", name: "Čeština", flag: "��" },
  { code: "sk", name: "Slovenčina", flag: "��" },
  { code: "hu", name: "Magyar", flag: "��" },
  { code: "ro", name: "Română", flag: "��" },
  { code: "bg", name: "Български", flag: "🇧�" },
  { code: "el", name: "Ελληνικά", flag: "🇬🇷" },
  { code: "uk", name: "Українська", flag: "��" },
  { code: "sr", name: "Српски", flag: "��" },
  
  // RTL
  { code: "ar", name: "العربية", flag: "🇸🇦", rtl: true },
  { code: "he", name: "עברית", flag: "��", rtl: true },
  { code: "fa", name: "فارسی", flag: "��", rtl: true },
  { code: "ur", name: "اردو", flag: "�🇰", rtl: true },
  
  // South/Southeast Asian
  { code: "hi", name: "हिन्दी", flag: "🇮🇳" },
  { code: "bn", name: "বাংলা", flag: "��" },
  { code: "id", name: "Indonesia", flag: "��" },
  { code: "ms", name: "Melayu", flag: "��" },
  { code: "vi", name: "Tiếng Việt", flag: "��" },
  { code: "th", name: "ไทย", flag: "�🇭" },
  { code: "tl", name: "Filipino", flag: "��" },
];
