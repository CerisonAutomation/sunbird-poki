/** Portal payment adapter.
 *
 * Portal editions use an in-game coin economy and rewarded flights. Keeping a
 * separate build-time adapter means payment-provider code and URLs never ship
 * in Poki/CrazyGames bundles at all.
 */
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

export class MockAdProvider {
  readonly duration = 4;

  isAvailable(): boolean {
    return true;
  }
}
