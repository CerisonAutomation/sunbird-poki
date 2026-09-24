/**
 * Device capability baseline — the Poki Player Device Report turned into code.
 *
 * The report (developers.poki.com/guide/player-device-report) is the platform's
 * daily-updated picture of what players actually run: OS and browser mix, CPU
 * core counts, aspect ratios and device pixel ratios, audio-format support, the
 * essential web APIs (WASM, WebRTC, WebP, WakeLock), the advanced graphics APIs
 * (WebGPU, WebGL versions and extensions) and AI feature availability
 * (translator, language model, summarizer, detector).
 *
 * The obligation that falls out of it (rule DEV-03) is simple: do not guess the
 * runtime from a user-agent string — probe it, pick quality tiers from the
 * probe, and degrade instead of failing. This module is that probe.
 *
 * Design constraints, all deliberate:
 *   • Synchronous and side-effect free. It runs before the renderer exists, so
 *     it must not allocate a WebGL context it keeps alive (contexts are lost on
 *     purpose once probed, and the game creates its own).
 *   • Defensive at every step: a partitioned iframe, a privacy browser, a
 *     locked-down `navigator` or a missing `canPlayType` must produce `null`s,
 *     never an exception — the game still has to boot (REQ-16).
 *   • Injectable scope, so the whole thing is unit-testable in jsdom without a
 *     GPU (see src/sdk/__tests__/device-report.test.ts).
 */

export type DeviceTier = "high" | "standard" | "lite";
export type WebglTier = "webgl2" | "webgl1" | "none";
export type AudioFormat = "ogg-opus" | "mp4-aac" | "mpeg" | "webm-opus" | "flac" | "wav";

export type AiFeatureSupport = {
  translator: boolean;
  languageModel: boolean;
  summarizer: boolean;
  detector: boolean;
};

export type DeviceProfile = {
  /** Derived quality tier — the one number the game reads. */
  tier: DeviceTier;
  /** DEV-10 — platform distribution inputs. */
  osName: string | null;
  browserName: string | null;
  /** DEV-11 — device capability. */
  cpuCores: number | null;
  deviceMemoryGb: number | null;
  /** DEV-12 — display. */
  devicePixelRatio: number;
  viewportAspect: number | null;
  screenAspect: number | null;
  /** DEV-13 — media support. */
  webAudio: boolean;
  audio: Record<AudioFormat, boolean | null>;
  /** DEV-14 — essential web APIs. */
  wasm: boolean;
  webRtc: boolean;
  webp: boolean | null;
  wakeLock: boolean;
  /** DEV-15 — advanced graphics. */
  webgpu: boolean;
  webgl: WebglTier;
  webglRenderer: string | null;
  maxTextureSize: number | null;
  /** DEV-16 — AI feature availability (probed and reported only). */
  ai: AiFeatureSupport;
  /** Interaction baseline. */
  touch: boolean;
  /** True when the probe ran in an environment with no DOM at all. */
  headless: boolean;
};

/* ------------------------------------------------------------------ scope */

type BrandEntry = { brand?: string; version?: string };

type NavigatorLike = {
  userAgent?: string;
  language?: string;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  gpu?: unknown;
  mobile?: boolean;
  maxTouchPoints?: number;
  userAgentData?: { brands?: BrandEntry[]; platform?: string; mobile?: boolean };
};

type CanvasLike = {
  getContext?: (kind: string, attributes?: Record<string, unknown>) => unknown;
  width?: number;
  height?: number;
};

type GlLike = {
  getParameter?: (param: number | string) => unknown;
  getExtension?: (name: string) => unknown;
};

type AudioLike = { canPlayType?: (type: string) => string };

type DocumentLike = {
  createElement?: (tag: string) => unknown;
};

type MediaQueryListLike = { matches?: boolean };

type WindowLike = {
  devicePixelRatio?: number;
  innerWidth?: number;
  innerHeight?: number;
  screen?: { width?: number; height?: number };
  matchMedia?: (query: string) => MediaQueryListLike | null;
};

/** Everything the probe touches, injectable for tests. */
export type DeviceScope = {
  navigator?: NavigatorLike | null;
  document?: DocumentLike | null;
  window?: WindowLike | null;
  /** Global constructor lookup (`Translator`, `WebAssembly`, `RTCPeerConnection`, …). */
  global?: Record<string, unknown> | null;
};

function liveScope(): DeviceScope {
  const g = typeof globalThis === "undefined" ? null : (globalThis as unknown as Record<string, unknown>);
  return {
    navigator: (g?.navigator as NavigatorLike | undefined) ?? null,
    document: (g?.document as DocumentLike | undefined) ?? null,
    window: (g?.window as WindowLike | undefined) ?? (g as unknown as WindowLike | null),
    global: g,
  };
}

