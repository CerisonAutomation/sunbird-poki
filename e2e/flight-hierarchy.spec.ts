import { expect, test } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

for (const viewport of [{ width: 1280, height: 800 }, { width: 844, height: 390 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
  test(`one coaching message has priority at ${viewport.width}×${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await page.route("https://game-cdn.poki.com/**", route => route.fulfill({ status: 200, contentType: "application/javascript", body: "window.PokiSDK={init:()=>Promise.resolve(),gameLoadingStart(){},gameLoadingFinished(){},gameplayStart(){},gameplayStop(){}};" }));
    await page.route("https://auds.poki.io/**", route => route.fulfill({ status: 200, contentType: "application/json", body: '{"total":0,"items":[]}' }));
    const app = new SunbirdPage(page);
    await app.open();
    await app.ready();
    await app.fly();
    await app.layoutFixture(false);
    const root = page.locator("#layout-fixture");
    await root.evaluate(el => {
      const hud = el as HTMLElement;
      hud.querySelector('[data-ref="toasts"]')!.replaceChildren();
      hud.dataset.coaching = "true";
      hud.dataset.guidance = "true";
      const chain = hud.querySelector<HTMLElement>('[data-ref="chainReadout"]')!;
      chain.className = "chain-readout tier-hot";
      chain.textContent = "CHAIN ×2";
    });
    await app.publishBand();
    await expect(root.locator(".hint")).toBeVisible();
    await expect(root.locator(".chain-readout")).toBeHidden();
    await expect(root.locator(".goal-strip")).toBeHidden();
    await expect(root.locator(".fever-wrap")).toBeHidden();
    const header = await root.locator(".hud-header").boundingBox();
    const hint = await root.locator(".hint").boundingBox();
    expect(header).not.toBeNull();
    expect(hint).not.toBeNull();
    expect(hint!.y).toBeGreaterThanOrEqual(header!.y + header!.height - 1);
    expect(hint!.y + hint!.height).toBeLessThan(viewport.height * 0.72);
    await page.screenshot({ path: info.outputPath(`hierarchy-${viewport.width}.png`) });
    await root.evaluate(el => { (el as HTMLElement).dataset.coaching = "false"; (el as HTMLElement).dataset.guidance = "false"; });
    await expect(root.locator(".goal-strip")).toBeVisible();
    expect(app.errors).toEqual([]);
  });
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`flight notifications take turns at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route("https://game-cdn.poki.com/**", route => route.fulfill({ status: 200, contentType: "application/javascript", body: "window.PokiSDK={init:()=>Promise.resolve(),gameLoadingStart(){},gameLoadingFinished(){},gameplayStart(){},gameplayStop(){}};" }));
    await page.route("https://auds.poki.io/**", route => route.fulfill({ status: 200, contentType: "application/json", body: '{"total":0,"items":[]}' }));
    const app = new SunbirdPage(page);
    await app.open(); await app.ready(); await app.fly(); await app.layoutFixture();
    const root = page.locator("#layout-fixture");
    await root.evaluate(el => {
      const hud = el as HTMLElement;
      hud.dataset.guidance = "true";
      hud.dataset.coaching = "true";
      hud.querySelector('[data-ref="quips"]')!.innerHTML = '<div class="quip in">A flavour message</div>';
      hud.querySelector('[data-ref="toasts"]')!.innerHTML = '<div class="toast info in">Golden hour soon</div>';
    });
    await expect(root.locator(".toast")).toBeVisible();
    await expect(root.locator(".hint")).toBeHidden();
    await expect(root.locator(".quip")).toBeHidden();
    await root.locator(".toast").evaluate(el => el.remove());
    await expect(root.locator(".hint")).toBeVisible();
    await expect(root.locator(".quip")).toBeHidden();
    await root.evaluate(el => { (el as HTMLElement).dataset.guidance = "false"; (el as HTMLElement).dataset.feedback = "none"; });
    await expect(root.locator(".quip")).toBeVisible();
    expect(app.errors).toEqual([]);
  });
}
