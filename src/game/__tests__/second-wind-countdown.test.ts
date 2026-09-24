import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The second-wind window must stay VISIBLE.
 *
 * It is the only thing telling the player their last chance to save the run is
 * running out: `CONTINUE_TIMEOUT` seconds from the moment the card appears, and
 * when it expires `finishRun()` ends the run. A countdown nobody can see turns a
 * decision into an ambush, and the styling lesson from elsewhere in this sheet is
 * that a later `display: none` (or an `!important` override) can erase an element
 * without touching the code that renders it.
 *
 * Nothing covered this. The countdown rendered, but no test would have failed if
 * a stylesheet hid it or the live binding were dropped, so these assertions pin
 * all three legs: the markup exists, it is bound to the live counter, and no
 * stylesheet hides it.
 */
const HUD = readFileSync(join(process.cwd(), "src", "game", "HUD.ts"), "utf8");
const SHEETS = ["src/index.css", "src/game/ui.css", "src/game/menu-polish.css"].map((p) => [
  p,
  readFileSync(join(process.cwd(), p), "utf8"),
]) as [string, string][];

describe("second wind countdown", () => {
  it("renders the countdown on the continue screen", () => {
    expect(HUD).toMatch(/class="reward-strip wake-strip"/);
    expect(HUD).toMatch(/Second wind closes in/);
  });

  it("is a live region, so the number is announced and not just painted", () => {
    // role="status" is what makes a silently ticking number accessible.
    expect(HUD).toMatch(/class="reward-strip wake-strip" role="status"/);
  });

  it("binds the number to the snapshot's timer", () => {
    expect(HUD).toMatch(/data-live="contTimer"/);
    expect(HUD).toMatch(/Math\.ceil\(s\.continueTimer\)/);
  });

  it("re-grabs the counter on every continue render", () => {
    // A grab done once at construction would go stale the first time the card is
    // re-rendered (innerHTML replaces the node), and the number would freeze at
    // its first value while the window kept running down.
    expect(HUD).toMatch(/this\.contTimerEl = this\.contCard\.querySelector/);
    expect(HUD).toMatch(/s\.state === "continue" && this\.contTimerEl/);
  });

  it("is not hidden by any stylesheet", () => {
    for (const [path, css] of SHEETS) {
      // Any block that both targets the strip and removes it from layout.
      const hiding = css.match(/\.wake-strip[^{]*\{[^}]*\}/g) ?? [];
      for (const block of hiding) {
        expect(block, `${path} hides the second-wind countdown`).not.toMatch(
          /display:\s*none|visibility:\s*hidden|opacity:\s*0(?!\.)|height:\s*0(?!\.)|font-size:\s*0(?!\.)/,
        );
      }
    }
  });
});
