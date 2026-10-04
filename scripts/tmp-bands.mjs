import { decodePng } from "./png.mjs";
import { readFileSync } from "node:fs";
const img = decodePng(readFileSync(process.argv[2]));
const bands = 10;
for (let b = 0; b < bands; b++) {
  const y0 = Math.floor(img.height * b / bands), y1 = Math.floor(img.height * (b + 1) / bands);
  let r = 0, g = 0, bl = 0, n = 0, golden = 0, green = 0;
  for (let y = y0; y < y1; y += 2) for (let x = 0; x < img.width; x += 2) {
    const i = (y * img.width + x) * img.channels;
    const R = img.data[i], G = img.data[i + 1], B = img.data[i + 2];
    r += R; g += G; bl += B; n++;
    if (R > 200 && G > 150 && B < 160 && R > B + 50) golden++;
    if (G > R + 25 && G > B + 25) green++;
  }
  console.log(`band ${b} (y ${y0}-${y1}): avg [${Math.round(r/n)},${Math.round(g/n)},${Math.round(bl/n)}] golden%=${Math.round(golden/n*100)} green%=${Math.round(green/n*100)}`);
}
