/**
 * CRC32 (IEEE 802.3 polynomial) — the integrity seal for persisted payloads.
 *
 * Why a checksum on top of JSON.parse? Because the failure mode it guards is
 * the worst one a save file can have: a *silently truncated* write (tab killed
 * mid-write, quota hit at 90%, browser crash during a sync). Truncated JSON
 * usually fails to parse — but when it doesn't (balanced quotes, dropped
 * digits inside a number), parse succeeds and the player's best distance comes
 * back wrong. A checksum turns "silently wrong" into "detectably wrong", which
 * the save layer can then heal from its backup slot instead of trusting.
 *
 * Pure and synchronous: table generated lazily on first use, 1 KB, no deps.
 */

const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(input: string): number {
  let c = 0xffffffff;
  for (let i = 0; i < input.length; i++) {
    c = TABLE[(c ^ input.charCodeAt(i)) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** 8-hex-char form — stable sort/format for humans and tests. */
export function crc32Hex(input: string): string {
  return crc32(input).toString(16).padStart(8, "0");
}

/**
 * Wrap a raw JSON string in a checksummed envelope.
 *
 * Format: {"v":1,"crc":"<8 hex>","data":"<raw JSON, double-encoded>"}
 * The envelope is itself valid JSON so every existing consumer (portal cloud
 * save adapters, export/import flows) keeps working with plain JSON tooling.
 */
export function sealPayload(rawJson: string): string {
  return JSON.stringify({ v: 1, crc: crc32Hex(rawJson), data: rawJson });
}

/**
 * Verify + unwrap a sealed payload.
 *  - sealed + valid    → { ok: true, data }
 *  - sealed + corrupt  → { ok: false, reason: "checksum" }
 *  - not sealed at all → { ok: true, data: input } — legacy bare-JSON saves
 *    (every pre-seal payload) keep loading untouched. Backward compatibility
 *    is not optional in save code.
 */
export function openPayload(raw: string): { ok: boolean; data: string; reason?: "checksum" } {
  if (!raw.startsWith("{\"v\":1,")) return { ok: true, data: raw };
  try {
    const env = JSON.parse(raw) as { v?: unknown; crc?: unknown; data?: unknown };
    if (env.v !== 1 || typeof env.crc !== "string" || typeof env.data !== "string") {
      return { ok: false, data: "", reason: "checksum" };
    }
    if (crc32Hex(env.data) !== env.crc) return { ok: false, data: "", reason: "checksum" };
    return { ok: true, data: env.data };
  } catch {
    // A truncated envelope: unparseable wrapper means we cannot even read the
    // checksum — treat as corrupt so the caller heals from backup.
    return { ok: false, data: "", reason: "checksum" };
  }
}

/** True when a stored payload is in the sealed (v1) envelope format. */
export function isSealed(raw: string): boolean {
  return raw.startsWith("{\"v\":1,");
}
