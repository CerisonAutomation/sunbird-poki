import { backendBase } from "./apiBase";
import { AD_DURATION } from "./constants";
import { storage } from "./Storage";

export type Sku = "sunbird_gold" | "sunbird_vip" | "sunbird_starter";
export type PurchaseResult = { ok: true; receipt: string } | { ok: false; error: string };

const RECEIPT_KEY = "sunbird.receipts";

// There is no payment provider in this build. Four stubs (`ensureStripeJs`,
// `stripeConfigured`, `stripeLinkFor`, `consumeStripeReturn`) used to sit here
// returning null/false as a "we removed Stripe" marker; nothing called them, and
// a function named `ensureStripeJs` that returns null is an invitation to wire it
// back up. The economy is coins (`CoinPaymentProvider`) plus server-verified
// entitlements below. `scripts/audit-zips.mjs` and `scripts/verify-portal.mjs`
// still fail a portal build that contains the word, so the guard outlives the
// code it was guarding.

/**
 * Server-verified entitlements or local coin receipt checks.
 */
export async function fetchServerEntitlements(deviceId: string): Promise<Sku[]> {
  // Entitlements live under `/mp` — see `apiBase.ts` for the prefix contract.
  const base = backendBase("/mp");
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

export class MockAdProvider implements AdProvider {
  readonly duration = AD_DURATION;

  isAvailable(): boolean {
    return true;
  }
}
