/**
 * Legal editions — the privacy policy each build is allowed to carry.
 *
 * Poki's external-resources policy has two halves that are easy to satisfy
 * separately and easy to break together: the policy must be live on a public
 * page *and* reachable from inside the game, and a custom CSP can only be stored
 * once that URL is set. Meanwhile the portal isolation gate forbids one portal's
 * infrastructure appearing in another's bundle — which is why the policy is split
 * per edition instead of shared.
 *
 * These tests hold both halves at once:
 *
 *  - no edition's policy names a host or a portal that is not its own;
 *  - the public page composes every edition (it is the union, and it is not a
 *    bundle, so the isolation rule does not apply to it);
 *  - the host table is the single source for both the policy page and the CSP
 *    submission, so the two cannot disagree;
 *  - every portal build is configured with an absolute policy URL, because
 *    inside a portal iframe the game's own origin is the portal CDN.
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
import { LEGAL_EDITION as WEB } from "../legal.edition";
import { LEGAL_EDITION as CRAZY } from "../legal.edition.crazy";
import { LEGAL_EDITION as GENERIC } from "../legal.edition.generic";
import { LEGAL_EDITION as POKI } from "../legal.edition.poki";

const root = resolve(__dirname, "../../..");
const read = (p: string): string => readFileSync(resolve(root, p), "utf8");

/** Everything a player or a reviewer would read, flattened to one string. */
function policyText(doc: PolicyDocument): string {
  return JSON.stringify(doc);
}

const EDITIONS: Record<string, LegalEdition> = { web: WEB, poki: POKI, crazy: CRAZY, generic: GENERIC };

/** Hostnames that belong to a *different* portal — the leak this split exists to prevent. */
const FOREIGN: Record<string, RegExp> = {
  web: /poki\.(io|com)|crazygames\.com/i,
  poki: /crazygames\.com|sdk\.crazygames/i,
  crazy: /poki\.(io|com)|auds\.poki|netlib\.poki/i,
  generic: /poki\.(io|com)|crazygames\.com/i,
};

describe("edition isolation — the reason legal.ts was split", () => {
  it.each(Object.keys(EDITIONS))("%s edition names no foreign portal in its own policy", (id) => {
    const doc = composePolicy([EDITIONS[id]]);
    expect(policyText(doc)).not.toMatch(FOREIGN[id]);
  });

  it.each(Object.keys(EDITIONS))("%s edition's host table carries only its own edition id", (id) => {
    for (const host of EDITIONS[id].hosts) expect(host.edition, `${id} hosts ${host.host}`).toBe(id);
  });

  it("gives the generic edition no network services at all", () => {
    expect(GENERIC.hosts).toEqual([]);
    // A portal that is not Poki or CrazyGames gets a build that talks to nobody,
    // and the policy must say so rather than imply a service that is not there.
    expect(policyText(composePolicy([GENERIC]))).toMatch(/nothing|no network|not sent|on your device/i);
  });

  it("ships the direct build's policy with no portal infrastructure in it", () => {
    // `legal.ts` resolves `./legal.edition` to the web default outside a portal
    // build, so this is exactly what dist/ and the hosted page's direct section carry.
    expect(PRIVACY_POLICY).toEqual(composePolicy([WEB]));
    expect(EXTERNAL_HOSTS).toEqual(WEB.hosts);
    expect(policyText(PRIVACY_POLICY)).not.toMatch(/poki|crazygames/i);
  });
});

