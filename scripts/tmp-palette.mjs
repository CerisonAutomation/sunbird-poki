import { decodePng } from "./png.mjs";
import { readFileSync } from "node:fs";
const img = decodePng(readFileSync(process.argv[2]));
let golden = 0, green = 0, total = 0, dark = 0;
let sumR = 0, sumG = 0, sumB = 0;
const y0 = Math.floor(img.height * 0.35), y1 = Math.floor(img.height * 0.95);
for (let y = y0; y < y1; y++) {
  for (let x = 0; x < img.width; x++) {
    const i = (y * img.width + x) * img.channels;
    const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
    sumR += r; sumG += g; sumB += b;
    if (r < 20 && g < 20 && b < 20) dark++;
    if (r > 200 && g > 150 && b < 160 && r > b + 50) golden++;
    if (g > r + 25 && g > b + 25) green++;
    total++;
  }
}
console.log(JSON.stringify({
  w: img.width, h: img.height, avg: [Math.round(sumR/total), Math.round(sumG/total), Math.round(sumB/total)],
  darkPct: Math.round(dark/total*100), goldenPct: Math.round(golden/total*100), greenPct: Math.round(green/total*100),
}));
