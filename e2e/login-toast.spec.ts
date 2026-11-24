import { expect, test } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

test("first login displays the actual streak reward", async ({ page }) => {
  await page.route("https://game-cdn.poki.com/scripts/v2/poki-sdk.js", route =>
    route.fulfill({ contentType: "application/javascript", body: "" }));
  // Capture short-lived toasts even if a slow WebGL boot delays the test.
  await page.addInitScript(() => {
    const messages: string[] = [];
    (window as unknown as { auditToasts: string[] }).auditToasts = messages;
    new MutationObserver(() => {
      document.querySelectorAll(".toast-text").forEach(el => {
        if (el.textContent && !messages.includes(el.textContent)) messages.push(el.textContent);
      });
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as { auditToasts: string[] }).auditToasts)).toContain("Day 1 streak · +20 coins");
});
