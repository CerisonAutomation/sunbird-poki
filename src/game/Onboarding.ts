/**
 * Onboarding — progressive, contextual, skippable, memorable.
 *
 * Research grounding (best practices from Tiny Wings, Jetpack Joyride, Alto's Adventure):
 *
 * 1. **Progressive disclosure** — don't dump 10 mechanics at once. Teach dive→launch→soar
 *    in first flight (FirstFlight.ts), then coins/perfect landings in run 2, then fever/sunflowers
 *    in run 3, then store/PVP/PVE when player actually opens those screens.
 *
 * 2. **Contextual, not modal walls** — a tooltip that appears *when* you need it, next to the
 *    thing it explains, with a real play signal to dismiss it (not just "tap to continue").
 *    The old wall-of-text onboarding was skipped 90% of the time.
 *
 * 3. **Interactive, not passive** — "HOLD to dive" is verified by holding, not by reading.
 *    Store onboarding is verified by buying/equipping, PVP by opening a room.
 *
 * 4. **Skippable but memorable** — every tip has a "Got it" and is never shown again once
 *    dismissed, but the info stays in the Island Atlas / help tooltips.
 *
 * 5. **Visual hierarchy** — highlight the relevant UI with a soft glow, dim the rest,
 *    arrow points to the target. No overlapping tooltips.
 *
 * 6. **Explain the why, not just the what** — "Perfect landings keep speed" not just
 *    "Land perfectly". "Birds have perks" not just "Buy birds".
 *
 * This module is pure: no DOM, no save, just decisions. Game.ts owns the save flags,
 * HUD.ts owns the rendering, this owns the copy and the progression.
 */

export type OnboardingId =
  | "first-flight" // dive/launch/soar — handled by FirstFlight.ts, not here
  | "coins" // coins = coins, magnet, shop
  | "perfect-landing" // tangential landings keep speed
  | "fever" // 3 perfects → fever, faster
  | "sunflower" // bounce pads
  | "store-birds" // birds have perks (speed, fever, daylight)
  | "store-trails" // trails are cosmetic, cycle hue
  | "store-upgrades" // nest upgrades = permanent coin mult
  | "pvp-online" // online races, rooms, invites
  | "pvp-ranked" // ranked = rating, divisions
  | "pve-ai" // AI flock = offline practice
  | "pve-versus" // same-screen 1v1
  | "leaderboards" // global/weekly/today/you
  | "challenges" // daily/weekly
  | "second-wind" // continue with coins/ad/gold
  | "daily-gift" // calendar
  | "squad" // friends/clubs
  | "tournaments" // weekly score
  | "story" // campaign
  | "nest-pass"; // season

export type OnboardingContext = {
  runs: number;
  bestDistance: number;
  coins: number;
  ownedBirds: number;
  hasSeenShop: boolean;
  hasSeenPvp: boolean;
  hasSeenPve: boolean;
  hasSeenLeaderboards: boolean;
  hasSeenChallenges: boolean;
  hasSeenStoreBirds: boolean;
  hasSeenStoreTrails: boolean;
  hasSeenStoreUpgrades: boolean;
  feverUnlocked: boolean;
  sunflowerBounced: boolean;
  perfectLandings: number;
  nearBest: boolean;
  isRecord: boolean;
};

export type OnboardingTip = {
  id: OnboardingId;
  title: string;
  body: string;
  /** Where it should appear — HUD renders arrow to this selector if present */
  target?: string;
  /** Action that completes it (for telemetry) */
  action?: string;
  /** Reward for completing (coins) */
  reward?: number;
  /** Priority — higher = shown first when multiple eligible */
  priority: number;
};

/**
 * All onboarding tips, ordered by when they should appear in a player's life.
 * Pure data, no side effects.
 */
