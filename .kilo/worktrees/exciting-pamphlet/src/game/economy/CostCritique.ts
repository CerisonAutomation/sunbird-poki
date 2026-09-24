/**
 * Economy Critique — cost vs coins audit, with rebalanced pricing.
 *
 * Original audit (2026-05-13):
 * - Average run: 30-80 coins (base 1 per coin, gem 5, multipliers up to 2x)
 * - Birds: 150-950 coins → 2-20 runs per bird. Early birds cheap, late birds grindy.
 * - Boosts: 50-600 coins → Head Start 90, Storm Ward 70, Hot Wings 80 reasonable, but Doubletap 420 and Golden Feather 600 feel like walls.
 * - Trails: 280-500 coins → cosmetic, but 500 for Goldleaf feels high vs 1 coin per pickup.
 * - In-flight shop: 25-80 coins → 25 for magnet is 1/3 run, 80 for fever is a full run — good tension.
 *
 * Problems:
 * - Early game: Robin 150 is 2 runs, okay, but Bluejay 200 right after feels samey.
 * - Mid game: 320-520 cluster (Kingfisher, Cardinal, Magpie, Heron) — 4 birds same price band, no clear progression.
 * - Late game: 850-950 for Harpy/Raven/Condor — 15+ runs each, feels like paywall without payoff (perks +5% speed etc barely visible).
 * - Boosts: Golden Feather 600 is permanent +10% coins forever — should be cheaper to feel like investment, not punishment.
 * - Trails: 500 for Goldleaf vs 280 Mintcloud — both cosmetic, price doesn't match visual value.
 * - No coin sink for rich players: wallet can bloat to 10k+ with nothing to buy after all birds.
 * - No time pressure: want to beat time is weak — daylight is the clock but not felt as "beat the time".
 *
 * Rebalanced curve (hexagonal: domain knows value, not just price):
 * - Early (0-2 runs): Sunbird free, Robin 80 (was 150), Canary 100 (was 180) — first purchase in 1 run.
 * - Mid-early (3-6 runs): Bluejay 150 (was 200), Swift 180 (was 260), Kingfisher 220 (was 320) — clear 40-50 steps.
 * - Mid (7-15 runs): Cardinal 280 (was 380), Magpie 320 (was 420), Jet 350 (was 350), Ruby 380 (was 400), Heron 420 (was 520) — each 40-60 apart.
 * - Mid-late (16-30 runs): Cloudwalker 450 (was 500), Snowowl 480 (was 550), Lorikeet 520 (was 560), Crystal 550 (was 600), Falcon 600 (was 640) — aspirational but reachable.
 * - Late (30+ runs): Ibis 650 (was 720), Stormchaser 680 (was 600), Quetzal 720 (was 780), Harpy 780 (was 850), Raven 820 (was 900), Condor 850 (was 950), Golden Eagle 900 (was 800) — top tier 800-900, not 950.
 * - Boosts: Sun Flask 30 (was 50), Tailwind 35 (was 55), Storm Ward 40 (was 70), Daybreak 45 (was 75), Hot Wings 50 (was 80), Head Start 60 (was 90), Lucky Coin 55 (was 85), Full House 90 (was 135) — all -40% to feel like snacks.
 * - Permanent boosts: Doubletap 280 (was 420), Golden Feather 350 (was 600) — investment, not wall.
 * - Trails: 180-320 (was 280-500) — cosmetic should be 2-4 runs, not 5-8.
 * - In-flight: 20-60 (was 25-80) — cheaper so you actually use it mid-flight.
 * - New sinks: Prestige wings 1500, coin doubler 2000, name color 500.
 */

export type RebalancedPrice = { id: string; oldPrice: number; newPrice: number; reason: string };

