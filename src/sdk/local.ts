/**
 * LocalAdapter — the no-op platform with real local behavior where it
 * matters: cloud saves persist to localStorage (the "local fallback" the
 * save pipeline requires) and share() uses the Web Share API when present.
 *
 * Serves: local dev and the direct/web build ("none"), and a portal
 * builds that boot outside their portal (CrazyGames environment "disabled").
 *
 * Both imports below are leaves. `./platform-contract` holds the interface
 * this class implements, and `./cloud-local` holds the storage backend — this
 * adapter used to export the backend itself and make the Poki adapter import a
 * sibling adapter's module to reach it, which is what closed
 * `poki.ts → local.ts → platform.ts → poki.ts`. Importing the contract
 * directly is also what keeps this file a leaf of the composition root.
 */
import {
  EMPTY_INFO,
  type InviteParams,
  type PlatformAdapter,
  type PlatformIdentity,
  type PlatformSystemInfo,
} from "./platform-contract";
import { localCloudFallback } from "./cloud-local";

export class LocalAdapter implements PlatformAdapter {
  readonly name: "none";
  readonly ready = true;

  constructor(kind: "none" = "none") {
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
  happyTime(_intensity?: number): void {}

  /* ads — none */
  async commercialBreak(): Promise<void> {}
  async rewardedBreak(): Promise<boolean> {
    return false;
  }
  async showRewardedAd(): Promise<boolean> {
    return false;
  }
  destroyBanner(): void {}
  mountBanner(_container: HTMLElement): void {}

  /** No portal language: the game's own browser detection is authoritative. */
  getLanguage(): string | null {
    return null;
  }

  movePill(_topPercent: number, _topPx: number): void {}

  /** No portal recorder in a standalone build. */
  playtestCapture(_on: boolean): void {}

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
  /** No portal analytics behind a direct build — measurement is a no-op, and
   *  reports `false` so a budgeting caller does not spend on a dead channel. */
  measure(_category: string, _label: string, _action: string): boolean { return false; }
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
