import { CAMPAIGN, campaignViews } from "../Campaign";
import { calendarReward, weeklyGauntlet, type DailyChallenge } from "../Challenges";
import { DAILY_STIPEND } from "../constants";
import { iconGlyph } from "../MenuIcons";
import { modeById, type ModeDef, type ModeId } from "../Modes";
import type { RunOptions } from "../Replay";
import { TRAILS, weekKey } from "../Tournaments";
import type { GameAudio } from "../Audio";
import type { Bird } from "../Bird";
import type { HUD } from "../HUD";
import type { ParticleFX } from "../ParticleFX";
import type { SaveData } from "../SaveData";
import type { UiScreen } from "../hud/types";

/**
 * The journey/challenge action table: dailies, the weekly gauntlet, the
 * calendar gift, campaign chapters, and the stipend.
 *
 * The port is much narrower than the shop's (14 members against 25) because
 * almost none of the *rules* live here — the daily-completion check is
 * `SaveData.isDailyDone`, the gift table is `calendarReward`, chapter
 * unlock state is `campaignViews`. What is left is routing plus a handful of
 * toasts, which is exactly the part worth being able to test without a Game.
 *
 * `modeId` and `mode` are the only writable members: picking a challenge
 * selects the flight mode, and that is the one decision this table makes.
 */
export interface JourneyActionContext {
  readonly save: SaveData;
  readonly hud: HUD;
  readonly audio: GameAudio;
  readonly particles: ParticleFX;
  readonly bird: Bird;
  readonly today: string;
  modeId: ModeId;
  mode: ModeDef;
  todaysDaily(): DailyChallenge;
  exitVersus(): void;
  startRun(opts?: RunOptions): void;
  setScreen(screen: UiScreen): void;
  bump(): void;
}

/**
 * Route a journey action. Returns true when the table consumed it, which is
 * the contract `handleAction` dispatches on.
 */
export function journeyAction(ctx: JourneyActionContext, action: string, id: string): boolean {

    switch (action) {
      case "play-daily": {
        const c = ctx.todaysDaily();
        if (ctx.save.isDailyDone(ctx.today)) {
          ctx.hud.toast("Today's challenge is already complete — back tomorrow!", "info");
          return true;
        }
        ctx.modeId = c.mode;
        ctx.mode = modeById(c.mode);
        ctx.exitVersus();
        ctx.startRun({ challenge: "daily" });
        return true;
      }
      case "play-gauntlet": {
        const idx = Math.max(0, Math.min(2, parseInt(id || "0", 10) || 0));
        const g = weeklyGauntlet(weekKey());
        if (ctx.save.gauntletDone(g.week).includes(idx)) {
          ctx.hud.toast("Stage already cleared this week", "info");
          return true;
        }
        const st = g.stages[idx]!;
        ctx.modeId = st.mode;
        ctx.mode = modeById(st.mode);
        ctx.exitVersus();
        ctx.startRun({ challenge: `gauntlet${idx}` as `gauntlet${number}` });
        return true;
      }
      case "claim-calendar": {
        const day = ctx.save.claimCalendar(ctx.today);
        if (day === 0) {
          ctx.hud.toast("Today's gift is already claimed", "info");
          return true;
        }
        const r = calendarReward(day);
        if (r.kind === "coins") {
          ctx.save.addCoins(r.amount);
          ctx.hud.toast(`${iconGlyph("star")} Day ${day} gift · +${r.amount} coins`, "gold");
        } else if (r.kind === "boost") {
          ctx.save.armBoost(r.id);
          ctx.hud.toast(`${iconGlyph("star")} Day ${day} gift · boost armed for next flight`, "gold");
        } else {
          if (ctx.save.ownTrail(r.id)) ctx.hud.toast(`${iconGlyph("star")} Day ${day} gift · ${TRAILS[r.id]?.label ?? r.id} trail!`, "gold");
          else {
            ctx.save.addCoins(200);
            ctx.hud.toast(`${iconGlyph("star")} Day ${day} · trail already owned, +200 coins instead`, "gold");
          }
        }
        ctx.audio.purchase();
        ctx.bump();
        return true;
      }
      case "open-challenges":
        ctx.setScreen("challenges");
        return true;
      case "play-event": {
        ctx.modeId = "daytrip";
        ctx.mode = modeById("daytrip");
        ctx.exitVersus();
        ctx.startRun({ event: true });
        return true;
      }
      case "open-campaign":
        ctx.setScreen("campaign");
        return true;
      case "claim-campaign": {
        const ch = CAMPAIGN.find((c) => c.id === id);
        if (!ch) return true;
        const view = campaignViews(ctx.save, ctx.save.state.campaignClaimed).find((v) => v.def.id === id);
        if (!view || !view.unlocked || !view.complete || !ctx.save.claimCampaign(id)) {
          ctx.hud.toast("Chapter not ready yet", "info");
          return true;
        }
        ctx.save.addCoins(ch.rewardCoins);
        // No rewardLabel: the named banner/title/compass is granted by nothing
        // in the game, and a toast is the worst place to invent one.
        ctx.hud.toast(`${iconGlyph(ch.icon)} ${ch.title} · +${ch.rewardCoins} coins`, "gold");
        ctx.audio.chapterFanfare();
        ctx.bump();
        return true;
      }
      case "claim-daily-stipend": {
        // The card disables via the snapshot, but a double-tap can land before
        // the re-render — the handler must be its own guard.
        if (ctx.save.state.lastStipendClaimed === ctx.today) return true;
        ctx.save.addCoins(DAILY_STIPEND);
        ctx.save.state.lastStipendClaimed = ctx.today;
        ctx.audio.chapterFanfare();
        ctx.particles.emitConfetti(ctx.bird.x, ctx.bird.y + 3);
        ctx.hud.toast(`${iconGlyph("coin")} Daily Flight Stipend Claimed! +● ${DAILY_STIPEND} coins!`, "gold");
        ctx.bump();
        return true;
      }
      default:
        return false;
    }
}
