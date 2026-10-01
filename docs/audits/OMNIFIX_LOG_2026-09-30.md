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

# Pass 2 — against Poki's live requirements (re-fetched 2026-09-30)

Re-read `developers.poki.com/guide/requirements-quality` before starting. Three
things on it were not being met.

## 10. Poki's mandated bad-words list was not implemented — **now shipped**

Requirements → Content & community standards is explicit: *"Profanity
filtering: for multiplayer games with username input, implement strict
profanity filtering using the provided bad words list (expand it further for
your games)"*, linking `MauriceButler/badwords`. This game has username input
and broadcasts those names over netlib and a public leaderboard, so it applies
directly, and it was not implemented.

The list now ships verbatim in its own module, `src/game/pokiBadWords.ts`, so a
reviewer can diff it against upstream. It cannot be adopted naively: the
matcher runs on a squashed, boundary-free key, and on such a key `spac` refuses
**Space**, `butt` refuses **Butterfly**, `hell` refuses **Michelle**, `muff`
refuses **Muffin**, and `cum` refuses **Cumulus** — a cloud, in a game about
gliding through clouds. So every entry we decline is declared in
`POKI_LIST_EXCEPTIONS` with a reason, of exactly two allowed kinds
(`COLLISION` or `MILD`), and a test asserts that **every** upstream entry is
either enforced or excepted-with-a-reason, that the exception list stays under
a seventh of the list, and that ~45 real names and game words still pass.
Exceptions are matched by normalised key, so excepting `ass` also excepts `a55`
and `a_s_s` — the leet spellings that otherwise refuse "Cassandra" through the
back door.

## 11. 101 kB of dead fonts in the submission zip — **removed**

`src/index.css` references the six woff2 files through Vite, so the build
base64-inlines all of them into the stylesheet. The originals were *also*
copied into the zip, giving every player a second, unreachable copy of every
font. Two verifier scripts required them to be there; both now require the
opposite, with the reason recorded. Zip: **1148 kB → 1049 kB (−8.6 %)**.