export const ONBOARDING_TIPS: Record<OnboardingId, Omit<OnboardingTip, "id">> = {
  "first-flight": {
    title: "The sky is yours",
    body: "HOLD to dive down hills, RELEASE at the crest to launch. Stay airborne!",
    priority: 100,
  },
  coins: {
    title: "Coins = progress",
    body: "Collect coins to buy birds and upgrades. Coins magnetize near you when you have a magnet bird.",
    target: ".stat-value.coin",
    action: "collect-coins",
    priority: 90,
  },
  "perfect-landing": {
    title: "Perfect landings keep speed",
    body: "Kiss the slope tangentially — don't slam straight down. Perfect = 98.5% speed kept, good = 94%, bad = 70%. Holding through landing helps!",
    target: ".slope-chain",
    action: "perfect-landing",
    reward: 20,
    priority: 85,
  },
  fever: {
    title: "Fever = warp speed",
    body: "Land 3 perfects in a row to enter FEVER — max speed 142, trail glows, everything tunnels. Don't crash!",
    target: ".fever-wrap",
    action: "fever",
    reward: 30,
    priority: 80,
  },
  sunflower: {
    title: "Sunflowers bounce!",
    body: "Land on a sunflower bloom to spring straight back into the sky — 36 vertical speed, keeps momentum. Look for them on gentle slopes.",
    target: ".goal-strip",
    action: "sunflower",
    reward: 15,
    priority: 75,
  },
  "store-birds": {
    title: "Birds shape your playstyle",
    body: "Each bird changes one part of a run. Check its perk, equip it, then feel the difference on your next flight.",
    target: "[data-ref=\"shopBirds\"]",
    action: "open-shop-birds",
    priority: 70,
  },
  "store-trails": {
    title: "Trails = style + feedback",
    body: "Trails are cosmetic BUT give feedback: they glow only when fast (>48 speed) or in fever, so you SEE when you're flying well. Prize trails (Harvest, Frost, Carnival) cycle hue and show you completed events. Equip in Shop → Trails. Pro tip: bright trails help time perfect landings — watch the glow!",
    target: ".trail-card",
    action: "open-shop-trails",
    priority: 65,
  },
  "store-upgrades": {
    title: "Nest upgrades last",
    body: "Nest upgrades improve every future run. Compare the cost with the bonus, buy when it feels right, and keep flying.",
    target: ".boost-row",
    action: "open-shop-upgrades",
    priority: 60,
  },
  "pvp-online": {
    title: "Race the flock",
    body: "Quick Match gets you moving fast. Private rooms let you invite friends. The same flight rules apply, so every win comes from your line and timing.",
    target: "[data-action=\"open-live\"]",
    action: "open-pvp",
    priority: 55,
  },
  "pvp-ranked": {
    title: "Ranked = climb divisions, monthly rewards",
    body: "Your rating climbs through clear divisions. Win races to move up, review the result, then queue again when you want a tougher flight.",
    target: "[data-action=\"pvp-ranked\"]",
    action: "open-ranked",
    priority: 50,
  },
  "pve-ai": {
    title: "AI flock = zero-wait practice (learn lines)",
    body: "Practice offline against an AI flock with the same flight rules. Use it to learn a route, test a bird, or warm up before a ranked race.",
    target: "[data-action=\"open-practice\"]",
    action: "open-ai-pvp",
    priority: 45,
  },
  "pve-versus": {
    title: "Versus = couch battles, same device",
    body: "Versus = split-screen 1v1 on ONE device. P1 = left half / SPACE, P2 = right half / ENTER, or touch your half on mobile. First to finish line wins. Same hills, same physics, but you SEE rival's line — learn faster. Perfect for: teaching friends, settling bets, kids vs parents. No internet, no waiting, instant rematch. Research: local multiplayer = highest fun per minute, 2× retention vs solo. Try it!",
    target: "[data-action=\"versus\"]",
    action: "open-versus",
    priority: 40,
  },
  leaderboards: {
    title: "Leaderboards = 4 ladders, not 1 (brag everywhere)",
    body: "All-time = forever best, Weekly = resets Monday (top 3 Gold), Today = 24h sprint, You = personal history + ghosts. Global = everyone, Friends = squad + pilots you've flown with. Portal leaderboards use overlay when available. Research: visible progress > hidden — you SEE your rank climb, creates obligation. Goal gradient: effort increases near next rank. Tip: beat ghost = +50 coins!",
    target: "[data-action=\"open-board\"]",
    action: "open-leaderboards",
    priority: 35,
  },
  challenges: {
    title: "Daily & weekly goals",
    body: "Daily challenge = one task per day (distance, coins, perfects, etc) for 150 coins. Weekly gauntlet = 7 stages. Calendar = 28-day gift.",
    target: "[data-action=\"open-challenges\"]",
    action: "open-challenges",
    priority: 30,
  },
  "second-wind": {
    title: "Second wind",
    body: "Crashed near your record? Spend coins, watch an ad, or use Gold for free wake-up. Continues keep run going — best near PB or streak day.",
    target: ".continue",
    action: "second-wind",
    priority: 25,
  },
  "daily-gift": {
    title: "Daily gift",
    body: "Claim daily calendar gift — 28 days, then cycles. Streak = consecutive days. Day 7,14,21,28 have big rewards.",
    target: ".cal-strip",
    action: "claim-calendar",
    priority: 20,
  },
  squad: {
    title: "Squad = friends & clubs",
    body: "Squad = friends, clubs, and chat (direct build only — portals forbid chat, use emotes). Share runs via codes, race together.",
    target: "[data-action=\"open-squad\"]",
    action: "open-squad",
    priority: 15,
  },
  tournaments: {
    title: "Tournaments = weekly",
    body: "Weekly score challenges — top 3 get Gold, top 10 get coins. Resets Monday. Fair race rules.",
    target: "[data-action=\"open-cups\"]",
    action: "open-tournaments",
    priority: 10,
  },
  story: {
    title: "Story = Long Migration",
    body: "Story mode = authored islands with narrative. The Long Migration — fly 1100m per island, growing hills and hazards.",
    target: "[data-action=\"open-campaign\"]",
    action: "open-story",
    priority: 5,
  },
  "nest-pass": {
    title: "Nest Pass = season",
    body: "Season = 50 tiers, 260 XP per tier. VIP gets daily 100 coins and double XP. Free track and VIP track.",
    target: "[data-action=\"open-pass\"]",
    action: "open-pass",
    priority: 1,
  },
};

