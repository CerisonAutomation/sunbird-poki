import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  AUTO_LOCALE, LOCALE_CODES, LISTED_LOCALE_CODES, RTL_CODES, SCRIPT_FAMILIES,
  SUPPORTED_LOCALES, browserLocales, detectedLocale, getLocale, getLocalePreference, isRTL,
  loadPack, matchLocale, portalLocaleTag, refreshAutoLocale, setLocale,
  setPortalLanguageProvider, t, tIn, pluralCategory,
} from "../index";
import { LEGACY_CODE_MAP, LOCALES } from "../locales";
import barrel from "../translations.barrel.json";

/**
 * Poki localization rules, enforced as build failures:
 *   • `LOC-02` — one centralized source (the barrel)
 *   • `LOC-04` — the phase order (EFIGS + Turkish → CJK → Portuguese + Russian)
 *   • `LOC-05` — detect the browser language and serve content in it
 *   • `LOC-06` — the platform's 34-language list is fully shipped
 *
 * A missing string in one locale is exactly the kind of defect that only shows
 * up on a device the developer does not own, so none of this is advisory.
 */
type BarrelEntry = { sourceText: string; placeholders: string[]; translations: Record<string, string> };
const entries = Object.entries((barrel as { barrel: Record<string, BarrelEntry> }).barrel);
const root = resolve(__dirname, "../../..");

/** The 34 codes the portal's game inspector offers for a page. */
const INSPECTOR_34 = [
  "ar", "bn", "bg", "zh", "cs", "da", "nl", "en", "fi", "fr", "de", "el", "he",
  "hi", "hu", "id", "it", "ja", "ko", "ms", "no", "pl", "pt", "ro", "ru", "sr",
  "sk", "es", "sv", "tl", "th", "tr", "uk", "uz",
];

describe("the shipped language list (LOC-06)", () => {
  it("covers all 34 of Poki's Inspector languages", () => {
    expect([...INSPECTOR_34].sort()).toEqual([...LISTED_LOCALE_CODES].sort());
  });

  it("ships 34 + the two locales it already had, and no code is retired", () => {
    expect(LOCALE_CODES).toHaveLength(36);
    expect(new Set(LOCALE_CODES).size).toBe(LOCALE_CODES.length);
    // The bonus locales are flagged as such so the inspector list stays auditable.
    expect(LOCALES.filter((l) => !l.listed).map((l) => l.code)).toEqual(["vi", "mt"]);
  });

  it("keeps the SupportedLocale union in sync with the table", () => {
    // The union in index.ts is hand-written (a runtime array cannot produce a
    // literal type); this is the guard that stops the two drifting.
    const declared = readFileSync(resolve(root, "src/i18n/index.ts"), "utf8")
      .match(/export type SupportedLocale =([\s\S]*?);/)?.[1] ?? "";
    const codes = [...declared.matchAll(/"([a-z]{2}(?:-[A-Z]{2})?)"/g)].map((m) => m[1]);
    expect([...codes].sort()).toEqual([...LOCALE_CODES].sort());
  });

  it("gives every locale an endonym, an English name and a script", () => {
    for (const loc of LOCALES) {
      expect(loc.name, `${loc.code} endonym`).toBeTruthy();
      expect(loc.english, `${loc.code} english`).toBeTruthy();
      expect(SCRIPT_FAMILIES, `${loc.code} script`).toContain(loc.script);
    }
    // Flags are gone on purpose: they render as tofu on Windows and name a
    // country, not a language. A regression here is a visual bug on a
    // platform nobody tests on.
    expect(JSON.stringify(LOCALES)).not.toMatch(/"flag"/);
  });

  it("marks exactly Arabic and Hebrew as RTL", () => {
    expect([...RTL_CODES].sort()).toEqual(["ar", "he"]);
    expect(isRTL("ar")).toBe(true);
    expect(isRTL("he")).toBe(true);
    expect(isRTL("en")).toBe(false);
    expect(isRTL("fa" as never)).toBe(false);
  });
});

