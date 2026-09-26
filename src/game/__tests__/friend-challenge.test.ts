import { beforeEach, describe, expect, it } from "vitest";
import { SaveData } from "../SaveData";
import { SocialSystem } from "../SocialSystem";

/**
 * Ghost-race challenges (SocialSystem.FriendChallenge) were a fully built
 * data model with no caller anywhere in the game — `Game.ts` exposed a
 * `socialSystem` getter nothing ever read. This pins the local round trip
 * the Squad screen now drives: post a challenge, accept it, settle it when
 * the flight lands, exactly like `Game.beginFriendChallengeRace` /
 * `Game.finishRun` do.
 */
describe("friend ghost challenges", () => {
  let save: SaveData;
  let social: SocialSystem;

  beforeEach(() => {
    localStorage.clear();
    save = new SaveData();
    social = new SocialSystem(save);
  });

  it("creates a pending challenge and surfaces it as active", () => {
    const ch = social.createChallenge("SUN-ABC123", "Mika", "distance", 1200, "2026-09-26", 1200);
    expect(ch).not.toBeNull();
    expect(ch!.status).toBe("pending");
    const active = social.getActiveChallenges();
    expect(active).toHaveLength(1);
    expect(active[0]!.id).toBe(ch!.id);
  });

  it("refuses a second pending challenge at the same target", () => {
    social.createChallenge("SUN-ABC123", "Mika", "distance", 1200, "2026-09-26", 1200);
    const dupe = social.createChallenge("SUN-ABC123", "Mika", "distance", 1300, "2026-09-26", 1300);
    expect(dupe).toBeNull();
    expect(social.getActiveChallenges()).toHaveLength(1);
  });

  it("accepts, then settles won/lost/tied off the flight's own distance", () => {
    const won = social.createChallenge("SUN-WIN001", "Ari", "distance", 1000, "2026-09-26", 1000);
    social.acceptChallenge(won!.id);
    expect(social.completeChallenge(won!.id, 1200)).toBe("won");

    const lost = social.createChallenge("SUN-LOS001", "Bo", "distance", 1000, "2026-09-26", 1000);
    social.acceptChallenge(lost!.id);
    expect(social.completeChallenge(lost!.id, 800)).toBe("lost");

    const tied = social.createChallenge("SUN-TIE001", "Cy", "distance", 1000, "2026-09-26", 1000);
    social.acceptChallenge(tied!.id);
    expect(social.completeChallenge(tied!.id, 1000)).toBe("tied");

    // Settled challenges drop out of the active (pending/accepted) list.
    expect(social.getActiveChallenges()).toHaveLength(0);
  });

  it("refuses to settle a challenge that was never accepted", () => {
    const ch = social.createChallenge("SUN-ABC123", "Mika", "distance", 1200, "2026-09-26", 1200);
    expect(social.completeChallenge(ch!.id, 1500)).toBeNull();
  });

  it("persists across a fresh SocialSystem instance over the same save", () => {
    social.createChallenge("SUN-ABC123", "Mika", "distance", 1200, "2026-09-26", 1200);
    const reloaded = new SocialSystem(save);
    expect(reloaded.getActiveChallenges()).toHaveLength(1);
  });
});
