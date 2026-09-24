# Parked game backlog — 2026-09-23

Status: **parked, not abandoned**. On 2026-09-23 the project went Poki-only: the
live queue in [`../HANDOFF.md`](../HANDOFF.md) §5 now holds nothing but Poki
submission and compliance work. Everything below was queued or proposed at that
moment and is kept here so it can be resumed cold, with the reasoning and the
mechanical recipes intact. None of it blocks the Poki submission.

Later on 2026-09-23 the progression-feel work shipped and moved two numbers in
item 7's telemetry list: run-end `happyTime` is now **one call per run at the
celebration peak** plus one per mid-run trophy (not seven sites at 0.8–1.0), and
the ten literal run-end toasts are gone (i18n debt 340 → 330). Read
`src/game/ProgressBeats.ts` before trusting the counts below.

Replaced by: nothing — these items have no successor document. When work resumes
on one of them, move it back into [`../HANDOFF.md`](../HANDOFF.md) §5 and delete
the entry here (this file is a parking bay, not a permanent record).

The state it was parked in: i18n debt 340 · barrel 129 keys × 36 locales ·
1,517 tests / 115 files · portal zips poki 939 KB / crazy 925 KB / generic 924 KB ·
JS budget 1.75 / 2.50 MB.

---

## 1. i18n batches 4+ (debt 312 → 0)

Batches 1–2 shipped (`10ccb07`, `ebf8420`): 23 keys, all of them in `Game.ts`.
The celebration strip then removed ten literal run-end toasts, and **batch 3
shipped 2026-09-23**: all 17 screen titles plus the back button's aria-label
(17 keys × 36 locales), which emptied a whole category — `head()` now translates
by screen id, so the icon lookup in `MenuCatalog.ts` keeps matching on stable
English strings while the player reads their own language. What is left, counted
by `pnpm i18n:audit`:

| Counter | Left | Notes |
|---|---|---|
| `toast` | 220 | ~30 still in `Game.ts`; the rest are in `HUD.ts` and the screen modules |
| `screenTitle` | **0** | batch 3 |
| `ariaLabel` | 44 | batch 3 took the back button, which is on every screen |
| `buttonLabel` | 48 | the natural next batch is `MenuCatalog.ts`: 18 destination titles + 18 details, all of them on the menu grid every player sees |

The bundle-cost blocker (§2) is resolved: a key now costs ~0.45 KB per zip
instead of 0.75 KB, so what is left is the typing.

Order of attack, highest player-visibility per key first:

1. **Competitive layer** — Duel, Race, Ranked, Season (~49 sites). This is the
   surface a returning player sees most and the one with the most numbers in copy.
2. **Shop + economy screens** (~17 sites). Item names and tier names are the
   expensive part: see the caveat in §2.
3. **Profile / settings / scores** (~26 sites).
4. **`Game.ts` leftovers** (~30 sites) — same file, same recipe, cheapest.
5. **`ariaLabel` / `buttonLabel`** (92 sites) — mechanical, low risk, do them in
   one sweep at the end. (`screenTitle` is done — batch 3.)

### The recipe (proven twice, ~1 hour per 12 keys)

1. Pick the sites, then write **one key per distinct sentence shape**, not per
   call site. Duplicates collapse: batch 2 turned 12 sites into 12 keys only
   because none of them shared a shape.
2. Add every key to `src/i18n/translations.barrel.json` with all 36 locales,
   `context`, `sourceText`, and placeholders. Edit it with a Python
   `OrderedDict` (`indent=1`, `ensure_ascii=False`) so key order survives; insert
   after the last sibling prefix, never in the middle of an unrelated group.
3. `sourceText` must equal the `t()` `defaultText` **word for word** — the drift
   test compares them and fails on a single comma.
4. Regenerate the packs: `node scripts/gen-i18n-packs.mjs`.
5. Wire the call sites. Where a number appears in the copy, hoist it into a named
   local (`luckySeconds`, `flightMultiplier`) so the string and the maths read
   from one variable. Watch for a local named `t` shadowing the translator — the
   trophy loop in `Game.ts` did, and had to be renamed `trophy`.
6. `pnpm i18n:audit -- --bless` re-baselines `docs/i18n-debt.json`. The ratchet
   only moves down; a batch that adds untranslated strings fails the gate.

## 2. Bundle cost of the remaining strings — **RESOLVED 2026-09-23**

The problem as it stood: batch 2 cost **+9 KB per zip for 12 keys** (~0.75
KB/key), so translating the remaining strings would have added roughly 250 KB
per zip. The three options listed then — load only the negotiated locale,
split `hud.toast.*` into a lazy chunk, drop `vi`/`mt` — all fail against a
portal zip, which is a *single file*: `import.meta.glob` inlines all 36 packs
into `index.html` no matter how lazily the runtime asks for them. Only making
the data itself smaller works.

What shipped instead: packs are now **positional arrays** aligned with a
`src/i18n/pack-keys.json` shipped once. The 137 key names were repeated 36
times and were **111 KB of the 297 KB payload**; they now cost 3 KB in total.
Measured on the built bundles: `index.html` 2,181 → 2,076 KB and the poki zip
948 → **934 KB** (crazy 921, generic 919). Marginal cost per key **0.75 →
~0.45 KB per zip**, which is what unblocks §1 — the blocker is now only the
typing. `loadPack` refuses a pack whose length disagrees with the key list
(position is meaning), and `locales.test.ts` pins the format, the alignment,
the byte-identical regeneration and a 260 KB ceiling on the whole payload.
`verify:prod` and `audit:zips` stayed green.