/* ------------------------------------------------------------- primitives */

function safe<T>(fn: () => T, fallback: T): T {
  try {
    const value = fn();
    return value === undefined || value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function num(value: unknown, min = 0): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min ? value : null;
}

function ratio(w: unknown, h: unknown): number | null {
  const width = num(w);
  const height = num(h);
  if (width === null || height === null || height === 0) return null;
  return Math.round((width / height) * 1000) / 1000;
}

/** UA parsing is a *fallback* only: `userAgentData` wins when the browser exposes it. */
function parseBrowser(ua: string, brands: BrandEntry[] | undefined): string | null {
  const named = brands?.find((b) => b.brand && !/not.?a.?brand/i.test(b.brand) && b.brand !== "Chromium");
  if (named?.brand) return named.brand;
  if (!ua) return null;
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/SamsungBrowser/.test(ua)) return "Samsung Internet";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/CriOS\//.test(ua)) return "Chrome";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "unknown";
}

function parseOs(ua: string, platform: string | undefined): string | null {
  if (platform) {
    const tag = platform.toLowerCase();
    if (tag.includes("android")) return "Android";
    if (tag.includes("ios")) return "iOS";
    if (tag.includes("windows")) return "Windows";
    if (tag.includes("mac")) return "macOS";
    if (tag.includes("chrome os")) return "ChromeOS";
    if (tag.includes("linux")) return "Linux";
  }
  if (!ua) return null;
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Linux/.test(ua)) return "Linux";
  return null;
}

/* ---------------------------------------------------------------- probing */

const AUDIO_PROBES: { format: AudioFormat; mime: string }[] = [
  { format: "ogg-opus", mime: 'audio/ogg; codecs="opus"' },
  { format: "mp4-aac", mime: 'audio/mp4; codecs="mp4a.40.2"' },
  { format: "mpeg", mime: "audio/mpeg" },
  { format: "webm-opus", mime: 'audio/webm; codecs="opus"' },
  { format: "flac", mime: "audio/flac" },
  { format: "wav", mime: 'audio/wav; codecs="1"' },
];

/**
 * Codec support. Sunbird's audio is a procedural WebAudio synth with zero
 * shipped audio files, so no format can ever fail to load — the probe exists so
 * that (a) the platform baseline is visible in our own telemetry, and (b) any
 * future asset-based path picks a format the player's browser actually plays.
 */
function probeAudio(doc: DocumentLike | null): Record<AudioFormat, boolean | null> {
  const el = safe(() => doc?.createElement?.("audio") as AudioLike | undefined, undefined);
  const canPlay = typeof el?.canPlayType === "function" ? el.canPlayType.bind(el) : null;
  const out = {} as Record<AudioFormat, boolean | null>;
  for (const { format, mime } of AUDIO_PROBES) {
    if (!canPlay) {
      out[format] = null;
      continue;
    }
    out[format] = safe(() => canPlay(mime) !== "", false);
  }
  return out;
}

function probeWebgl(doc: DocumentLike | null): {
  webgl: WebglTier;
  renderer: string | null;
  maxTextureSize: number | null;
} {
  const canvas = safe(() => doc?.createElement?.("canvas") as CanvasLike | undefined, undefined);
  if (!canvas?.getContext) return { webgl: "none", renderer: null, maxTextureSize: null };

  const attempt = (kind: string): GlLike | null =>
    safe(() => canvas.getContext?.(kind, { failIfMajorPerformanceCaveat: false }) as GlLike | null, null);

  let tier: WebglTier = "none";
  let gl: GlLike | null = attempt("webgl2");
  if (gl) tier = "webgl2";
  else {
    gl = attempt("webgl") ?? attempt("experimental-webgl");
    if (gl) tier = "webgl1";
  }
  if (!gl) return { webgl: "none", renderer: null, maxTextureSize: null };

  const renderer = safe(() => {
    const info = gl.getExtension?.("WEBGL_debug_renderer_info") as { UNMASKED_RENDERER_WEBGL?: number } | null;
    const value = info?.UNMASKED_RENDERER_WEBGL !== undefined ? gl.getParameter?.(info.UNMASKED_RENDERER_WEBGL) : null;
    return typeof value === "string" && value ? value : null;
  }, null);

  const maxTextureSize = safe(() => {
    const value = gl.getParameter?.(0x0d33 /* MAX_TEXTURE_SIZE */);
    return typeof value === "number" ? value : null;
  }, null);

  // Release the probe context: browsers cap simultaneous contexts and the game
  // is about to create its own.
  safe(() => (gl as { getExtension?: (n: string) => unknown }).getExtension?.("WEBGL_lose_context"), null);
  safe(() => {
    const lose = (gl as { getExtension?: (n: string) => { loseContext?: () => void } | null }).getExtension?.(
      "WEBGL_lose_context",
    );
    lose?.loseContext?.();
    return null;
  }, null);

  return { webgl: tier, renderer, maxTextureSize };
}

