/**
 * Build-target shim — replaces the Poki and CrazyGames adapter modules in
 * non-target builds. It must NOT reference the real SDK globals or method
 * names (`PokiSDK`, `shareableURL`, `sdk.crazygames.com`, etc.) because
 * portal scanners flag any appearance of those strings in a non-target
 * bundle — even inside dead code.
 *
 * The resolve-alias in vite.config.ts substitutes this file for
 * src/sdk/poki.ts (or crazygames.ts) when building for a different
 * portal, so the real adapter module never reaches Rollup at all.
 *
 * It imports `./platform-contract`, not `./platform`. That matters: under the
 * alias this file IS `./poki`, and `./platform` imports `./poki` — so a
 * shim that reached for the contract in `platform.ts` would reintroduce a
 * cycle in the real bundle graph that madge cannot see, because the alias
 * lives in the bundler config rather than in the source. The contract leaf has
 * no such back edge.
 */
import {
  EMPTY_INFO,
  type PlatformAdapter,
  type PlatformEvents,
  type PlatformIdentity,
  type PlatformSystemInfo,
  type InviteParams,
} from "./platform-contract";

/** Stub adapter used when this SDK isn't the build target. */
class StubAdapter implements PlatformAdapter {
  readonly name: "poki";
  readonly ready = false;
  constructor(_events: PlatformEvents, name: "poki" = "poki", _bannerId?: string) { this.name = name; }
  capabilities(): string[] { return []; }
  environment(): string | null { return null; }
  loadingStart(): void {}
  loadingFinished(): void {}
  signalGameReady(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}
  pause(): void {}
  happyTime(_intensity?: number): void {}
  async commercialBreak(): Promise<void> {}
  async rewardedBreak(): Promise<boolean> { return false; }
  async showRewardedAd(): Promise<boolean> { return false; }
  destroyBanner(): void {}
  mountBanner(_container: HTMLElement): void {}

  getLanguage(): string | null {
    return null;
  }

  movePill(_topPercent: number, _topPx: number): void {}

  playtestCapture(_on: boolean): void {}
  async saveCloud<T>(_key: string, _value: T): Promise<void> {}
  async loadCloud<T>(_key: string): Promise<T | null> { return null; }
  async removeCloud(_key: string): Promise<void> {}
  async clearCloud(): Promise<void> {}
  async hasCloud(_key: string): Promise<boolean> { return false; }
  async getIdentity(): Promise<PlatformIdentity | null> { return null; }
  getSystemInfo(): PlatformSystemInfo {
      return { ...EMPTY_INFO };
    }
  async submitPlatformScore(_score: number): Promise<void> {}
  showLeaderboard(_id?: number | null): void {}
  playtestSetCanvas(_canvas: HTMLCanvasElement | HTMLCanvasElement[] | null): void {}
  captureError(_err: string | Error): void {}
  deviceCategory(): "mobile" | "tablet" | "desktop" | null { return null; }
  openExternalLink(_url: string): void {}
  async requestAccountLink(): Promise<boolean> { return false; }
  async getIapToken(): Promise<string | null> { return null; }
  isInstantMultiplayer(): boolean { return false; }
  getInviteParam(_name: string): string | null { return null; }
  getInviteParams(): InviteParams | null { return null; }
  onJoinRoom(_listener: (p: InviteParams) => void): () => void { return () => {}; }
  async inviteFriends(_params: InviteParams): Promise<string | null> { return null; }
  updateRoom(_opts: { roomId?: string; isJoinable?: boolean; inviteParams?: InviteParams }): void {}
  leftRoom(): void {}
  measure(_category: string, _label: string, _action: string): boolean { return false; }
  async share(_message: string, _params?: InviteParams): Promise<boolean> { return false; }
  syncSettings(): void {}
  isMuted(): boolean { return false; }
  getSettings(): { muteAudio: boolean; disableChat: boolean } { return { muteAudio: false, disableChat: false }; }
}

/** Named to match the real exports so TypeScript stays happy. Neither
 *  class reaches the browser at runtime for non-target builds. */
/**
 * Non-Poki stand-ins for the Poki leaderboard handshake. `vite.config.ts`
 * aliases `./poki` to this module for the crazy/generic/direct builds, so every
 * export platform.ts imports must exist here too — otherwise those bundles fail
 * to build ("pokiInitOptions is not exported by src/sdk/_shim.ts").
 */
export function pokiInitOptions(): { submitScore?: (submit: (leaderboard: string, score: number) => void) => void } {
  return {};
}

/**
 * The boot flag, deliberately a no-op.
 *
 * `platform.ts`'s boot path calls `markPokiBooted()` after `init()` resolves,
 * and it was the one export of `./poki` this shim was missing — so a build that
 * actually used the alias died at bundle time with "markPokiBooted is not
 * exported by src/sdk/_shim.ts" before it could reach the DCE this file exists
 * to enable. It has to stay a no-op and not flip any flag: a build that is not
 * the Poki target has no Poki SDK, and marking one booted would be a lie the
 * stub adapter would then believe.
 */
export function markPokiBooted(): void {}

export function pokiLeaderboardReady(): boolean {
  return false;
}

export function pokiSubmitScore(_score: number, _leaderboard?: string): boolean {
  return false;
}

export class PokiAdapter extends StubAdapter {
  constructor(events: PlatformEvents) { super(events, "poki"); }
}
