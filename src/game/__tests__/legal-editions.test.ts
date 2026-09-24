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
  EXTERNAL_HOSTS,
  PRIVACY_POLICY,
  PRIVACY_POLICY_VERSION,
  composePolicy,
  privacyPolicyUrl,
  type ExternalHost,
  type LegalEdition,
  type PolicyDocument,
} from "../legal";
import { LEGAL_EDITION as POKI } from "../legal.edition";

const root = resolve(__dirname, "../../..");
const read = (p: string): string => readFileSync(resolve(root, p), "utf8");

function policyText(doc: PolicyDocument): string {
  return JSON.stringify(doc);
}

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

describe("portal build points at a live, absolute policy URL", () => {
  it("build:poki sets VITE_PRIVACY_URL to an https URL", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    const value = pkg.scripts["build:poki"]?.match(/VITE_PRIVACY_URL=(\S+)/)?.[1] ?? "";
    expect(value, "build:poki must pin an absolute URL — inside a portal iframe the game's own origin is the portal CDN").toMatch(
      /^https:\/\/\S+\/privacy$/,
    );
  });

  it("resolves a relative /privacy fallback for local dev", () => {
    expect(privacyPolicyUrl()).toMatch(/^https?:\/\/|^\/privacy$/);
  });
});
