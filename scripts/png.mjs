/**
 * Minimal PNG decode/encode for the thumbnail pipeline.
 *
 * Why hand-rolled: the repository's asset pipeline has no native image
 * dependency (and portal builds ship zero raster assets), so adding sharp/canvas
 * just to check two PNGs would be a heavy, build-breaking dependency. PNG is
 * fully specified and the subset the thumbnails use — 8-bit RGB/RGBA,
 * non-interlaced — is small enough to implement exactly.
 *
 * Supported on decode: bit depth 8, colour types 2 (RGB) and 6 (RGBA),
 * non-interlaced, filters 0–4. Anything else raises a clear error rather than
 * producing a wrong measurement.
 */
import zlib from "node:zlib";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function isPng(buffer) {
  return buffer.length > 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** @returns {{ width:number, height:number, channels:3|4, data:Buffer, bitDepth:number, colorType:number }} */
export function decodePng(buffer) {
  if (!isPng(buffer)) throw new Error("not a PNG file");
  let offset = 8;
  let header = null;
  const idat = [];
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      };
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  if (!header) throw new Error("PNG has no IHDR chunk");
  if (header.bitDepth !== 8) throw new Error(`unsupported PNG bit depth ${header.bitDepth} (expected 8)`);
  if (header.interlace !== 0) throw new Error("interlaced PNGs are not supported");
  const channels = header.colorType === 2 ? 3 : header.colorType === 6 ? 4 : 0;
  if (!channels) throw new Error(`unsupported PNG colour type ${header.colorType} (expected 2 or 6)`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = header.width * channels;
  const out = Buffer.alloc(stride * header.height);
  let inPos = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < header.height; y += 1) {
    const filter = raw[inPos];
    inPos += 1;
    const line = Buffer.from(raw.subarray(inPos, inPos + stride));
    inPos += stride;
    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      switch (filter) {
        case 0:
          break;
        case 1:
          line[x] = (line[x] + a) & 0xff;
          break;
        case 2:
          line[x] = (line[x] + b) & 0xff;
          break;
        case 3:
          line[x] = (line[x] + ((a + b) >> 1)) & 0xff;
          break;
        case 4:
          line[x] = (line[x] + paeth(a, b, c)) & 0xff;
          break;
        default:
          throw new Error(`unknown PNG filter ${filter} on row ${y}`);
      }
    }
    line.copy(out, y * stride);
    prev = line;
  }
  return {
    width: header.width,
    height: header.height,
    channels,
    data: out,
    bitDepth: header.bitDepth,
    colorType: header.colorType,
  };
}

function crc32(buffer) {
  let c = ~0;
  for (let i = 0; i < buffer.length; i += 1) {
    c ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  const crcInput = Buffer.concat([Buffer.from(type, "ascii"), data]);
  out.writeUInt32BE(crc32(crcInput), data.length + 8);
  return out;
}

/**
 * Encode an 8-bit RGB/RGBA buffer as a PNG.
 *
 * Uses adaptive per-row filtering (the standard heuristic: pick the filter with
 * the smallest sum of absolute signed differences) instead of filter 0. The
 * thumbnails are smooth gradients, which filter 0 leaves as millions of
 * distinct bytes; the adaptive pass is what brings a 1024×1024 deliverable from
 * ~1.6 MB down to a few hundred KB — the difference between a thumbnail the
 * Inspector accepts and one it flags (THB-10).
 */
export function encodePng({ width, height, channels, data }) {
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  const candidates = [0, 1, 2, 3, 4].map(() => Buffer.alloc(stride));
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const line = data.subarray(y * stride, (y + 1) * stride);
    candidates[0].set(line);
    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      candidates[1][x] = (line[x] - a) & 0xff;
      candidates[2][x] = (line[x] - b) & 0xff;
      candidates[3][x] = (line[x] - ((a + b) >> 1)) & 0xff;
      candidates[4][x] = (line[x] - paeth(a, b, c)) & 0xff;
    }
    let best = 0;
    let bestScore = Infinity;
    for (let f = 0; f < 5; f += 1) {
      let score = 0;
      for (let x = 0; x < stride; x += 1) {
        const v = candidates[f][x];
        score += v < 128 ? v : 256 - v;
      }
      if (score < bestScore) {
        bestScore = score;
        best = f;
      }
    }
    const rowStart = y * (stride + 1);
    raw[rowStart] = best;
    candidates[best].copy(raw, rowStart + 1);
    prev = Buffer.from(line);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = channels === 4 ? 6 : 2;
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Box-filter downscale (average of the covered source pixels). 8-bit in, 8-bit out. */
export function downscale(image, targetWidth, targetHeight) {
  const { width, height, channels, data } = image;
  const out = Buffer.alloc(targetWidth * targetHeight * channels);
  for (let y = 0; y < targetHeight; y += 1) {
    const y0 = Math.floor((y * height) / targetHeight);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * height) / targetHeight));
    for (let x = 0; x < targetWidth; x += 1) {
      const x0 = Math.floor((x * width) / targetWidth);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * width) / targetWidth));
      const sums = new Array(channels).fill(0);
      let count = 0;
      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          const idx = (sy * width + sx) * channels;
          for (let c = 0; c < channels; c += 1) sums[c] += data[idx + c];
          count += 1;
        }
      }
      const outIdx = (y * targetWidth + x) * channels;
      for (let c = 0; c < channels; c += 1) out[outIdx + c] = Math.round(sums[c] / count);
    }
  }
  return { width: targetWidth, height: targetHeight, channels, data: out };
}
