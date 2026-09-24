import { describe, expect, it, vi } from "vitest";
import {
  DEVICE_REPORT_DIMENSIONS,
  describeDeviceProfile,
  detectDeviceProfile,
  deviceProfileTelemetry,
  tierFor,
  type DeviceScope,
} from "../device-report";

/**
 * Poki Player Device Report rules DEV-03 and DEV-10…DEV-16: probe the runtime,
 * pick tiers from measurements, degrade instead of throwing.
 */

function glFor(): Record<string, unknown> {
  return {
    getParameter: vi.fn((param: number | string) =>
      param === 0x0d33 ? 8192 : param === 37446 ? "Mock GPU" : null,
    ),
    getExtension: vi.fn((name: string) => {
      if (name === "WEBGL_debug_renderer_info") return { UNMASKED_RENDERER_WEBGL: 37446 };
      if (name === "WEBGL_lose_context") return { loseContext: vi.fn() };
      return null;
    }),
  };
}

function scopeWith(opts: {
  webgl?: "webgl2" | "webgl1" | "none";
  nav?: Record<string, unknown>;
  win?: Record<string, unknown>;
  global?: Record<string, unknown>;
}): DeviceScope {
  const gl = glFor();
  const canvas = {
    getContext: vi.fn((kind: string) => {
      if (kind === "webgl2") return opts.webgl === "webgl2" ? gl : null;
      if (kind === "webgl" || kind === "experimental-webgl") return opts.webgl === "webgl1" ? gl : null;
      return null;
    }),
    toDataURL: vi.fn((type: string) => (type === "image/webp" ? "data:image/webp;base64,AA" : "data:image/png;base64,AA")),
    width: 0,
    height: 0,
  };
  const audio = {
    canPlayType: vi.fn((mime: string) => (mime.includes("opus") || mime.includes("mpeg") ? "probably" : "")),
  };
  return {
    navigator: {
      userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36",
      language: "en-US",
      maxTouchPoints: 5,
      userAgentData: { brands: [{ brand: "Chromium" }, { brand: "Google Chrome", version: "140" }], platform: "Android" },
      hardwareConcurrency: 8,
      deviceMemory: 8,
      ...opts.nav,
    },
    document: { createElement: vi.fn((tag: string) => (tag === "audio" ? audio : canvas)) },
    window: {
      devicePixelRatio: 2.625,
      innerWidth: 412,
      innerHeight: 915,
      screen: { width: 412, height: 915 },
      matchMedia: vi.fn(() => ({ matches: true })),
      ...opts.win,
    },
    global: {
      WebAssembly: {},
      RTCPeerConnection: function RTC() {},
      AudioContext: function Audio() {},
      ...opts.global,
    },
  };
}

describe("device tier from measured capability (DEV-03)", () => {
  it("promotes a strong WebGL2 device to the high tier", () => {
    expect(tierFor({ cores: 8, memoryGb: 8, webgl: "webgl2", touch: false, devicePixelRatio: 2 })).toBe("high");
  });

  it("falls back to lite when there is no WebGL at all", () => {
    expect(tierFor({ cores: 16, memoryGb: 32, webgl: "none", touch: false, devicePixelRatio: 1 })).toBe("lite");
  });

  it("treats low core counts and low memory as lite regardless of WebGL", () => {
    expect(tierFor({ cores: 2, memoryGb: null, webgl: "webgl2", touch: true, devicePixelRatio: 3 })).toBe("lite");
    expect(tierFor({ cores: null, memoryGb: 2, webgl: "webgl2", touch: true, devicePixelRatio: 3 })).toBe("lite");
  });

  it("defaults an unmeasurable device to standard, never to high", () => {
    expect(tierFor({ cores: null, memoryGb: null, webgl: "webgl1", touch: false, devicePixelRatio: 1 })).toBe("standard");
  });
});

