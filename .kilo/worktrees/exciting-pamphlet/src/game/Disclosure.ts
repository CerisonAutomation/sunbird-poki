/** Closed <details> descendants may still report client rectangles in Chromium.
 * A nested summary is not visible if an outer disclosure is closed. */
export function hiddenByDisclosure(element: Element): boolean {
  let closed = element.closest("details:not([open])");
  while (closed) {
    if (element !== closed.querySelector(":scope > summary")) return true;
    closed = closed.parentElement?.closest("details:not([open])") ?? null;
  }
  return false;
}
