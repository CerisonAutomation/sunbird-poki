/**
 * Dive aliases — Poki EN-02 asks for standardised movement keys ("use WASD or
 * arrow keys for movement"), and this game's single movement control is
 * dive/hold. Accepting both clusters (plus Space) means muscle memory from
 * either convention works; there is no horizontal steering to conflict with.
 */
const DIVE_CODES = ["Space", "KeyA", "KeyW", "KeyS", "KeyD", "ArrowUp", "ArrowDown"];
const DIVE_CODE_SET = new Set(DIVE_CODES);

/** Player-2 dive aliases: Return is the standard secondary confirm key (EN-02). */
const P2_CODES = ["Enter", "NumpadEnter", "ShiftRight", "KeyL"];
const P2_CODE_SET = new Set(P2_CODES);

/** Surfaces whose panning belongs to the browser, never to the dive gesture. */
const SCROLL_SURFACES = ".overlay, .emote-wheel, [data-scroll-surface]";

export class Input {
  enabled = true;
  held = false;
  pausePressed = false;
  restartPressed = false;
  mutePressed = false;
  fullscreenPressed = false;
  boostPressed = false;
  /** Last device that drove a dive — HUD shows matching control hints. */
  lastDevice: "touch" | "mouse" | "keyboard" | "gamepad" = "keyboard";
  /** Player 2: Enter / right-half touch / second gamepad. */
  p2Key = false;
  p2Touch = false;
  private space = false;
  private readonly keys = new Set<string>();
  private readonly boundBlur = () => this.resetHeld();
  private padP1 = false;
  private padP2 = false;
  /** In versus mode a tap is routed to a player by which half of the screen it lands on. */
  private split: "off" | "vertical" | "horizontal" = "off";
  get splitMode(): "off" | "vertical" | "horizontal" { return this.split; }
  set splitMode(mode: "off" | "vertical" | "horizontal") {
    if (mode === this.split) return;
    this.split = mode;
    // Fingers belonged to the old screen halves. Require a fresh touch after
    // rotation, but keep independent keyboard/gamepad holds intact.
    this.onPointerEnd();
  }
  private readonly touches = new Map<number, 1 | 2>();
  private first = false;
  private lastTapDownAt = 0;
  private lastTapUpAt = 0;
  private lastTapDuration = 0;
  private lastTapX = 0;
  private lastTapY = 0;
  private readonly onFirstGesture: () => void;
  private readonly el: HTMLElement;
  private readonly boundPointerDown: (e: PointerEvent) => void;
  private readonly boundPointerUp: (e: PointerEvent) => void;
  private readonly boundPointerCancel: (e: PointerEvent) => void;
  private readonly boundKeyDown: (e: KeyboardEvent) => void;
  private readonly boundKeyUp: (e: KeyboardEvent) => void;
  private readonly boundContext: (e: Event) => void;
  private readonly boundTouchStart: (e: TouchEvent) => void;
  private readonly boundTouchMove: (e: TouchEvent) => void;
  private readonly boundWindowTouchMove: (e: TouchEvent) => void;

  constructor(el: HTMLElement, onFirstGesture: () => void) {
    this.el = el;
    this.onFirstGesture = onFirstGesture;
    this.boundPointerDown = (e) => this.onPointerDown(e);
    this.boundPointerUp = (e) => this.onPointerUp(e);
    this.boundPointerCancel = (e: PointerEvent) => this.onPointerUp(e, true);
    this.boundKeyDown = (e) => this.onKeyDown(e);
    this.boundKeyUp = (e) => this.onKeyUp(e);
    this.boundContext = (e) => e.preventDefault();
    this.boundTouchStart = (e: TouchEvent) => {
      this.markFirst();
      if (this.ownsTouch(e.target) && e.cancelable) e.preventDefault();
    };
    this.boundTouchMove = (e: TouchEvent) => {
      if (this.ownsTouch(e.target) && e.cancelable) e.preventDefault();
    };
    this.boundWindowTouchMove = this.boundTouchMove;

    el.addEventListener("pointerdown", this.boundPointerDown);
    window.addEventListener("pointerdown", this.boundPointerDown);
    el.addEventListener("touchstart", this.boundTouchStart, { passive: false });
    window.addEventListener("touchstart", this.boundTouchStart, { passive: false });
    window.addEventListener("pointerup", this.boundPointerUp);
    window.addEventListener("pointercancel", this.boundPointerCancel);
    window.addEventListener("blur", this.boundBlur);
    window.addEventListener("keydown", this.boundKeyDown);
    window.addEventListener("keyup", this.boundKeyUp);
    el.addEventListener("contextmenu", this.boundContext);
    el.addEventListener("touchmove", this.boundTouchMove, { passive: false });
    window.addEventListener("touchmove", this.boundWindowTouchMove, { passive: false });
  }

