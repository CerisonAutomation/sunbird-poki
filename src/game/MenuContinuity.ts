import { hiddenByDisclosure } from "./Disclosure";
type FocusKey = { ref?: string; action?: string; id?: string; detail?: string };
type NestedScroll = { top: number; bottom: boolean };
type ViewMemory = { nested: Map<string, NestedScroll>; scroll: number; details: Map<string, boolean>; focus: FocusKey | null };

function focusKey(el: Element | null): FocusKey | null {
  if (!(el instanceof HTMLElement)) return null;
  if (el.dataset.ref) return { ref: el.dataset.ref };
  if (el.dataset.action) return { action: el.dataset.action, id: el.dataset.id };
  if (el.tagName === "SUMMARY" && el.parentElement?.dataset.ref) return { detail: el.parentElement.dataset.ref };
  return null;
}
function findFocus(card: HTMLElement, key: FocusKey | null): HTMLElement | null {
  if (!key) return null;
  return [...card.querySelectorAll<HTMLElement>("[data-ref], [data-action], summary")].find(el =>
    key.ref ? el.dataset.ref === key.ref : key.detail ? el.tagName === "SUMMARY" && el.parentElement?.dataset.ref === key.detail
      : el.dataset.action === key.action && el.dataset.id === key.id) ?? null;
}

/** Preserve view state through snapshot refreshes, never across unrelated screens.
 * Drafts live only for this replacement; they are not persisted or logged. */
export class MenuContinuity {
  private screen = "";
  private html = "";
  private composing = false;
  private pending: { card: HTMLElement; screen: string; html: string; className: string } | null = null;

  reset(): void { this.views.clear(); this.screen = ""; this.html = ""; this.pending = null; this.composing = false; }
  beginComposition(): void { this.composing = true; }
  endComposition(): void {
    this.composing = false;
    // Let the final native input event commit before capturing the draft.
    queueMicrotask(() => {
      const pending = this.pending;
      this.pending = null;
      if (pending?.card.isConnected) this.render(pending.card, pending.screen, pending.html, pending.className);
    });
  }
  private readonly views = new Map<string, ViewMemory>();

  render(card: HTMLElement, screen: string, html: string, className = card.className): void {
    if (screen === this.screen && this.composing) { this.pending = { card, screen, html, className }; return; }
    if (screen !== this.screen) { this.pending = null; this.composing = false; }
    if (screen === this.screen && html === this.html) return;
    const same = screen === this.screen;
    const active = card.contains(document.activeElement) ? document.activeElement : null;
    const previous: ViewMemory = {
      scroll: card.scrollTop,
      nested: new Map([...card.querySelectorAll<HTMLElement>("[data-scroll-memory]")].map(el => [el.dataset.scrollMemory!, { top: el.scrollTop, bottom: el.scrollHeight - el.clientHeight - el.scrollTop < 24 }])),
      details: new Map([...card.querySelectorAll<HTMLDetailsElement>("details[data-ref]")].map(el => [el.dataset.ref!, el.open])),
      focus: focusKey(active),
    };
    if (this.screen) this.views.set(this.screen, previous);
    const fields = same ? [...card.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input[data-ref], textarea[data-ref]")]
      .filter(el => !el.readOnly && (el instanceof HTMLTextAreaElement || ["text", "email", "search", "tel", "url", "checkbox"].includes(el.type)))
      .map(el => ({ ref: el.dataset.ref!, value: el.value, checked: el instanceof HTMLInputElement ? el.checked : false, start: el.selectionStart, end: el.selectionEnd })) : [];
    const restore = this.views.get(screen);
    this.screen = screen;
    this.html = html;
    card.className = className;
    card.dataset.screen = screen;
    card.innerHTML = html;
    for (const el of card.querySelectorAll<HTMLDetailsElement>("details[data-ref]")) {
      const open = restore?.details.get(el.dataset.ref!);
      if (open !== undefined) el.open = open;
    }
    for (const field of fields) {
      const el = findFocus(card, { ref: field.ref }) as HTMLInputElement | HTMLTextAreaElement | null;
      if (!el) continue;
      el.value = field.value;
      if (el instanceof HTMLInputElement && el.type === "checkbox") el.checked = field.checked;
      if (field.start !== null && field.end !== null) el.setSelectionRange(field.start, field.end);
    }
    const target = findFocus(card, restore?.focus ?? null);
    const heading = card.querySelector<HTMLElement>("h1, h2");
    if (heading) heading.tabIndex = -1;
    if (active || !same) {
      (target && !target.matches(":disabled") && !hiddenByDisclosure(target) ? target : heading)?.focus({ preventScroll: true });
    }
    card.scrollTop = restore?.scroll ?? 0;
    for (const el of card.querySelectorAll<HTMLElement>("[data-scroll-memory]")) {
      const saved = restore?.nested.get(el.dataset.scrollMemory!);
      el.scrollTop = el.hasAttribute("data-stick-bottom") && (!saved || saved.bottom) ? el.scrollHeight : saved?.top ?? 0;
    }
  }
}
