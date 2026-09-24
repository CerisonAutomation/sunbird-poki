/**
 * The rules that make a sponsored break unskippable.
 *
 * These lived inline in `Game.handleAction`, where only a browser and a real ad
 * could exercise them. They are pure here so the contract can be enumerated
 * exhaustively by a unit test, and so the two failure modes they encode are
 * stated once, in one place, instead of being implied by a compound condition:
 *
 *  • A break OWNED BY THE PORTAL is ended by the platform's ad promise and by
 *    nothing else. The game must not render or honour a skip for it: cutting
 *    the ad short and still paying out is exactly what an ad network treats as
 *    fraud, and it is why the reward is only granted from the SDK callback.
 *
 *  • A PLACEHOLDER break (no portal, so the game runs its own countdown) ends
 *    only once that countdown has reached zero. Before then, `ad-skip` and the
 *    "remove breaks" upsell are re-armed but inert, so the break always plays.
 *
 * Both were real, shipped bugs: the upsell used to end the break immediately
 * for free, and `ad-skip` used to render enabled during a portal ad because
 * `adTimer` is left at 0 on the SDK path.
 */

/** Actions the game itself may run while a placeholder break is live. */
const PLACEHOLDER_ACTIONS: ReadonlySet<string> = new Set(["ad-skip", "ad-gold"]);

/**
 * May `action` run at all while an ad break is live?
 *
 * `false` means the action must be swallowed: the break owns the screen, and
 * every navigation, pause and menu control behind it is inert until it ends.
 */
export function adBreakAllowsAction(action: string, portalOwned: boolean): boolean {
  if (portalOwned) return false;
  return PLACEHOLDER_ACTIONS.has(action);
}

/**
 * May the break be ENDED right now?
 *
 * Always false for a portal break — the SDK's completion callback ends it. For
 * a placeholder break, only once its countdown has run out.
 */
export function adBreakCanEnd(portalOwned: boolean, adTimer: number): boolean {
  return !portalOwned && adTimer <= 0;
}
