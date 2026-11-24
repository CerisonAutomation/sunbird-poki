import { afterEach, describe, expect, it, vi } from "vitest";

const config = vi.hoisted(() => ({ enabled: false, size: "" }));
vi.mock("../../sdk/banner", () => ({
  BANNER_HOST_ID: "sunbird-portal-banner",
  get POKI_DISPLAY_AD_SIZE() { return config.size; },
  hasDisplayAd: () => config.enabled,
}));
import { mountPokiShell, showPokiBootError } from "../../poki-shell";

afterEach(() => { config.enabled = false; config.size = ""; });

describe("framework-free Poki shell", () => {
  it("mounts a renderer host without an empty ad slot", () => {
    const root = document.createElement("div");
    const host = mountPokiShell(root);
    expect(host.className).toBe("game-root");
    expect(host.dataset.shell).toBe("sunbird");
    expect(root.children).toHaveLength(1);
  });

  it("keeps a configured ad slot labelled and sized", () => {
    config.enabled = true;
    config.size = "320x50";
    const root = document.createElement("div");
    mountPokiShell(root);
    const banner = root.querySelector<HTMLElement>("#sunbird-portal-banner")!;
    expect(banner.getAttribute("role")).toBe("complementary");
    expect(banner.getAttribute("aria-label")).toBe("Advertisement");
    expect(banner.style.getPropertyValue("--portal-banner-w")).toBe("320px");
    expect(banner.style.getPropertyValue("--portal-banner-h")).toBe("50px");
  });

  it("provides a safe, readable recovery action after a failed boot", () => {
    const root = document.createElement("div");
    showPokiBootError(root, new Error("<img src=x onerror=alert(1)>"));
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("h1")?.textContent).toContain("can’t spread its wings");
    expect(root.querySelector("button")?.textContent).toBe("Try again");
    showPokiBootError(root, new Error("failed to fetch module"));
    expect(root.querySelector("h1")?.textContent).toContain("download was interrupted");
  });
});
