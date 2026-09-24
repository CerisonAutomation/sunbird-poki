import { expect, type Page } from "@playwright/test";

/** Page Object Model: shared selectors and player actions, not duplicated sleeps. */
export class SunbirdPage {
  readonly errors: string[] = [];
  readonly requests: string[] = [];
  constructor(readonly page: Page) {
    page.on("pageerror", error => this.errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") this.errors.push(message.text()); });
    page.on("request", request => this.requests.push(request.url()));
  }
  async open(): Promise<void> { await this.page.goto("/", { waitUntil: "commit" }); }
  async ready(): Promise<void> {
    await expect(this.page.locator("#boot-shell")).toHaveCount(0);
    const play = this.page.getByRole("button", { name: "Play free flight now", exact: true });
    const confirmName = this.page.locator('[data-action="confirm-pilot-name"]');
    await expect(play.or(confirmName)).toBeVisible();
    // Fresh browser contexts now start at the pilot welcome screen.
    if (await confirmName.isVisible()) {
      await this.page.getByRole("button", { name: "Random name", exact: true }).click();
      await confirmName.click();
    }
    await expect(play).toBeVisible();
  }
  async fly(): Promise<void> {
    await this.page.getByRole("button", { name: "Play free flight now", exact: true }).click();
    await expect(this.page.locator('[data-action="pause"]')).toBeVisible();
  }
  async pause(): Promise<void> {
    await this.page.locator('[data-action="pause"]').click();
    await expect(this.page.locator('[data-action="resume"]')).toBeVisible();
  }
  async resume(): Promise<void> {
    await this.page.locator('[data-action="resume"]').click();
    await expect(this.page.locator('[data-action="pause"]')).toBeVisible();
  }
  async openMenu(action: string, title: string): Promise<void> {
    const card = this.page.locator('[data-ref="menuCard"]');
    const button = card.locator(`[data-action="${action}"]`).first();
    await button.click();
    await expect(card.locator(".screen-head h2")).toHaveText(title);
  }
  async backHome(): Promise<void> {
    await this.page.locator('[data-ref="menuCard"] [data-action="back"]').click();
    await this.ready();
  }
  async expectMenuFits(): Promise<void> {
    const result = await this.page.locator('[data-ref="menuCard"]').evaluate(card => {
      const r = card.getBoundingClientRect();
      return { x: r.left, y: r.top, right: r.right, bottom: r.bottom, overflow: card.scrollWidth - card.clientWidth };
    });
    const viewport = this.page.viewportSize()!;
    expect(result.x).toBeGreaterThanOrEqual(0);
    expect(result.y).toBeGreaterThanOrEqual(0);
    expect(result.right).toBeLessThanOrEqual(viewport.width);
    expect(result.bottom).toBeLessThanOrEqual(viewport.height);
    expect(result.overflow).toBeLessThanOrEqual(1);
  }
  /** Freeze a clone of the production HUD for deterministic layout stress.
   * No game debug hook ships: actual flight actions are tested separately.
   * Synthetic race/power/long-label combinations exercise real compiled CSS.
   */
  async layoutFixture(race = false): Promise<void> {
    await this.page.evaluate(async race => {
      await document.fonts.ready;
      const original = document.querySelector<HTMLElement>(".hud-root")!;
      const root = original.cloneNode(true) as HTMLElement;
      root.id = "layout-fixture";
      original.after(root);
      original.style.display = "none";
      root.dataset.flying = "true";
      root.dataset.feedback = "hint";
      root.querySelectorAll(".overlay").forEach(el => el.classList.add("hidden"));
      const el = (ref: string): HTMLElement => root.querySelector(`[data-ref="${ref}"]`)!;
      el("playHud").classList.remove("hidden");
      el("distance").textContent = "123,456 m";
      el("coins").textContent = "999,999";
      el("biome").textContent = "Sunset Highlands";
      el("goldChip").classList.remove("hidden");
      el("vipChip").classList.remove("hidden");
      el("hint").textContent = "Hold down the hill. Release up the ramp!";
      el("hint").classList.add("show");
      el("launchBanner").textContent = "PERFECT LAUNCH ×12";
      el("launchBanner").classList.add("show");
      el("goalPop").textContent = "Three butter landings! +120";
      el("goalPop").classList.add("show");
      el("feverWrap").classList.add("on");
      el("combo").classList.add("show");
      el("combo").textContent = "×12";
      el("goalStrip").innerHTML = '<div class="gs"><em>Catch 20 coins in a single flight · 18/20</em><i><b style="width:90%"></b></i></div>';
      el("powerStrip").innerHTML = '<div class="pu"><i>🛡</i><u>Sea Shield</u></div><div class="pu"><i>🪁</i><u>Long Glide</u></div><div class="pu"><i>🚀</i><u>Speed Boost</u></div>';
      el("toasts").innerHTML = '<div class="toast in">Butter landing — beautifully timed!</div>';
      if (race) {
        el("rosterBar").classList.remove("hidden");
        el("rosterBar").innerHTML = '<div class="roster-top"><span class="rp-place">P12</span><span class="rm-lead">👑 Long Pilot Name</span><span class="rm-gap">−124 m</span><span class="rm-count">40 birds</span><span class="rm-room">ROOM ABC123</span><span class="rm-net racing">practice</span></div><div class="roster-track"><span class="rb you" style="left:50%"></span></div>';
        el("draftMeter").classList.remove("hidden");
        el("emoteWheel").classList.remove("hidden");
        el("standings").classList.remove("hidden");
        el("standings").innerHTML = '<div class="st-row you"><b>12</b><span>You</span><span>1,240m</span></div>';
      }
      // Finish layout-affecting transitions before measuring the frozen lanes.
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      // Same observed height contract as HUD's ResizeObserver, on the frozen
      // clone (the live observer still belongs to the original game instance).
      for (const name of ["header", "footer"]) {
        const lane = root.querySelector(name === "header" ? ".hud-header" : ".flight-footer")!;
        root.style.setProperty(`--hud-${name}-height`, `${lane.getBoundingClientRect().height}px`);
      }
      // Let the measured CSS variables settle before reading overlap boxes.
      // Reduced-motion CSS still gives transitions a tiny nonzero duration.
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    }, race);
  }

  async expectNoOverlaps(selectors: string[], scope = "#layout-fixture"): Promise<void> {
    const boxes = await this.page.locator(scope).evaluate((root, selectors) => selectors.flatMap(selector => {
      const el = root.querySelector<HTMLElement>(selector);
      if (!el || getComputedStyle(el).display === "none" || getComputedStyle(el).visibility === "hidden") return [];
      const r = el.getBoundingClientRect();
      return r.width && r.height ? [{ selector, x: r.x, y: r.y, right: r.right, bottom: r.bottom }] : [];
    }), selectors);
    const viewport = this.page.viewportSize()!;
    for (const [i, a] of boxes.entries()) {
      expect(a.x, `${a.selector} left`).toBeGreaterThanOrEqual(-1);
      expect(a.right, `${a.selector} right`).toBeLessThanOrEqual(viewport.width + 1);
      expect(a.y, `${a.selector} top`).toBeGreaterThanOrEqual(-1);
      expect(a.bottom, `${a.selector} bottom`).toBeLessThanOrEqual(viewport.height + 1);
      for (const b of boxes.slice(i + 1)) {
        const overlapX = Math.min(a.right, b.right) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
        expect(overlapX > 1 && overlapY > 1, `${a.selector} overlaps ${b.selector}`).toBe(false);
      }
    }
  }

}
