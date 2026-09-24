import { describe, expect, it } from "vitest";
import { MassRace, type NetTransport, type RemoteSnapshot } from "../MassRace";
import { TerrainSystem } from "../TerrainSystem";
import { renderCoinMultiplierCard } from "../HUD";

/**
 * Aggressive PVP / slipstream stress: the drafting ("stream") physics, the
 * eight PvP mode zones, knockout elimination, remote-snapshot robustness and
 * the post-run coin-bonus card. These run the real 40-bird field headless,
 * the same way massrace-perf.test.ts does, and pin the behaviors the
 * per-frame code gets wrong by drifting (frame-rate dependence, wrong zone
 * constants, re-armed claim buttons).
 */

const SEED = "2026-09-16";

function field(n: number, modeId?: string): { terrain: TerrainSystem; mr: MassRace } {
  const terrain = new TerrainSystem(SEED);
  const mr = new MassRace();
  if (modeId) mr.configureMode(modeId);
  mr.spawn(n, `${SEED}:${modeId ?? "stress"}:${n}`, terrain, 0);
  return { terrain, mr };
}

/** Hold every rival at fixed offsets AHEAD of the player (in the player's wake
 * — the player drafts behind them), then settle the draft. */
function settleDraft(mr: MassRace, playerX: number, playerY: number, seconds: number, dt: number, offsets: [number, number][]): number {
  const n = Math.floor(seconds / dt);
  for (let i = 0; i < n; i++) {
    mr.rivals.forEach((r, j) => {
      const [ox, oy] = offsets[j % offsets.length]!;
      r.bird.x = playerX + ox;
      r.bird.y = playerY + oy;
    });
    mr.draftFor(playerX, playerY, dt);
  }
  return mr.draft;
}

describe("slipstream smoothing (frame-rate independence)", () => {
  it("builds identically at 60 Hz and 120 Hz (time-based, not per-frame)", () => {
    const A = field(10);
    const B = field(10);
    const offsets = Array.from({ length: 10 }, (_, i) => [4 + i * 1.2, (i % 3) - 1] as [number, number]);
    const draftA = settleDraft(A.mr, 100, 20, 0.5, 1 / 60, offsets);
    const draftB = settleDraft(B.mr, 100, 20, 0.5, 1 / 120, offsets);
    // Same elapsed time → same draft, at any display refresh.
    expect(Math.abs(draftA - draftB)).toBeLessThan(1e-9);
    // Exact exponential answer for target draft 1 (dense pack saturates).
    expect(draftA).toBeCloseTo(1 - Math.exp(-9.75 * 0.5), 5);
    A.terrain.dispose();
    B.terrain.dispose();
  });

  it("decays back to no-drag on the same time constant when the zone is left", () => {
    const { terrain, mr } = field(10);
    const offsets = Array.from({ length: 10 }, (_, i) => [4 + i * 1.2, 0] as [number, number]);
    expect(settleDraft(mr, 100, 20, 2, 1 / 60, offsets)).toBeGreaterThan(0.99);
    // Walk out of every zone.
    for (let i = 0; i < 30; i++) {
      mr.rivals.forEach((r) => {
        r.bird.x = 90 - i; // fall behind the player
      });
      mr.draftFor(100, 20, 1 / 60);
    }
    expect(mr.draft).toBeCloseTo(Math.exp(-9.75 * 0.5), 4);
    expect(mr.draftFor(100, 20, 1 / 60)).toBeGreaterThan(0.95);
    terrain.dispose();
  });

  it("stays within [0,1] and drag within [1-draftMax,1] under churn", () => {
    const { terrain, mr } = field(40);
    for (let i = 0; i < 2400; i++) {
      // Rivals jitter through and out of the zone every few frames.
      mr.rivals.forEach((r, j) => {
        r.bird.x = 100 - (i % 40) - (j % 30);
        r.bird.y = 20 + Math.sin((i + j) / 7) * 9;
      });
      const drag = mr.draftFor(100, 20, 1 / 60);
      expect(mr.draft).toBeGreaterThanOrEqual(0);
      expect(mr.draft).toBeLessThanOrEqual(1);
      expect(drag).toBeGreaterThanOrEqual(1 - mr.draftMax - 1e-9);
      expect(drag).toBeLessThanOrEqual(1);
    }
    terrain.dispose();
  });

  it("zone geometry: just inside drafts, just outside / off-lateral / rear does not", () => {
    const { terrain, mr } = field(3);
    const only = mr.rivals[0]!;
    const settle = (frames: number): number => {
      for (let i = 0; i < frames; i++) mr.draftFor(100, 20, 1 / 60);
      return mr.draft;
    };
    only.bird.x = 100 + mr.draftBehind / 2; // half-way inside the zone
    only.bird.y = 20;
    expect(settle(30)).toBeGreaterThan(0.4); // target ~0.5, nearly settled
    only.bird.x = 100 + mr.draftBehind + 0.5; // just outside
    expect(settle(120)).toBeCloseTo(0, 5);
    only.bird.x = 100 + 10;
    only.bird.y = 20 + 6.5; // lateral band is 6m
    expect(settle(120)).toBeCloseTo(0, 5);
    only.bird.x = 95; // behind the player — no draft
    only.bird.y = 20;
    expect(settle(120)).toBeCloseTo(0, 5);
    terrain.dispose();
  });
});

