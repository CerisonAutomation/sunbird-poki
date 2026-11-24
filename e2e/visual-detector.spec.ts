import { expect, test } from "@playwright/test";
import { visualDefects } from "./visual-helpers";

test("visual audit detects clipped and escaping text without flagging artwork or scrollable content", async ({ page }) => {
  await page.setContent(`
    <div data-ref="menuCard" style="width:300px; position:relative">
      <div class="clipped" style="width:70px; overflow:hidden; white-space:nowrap">This label is far too long for its box</div>
      <div class="escaped" style="position:relative; left:320px; width:100px">Outside the card</div>
      <div style="width:70px; overflow-x:auto"><div class="scrollable" style="width:400px">Reachable by scrolling</div></div>
      <svg class="artwork" style="width:20px;height:20px;overflow:hidden" viewBox="0 0 20 20"><title>Illustration, not a visible label</title><rect x="-5" y="0" width="30" height="20" /></svg>
      <div class="sr-only" style="position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0,0,0,0)">Screen reader text</div>
    </div>
  `);
  const defects = await visualDefects(page);
  expect(defects.some(d => d.startsWith("clipped div[clipped]"))).toBe(true);
  expect(defects.some(d => d.startsWith("escapes panel div[escaped]"))).toBe(true);
  expect(defects.some(d => /scrollable|artwork|sr-only/.test(d))).toBe(false);
});

test("visual audit fails clearly if the menu card is missing", async ({ page }) => {
  await page.setContent("<main>No menu</main>");
  expect(await visualDefects(page)).toEqual(["menuCard not found"]);
});
