import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("important player messages", () => {
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

  it("interpolates actual grants and resolves the current language at display time", async () => {
    vi.resetModules();
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const locale = /\/([^/]+)\.json$/.exec(url)?.[1];
      if (!locale) throw new Error("unexpected pack URL");
      const pack = JSON.parse(readFileSync(resolve(process.cwd(), `public/i18n/${locale}.json`), "utf8"));
      return { ok: true, json: async () => pack };
    }));
    const i18n = await import("../../i18n");
    const { importantMessages: m } = await import("../ImportantMessages");
    await i18n.setLocale("en");
    expect(m.vipDaily(73)).toBe("VIP daily gift · +73 coins");
    expect(m.flightBonus(125)).toBe("3× flight bonus · +125 coins");
    await i18n.setLocale("es");
    expect(m.vipDaily(73)).toBe("Regalo diario VIP · +73 monedas");
    expect(m.flightBonus(125)).toBe("Bono de vuelo ×3 · +125 monedas");
    expect(m.rewardUnconfirmed()).toContain("No se concedió");
    expect(m.streakDay(2, 15)).not.toMatch(/\{.*\}/);
    await i18n.setLocale("en");
    expect(m.continueUnconfirmed()).toMatch(/unavailable or not completed/i);
    expect(m.firstShop()).not.toMatch(/150|225/);
  });
});
