import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "sunbird.i18n.locale";
const response = () => ({ ok: true, json: async () => [] });

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => response()));
  vi.stubGlobal("navigator", { language: "de-DE", languages: ["de-DE"] });
});
afterEach(() => vi.unstubAllGlobals());

describe("Poki language selection", () => {
  it("adopts Poki's language without turning detection into a saved preference", async () => {
    const i18n = await import("../index");
    expect(i18n.getLocale()).toBe("de");
    expect(await i18n.adoptPortalLocale("es-MX")).toBe(true);
    expect(i18n.getLocale()).toBe("es");
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(await i18n.adoptPortalLocale("fr")).toBe(true);
    expect(i18n.getLocale()).toBe("fr");
  });

  it("falls back to English for an unsupported Poki language, and uses browser detection when SDK is absent", async () => {
    const i18n = await import("../index");
    expect(await i18n.adoptPortalLocale(null)).toBe(false);
    expect(i18n.getLocale()).toBe("de");
    expect(await i18n.adoptPortalLocale("is")).toBe(true);
    expect(i18n.getLocale()).toBe("en");
  });

  it("respects a saved manual language and normalizes Norwegian browser tags", async () => {
    localStorage.setItem(KEY, "fr");
    const i18n = await import("../index");
    expect(i18n.matchLocale("nb-NO")).toBe("no");
    expect(i18n.matchLocale("nn-NO")).toBe("no");
    expect(await i18n.adoptPortalLocale("es")).toBe(false);
    expect(i18n.getLocale()).toBe("fr");
  });

  it("does not let a slow automatic pack overwrite a later manual choice", async () => {
    let release!: (value: ReturnType<typeof response>) => void;
    vi.stubGlobal("fetch", vi.fn((url: string) => url.endsWith("/es.json")
      ? new Promise<ReturnType<typeof response>>(resolve => { release = resolve; })
      : Promise.resolve(response())));
    const i18n = await import("../index");
    const automatic = i18n.adoptPortalLocale("es");
    await i18n.setLocale("fr");
    release(response());
    expect(await automatic).toBe(false);
    expect(i18n.getLocale()).toBe("fr");
    expect(localStorage.getItem(KEY)).toBe("fr");
  });

  it("cancels an older automatic request when the newest matches the current locale", async () => {
    let release!: (value: ReturnType<typeof response>) => void;
    vi.stubGlobal("fetch", vi.fn((url: string) => url.endsWith("/es.json")
      ? new Promise<ReturnType<typeof response>>(resolve => { release = resolve; })
      : Promise.resolve(response())));
    const i18n = await import("../index");
    const slow = i18n.adoptPortalLocale("es");
    expect(await i18n.adoptPortalLocale("de")).toBe(false);
    release(response());
    expect(await slow).toBe(false);
    expect(i18n.getLocale()).toBe("de");
  });

  it("last manual selection wins even if an earlier pack resolves last", async () => {
    let release!: (value: ReturnType<typeof response>) => void;
    vi.stubGlobal("fetch", vi.fn((url: string) => url.endsWith("/es.json")
      ? new Promise<ReturnType<typeof response>>(resolve => { release = resolve; })
      : Promise.resolve(response())));
    const i18n = await import("../index");
    const slow = i18n.setLocale("es");
    await i18n.setLocale("fr");
    release(response());
    await slow;
    expect(i18n.getLocale()).toBe("fr");
    expect(localStorage.getItem(KEY)).toBe("fr");
  });
});
