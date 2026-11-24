import type { Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";

/**
 * Shared plumbing for the visual suite.
 *
 * Everything here serves the SHIPPING folder (`poki-upload/`) — never `dist/`
 * or a dev server — so a visual failure is a failure in the artifact a portal
 * player actually loads.
 */
export const UPLOAD_DIR = resolve(import.meta.dirname, "../poki-upload");

const MIME: Record<string, string> = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
};

/** Freeze CSS animations so element screenshots are comparable run to run. */
export const FREEZE = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    caret-color: transparent !important;
  }`;

export async function startArtifactServer(): Promise<{ server: Server; baseUrl: string }> {
  if (!existsSync(join(UPLOAD_DIR, "index.html"))) {
    throw new Error("poki-upload/ is missing — run `pnpm build:poki` first.");
  }
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const file = join(UPLOAD_DIR, path === "/" ? "index.html" : path);
    if (!existsSync(file)) { res.writeHead(404).end("missing"); return; }
    res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const port = (server.address() as { port: number }).port;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

export function stopArtifactServer(server: Server): Promise<void> {
  return new Promise((resolve) => { server.close(() => resolve()); });
}

/**
 * Walk the visible DOM inside the menu card and report what a player would
 * actually see go wrong.
 *
 * Deliberately narrow: panels scroll, so "below the fold" is not a defect, and
 * `clientWidth` excludes borders, so a bordered button always measures a few px
 * wider than its content box. Only two things count here —
 *   1. a box that CLIPS its own text (overflow hidden/clip and the text is wider),
 *   2. a leaf text node that escapes the panel sideways.
 * Both are the classic symptom of a translation that is longer than English.
 */
export async function visualDefects(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const defects: string[] = [];
    const card = document.querySelector<HTMLElement>('[data-ref="menuCard"]');
    if (!card) return ["menuCard not found"];
    const cardRect = card.getBoundingClientRect();

    /** True when an ancestor scrolls sideways, so "further right" is reachable. */
    const inHorizontalScroller = (node: Element) => {
      for (let p = node.parentElement; p && p !== card; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (s.overflowX === "auto" || s.overflowX === "scroll") return true;
      }
      return false;
    };
    /** Union box of the real content (text + element children, no pseudo-elements). */
    const contentBox = (el: Element) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getBoundingClientRect();
    };

    for (const el of Array.from(card.querySelectorAll<HTMLElement>("*"))) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;
      // Skip visually-hidden helpers (.sr-only and friends): 1px boxes with
      // overflow hidden are their whole point, not a clipping bug.
      if (style.clip !== "auto" || style.clipPath !== "none") continue;
      const text = (el.textContent ?? "").trim();
      if (!text) continue;
      const label = `${el.tagName.toLowerCase()}[${el.dataset.ref ?? el.dataset.action ?? el.className}]`;

      // 1. A box that clips its own TEXT. Measured with a Range so decorative
      //    ::before/::after glows — which legitimately overflow a box with
      //    overflow:hidden — do not count. An SVG's title is accessible text,
      //    not a painted label; the range measures its artwork instead.
      const clips = style.overflowX === "hidden" || style.overflowX === "clip";
      if (clips && el.tagName.toLowerCase() !== "svg") {
        const box = el.getBoundingClientRect();
        const content = contentBox(el);
        if (content.width && (content.right > box.right + 2 || content.left < box.left - 2)) {
          defects.push(`clipped ${label}: "${text.slice(0, 30)}" content ${Math.round(content.width)}px in a ${Math.round(box.width)}px box`);
        }
      }

      // 2. A leaf text node that escapes the panel sideways (not reachable by
      //    scrolling either).
      if (el.children.length === 0 && !inHorizontalScroller(el)) {
        const rect = el.getBoundingClientRect();
        if (rect.width && rect.height && (rect.right > cardRect.right + 4 || rect.left < cardRect.left - 4)) {
          defects.push(`escapes panel ${label}: "${text.slice(0, 30)}" at x=${Math.round(rect.left)}`);
        }
      }
    }
    return defects;
  });
}
