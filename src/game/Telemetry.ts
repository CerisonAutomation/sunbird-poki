import { isPortalBuild } from "../sdk/platform";

type Props = Record<string, string | number | boolean>;
type Entry = { name: string; props: Props; t: number };

/**
 * The only shape allowed to leave the device. Every field is a coarse counter:
 * an event name, a mode, whole kilometres, and — for the two funnel events — a
 * stage id plus its index in the fixed path. No timestamps, no durations, no
 * path strings, no identity beyond the random local device id the backend
 * already uses as a denominator.
 */
export type CoarseEvent = { k: string; mode?: string; km?: number; st?: string; si?: number };

/** Stage ids are lowercase words (digits and underscores allowed, matching the
 * sink's own regex); anything else is refused rather than sent. */
const STAGE_RE = /^[a-z][a-z0-9_]{0,23}$/;

/** Events allowed to carry a funnel position. Whitelisted by name, so a new
 * event cannot leak a stage-shaped string by accident. */
const FUNNEL_EVENTS = new Set(["funnel_stage", "funnel_summary"]);

/**
 * Project one rich in-game event onto the coarse beacon shape.
 *
 * Pure and exported so the privacy contract is a unit test rather than a review
 * comment: what a beacon carries is exactly what this function returns.
 */
export function coarseEvent(name: string, props: Props): CoarseEvent {
  const out: CoarseEvent = { k: name };
  if (typeof props.mode === "string") out.mode = props.mode;
  if (typeof props.distance === "number") out.km = Math.floor(props.distance / 1000);
  if (FUNNEL_EVENTS.has(name)) {
    // `funnel_stage` carries `stage`; `funnel_summary` carries where it stalled.
    const raw = typeof props.stage === "string" ? props.stage : props.stalledAt;
    const stage = typeof raw === "string" ? raw : "";
    if (STAGE_RE.test(stage)) out.st = stage;
    if (typeof props.step === "number" && Number.isFinite(props.step)) {
      out.si = Math.max(0, Math.min(31, Math.round(props.step)));
    }
  }
  return out;
}

const ENV = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

/** Backend telemetry endpoint. Empty string = no sink configured = network
 * telemetry is a no-op. In portal builds (CrazyGames/Poki/generic), external
 * network telemetry is strictly disabled per portal compliance rules.
 *
 * The sink is the social server's aggregate counter (POST /telemetry — see
 * server/src/telemetry/TelemetryService.ts). The old derivation from
 * VITE_MULTIPLAYER_URL was removed: the Rust room server has no such route,
 * and beacons aimed at it would die invisibly. */
export function endpointUrl(): string {
  if (isPortalBuild()) return "";
  const social = ENV.VITE_SOCIAL_URL ?? "";
  if (social) return `${social.replace(/\/$/, "")}/telemetry`;
  return "";
}

/**
 * Lightweight analytics bus. Forwards to window.dataLayer when present, and —
 * when a backend is configured — mails anonymous aggregate counters home on
 * tab-hide via sendBeacon (the one API built for "the tab is dying").
 *
 * Privacy promises, not aspirations:
 *   - No PII. Only whitelisted counter names + coarse mode/km numbers travel.
 *   - Fire-and-forget: no retries, a dead endpoint costs one dropped beacon.
 */
export class Telemetry {
  private readonly buffer: Entry[] = [];
  private readonly outbox: CoarseEvent[] = [];
  private deviceId = "";
  private hookInstalled = false;
  /** Keep spectacular moments useful without turning a single flight into a
   * telemetry flood. The first five are exact; later moments are sampled. */
  private viralMoments = 0;
  private readonly debug =
    typeof location !== "undefined" && /localhost|127\.0\.0\.1/.test(location.hostname);

  /** Bind the random local device id used only for server-side dedup rates. */
  bindDevice(deviceId: string): void {
    this.deviceId = deviceId;
    this.installFlushHook();
  }

  track(name: string, props: Props = {}): void {
    if (name === "viral_moment") {
      this.viralMoments += 1;
      if (this.viralMoments > 5 && Math.random() > 0.1) return;
    }
    if (name === "run_start") this.viralMoments = 0;
    const entry: Entry = { name, props, t: Date.now() };
    this.buffer.push(entry);
    if (this.buffer.length > 100) this.buffer.shift();
    const w = window as unknown as { dataLayer?: unknown[] };
    // Portal hosts inject their own analytics into the document the game
    // runs in — pushing our events into their dataLayer would pollute
    // portal-side numbers, so it is off in portal builds (the backend
    // beacon is off there too — see endpoint()).
    if (!isPortalBuild()) w.dataLayer?.push({ event: name, ...props });
    if (this.debug) console.debug("[telemetry]", name, props);
    // Queue a coarse copy for the aggregate backend counter (hard-capped).
    if (endpointUrl() && this.outbox.length < 64) {
      this.outbox.push(coarseEvent(name, props));
    }
    // A completed run is the natural flush boundary. This keeps the funnel
    // intact even when a player closes the tab before visibilitychange fires.
    if (name === "run_end") this.flush();
  }

  recent(): readonly Entry[] {
    return this.buffer;
  }

  /** Drain the outbox to the backend. Never throws, never retries. */
  flush(): void {
    const url = endpointUrl();
    if (!url || this.outbox.length === 0 || !this.deviceId) return;
    const body = JSON.stringify({ deviceId: this.deviceId, events: this.outbox.splice(0) });
    try {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(url, body);
      } else if (typeof fetch === "function") {
        void fetch(url, { method: "POST", body, keepalive: true }).catch(() => undefined);
      }
    } catch {
      // Telemetry failing is, by design, invisible.
    }
  }

  private readonly onHide = (): void => {
    if (document.visibilityState === "hidden") this.flush();
  };

  private installFlushHook(): void {
    if (this.hookInstalled || typeof document === "undefined") return;
    this.hookInstalled = true;
    document.addEventListener("visibilitychange", this.onHide);
  }

  /** Detach the flush hook — Game.dispose() calls this so React StrictMode's
   * double-mount never leaves a zombie listener double-beaconing events. */
  dispose(): void {
    if (!this.hookInstalled || typeof document === "undefined") return;
    this.hookInstalled = false;
    document.removeEventListener("visibilitychange", this.onHide);
  }
}