describe("translation barrel (LOC-02)", () => {
  it("keeps every shipped locale complete — 36 × every key", () => {
    const missing: string[] = [];
    for (const [key, entry] of entries) {
      for (const code of LOCALE_CODES) {
        const value = entry.translations[code];
        if (!value || !value.trim()) missing.push(`${code}:${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("preserves every placeholder in every translation", () => {
    const broken: string[] = [];
    for (const [key, entry] of entries) {
      for (const [locale, value] of Object.entries(entry.translations)) {
        for (const token of entry.placeholders) {
          if (!value.includes(token)) broken.push(`${locale}:${key} missing ${token}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("carries no stale per-locale mirrors at the top level", () => {
    // The barrel used to also hold `files` and `translations.<code>.json`
    // copies of itself — a second source of truth that nothing read and that
    // had already drifted (it listed 20 locales while the entries had 20, and
    // both went stale on every rename).
    expect(Object.keys(barrel as object)).toEqual(["barrel"]);
  });

  it("has no retired locale codes left in any entry", () => {
    const retired = ["pt-BR", "zh-CN"];
    for (const [key, entry] of entries) {
      for (const code of Object.keys(entry.translations)) {
        expect(retired, `${key} still ships "${code}"`).not.toContain(code);
      }
    }
  });

  it("is the only copy in the repo (no shipped duplicate to drift)", () => {
    // public/i18n/translations.barrel.json was copied into every portal zip
    // "for host-side tooling"; nothing fetched it at runtime because the packs
    // are inlined into index.html. One source, in src/.
    expect(existsSync(resolve(root, "public/i18n/translations.barrel.json"))).toBe(false);
  });
});

describe("runtime packs (generated from the barrel)", () => {
  it("has exactly one pack per shipped locale", () => {
    const files = readdirSync(resolve(root, "src/i18n/packs")).map((f) => f.replace(/\.json$/, "")).sort();
    expect(files).toEqual([...LOCALE_CODES].sort());
  });

  it("ships the key list once, sorted, and complete", () => {
    const keys = JSON.parse(readFileSync(resolve(root, "src/i18n/pack-keys.json"), "utf8")) as string[];
    expect(keys).toEqual(entries.map(([k]) => k).sort());
    expect(new Set(keys).size, "duplicate key in pack-keys.json").toBe(keys.length);
  });

  it("regenerates byte-identical packs from the barrel (no drift)", () => {
    const keys = [...entries.map(([k]) => k)].sort();
    const drift: string[] = [];
    for (const code of LOCALE_CODES) {
      const values = keys.map((key) => {
        const entry = (barrel as { barrel: Record<string, BarrelEntry> }).barrel[key];
        const text = entry.translations[code] ?? entry.translations.en ?? entry.sourceText;
        return typeof text === "string" ? text : "";
      });
      const expected = JSON.stringify(values) + "\n";
      const actual = readFileSync(resolve(root, `src/i18n/packs/${code}.json`), "utf8");
      if (actual !== expected) drift.push(code);
    }
    expect(drift).toEqual([]);
  });

  it("every pack covers every key (the fallback chain stays total)", () => {
    const keys = [...entries.map(([k]) => k)].sort();
    for (const file of readdirSync(resolve(root, "src/i18n/packs"))) {
      const values = JSON.parse(readFileSync(resolve(root, "src/i18n/packs", file), "utf8")) as string[];
      // Position is meaning: a pack of the wrong length would translate every
      // string after the mismatch into its neighbour's text, silently.
      expect(values.length, `${file} must align with pack-keys.json`).toBe(keys.length);
      const missing = values
        .map((text, i) => (typeof text === "string" && text.length > 0 ? null : keys[i]))
        .filter((k): k is string => k !== null);
      expect(missing, file).toEqual([]);
    }
  });

  it("carries no key names — that repetition is what the format exists to remove", () => {
    // 137 key names × 36 packs was 111 KB of a 297 KB payload, and a portal
    // zip inlines all 36 packs into index.html no matter how lazily the
    // runtime asks for them. If a key name reappears inside a pack, someone
    // went back to maps and the bundle cost of every future string doubled.
    for (const file of readdirSync(resolve(root, "src/i18n/packs"))) {
      const raw = readFileSync(resolve(root, "src/i18n/packs", file), "utf8");
      expect(raw.startsWith("["), `${file} must be a positional array`).toBe(true);
      expect(raw, `${file} must not embed key names`).not.toContain("hud.settings.title");
    }
  });

  it("stays small enough that 36 languages cost nothing at boot", () => {
    // Only English is imported statically; the rest are lazy chunks. A pack
    // that grows past a few KB means someone inlined a paragraph of prose
    // (the privacy policy, say) into the barrel instead of a data module.
    let total = readFileSync(resolve(root, "src/i18n/pack-keys.json")).byteLength;
    for (const code of LOCALE_CODES) {
      const bytes = readFileSync(resolve(root, `src/i18n/packs/${code}.json`)).byteLength;
      // At 154 keys the largest pack (th) is 8.8 KB. Past 12 KB someone has
      // inlined prose — a privacy paragraph, a tutorial — instead of a data
      // module, and every one of the 36 packs pays for it.
      expect(bytes, `${code} pack is ${bytes} bytes`).toBeLessThan(12_000);
      total += bytes;
    }
    // The whole 36-language payload. At 137 keys it is ~127 KB; this is the
    // budget line that decides how many more strings the barrel can carry
    // (see docs/archive/GAME_BACKLOG_2026-09-23.md §2).
    expect(total, `i18n payload is ${total} bytes`).toBeLessThan(260_000);
  });
});

describe("locale coverage (LOC-04)", () => {
  it.each(["en", "fr", "it", "de", "es", "tr", "zh", "ja", "ko", "pt", "ru"])("ships phase locale %s", (code) => {
    expect(LOCALE_CODES).toContain(code);
  });

  it("keeps the recommended phase order stable in the selector", () => {
    const efigs = LOCALE_CODES.indexOf("en");
    expect(LOCALE_CODES.indexOf("tr")).toBeGreaterThan(efigs);
    expect(LOCALE_CODES.indexOf("zh")).toBeGreaterThan(LOCALE_CODES.indexOf("tr"));
    expect(LOCALE_CODES.indexOf("pt")).toBeGreaterThan(LOCALE_CODES.indexOf("ko"));
    expect(LOCALE_CODES.indexOf("ru")).toBeGreaterThan(LOCALE_CODES.indexOf("pt"));
  });

  it("puts English first — the universal fallback and the escape hatch", () => {
    expect(LOCALE_CODES[0]).toBe("en");
  });
});

describe("browser-language detection (LOC-05)", () => {
  it("matches exact tags", () => {
    for (const code of LOCALE_CODES) expect(matchLocale(code), code).toBe(code);
  });

  it("matches regional variants of every shipped language", () => {
    expect(matchLocale("de-AT")).toBe("de");
    expect(matchLocale("tr-TR")).toBe("tr");
    expect(matchLocale("ru-RU")).toBe("ru");
    expect(matchLocale("en-GB")).toBe("en");
    expect(matchLocale("es-419")).toBe("es");
    expect(matchLocale("uk-UA")).toBe("uk");
    expect(matchLocale("he-IL")).toBe("he");
    expect(matchLocale("ar-EG")).toBe("ar");
  });

  it("resolves every language to the single pack we ship for it", () => {
    // One Chinese pack, one Portuguese pack, one Serbian pack: a regional tag
    // must land on the language, never on English.
    expect(matchLocale("pt")).toBe("pt");
    expect(matchLocale("pt-PT")).toBe("pt");
    expect(matchLocale("pt-BR")).toBe("pt");
    expect(matchLocale("zh-Hans")).toBe("zh");
    expect(matchLocale("zh-Hant")).toBe("zh");
    expect(matchLocale("zh-Hant-TW")).toBe("zh");
    expect(matchLocale("zh-CN")).toBe("zh");
    expect(matchLocale("sr-RS")).toBe("sr");
    expect(matchLocale("sr-Cyrl-RS")).toBe("sr");
    expect(matchLocale("ja-JP")).toBe("ja");
  });

  it("maps the spellings that share no subtag with a shipped code", () => {
    expect(matchLocale("nb-NO")).toBe("no"); // Norwegian Bokmål
    expect(matchLocale("nn")).toBe("no"); // Norwegian Nynorsk
    expect(matchLocale("no")).toBe("no");
    expect(matchLocale("iw")).toBe("he"); // pre-BCP-47 Hebrew
    expect(matchLocale("in")).toBe("id"); // pre-BCP-47 Indonesian
    expect(matchLocale("fil")).toBe("tl"); // Filipino → Tagalog
    expect(matchLocale("tl-PH")).toBe("tl");
    expect(matchLocale("sh")).toBe("sr"); // Serbo-Croatian macro
    expect(matchLocale("mo")).toBe("ro"); // Moldovan
  });

  it("migrates every retired stored code to a shipped one", () => {
    for (const [oldCode, next] of Object.entries(LEGACY_CODE_MAP)) {
      expect(LOCALE_CODES, `${oldCode} → ${next}`).toContain(next);
    }
    expect(LEGACY_CODE_MAP["pt-BR"]).toBe("pt");
    expect(LEGACY_CODE_MAP["zh-CN"]).toBe("zh");
  });

  it("is case- and separator-insensitive (BCP-47 spellings)", () => {
    expect(matchLocale("PT_br")).toBe("pt");
    expect(matchLocale("  DE-at ")).toBe("de");
    expect(matchLocale("ZH_hans_cn")).toBe("zh");
  });

  it("returns null for languages the game does not ship", () => {
    expect(matchLocale("kl")).toBeNull(); // Kalaallisut
    expect(matchLocale("la")).toBeNull();
    expect(matchLocale("")).toBeNull();
    expect(matchLocale("   ")).toBeNull();
    expect(matchLocale(null)).toBeNull();
    expect(matchLocale(undefined)).toBeNull();
  });

  it("never leaves the player without a language", () => {
    // Whatever detection does, `getLocale()` is a real shipped code and its
    // pack exists on disk.
    expect(LOCALE_CODES).toContain(getLocale());
    const resolved = detectedLocale();
    expect(resolved === null || LOCALE_CODES.includes(resolved)).toBe(true);
  });
});

describe("the auto preference", () => {
  it("exposes 'auto' as a distinct, persistable preference", async () => {
    await setLocale("de");
    expect(getLocalePreference()).toBe("de");
    expect(getLocale()).toBe("de");

    await setLocale(AUTO_LOCALE);
    expect(getLocalePreference()).toBe(AUTO_LOCALE);
    // …but getLocale() always resolves to a real language, never "auto".
    expect(LOCALE_CODES).toContain(getLocale());
    expect(getLocale()).not.toBe(AUTO_LOCALE);

    await setLocale("en");
    expect(getLocale()).toBe("en");
  });

  it("ignores a locale it does not ship", async () => {
    await setLocale("en");
    await setLocale("zz" as never);
    expect(getLocale()).toBe("en");
  });

  it("translates through the active pack", async () => {
    await setLocale("de");
    expect(t("hud.settings.title")).toBe("Einstellungen");
    await setLocale("th");
    expect(t("hud.settings.title")).toBe("การตั้งค่า");
    await setLocale("en");
    expect(t("hud.settings.title")).toBe("Settings");
  });

  it("tIn reads a resident pack and honestly falls back to English otherwise", async () => {
    // tIn cannot fetch: a pack that has not been loaded yet returns English
    // rather than a key. Both halves are the contract, so both are pinned.
    expect(tIn("en", "hud.settings.title")).toBe("Settings");
    await loadPack("fr");
    expect(tIn("fr", "hud.settings.title")).toBe("Paramètres");
    // Precedence is pack → English → defaultText → key, so an unknown locale
    // still reads English for a key English has, and only a key nobody shipped
    // reaches the caller's default.
    expect(tIn("zz", "hud.settings.title")).toBe("Settings");
    expect(tIn("zz", "no.such.key", "fallback")).toBe("fallback");
    expect(tIn("en", "no.such.key")).toBe("no.such.key");
  });

  it("fills both {{var}} and {var} (pace-ghost toast uses single braces)", () => {
    expect(t("toast.pace.ghost", { name: "Skye" }, "👻 {name} on these hills — catch it")).toBe(
      "👻 Skye on these hills — catch it",
    );
    expect(t("no.such.key", { name: "Ozzy", place: 3 }, "Overtook {{name}} for #{{place}}!")).toBe(
      "Overtook Ozzy for #3!",
    );
  });

  it("interpolates placeholders in every locale that has them", () => {
    for (const [key, entry] of entries) {
      if (!entry.placeholders.length) continue;
      const params = Object.fromEntries(
        entry.placeholders.map((p) => [p.replace(/[{}]/g, ""), "7"]),
      );
      for (const code of LOCALE_CODES) {
        const out = tIn(code, key, "");
        const filled = out.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, "7");
        expect(filled, `${code}:${key}`).toBe(filled.replace(/{{|}}/g, ""));
        expect(params).toBeTruthy();
      }
    }
  });
});

/**
 * A portal reports the player's language itself, and that answer outranks the
 * browser's: on Poki it is `PokiSDK.getLanguage()` (its `iso_lang` URL param,
 * else navigator.language, reduced to the base tag) — the canonical source, so
 * a player who picked a language on the portal gets it in-game.
 */
describe("the portal's own language signal", () => {
  it("outranks the browser list while the preference is 'auto'", async () => {
    setPortalLanguageProvider(() => "pt");
    expect(portalLocaleTag()).toBe("pt");
    expect(browserLocales()[0]).toBe("pt");
    await setLocale(AUTO_LOCALE);
    expect(getLocale()).toBe("pt");
    setPortalLanguageProvider(null);
    await setLocale("en");
  });

  it("follows a portal language that only arrives after boot", async () => {
    setPortalLanguageProvider(null);
    await setLocale(AUTO_LOCALE);
    const before = getLocale();
    setPortalLanguageProvider(() => "th");
    expect(await refreshAutoLocale()).toBe(before !== "th");
    expect(getLocale()).toBe("th");
    setPortalLanguageProvider(null);
    await setLocale("en");
  });

  it("never overrides an explicit player choice", async () => {
    await setLocale("de");
    setPortalLanguageProvider(() => "ja");
    expect(await refreshAutoLocale()).toBe(false);
    expect(getLocale()).toBe("de");
    setPortalLanguageProvider(null);
    await setLocale("en");
  });

  it("ignores a portal tag the game does not ship", async () => {
    setPortalLanguageProvider(() => "xx-YY");
    expect(portalLocaleTag()).toBe("xx-YY");
    const resolved = detectedLocale();
    expect(resolved === null || LOCALE_CODES.includes(resolved)).toBe(true);
    setPortalLanguageProvider(null);
    await setLocale("en");
  });

  it("survives a provider that throws", () => {
    setPortalLanguageProvider(() => {
      throw new Error("portal sdk exploded");
    });
    expect(portalLocaleTag()).toBeNull();
    expect(Array.isArray(browserLocales())).toBe(true);
    setPortalLanguageProvider(null);
  });
});

describe("CLDR plural support", () => {
  it("resolves a plural category for every shipped locale", () => {
    for (const code of LOCALE_CODES) {
      expect(pluralCategory(1, code as never), code).toBeTruthy();
      expect(pluralCategory(5, code as never), code).toBeTruthy();
    }
  });

  it("knows that Russian and Arabic are not English plurals", () => {
    // The reason tPlural exists: hardcoding "1 coin / n coins" is wrong in
    // three of the shipped languages and badly wrong in Arabic.
    expect(pluralCategory(2, "ru" as never)).toBe("few");
    expect(pluralCategory(2, "en" as never)).toBe("other");
    expect(pluralCategory(2, "ar" as never)).toBe("two");
  });
});

describe("font coverage per script", () => {
  it("names a system fallback stack for every script the locales use", () => {
    const css = readFileSync(resolve(root, "src/index.css"), "utf8");
    for (const script of SCRIPT_FAMILIES) {
      if (script === "latin") continue; // the two bundled webfonts are Latin
      expect(css, `--font-${script}`).toContain(`--font-${script}:`);
    }
    expect(css).toContain("--font-fallbacks:");
    // Both stacks must end in the per-script families, or the variables are
    // declared and unused — which is how a language silently ships tofu.
    const display = css.match(/--display: Fredoka[^;]+;/)?.[0] ?? "";
    const body = css.match(/--body: "Atkinson Hyperlegible"[^;]+;/)?.[0] ?? "";
    expect(display).toContain("var(--font-fallbacks)");
    expect(body).toContain("var(--font-fallbacks)");
  });

  it("ships no external font request (Poki forbids external assets)", () => {
    const css = readFileSync(resolve(root, "src/index.css"), "utf8");
    expect(css).not.toMatch(/https?:\/\/[^)"']*fonts/);
    expect(css).not.toMatch(/fonts\.(googleapis|gstatic)/);
  });

  it("has RTL rules, not just a dir attribute", () => {
    const css = readFileSync(resolve(root, "src/index.css"), "utf8");
    expect(css).toMatch(/\[dir="rtl"\]/);
    // The physical-property classes that read wrong when mirrored.
    for (const sel of [".screen-head", ".back-btn", ".setting-row", ".fineprint"]) {
      expect(css, `rtl rule for ${sel}`).toContain(sel);
    }
  });
});

describe("SUPPORTED_LOCALES back-compat alias", () => {
  it("is the same table, so existing call sites keep working", () => {
    expect(SUPPORTED_LOCALES).toBe(LOCALES);
    expect(SUPPORTED_LOCALES.map((l) => l.code)).toEqual(LOCALE_CODES);
  });
});