describe("PVP mode draft zones", () => {
  const ZONES: Record<string, { behind: number; max: number }> = {
    pvp_sprint: { behind: 26, max: 0.55 },
    pvp_endurance: { behind: 26, max: 0.55 },
    pvp_knockout: { behind: 26, max: 0.55 },
    pvp_draft: { behind: 38, max: 0.85 },
    pvp_typhoon: { behind: 34, max: 0.75 },
    pvp_slalom: { behind: 30, max: 0.65 },
    pvp_zenith: { behind: 32, max: 0.6 },
    pvp_coinrush: { behind: 28, max: 0.6 },
  };

  it("every mode configures its documented zone", () => {
    for (const [modeId, zone] of Object.entries(ZONES)) {
      const { terrain, mr } = field(1, modeId);
      expect(mr.draftBehind).toBe(zone.behind);
      expect(mr.draftMax).toBeCloseTo(zone.max, 5);
      terrain.dispose();
    }
  });

  it("a rival 30m ahead drafts in wide zones and not in narrow ones", () => {
    const at = (modeId: string): number => {
      const { terrain, mr } = field(1, modeId);
      const only = mr.rivals[0]!;
      only.bird.x = 130; // 30m ahead of the player at 100
      only.bird.y = 20;
      for (let i = 0; i < 90; i++) mr.draftFor(100, 20, 1 / 60);
      const d = mr.draft;
      terrain.dispose();
      return d;
    };
    // 30m: inside draft(38)/typhoon(34)/zenith(32) with shrinking benefit
    // toward each zone's far edge; outside slalom(30, zero benefit at the
    // exact edge)/coinrush(28)/the rest(26).
    expect(at("pvp_draft")).toBeGreaterThan(0.15); // 1 - 30/38 ≈ 0.21
    expect(at("pvp_typhoon")).toBeGreaterThan(0.08); // 1 - 30/34 ≈ 0.12
    expect(at("pvp_zenith")).toBeGreaterThan(0.04); // 1 - 30/32 ≈ 0.06
    expect(at("pvp_slalom")).toBeCloseTo(0, 5);
    expect(at("pvp_sprint")).toBeCloseTo(0, 5);
    expect(at("pvp_coinrush")).toBeCloseTo(0, 5);
    expect(at("pvp_knockout")).toBeCloseTo(0, 5);
    expect(at("pvp_endurance")).toBeCloseTo(0, 5);
  });

  it("name tags use the per-mode zone, not the default constant", () => {
    const { terrain, mr } = field(1, "pvp_draft");
    const only = mr.rivals[0]!;
    only.bird.x = 130; // 30m ahead: default zone 26 says no, Tempest zone 38 says yes
    only.bird.y = 20;
    const tags = mr.getVisibleNameTags(100, 100, 20, 0);
    expect(tags).toHaveLength(1);
    expect(tags[0]!.drafting).toBe(true);
    terrain.dispose();
  });
});