Also stripped ~1.4 kB of engineering commentary from the shipped `<head>`
("Clean build: remove all development tools, debug code, and testing
artifacts"). Scoped to the head deliberately — a `<!-- … -->` regex across two
megabytes of minified JavaScript is a way to corrupt a build, not to clean one.

## 12. Forty rivals each allocated their own copy of the same bird — **fixed**

A bird is ~20 meshes and `MassRace` fields up to 40 rivals. Every mesh
allocated its own `SphereGeometry`/`ConeGeometry`, so a full race uploaded on
the order of **800 buffer geometries** to the GPU — each a duplicate of one
already resident, differing only in the `mesh.scale` applied afterwards.
Nothing in `Bird.ts` mutates a geometry (all shaping is `mesh.scale`), so they
are now handed out from a shared cache: **40 birds now cost under 25
geometries between them**, verified by test.

`dispose()` had to change with it — it called `geometry.dispose()` on every
mesh, which was only safe while each bird owned a private copy. One rival
leaving a race would have blanked the other thirty-nine. There is a test for
exactly that.

## 13. Forty rivals were also forty shadow casters — **fixed**

Every mesh of every bird was an unconditional `castShadow`/`receiveShadow`, so
on any device with the shadow map on, the depth pass re-rendered ~800 extra
meshes every frame — a second full scene draw, spent on birds a few dozen
pixels tall in a pack. Rivals are now excluded (`Bird.setShadowCasting`); they
keep their blob shadows, which is what actually reads as grounding at race
distance. The player's own bird is unchanged.

## 14. One bad moment permanently degraded every mobile session — **fixed**

`nextDpr` was written specifically to stop *"a single bad moment permanently
degrading the rest of the session"* — and twenty lines below it, in the same
function, shadows and particles did exactly that. The branch that restores them
read:

```ts
} else if (frameEma < EFFECT_UP && !this.isMobile && tier !== "lite" && …) {
```

Shadows start **on** for every device except `lite` and software rendering —
mid-range phones included. So on a phone, one slow 2.5-second window (an ad
tearing down, a thermal blip, a tab regaining focus) shed the shadows and 20 %
of the particles *for the rest of the session*. Four such windows and the
player finished at the particle floor on hardware that could have run
everything. Mobile is the majority of Poki's traffic: the platform that most
needed adaptation was the only one that could never recover from it.

Replaced with a pure, two-way `nextEffectBudget()` in `quality.ts`: one bad
window sheds immediately, three consecutive good ones restore one step,
particles come back before shadows (they are the game's feedback language and
cost far less than a depth pass), merely-adequate frames bank no credit, and
recovery climbs only to the density the device was *configured* for — mobile's
deliberate 0.5, not an absolute 1. Nine tests, including the regression stated
as a property.

---

## Gate after pass 2

`lint --max-warnings 0` · `typecheck` · `test` **2 741 passing / 192 files** ·
`circular:check` · `build` · `build:poki` · `i18n:audit` · `poki:audit` ·
`verify:upload` — all green. Coverage 55.62 % lines / 58.19 % functions /
49.28 % branches, against thresholds of 49 / 54 / 45.

## Still not done

`Game.ts` remains an 8 333-line God object at 0.44 % line coverage; the
`UiScreen` union is still 22 screens; ~21 test files still assert on raw source
text rather than behaviour. Those are structural and need either a browser to
verify against or a refactor large enough to deserve its own review — and
in-browser verification is still impossible here (Playwright browsers cannot be
installed in this sandbox), so everything above is verified by simulation, unit
tests and real builds, never by a hand on a phone.

---

# Pass 3 — PvP and the AI field: fixed, never cut

Explicit instruction: **do not cut PvP or the AI opponents — fix them.** So
nothing was removed. Zero files deleted across the branch; `Modes.ts`,
`Racer.ts`, `Realtime.ts`, `SharedRun.ts`, `Squad.ts`, `Ghost.ts`,
`RoomBrowser.ts`, `Tournaments.ts` and `Leaderboard.ts` are byte-for-byte
unchanged. All 8 PvP modes ship, `MAX_RIVALS` is still 40, and
`pvp-and-ai-intact.test.ts` now fails the build if any of that changes.

Three real defects in the rival AI, all found while proving nothing had been
cut.

## 15. A rival's rating and its flying could disagree — **fixed**

`spawn()` derived `lead`, `wobbleAmp` and `reaction` from `skill` inline.
Every other path that changed skill — `shuffle()`, `setFieldSkill()` — moved
the number and left the behaviour behind. So a rival could be rated 0.95 on
the standings and still fly with a tail-pack wobble and a tail-pack reaction
time. In a race whose only feedback is *who is ahead of me*, an opponent that
does not fly like its rating is indistinguishable from one that cheats.

Skill is now one number that everything follows from: `tieredSkill`,
`leadForSkill`, `wobbleForSkill`, `reactionForSkill`, funnelled through a
single private `applySkill()`. Their envelopes are exported too
(`leadRangeForSkill`, `reactionRangeForSkill`) so the coherence test asserts
against the formula rather than against a hand-copied duplicate of it.

## 16. The rival field was not reproducible from its seed — **fixed**

```ts
const rng = new SeededRandom(`${seed}:shuffle:${Date.now() % 100000}`);
```

A wall-clock term inside a seeded RNG. The same race seed produced a different
field on every call, which defeats the point of seeding: two players given one
seed met different opponents, a replay could not reproduce its own race, and a
ghost recorded against one field was played back against another. Every other
RNG in the file is seeded properly; this one quietly was not.

Also `sort(() => rng.next() - 0.5)` is not a shuffle — it is the classic broken
one, with an inconsistent comparator, and V8's TimSort leaves short arrays
nearly in place, which is why the same names kept appearing at the front of the
grid. Fisher–Yates now, off the same seeded stream.

## 17. Reshuffling flattened the race — **fixed**

`spawn()` builds a deliberate three-tier field: 15 % elites to chase, 25 %
strong, 60 % approachable. `shuffle()` replaced it with `rng.next() * 0.9 + 0.1`
— uniform noise. A reshuffled race had no top end and no tail: forty pilots of
indistinguishable middling ability. The curve is now redrawn through
`tieredSkill` and the *rungs* are shuffled, so the elites are not always the
same grid slots, and `setFieldSkill()` moves the actual flying instead of only
the ratings.

Twelve new tests across `massrace-ai-coherence.test.ts` and
`pvp-and-ai-intact.test.ts`.

## Gate after pass 3

`lint --max-warnings 0` · `typecheck` · `test` **2 756 passing / 194 files** ·
`circular:check` · `build` · `build:poki` · `i18n:audit` · `poki:audit` ·
`verify:upload` — all green.

