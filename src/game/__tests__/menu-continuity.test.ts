import { afterEach, describe, expect, it } from "vitest";
import { MenuContinuity } from "../MenuContinuity";

afterEach(() => { document.body.innerHTML = ""; });
function fixture() {
  const card = document.createElement("div");
  document.body.append(card);
  return { card, menu: new MenuContinuity() };
}
const content = '<h2>Lobby</h2><input data-ref="roomCode" value=""/><button data-action="room-size" data-id="5">5</button><details data-ref="extra"><summary>More</summary><p>Content</p></details>';

describe("menu continuity", () => {
  it("new screens start at the top, and returning restores the old view", () => {
    const { card, menu } = fixture();
    menu.render(card, "main", content);
    card.scrollTop = 420;
    card.querySelector("details")!.open = true;
    card.querySelector("button")!.focus();
    menu.render(card, "settings", '<h2>Settings</h2>');
    expect(card.scrollTop).toBe(0);
    expect(document.activeElement?.textContent).toBe("Settings");
    menu.render(card, "main", content);
    expect(card.scrollTop).toBe(420);
    expect(card.querySelector("details")!.open).toBe(true);
    expect(document.activeElement).toBe(card.querySelector("button"));
  });
  it("keeps text, selection, focus and scroll during a same-screen refresh", () => {
    const { card, menu } = fixture();
    menu.render(card, "live", content);
    const input = card.querySelector("input")!;
    input.value = "ABCDE";
    input.focus();
    input.setSelectionRange(1, 3);
    card.scrollTop = 170;
    menu.render(card, "live", content + '<p>Network updated</p>');
    const next = card.querySelector("input")!;
    expect(next.value).toBe("ABCDE");
    expect(next.selectionStart).toBe(1);
    expect(next.selectionEnd).toBe(3);
    expect(document.activeElement).toBe(next);
    expect(card.scrollTop).toBe(170);
  });
  it("does not replace identical content or leak drafts to a different screen", () => {
    const { card, menu } = fixture();
    menu.render(card, "live", content);
    const input = card.querySelector("input")!;
    input.value = "ABCDE";
    menu.render(card, "live", content);
    expect(card.querySelector("input")).toBe(input);
    menu.render(card, "account", content);
    expect(card.querySelector("input")!.value).toBe("");
  });
  it("preserves edited fields when a sibling action triggers refresh, but respects explicit clearing", () => {
    const { card, menu } = fixture();
    menu.render(card, "live", content);
    card.querySelector("input")!.value = "ABCDE";
    card.querySelector("button")!.focus();
    menu.render(card, "live", content + " ");
    expect(card.querySelector("input")!.value).toBe("ABCDE");
    card.querySelector("input")!.value = "";
    menu.render(card, "live", content + "  ");
    expect(card.querySelector("input")!.value).toBe("");
  });
});

it("does not replace a composing input and flushes the latest update after composition", async () => {
  const { card, menu } = fixture();
  menu.render(card, "live", content);
  const input = card.querySelector("input")!;
  input.focus(); input.value = "に";
  menu.beginComposition();
  menu.render(card, "live", content + "<p>First update</p>");
  menu.render(card, "live", content + "<p>Latest update</p>");
  expect(card.querySelector("input")).toBe(input);
  menu.endComposition();
  input.value = "日本";
  await Promise.resolve();
  expect(card.querySelector("input")!.value).toBe("日本");
  expect(card.textContent).toContain("Latest update");
  expect(card.textContent).not.toContain("First update");
});

it("starts the next flight recap fresh instead of restoring the previous run's scroll", () => {
  const { card, menu } = fixture();
  menu.render(card, "results", content);
  card.scrollTop = 500;
  card.querySelector("details")!.open = true;
  menu.reset();
  menu.render(card, "results", content);
  expect(card.scrollTop).toBe(0);
  expect(card.querySelector("details")!.open).toBe(false);
});

it("keeps a chat reader's position rather than jumping on every update", () => {
  const { card, menu } = fixture();
  const chat = '<h2>Squad</h2><div data-scroll-memory="club-1" data-stick-bottom>Messages</div>';
  menu.render(card, "squad", chat);
  const list = card.querySelector<HTMLElement>("[data-scroll-memory]")!;
  Object.defineProperties(list, { scrollHeight: { value: 900 }, clientHeight: { value: 180 } });
  list.scrollTop = 200;
  menu.render(card, "squad", chat + '<p>New message</p>');
  expect(card.querySelector<HTMLElement>("[data-scroll-memory]")!.scrollTop).toBe(200);
});

/** Chrome ignores a scrollTop write on a `display:none` scroller and re-applies
 * the offset the element held when it was last shown. jsdom has no layout, so
 * the one browser behaviour this test is about has to be modelled here. */
function hiddenScroller(card: HTMLElement) {
  let shown = 0;
  let visible = true;
  Object.defineProperty(card, "scrollTop", {
    configurable: true,
    get: () => (visible ? shown : 0),
    set: (value: number) => { if (visible) shown = value; },
  });
  return { hide: () => { visible = false; }, show: () => { visible = true; } };
}

it("does not inherit the offset of the screen hidden before it, when the card is re-shown", async () => {
  // A pause sub-screen, scrolled to its end, then back to the flight: the card
  // goes display:none holding that offset. `update()` renders the next screen
  // BEFORE it unhides the overlay, so the restore lands on a scroller with no
  // layout box and the browser hands back the stale one — which is how a
  // player used to arrive at the home menu with "Fly now" off-screen.
  const { card, menu } = fixture();
  menu.render(card, "shop", content);
  const gate = hiddenScroller(card);
  card.scrollTop = 1435;
  gate.hide();
  menu.render(card, "main", content);
  gate.show();
  await Promise.resolve();
  expect(card.scrollTop).toBe(0);
});

it("still remembers a sub-screen's scroll across a visible round trip", async () => {
  const { card, menu } = fixture();
  menu.render(card, "shop", content);
  card.scrollTop = 1435;
  menu.render(card, "main", content);
  await Promise.resolve();
  expect(card.scrollTop).toBe(0);
  menu.render(card, "shop", content);
  await Promise.resolve();
  expect(card.scrollTop).toBe(1435);
});

it("pulls a restored view back to the screen's primary action", async () => {
  const { card, menu } = fixture();
  const home = '<h2>Home</h2><button class="home-launch" data-action="pvp-practice">Fly now</button><p>rest</p>';
  // The card's viewport starts 100px down the page; the CTA sits 40px below the
  // top of its content, so it clears the fold only while scrollTop is under 40.
  card.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
  const ctaRect = () => ({ top: 140 - card.scrollTop }) as DOMRect;
  menu.render(card, "main", home, "paper-card", ".home-launch");
  card.querySelector(".home-launch")!.getBoundingClientRect = ctaRect;
  card.scrollTop = 900;
  menu.render(card, "settings", '<h2>Settings</h2>');
  menu.render(card, "main", home, "paper-card", ".home-launch");
  // innerHTML replaced the button, so restub the node the deferred write measures.
  card.querySelector(".home-launch")!.getBoundingClientRect = ctaRect;
  await Promise.resolve();
  expect(card.scrollTop).toBe(40);
});