export const REBALANCED_BIRDS: RebalancedPrice[] = [
  { id: "robin", oldPrice: 150, newPrice: 80, reason: "First purchase in 1 run — instant gratification" },
  { id: "canary", oldPrice: 180, newPrice: 100, reason: "2nd bird in 1-2 runs, daylight perk teaches mechanic" },
  { id: "bluejay", oldPrice: 200, newPrice: 150, reason: "Speed bird early, 2 runs, clear upgrade" },
  { id: "swift", oldPrice: 260, newPrice: 180, reason: "5% speed for 3 runs — mid-early chase" },
  { id: "kingfisher", oldPrice: 320, newPrice: 220, reason: "Fever+speed combo, 4 runs" },
  { id: "cardinal", oldPrice: 380, newPrice: 280, reason: "Fever specialist, 5 runs" },
  { id: "magpie", oldPrice: 420, newPrice: 320, reason: "Daylight bird, 6 runs" },
  { id: "jet", oldPrice: 350, newPrice: 350, reason: "Keep — good price for 8% speed" },
  { id: "ruby", oldPrice: 400, newPrice: 380, reason: "Slight nerf, 7 runs" },
  { id: "heron", oldPrice: 520, newPrice: 420, reason: "Was overpriced for +4% +3s" },
  { id: "cloudwalker", oldPrice: 500, newPrice: 450, reason: "Daylight bird, 8 runs" },
  { id: "snowowl", oldPrice: 550, newPrice: 480, reason: "Was 550, now 480 — 9 runs" },
  { id: "lorikeet", oldPrice: 560, newPrice: 520, reason: "Balanced" },
  { id: "crystal", oldPrice: 600, newPrice: 550, reason: "5% speed +2s, 10 runs" },
  { id: "falcon", oldPrice: 640, newPrice: 600, reason: "7% speed, 11 runs" },
  { id: "ibis", oldPrice: 720, newPrice: 650, reason: "8s daylight, 12 runs" },
  { id: "stormchaser", oldPrice: 600, newPrice: 680, reason: "Bump for weather immunity value" },
  { id: "quetzal", oldPrice: 780, newPrice: 720, reason: "Was 780, now 720" },
  { id: "harpy", oldPrice: 850, newPrice: 780, reason: "Late game, 14 runs" },
  { id: "raven", oldPrice: 900, newPrice: 820, reason: "Late, 15 runs" },
  { id: "condor", oldPrice: 950, newPrice: 850, reason: "Top tier, 16 runs not 20" },
  { id: "golden", oldPrice: 800, newPrice: 900, reason: "Premium late, but best perk" },
];

export const REBALANCED_BOOSTS: RebalancedPrice[] = [
  { id: "sunflask", oldPrice: 50, newPrice: 30, reason: "Snack price, 1/2 run" },
  { id: "tailwind", oldPrice: 55, newPrice: 35, reason: "Snack" },
  { id: "stormward", oldPrice: 70, newPrice: 40, reason: "Was 70, now 40 — defensive should be cheap" },
  { id: "daybreak", oldPrice: 75, newPrice: 45, reason: "Daylight snack" },
  { id: "hotwings", oldPrice: 80, newPrice: 50, reason: "Fever starter cheap" },
  { id: "luckycoin", oldPrice: 85, newPrice: 55, reason: "Coin mult snack" },
  { id: "headstart", oldPrice: 90, newPrice: 60, reason: "Was 90, now 60 — 1 run" },
  { id: "fullhouse", oldPrice: 135, newPrice: 90, reason: "Bundle should be cheaper than sum" },
  { id: "doubletap", oldPrice: 420, newPrice: 280, reason: "Permanent — investment, not wall" },
  { id: "goldenfeather", oldPrice: 600, newPrice: 350, reason: "10% forever should be 6 runs, not 12" },
];

export const REBALANCED_TRAILS: RebalancedPrice[] = [
  { id: "trail_mint", oldPrice: 280, newPrice: 180, reason: "Cheapest cosmetic, 3 runs" },
  { id: "trail_ember", oldPrice: 300, newPrice: 200, reason: "2nd cheapest" },
  { id: "trail_cherry", oldPrice: 360, newPrice: 220, reason: "Mid cheap" },
  { id: "trail_tide", oldPrice: 350, newPrice: 240, reason: "Mid" },
  { id: "trail_bloom", oldPrice: 350, newPrice: 240, reason: "Mid" },
  { id: "trail_rose", oldPrice: 380, newPrice: 260, reason: "Mid" },
  { id: "trail_spark", oldPrice: 380, newPrice: 260, reason: "Mid" },
  { id: "trail_crystal", oldPrice: 400, newPrice: 280, reason: "Mid-high" },
  { id: "trail_void", oldPrice: 420, newPrice: 280, reason: "Mid-high" },
  { id: "trail_lava", oldPrice: 420, newPrice: 280, reason: "Mid-high" },
  { id: "trail_neon", oldPrice: 450, newPrice: 300, reason: "High" },
  { id: "trail_shadow", oldPrice: 460, newPrice: 300, reason: "High" },
  { id: "trail_aurora", oldPrice: 490, newPrice: 320, reason: "Top cosmetic, 5 runs" },
  { id: "trail_gold", oldPrice: 500, newPrice: 320, reason: "Top, was 500 now 320" },
  { id: "trail_cosmic", oldPrice: 500, newPrice: 320, reason: "Top" },
];