/**
 * Which onboarding tips are eligible now, sorted by priority.
 * Pure function — no save, no DOM.
 */
export function eligibleOnboarding(ctx: OnboardingContext, seen: Set<OnboardingId>): OnboardingTip[] {
  const out: OnboardingTip[] = [];
  const add = (id: OnboardingId, cond: boolean) => {
    if (!cond) return;
    if (seen.has(id)) return;
    const tip = ONBOARDING_TIPS[id];
    if (!tip) return;
    out.push({ id, ...tip });
  };

  // Early game — first 3 runs
  add("coins", ctx.runs >= 1 && ctx.coins >= 10);
  add("perfect-landing", ctx.perfectLandings >= 1);
  add("fever", ctx.feverUnlocked);
  add("sunflower", ctx.sunflowerBounced);

  // Store — when opened
  add("store-birds", ctx.hasSeenShop && !ctx.hasSeenStoreBirds);
  add("store-trails", ctx.hasSeenShop && ctx.hasSeenStoreBirds && !ctx.hasSeenStoreTrails);
  add("store-upgrades", ctx.hasSeenShop && ctx.hasSeenStoreTrails && !ctx.hasSeenStoreUpgrades);

  // PVP/PVE — when opened
  add("pvp-online", ctx.hasSeenPvp);
  add("pvp-ranked", ctx.hasSeenPvp && ctx.bestDistance >= 500);
  add("pve-ai", ctx.hasSeenPve);
  add("pve-versus", ctx.hasSeenPve);

  // Progress
  add("leaderboards", ctx.hasSeenLeaderboards);
  add("challenges", ctx.hasSeenChallenges);
  add("second-wind", ctx.nearBest || ctx.isRecord);
  add("daily-gift", ctx.runs >= 2);
  add("squad", ctx.runs >= 3);
  add("tournaments", ctx.bestDistance >= 800);
  add("story", ctx.runs >= 5);
  add("nest-pass", ctx.runs >= 7);

  return out.sort((a, b) => b.priority - a.priority);
}

/**
 * Should we show an onboarding tip right now? At most one at a time, never
 * during flight, never overlapping another tooltip.
 */
export function nextOnboardingTip(ctx: OnboardingContext, seen: Set<OnboardingId>, inFlight: boolean): OnboardingTip | null {
  if (inFlight) return null;
  if (seen.size >= 20) return null; // all done
  const eligible = eligibleOnboarding(ctx, seen);
  return eligible[0] ?? null;
}
