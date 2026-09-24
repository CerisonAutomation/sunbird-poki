import { hiddenByDisclosure } from "./Disclosure";
/** Native dialog keyboard behavior for the game's DOM overlays. */
export class OverlayNavigation {
  private active: HTMLElement | null = null;

  /**
   * Interactive controls that consume Space/Enter themselves.
   */
  private static readonly ACTIVATABLE =
    'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [role="button"], [tabindex="0"]';

  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      this.activatePrimary(event);
      return;
    }
    if (event.key !== "Tab" || !this.active) return;
    const controls = [...this.active.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]',
    )].filter(el => {
      return !hiddenByDisclosure(el)
        && el.getClientRects().length > 0 && !el.closest("[inert]");
    });
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first || !last) { event.preventDefault(); return; }
    const current = document.activeElement;
    if (event.shiftKey && (current === first || !controls.includes(current as HTMLElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (current === last || !controls.includes(current as HTMLElement))) {
      event.preventDefault(); first.focus();
    }
  };

  /**
   * Poki EN-02: "use the space bar or return key for primary menu actions".
   * A focused native button already does this, but these overlays deliberately
   * move focus to the dialog heading for screen readers — so a bare Space or
   * Return lands on nothing. Route it to the overlay's primary action (the
   * `.primary-btn` when one exists, else the first visible control).
   *
   * Two-step on purpose: the first press MOVES FOCUS onto the primary (the
   * keyboard player sees exactly what will happen, and screen readers announce
   * it); the press that lands on the already-focused control then activates
   * it natively. Activating-and-navigating on the very first bare Space made
   * the focus target vanish and let a stray key launch races or spend coins —
   * the same hazard that made the results backdrop inert.
   *
   * Skipped when: there is no open overlay, the event was already handled, the
   * key is auto-repeating, an IME composition is in flight, or focus sits on a
   * control that activates itself (button/link/input/select/summary).
   */
  private activatePrimary(event: KeyboardEvent): void {
    const active = this.active;
    if (!active || event.defaultPrevented || event.repeat || event.isComposing) return;
    const target = event.target;
    if (target instanceof Element && target.closest(OverlayNavigation.ACTIVATABLE)) return;
    if (target instanceof HTMLElement && target.isContentEditable) return;
    const controls = [...active.querySelectorAll<HTMLElement>(OverlayNavigation.ACTIVATABLE)].filter(
      (el) => !hiddenByDisclosure(el) && el.getClientRects().length > 0 && !el.closest("[inert]"),
    );
    const primary = controls.find((el) => el.classList.contains("primary-btn")) ?? controls[0];
    if (!primary) return;
    event.preventDefault();
    // Move focus onto the control being activated, not just fire its click:
    // a keyboard player gets the focus ring on the thing that will happen,
    // and the next Tab continues from there instead of from the heading.
    primary.focus({ preventScroll: true });
  }

  constructor(private readonly root: HTMLElement) { root.addEventListener("keydown", this.onKey); }

  sync(active: HTMLElement | null): void {
    for (const overlay of this.root.querySelectorAll<HTMLElement>(".overlay, .matchmaking")) {
      const inert = overlay !== active;
      if (overlay.inert !== inert) overlay.inert = inert;
    }
    const play = this.root.querySelector<HTMLElement>(".play-hud");
    if (play && play.inert !== (active !== null)) play.inert = active !== null;
    if (active) {
      if (active.getAttribute("role") !== "dialog") active.setAttribute("role", "dialog");
      if (active.getAttribute("aria-modal") !== "true") active.setAttribute("aria-modal", "true");
      const heading = active.querySelector<HTMLElement>("h1, h2");
      const label = heading?.textContent || (active.classList.contains("matchmaking") ? "Finding a race" : "Sunbird");
      if (active.getAttribute("aria-label") !== label) active.setAttribute("aria-label", label);
      if (active !== this.active) {
        if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
        else active.querySelector<HTMLElement>("button:not(:disabled)")?.focus({ preventScroll: true });
      }
    } else if (this.active) {
      // Return gameplay keys to the canvas, not a hidden Resume button.
      const canvas = this.root.parentElement?.querySelector("canvas");
      if (canvas) { canvas.tabIndex = -1; canvas.focus({ preventScroll: true }); }
    }
    this.active = active;
  }

  dispose(): void { this.root.removeEventListener("keydown", this.onKey); this.active = null; }
}
