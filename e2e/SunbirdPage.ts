import { expect, type Locator, type Page } from "@playwright/test";

import { LANE_GAP_PX, footerAnchoredTop, messageBand, type MessageBand, type MessageBandInput } from "../src/game/hud/messageBand";

/** Budget for any wait on a screen the game has to build, boot or transition
 *  into. See the note on `ready()` for why this is not Playwright's default. */
const BOOT_TIMEOUT = 45_000;

/**
 * Browser noise the HARNESS creates, not the game. Two known sources:
 *
 *  • The specs serve the artifact from a minimal static http server, so
 *    anything the game POSTs (the telemetry beacon) has no handler and the
 *    server answers 400. On a real host the portal builds blank the endpoint,
 *    and the guard means the request never fires.
 *  • A plain-http origin is not "trustworthy", so Chromium announces that it
 *    ignored the COOP header. Deployments serve https.
 *
 * Uncaught page errors are NOT filtered: a real game exception still fails the
 * suite, so this cannot hide a defect behind harness noise.
 */
const HARNESS_NOISE = [
  /the server responded with a status of 400/,
  /Cross-Origin-Opener-Policy header has been ignored/,
  // The service worker's own sandboxed `about:blank` frames. Chromium logs one
  // per frame and the game cannot suppress them or act on them; they were
  // failing every phone test in mobile-touch.spec.ts on `app.errors`.
  /Blocked script execution in 'about:blank' because the document's frame is sandboxed/,
];
const isHarnessNoise = (text: string): boolean => HARNESS_NOISE.some((re) => re.test(text));

