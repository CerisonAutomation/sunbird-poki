# Monetization — extracted rules

Source: <https://developers.poki.com/guide/monetization>

Rewarded video is the platform's core revenue surface, and the guide is unusually
prescriptive about *how* it may be presented. The rules below are the ones the
Inspector and reviewers check.

## Integration philosophy

| ID | Kind | Rule |
|---|---|---|
| `MON-01` | recommendation | **Integrate monetization early in the development process.** Early integration allows more natural implementation of rewarded videos — relevant rewards at optimal times — improving revenue potential without hurting the user experience. |
| `MON-02` | recommendation | **Prioritise engagement first.** Higher engagement levels correlate with more interaction with rewarded video content; an unengaging game cannot be rescued by ad placement. |

## Hard requirements for rewarded video

| ID | Kind | Rule |
|---|---|---|
| `MON-03` | requirement | **Rewarded videos must be optional and must never block core gameplay.** |
| `MON-04` | requirement | **Every interface element that triggers a video must be clearly labelled** with text or icons, must be accessible, and must be transparent about what the reward is. |
| `MON-05` | requirement | **Always provide a standard (non-ad) alternative** to a rewarded option. |
| `MON-06` | requirement | The standard option and the rewarded option must **appear simultaneously** — never gate the ad behind a step the player must complete first. |
| `MON-07` | requirement | The standard button must be **at least as large** as the rewarded button and positioned **next to or above** it. |
| `MON-08` | requirement | **Rewarded buttons must not be green** (green implies a free/positive action the ad is not). |
| `MON-09` | requirement | Reward buttons carry a **prominent 🎬 (clapperboard) icon** so the video nature is unmistakable. |
| `MON-10` | requirement | **One video per reward, maximum.** A single rewarded break grants a single reward. |
| `MON-11` | requirement | **Immediate, unmistakable reward feedback:** after the video, confirm the reward with an animation or sound right away, and activate the reward automatically where possible to remove navigation steps. |
| `MON-12` | requirement | **No reward if the ad fails or is blocked.** Handle failure silently — never show a custom "ad blocker detected" message, and never loop the request. |
| `MON-13` | requirement | **No ad-timer manipulation.** Do not gate, shorten, or fake cooldowns to force more ads; the platform decides when an ad is available. |
| `MON-14` | requirement | **Never reward-wall core gameplay** — nothing essential may sit behind watching a video. |
| `MON-15` | requirement | **No pushy prompts.** Do not make rewarded buttons overly insistent or invasive: place non-ad options in primary positions, and remember that aggression here costs player trust and engagement. |

## Reward design patterns (what rewarded video can do)

| ID | Kind | Pattern | Documented examples |
|---|---|---|---|
| `MON-16` | recommendation | **A helping hand** — use rewarded video to balance difficulty and reduce drop-offs. | revives, level skips, hints, stat boosts, speed enhancements, special abilities |
| `MON-17` | recommendation | **In-game economy** — let players choose between spending earned currency and watching a video for the same reward; this keeps multiple mechanics in balance. | multiplying earned points, directly unlocking currency |
| `MON-18` | recommendation | **Customization** — rewarded video as the route to ownership and replayability. | cosmetic unlocks for characters/weapons, environment changes, UI colour schemes, progressive reward tracks |

## Best-practice/optimization rules

| ID | Kind | Rule |
|---|---|---|
| `MON-19` | recommendation | **Prefer dynamic, context-specific rewarded opportunities** (time-limited offers, triggers tied to what just happened) over static buttons that are always present. |
| `MON-20` | recommendation | **Use temporary or seasonal content** to lift long-term retention and interest. |
| `MON-21` | recommendation | **Monitor balance.** Infinite ad views are permitted, but watch progression speed and consider limits or dynamic availability if rewards distort the game's economy. |
| `MON-22` | requirement | Any interface that *looks* like an ad surface must *be* one: no fake ad affordances (TV icons, "watch ad" wording) on features that do not show an ad. |

## How Sunbird applies this page

| Rule | Implementation |
|---|---|
| `MON-01`, `MON-02` | The single rewarded placement is the crash-continue offer, which only exists because the loop creates the moment for it; the game ships a deep progression layer (skins, mastery, season pass) that carries engagement independently of ads. |
| `MON-03`, `MON-05`, `MON-06` | The continue screen always renders a standard paid option ("Spend ● N") **and** a free option ("Let it sleep") beside the rewarded one, in the same render pass. Restarting for free is always one tap away. |
| `MON-04`, `MON-09` | Buttons read `🎬 Watch for Second Wind`, with the clapperboard icon and explicit reward text. |
| `MON-07`, `MON-08` | The standard button is the larger `.primary-btn` (18 px type, 12 px padding, full width) positioned above the rewarded `.soft-btn` (14 px type, 10 px padding); the rewarded button is a warm neutral, never green. |
| `MON-10`, `MON-11` | Exactly one `rewardedBreak()` per continue; on `true` the run resumes in place with a jingle, coin toast and slow-mo restore. There is a single grant site, so a double reward is impossible. |
| `MON-12` | A `false`/rejected break rewards nothing, offers the fallback options, and shows a neutral message that never mentions ad blockers. |
| `MON-13` | Portal builds contain no internal ad timers at all — `adTimer`, `shouldShowInterstitial` and `adsLeftToday` are local-build-only; the portal is asked on natural stops and decides. |
| `MON-14`, `MON-15` | One rewarded placement, only after a crash; there is no "watch to unlock the next mode" surface anywhere. |
| `MON-16` | The continue reward is a revive ("Second Wind") — slot one in the guide's helping-hand list. |
| `MON-17` | The continue offer lets the player choose coins *or* the video for the same revive, and coin prices are the same currency earned in play. |
| `MON-18` | Skins, trails, biomes and UI-side cosmetics are earned with coins; nothing is bought with real money in a portal build. |
| `MON-19` | The offer is context-triggered (only after a crash that ended a meaningful run) and its framing is chosen from the run's context (near-best run, streak at risk, long-run momentum) instead of being a static always-on button. |
| `MON-20` | Seasonal/event content exists (season pass, weekly cups, festivals, daily/weekly challenge rotation). |
| `MON-21` | Continue availability is bounded by the run (one offer per crash) and the economy is audited for infinite coin faucets — see the fix log in `../audits/POKI_COMPLIANCE_AUDIT.md`. |
| `MON-22` | Fake ad affordances were removed during the compliance pass: the old "Ad Multiplier!" card (no ad behind it) and the wheel button advertising a video option are gone. |

### Placement analytics required with the offer

The guide's measurement model expects placement visibility and interaction to be
measurable, so the offer emits `measure("button", "continue-ad", "visible")` when
it appears and `"interact"` when chosen, immediately before `rewardedBreak()`
(portal builds only).
