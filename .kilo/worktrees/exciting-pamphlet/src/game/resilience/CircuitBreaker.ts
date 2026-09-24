/**
 * Per-host circuit breakers for the client resilience kernel.
 *
 * The problem: when the leaderboard backend hangs, every board open, score
 * upload and ghost fetch adds another request to a dying endpoint — burning
 * the player's battery, slowing the UI thread with doomed sockets, and
 * DDoS-ing our own infrastructure from thousands of clients at once.
 *
 * The fix is the standard three-state breaker, but the *decisions* live in a
 * pure function so they can be unit-tested without a clock:
 *
 *   CLOSED   — normal operation; failures accumulate in a sliding window.
 *   OPEN     — requests are rejected instantly (cheap failure) for a cooldown.
 *   HALF_OPEN— one probe may test the waters; success heals, failure re-opens
 *              with a doubled cooldown (up to a cap) so a flapping endpoint
 *              backs off instead of getting probed every second.
 *
 * This is self-healing infrastructure: no operator has to notice or reset
 * anything. The endpoint recovers, the next probe succeeds, the game heals.
 */

export type BreakerState = "closed" | "open" | "half-open";

export interface BreakerSnapshot {
  state: BreakerState;
  failures: number;
  openedAt: number;
  /** Anchor of the sliding failure window (-1 = none). Separate from
   * `openedAt` on purpose: overloading one field for both roles made the
   * window reset depend on truthiness — a subtle bug class this field split
   * eliminates. -1 rather than 0 as the "none" sentinel so a failure at
   * time zero is unambiguous. */
  windowStart: number;
  /** Current cooldown used by OPEN — grows on repeated half-open failures. */
  cooldownMs: number;
}

export interface BreakerConfig {
  /** Consecutive failures within the window that trip the breaker. */
  threshold: number;
  /** Sliding window (ms) in which those failures must occur. */
  windowMs: number;
  /** Initial OPEN cooldown. Doubles per failed probe, capped. */
  cooldownMs: number;
  maxCooldownMs: number;
}

export const DEFAULT_BREAKER: BreakerConfig = {
  threshold: 4,
  windowMs: 30_000,
  cooldownMs: 15_000,
  maxCooldownMs: 5 * 60_000,
};

/**
 * Pure decision core. `next` mutates nothing: callers feed it the previous
 * snapshot + what happened, and get the new snapshot back. A singleton
 * `Breaker` (below) is just a mutable cell around this.
 */
export function step(
  s: BreakerSnapshot,
  event: "failure" | "success" | "probe-allowed" | "check",
  now: number,
  cfg: BreakerConfig = DEFAULT_BREAKER,
): BreakerSnapshot {
  switch (event) {
    case "failure": {
      if (s.state === "open") return s; // failures while open don't count twice
      if (s.state === "half-open") {
        // Probe failed: re-open, doubling the cooldown (flap protection).
        const cooldown = Math.min(cfg.maxCooldownMs, s.cooldownMs * 2);
        return {
          state: "open",
          failures: s.failures,
          openedAt: now,
          windowStart: s.windowStart,
          cooldownMs: cooldown,
        };
      }
      // Sliding window: failures older than windowMs fall out of the count.
      const inWindow = s.windowStart >= 0 && now - s.windowStart <= cfg.windowMs;
      const failures = inWindow ? s.failures + 1 : 1;
      if (failures >= cfg.threshold) {
        return { state: "open", failures, openedAt: now, windowStart: s.windowStart, cooldownMs: cfg.cooldownMs };
      }
      return { state: "closed", failures, openedAt: 0, windowStart: s.windowStart >= 0 ? s.windowStart : now, cooldownMs: s.cooldownMs };
    }
    case "success":
      // Any success heals completely — conservative probes mean one success
      // is real evidence the endpoint is back.
      return { state: "closed", failures: 0, openedAt: 0, windowStart: -1, cooldownMs: cfg.cooldownMs };
    case "probe-allowed": {
      if (s.state === "closed") return s;
      if (s.state === "open" && now - s.openedAt >= s.cooldownMs) {
        return { ...s, state: "half-open" };
      }
      return s;
    }
    case "check":
      return s;
  }
}

/** May a request through right now, given the snapshot? */
export function allows(s: BreakerSnapshot, now: number): boolean {
  if (s.state === "closed") return true;
  if (s.state === "open") return now - s.openedAt >= s.cooldownMs;
  return true; // half-open: exactly the probe that gets one request through
}

/** A named set of breakers (one per host/endpoint family). */
export class Breakers {
  private readonly map = new Map<string, BreakerSnapshot>();
  constructor(private readonly cfg: BreakerConfig = DEFAULT_BREAKER) {}

  snapshot(name: string): BreakerSnapshot {
    return this.map.get(name) ?? { state: "closed", failures: 0, openedAt: 0, windowStart: -1, cooldownMs: this.cfg.cooldownMs };
  }

  /** Gate a request: returns true when it may proceed (and advances the state
   * machine for half-open probe accounting). */
  allow(name: string, now: number): boolean {
    const s = this.snapshot(name);
    if (!allows(s, now)) return false;
    const stepped = step(s, "probe-allowed", now, this.cfg);
    this.map.set(name, stepped);
    return true;
  }

  record(name: string, outcome: "success" | "failure", now: number): void {
    const s = this.snapshot(name);
    this.map.set(name, step(s, outcome, now, this.cfg));
  }

  /** Reset one or all breakers (used by tests and by an explicit "network is
   * back" event with fresh evidence). */
  reset(name?: string): void {
    if (name) this.map.delete(name);
    else this.map.clear();
  }

  /** Open (tripped) breaker names — surfaced in health/telemetry. */
  tripped(now: number): string[] {
    const out: string[] = [];
    for (const [name, s] of this.map) {
      const effective = step(s, "probe-allowed", now, this.cfg);
      if (effective.state !== "closed") out.push(name);
    }
    return out;
  }
}