## 3. Browser verification of the instant-retry path

The instant-retry flow (crash → retry without a full reload) is unit-tested but
has never been driven in a real browser. `pnpm test:policy`, `pnpm test:artifact`
and the mobile suite need Playwright browsers, which this sandbox cannot download.
Run them on a machine with browsers installed before claiming the path is
verified; if they surface a regression, it is in the retry state machine, not in
the toast layer that was edited around it.

## 4. Funnel analytics backend — **RESOLVED 2026-09-23** (aggregation), *durability still open*

The gap was real: `src/game/Funnel.ts` marked the stages, the client tracked
them, and the beacon threw the position away, because the only fields it carried
were `{k, mode, km}`. Nothing could answer "where do players drop off".

What shipped: the two funnel events now also carry a stage id and its index in
the fixed path (`coarseEvent()` in `src/game/Telemetry.ts` — a pure, exported,
unit-tested projection, so the privacy contract is a test rather than a review
comment), and `server/src/telemetry/TelemetryService.ts` folds them into
per-stage counts. `GET /mp/v1/telemetry/funnel` returns reach, step-to-step
conversion, drop-off, stalls and the worst step; `pnpm funnel:report` prints it
as a table. Verified end to end against a live server with a 40-session
synthetic cohort.

The original plan said "aggregate on anonymous session ids" — it does not, and
that is the better answer. There are no session ids in the sink: a funnel is
built from stage counts alone, so the service stays what its own header says it
is (a trend signal, never a tracking record). Ordering comes from the index the
client sends, so the server keeps no copy of the stage list to drift.

What is still open, and why it is not this item: **durability**. Counters are
in-memory and per-process by design, so D1/D7/D30 cohorts (item 7) need a store
this service deliberately refuses to become. That decision belongs with the
live-traffic item, not here. Two operational limits found while proving it:
portal builds send no telemetry to us at all (read Poki's dashboard — the stages
are already emitted as `measure("player", "funnel-<stage>", "reached")`), and
ingest is rate-limited per IP, so a cohort behind one NAT under-reports.

## 5. `Game.ts` / `HUD.ts` decomposition (P2 from the gameplay audit)

Both files are far past readable size (`Game.ts` ~7k lines, `HUD.ts` ~2k). The
P2 estimate was ~15 hours. It is genuinely last: every extraction touches the
toast sites that §1 is still migrating, so doing it first would double the i18n
work. Do §1 first, then cut along the seams the i18n batches expose.

## 6. Native proofing of `vi` and `mt`

Both locales were machine-produced to reach the 36-locale set (the 34 Poki codes
plus these two plus `auto`). They are structurally valid and pass every gate, but
no native speaker has read them. Until then they are a quality risk in exactly the
two markets they were added for. Proofing is a human task; the barrel is the only
file that needs editing afterwards, then regenerate packs and re-bless the audit.

## 7. Live-traffic cohorts (needs a published portal build)

Events already wired and waiting for real players:

- `speed_peak` — whether the SpeedFeel ramp reads as fast, and at which intensity.
- `growth_ledger` — whether the ledger makes progress legible (tier-up rate).
- `shop_auto_open` — whether the gated auto-open converts without breaking flow.
  This is the one the "don't break player flow" constraint was about: if the
  telemetry shows it interrupting runs, tighten the gate rather than removing it.
- `happyTime` placements — 7 sites at intensities 0.8–1.0; check that the portal
  does not report them as spam.

## 8. Music pass 3 — *the code half shipped 2026-09-23; the asset half is still parked*

Passes 1–2 shipped (`7e6e3a4`, `474d656`, `da8855d`): the arc, the intensity
mapping through `audio.setMusicIntensity`, and the run-shaped progression. The
part of pass 3 that was **code** is now shipped too: arrangement sections
(`MusicArrangement.ts` + `Music.setRunPhase`). A flight re-arranges the band —
take-off breath with the kit held back, the tuned mix in cruise, a brightened
and thinned apex, a landing cadence that removes the rhythm section for six
seconds and survives the immediate mode flip back to the menu. Cruise and menu
are neutral by construction (every multiplier exactly 1) and pinned by an
integration test that compares the real gain values, so this cannot silently
re-tune the shipped score.

What is **still parked** is the part that was never code: real composed material
— a 30–45 s run arc and a ~2 min menu loop, roughly 1.5 MB of audio. Synthesis
has taken this as far as it goes. Constraint unchanged: audio must not land in
the initial download for the portal zips, so recorded material has to be
lazy-loaded and counted against the same budget as §2 (which is now ~0.45 KB per
string-key and 934 KB for the poki zip, leaving room — but 1.5 MB of audio does
not belong *inside* a zip that size; it belongs behind a fetch with the
synthesis engine as its fallback).

---

## Deliberately *not* here

These were on earlier lists and are already shipped, so they must not be
re-queued: rival ghosts (`src/game/RivalGhost.ts`), the rubber-band disclosure
(`HUD.ts` fairness line, translated, and it switches off for rated races), the
gated shop auto-open (`Game.ts` ~3072, telemetry `shop_auto_open`), the growth
ledger (`93aac0b`), SpeedFeel (`474d656`), the music run arc (`da8855d`), and
toast batches 1–2 (`10ccb07`, `ebf8420`).