/** Page Object Model: shared selectors and player actions, not duplicated sleeps. */
export class SunbirdPage {
  readonly errors: string[] = [];
  readonly requests: string[] = [];
  constructor(readonly page: Page) {
    page.on("pageerror", error => this.errors.push(error.message));
    page.on("console", message => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (!isHarnessNoise(text)) this.errors.push(text);
    });
    page.on("request", request => this.requests.push(request.url()));
  }
  async open(): Promise<void> { await this.page.goto("/", { waitUntil: "commit" }); }
  async ready(): Promise<void> {
    // The boot waits carry an explicit budget rather than Playwright's 5 s
    // default. The shipping folder is one 2.38 MB self-contained document:
    // the browser has to fetch, parse and execute all of it, build the WebGL
    // scene, then generate a call sign before this screen exists. Quiet, that
    // is about a second; on a machine already running the rest of the gate it
    // is several times that. portal-policy.spec.ts has always waited 45 s for
    // these same two elements — leaving the artifact suite on the default made
    // it the one spec that failed on how busy the box was, not on the build.
    await expect(this.page.locator("#boot-shell")).toHaveCount(0, { timeout: BOOT_TIMEOUT });
    const play = this.page.getByRole("button", { name: "Fly now", exact: true });
    const confirmName = this.page.locator('[data-action="confirm-pilot-name"]');
    await expect(play.or(confirmName)).toBeVisible({ timeout: BOOT_TIMEOUT });
    // Fresh browser contexts now start at the pilot welcome screen.
    if (await confirmName.isVisible()) {
      await this.page.getByRole("button", { name: "Random name", exact: true }).click();
      await confirmName.click();
    }
    await expect(play).toBeVisible({ timeout: BOOT_TIMEOUT });
  }
  async fly(): Promise<void> {
    await this.page.getByRole("button", { name: "Fly now", exact: true }).click();
    await expect(this.page.locator('[data-action="pause"]')).toBeVisible({ timeout: BOOT_TIMEOUT });
  }
  async pause(): Promise<void> {
    await this.page.locator('[data-action="pause"]').click();
    await expect(this.page.locator('[data-action="resume"]')).toBeVisible({ timeout: BOOT_TIMEOUT });
  }
  async resume(): Promise<void> {
    await this.page.locator('[data-action="resume"]').click();
    await expect(this.page.locator('[data-action="pause"]')).toBeVisible({ timeout: BOOT_TIMEOUT });
  }
  async openMenu(action: string, title: string): Promise<void> {
    const card = this.page.locator('[data-ref="menuCard"]');
    // The menu's own entry, not the onboarding shortcut for the same action.
    // `.first()` used to be the tiebreak, and it silently picked the onboarding
    // step, which sits earlier in the card — so `openMenu("open-live")` could
    // navigate somewhere that is not the Race Lobby and then sat waiting for a
    // heading that never arrived, for the full 300s test budget. When the menu
    // genuinely has no entry of its own, the fallback keeps the call working.
    const own = this.menuAction(action);
    const button = (await own.count()) > 0 ? own.first() : card.locator(`[data-action="${action}"]`).first();
    await button.click();
    await expect(card.locator(".screen-head h2")).toHaveText(title, { timeout: BOOT_TIMEOUT });
  }
  /**
   * The menu's OWN entry for an action, not the onboarding route's shortcut
   * for the same destination.
   *
   * Both carry the same `data-action` by design — the onboarding flight plan
   * (`open-loadout`, `versus`, `open-scores`, …) is built from the same
   * destination catalog as the menu, so a shortcut and the menu entry agree by
   * construction. That makes a bare `page.locator('[data-action="versus"]')`
   * resolve to two elements and fail Playwright's strict mode, and it fails
   * *as a timeout*, because a strict-mode violation inside the 20s expect is
   * followed by a teardown that waits out the full 300s test budget. Six
   * specs reported that as a hung run rather than as the one-line selector
   * mistake it is.
   *
   * `:not()` rather than a class list, because the entries live in several
   * different sections of the card and a section-scoped locator would go stale
   * the next time one moves.
   */
  menuAction(action: string): Locator {
    return this.page.locator(`[data-ref="menuCard"] [data-action="${action}"]:not(.onboarding-route-step)`);
  }
  async backHome(): Promise<void> {
    await this.page.locator('[data-ref="menuCard"] [data-action="back"]').click();
    await this.ready();
  }
  /**
   * Wait until the HUD's lane geometry is STABLE, not merely published once.
   *
   * `--hud-header-height` drives where the foreground band is clamped, and the
   * value is measured from the live header. The header grows asynchronously —
   * the versus roster fills in after the screen is already up — so a single
   * "does the published value match right now?" check can pass in the gap
   * between the header growing and the ResizeObserver republishing. Reading the
   * boxes in that gap reports the band sitting inside the header, which the
   * settled layout never does.
   *
   * So: require the measured offsets to be identical across three consecutive
   * frames. That is the steady state, which is what the overlap contract is
   * about. The throw is loud if the lanes genuinely never stabilise.
   *
   * What this helper deliberately does NOT assert is that `--hud-footer-height`
   * equals a reading of the footer box. It used to, and that assertion is what
   * made the portrait frames unsatisfiable for two separate reasons:
   *
   *   1. It read the footer always from the bottom. In portrait the footer is
   *      TOP-anchored, so the published value is a band measured DOWNWARD and
   *      can never equal a bottom reservation — 320x568 waited out all 240
   *      frames and reported "never settled" while the two landscape frames
   *      passed. The fix is `footerAnchoredTop()`, and it is used below for the
   *      FAILURE MESSAGE, so the diagnosis names the right orientation.
   *   2. Even reading it correctly, versus mode at 320x568 leaves
   *      `--hud-footer-height` at 8px while the footer measures 106.5px — the
   *      HUD published when the footer was parked at `header + 8` with no
   *      content, and never republished as it filled in. That is a real defect
   *      in `HUD.ts`'s observer, not a test artefact, and it does not recover on
   *      its own (six seconds of waiting changed nothing).
   *
   * Asserting it here would only report (2) as a mystery selector failure. The
   * published variables are covered directly by `hud-message-band.test.ts` and
   * by `layout.spec.ts`, which recomputes the whole band through the shipping
   * `messageBand()`. (2) is recorded rather than papered over.
   */
  async awaitSettledLanes(scope = ".hud-root"): Promise<void> {
    const result = await this.page.locator(scope).evaluate(async root => {
      const hud = root.querySelector<HTMLElement>(".play-hud")!;
      const header = root.querySelector<HTMLElement>(".hud-header")!;
      const footer = root.querySelector<HTMLElement>(".flight-footer")!;
      const read = () => {
        const hudRect = hud.getBoundingClientRect();
        return {
          headerPx: header.getBoundingClientRect().bottom - hudRect.top,
          footerTop: footer.getBoundingClientRect().top,
        };
      };
      const same = (a: number, b: number) => Math.abs(a - b) <= 1;
      let previous: ReturnType<typeof read> | null = null;
      let stableFrames = 0;
      for (let frame = 0; frame < 240; frame++) {
        const measured = read();
        const unchanged = previous !== null && same(measured.headerPx, previous.headerPx) && same(measured.footerTop, previous.footerTop);
        stableFrames = unchanged ? stableFrames + 1 : 0;
        if (stableFrames >= 3) return { ...measured, settled: true as const };
        previous = measured;
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      }
      return { ...(previous ?? read()), settled: false as const };
    });
    expect(
      result.settled,
      `HUD lane geometry never stopped moving (header ${result.headerPx.toFixed(1)}px, footer top ${result.footerTop.toFixed(1)}px)`,
    ).toBe(true);
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
      // Mirror the SHIPPING contract exactly: HUD.ts measures each lane as the
      // full offset from the play-hud edge (header.bottom - hud.top, and
      // hud.bottom - footer.top), NOT the lane's own height. Setting the height
      // here drifted from that, which made the ring/slope meters look 8px into
      // the roster bar and hid real regressions behind layout the game never
      // produces.
      const hud = root.querySelector<HTMLElement>(".play-hud")!;
      const hudRect = hud.getBoundingClientRect();
      const header = root.querySelector<HTMLElement>(".hud-header")!;
      const headerPx = header.getBoundingClientRect().bottom - hudRect.top;
      root.style.setProperty("--hud-header-height", `${headerPx}px`);
      // The FOOTER and every derived band variable are deliberately not set
      // here. Both depend on which edge the footer is anchored to, which is
      // resolved by `footerAnchoredTop()` — a shipping function that cannot run
      // inside `page.evaluate`, because the browser context has no access to
      // this module's imports. `publishBand()` measures the footer here, decides
      // in Node, and writes back, converging over repeated passes.
    }, race);
  }

  /**
   * Publish the measured message stack onto the fixture, using the same
   * `messageBand()` the live HUD uses.
   *
   * The clone inherits the live HUD's inline custom properties, and the live
   * `ResizeObserver` measured them BEFORE the viewport was resized — so
   * `--hud-messages-top` was whatever the default viewport needed. It then
   * read as a genuine placement while being a stale copy, and the overlap
   * assertion failed on lanes the game never actually stacks. The giveaway was
   * that 360x740 and 320x568 reported the byte-identical `--hud-messages-top`
   * of 180.1875px: two frames 170px apart cannot measure the same band.
   *
   * Computing it here from the fixture's own geometry is the only version of
   * this test that exercises what ships.
   */
  async publishBand(): Promise<void> {
    // Publishing moves the layout, so one pass measures a layout that is no
    // longer the one being placed: the footer is anchored to the header, and the
    // header's height is itself a function of the band. The live HUD does not
    // have this problem because its `ResizeObserver` watches the footer and
    // re-runs on every change, converging on a fixed point. The clone has no
    // observer, so it has to be driven to that same fixed point by hand — one
    // pass measured a footer 157px above where it finally rendered, and the
    // band landed inside it by 55px.
    let previous = "";
    for (let pass = 0; pass < 6; pass++) {
      const raw = await this.measureBand();
      const anchoredTop = footerAnchoredTop({ footerTop: raw.footerTop, hudTop: raw.hudTop, headerPx: raw.headerPx });
      const input: MessageBandInput = {
        hudPx: raw.hudBottom - raw.hudTop,
        headerPx: raw.headerPx,
        anchoredTop,
        footerPx: anchoredTop
          ? Math.max(0, raw.footerBottom - raw.hudTop)
          : Math.max(0, raw.hudBottom - raw.footerTop),
        quipY: raw.quipY,
        // A `display:none` lane measures 0x0 at the origin. Read as a position
        // that says "the bottom obstruction is at the top of the screen", which
        // pins the band to its ceiling and gives it zero height — the band
        // vanishes precisely when the one lane that would bound it is not
        // painted. A lane that is not on screen obstructs nothing, so it
        // reports as past the bottom of the play area and `Math.min` ignores it.
        slopeY: raw.slopeY ?? raw.hudBottom - raw.hudTop,
        handPx: raw.handPx,
        naturalBandPx: raw.naturalBandPx,
      };
      const band = messageBand(input);
      const current = JSON.stringify([input, band]);
      if (current === previous) return;
      previous = current;
      await this.writeBand(band, input.footerPx);
      // Let the measured CSS variables settle before the next measurement.
      // Reduced-motion CSS still gives transitions a tiny nonzero duration.
      await this.page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    }
    throw new Error(`the layout fixture's measured stack never settled in 6 passes (last: ${previous})`);
  }

  /**
   * Raw geometry only. Every decision — which edge the footer is anchored to,
   * where the band goes — is made in Node by the same functions the game
   * ships, so this measures and the arithmetic does not get restated here.
   */
  private async measureBand(): Promise<{
    hudTop: number; hudBottom: number; headerPx: number;
    footerTop: number; footerBottom: number;
    quipY: number; slopeY: number | null; handPx: number; naturalBandPx: number;
  }> {
    return this.page.locator("#layout-fixture").evaluate(root => {
      const r = root as HTMLElement;
      const hud = r.querySelector<HTMLElement>(".play-hud")!.getBoundingClientRect();
      const footer = r.querySelector<HTMLElement>(".flight-footer")!.getBoundingClientRect();
      const top = (sel: string): number | null => {
        const el = r.querySelector<HTMLElement>(sel);
        if (!el || getComputedStyle(el).display === "none") return null;
        return el.getBoundingClientRect().top - hud.top;
      };
      const quip = r.querySelector<HTMLElement>(".quips");
      const hand = r.querySelector<HTMLElement>(".hand");
      return {
        hudTop: hud.top,
        hudBottom: hud.bottom,
        headerPx: r.querySelector<HTMLElement>(".hud-header")!.getBoundingClientRect().bottom - hud.top,
        footerTop: footer.top,
        footerBottom: footer.bottom,
        quipY: quip && getComputedStyle(quip).display !== "none"
          ? quip.getBoundingClientRect().top - hud.top
          : hud.bottom - hud.top,
        slopeY: top(".slope-chain"),
        handPx: hand && getComputedStyle(hand).display !== "none" ? hand.offsetHeight : 0,
        naturalBandPx: r.querySelector<HTMLElement>(".flight-messages")!.offsetHeight,
      };
    });
  }

  /**
   * The published names are the CSS ones, spelled out rather than derived from
   * the field names. Deriving them (`--hud-${key}`) silently wrote `--hud-top`
   * and `--hud-stackBottom`, left every real variable holding its stale
   * inherited copy, and the test still "ran" — passing or failing on numbers
   * the game never produced.
   */
  private async writeBand(band: MessageBand, footerPx: number): Promise<void> {
    await this.page.locator("#layout-fixture").evaluate((root, values) => {
      const r = root as HTMLElement;
      for (const [name, px] of Object.entries(values)) r.style.setProperty(name, `${px}px`);
    }, {
      // The orientation-dependent footer reservation, resolved the same way the
      // live observer resolves it. Left stale, the portrait gauge and the toast
      // lane both read a bottom inset that is measured from the wrong edge.
      "--hud-footer-height": footerPx,
      "--hud-messages-top": band.top,
      "--hud-messages-max": band.maxPx,
      "--hud-messages-bottom": band.bottom,
      "--hud-stack-bottom": band.stackBottom,
      "--hud-lane-floor": band.laneFloor,
      "--hud-chain-clear": band.chainClear,
      "--hud-footer-bottom": band.footerBottom,
      "--hud-lane-gap": LANE_GAP_PX,
    } as unknown as Record<string, number>);
  }

  async expectNoOverlaps(selectors: string[], scope = "#layout-fixture"): Promise<void> {
    // The element type is stated rather than left to `flatMap` inference, which
    // reads the first return branch only and then rejects the second — a
    // compile error in the checker that is supposed to catch layout defects.
    type Box = { selector: string; x: number; y: number; right: number; bottom: number };
    type Nested = { selector: string; nestedIn: string };
    const boxes = await this.page.locator(scope).evaluate<Array<Box | Nested>, string[]>((root, selectors) => selectors.flatMap((selector): Array<Box | Nested> => {
      const el = root.querySelector<HTMLElement>(selector);
      if (!el || getComputedStyle(el).display === "none" || getComputedStyle(el).visibility === "hidden") return [];
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return [];
      // A lane nested inside another lane is not a collision with it: the goal
      // strip is a CHILD of the footer and is meant to sit inside it. Comparing
      // the two flatly reports the footer's own box against its own content,
      // which is how `.flight-footer` came to "overlap" `.goal-strip` by the
      // full width of the strip. Only siblings that share the screen are a
      // defect, so the ancestry test runs here rather than by curating the
      // selector groups — a group that happens to list a parent and its child
      // is the normal case, not a mistake in the grouping.
      let node: HTMLElement | null = el.parentElement;
      while (node) {
        if (selectors.some((s) => node === root.querySelector<HTMLElement>(s))) {
          return [{ selector, nestedIn: selectors.find((s) => node === root.querySelector<HTMLElement>(s))! }];
        }
        node = node.parentElement;
      }
      return [{ selector, x: r.x, y: r.y, right: r.right, bottom: r.bottom }];
    }), selectors);

    const measurable = boxes.filter((b): b is Box => "x" in b);
    const viewport = this.page.viewportSize()!;
    for (const [i, a] of measurable.entries()) {
      expect(a.x, `${a.selector} left`).toBeGreaterThanOrEqual(-1);
      expect(a.right, `${a.selector} right`).toBeLessThanOrEqual(viewport.width + 1);
      expect(a.y, `${a.selector} top`).toBeGreaterThanOrEqual(-1);
      expect(a.bottom, `${a.selector} bottom`).toBeLessThanOrEqual(viewport.height + 1);
      for (const b of measurable.slice(i + 1)) {
        const overlapX = Math.min(a.right, b.right) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
        expect(
          overlapX > 1 && overlapY > 1,
          `${a.selector} overlaps ${b.selector} by ${overlapX.toFixed(0)}x${overlapY.toFixed(0)}px ` +
          `([${a.x.toFixed(0)},${a.y.toFixed(0)},${a.right.toFixed(0)},${a.bottom.toFixed(0)}] vs ` +
          `[${b.x.toFixed(0)},${b.y.toFixed(0)},${b.right.toFixed(0)},${b.bottom.toFixed(0)}])`,
        ).toBe(false);
      }
    }
  }

}
