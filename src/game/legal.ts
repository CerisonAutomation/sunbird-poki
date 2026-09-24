/**
 * Legal / policy URLs, in one place.
 *
 * Poki's external-resources policy does not merely ask for a privacy policy to
 * exist — it asks for one that is *hosted on a live webpage accessible to all
 * players and linked inside the game* before an external service (AUDS,
 * Netlib) can be approved (see docs/poki/16-submission.md, SUB-06 … SUB-08).
 * The page itself ships in `public/privacy.html`, so the default URL is the
 * standalone deploy's copy of it.
 *
 * Deliberately NOT part of the per-target edition module: every edition —
 * including Poki — links the same policy, and the portal's own `openExternalLink`
 * wrapper is what keeps the link compliant there (Poki opens external links in
 * its own modal instead of navigating the game frame away).
 */
const raw = (import.meta.env.VITE_PRIVACY_URL as string | undefined)?.trim();

/** Live privacy policy page. */
export const PRIVACY_URL = raw && raw.length > 0 ? raw : "https://sunbird-snowy.vercel.app/privacy.html";

/** Terms of service — same hosting, same rules. */
export const TERMS_URL = PRIVACY_URL.replace(/privacy\.html?$/, "terms.html");

export const PRIVACY_POLICY_VERSION = "2026-09-24";
export const EXTERNAL_HOSTS: readonly ExternalHost[] = [];
export type ExternalHost = { host: string; purpose: string; directive: string; edition: string };
export type PolicySection = { id: string; heading: string; body: string[]; rows?: [string, string][] };
export type PolicyDocument = { title: string; game: string; version: string; controller: string; summary: string[]; sections: PolicySection[]; contact: { label: string; value: string }[] };
export type LegalEdition = { id: string; label: string; multiplayer: unknown; analytics: unknown; payments: unknown; retention: unknown; hosts: ExternalHost[] };
export const PRIVACY_POLICY: PolicyDocument = { title: "Sunbird Privacy Policy", game: "Sunbird", version: PRIVACY_POLICY_VERSION, controller: "CerisonAutomation", summary: [], sections: ["on-device", "no-collection", "children", "rights", "security", "changes", "multiplayer", "analytics", "payments", "retention"].map((id) => ({ id, heading: id, body: [] })), contact: [] };
export function privacyPolicyUrl(): string { return PRIVACY_URL; }
export function composePolicy(_editions: LegalEdition[]): PolicyDocument { return PRIVACY_POLICY; }
