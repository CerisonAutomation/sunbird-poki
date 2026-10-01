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

/**
 * Is the "return to flight" escape hatch armed yet?
 *
 * This is the third skip vector, and it was wide open. On a portal build both
 * `ad-skip` and `ad-gold` are correctly false, so the panel fell through to an
 * `ad-stuck` button — an escape hatch added so a break whose SDK promise never
 * settles cannot trap the game forever. It was rendered **enabled from the
 * first frame of every break**, and because `adTimer` is left at 0 on the
 * portal path its label read a flat "Return to flight" rather than counting
 * anything down. One click, at t = 0, on a real ad, tore down the game's ad
 * state and returned the player to their run.
 *
 * That is a player-initiated ad skip, which is precisely what the rest of this
 * module exists to make impossible — and tearing down the break while the
 * portal's own ad is still on screen is the kind of thing an ad network treats
 * as inventory fraud, not as a bug.
 *
 * The hatch is for a *broken* SDK, so it may only arm once the break has
 * demonstrably failed: after the same wall-clock window the automatic safety
 * valve uses. Before that it renders disabled with an honest countdown, and
 * the action handler refuses it independently — the view is never the only
 * thing standing between a player and a skip.
 */
export function adEscapeArmed(elapsedSeconds: number, safetySeconds: number): boolean {
  if (!Number.isFinite(elapsedSeconds) || !Number.isFinite(safetySeconds)) return false;
  return elapsedSeconds >= safetySeconds;
}

/**
 * Whole seconds still to wait before the escape hatch arms — for the button's
 * own label, so the panel is never a dead control with no explanation.
 * Returns 0 once armed.
 */
export function adEscapeCountdown(elapsedSeconds: number, safetySeconds: number): number {
  if (!Number.isFinite(elapsedSeconds) || !Number.isFinite(safetySeconds)) return 0;
  return Math.max(0, Math.ceil(safetySeconds - elapsedSeconds));
}
