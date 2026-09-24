/**
 * CrashReporter — the client-side black box flight recorder.
 *
 * Before this module existed the game's failure story ended at
 * `console.error`: invisible in production, uncorrelated, and gone on reload.
 * The reporter turns runtime failures into an evidence chain:
 *
 *   capture  → typed entry { message (redacted), severity, fingerprint }
 *   dedup    → identical fingerprints collapse (one storm = one event)
 *   rate     → hard cap per 5-minute window (a crash loop cannot flood the
 *              beacon or the journal)
 *   journal  → the last 5 entries persist to storage, so the next session
 *              knows it booted after a crash (see previousSessionCrashes)
 *   sink     → an injected telemetry track() receives a coarse, capped copy
 *              (fingerprint + severity only — never raw messages to network)
 *   crumbs   → a rolling breadcrumb buffer other modules append to; included
 *              in the persisted entry so a crash has context on reload
 *
 * Portal rules are respected structurally: this module never touches the
 * network itself (the telemetry sink decides what a beacon is allowed to do),
 * and every stored string passes through redact() first.
 */
import { classify, fingerprint as fpOf, RateGate, redact, safeMessage, type Severity } from "./errors";
import { storage } from "../Storage";

export type CrashKind = "error" | "unhandledrejection" | "react" | "manual";

export interface CrashEntry {
  at: number;
  kind: CrashKind;
  severity: Severity;
  /** Redacted message — safe for storage and support tickets. */
  message: string;
  /** Dedup key — the only string that ever travels to telemetry. */
  fp: string;
  /** Breadcrumb trail captured at the moment of the crash (redacted). */
  crumbs: string[];
}

export interface TelemetrySink {
  track(name: string, props?: Record<string, string | number | boolean>): void;
}

const JOURNAL_KEY = "sunbird.crash.journal.v1";
const JOURNAL_MAX = 5;
const DEDUP_WINDOW_MS = 30_000;
const SESSION_EVENT_CAP = 12;
const CAP_WINDOW_MS = 5 * 60_000;
const CRUMB_MAX = 40;

export class CrashReporter {
  private crumbs: { at: number; message: string }[] = [];
  private recent = new Map<string, number>(); // fp → last reported at
  private readonly gate = new RateGate(SESSION_EVENT_CAP, CAP_WINDOW_MS);
  private sink: TelemetrySink | null = null;
  private installed = false;
  private previous: CrashEntry[] = [];
  private readonly onError = (e: ErrorEvent): void => {
    // Cross-origin script errors carry no information ("Script error.") —
    // recording them would only burn the rate budget.
    if (e.message === "Script error." || e.message === "Script error") return;
    this.capture("error", e.error ?? e.message);
  };
  private readonly onRejection = (e: PromiseRejectionEvent): void => {
    this.capture("unhandledrejection", e.reason);
  };

  /** Wire the telemetry sink (injected — no import cycle with Telemetry). */
  attach(sink: TelemetrySink): void {
    this.sink = sink;
  }

  /** Global handlers. Idempotent; safe to call at the very top of boot. */
  install(): void {
    if (this.installed || typeof window === "undefined") return;
    this.installed = true;
    this.previous = this.readJournal();
    window.addEventListener("error", this.onError);
    window.addEventListener("unhandledrejection", this.onRejection);
  }

  dispose(): void {
    if (!this.installed) return;
    this.installed = false;
    window.removeEventListener("error", this.onError);
    window.removeEventListener("unhandledrejection", this.onRejection);
  }

  /** Crashes persisted by the PREVIOUS session (read once at install). */
  get previousSessionCrashes(): readonly CrashEntry[] {
    return this.previous;
  }

  /** Append context. Cheap enough to call from every meaningful seam. */
  breadcrumb(message: string): void {
    this.crumbs.push({ at: Date.now(), message: redact(safeMessage(message)) });
    if (this.crumbs.length > CRUMB_MAX) this.crumbs.shift();
  }

  /** Central capture. Never throws; callers never branch on it. */
  capture(kind: CrashKind, reason: unknown): CrashEntry | null {
    try {
      const message = redact(safeMessage(reason));
      if (!message) return null;
      const fp = fpOf(message);
      const now = Date.now();
      // Dedup: same fingerprint inside the window collapses to the first hit
      // (but still leaves a breadcrumb, preserving order evidence).
      const lastAt = this.recent.get(fp);
      if (lastAt !== undefined && now - lastAt < DEDUP_WINDOW_MS) return null;
      if (!this.gate.allow(now)) return null;
      this.recent.set(fp, now);
      if (this.recent.size > 64) {
        // Bound the dedup map; oldest-insertion eviction is fine at this size.
        const first = this.recent.keys().next().value;
        if (first !== undefined) this.recent.delete(first);
      }

      const entry: CrashEntry = {
        at: now,
        kind,
        severity: classify(message),
        message,
        fp,
        crumbs: this.crumbs.slice(-CRUMB_MAX).map((c) => c.message),
      };
      this.persist(entry);
      // Sink gets the fingerprint and severity — enough to count storm
      // clusters, never enough to leak content.
      this.sink?.track("client_error", { severity: entry.severity, fp: entry.fp, kind: entry.kind });
      return entry;
    } catch {
      return null; // a failing reporter must never become the crash
    }
  }

  /** In-memory trail this session (newest last). */
  trail(): readonly string[] {
    return this.crumbs.map((c) => c.message);
  }

  /** Reset in-memory state (tests, and "fresh session" flows). */
  reset(): void {
    this.crumbs = [];
    this.recent.clear();
    this.previous = [];
  }

  private persist(entry: CrashEntry): void {
    try {
      const journal = [...this.readJournal(), entry].slice(-JOURNAL_MAX);
      storage.setItem(JOURNAL_KEY, JSON.stringify(journal));
    } catch {
      /* storage unavailable — the in-memory copy still served this session */
    }
  }

  private readJournal(): CrashEntry[] {
    try {
      const raw = storage.getItem(JOURNAL_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(
          (e): e is CrashEntry =>
            !!e && typeof e === "object" && typeof (e as CrashEntry).message === "string" && typeof (e as CrashEntry).fp === "string",
        )
        .slice(-JOURNAL_MAX);
    } catch {
      return [];
    }
  }

  /** Clear the persisted journal (e.g. after a support flow exports it). */
  static clearJournal(): void {
    try {
      storage.removeItem(JOURNAL_KEY);
    } catch {
      /* unavailable — nothing to clear */
    }
  }
}

/** Process-wide reporter — installed once at boot, before anything can throw. */
export const crashReporter = new CrashReporter();
