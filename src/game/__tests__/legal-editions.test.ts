/**
 * Legal edition — the Poki build's privacy policy.
 *
 * Checks:
 *  - the host table is the single source for both the public page and the CSP
 *    submission, so the two cannot disagree;
 *  - the build is configured with an absolute policy URL (portal iframe has no
 *    access to the game's own origin).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PRIVACY_POLICY,
  PRIVACY_POLICY_VERSION,
  TERMS_URL,
  composePolicy,
  privacyPolicyUrl,
  type ExternalHost,
} from "../legal";
import { LEGAL_EDITION as POKI } from "../legal.edition";

const root = resolve(__dirname, "../../..");
const read = (p: string): string => readFileSync(resolve(root, p), "utf8");

describe("host table is the single source of truth", () => {
  it("puts every host in a CSP directive the submission can name", () => {
    const allowed = new Set(["script-src", "connect-src", "webrtc"]);
    for (const host of POKI.hosts) {
      expect(allowed.has(host.directive), `${host.host} → ${host.directive}`).toBe(true);
      expect(host.purpose.trim().length, `${host.host} needs a reason`).toBeGreaterThan(12);
      expect(host.host, `${host.host} must be a bare host`).not.toMatch(/^https?:\/\//);
      expect(host.host).not.toMatch(/[/\s]/);
    }
  });

  it("lists Poki's five hosts: SDK, signalling, TURN, STUN, AUDS", () => {
    const hosts = POKI.hosts.map((h) => h.host).sort();
    expect(hosts).toEqual([
      "auds.poki.io",
      "game-cdn.poki.com",
      "netlib.poki.io",
      "stun.l.google.com",
      "turn.rtc.poki.com",
    ]);
    expect(read("scripts/gen-csp-request.ts")).toMatch(/legal\.edition/);
    expect(read("docs/poki/CSP_REQUEST.md")).toMatch(/turn\.rtc\.poki\.com/);
  });

  it("hosts rows are what a reviewer can act on (host, purpose, directive)", () => {
    const shape: ExternalHost = POKI.hosts[0];
    expect(Object.keys(shape).sort()).toEqual(["directive", "edition", "host", "purpose"]);
  });
});

describe("document shape", () => {
  it("is versioned with a date and has ten uniquely-identified sections", () => {
    expect(PRIVACY_POLICY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(PRIVACY_POLICY.version).toBe(PRIVACY_POLICY_VERSION);
    const ids = PRIVACY_POLICY.sections.map((s) => s.id);
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("names the controller and the game", () => {
    const doc = composePolicy([POKI]);
    expect(doc.game).toBe("Sunbird");
    expect(doc.controller).toMatch(/CerisonAutomation/);
  });
});

describe("the policy link is absolute, wherever it comes from", () => {
  // Inside a portal iframe the game's own origin is the portal CDN, so a
  // relative "/privacy" resolves against Poki and not against us. What protects
  // the player is the URL that SHIPS, so that is what these assert — not which
  // file happened to set it.
  //
  // These used to grep `build:poki` for `VITE_PRIVACY_URL=...`. That failed
  // while the shipped URL was already absolute, because the absolute value is
  // the default in `src/game/legal.ts` rather than a build-script argument: a
  // test that passed only by duplicating the constant into package.json. Two
  // homes for one value is exactly how the Poki build ids rotted before, so the
  // constant stays in one place and the contract is asserted on the outcome.
  it("resolves to an absolute https URL", () => {
    expect(privacyPolicyUrl()).toMatch(/^https:\/\/\S+/);
  });

  it("keeps the terms link on the same absolute host", () => {
    // Terms is derived by swapping the leaf, so a relative privacy URL would
    // silently produce a relative terms URL too.
    expect(TERMS_URL).toMatch(/^https:\/\/\S+/);
  });

  it("rejects a relative override, should one ever be configured", () => {
    // Guards the seam: if a build or a Vercel env later sets VITE_PRIVACY_URL,
    // it must still be absolute. A bare path here would pass the two tests
    // above only because the default would then be overridden.
    const configured = (read(".env.example").match(/^#?\s*VITE_PRIVACY_URL=(.+)$/m)?.[1] ?? "").trim();
    if (configured) expect(configured).toMatch(/^https:\/\/\S+/);
  });
});
