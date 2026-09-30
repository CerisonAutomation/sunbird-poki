import { POKI_BUILD } from "../sdk/env";
import { isPortalBuild } from "../sdk/platform";
import { measureViaPoki } from "../sdk/poki-canon";

/**
 * `measure()` is the sanctioned egress on a Poki build. `POKI_BUILD` is a
 * compile-time constant from `sdk/env` (like `TARGET` in `sdk/platform.ts`),
 * so Vite folds it to a literal and a non-Poki bundle loses the whole measure
 * path. The tests flip it with `vi.stubEnv` + `vi.resetModules` + a fresh
 * import, which is why it has to stay a module-scope read of the env.
 */

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

/**
 * The portal-sanctioned channel.
 *
 * Portal builds must not post to a backend of our own — that rule above is
 * correct and stays. But it used to mean engagement telemetry went NOWHERE on
 * Poki: 72 event names, including the whole first-session funnel and the
 * drop-off summary the code calls "the number that makes this actionable",
 * were written into a local ring buffer and never left the device.
 *
 * `measure()` is the channel the portal itself provides and expects games to
 * use, so high-value engagement rides it instead. No external network egress,
 * no new endpoint, no PII — just the same coarse counters the backend would
 * have received, delivered through the SDK the portal is already running.
 *
 * This is deliberately a short list, not all 72 names. Poki's dashboard is the
 * game's own reporting surface; flooding it with bespoke event names would
 * bury the funnel it is actually for. Each entry maps one engagement event onto
 * a published `MeasureCategory` so it lands in a grouping Poki already has.
 */
/**
 * Engagement events that ride Poki's own `measure()`.
 *
 * Every name here must be one the game actually calls `track()` with, and each
 * is emitted exactly once. Two rules learned the hard way:
 *
 *  - NO `funnel_stage`. `Game.markFunnel` already sends the funnel to Poki
 *    directly, through the platform adapter, as category `player` / what
 *    `funnel-<stage>` / action `reached`. Listing it here too produced two SDK
 *    calls per milestone with different `what` values — a duplicate the budget
 *    could not see, because only one of the two paths spent from it.
 *  - The action is data-driven where the event carries an outcome. `run_end`
 *    fires for every finished run including goal completions, so a hardcoded
 *    "fail" would file every win as a loss in Poki's round dashboard.
 */
const POKI_MEASURE_EVENTS: Record<
  string,
  { category: string; action: string | ((props: Props) => string) }
> = {
  funnel_summary: { category: "player", action: "complete" },
  // "mode", not "round": the run LIFECYCLE (start → complete|fail) is
  // measured under "mode" with the mode slug as `what` (see Game.ts), so a
  // finished run belongs in the same funnel its start opened. `round` is a
  // different question — a scored lap — and filing run_end there split one
  // funnel across two categories.
  run_end: { category: "mode", action: (p) => (p.outcome === "complete" ? "complete" : "fail") },
  portal_identity: { category: "player", action: "interact" },
  portal_break_request: { category: "button", action: "visible" },
};

/** How many measure() events one session may emit, so a long session cannot
 *  flood the dashboard. The funnel's own milestones are a handful per player. */
const POKI_MEASURE_BUDGET = 40;

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
  private pokiMeasureBudget = POKI_MEASURE_BUDGET;
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
    // On Poki, route the curated engagement set through the portal's own
    // analytics channel. Every value goes through sanitizeMeasure first, so a
    // prop the live loader would reject is dropped here rather than silently
    // lost server-side — the same rule PokiNetlibClient's measure() follows.
    if (POKI_BUILD) this.emitPokiMeasure(name, props);
    // Queue a coarse copy for the aggregate backend counter (hard-capped).
    if (endpointUrl() && this.outbox.length < 64) {
      this.outbox.push(coarseEvent(name, props));
    }
    // A completed run is the natural flush boundary. This keeps the funnel
    // intact even when a player closes the tab before visibilitychange fires.
    if (name === "run_end") this.flush();
  }

  private emitPokiMeasure(name: string, props: Props): void {
    const mapping = POKI_MEASURE_EVENTS[name];
    if (!mapping) return;
    if (this.pokiMeasureBudget <= 0) return;
    // `what` is the second measure() argument and therefore required. It must
    // be the event's own discriminator, not a copy of its name: falling back to
    // `name` satisfied the "never empty" rule while making every event of a
    // kind identical on the dashboard — four distinct `portal_break_request`
    // placements collapsed into one indistinguishable row.
    const what = String(props.stage ?? props.placement ?? props.stalledAt ?? props.mode ?? "")
      .replace(/[^A-Za-z0-9_: .|-]/g, "-")
      .slice(0, 40);
    // No discriminator means the event carries nothing Poki can group on.
    if (!what) return;
    const action = typeof mapping.action === "function" ? mapping.action(props) : mapping.action;
    // Through `measureViaPoki` — the one function in the app that touches a
    // Poki SDK member for measurement, shared with `PokiAdapter.measure()`.
    // This method used to import `pokiSdk` itself and call `sdk.measure(...)`,
    // which made it a third route into the SDK: one the canon test cannot see,
    // since it only scanned `src/sdk/poki.ts` and `src/sdk/platform.ts`. An
    // invented member touched here would have compiled clean and then no-opped
    // in production — the exact failure `poki-canon.ts` exists to prevent.
    //
    // The budget spends on the delivery answer, not on having called. That is
    // what stops a dead SDK from quietly consuming a session's whole allowance
    // while delivering nothing.
    if (measureViaPoki(mapping.category, what, action)) this.pokiMeasureBudget -= 1;
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