describe("AI drafting + slingshot", () => {
  it("a drafting rival slingshots after holding the wake above 22 m/s", () => {
    const { terrain, mr } = field(1);
    const r = mr.rivals[0]!;
    r.bird.reset(90, 40); // airborne from the first frame
    r.reaction = Number.POSITIVE_INFINITY; // glide, don't let the AI dive
    r.reactionT = Number.POSITIVE_INFINITY;
    let sawHigh = false;
    let sawReset = false;
    for (let i = 0; i < 300; i++) {
      r.bird.x = 90; // 10m behind the player → in the player's wake
      r.bird.y = 40; // above the ~30m terrain line — airborne
      r.bird.vx = 30; // keep the slingshot gate (speed > 22) honestly open
      mr.step(1 / 60, terrain, 1500, i / 60, 100, 40);
      if (r.draftTime > 1.0) sawHigh = true;
      if (sawHigh && r.draftTime < 0.3) {
        sawReset = true; // the breakout consumed the draft charge
        break;
      }
    }
    expect(sawHigh).toBe(true);
    expect(sawReset).toBe(true);
    terrain.dispose();
  });

  it("drafting rivals out-pace identical rivals out of the wake", () => {
    const { terrain, mr } = field(2);
    const inDraft = mr.rivals[0]!;
    const control = mr.rivals[1]!;
    control.skill = inDraft.skill; // identical model, only the wake differs
    // Freeze the AI decision clocks: with the reaction timers stuck at
    // Infinity neither bird ever re-evaluates its dive call, so both glide
    // identically and the wake boost is the ONLY velocity difference.
    for (const r of [inDraft, control]) {
      r.reaction = Number.POSITIVE_INFINITY;
      r.reactionT = Number.POSITIVE_INFINITY;
    }
    inDraft.bird.reset(90, 40);
    control.bird.reset(40, 40);
    inDraft.bird.vx = 30;
    control.bird.vx = 30;
    for (let i = 0; i < 240; i++) {
      // Player flies at x=100 for 4s: inDraft sits 10m back (in the wake),
      // control is pinned 60m back (outside the 26m wake) — same model.
      inDraft.bird.x = 90;
      inDraft.bird.y = 40;
      control.bird.x = 40;
      control.bird.y = 40;
      mr.step(1 / 60, terrain, 1500, i / 60, 100, 40);
    }
    expect(inDraft.bird.vx).toBeGreaterThan(control.bird.vx);
    terrain.dispose();
  });
});

describe("knockout elimination lifecycle", () => {
  it("eliminates trailing LOCAL pilots only, never remotes, until none are left", () => {
    const { terrain, mr } = field(40);
    // Seat five real humans over local slots.
    for (let i = 0; i < 5; i++) {
      mr.rivals[i]!.kind = "remote";
      mr.rivals[i]!.id = `remote-${i}`;
    }
    let eliminatedLocals = 0;
    let eliminatedRemotes = 0;
    for (let i = 0; i < 40; i++) {
      const victim = mr.eliminateTrailing(500 * (i + 1));
      if (victim) {
        if (victim.kind === "remote") eliminatedRemotes++;
        else eliminatedLocals++;
        // Simulate the field advancing to the next checkpoint.
        for (const r of mr.rivals) if (!r.eliminated) r.bird.x += 500;
      }
    }
    expect(eliminatedRemotes).toBe(0);
    expect(eliminatedLocals).toBe(35); // 40 locals - 5 remotes seated
    expect(mr.eliminateTrailing(20000)).toBeNull(); // only remotes remain
    terrain.dispose();
  });

  it("royale end: sole survivor is the last active pilot, no exception", () => {
    const { terrain, mr } = field(1);
    mr.rivals[0]!.bird.x = 400;
    expect(mr.eliminateTrailing(500)?.eliminated).toBe(true);
    expect(mr.eliminateTrailing(1000)).toBeNull();
    terrain.dispose();
  });

  it("finished pilots are exempt from elimination", () => {
    const { terrain, mr } = field(2);
    mr.rivals[0]!.finished = true;
    mr.rivals[1]!.bird.x = 300;
    const victim = mr.eliminateTrailing(500);
    expect(victim?.id).toBe(mr.rivals[1]!.id);
    expect(mr.rivals[0]!.eliminated).toBe(false);
    terrain.dispose();
  });
});

