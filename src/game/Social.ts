import { copyText, shareCancelled } from "./Clipboard";
import { drawSunbird, FLAP_NEUTRAL, skinPalette } from "./Sunbird";
import type { SkinDef } from "./Economy";

export type ShareCard = { blob: Blob | null; dataUrl: string; text: string };

/**
 * Pure share-text builder — the viral payload without canvas.
 * Text is the channel that survives: native share sheets, clipboard, and
 * portal iframes (where image downloads are QA-flagged) all carry it.
 * Kept pure so the link grammar is test-pinned without a canvas.
 */
export function buildShareText(opts: {
  distance: number;
  referralCode: string;
  challengeUrl?: string;
}): string {
  const base = `I flew ${Math.floor(opts.distance)}m in Sunbird 🌤️ Use my code ${opts.referralCode} for a bonus!`;
  return opts.challengeUrl ? `I flew ${Math.floor(opts.distance)}m in Sunbird 🌤️ Tiny wings. Unreasonable confidence. Beat me here: ${opts.challengeUrl} · Friend code: ${opts.referralCode}` : base;
}

/** Draws a shareable "flight card" summarizing a run onto a canvas. */
export async function buildShareCard(opts: {
  distance: number;
  coins: number;
  score: number;
  skin: SkinDef;
  referralCode: string;
  seedLabel: string;
  flightPath?: readonly [number, number][];
  /** Zero-server rival link — fused into the card so the image carries its own rematch. */
  challengeUrl?: string;
}): Promise<ShareCard> {
  const w = 1000;
  const h = 620;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // A collectible flight postcard in the same palette as the illustrated UI.
  ctx.fillStyle = "#8b571c";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#fff8e0";
  roundRect(ctx, 24, 24, w - 48, h - 48, 30); ctx.fill();
  ctx.save();
  roundRect(ctx, 24, 24, w - 48, h - 48, 30); ctx.clip();
  for (const [base, amplitude, color] of [[300, 35, "#ffeab0"], [356, 30, "#ffdc85"], [414, 20, "#f5c669"]] as const) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(610, h);
    for (let x = 610; x <= w; x += 10) ctx.lineTo(x, base + Math.sin(x * 0.012) * amplitude);
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  ctx.textAlign = "left";
  ctx.fillStyle = "#8b571c";
  ctx.font = "500 42px Fredoka, sans-serif";
  ctx.fillStyle = "#bc800f";
  ctx.fillText("SUNBIRD", 64, 90);
  ctx.font = "600 15px Atkinson Hyperlegible, sans-serif";
  fitText(ctx, opts.seedLabel, 520, 16, "500");
  ctx.fillText(opts.seedLabel, 64, 122);
  ctx.fillStyle = "#857455";
  ctx.font = "700 13px Atkinson Hyperlegible, sans-serif";
  ctx.fillText("A LITTLE BIRD. A FLIGHT WORTH SHARING.", 64, 180);
  ctx.fillStyle = "#8b571c";
  const distance = `${Math.max(0, Math.floor(opts.distance)).toLocaleString("en-US")} m`;
  fitText(ctx, distance, 530, 92, "600");
  ctx.fillText(distance, 64, 276);
  const stat = (label: string, value: string, x: number): void => {
    ctx.fillStyle = "#766b52"; ctx.font = "700 12px Atkinson Hyperlegible, sans-serif";
    ctx.fillText(label, x, 322);
    ctx.fillStyle = "#8b571c"; fitText(ctx, value, 225, 34, "600");
    ctx.fillText(value, x, 363);
  };
  stat("COINS COLLECTED", String(opts.coins), 64);
  stat("FLIGHT SCORE", Math.floor(opts.score).toLocaleString("en-US"), 324);
  const points = (opts.flightPath ?? []).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)).slice(0, 100);
  if (points.length >= 3) {
    const width = Math.max(1, ...points.map(p => p[0]));
    const peak = Math.max(1, ...points.map(p => p[1]));
    ctx.beginPath();
    points.forEach(([x, y], i) => {
      const px = 64 + Math.max(0, x) / width * 520, py = 433 - Math.max(0, y) / peak * 44;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = "#739775"; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.stroke();
  }
  ctx.fillStyle = "#f8d879"; ctx.beginPath(); ctx.arc(795, 212, 105, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(785, 265); ctx.rotate(-0.15);
  drawSunbird(ctx, 205, FLAP_NEUTRAL, 1, skinPalette(opts.skin)); ctx.restore();
  ctx.fillStyle = "#8b571c"; ctx.textAlign = "center";
  fitText(ctx, opts.skin.name, 300, 23, "600"); ctx.fillText(opts.skin.name, 790, 384);
  ctx.textAlign = "left";
  ctx.fillStyle = "#8b571c"; roundRect(ctx, 48, 465, 904, 108, 20); ctx.fill();
  ctx.fillStyle = "#fff1cd"; ctx.font = "600 23px Fredoka, sans-serif";
  ctx.fillText(opts.challengeUrl ? "SAME HILLS. CAN YOU GO FARTHER?" : "THE SKY IS BETTER WITH FRIENDS.", 70, 503);
  ctx.font = "400 16px Atkinson Hyperlegible, sans-serif";
  ctx.fillText(opts.challengeUrl ? "Open the challenge link in the shared message. Your flight is next." : "Dive the valleys. Ride the ridgeline. Find your next flight.", 70, 531);
  ctx.font = "500 12px Atkinson Hyperlegible, sans-serif";
  ctx.fillText(`Play free · friend code ${opts.referralCode}`, 70, 554);

  const dataUrl = canvas.toDataURL("image/png");
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  const text = buildShareText({
    distance: opts.distance,
    referralCode: opts.referralCode,
    challengeUrl: opts.challengeUrl,
  });
  return { blob, dataUrl, text };
}

/** Long scores and bird names must not collide with adjacent stat columns. */
function fitText(ctx: CanvasRenderingContext2D, text: string, width: number, size: number, weight: string): void {
  do { ctx.font = `${weight} ${size}px Fredoka, sans-serif`; size -= 1; }
  while (size >= 10 && ctx.measureText(text).width > width);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function shareOrDownload(
  card: ShareCard,
  filename = "sunbird-flight.png",
  allowDownload = true,
): Promise<"shared" | "downloaded" | "copied" | "cancelled" | "unavailable"> {
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };
  if (nav.share && card.blob) {
    const file = new File([card.blob], filename, { type: "image/png" });
    const data: ShareData = { files: [file], text: card.text, title: "Sunbird" };
    if (!nav.canShare || nav.canShare(data)) {
      try {
        await nav.share(data);
        return "shared";
      } catch (error) {
        if (shareCancelled(error)) return "cancelled";
      }
    }
  }
  const copied = await copyText(card.text);
  // Portal builds must not initiate downloads; an unavailable clipboard needs
  // a manual-copy fallback, not a fabricated success message.
  if (!allowDownload) return copied ? "copied" : "unavailable";
  const a = document.createElement("a");
  a.href = card.dataUrl;
  a.download = filename;
  a.click();
  return "downloaded";
}
