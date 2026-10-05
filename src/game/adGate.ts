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
 *    only once that countdown has reached zero — and then it ends ITSELF, in
 *    fixedUpdate, with no control to press. It previously had no self-exit at
 *    all, so pressing `ad-skip` was the only way out and skipping was
 *    therefore the intended exit from every break on a non-portal build. The
 *    "remove breaks" upsell is gated on the same countdown, so taking the
 *    offer still plays the break out first.
 *
 * Both were real, shipped bugs: the upsell used to end the break immediately
 * for free, and `ad-skip` used to render enabled during a portal ad because
 * `adTimer` is left at 0 on the SDK path.
 */

/** Actions the game itself may run while a placeholder break is live.
 *
 * `ad-skip` used to be in here. It is not any more: a placeholder break now
 * ends itself when its countdown lands, the panel renders a read-only chip
 * instead of a button, and the action is an explicit no-op. Skipping is not
 * a thing the player can do on either path. `ad-gold` stays — it is the
 * upsell, and it is separately gated on the same countdown, so taking the
 * offer still plays the break out first. */
const PLACEHOLDER_ACTIONS: ReadonlySet<string> = new Set(["ad-gold"]);

/**
 * May `action` run at all while an ad break is live?
 *
 * `false` means the action must be swallowed: the break owns the screen, and
 * every navigation, pause and menu control behind it is inert until it ends.
 */
/**
 * May the ad-free Gold continue be granted?
 *
 * Gold is sold as "Unlimited free second winds - the sun never wins", so the
 * continue it hands out costs nothing AND plays no ad. On a portal that is the
 * skip this whole module exists to prevent, and the skip was live: the view
 * declines to DRAW the button there (`!portal && s.gold` in `hud/run.ts`), but
 * the handler was `if (this.state === "continue" && this.save.state.gold)` —
 * no portal check at all. `save.state.gold` is restored straight out of the
 * saved payload (SaveData.ts: `gold: Boolean(p.gold)`) and `SELL_AD_REMOVAL` is
 * false on the Poki fork, so no Gold surface is ever drawn for the player — but
 * a save carrying the flag still reached the case, one dispatch away from
 * unlimited ad-free continues.
 *
 * Same rule as `ad-stuck`, stated in this module's own header: the view is
 * never the only thing standing between a player and a skip.
 *
 * The coin path is deliberately NOT here. Spending coins is one of the
 * standard alternatives MON-05…MON-08 require to sit beside every rewarded
 * offer, and requiring an ad to continue would be the opposite violation.
 */
export function goldContinueAllowed(portalEnabled: boolean, gold: boolean): boolean {
  return !portalEnabled && gold;
}

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
