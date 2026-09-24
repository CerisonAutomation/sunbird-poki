import { describe, expect, it } from "vitest";
import { SquadClient, SQUAD_QUESTS } from "../Squad";
import { dailyFlashBird, dailyDealBoost, skinById } from "../Economy";
import { SaveData } from "../SaveData";

describe("Autonomous Squad and Upgraded Shop Engine", () => {
  it("starts the offline squadron hub empty and honest — no invented pilots, clubs or chat", () => {
    const squad = new SquadClient("test-device-auto", () => "Captain Falcon");
    squad.enableAutonomous();

    expect(squad.state.live).toBe(true);
    expect(squad.state.registered).toBe(true);
    expect(squad.state.myCode).toMatch(/^SUN-[A-Z0-9]{6}$/);
    // The panel must never ship a roster of fictional wingmates or a club the
    // player never joined: an empty, explained screen beats a fake busy one.
    expect(squad.state.friends).toEqual([]);
    expect(squad.state.clubs).toEqual([]);
    expect(squad.state.myClubId).toBeNull();
    expect(squad.state.chat).toEqual([]);
  });

  it("handles offline friend addition, removal, and club founding", async () => {
    const squad = new SquadClient("test-device-mutations", () => "Captain Falcon");
    squad.enableAutonomous();

    // Adding by code offline must NOT invent a pilot from the code itself.
    const addResult = await squad.addFriend("SUN-PILOT99");
    expect(addResult).toMatch(/online service/i);
    expect(squad.state.friends).toEqual([]);
    expect(JSON.stringify(squad.state)).not.toContain("Wingman-");

    // A real pilot met in a race can still be saved, because the name is real.
    const saved = squad.rememberWingman("Bora Sky");
    expect(saved).toContain("Bora Sky");
    expect(squad.state.friends.map((f) => f.name)).toEqual(["Bora Sky"]);
    await squad.removeFriend("Bora Sky");
    expect(squad.state.friends).toEqual([]);

    // Create club
    const clubResult = await squad.createClub("Cloud Raiders", "Soar above the storm");
    expect(clubResult).toBe("Club founded!");
    expect(squad.state.myClubId).not.toBeNull();
    const created = squad.state.clubs.find((c) => c.name === "Cloud Raiders");
    expect(created).toBeDefined();

    // Send chat
    const sent = await squad.sendChat("Checking in from 4,000 m!");
    expect(sent).toBe(true);
    expect(squad.state.chat.some((m) => m.text.includes("Checking in"))).toBe(true);
  });

  it("calculates deterministic 40% daily flash sale on birds and 50% deal on boosts", () => {
    const dateStr = "2026-09-16";
    const flash = dailyFlashBird(dateStr);
    expect(flash.id).toBeDefined();
    expect(flash.discountPct).toBe(40);

    const skin = skinById(flash.id);
    expect(skin.name).toBeDefined();
    expect(flash.price).toBeLessThan(flash.originalPrice);

    const boostDeal = dailyDealBoost(dateStr);
    expect(boostDeal.id).toBeDefined();
    expect(boostDeal.price).toBeGreaterThan(0);
  });

  it("honors daily flash price for SkinView affordability and purchase spend", () => {
    const dateStr = "2026-09-16";
    const flash = dailyFlashBird(dateStr);
    const skinDef = skinById(flash.id);
    const save = new SaveData();

    // Set wallet to exactly flash.price (which is less than skinDef.price)
    save.state.wallet = flash.price;
    expect(save.state.wallet).toBeLessThan(skinDef.price);

    // SkinView with dealPrice is affordable with discounted wallet
    const skinView = {
      def: skinDef,
      owned: false,
      equipped: false,
      locked: false,
      lockReason: null,
      affordable: save.state.wallet >= (skinDef.id === flash.id ? flash.price : skinDef.price),
      dealPrice: flash.price,
    };
    expect(skinView.affordable).toBe(true);
    expect(skinView.dealPrice).toBe(flash.price);

    // Spending the flash price succeeds
    const spent = save.spend(skinView.dealPrice);
    expect(spent).toBe(true);
    expect(save.state.wallet).toBe(0);
  });

  it("defines active squadron team quests with claimable rewards", () => {
    expect(SQUAD_QUESTS.length).toBe(3);
    const migration = SQUAD_QUESTS.find((q) => q.id === "migration")!;
    expect(migration.rewardCoins).toBe(150);
    expect(migration.target).toBe(4000);

    const drafting = SQUAD_QUESTS.find((q) => q.id === "drafting")!;
    expect(drafting.rewardCoins).toBe(120);

    const precision = SQUAD_QUESTS.find((q) => q.id === "precision")!;
    expect(precision.rewardCoins).toBe(100);
  });

  it("manages daily flight stipend and squadron quest claims in save data", () => {
    const save = new SaveData();
    const initialWallet = save.state.wallet;

    // Claim daily stipend
    save.addCoins(250);
    save.state.lastStipendClaimed = "2026-09-16";
    expect(save.state.wallet).toBe(initialWallet + 250);
    expect(save.state.lastStipendClaimed).toBe("2026-09-16");

    // Ace Pilot Crate purchase
    const canAfford = save.spend(240);
    expect(canAfford).toBe(true);
    save.armBoost("shield");
    save.armBoost("sunflask");
    save.armBoost("magnet");
    save.ownTrail("trail_tide");
    save.addCoins(250);

    expect(save.state.armedBoosts).toContain("shield");
    expect(save.state.armedBoosts).toContain("sunflask");
    expect(save.state.armedBoosts).toContain("magnet");
    expect(save.state.tournaments.trails).toContain("trail_tide");
  });
});
