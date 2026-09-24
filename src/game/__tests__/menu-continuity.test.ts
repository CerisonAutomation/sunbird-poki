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
