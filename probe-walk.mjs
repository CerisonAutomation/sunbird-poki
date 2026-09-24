import { chromium } from "@playwright/test";
const URL = "http://localhost:4174/";
const OUT = [];
const log = (...a) => { const s = a.join(" "); OUT.push(s); console.log(s); };

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", e => errs.push("PAGEERROR " + String(e.message).slice(0, 300)));
page.on("console", m => { if (m.type() === "error") errs.push("CONSOLE " + m.text().slice(0, 300)); });

const snap = () => page.evaluate(() => {
  const card = document.querySelector('[data-ref="menuCard"]');
  const over = document.querySelector('[data-ref="overCard"]');
  const cont = document.querySelector('[data-ref="contCard"]');
  const ad = document.querySelector('[data-ref="adCard"]');
  const vis = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length) && !el.closest(".hidden"));
  const txt = el => (el && vis(el) ? (el.innerText || "").trim().slice(0, 200) : null);
  const btns = el => el ? [...el.querySelectorAll("button")].filter(vis).map(b => ({ a: b.dataset.action, t: (b.innerText || "").trim().slice(0, 48), dis: b.disabled })) : [];
  return {
    menuVisible: vis(card), menuHead: card?.querySelector(".screen-head h2")?.textContent?.trim() ?? null,
    menuText: txt(card), menuBtns: btns(card),
    overVisible: vis(over), overText: txt(over), overBtns: btns(over),
    contVisible: vis(cont), contText: txt(cont), contBtns: btns(cont),
    adVisible: vis(ad), adText: txt(ad), adBtns: btns(ad),
    playHudVisible: vis(document.querySelector(".play-hud")),
    pauseBtnVisible: vis(document.querySelector('[data-action="pause"]')),
    resourceCount: document.querySelectorAll("*").length,
  };
});

async function step(name, fn) {
  const before = errs.length;
  try { await fn(); } catch (e) { log(`STEP ${name}: THREW ${String(e.message).slice(0, 160)}`); }
  const s = await snap();
  log(`STEP ${name}: menu=${s.menuVisible ? `"${s.menuHead}"` : "-"} over=${s.overVisible} cont=${s.contVisible} ad=${s.adVisible} playHud=${s.playHudVisible} newErrors=${errs.length - before}`);
  return s;
}

// ---------- boot ----------
await page.goto(URL, { waitUntil: "commit" });
await page.waitForTimeout(3000);
let s = await step("boot", async () => {});
log("  boot text: " + JSON.stringify(s.menuText));

s = await step("confirm-pilot-name", async () => { await page.locator('[data-action="confirm-pilot-name"]').click({ timeout: 15000 }); await page.waitForTimeout(1200); });
log("=== HOME MENU TEXT ===");
log(s.menuText);
log("=== HOME MENU BUTTONS ===");
log(JSON.stringify(s.menuBtns, null, 1));

// ---------- visit every destination the home menu offers ----------
const HOME_NAV = [...new Set(s.menuBtns.map(b => b.a).filter(a => a && (a.startsWith("open-") || a.startsWith("play-") || a.startsWith("pick-"))))];
log("=== HOME ACTIONS TO VISIT ===" + JSON.stringify(HOME_NAV));

for (const action of HOME_NAV) {
  const tgt = page.locator(`[data-ref="menuCard"] [data-action="${action}"]`).first();
  if (!(await tgt.count())) { log(`VISIT ${action}: NOT PRESENT`); continue; }
  const before = errs.length;
  try {
    await tgt.click({ timeout: 10000 });
    await page.waitForTimeout(1400);
    const v = await snap();
    const btns = v.menuBtns.map(b => b.a + (b.dis ? "(disabled)" : "") + "[" + b.t.slice(0, 24) + "]");
    log(`VISIT ${action} -> head="${v.menuHead}" visible=${v.menuVisible} btns=${JSON.stringify(btns)} newErrors=${errs.length - before}`);
    if (v.menuText) log(`   text: ${JSON.stringify(v.menuText.slice(0, 260))}`);
  } catch (e) { log(`VISIT ${action}: THREW ${String(e.message).slice(0, 160)}`); }
  // return home
  try {
    const back = page.locator('[data-ref="menuCard"] [data-action="back"]').first();
    if (await back.count()) { await back.click({ timeout: 8000 }); await page.waitForTimeout(900); }
    else { await page.keyboard.press("Escape"); await page.waitForTimeout(900); }
  } catch (e) { log(`   back failed: ${String(e.message).slice(0, 100)}`); }
}

log("=== ERRORS SO FAR ===");
log(JSON.stringify(errs, null, 1));
await browser.close();
