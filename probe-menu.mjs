import { chromium } from "@playwright/test";

const URL = "http://localhost:4174/";
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", e => errs.push("PAGEERROR: " + String(e.message).slice(0, 300)));
page.on("console", m => { if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 300)); });

await page.goto(URL, { waitUntil: "load" });
await page.waitForTimeout(1500);
const confirm = page.locator('[data-action="confirm-pilot-name"]');
if (await confirm.count()) { await confirm.click(); }
await page.waitForTimeout(1200);

const menu = await page.evaluate(() => {
  const card = document.querySelector('[data-ref="menuCard"]');
  return {
    cls: card.className,
    text: card.innerText,
    buttons: [...card.querySelectorAll("button")].map(b => ({
      action: b.dataset.action, ref: b.dataset.ref, id: b.dataset.id,
      text: (b.innerText || "").trim().slice(0, 70),
      visible: !!(b.offsetWidth || b.offsetHeight || b.getClientRects().length),
    })),
  };
});
console.log("MENU CARD CLASS:", menu.cls);
console.log("=== MENU TEXT ===");
console.log(menu.text);
console.log("=== MENU BUTTONS (visible only) ===");
console.log(JSON.stringify(menu.buttons.filter(b => b.visible), null, 1));
console.log("=== ERRORS ===", JSON.stringify(errs, null, 1));
await browser.close();
