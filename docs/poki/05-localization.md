# Localization — extracted rules

Source: <https://developers.poki.com/guide/localization>

## Rules

| ID | Kind | Rule |
|---|---|---|
| `LOC-01` | recommendation | **Localization is essential for increasing player engagement**, particularly for text-heavy games. Games that are not localized often struggle to gain traction in non-English-speaking regions, which makes localization a critical consideration for any title targeting a worldwide audience. |
| `LOC-02` | requirement | **Prepare the game for localization by centralizing all text into a single file format.** Scattered strings make translation a tedious, error-prone process; a single source makes the pipeline mechanical. |
| `LOC-03` | recommendation | **Prioritise localization** for story-driven, clicker, idle and quiz games — or any title that relies on text to explain mechanics, items or power-ups. |
| `LOC-04` | recommendation | **Language groups, in phase order:** start with **EFIGS (English, French, Italian, German, Spanish) and include Turkish**. Treat **CJK (Simplified Chinese, Japanese, Korean)** as a second phase because costs and complexity are higher. Add **Brazilian-Portuguese and Russian** as the final additions for broad international coverage. |
| `LOC-05` | requirement | **Display languages correctly.** Ideally detect the player's browser language and serve content accordingly. A manual language toggle in the game menu is a simple and effective solution; automating the selection is highly recommended for Poki's diverse global player base. |

## How Sunbird applies this page

| Rule | Implementation |
|---|---|
| `LOC-02` | All user-facing text lives in **one barrel**: `src/i18n/translations.barrel.json`, keyed by dotted id with `sourceText`, `meta` (origin file + context), `placeholders`, and a `translations` map per locale. Lookup goes through `t(key, params, defaultText)` (token substitution for `{{name}}`-style placeholders) and the React `useTranslations()` hook. The barrel is the single file translators touch. |
| `LOC-03` | Sunbird's onboarding, guidance cues, shop, settings and results screens are all text-carrying, so the tutorial and the economy copy are in scope from the start rather than retrofitted. |
| `LOC-04` | Phase 1 (**EFIGS + Turkish**): `en`, `fr`, `it`, `de`, `es`, **`tr`**. Phase 2 CJK: **`zh`, `ja`, `ko`** (all three). Phase 3: **`pt`, `ru`**. **All three recommended phases are complete, plus 24 further locales (36 total)** — see the coverage table below, which is generated against `src/i18n/locales.ts`. |
| `LOC-05` | Browser-language detection runs at boot (`navigator.language` prefix match against the supported set), the choice is persisted through the storage facade (private-mode safe), and a manual language selector stays available in Settings. RTL is handled for `ar` via `documentElement.dir`. |

### Locale coverage status

**36 locales ship today**, not 12. `src/i18n/locales.ts` is the single source
of truth; `pnpm i18n:audit` re-blesses the debt baseline and
`src/i18n/__tests__` pins the barrel, so this table is a summary and not the
authority.

| Phase (per `LOC-04`) | Locales | Shipped |
|---|---|---|
| 1 — EFIGS + Turkish | `en`, `fr`, `it`, `de`, `es`, `tr` | ✅ complete |
| 2 — CJK | `zh`, `ja`, `ko` | ✅ complete |
| 3 — Final additions | `pt`, `ru` | ✅ complete |
| Beyond the guide | `es`, `nl`, `pl`, `sv`, `da`, `fi`, `no`, `cs`, `sk`, `hu`, `ro`, `bg`, `el`, `uk`, `sr`, `ar`, `he`, `hi`, `bn`, `id`, `ms`, `vi`, `th`, `tl`, `mt`, `uz` | ✅ shipped |

Note the locale CODES: the game ships `zh` (Simplified) and `pt` (European
Portuguese), not `zh-CN`/`pt-BR`, and resolves regional variants through
`matchLocale()`. Arabic and Hebrew are RTL via `documentElement.dir`.

New locale strings are added to the barrel only — never inline in a component —
and `src/i18n/__tests__` (plus `pnpm poki:audit`) assert that every shipped
locale covers every barrel entry with all placeholders preserved.