describe("the host table is the single source of truth", () => {
  it("puts every host in a CSP directive the submission can name", () => {
    const allowed = new Set(["script-src", "connect-src", "webrtc"]);
    for (const edition of Object.values(EDITIONS)) {
      for (const host of edition.hosts) {
        expect(allowed.has(host.directive), `${host.host} → ${host.directive}`).toBe(true);
        expect(host.purpose.trim().length, `${host.host} needs a reason`).toBeGreaterThan(12);
        expect(host.host, `${host.host} must be a bare host`).not.toMatch(/^https?:\/\//);
        expect(host.host).not.toMatch(/[/\s]/);
      }
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
    // The CSP request the developer pastes into Poki's dashboard is generated
    // from this table, so the submission cannot drift from the policy page.
    expect(read("scripts/gen-csp-request.ts")).toMatch(/legal\.edition\.poki/);
    expect(read("docs/poki/CSP_REQUEST.md")).toMatch(/turn\.rtc\.poki\.com/);
  });

  it("keeps every host of every edition on the public page (the union)", () => {
    const page = policyText(composePolicy([POKI, CRAZY, GENERIC, WEB]));
    for (const edition of Object.values(EDITIONS)) {
      for (const host of edition.hosts) expect(page, `${host.host} must appear on the public page`).toContain(host.host);
    }
  });

  it("labels each edition when more than one is composed", () => {
    const many = composePolicy([POKI, CRAZY, GENERIC, WEB]);
    for (const edition of [POKI, CRAZY, GENERIC, WEB]) {
      expect(policyText(many)).toContain(edition.label);
    }
    // A single-edition policy must NOT be labelled: on the page a player reads
    // inside one build, "Poki: …" prefixes would be noise at best and a leak of
    // another portal's name at worst.
    expect(policyText(composePolicy([POKI]))).not.toContain(`${POKI.label}: `);
  });
});

describe("the public page generator reads the same objects", () => {
  it("imports all four editions and composes them", () => {
    const src = read("scripts/gen-privacy-page.ts");
    for (const mod of ["legal.edition.poki", "legal.edition.crazy", "legal.edition.generic", "legal.edition"]) {
      expect(src, `${mod} must feed the public page`).toMatch(new RegExp(mod.replace(/\./g, "\\.")));
    }
    expect(src).toMatch(/composePolicy\(/);
  });

  it("renders a policy screen inside the game from the same document", () => {
    const hud = read("src/game/HUD.ts");
    expect(hud).toMatch(/function renderPrivacy\(/);
    expect(hud).toMatch(/PRIVACY_POLICY\b/);
    expect(hud).toMatch(/PRIVACY_POLICY_URL/);
  });
});

describe("portal builds point at a live, absolute policy URL", () => {
  it("every portal build script sets VITE_PRIVACY_URL to an https URL", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    for (const script of ["build:poki", "build:crazy", "build:generic"]) {
      const value = pkg.scripts[script]?.match(/VITE_PRIVACY_URL=(\S+)/)?.[1] ?? "";
      expect(value, `${script} must pin an absolute URL — inside a portal iframe the game's own origin is the portal CDN`).toMatch(/^https:\/\/\S+\/privacy$/);
    }
  });

  it("resolves a relative /privacy fallback only for direct builds", () => {
    // Unset in tests, so this exercises the non-portal path: a same-origin
    // absolute path, which is correct for dist/ and wrong for a portal iframe —
    // which is exactly why the portal builds pin the env var above.
    expect(privacyPolicyUrl()).toMatch(/^https?:\/\/|^\/privacy$/);
  });

  it("offers the hosted page through the portal's sanctioned external-link API only", () => {
    const hud = read("src/game/HUD.ts");
    // The button exists, but it is gated on a capability the deployed SDK must
    // advertise, so it can never be a dead button in a sandboxed iframe.
    expect(hud).toMatch(/portalExternalLink && \/\^https\?:/);
    expect(hud).toMatch(/data-action="open-privacy-url"/);
    const game = read("src/game/Game.ts");
    expect(game).toMatch(/case "open-privacy-url":/);
    expect(game).toMatch(/openExternalLink\(PRIVACY_POLICY_URL\)/);
    // Never a popup or a top-level navigation: both are banned in portal bundles.
    expect(game).not.toMatch(/window\.open\(/);
    expect(hud).not.toMatch(/target="_blank"/);
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

  it("keeps the shared sections identical across editions", () => {
    // What differs between editions is the four distribution-dependent sections
    // and the host table. Children's privacy, rights, security and the contact
    // block are one text, so a reviewer reading any edition sees the same
    // commitments.
    const sharedIds = ["on-device", "no-collection", "children", "rights", "security", "changes"];
    for (const edition of Object.values(EDITIONS)) {
      const doc = composePolicy([edition]);
      for (const id of sharedIds) {
        expect(doc.sections.find((s) => s.id === id), `${edition.id} keeps section ${id}`).toBeDefined();
      }
    }
  });

  // ---- deployment permissions may never exceed what the policy discloses ---
  it("the deployed CSP permits no origin the policy does not disclose", () => {
    const vercel = JSON.parse(read("vercel.json")) as {
      headers?: { headers?: { key?: string; value?: string }[] }[];
    };
    const csp = (vercel.headers ?? [])
      .flatMap((h) => h.headers ?? [])
      .find((h) => String(h.key).toLowerCase() === "content-security-policy")?.value;
    expect(csp, "vercel.json must still send a Content-Security-Policy").toBeTruthy();

    const declared = new Set(Object.values(EDITIONS).flatMap((e) => e.hosts.map((h) => h.host)));
    // Scheme-sources ('self', wss:, data:) need no disclosure; only host-sources
    // do, and a wildcard host is matched by its bare suffix.
    const permitted = new Set(
      String(csp)
        .split(";")
        .flatMap((directive) => directive.trim().split(/\s+/))
        .filter((token) => /^(https?|wss?):\/\//i.test(token))
        .map((token) => new URL(token).hostname.replace(/^\*\./, "")),
    );
    const undisclosed = [...permitted].filter((host) => !declared.has(host));
    expect(
      undisclosed,
      `vercel.json CSP allows origins absent from every legal edition: ${undisclosed.join(", ")}`,
    ).toEqual([]);
  });

  it("keeps the coin economy free of any payment-processor origin", () => {
    // `Payments.ts` returns null from every Stripe entry point, so no processor
    // origin belongs in the shipped client or in the deployment CSP. If one is
    // ever wired in, it has to be declared in an edition — which lands it on the
    // public page and in the CSP request — in the same commit.
    expect(read("src/game/Payments.ts")).not.toMatch(/stripe\.com/i);
    expect(read("vercel.json")).not.toMatch(/stripe\.com/i);
    expect(read("src/game/legal.edition.ts")).not.toMatch(/host: "[^"]*stripe[^"]*"/i);
  });

  it("names the controller and the game on every edition", () => {
    for (const edition of Object.values(EDITIONS)) {
      const doc = composePolicy([edition]);
      expect(doc.game).toBe("Sunbird");
      expect(doc.controller).toMatch(/CerisonAutomation/);
    }
  });

  it("hosts rows are what a reviewer can act on (host, purpose, directive)", () => {
    const shape: ExternalHost = POKI.hosts[0];
    expect(Object.keys(shape).sort()).toEqual(["directive", "edition", "host", "purpose"]);
  });
});
