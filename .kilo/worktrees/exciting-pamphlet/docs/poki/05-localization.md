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
| `LOC-04` | Phase 1 (**EFIGS + Turkish**): `en`, `fr`, `it`, `de`, `es`, **`tr`**. Phase 2 CJK: **`zh-CN`, `ja`** (Korean pending). Phase 3: **`pt-BR`, `ru`**. Arabic (`ar`) and Maltese (`mt`) are additional. **12 locales shipped**, exceeding the guide's recommended first phase and completing its final phase. |
| `LOC-05` | Browser-language detection runs at boot (`navigator.language` prefix match against the supported set), the choice is persisted through the storage facade (private-mode safe), and a manual language selector stays available in Settings. RTL is handled for `ar` via `documentElement.dir`. |

### Locale coverage status

| Phase (per `LOC-04`) | Locales | Shipped |
|---|---|---|
| 1 — EFIGS + Turkish | `en`, `fr`, `it`, `de`, `es`, `tr` | ✅ |
| 2 — CJK | `zh-CN`, `ja` (Korean is the remaining item) | ✅ (partial) |
| 3 — Final additions | `pt-BR`, `ru` | ✅ |
| Additional | `ar` (RTL), `mt` | ✅ |

New locale strings are added to the barrel only — never inline in a component —
and `src/i18n/__tests__` (plus `pnpm poki:audit`) assert that every shipped
locale covers every barrel entry with all placeholders preserved.
