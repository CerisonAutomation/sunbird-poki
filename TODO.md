# Sunbird Poki — MVP Production-Readiness Loop

High-value production improvements: type safety, deduplication, code quality.
Each item is a focused single-commit change verified by tsc + vitest.

## HUD.ts — sectionTitle() migration (20 remaining instances)

- [x] **HUD social section-titles (batch 1)** — Apply `sectionTitle()` to lines 2345, 2405, 2409, 2421/2425, 2439/2448 (Squadron, Requests, Pilot Lookup, Wingmen ×2, Flew with ×2)
- [x] **HUD social section-titles (batch 2)** — Apply `sectionTitle()` to lines 2471, 2477, 2499, 2545, 2557 (Your club, Flight Clubs, Squad profile recovery, Recent races, Duels)
- [x] **HUD pvp/shop section-titles (batch 3)** — Apply `sectionTitle()` to lines 2037, 2604, 2634, 2646, 3233 (Tournament Rank Prizes, Prize trails, Racing Circuits, offline flock, Nest)
- [x] **HUD settings section-titles** — Lines 3343, 3355: settings section dividers use raw `<div>` instead of `sectionTitle()`. Convert them and any remaining instances in renderSettings.

## SaveData.ts — type safety

- [x] **Fix `markSeen()` `as any` casts** — `SaveData.ts:941-947` uses two `(this.state as any)[key]` casts. Replace with a typed lookup: `const seenKey = \`seen\${area.charAt(0).toUpperCase() + area.slice(1)}\` as keyof Pick<SaveState, "seenShop"|"seenPvp"|"seenPve"|"seenLeaderboards"|"seenChallenges">` and remove the 2 eslint-disable comments.
- [x] **Fix migration `as any` casts** — `SaveData.ts:506-515` uses 5 pairs of eslint-disable + `(p as any).seenX`. Replace with `(p as Record<string, unknown>).seenShop` which is the correct migration pattern (unknown legacy shape).

## Economy.ts — deduplication

- [x] **Extract `roundUp(price, mult, step)` helper** — Three places use `Math.ceil((x * mult) / step) * step`: `collectionPrice` (×1.75/25), BOOSTS map (×1.25/5), SHOP_TRAILS map (×1.5/25). Extract a named helper `roundUp(price: number, mult: number, step: number): number`.

## SocialSystem.ts — micro-cleanups

- [x] **`!text.length` → `!text`** — `SocialSystem.ts:104`: `if (!club || !text.length)` — `text` is a string; `!text` is simpler and equally correct. Also audit for any other `.length` checks on string variables.

## Game.ts — decompose handleMenuEvent (IN PROGRESS)

- [ ] **Extract `handleShopEvent()` from handleMenuEvent** — The shop action cases in `handleMenuEvent` (~cases: open-shop, buy-skin, buy-boost, buy-trail, etc.) span ~80 lines. Extract into a private `handleShopEvent(action: string, id: string): boolean` sub-handler that returns `true` if it consumed the event.
- [ ] **Extract `handleSocialEvent()` from handleMenuEvent** — The social/squad action cases (~add-friend, accept-friend, open-squad, etc.) span ~60 lines. Extract into a private `handleSocialEvent(action: string, id: string): boolean`.

## HUD.ts — small rendering quality

- [x] **`doNow.length > 0` → `doNow.length`** — `HUD.ts:2939-2943`: `doNow.length > 0 ?` conditional — the `> 0` is redundant when used as truthy check; use `doNow.length` directly.
- [x] **`live.length === 0` empty-state checks** — Converted.

## Game.ts — snapshot assembly audit

- [x] **Cache repeated `this.save.state` chains in snapshot** — `buildHudSnapshot()` accesses `this.save.state.X` 30+ times. Cache as `const st = this.save.state` at the top of the function to remove redundant property traversal and improve readability.

## Completion
- [ ] Not all tasks complete — the `handleMenuEvent` decomposition above (2 items) is still open. Do not mark ALL_TASKS_COMPLETE until both are checked off.