  get diving(): boolean {
    return this.enabled && (this.held || this.space || this.padP1);
  }

  /** Player 2's dive input. */
  get diving2(): boolean {
    return this.enabled && (this.p2Key || this.p2Touch || this.padP2);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.resetHeld();
  }

  /** Poll gamepads once per frame: pad 0 drives P1, pad 1 drives P2. */
  pollGamepads(): void {
    const pads = navigator.getGamepads?.();
    if (!pads) {
      this.padP1 = false;
      this.padP2 = false;
      return;
    }
    const pressed = (i: number): boolean => {
      const p = pads[i];
      if (!p) return false;
      for (const b of p.buttons) if (b?.pressed) return true;
      return Math.abs(p.axes[1] ?? 0) > 0.6;
    };
    this.padP1 = pressed(0);
    this.padP2 = pressed(1);
    if (this.padP1 || this.padP2) this.lastDevice = "gamepad";
  }

  consumePause(): boolean {
    const v = this.pausePressed;
    this.pausePressed = false;
    return v;
  }

  consumeRestart(): boolean {
    const v = this.restartPressed;
    this.restartPressed = false;
    return v;
  }

  consumeMute(): boolean {
    const v = this.mutePressed;
    this.mutePressed = false;
    return v;
  }

  consumeFullscreen(): boolean {
    const v = this.fullscreenPressed;
    this.fullscreenPressed = false;
    return v;
  }

  consumeBoost(): boolean {
    const v = this.boostPressed;
    this.boostPressed = false;
    return v;
  }

  dispose(): void {
    this.el.removeEventListener("pointerdown", this.boundPointerDown);
    window.removeEventListener("pointerdown", this.boundPointerDown);
    this.el.removeEventListener("touchstart", this.boundTouchStart);
    window.removeEventListener("touchstart", this.boundTouchStart);
    window.removeEventListener("pointerup", this.boundPointerUp);
    window.removeEventListener("pointercancel", this.boundPointerCancel);
    window.removeEventListener("blur", this.boundBlur);
    window.removeEventListener("keydown", this.boundKeyDown);
    window.removeEventListener("keyup", this.boundKeyUp);
    this.el.removeEventListener("contextmenu", this.boundContext);
    this.el.removeEventListener("touchmove", this.boundTouchMove);
    window.removeEventListener("touchmove", this.boundWindowTouchMove);
  }

  private markFirst(): void {
    if (this.first) return;
    this.first = true;
    this.onFirstGesture();
  }

  private isInteractive(target: EventTarget | null): boolean {
    // Element, not HTMLElement: clicks land on inline <svg>/<path> icons
    // inside buttons, and those are SVGElements. Treating them as
    // non-interactive made the input layer pointer-capture the event and
    // swallow the tap.
    if (!(target instanceof Element)) return false;
    if (target.closest("input, textarea, select, a, summary, label, [contenteditable=true]")) return true;
    // Every DOM action, including Start/Retry, owns its pointer sequence.
    // Capturing Retry's pointer used to retarget its click away from the button.
    return Boolean(target.closest("button, [data-action]"));
  }

