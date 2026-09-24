import { describe, expect, it } from "vitest";
import { entitlementFromEvent, parseStripeSignature, verifyStripeSignature } from "../../../backend/src/entitlements";

async function sign(secret: string, t: number, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("stripe signature verification", () => {
  const secret = "whsec_test_secret";
  const body = '{"type":"checkout.session.completed"}';

  it("accepts a valid signature within tolerance", async () => {
    const t = 1_700_000_000;
    const v1 = await sign(secret, t, body);
    expect(await verifyStripeSignature(secret, `t=${t},v1=${v1}`, body, t + 60)).toBe(true);
  });

  it("rejects a stale timestamp (replay window)", async () => {
    const t = 1_700_000_000;
    const v1 = await sign(secret, t, body);
    expect(await verifyStripeSignature(secret, `t=${t},v1=${v1}`, body, t + 301)).toBe(false);
  });

  it("rejects a tampered body", async () => {
    const t = 1_700_000_000;
    const v1 = await sign(secret, t, body);
    expect(await verifyStripeSignature(secret, `t=${t},v1=${v1}`, body + " ", t)).toBe(false);
  });

  it("rejects a wrong secret, missing header, malformed header", async () => {
    const t = 1_700_000_000;
    const v1 = await sign("whsec_other", t, body);
    expect(await verifyStripeSignature(secret, `t=${t},v1=${v1}`, body, t)).toBe(false);
    expect(await verifyStripeSignature(secret, null, body, t)).toBe(false);
    expect(await verifyStripeSignature(secret, "garbage", body, t)).toBe(false);
  });

  it("accepts when any v1 entry matches (Stripe key rotation)", async () => {
    const t = 1_700_000_000;
    const good = await sign(secret, t, body);
    const bad = await sign("whsec_rotated_away", t, body);
    expect(await verifyStripeSignature(secret, `t=${t},v1=${bad},v1=${good}`, body, t)).toBe(true);
  });

  it("parses the header format Stripe documents", () => {
    const p = parseStripeSignature("t=1699999999,v1=abc,v1=def,v0=ignored");
    expect(p.t).toBe(1_699_999_999);
    expect(p.v1).toEqual(["abc", "def"]);
  });
});

describe("entitlement mapping", () => {
  const session = (over: Record<string, unknown>) => ({
    type: "checkout.session.completed",
    data: { object: { id: "cs_1", client_reference_id: "dev123", amount_total: 299, payment_status: "paid", ...over } },
  });

  it("maps paid sessions to SKUs by amount", () => {
    expect(entitlementFromEvent(session({}))!.sku).toBe("sunbird_gold");
    expect(entitlementFromEvent(session({ amount_total: 199 }))!.sku).toBe("sunbird_vip");
    expect(entitlementFromEvent(session({ amount_total: 99 }))!.sku).toBe("sunbird_starter");
    expect(entitlementFromEvent(session({}))!.deviceId).toBe("dev123");
  });

  it("rejects unpaid, unknown-amount, missing-reference, wrong-type events", () => {
    expect(entitlementFromEvent(session({ payment_status: "unpaid" }))).toBeNull();
    expect(entitlementFromEvent(session({ amount_total: 12345 }))).toBeNull();
    expect(entitlementFromEvent(session({ client_reference_id: null }))).toBeNull();
    expect(entitlementFromEvent({ type: "invoice.paid", data: { object: {} } })).toBeNull();
  });
});