export const REBALANCED_INFLIGHT: RebalancedPrice[] = [
  { id: "boost", oldPrice: 35, newPrice: 20, reason: "Snack — use it, don't hoard" },
  { id: "magnet", oldPrice: 25, newPrice: 15, reason: "Cheapest, 1/4 run" },
  { id: "shield", oldPrice: 40, newPrice: 25, reason: "Defensive cheap" },
  { id: "fever", oldPrice: 80, newPrice: 60, reason: "Was full run, now 3/4 run — big moment" },
];

/**
 * Time pressure — want to beat the time:
 * - Ghost: personal best ghost, visible, taunts you
 * - Beat lines: flags in world that say "you were here at X seconds"
 * - Daylight: sun is the clock, but needs urgency copy
 * - Funny messages when near best, when beating, when slow
 */

export const TIME_PRESSURE_MESSAGES = {
  nearBest: [
    "🔥 You're 12m from your best — the ghost is sweating!",
    "👻 Your ghost looked back. Mistake. You're catching up!",
    "⚡ 8 seconds behind your record. The wind is rooting for you!",
    "🏃 Your past self is getting nervous. Good.",
    "💨 You're so close your ghost can hear you breathing!",
  ],
  beating: [
    "🚀 You're AHEAD of your best! Don't look down!",
    "👑 New best incoming! The leaderboard is taking notes!",
    "🔥 You're writing history! (And it's faster than last time!)",
    "💫 Past you is eating dust! Future you is proud!",
    "⚡ You're beating time itself! (Time is filing a complaint)",
  ],
  slow: [
    "🐢 Your ghost is making coffee. Catch up!",
    "🦥 Even the clouds are passing you. Dive!",
    "😴 The sun is getting bored. Show it something!",
    "🐌 My grandma's tortoise flies faster. (She has a jetpack)",
    "🍃 The wind is literally waiting for you. Awkward.",
  ],
  funny: [
    "🪶 Fun fact: 90% of birds can't read. You're in the 10% that can fly!",
    "🤧 The bird sneezed. Aerodynamics: still 100%. Dignity: 0%",
    "🐟 A fish just photobombed you. It will tell its friends you fly funny",
    "💨 The wind tried to push you. You pushed back. Wind: confused",
    "🌈 The sky hired a lighting designer. It was you.",
    "🦢 A goose honked at your form. Geese are harsh critics. You passed!",
    "🍃 You flew so low the grass high-fived you!",
    "⚡ You went so fast your shadow needed a minute!",
    "🎶 The islands are humming your flight path. It's a banger!",
    "🪂 That landing was so smooth, butter filed a complaint!",
  ],
  praise: [
    "✨ PERFECT! The hills are taking notes!",
    "🔥 FEVER! You're literally on fire! (In a good way!)",
    "💫 That was so smooth, physics said 'okay, fine, you win'",
    "🌟 The sun is jealous of how you chase it!",
    "🎯 Bullseye! Even the wind is clapping!",
    "🚀 That launch was so good, Newton wants your autograph!",
    "💨 You flew so fast, time needed a coffee break!",
    "🏆 That was legendary! Tell your grandkids! (Or at least your squad)",
    "🌈 You painted the sky! Picasso would be proud!",
    "⚡ Lightning called. It wants its speed back!",
    "🎶 Your flight is music! The islands are dancing!",
    "👑 Royalty! The sky just bowed!",
    "🔥 You're not flying, you're flexing!",
    "💫 That was so good, your ghost is taking notes!",
    "🌟 The stars are jealous. You're outshining them at noon!",
  ],
};

export function pickRandom<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length]!;
}