  private isTyping(target: EventTarget | null): boolean {
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof Element && !!target.closest("[contenteditable=true]"));
  }

  /**
   * Surfaces the browser must pan for us.
   *
   * `.overlay` is every menu/pause/result screen; `.emote-wheel` is the one
   * scrollable rail that lives in the flight HUD rather than in an overlay.
   * `[data-scroll-surface]` is the escape hatch for the next one, so this stays
   * a selector match instead of a `getComputedStyle` walk on a 60Hz event.
   */
  private isScrollSurface(target: EventTarget | null): boolean {
    return target instanceof Element && !!target.closest(SCROLL_SURFACES);
  }

  /**
   * A menu overlay owns its gestures outright — the flight surface does not.
   *
   * Two separate breakages came from treating overlay touches as gameplay:
   *
   * 1. Scrolling died. Chromium only hands a pan to the compositor thread
   *    while the first touch events stay uncancelled, so a `preventDefault()`
   *    on any `touchstart`/`touchmove` stops the scroll before it begins. The
   *    menu card is mostly plain `<div>`s, so almost every finger position
   *    landed on a non-interactive target and the card never moved — measured
   *    at 0px of a 1340px scroll range on the shop, while the identical drag
   *    that happened to start on a `<button>` scrolled 337px. This is the
   *    exact anti-pattern Chrome's scrolling-intervention guidance names:
   *    express "don't scroll here" with `touch-action`, not `preventDefault()`.
   * 2. Taps died with it. Cancelling `touchstart` also suppresses the
   *    compatibility `click`, which is the only thing that dismisses a
   *    backdrop tap (`.overlay` → back) or resumes from the pause / game-over
   *    screens — neither of which is a `<button>`.
   *
   * The host page is still protected, which is what Poki's "prevent game
   * viewport scrolling from affecting the parent page" asks for: `body` is
   * `position: fixed; overflow: hidden; overscroll-behavior: none` and the
   * menu card is `overscroll-behavior: contain`, so no gesture can chain out
   * of the game.
   */
  private isOverlaySurface(target: EventTarget | null): boolean {
    return target instanceof Element && !!target.closest(".overlay, [data-scroll-surface]");
  }

  /**
   * Whether the gameplay surface owns this touch, and may therefore block the
   * browser's default handling of it. Everything else — a focused field, a
   * control with its own click, a surface the browser should pan — is left
   * alone. `touch-action: none` on the canvas/HUD is what actually stops the
   * gameplay surface from scrolling; this is the belt-and-braces path for
   * engines old enough to ignore `touch-action`.
   */
  private ownsTouch(target: EventTarget | null): boolean {
    return !this.isTyping(target) && !this.isInteractive(target) && !this.isScrollSurface(target);
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.enabled) return;
    if (this.isInteractive(e.target)) return;
    // A menu covering the flight surface owns the finger: no dive, no armed
    // double-tap boost, no gameplay ripple splashed over the menu — and no
    // preventDefault, which would also swallow the tap that dismisses it.
    // Still count as the first gesture so audio unlocks on a touch-only device.
    if (this.isOverlaySurface(e.target)) { this.markFirst(); return; }
    if (this.touches.has(e.pointerId)) return;
    // The emote rail pans horizontally inside the flight HUD; only the
    // gameplay surface itself is taken over.
    if (this.ownsTouch(e.target)) e.preventDefault();
    this.markFirst();
    this.lastDevice = e.pointerType === "touch" ? "touch" : "mouse";

    const now = performance.now();
    const timeSinceLastUp = now - this.lastTapUpAt;
    const dist = Math.hypot(e.clientX - this.lastTapX, e.clientY - this.lastTapY);

    // Intentional double-tap boost:
    // 1. Previous tap was a short tap (< 220ms duration)
    // 2. Second tap follows quickly (< 280ms gap from release)
    // 3. Second tap lands near first tap (< 80px radius)
    if (timeSinceLastUp > 0 && timeSinceLastUp <= 280 && this.lastTapDuration > 0 && this.lastTapDuration <= 220 && dist <= 80) {
      this.boostPressed = true;
    }
    this.lastTapDownAt = now;
    this.lastTapX = e.clientX;
    this.lastTapY = e.clientY;

    const who = this.whichPlayer(e);
    this.touches.set(e.pointerId, who);
    if (who === 2) this.p2Touch = true;
    else this.held = true;

    this.spawnTouchRipple(e.clientX, e.clientY, who);

    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  private whichPlayer(e: PointerEvent): 1 | 2 {
    if (this.splitMode === "off") return 1;
    const r = this.el.getBoundingClientRect();
    if (this.splitMode === "vertical") return e.clientX - r.left > r.width / 2 ? 2 : 1;
    return e.clientY - r.top > r.height / 2 ? 2 : 1;
  }

  private onPointerUp(e: PointerEvent, cancelled = false): void {
    if (!this.touches.has(e.pointerId)) return; // UI/old-orientation releases aren't gestures.
    const now = performance.now();
    const duration = now - this.lastTapDownAt;
    const dy = e.clientY - this.lastTapY;
    const dx = e.clientX - this.lastTapX;

    // Upward flick / swipe-up gesture for mobile rocket boost:
    // dy <= -35px, duration < 320ms, vertical bias (|dy| > |dx| * 0.7)
    if (!cancelled && dy <= -35 && duration < 320 && Math.abs(dy) > Math.abs(dx) * 0.7) {
      this.boostPressed = true;
    }

    this.lastTapDuration = cancelled ? 0 : duration;
    this.lastTapUpAt = cancelled ? 0 : now;

    const who = this.touches.get(e.pointerId);
    this.touches.delete(e.pointerId);
    if (who === 2) {
      this.p2Touch = [...this.touches.values()].includes(2);
    } else {
      this.held = [...this.touches.values()].includes(1);
    }
    if (this.splitMode === "off") this.held = this.touches.size > 0;
  }

  private spawnTouchRipple(x: number, y: number, player: 1 | 2 = 1): void {
    if (typeof document === "undefined" || !x || !y) return;
    try {
      const ripple = document.createElement("span");
      ripple.className = `touch-ripple p${player}`;
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 400);
    } catch {
      /* ignore */
    }
  }

  private onPointerEnd(): void {
    this.touches.clear();
    this.held = false;
    this.p2Touch = false;
    this.lastTapDownAt = this.lastTapUpAt = this.lastTapDuration = 0;
    this.boostPressed = false;
  }

  private resetHeld(): void {
    this.onPointerEnd();
    this.keys.clear();
    this.space = this.p2Key = this.padP1 = this.padP2 = false;
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.enabled) return;
    if (e.repeat || this.isTyping(e.target)) return;
    // Enter/Space must activate native menu controls, not hold a bird down.
    if (e.code !== "Escape" && e.target instanceof Element && e.target.closest("button, a, summary, [role=button]")) return;
    if (DIVE_CODE_SET.has(e.code)) {
      // Arrows would otherwise scroll the host page in embedded frames.
      e.preventDefault();
      this.markFirst();
      this.lastDevice = "keyboard";
      this.keys.add(e.code);
      this.space = true;
    } else if (P2_CODE_SET.has(e.code)) {
      e.preventDefault();
      this.markFirst();
      this.keys.add(e.code);
      this.p2Key = true;
    } else if (e.code === "KeyP" || e.code === "Escape") {
      this.pausePressed = true;
    } else if (e.code === "KeyR") {
      this.restartPressed = true;
    } else if (e.code === "KeyM") {
      // Prevent browser/OS mute or tab-mute shortcuts from stealing our M.
      e.preventDefault();
      this.mutePressed = true;
    } else if (e.code === "KeyF") {
      // F is an alt fullscreen; don't let the browser's "Find in page" pop up.
      if (!e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
      this.fullscreenPressed = true;
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    // Releasing one alias must not release the player's other held key.
    if (this.keys.has(e.code)) e.preventDefault();
    this.keys.delete(e.code);
    this.space = DIVE_CODES.some(code => this.keys.has(code));
    this.p2Key = P2_CODES.some(code => this.keys.has(code));
  }
}
