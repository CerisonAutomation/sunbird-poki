/** Portal payment adapter.
 *
 * Portal editions use an in-game coin economy and rewarded flights. Keeping a
 * separate build-time adapter means payment-provider code and URLs never ship
 * in Poki/CrazyGames bundles at all.
 */
import { AD_DURATION } from "./constants";

export type Sku = "sunbird_gold" | "sunbird_vip" | "sunbird_starter";
export type PurchaseResult = { ok: true; receipt: string } | { ok: false; error: string };

export async function fetchServerEntitlements(_deviceId: string): Promise<Sku[]> {
  return [];
}

export class CoinPaymentProvider {
  async purchase(_sku: string): Promise<PurchaseResult> {
    return { ok: false, error: "Portal purchases use coins earned in flight." };
  }

  async restore(): Promise<string[]> {
    return [];
  }

  confirmManual(_sku: string): PurchaseResult {
    return { ok: false, error: "Portal purchases use coins earned in flight." };
  }
}

export class PlaceholderAdProvider {
  /** Same break length as the direct build — one constant, not two copies. */
  readonly duration = AD_DURATION;

  isAvailable(): boolean {
    return true;
  }
}
