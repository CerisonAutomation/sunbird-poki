/**
 * Screen Wake Lock — the "WakeLock" row of the Poki Player Device Report
 * (rule DEV-14) applied to this game.
 *
 * A flight run is a long, low-attention-interaction stretch: the player holds
 * one control and watches the bird glide. On mobile that is exactly the shape
 * of session where the OS dims the screen and suspends the tab mid-run, which
 * reads to the player as "the game froze". Holding a screen wake lock for the
 * duration of a run removes the single most common mobile drop-off cause that
 * is not a bug in the game itself.
 *
 * Contracts honoured here:
 *   • Feature-detected (`navigator.wakeLock` is absent on iOS Safari, older
 *     browsers and in some embedded webviews) — unsupported is a no-op, never
 *     an error (REQ-16).
 *   • The browser releases the lock automatically whenever the page is hidden;
 *     we re-acquire on the way back so a resize/tab-switch mid-run does not
 *     quietly cost the player their screen.
 *   • User setting wins: "Reduce Motion" and low-quality power saving both call
 *     `setEnabled(false)`, and the lock is dropped immediately.
 *   • Every promise is swallowed: a rejected request (insecure context, power
 *     policy, battery saver) must never surface as a console error — portal QA
 *     treats console errors as defects (REQ-02).
 */

export type WakeLockSentinelLike = {
  released?: boolean;
  release?: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
};

export type WakeLockHost = {
  wakeLock?: { request?: (type: "screen") => Promise<WakeLockSentinelLike> };
};

export type VisibilityTarget = {
  visibilityState?: string;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

function liveHost(): WakeLockHost | null {
  try {
    return typeof navigator === "undefined" ? null : (navigator as unknown as WakeLockHost);
  } catch {
    return null;
  }
}

function liveVisibility(): VisibilityTarget | null {
  try {
    return typeof document === "undefined" ? null : (document as unknown as VisibilityTarget);
  } catch {
    return null;
  }
}

export function supportsWakeLock(host: WakeLockHost | null = liveHost()): boolean {
  try {
    return typeof host?.wakeLock?.request === "function";
  } catch {
    return false;
  }
}

export class ScreenWakeLock {
  private sentinel: WakeLockSentinelLike | null = null;
  /** True while a request is in flight — a burst of acquire() calls (every
   *  frame of a run) must not queue a burst of locks. */
  private requesting = false;
  private wanted = false;
  private enabled = true;
  private disposed = false;
  private readonly onVisibility = (): void => {
    // The platform drops the lock when the page hides; take it again when the
    // player comes back to a run they are still in.
    if (this.wanted && this.enabled && !this.disposed) void this.acquire();
  };

  constructor(
    private readonly host: WakeLockHost | null = liveHost(),
    private readonly visibility: VisibilityTarget | null = liveVisibility(),
    private readonly onError?: (error: unknown) => void,
  ) {
    try {
      this.visibility?.addEventListener?.("visibilitychange", this.onVisibility);
    } catch {
      /* no visibility API — the lock is simply not re-acquired */
    }
  }

  get supported(): boolean {
    return supportsWakeLock(this.host);
  }

  /** True while a sentinel is actually held (0 = the platform released it). */
  get held(): boolean {
    return this.sentinel !== null && this.sentinel.released !== true;
  }

  /** Player/setting gate. Disabling drops any held lock immediately. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.release();
  }

  /**
   * Ask for a screen lock for the duration of gameplay. Idempotent: calling it
   * every frame from the run loop costs one comparison, not a request.
   */
  acquire(): void {
    this.wanted = true;
    if (this.disposed || !this.enabled || this.held || this.requesting) return;
    const request = this.host?.wakeLock?.request;
    if (typeof request !== "function") return;
    this.requesting = true;
    try {
      void request
        .call(this.host?.wakeLock, "screen")
        .then((sentinel) => {
          this.requesting = false;
          if (this.disposed || !this.enabled || !this.wanted) {
            // Lost the race with a state change (run ended, setting flipped):
            // release immediately so we never hold a lock while paused.
            void sentinel?.release?.().catch(() => {});
            return;
          }
          this.sentinel = sentinel;
          try {
            sentinel?.addEventListener?.("release", () => {
              if (this.sentinel === sentinel) this.sentinel = null;
            });
          } catch {
            /* older sentinels have no event target — `released` is the fallback */
          }
        })
        .catch((error: unknown) => {
          this.requesting = false;
          this.sentinel = null;
          this.onError?.(error);
        });
    } catch (error) {
      this.requesting = false;
      this.sentinel = null;
      this.onError?.(error);
    }
  }

  /** Release on any non-playing state (menu, pause, results, ad break). */
  release(): void {
    this.wanted = false;
    // A request already on the wire is released when it lands (see acquire's
    // race guard) — clearing the flag here would let a second one start.
    const sentinel = this.sentinel;
    this.sentinel = null;
    try {
      void sentinel?.release?.().catch(() => {});
    } catch {
      /* a sentinel that throws on release is already gone */
    }
  }

  dispose(): void {
    this.disposed = true;
    this.release();
    try {
      this.visibility?.removeEventListener?.("visibilitychange", this.onVisibility);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Convenience for the game: creates a lock that is driven by a boolean
 * "should the screen stay awake" signal, so the caller does not have to think
 * about edge transitions.
 */
export function createWakeLock(host?: WakeLockHost | null, visibility?: VisibilityTarget | null): ScreenWakeLock {
  return new ScreenWakeLock(host ?? liveHost(), visibility ?? liveVisibility());
}
