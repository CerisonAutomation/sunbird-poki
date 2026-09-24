/**
 * The CSP cross-check bites (rules `REQ-69`, `REQ-66`).
 *
 * `scripts/verify-csp.ts` compares the built Poki bundle with the host list we
 * ask Poki to allow. A verifier that cannot fail is decoration, and this one has
 * two opposite failure modes to avoid: crying wolf over minified code that merely
 * *contains* something shaped like a scheme, and staying quiet about a real
 * origin that the portal CSP would then block — the silent kind of broken, where
 * the game boots, looks healthy, and never reaches its boards or rooms.
 *
 * The fixtures here are the strings that actually occur in `dist-poki/`.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { crossCheckBundle, originsIn, REFERENCE_ONLY } from "../../../scripts/verify-csp";
import { LEGAL_EDITION } from "../legal.edition.poki";

const declared = LEGAL_EDITION.hosts.filter((h) => h.edition === "poki");
const PRIVACY = "sunbird-snowy.vercel.app";

const dir = mkdtempSync(join(tmpdir(), "sunbird-csp-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Write one fixture bundle and cross-check it. */
function check(files: Record<string, string>, requestDoc: string | null = [...declared.map((h) => h.host), PRIVACY].join("\n")) {
  const dist = mkdtempSync(join(dir, "dist-"));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dist, name), body);
  return crossCheckBundle({ distDir: dist, declared, privacyHost: PRIVACY, requestDoc });
}

describe("csp cross-check: origin extraction", () => {
  it("finds every scheme the Poki edition actually uses", () => {
    expect(originsIn(`script.src = "https://game-cdn.poki.com/scripts/v2/poki-sdk.js"`)).toEqual(["game-cdn.poki.com"]);
    expect(originsIn(`new WebSocket("wss://netlib.poki.io/v0/signaling")`)).toEqual(["netlib.poki.io"]);
    expect(originsIn(`fetch("https://auds.poki.io/v1/data")`)).toEqual(["auds.poki.io"]);
    expect(originsIn(`urls: "stun:stun.l.google.com:19302"`)).toEqual(["stun.l.google.com"]);
    expect(originsIn(`urls: "turns:turn.rtc.poki.com"`)).toEqual(["turn.rtc.poki.com"]);
    expect(originsIn(`<img src="//cdn.example.net/a.png">`)).toEqual(["cdn.example.net"]);
  });

  it("ignores the minified look-alikes that end in a scheme", () => {
    // Real strings from a minified three.js bundle: `ws:` inside "Shadows:" and
    // `turn:` inside "return:". Neither is a URL, and a false positive here would
    // train everyone to ignore the gate.
    expect(originsIn(`numSunLightShadows:C.sunShadowMap.length`)).toEqual([]);
    expect(originsIn(`if(a)return:t.flatMap(x=>x.length)`)).toEqual([]);
    expect(originsIn(`numDirectionalLightShadows:C.directionalShadowMap.length`)).toEqual([]);
    expect(originsIn(`httpStatus.ok&&httpsOk(t)`)).toEqual([]);
  });

  it("catches short hosts, so an origin cannot hide behind a two-label name", () => {
    expect(originsIn(`fetch("https://poki.com/anything")`)).toEqual(["poki.com"]);
    expect(originsIn(`fetch("https://telemetry.dev/collect")`)).toEqual(["telemetry.dev"]);
  });

  it("sees namespace identifiers but knows they are not requests", () => {
    expect(originsIn(`createElementNS("http://www.w3.org/2000/svg", m)`)).toEqual(["www.w3.org"]);
    expect(REFERENCE_ONLY.has("www.w3.org")).toBe(true);
  });
});

describe("csp cross-check: the bundle against the request", () => {
  it("passes when the bundle touches only declared hosts", () => {
    const result = check({
      "index.html": [
        `<script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>`,
        `new WebSocket("wss://netlib.poki.io/v0/signaling")`,
        `fetch("https://auds.poki.io/v1/data")`,
        `urls:["stun:stun.l.google.com:19302","turns:turn.rtc.poki.com"]`,
        `<a href="https://${PRIVACY}/privacy">Privacy</a>`,
      ].join("\n"),
    });
    expect(result.undeclared).toEqual([]);
    expect(result.unused).toEqual([]);
    expect(result.missingFromRequest).toEqual([]);
    expect(result.used).toHaveLength(declared.length + 1);
  });

  it("fails closed on an origin nobody declared", () => {
    const result = check({
      "index.html": `<script src="https://game-cdn.poki.com/sdk.js"></script>
        fetch("https://analytics.example.com/collect")`,
    });
    expect(result.undeclared.map((u) => u.host)).toContain("analytics.example.com");
    expect(result.undeclared[0]?.files.join()).toContain("index.html");
  });

  it("flags a declared host the bundle never uses — an over-broad request", () => {
    const result = check({
      "index.html": `fetch("https://auds.poki.io/v1/data")
        new WebSocket("wss://netlib.poki.io/v0/signaling")
        <script src="https://game-cdn.poki.com/sdk.js"></script>
        <a href="https://${PRIVACY}/privacy">Privacy</a>`,
    });
    expect(result.unused).toEqual(expect.arrayContaining(["stun.l.google.com", "turn.rtc.poki.com"]));
  });

  it("flags a host that never reached the submission document", () => {
    const stale = declared
      .filter((h) => h.host !== "auds.poki.io")
      .map((h) => h.host)
      .join("\n");
    expect(check({ "index.html": `<a href="https://${PRIVACY}/privacy">p</a>` }, stale).missingFromRequest).toContain(
      "auds.poki.io",
    );
    // No document at all is the same failure, for every host.
    expect(check({ "index.html": "" }, null).missingFromRequest.length).toBe(declared.length + 1);
  });

  it("does not accept policy prose as usage", () => {
    // privacy.html names every host in a sentence; a host that only appears there
    // is still dead weight in the request.
    const prose = declared.map((h) => `${h.host} — ${h.purpose}`).join("\n");
    const result = check({
      "index.html": `<a href="https://${PRIVACY}/privacy">Privacy</a>`,
      "privacy.html": prose,
    });
    expect(result.unused).toEqual(expect.arrayContaining(declared.map((h) => h.host)));
    expect(result.undeclared).toEqual([]);
  });
});

describe("csp cross-check: the allowlist itself", () => {
  it("never silences a host the game actually needs", () => {
    const real = [...declared.map((h) => h.host.toLowerCase()), PRIVACY];
    for (const host of REFERENCE_ONLY.keys()) {
      expect(real).not.toContain(host);
      expect(host).not.toMatch(/poki|netlib|auds|vercel|google|crazygames/i);
    }
  });
});
