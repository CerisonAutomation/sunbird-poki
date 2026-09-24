/**
 * Error taxonomy for the client resilience kernel — pure, dependency-free.
 *
 * Every runtime error that reaches the kernel passes through here exactly
 * once, and the output decides what happens downstream:
 *
 *   fingerprint → dedup (one storm of the same error costs one event)
 *   severity    → routing (fatal = journal + telemetry, noise = breadcrumb only)
 *   redact      → privacy (no PII, no tokens, no URLs-with-secrets ever leave)
 *
 * Kept free of `window`/`document` so the whole taxonomy is unit-testable and
 * reusable from workers later.
 */

export type Severity = "fatal" | "error" | "warning";

/** Hard cap on any stored/transmitted message — stack fragments and DOM
 * fragments can be enormous; the journal and the beacon must not be. */
const MAX_MESSAGE_CHARS = 220;

/**
 * Normalize an arbitrary thrown value into a short, safe string.
 * Never throws, never returns more than MAX_MESSAGE_CHARS.
 */
export function safeMessage(reason: unknown): string {
  if (typeof reason === "string") return clip(reason);
  if (reason instanceof Error) {
    const name = reason.name || "Error";
    const msg = reason.message || "";
    return clip(`${name}: ${msg}`);
  }
  // Objects can throw on toString (null prototype with Symbol.toStringTag,
  // getters that raise). String() is wrapped for exactly that reason.
  try {
    return clip(String(reason));
  } catch {
    return "unserializable thrown value";
  }
}

function clip(s: string): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > MAX_MESSAGE_CHARS ? `${flat.slice(0, MAX_MESSAGE_CHARS - 1)}…` : flat;
}

/**
 * Strip anything that could identify a person or leak a credential before a
 * message is persisted or beaconed:
 *  - email addresses
 *  - bearer/token-style query params (`?token=…&key=…&sig=…`)
 *  - long digit runs (device-ish ids, epoch timestamps) → `#`
 *  - long mixed-secret-looking runs (>=24 hex/base64url chars) → `<secret>`
 */
export function redact(message: string): string {
  return message
    .replace(/[\w.+-]+@[\w-]+\.[\w.]{2,}/g, "<email>")
    .replace(/(token|key|secret|sig|password|auth)=([^&\s"']+)/gi, "$1=<redacted>")
    .replace(/\b[0-9a-f]{24,}\b/gi, "<secret>")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "<secret>")
    .replace(/\d{7,}/g, "#");
}

/**
 * Dedup key: same root cause should collapse to one fingerprint even when the
 * variable parts (numbers, positions, urls) differ. "TypeError: Cannot read
 * properties of undefined (reading 'x')" and the same at a different offset
 * become ONE key — that is the storm case the reporter must survive.
 */
export function fingerprint(message: string): string {
  const base = redact(message)
    .toLowerCase()
    .replace(/\b0x[0-9a-f]+\b/g, "0x#")
    .replace(/\d+(\.\d+)?/g, "#")
    .replace(/https?:\/\/\S+/g, "url")
    .replace(/\s+/g, " ")
    .trim();
  return fnv1a(base).toString(36);
}

/** FNV-1a 32-bit — tiny, dependency-free, good enough for dedup keys. */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Severity policy:
 *  - "fatal": renderer/OOM/context-class failures and anything thrown while
 *    booting — the session probably ended.
 *  - "warning": network-ish and storage-ish failures — degraded, not broken.
 *  - "error": everything else.
 */
export function classify(message: string): Severity {
  const m = message.toLowerCase();
  if (
    /webgl|context (lost|destroyed)|out of memory|allocation failure|abort\(oom\)|hardware acceleration/.test(m)
  ) {
    return "fatal";
  }
  if (/network|fetch|timeout|aborterror|offline|quota|storage|beacon|socket|websocket/.test(m)) {
    return "warning";
  }
  return "error";
}

/** Sliding-window rate limiter used by the reporter — pure so it is testable. */
export class RateGate {
  private readonly stamps: number[] = [];
  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}
  allow(now: number): boolean {
    while (this.stamps.length > 0 && now - this.stamps[0]! >= this.windowMs) this.stamps.shift();
    if (this.stamps.length >= this.max) return false;
    this.stamps.push(now);
    return true;
  }
  get count(): number {
    return this.stamps.length;
  }
}
