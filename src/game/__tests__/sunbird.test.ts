import { describe, expect, it } from "vitest";
import {
  FLAP_NEUTRAL,
  GREY_PALETTE,
  RIVAL_PALETTES,
  SUNBIRD_PALETTE,
  SUNBIRD_VIEWBOX,
  SUN_STOPS,
  dimColor,
  EYE_MIN_SIZE,
  drawSunbird,
  drawSunDisc,
  rivalPalette,
  sunSVG,
  sunbirdSVG,
  type SunbirdPalette,
} from "../Sunbird";

/**
 * The point of Sunbird.ts is that the title-screen bird — the one players
 * recognise — is the only bird. These tests pin that:
 *
 *   1. at FLAP_NEUTRAL the shared renderer reproduces the original
 *      hand-authored `.hero-bird` markup, path for path;
 *   2. the canvas and SVG renderers emit identical fills, so the flock in the
 *      menu sky and the birds in the lobby cannot drift apart.
 */

/** A recording Canvas2D stand-in — captures every geometry call. */
function recordingCtx() {
  const calls: { kind: string; args: number[] }[] = [];
  const fills: string[] = [];
  const ctx = {
    fillStyle: "" as string,
    save: () => calls.push({ kind: "save", args: [] }),
    restore: () => calls.push({ kind: "restore", args: [] }),
    scale: (...a: number[]) => calls.push({ kind: "scale", args: a }),
    translate: (...a: number[]) => calls.push({ kind: "translate", args: a }),
    rotate: (...a: number[]) => calls.push({ kind: "rotate", args: a }),
    beginPath: () => calls.push({ kind: "beginPath", args: [] }),
    closePath: () => calls.push({ kind: "closePath", args: [] }),
    fill: () => {
      calls.push({ kind: "fill", args: [] });
      fills.push(String(ctx.fillStyle));
    },
    ellipse: (...a: number[]) => calls.push({ kind: "ellipse", args: a }),
    arc: (...a: number[]) => calls.push({ kind: "arc", args: a }),
    moveTo: (...a: number[]) => calls.push({ kind: "moveTo", args: a }),
    lineTo: (...a: number[]) => calls.push({ kind: "lineTo", args: a }),
    quadraticCurveTo: (...a: number[]) => calls.push({ kind: "quadraticCurveTo", args: a }),
    createRadialGradient: () => ({ addColorStop: () => undefined }),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, fills };
}

