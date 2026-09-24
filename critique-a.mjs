import { launch, boot, shot, dump } from "./critique-lib.mjs";

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await boot(page);

// --- First-run onboarding on a clean profile -------------------------------
async function cleanPage(w, h) {
  const c2 = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await c2.newPage();
  await boot(p);
  return { p, c2 };
}
{
  const { p, c2 } = await cleanPage(1280, 800);
  await shot(p, "onboarding-nameentry-1280");
  await dump(p, "name entry");
  await c2.close();
}
{
  const { p, c2 } = await cleanPage(640, 360);
  await shot(p, "onboarding-nameentry-640x360");
  await c2.close();
}

if (await page.$('[data-action="confirm-pilot-name"]')) {
  await page.click('[data-action="confirm-pilot-name"]');
  await page.waitForTimeout(5000);
}

for (const [action, name] of [
  ["open-shop", "shop"],
  ["open-settings", "settings"],
  ["open-board", "leaderboard"],
  ["open-progress", "progress"],
  ["open-challenges", "challenges"],
]) {
  await page.evaluate((a) => {
    const el = [...document.querySelectorAll(`[data-action="${a}"]`)].find((e) => e.getBoundingClientRect().width > 0);
    if (el) el.click();
  }, action);
  await page.waitForTimeout(4000);
  await dump(page, name);
  await shot(page, `${name}-1280`);
  // back
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('[data-action="back"],[data-action="menu"]')].find((e) => e.getBoundingClientRect().width > 0);
    if (b) b.click();
  });
  await page.waitForTimeout(3500);
}

await browser.close();
