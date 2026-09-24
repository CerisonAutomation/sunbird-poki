import { chromium } from "@playwright/test";

const OUT = "/Users/cb/Developer/projects/sunbird/critique-shots";
import { mkdirSync } from "node:fs";
mkdirSync(OUT, { recursive: true });

export async function launch() {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  return browser;
}

export async function boot(page, url = "http://localhost:4174/") {
  page.setDefaultTimeout(120000);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => window.__sbReady === true || document.getElementById("boot-shell") === null, null, { timeout: 180000 }).catch(() => {});
  await page.waitForTimeout(8000);
}

export async function shot(page, name) {
  const p = `${OUT}/${name}.png`;
  await page.screenshot({ path: p, timeout: 180000, animations: "disabled", caret: "initial" });
  console.log("SHOT", p);
  return p;
}

export async function dump(page, label = "") {
  const d = await page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width <= 0 || r.height <= 0) return false;
      if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") return false;
      let n = el;
      while (n) {
        if (n.classList && n.classList.contains("hidden")) return false;
        n = n.parentElement;
      }
      return true;
    };
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)].join(",");
    };
    const screenEl = [...document.querySelectorAll(".paper-card")].find(vis);
    return {
      state: document.querySelector(".pause-panel") && vis(document.querySelector(".pause-panel")) ? "paused?" : "",
      visibleOverlayCard: screenEl ? (screenEl.className || "").slice(0, 120) : null,
      heading: screenEl ? [...screenEl.querySelectorAll("h1,h2,h3,strong,b")].slice(0, 6).map((h) => h.textContent.replace(/\s+/g, " ").trim().slice(0, 60)) : [],
      buttons: [...document.querySelectorAll("button,[data-action],a[href]")]
        .filter(vis)
        .map((el) => `${el.getAttribute("data-action") || el.tagName} | "${(el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 55)}" | ${box(el)}${el.disabled ? " | DISABLED" : ""}`),
      text: (screenEl ? screenEl.innerText : "").replace(/\n{2,}/g, "\n").slice(0, 2500),
      vw: innerWidth, vh: innerHeight,
    };
  });
  console.log(`\n===== DUMP ${label} (${d.vw}x${d.vh}) =====`);
  console.log("card:", d.visibleOverlayCard);
  console.log("headings:", JSON.stringify(d.heading));
  console.log("buttons:\n  " + d.buttons.join("\n  "));
  console.log("text:\n" + d.text);
  return d;
}
