import { test, expect } from "@playwright/test";
import type { Server } from "node:http";
import {
  SCREENS, FREEZE, boot, goHome, openScreen,
  startArtifactServer, stopArtifactServer, visualDefects,
} from "./visual-helpers";

/**
 * Every screen a player can reach from the menu, checked for clipped text and
 * off-screen content. Runs in the default language so it stays one test and a
 * couple of minutes; the per-language version is visual-locale.spec.ts.
 */
let server: Server;
let baseUrl = "";

test.beforeAll(async () => { ({ server, baseUrl } = await startArtifactServer()); });
test.afterAll(async () => { await stopArtifactServer(server); });

test(`all ${SCREENS.length} reachable screens fit their box`, async ({ page }) => {
  await boot(page, baseUrl);
  await page.addStyleTag({ content: FREEZE });
  const problems: string[] = [];
  for (const action of SCREENS) {
    await goHome(page);
    await openScreen(page, action);
    const defects = await visualDefects(page);
    if (defects.length) problems.push(`${action}: ${defects.join(" | ")}`);
  }
  expect(problems, "screens with visual defects").toEqual([]);
});