describe("full-race lifecycle (40 rivals, 90s, finish + hide)", () => {
  it("runs clean, settles a field, and survives the post-run hidden state", () => {
    const { terrain, mr } = field(40);
    for (let i = 0; i < 90 * 60; i++) {
      mr.step(1 / 60, terrain, 1500, i / 60, 64 + i * 0.28, 20);
    }
    const before = mr.standings(25000, 0, "You", 40);
    expect(before.total).toBe(41);
    expect(before.place).toBeGreaterThanOrEqual(1);
    expect(before.place).toBeLessThanOrEqual(41);
    // finishRun() hides the group the moment the run ends.
    mr.group.visible = false;
    expect(() => {
      mr.step(1 / 60, terrain, 1500, 90.1, 25000, 20);
      expect(mr.draftFor(25000, 20, 1 / 60)).toBe(1);
      expect(mr.draft).toBe(0);
      mr.standings(25000, 0, "You", 8);
      mr.roster(25000, 0, 1500, "You");
      expect(mr.getVisibleNameTags(25000, 25000, 20, 0)).toEqual([]);
    }).not.toThrow();
    terrain.dispose();
  });
});

describe("remote snapshot robustness", () => {
  function stub(frames: RemoteSnapshot[][]): NetTransport {
    let i = 0;
    return {
      connected: true,
      send: () => {},
      poll: () => frames[Math.min(i++, frames.length - 1)] ?? [],
    };
  }

  it("rejects garbage snapshots without corrupting finite state or throwing", () => {
    const { terrain, mr } = field(2);
    const clean: RemoteSnapshot[][] = [
      [],
      [{ id: "p1", x: 1, y: 1, rotation: 0, name: "" }, { id: "", x: 1, y: 1, rotation: 0, name: "" }],
      [{ id: "p1", x: NaN, y: 5, rotation: 0, name: "Bad" }],
      [{ id: "p1", x: 120.5, y: 18.25, rotation: 0.4, name: "A".repeat(50) }],
      [{ id: "p1", x: 130, y: 19, rotation: 0.4, name: "Zed", finished: true }],
    ];
    mr.attachTransport(stub(clean));
    expect(() => {
      for (let i = 0; i < 30; i++) mr.step(1 / 60, terrain, 1500, i / 60, 100, 20);
    }).not.toThrow();
    const remote = mr.rivals.find((r) => r.kind === "remote");
    expect(remote).toBeDefined();
    expect(remote!.name).toBe("Zed"); // 50-char name truncated, then overwritten
    expect(Number.isFinite(remote!.bird.x)).toBe(true);
    expect(remote!.finished).toBe(true);
    mr.attachTransport(null);
    terrain.dispose();
  });
});

describe("emote lifecycle", () => {
  it("shows for ~2.5s and then clears from the roster", () => {
    const { terrain, mr } = field(1);
    const id = mr.rivals[0]!.id;
    mr.showEmote(id, "🚀");
    expect(mr.roster(100, 0, 1500, "You").find((r) => r.id === id)?.emote).toBe("🚀");
    for (let i = 0; i < 180; i++) mr.step(1 / 60, terrain, 1500, i / 60, 100, 20);
    expect(mr.roster(100, 0, 1500, "You").find((r) => r.id === id)?.emote).toBe("");
    terrain.dispose();
  });
});

describe("3× coin bonus card (one claim per run)", () => {
  it("renders the claim button with no ad icon when unclaimed", () => {
    const html = renderCoinMultiplierCard(250, false);
    expect(html).toContain("data-action=\"multiply-run-coins\"");
    expect(html).toContain("Claim 3×");
    expect(html).toContain("+● 500");
    expect(html).not.toContain("📺");
  });

  it("flips to a claimed chip and can never re-arm", () => {
    const claimed = renderCoinMultiplierCard(250, true);
    expect(claimed).not.toContain("multiply-run-coins");
    expect(claimed).toContain("3× bonus applied");
    expect(claimed).toContain("+● 500");
    expect(claimed).not.toContain("📺");
  });

  it("portal (rewarded) variant states the reward and marks the ad before the tap", () => {
    const html = renderCoinMultiplierCard(250, false, true);
    expect(html).toContain("data-action=\"multiply-run-coins\"");
    expect(html).toContain("🎬"); // the tap is visibly an ad placement
    expect(html).toContain("Watch a short ad"); // reward stated BEFORE the tap
    expect(html).toContain("+● 500");
    // The free (non-portal) variant must stay ad-free.
    const free = renderCoinMultiplierCard(250, false);
    expect(free).not.toContain("🎬");
    expect(free).not.toContain("📺");
  });

  it("is absent entirely when the run earned no coins", () => {
    expect(renderCoinMultiplierCard(0, false)).toBe("");
    expect(renderCoinMultiplierCard(0, true)).toBe("");
  });
});
