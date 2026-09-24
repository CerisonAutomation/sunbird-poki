/**
 * LocalAdapter — the no-op platform with real local behavior where it
 * matters: cloud saves persist to localStorage (the "local fallback" the
 * save pipeline requires) and share() uses the Web Share API when present.
 *
 * Serves: local dev ("none"), generic portal builds ("generic"), and portal
 * builds that boot outside their portal (CrazyGames environment "disabled").
 */
import type {
  InviteParams,
  PlatformAdapter,
  PlatformIdentity,
  PlatformSystemInfo,
} from "./platform";
import { storage, type StorageLike } from "../game/Storage";

const PREFIX = "sunbird.cloud.";

/**
 * Cross-safe storage backend: localStorage → sessionStorage → memory, in
 * that order (see Storage.ts). In a sandboxed portal iframe the raw
 * localStorage accessor throws, so the cloud-save fallback must survive
 * that — previously it silently no-opped there.
 */
function ls(): StorageLike {
  return storage;
}

/** Shared localStorage-backed cloud save (also used by the Poki adapter). */
export const localCloudFallback = {
  save(key: string, value: unknown): Promise<void> {
    try {
      ls()?.setItem(`${PREFIX}${key}`, JSON.stringify(value));
    } catch {
      /* quota/privacy mode — degrade silently */
    }
    return Promise.resolve();
  },
  load<T>(key: string): Promise<T | null> {
    try {
      const raw = ls()?.getItem(`${PREFIX}${key}`);
      if (raw === null || raw === undefined) return Promise.resolve(null);
      return Promise.resolve(JSON.parse(raw) as T);
    } catch {
      return Promise.resolve(null);
    }
  },
  remove(key: string): Promise<void> {
    try {
      ls()?.removeItem(`${PREFIX}${key}`);
    } catch {
      /* ignore */
    }
    return Promise.resolve();
  },
  clear(): Promise<void> {
    try {
      const doomed: string[] = [];
      const store = ls();
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && k.startsWith(PREFIX)) doomed.push(k);
      }
      for (const k of doomed) store.removeItem(k);
    } catch {
      /* ignore */
    }
    return Promise.resolve();
  },
  has(key: string): Promise<boolean> {
    try {
      return Promise.resolve(ls()?.getItem(`${PREFIX}${key}`) !== null);
    } catch {
      return Promise.resolve(false);
    }
  },
};

const EMPTY_INFO: PlatformSystemInfo = {
  countryCode: null,
  locale: null,
  deviceType: null,
  osName: null,
  osVersion: null,
  browserName: null,
  browserVersion: null,
  applicationType: null,
};

export class LocalAdapter implements PlatformAdapter {
  readonly name: "none" | "generic";
  readonly ready = true;

  constructor(kind: "none" | "generic" = "none") {
    this.name = kind;
  }

  capabilities(): string[] {
    return ["cloudSaveLocal"];
  }

  environment(): string | null {
    return null;
  }

  /* lifecycle — all no-ops */
  loadingStart(): void {}
  loadingFinished(): void {}
  signalGameReady(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}
  pause(): void {}
  happyTime(_intensity: number): void {}
  portalLanguage(): string | null {
    return null;
  }
  movePill(_topPercent: number, _topPx: number): void {}

  /* ads — none */
  async commercialBreak(): Promise<void> {}
  async rewardedBreak(): Promise<boolean> {
    return false;
  }
  async showMidgameAd(): Promise<void> {}
  async showRewardedAd(): Promise<boolean> {
    return false;
  }
  mountBanner(_container: HTMLElement): void {}

  /* cloud save — real, localStorage-backed */
  saveCloud<T>(key: string, value: T): Promise<void> {
    return localCloudFallback.save(key, value);
  }
  loadCloud<T>(key: string): Promise<T | null> {
    return localCloudFallback.load<T>(key);
  }
  removeCloud(key: string): Promise<void> {
    return localCloudFallback.remove(key);
  }
  clearCloud(): Promise<void> {
    return localCloudFallback.clear();
  }
  hasCloud(key: string): Promise<boolean> {
    return localCloudFallback.has(key);
  }

  /* identity — none */
  async getIdentity(): Promise<PlatformIdentity | null> {
    return null;
  }
  getSystemInfo(): PlatformSystemInfo {
    return { ...EMPTY_INFO };
  }
  async submitPlatformScore(_score: number): Promise<void> {}
  /* No portal UI, recorder, error dashboard or external-link broker locally. */
  showLeaderboard(_id?: number | null): void {}
  playtestSetCanvas(_canvas: HTMLCanvasElement | HTMLCanvasElement[] | null): void {}
  captureError(_err: string | Error): void {}
  deviceCategory(): "mobile" | "tablet" | "desktop" | null { return null; }
  openExternalLink(_url: string): void {}
  async requestAccountLink(): Promise<boolean> {
    return false;
  }
  async getIapToken(): Promise<string | null> {
    return null;
  }

  /* invites / rooms / share */
  isInstantMultiplayer(): boolean {
    return false;
  }
  getInviteParam(_name: string): string | null {
    return null;
  }
  getInviteParams(): InviteParams | null {
    return null;
  }
  onJoinRoom(_listener: (params: InviteParams) => void): () => void {
    return () => undefined;
  }
  async inviteFriends(_params: InviteParams): Promise<string | null> {
    return null;
  }
  updateRoom(_opts: { roomId?: string; isJoinable?: boolean; inviteParams?: InviteParams }): void {}
  leftRoom(): void {}
  /** No portal analytics behind a direct build — measurement is a no-op. */
  measure(_category: string, _label: string, _action: string): void {}
  async share(message: string, _params?: InviteParams): Promise<boolean> {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ text: message });
        return true;
      } catch (error) {
        // Dismissed sheet = the share surface was shown; a fallback retry
        // would just nag the user with a second sheet.
        return error instanceof DOMException && (error.name === "AbortError" || error.name === "NotAllowedError");
      }
    }
    return false;
  }

  /* settings — none */
  syncSettings(): void {}
  isMuted(): boolean {
    return false;
  }
  getSettings(): { muteAudio: boolean; disableChat: boolean } {
    return { muteAudio: false, disableChat: false };
  }
}
