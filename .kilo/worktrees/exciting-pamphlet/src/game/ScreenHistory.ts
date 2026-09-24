/** In-app Back history; revisiting a parent trims the trail rather than looping. */
export class ScreenHistory<T extends string> {
  private current: T;
  private trail: T[] = [];
  constructor(private readonly home: T) { this.current = home; }
  visit(next: T): void {
    if (next === this.home) this.trail = [];
    else if (next !== this.current) {
      const parent = this.trail.lastIndexOf(next);
      if (parent >= 0) this.trail.length = parent;
      else this.trail.push(this.current);
    }
    this.current = next;
  }
  back(): T {
    this.current = this.trail.pop() ?? this.home;
    return this.current;
  }
  /** Clear history and re-home the stack (used when entering a modal context
   *  such as pause sub-screens, so Back always returns to the new root). */
  resetTo(home: T): void {
    this.current = home;
    this.trail = [];
  }
}