function probeAi(global: Record<string, unknown> | null): AiFeatureSupport {
  const has = (name: string): boolean => {
    const value = global?.[name];
    return typeof value === "function";
  };
  // The Device Report tracks exactly these four: translator, language model,
  // summarizer, detector. Names follow the browser-exposed globals; the probe
  // is availability only — see REQ-34 for the content rules.
  return {
    translator: has("Translator"),
    languageModel: has("LanguageModel"),
    summarizer: has("Summarizer"),
    detector: has("Detector"),
  };
}

/* ------------------------------------------------------------------- tier */

export type TierInput = {
  cores: number | null;
  memoryGb: number | null;
  webgl: WebglTier;
  touch: boolean;
  devicePixelRatio: number;
};

/**
 * Quality tier from measured capability (never from a UA string). Deliberately
 * conservative: a wrong "high" costs frames on a device that cannot afford
 * them, a wrong "standard" only costs some polish.
 */
export function tierFor(input: TierInput): DeviceTier {
  if (input.webgl === "none") return "lite";
  if (input.cores !== null && input.cores <= 2) return "lite";
  if (input.memoryGb !== null && input.memoryGb <= 2) return "lite";
  const strong = input.cores !== null && input.cores >= 8 && (input.memoryGb ?? 4) >= 4;
  if (strong && input.webgl === "webgl2") return "high";
  return "standard";
}

/* ---------------------------------------------------------------- profile */

export function detectDeviceProfile(scope: DeviceScope = liveScope()): DeviceProfile {
  const nav = scope.navigator ?? null;
  const doc = scope.document ?? null;
  const win = scope.window ?? null;
  const global = scope.global ?? null;

  const ua = safe(() => String(nav?.userAgent ?? ""), "");
  const uaData = safe(() => nav?.userAgentData, undefined);
  const cores = num(safe(() => nav?.hardwareConcurrency, undefined));
  const memoryGb = num(safe(() => nav?.deviceMemory, undefined));
  const dpr = num(safe(() => win?.devicePixelRatio, undefined), 0.1) ?? 1;
  const viewportAspect = ratio(safe(() => win?.innerWidth, undefined), safe(() => win?.innerHeight, undefined));
  const screenAspect = ratio(
    safe(() => win?.screen?.width, undefined),
    safe(() => win?.screen?.height, undefined),
  );

  const gl = probeWebgl(doc);
  const touch =
    safe(() => (nav?.maxTouchPoints ?? 0) > 0, false) ||
    safe(() => win?.matchMedia?.("(pointer: coarse)")?.matches === true, false) ||
    /Android|iPhone|iPad|iPod|Mobi/i.test(ua);

  const headless = !doc || !win;

  const profile: DeviceProfile = {
    tier: tierFor({ cores, memoryGb, webgl: gl.webgl, touch, devicePixelRatio: dpr }),
    osName: parseOs(ua, safe(() => uaData?.platform, undefined)),
    browserName: parseBrowser(ua, safe(() => uaData?.brands, undefined)),
    cpuCores: cores,
    deviceMemoryGb: memoryGb,
    devicePixelRatio: dpr,
    viewportAspect,
    screenAspect,
    webAudio: safe(() => typeof (global?.AudioContext ?? global?.webkitAudioContext) === "function", false),
    audio: probeAudio(doc),
    wasm: safe(() => typeof global?.WebAssembly === "object" && global.WebAssembly !== null, false),
    webRtc: safe(() => typeof global?.RTCPeerConnection === "function", false),
    webp: (() => {
      // WebP detection without loading an image: the canvas encoder is
      // synchronous in every engine that supports the format.
      const canvas = safe(() => doc?.createElement?.("canvas") as CanvasLike | undefined, undefined);
      const result = safe(
        () => (canvas as { toDataURL?: (type: string) => string })?.toDataURL?.("image/webp"),
        undefined,
      );
      if (typeof result !== "string") return null;
      return result.startsWith("data:image/webp");
    })(),
    wakeLock: safe(() => typeof (nav as { wakeLock?: unknown } | null)?.wakeLock === "object" && nav !== null, false),
    webgpu: safe(() => typeof ((nav as { gpu?: unknown } | null)?.gpu ?? global?.GPU) === "object", false),
    webgl: gl.webgl,
    webglRenderer: gl.renderer,
    maxTextureSize: gl.maxTextureSize,
    ai: probeAi(global),
    touch,
    headless,
  };

  return profile;
}

