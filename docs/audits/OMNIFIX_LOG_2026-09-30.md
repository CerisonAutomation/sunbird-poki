# OMNIFIX — fix log against `EXTERNAL_BRUTAL_AUDIT_2026-09-30.md`

Pass 1 (P0 / ship-blocking). Every entry below is landed on
`arena/01a0f277-sunbird-poki`, and the full gate is green after it:
`lint --max-warnings 0` · `typecheck` · `test` (2 662 passing) · `circular:check` ·
`build` · `build:poki` · `i18n:audit` · `poki:audit`.

---

## 1. The game had no skill ceiling — **fixed, measured 1.06× → 1.73×**

The headline finding, and the worst one. Driving the shipped physics for 60 s
across ten terrain seeds:

| policy | before | after |
|---|---|---|
| hold the button forever | **2.23 km** | 1.70 km |
| read the terrain and time releases | 2.16 km | **2.15 km** |
| mash at 8 Hz | 2.08 km | 1.26 km |
| expert ÷ masher | **1.06×** | **1.73×** (worst seed 1.47×) |

Holding a brick on the button was the optimal way to play. Three causes, all of
them code doing the opposite of what its own comment promised:

1. **`GROUND_STICK_DIVE` was applied on every slope, not just flats.**
   `Math.max(GROUND_G_DIVE * downhill, GROUND_STICK_DIVE)` on an uphill returns
   `max(negative, 11)`, so a held stick *accelerated the bird up the hill* —
   directly against the comment three lines above it ("uphill deceleration is
   untouched … the game is still built on climbs costing you"). Now gated on
   the new `GROUND_STICK_FLAT_SLOPE` (0.12), which is the "flatter than about
   1:10" the comment already described.
2. **Tucking made bad landings free.** `if (diving) floor = max(floor, 0.86)`
   meant a held stick turned the worst landing in the game into a 14 % speed
   loss versus 45 % released — deleting the landing-alignment skill entirely.
   Replaced with `LAND_TUCK_BONUS` (+0.08 on the same floor everyone gets).
3. **Nothing rewarded letting go.** Added **the pop**: a release timed inside
   `LAUNCH_POP_WINDOW` (0.45 s) before a crest converts speed into height, by
   up to `LAUNCH_POP_MAX` (26 m/s), scaled by launch speed and timing quality.
   This is the gesture `FirstFlight` was already coaching with "RELEASE at the
   top to launch", which the physics had been ignoring. Sized to sit *with*
   `LaunchSystem`'s existing perfect-lip bonus rather than dwarf it; 44 m/s
   measured better (1.77×) and was rejected on feel.

Pinned by a new `src/game/__tests__/skill-ceiling.test.ts`, which is a fitness
comparison between fixed policies rather than an assertion about a constant —
so it cannot be satisfied by tuning one number, and it fails again the day a
"quality of life" change reintroduces a free ride. It also checks the *floor*
did not rise: a player who only ever holds still flies 1.7 km.

`climb-and-chain.test.ts`'s "does not give the stick a free ride on a climb"
was asserting `held > released` and passing for the wrong reason. Corrected to
the real design: diving into a climb costs **more** than coasting up it.

## 2. A name-entry screen stood in front of the first flight — **removed**

Poki measures conversion to play, and Poki's own post-mortems say it plainly:
"players were getting stuck in menus, so we disabled all extra screens and made
sure they landed directly in gameplay." The gate lived in two places
(`Game.ts` first-boot and the menu-return path, which re-showed it after every
run for anyone who dismissed it). Both are gone; the generated call sign is
accepted silently and renaming moved to Settings. `CUSTOM_PILOT_NAMES` is
untouched, so the two tests that pin it still pass.

## 3. Anti-cheat rejected the best legal runs — **fixed**

The ceiling had been wrong twice. `MAX_SPEED_FEVER + BOOST_EXTRA_SPEED` (170)
was commented as "derived from the physics" while omitting two of the three
multipliers `Game.fixedUpdate()` passes into `Bird.step()`. A fever + boost run
in a 1.08 skin deep into an escalating mode reaches **235.9 m/s** — 39 % over
the gate — so strong endless runs were quarantined as cheating. Now computed
from `MAX_SPEED_FEVER × max(SKINS.speedMult) × MAX_CHALLENGE_SPEED_MULT ×
endlessSpeedScale(∞) + BOOST_EXTRA_SPEED`, with the escalation asymptote
*probed* from the function rather than transcribed. The test drives the real
`Bird` at the worst legal input combination instead of comparing constants.

## 4. Plaintext promo codes granted entitlements — **removed**

`ZENITH`/`SUNBIRD` → Gold and `AURORA` → VIP shipped in cleartext inside the
submission zip, with no server to validate against: one devtools search and the
entire 60 475-coin economy is bypassed permanently. Gone. Four small one-per-
device coin grants remain, and `economy.test.ts` now enforces the rule that no
code may grant an entitlement, a multiplier or a cosmetic.

## 5. Name moderation only spoke English — **fixed**

A filter that only knows English is a filter against English speakers. Added
~120 hard-profanity/slur entries across es, pt, fr, de, nl, it, pl, ru, uk, tr,
el, ar, fa, id, ms, tl, vi, hi, ur, ja, ko and zh, matched through the same
evasion folding. Entries that collided with real names or the game's own
vocabulary were dropped rather than risked — the generator fuzz test caught
"SolarPlover94" (leet-folds to `…verga`), "unique", "principal", "Apollo" — and
an internationalised Scunthorpe test now guards "Cornelia", "Brandi",
"Computer" and friends.

## 6. Two seconds of dead air before the SDK, then a duplicate tag — **fixed**

`ensureSdk()` polled for 2 000 ms before *starting* the CDN download. Window cut
to 800 ms. The packaging step already injected Poki's tag into `<head>`; a
static tag added in `index.html` during this pass duplicated it, so the static
tag was reverted and the injected one now carries `data-sunbird-sdk="poki"` so
the adapter adopts it instead of ever injecting a second copy. Verified: exactly
one `<script … poki-sdk.js>` in `poki-upload/index.html`.

## 7. The boot shell was the last 0.3 % of the payload — **fixed**

`vite-plugin-singlefile` hoists the inlined bundle and stylesheet into `<head>`,
so the loading shell could not paint until the whole 2 MB had parsed. A
`bootShellFirst()` plugin now relocates the large inlined `<script>` and
`<style>` to just before `</body>`. First paint moved from byte 2 093 589 of
2 099 624 (**99.7 %**) to byte **3 029 of 2 097 323 (0.144 %)**. Total size
unchanged.

## 8. `drop_console` was deleting shipped error reporting — **fixed**

Replaced the blanket `drop_console: true` with the selective array form, so the
four `console.error` sites survive minification while every `log`/`debug`/
`table`/`group`/`time` call is stripped.

## 9. Reduced motion ignored the operating system — **fixed**

`reduceMotion` defaulted to a flat `false`, so a player who has the OS setting
on got screen shake, hit-stop and full-screen flashes on their first run and
could only turn them off *after* being hit by all of them. Now seeded from
`prefers-reduced-motion`, with an explicit stored value always winning.

---

## Not yet done

Pass 1 remainder: mode-boost cap routing; the six dead `.woff2` files (101 kB)
shipped in the zip beside base64-inlined copies of the same fonts; the
`<link rel="manifest">` left in `dist-poki/index.html` (harmless — the shipped
`poki-upload/index.html` has it stripped).

Passes 2–7 (the 8 333-line `Game.ts` God object and its 0.4 % line coverage;
the 22-screen `UiScreen` union; ~20 per-instance meshes and materials per bird
with 40 rivals; the 21 test files that assert on raw source text) are untouched.
In-browser verification remains impossible in this sandbox — Playwright browsers
cannot be installed here — so everything above is verified by simulation, unit
tests and real builds, not by a human hand on a phone.
