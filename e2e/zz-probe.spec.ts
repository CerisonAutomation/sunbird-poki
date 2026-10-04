import { test } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

test("probe ready/start handshake", async ({ browser }) => {
  test.setTimeout(280_000);
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = new SunbirdPage(await ctxA.newPage());
  const b = new SunbirdPage(await ctxB.newPage());
  const errs: string[] = [];
  const ws: string[] = [];
  for (const [n, p] of [["A", a.page], ["B", b.page]] as const) {
    p.on("console", m => { if (m.type() === "error") errs.push(`${n}: ${m.text()}`); });
    p.on("websocket", s => {
      if (!s.url().includes("netlib")) return;
      s.on("framesent", ({ payload }) => { const t = safe(payload); if (t && t !== "ping") ws.push(`${n}> ${t} ${payload.slice(0,160)}`); });
      s.on("framereceived", ({ payload }) => { const t = safe(payload); if (t && t !== "ping") ws.push(`${n}< ${t} ${payload.slice(0,160)}`); });
    });
  }
  function safe(p: string) { try { const j = JSON.parse(p); return typeof j.type === "string" ? j.type : ""; } catch { return ""; } }

  const t0 = Date.now();
  const el = () => Date.now() - t0;
  await a.open(); await a.openMenu("open-live", "Race Lobby");
  await b.open(); await b.openMenu("open-live", "Race Lobby");
  await a.page.locator('[data-action="host-room"]').first().dispatchEvent("click");
  await a.page.locator(".room-now-code").waitFor({ state: "visible", timeout: 60_000 });
  const code = (await a.page.locator(".room-now-code").textContent())?.trim();
  await b.page.locator('[data-action="quick-match-instant"]').first().dispatchEvent("click");
  console.log(`[${el()}ms] A code=${code} B quickmatched`);

  // wait for A roster
  const dl = Date.now() + 60_000;
  while (Date.now() < dl) {
    const n = await a.page.locator(".room-flock .room-bird").count();
    if (n > 1) break;
    await a.page.waitForTimeout(500);
  }
  console.log(`[${el()}ms] A roster ready`);

  const snap = async (p: typeof a.page, tag: string) => {
    const presence = await p.locator(".room-presence").first().textContent().catch(()=> "-");
    const badge = await p.locator(".race-section-head .board-badge").first().textContent().catch(()=> "-");
    const start = await p.locator('[data-action="start-room-now"]').first().textContent().catch(()=> "-");
    const readyBtn = await p.locator('[data-action="ready-room"]').first().getAttribute("aria-pressed").catch(()=>null);
    const mmBtn = await p.locator('[data-ref="matchmakingReady"]').isVisible().catch(()=>false);
    const mmCount = await p.locator('[data-ref="matchmakingCount"]').textContent().catch(()=> "-");
    console.log(`[${el()}ms] ${tag}: presence=${JSON.stringify(presence?.trim())} badge=${JSON.stringify(badge?.trim())} start=${JSON.stringify(start?.trim())} readyPressed=${readyBtn} mmReadyVisible=${mmBtn} mmCount=${JSON.stringify(mmCount?.trim())}`);
  };
  await snap(a.page, "A pre-ready"); await snap(b.page, "B pre-ready");

  const bReady = b.page.locator('[data-ref="matchmakingReady"]');
  if (await bReady.isVisible().catch(()=>false)) await bReady.dispatchEvent("click");
  await a.page.locator('[data-action="ready-room"]').dispatchEvent("click");
  console.log(`[${el()}ms] readied both`);

  for (let i = 0; i < 12; i++) {
    await a.page.waitForTimeout(2500);
    await snap(a.page, `A t+${(i+1)*2.5}s`); await snap(b.page, `B t+${(i+1)*2.5}s`);
    if (await a.page.locator('[data-action="pause"]').isVisible().catch(()=>false)) { console.log(`[${el()}ms] A RACING`); break; }
  }
  console.log("--- signalling (non-ping) ---");
  for (const l of ws) console.log(l);
  console.log(`ERRORS: ${errs.length ? errs.join(" | ") : "none"}`);
  await ctxA.close(); await ctxB.close();
});