/* --------------------------------------------------------------- reporting */

const AUDIO_LABELS: Record<AudioFormat, string> = {
  "ogg-opus": "ogg/opus",
  "mp4-aac": "mp4/aac",
  mpeg: "mp3",
  "webm-opus": "webm/opus",
  flac: "flac",
  wav: "wav",
};

/** One-line summary for logs — stable ordering so diffs are meaningful. */
export function describeDeviceProfile(profile: DeviceProfile): string {
  const audio = (Object.keys(AUDIO_LABELS) as AudioFormat[])
    .filter((format) => profile.audio[format] === true)
    .map((format) => AUDIO_LABELS[format]);
  const caps = [
    profile.wasm ? "wasm" : null,
    profile.webRtc ? "webrtc" : null,
    profile.webp ? "webp" : null,
    profile.wakeLock ? "wakelock" : null,
    profile.webgpu ? "webgpu" : null,
  ].filter(Boolean) as string[];
  const gpu = profile.webglRenderer ? ` gpu="${profile.webglRenderer}"` : "";
  return [
    `tier=${profile.tier}`,
    `os=${profile.osName ?? "?"}`,
    `browser=${profile.browserName ?? "?"}`,
    `gl=${profile.webgl}${gpu}`,
    `cores=${profile.cpuCores ?? "?"}`,
    `ram=${profile.deviceMemoryGb ?? "?"}`,
    `dpr=${profile.devicePixelRatio}`,
    `aspect=${profile.viewportAspect ?? "?"}`,
    `audio=${audio.join("+") || "none"}`,
    `caps=${caps.join("+") || "none"}`,
  ].join(" ");
}

/** Aggregate, non-identifying payload for telemetry (no PII — see REQ-32). */
export function deviceProfileTelemetry(profile: DeviceProfile): Record<string, string | number | boolean> {
  const audio = (Object.keys(AUDIO_LABELS) as AudioFormat[]).filter((f) => profile.audio[f] === true);
  const ai = (Object.keys(profile.ai) as (keyof AiFeatureSupport)[]).filter((k) => profile.ai[k]);
  return {
    tier: profile.tier,
    os: profile.osName ?? "unknown",
    browser: profile.browserName ?? "unknown",
    cores: profile.cpuCores ?? -1,
    ram: profile.deviceMemoryGb ?? -1,
    dpr: profile.devicePixelRatio,
    aspect: profile.viewportAspect ?? -1,
    webgl: profile.webgl,
    webgpu: profile.webgpu,
    wasm: profile.wasm,
    webrtc: profile.webRtc,
    webp: profile.webp === true,
    wakelock: profile.wakeLock,
    touch: profile.touch,
    audio: audio.join("+") || "none",
    ai: ai.join("+") || "none",
  };
}

/**
 * The report's dimensions, mapped to the profile fields that carry them. Kept
 * in code (not just docs) so the audit script can assert the probe still covers
 * every dimension the platform publishes.
 */
export const DEVICE_REPORT_DIMENSIONS: { id: string; dimension: string; fields: (keyof DeviceProfile)[] }[] = [
  { id: "DEV-10", dimension: "operating systems", fields: ["osName"] },
  { id: "DEV-10", dimension: "browser usage", fields: ["browserName"] },
  { id: "DEV-11", dimension: "cpu core counts", fields: ["cpuCores", "deviceMemoryGb"] },
  { id: "DEV-12", dimension: "screen aspect ratios", fields: ["viewportAspect", "screenAspect"] },
  { id: "DEV-12", dimension: "device pixel ratios", fields: ["devicePixelRatio"] },
  { id: "DEV-13", dimension: "audio format support", fields: ["audio", "webAudio"] },
  { id: "DEV-14", dimension: "wasm", fields: ["wasm"] },
  { id: "DEV-14", dimension: "webrtc", fields: ["webRtc"] },
  { id: "DEV-14", dimension: "webp", fields: ["webp"] },
  { id: "DEV-14", dimension: "wakelock", fields: ["wakeLock"] },
  { id: "DEV-15", dimension: "webgpu", fields: ["webgpu"] },
  { id: "DEV-15", dimension: "webgl versions and extensions", fields: ["webgl", "webglRenderer", "maxTextureSize"] },
  { id: "DEV-16", dimension: "ai features (translator, language model, summarizer, detector)", fields: ["ai"] },
];