describe("capability probe (DEV-10…DEV-16)", () => {
  it("reports OS, browser, cores, display and API support", () => {
    const profile = detectDeviceProfile(scopeWith({ webgl: "webgl2" }));
    expect(profile.osName).toBe("Android");
    expect(profile.browserName).toBe("Google Chrome");
    expect(profile.cpuCores).toBe(8);
    expect(profile.deviceMemoryGb).toBe(8);
    expect(profile.devicePixelRatio).toBe(2.625);
    expect(profile.viewportAspect).toBeCloseTo(0.45, 2);
    expect(profile.webgl).toBe("webgl2");
    expect(profile.webglRenderer).toBe("Mock GPU");
    expect(profile.maxTextureSize).toBe(8192);
    expect(profile.webRtc).toBe(true);
    expect(profile.wasm).toBe(true);
    expect(profile.webAudio).toBe(true);
    expect(profile.webp).toBe(true);
    expect(profile.touch).toBe(true);
  });

  it("degrades to webgl1 when webgl2 is unavailable, and still reports the GPU", () => {
    const profile = detectDeviceProfile(scopeWith({ webgl: "webgl1" }));
    expect(profile.webgl).toBe("webgl1");
    expect(profile.tier).toBe("standard");
  });

  it("reports no WebGL and a lite tier when contexts are refused", () => {
    const profile = detectDeviceProfile(scopeWith({ webgl: "none" }));
    expect(profile.webgl).toBe("none");
    expect(profile.webglRenderer).toBeNull();
    expect(profile.tier).toBe("lite");
  });

  it("probes audio formats with canPlayType and reports unknown when it is absent", () => {
    const profile = detectDeviceProfile(scopeWith({ webgl: "webgl2" }));
    expect(profile.audio["ogg-opus"]).toBe(true);
    expect(profile.audio.mpeg).toBe(true);
    expect(profile.audio.flac).toBe(false);

    const bare = detectDeviceProfile({
      navigator: { userAgent: "x" },
      document: { createElement: () => ({}) },
      window: {},
      global: {},
    });
    expect(bare.audio["ogg-opus"]).toBeNull();
  });

  it("detects WakeLock support from navigator.wakeLock (DEV-14)", () => {
    const supported = detectDeviceProfile(scopeWith({ webgl: "webgl2", nav: { wakeLock: { request: () => Promise.resolve() } } }));
    const unsupported = detectDeviceProfile(scopeWith({ webgl: "webgl2" }));
    expect(supported.wakeLock).toBe(true);
    expect(unsupported.wakeLock).toBe(false);
  });

  it("reports WebGPU and AI feature availability without depending on them", () => {
    const profile = detectDeviceProfile(
      scopeWith({
        webgl: "webgl2",
        nav: { gpu: {} },
        global: { Translator: function T() {}, Summarizer: function S() {} },
      }),
    );
    expect(profile.webgpu).toBe(true);
    expect(profile.ai.translator).toBe(true);
    expect(profile.ai.summarizer).toBe(true);
    expect(profile.ai.languageModel).toBe(false);
    expect(profile.ai.detector).toBe(false);
  });

  it("never throws in a hostile or empty environment (REQ-16)", () => {
    const hostile: DeviceScope = {
      navigator: {
        get userAgent(): string {
          throw new Error("blocked");
        },
      } as unknown as Record<string, unknown>,
      document: {
        createElement: () => {
          throw new Error("blocked");
        },
      },
      window: {
        get devicePixelRatio(): number {
          throw new Error("blocked");
        },
      },
      global: {},
    };
    expect(() => detectDeviceProfile(hostile)).not.toThrow();
    const profile = detectDeviceProfile(hostile);
    expect(profile.tier).toBe("lite");
    expect(profile.devicePixelRatio).toBe(1);

    const empty = detectDeviceProfile({ navigator: null, document: null, window: null, global: {} });
    expect(empty.headless).toBe(true);
    expect(empty.osName).toBeNull();
    expect(empty.webgl).toBe("none");
  });
});

describe("reporting (aggregate only, REQ-32)", () => {
  it("describes the profile in one stable line", () => {
    const line = describeDeviceProfile(detectDeviceProfile(scopeWith({ webgl: "webgl2" })));
    expect(line).toContain("tier=high");
    expect(line).toContain("gl=webgl2");
    expect(line).toContain('gpu="Mock GPU"');
    expect(line).toContain("caps=wasm+webrtc+webp");
  });

  it("emits a telemetry payload with no identifiers", () => {
    const payload = deviceProfileTelemetry(detectDeviceProfile(scopeWith({ webgl: "webgl2" })));
    expect(payload.tier).toBe("high");
    expect(payload.os).toBe("Android");
    // Telemetry keeps raw format ids (stable for dashboards); the human-readable
    // summary uses friendly labels.
    expect(payload.audio).toContain("ogg-opus");
    expect(Object.keys(payload).join(",")).not.toMatch(/id|user|device|agent|ua/i);
    expect(JSON.stringify(payload)).not.toContain("Mozilla");
  });

  it("covers every dimension the platform's report publishes", () => {
    const ids = new Set(DEVICE_REPORT_DIMENSIONS.map((d) => d.id));
    for (const id of ["DEV-10", "DEV-11", "DEV-12", "DEV-13", "DEV-14", "DEV-15", "DEV-16"]) {
      expect(ids.has(id)).toBe(true);
    }
    // Every field a dimension claims to carry must exist on a real profile.
    const profile = detectDeviceProfile(scopeWith({ webgl: "webgl2" }));
    for (const dimension of DEVICE_REPORT_DIMENSIONS) {
      for (const field of dimension.fields) expect(field in profile).toBe(true);
    }
  });
});
