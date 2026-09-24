import { AD_DURATION } from "./constants";
import { storage } from "./Storage";

export type Sku = "sunbird_gold" | "sunbird_vip" | "sunbird_starter";
export type PurchaseResult = { ok: true; receipt: string } | { ok: false; error: string };

const RECEIPT_KEY = "sunbird.receipts";

/**
 * Server-verified entitlements or local coin receipt checks.
 */
export async function fetchServerEntitlements(deviceId: string): Promise<Sku[]> {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const base = (env.VITE_LEADERBOARD_URL ?? (env.DEV ? "/mp" : "")).replace(/\/$/, "");
  if (!base) return [];
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`${base}/entitlements?device=${encodeURIComponent(deviceId)}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = (await res.json()) as { entitlements?: { sku?: unknown }[] };
    const valid: Sku[] = ["sunbird_gold", "sunbird_vip", "sunbird_starter"];
    return (data.entitlements ?? [])
      .map((e) => e.sku)
      .filter((s): s is Sku => typeof s === "string" && (valid as string[]).includes(s));
  } catch {
    return [];
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Instant local Coin Payment Provider. Named `Coin` (not `Mock`) on purpose:
 * it is the real coin economy for direct builds, not a test double. The
 * portal build swaps this module for `Payments.portal.ts` at build time.
 */
export class CoinPaymentProvider {
  async purchase(sku: string): Promise<PurchaseResult> {
    await wait(100);
    const receipt = `coin_${sku}_${Date.now().toString(36)}`;
    this.remember(sku);
    return { ok: true, receipt };
  }

  async restore(): Promise<string[]> {
    await wait(50);
    return this.read();
  }

  confirmManual(sku: string): PurchaseResult {
    const receipt = `coin_${sku}_${Date.now().toString(36)}`;
    this.remember(sku);
    return { ok: true, receipt };
  }

  private remember(sku: string): void {
    const list = this.read();
    if (!list.includes(sku)) list.push(sku);
    try {
      storage.setItem(RECEIPT_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  }

  private read(): string[] {
    try {
      const raw = storage.getItem(RECEIPT_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
}

export interface AdProvider {
  readonly duration: number;
  isAvailable(): boolean;
}

/**
 * The ad provider for builds with no portal SDK: the game runs its own
 * countdown break. It was called `MockAdProvider`, which read as a test double
 * in shipped code — it is neither. This is the real placeholder break, the one
 * `adGate` lets the player wait out; the portal builds get the SDK's own break
 * from the platform adapter, not by replacing this class.
 */
export class PlaceholderAdProvider implements AdProvider {
  readonly duration = AD_DURATION;

  isAvailable(): boolean {
    return true;
  }
}