describe("Sunbird palettes", () => {
  it("keeps the title-screen colourway as the reference", () => {
    // Read off the original .hero-bird markup. If this changes, the lobby bird
    // stops matching the bird on the title screen.
    expect(SUNBIRD_PALETTE).toEqual({
      body: "#ff7a45",
      belly: "#ffe6c4",
      wingNear: "#ff9a62",
      wingFar: "#c85228",
      tail: "#e06a35",
      tailTip: "#be4824",
      brow: "#d84a2e",
      beak: "#ffb020",
      eye: "#2a1c28",
      eyeWhite: "#ffffff",
    });
  });

  it("gives every rival the same slots, so the silhouette never changes", () => {
    const slots = Object.keys(SUNBIRD_PALETTE).sort();
    for (const p of [...RIVAL_PALETTES, GREY_PALETTE]) {
      expect(Object.keys(p).sort()).toEqual(slots);
      for (const value of Object.values(p)) expect(value).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("wraps the rival index both ways without going out of range", () => {
    const n = RIVAL_PALETTES.length;
    expect(rivalPalette(0)).toBe(RIVAL_PALETTES[0]);
    expect(rivalPalette(n)).toBe(RIVAL_PALETTES[0]);
    expect(rivalPalette(n + 3)).toBe(RIVAL_PALETTES[3]);
    expect(rivalPalette(-1)).toBe(RIVAL_PALETTES[n - 1]);
  });
});

describe("sunbirdSVG reproduces the original hero-bird mark", () => {
  // These are the exact path strings from the hand-authored SVG that used to
  // live inline in HUD.ts. They must survive verbatim at FLAP_NEUTRAL.
  const ORIGINAL_PATHS = [
    "M8 42 L2 34 L5 44 L3 50 L12 45 Z", // tail
    "M8 44 L3 50 L6 54 L13 48 Z", // tail tip
    "M24 26 Q14 12 6 16 Q14 22 24 30 Z", // far wing
    "M26 30 Q14 14 4 20 Q15 24 27 34 Z", // near wing
    "M46 34 L58 37 L46 40 Z", // beak
    "M36 27 Q42 27.5 44 30 Q40 29.6 37 29.4 Z", // brow
  ];

  it("emits every original path, unchanged, at the neutral flap", () => {
    const svg = sunbirdSVG({ flap: FLAP_NEUTRAL });
    for (const d of ORIGINAL_PATHS) expect(svg).toContain(`d="${d}"`);
  });

  it("emits the original body, belly and three-part eye", () => {
    const svg = sunbirdSVG({ flap: FLAP_NEUTRAL });
    expect(svg).toContain('<ellipse cx="30" cy="36" rx="17" ry="11"');
    expect(svg).toContain('<ellipse cx="33" cy="40" rx="11" ry="6"');
    expect(svg).toContain('<circle cx="41" cy="32" r="3.4"');
    expect(svg).toContain('<circle cx="42.4" cy="31.4" r="1.7"');
    expect(svg).toContain('<circle cx="43" cy="30.8" r="0.7"');
    expect(svg).toContain(`viewBox="${SUNBIRD_VIEWBOX}"`);
  });

  it("applies no wing transform at all at the neutral flap", () => {
    expect(sunbirdSVG({ flap: FLAP_NEUTRAL })).not.toContain("rotate(");
  });

  it("paints in the original order — tail behind body, brow on top", () => {
    const svg = sunbirdSVG({ flap: FLAP_NEUTRAL });
    const order = [...svg.matchAll(/<(path|ellipse|circle)/g)].map((m) => m[1]);
    // tail, tailTip, body, belly, farWing, nearWing, beak, eyeWhite, eye, glint, brow
    expect(order).toEqual(["path", "path", "ellipse", "ellipse", "path", "path", "path", "circle", "circle", "circle", "path"]);
  });
});

describe("drawSunbird (canvas)", () => {
  it("draws every part of the bird", () => {
    const { ctx, calls } = recordingCtx();
    drawSunbird(ctx, 40, FLAP_NEUTRAL, 1);
    // 11 parts, exactly as painted on the title screen: 6 paths (tail, tail
    // tip, far wing, near wing, beak, brow), 2 ellipses (body, belly) and
    // 3 circles (eye white, pupil, glint).
    expect(calls.filter((c) => c.kind === "moveTo")).toHaveLength(6);
    expect(calls.filter((c) => c.kind === "ellipse")).toHaveLength(2);
    expect(calls.filter((c) => c.kind === "arc")).toHaveLength(3);
    // Both wings and the brow are quadratic curves: 2 + 2 + 2.
    expect(calls.filter((c) => c.kind === "quadraticCurveTo")).toHaveLength(6);
  });

  it("drops the three-part eye on tiny flock birds", () => {
    const tiny = recordingCtx();
    drawSunbird(tiny.ctx, EYE_MIN_SIZE - 1, FLAP_NEUTRAL, 1);
    expect(tiny.calls.filter((c) => c.kind === "arc")).toHaveLength(0);

    const readable = recordingCtx();
    drawSunbird(readable.ctx, EYE_MIN_SIZE, FLAP_NEUTRAL, 1);
    expect(readable.calls.filter((c) => c.kind === "arc")).toHaveLength(3);
  });

  it("scales every coordinate with size", () => {
    const a = recordingCtx();
    const b = recordingCtx();
    drawSunbird(a.ctx, 32, FLAP_NEUTRAL, 1);
    drawSunbird(b.ctx, 64, FLAP_NEUTRAL, 1);
    // The renderer scales the context once, so the recorded geometry is in
    // 64-unit space either way — the scale call is what differs.
    expect(a.calls.find((c) => c.kind === "scale")!.args[0]).toBeCloseTo(0.5, 6);
    expect(b.calls.find((c) => c.kind === "scale")!.args[0]).toBeCloseTo(1, 6);
    const bodyA = a.calls.find((c) => c.kind === "ellipse")!;
    const bodyB = b.calls.find((c) => c.kind === "ellipse")!;
    expect(bodyA.args).toEqual(bodyB.args);
  });

  it("rotates the wings about their shoulders as the flap moves", () => {
    const neutral = recordingCtx();
    const up = recordingCtx();
    drawSunbird(neutral.ctx, 40, FLAP_NEUTRAL, 1);
    drawSunbird(up.ctx, 40, 1, 1);
    // Neutral pose: wings unrotated, so no rotate() at all.
    expect(neutral.calls.filter((c) => c.kind === "rotate")).toHaveLength(0);
    // Flap up: both wings rotate, and negative = swept upward.
    const rots = up.calls.filter((c) => c.kind === "rotate").map((c) => c.args[0]!);
    expect(rots).toHaveLength(2);
    for (const r of rots) expect(r).toBeLessThan(0);
  });

  it("dims distant birds but never below the silhouette floor", () => {
    const near = recordingCtx();
    const far = recordingCtx();
    drawSunbird(near.ctx, 40, FLAP_NEUTRAL, 1);
    drawSunbird(far.ctx, 40, FLAP_NEUTRAL, 0.05);
    expect(near.fills[0]).toBe(dimColor("#e06a35", 1));
    expect(far.fills[0]).toBe(dimColor("#e06a35", 0.05));
    expect(dimColor("#ff7a45", 0.01)).toBe(dimColor("#ff7a45", 0.35));
  });

  it("keeps the eye highlight white at any depth, as the original mark does", () => {
    const far = recordingCtx();
    drawSunbird(far.ctx, 40, FLAP_NEUTRAL, 0.1);
    // eye white, pupil, glint are fills 7, 8, 9.
    expect(far.fills[7]).toBe("#ffffff");
    expect(far.fills[9]).toBe("#ffffff");
    expect(far.fills[8]).not.toBe("#ffffff");
  });

  it("accepts a rival palette without changing the geometry", () => {
    const hero = recordingCtx();
    const foe = recordingCtx();
    drawSunbird(hero.ctx, 40, FLAP_NEUTRAL, 1);
    drawSunbird(foe.ctx, 40, FLAP_NEUTRAL, 1, RIVAL_PALETTES[0]!);
    expect(hero.calls).toEqual(foe.calls);
    expect(hero.fills).not.toEqual(foe.fills);
  });
});

describe("sunbirdSVG and drawSunbird agree", () => {
  it("emit an identical fill list — one bird, two renderers", () => {
    const palette: SunbirdPalette = RIVAL_PALETTES[2]!;
    const { ctx, fills } = recordingCtx();
    drawSunbird(ctx, 100, FLAP_NEUTRAL, 1, palette);
    const svgFills = [...sunbirdSVG({ palette, flap: FLAP_NEUTRAL }).matchAll(/fill="([^"]+)"/g)].map((m) => m[1]);
    expect(svgFills).toEqual(fills);
  });

  it("agree across every rival palette and flap phase", () => {
    for (const palette of [SUNBIRD_PALETTE, ...RIVAL_PALETTES]) {
      for (const flap of [0, 0.2, FLAP_NEUTRAL, 0.8, 1]) {
        const { ctx, fills } = recordingCtx();
        drawSunbird(ctx, 100, flap, 1, palette);
        const svgFills = [...sunbirdSVG({ palette, flap }).matchAll(/fill="([^"]+)"/g)].map((m) => m[1]);
        expect(svgFills).toEqual(fills);
      }
    }
  });

  it("rotate the wings by the same angle", () => {
    const flap = 0.9;
    const svg = sunbirdSVG({ flap });
    const svgRots = [...svg.matchAll(/rotate\(([-\d.]+)/g)].map((m) => Number(m[1]));
    const { ctx, calls } = recordingCtx();
    drawSunbird(ctx, 100, flap, 1);
    const canvasRots = calls.filter((c) => c.kind === "rotate").map((c) => (c.args[0]! * 180) / Math.PI);
    expect(svgRots.length).toBe(2);
    svgRots.forEach((r, i) => expect(r).toBeCloseTo(canvasRots[i]!, 1));
  });
});

describe("sunbirdSVG hygiene", () => {
  it("sizes from width and keeps the shape's aspect ratio", () => {
    const svg = sunbirdSVG({ width: 76 });
    expect(svg).toContain('width="76"');
    expect(svg).toContain('height="68"');
  });

  it("escapes free text so a rival name cannot inject markup", () => {
    const svg = sunbirdSVG({ title: `<img src=x onerror="alert(1)">` });
    expect(svg).not.toContain("<img");
    expect(svg).toContain("&lt;img");
    expect(svg).toContain("<title>");
  });

  it("is decorative by default and only labelled when titled", () => {
    expect(sunbirdSVG()).toContain('aria-hidden="true"');
    expect(sunbirdSVG({ title: "Nimbus" })).toContain('role="img"');
    expect(sunbirdSVG({ title: "Nimbus" })).toContain("<title>Nimbus</title>");
  });

  it("produces no undefined or NaN in the output", () => {
    for (const flap of [0, 0.25, 0.5, 1]) {
      for (const p of [SUNBIRD_PALETTE, ...RIVAL_PALETTES]) {
        expect(sunbirdSVG({ palette: p, flap, width: 64 })).not.toMatch(/undefined|NaN/);
      }
    }
  });
});

describe("the shared sun", () => {
  it("carries the title screen's gradient stops", () => {
    // The .hero-sun disc: #fff3c4 0%, #ffd166 45%, #ff9a3a 78%, #ff7a30 100%.
    expect(SUN_STOPS).toEqual([
      [0, "#fff3c4"],
      [0.45, "#ffd166"],
      [0.78, "#ff9a3a"],
      [1, "#ff7a30"],
    ]);
    for (const [offset, color] of SUN_STOPS) {
      expect(sunSVG()).toContain(`stop-color="${color}"`);
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThanOrEqual(1);
    }
  });

  it("gives every sun a unique gradient id so two on a page cannot collide", () => {
    const a = sunSVG();
    const b = sunSVG();
    const idA = a.match(/id="(sbSun\d+)"/)![1];
    const idB = b.match(/id="(sbSun\d+)"/)![1];
    expect(idA).not.toBe(idB);
    expect(a).toContain(`url(#${idA})`);
    expect(b).toContain(`url(#${idB})`);
  });

  it("draws the corona by default and drops it on request", () => {
    expect((sunSVG().match(/<circle/g) ?? []).length).toBe(3);
    expect((sunSVG({ corona: false }).match(/<circle/g) ?? []).length).toBe(1);
  });

  it("paints the same gradient into a canvas context", () => {
    const stops: [number, string][] = [];
    const ctx = {
      fillStyle: "",
      createRadialGradient: () => ({
        addColorStop: (o: number, c: string) => stops.push([o, c]),
      }),
      beginPath: () => undefined,
      arc: () => undefined,
      fill: () => undefined,
    } as unknown as CanvasRenderingContext2D;

    drawSunDisc(ctx, 32);
    expect(stops.map((s) => s[1])).toEqual(SUN_STOPS.map((s) => s[1]));
  });

  it("produces no undefined or NaN", () => {
    for (const size of [24, 48, 64, 120]) {
      expect(sunSVG({ size })).not.toMatch(/undefined|NaN/);
    }
  });
});
