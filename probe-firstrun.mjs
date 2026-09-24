import { chromium } from "@playwright/test";

const VIEWPORTS = [
  { width: 773, height: 305, label: "inspector iframe" },
  { width: 568, height: 320, label: "small landscape" },
  { width: 844, height: 390, label: "phone landscape" },
  { width: 1280, height: 800, label: "desktop" },
];

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.goto("http://localhost:4174/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6500);

  const probe = await page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      // Is it reachable inside the overlay's scroll container?
      return {
        y: Math.round(r.y), bottom: Math.round(r.bottom), h: Math.round(r.height),
        cutOffBy: Math.max(0, Math.round(r.bottom - innerHeight)),
        fullyVisible: r.top >= -1 && r.bottom <= innerHeight + 1,
      };
    };
    const scroller = document.querySelector(".overlay") || document.scrollingElement;
    return {
      vh: innerHeight,
      docScrollable: document.documentElement.scrollHeight > innerHeight + 1,
      overlayScroll: scroller ? { h: scroller.clientHeight, sh: scroller.scrollHeight } : null,
      card: box('[data-ref="menuCard"]'),
      input: box('[data-ref="pilotNameInput"]'),
      confirm: box('[data-action="confirm-pilot-name"]'),
      playFree: box('[data-action="play-free"]'),
      adCardVisible: !!document.querySelector(".ad-label"),
    };
  });
  console.log(`PROBE ${vp.width}x${vp.height} ${vp.label} :: ${JSON.stringify(probe)}`);
  await page.close();
}

await browser.close();
