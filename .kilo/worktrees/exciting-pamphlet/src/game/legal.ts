/**
 * Sunbird legal surfaces — ONE source of truth.
 *
 * The privacy policy is data here, not prose copy-pasted into two places:
 *   • `scripts/gen-privacy-page.ts` renders `public/privacy.html` from it, so
 *     the page a platform's Settings → General field points at is generated
 *     from the same object the game renders;
 *   • the in-game Settings → Privacy screen renders the same sections, which is
 *     what an external-resources policy means by "linked inside the game" — and
 *     it keeps working when a portal blocks popups or the player is offline.
 *
 * Content is derived from `LEGAL_SECURITY.md` §1.2 (the EU data-protection
 * register). If a data flow changes there, it changes here — closing the old
 * gap **L-1 "no public privacy policy"**.
 *
 * ── Editions ────────────────────────────────────────────────────────────────
 * A privacy policy that names every distribution target is wrong twice over:
 * it tells a player about infrastructure their build never touches, and it puts
 * a competitor portal's name (and host names) into a bundle where
 * `scripts/verify-portal.mjs` correctly refuses to ship it. So the sections
 * that actually differ — multiplayer, analytics, payments, retention and the
 * external-host table — live in `legal.edition*.ts`, one file per target,
 * swapped at build time by the portal-alias plugin in `vite.config.ts` (the
 * same mechanism `edition.ts` and `Payments.portal.ts` already use).
 *
 * The hosted public page is the union: `scripts/gen-privacy-page.ts` imports
 * every edition and calls `composePolicy([...])`, so a reviewer reading the URL
 * sees all four disclosures labelled, while each bundle carries only its own.
 *
 * Language: the policy body ships in English on purpose. Machine-translating a
 * legal instrument into 36 languages creates 36 documents that can each be read
 * as saying something slightly different; a single authoritative text with a
 * translated *pointer* to it is the honest version. The pointer is localized
 * (`hud.settings.privacy`, `hud.settings.privacy.hint`).
 */
import { LEGAL_EDITION } from "./legal.edition";

/** Bumped whenever a data flow in this document changes. Shown on the page. */
export const PRIVACY_POLICY_VERSION = "2026-09-23";

/**
 * Canonical public URL of the hosted policy.
 *
 * Portal builds must carry an absolute URL — inside a portal iframe the game's
 * own origin is the portal CDN, so a relative `/privacy` would 404. Direct/web
 * builds leave `VITE_PRIVACY_URL` empty and resolve against the page origin,
 * which is correct for every deployment (preview, staging, production) without
 * hardcoding a host.
 *
 * Read defensively (`import.meta.env` does not exist under plain `tsx`), which
 * is why this file avoids the `VITE_PORTAL_TARGET` comparison idiom the SDK
 * modules use for build-time folding: the edition split does that job instead.
 */
const ENV = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

export function privacyPolicyUrl(): string {
  const configured = (ENV.VITE_PRIVACY_URL ?? "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  try {
    if (typeof location !== "undefined" && /^https?:$/.test(location.protocol)) {
      return `${location.origin}/privacy`;
    }
  } catch {
    /* sandboxed iframe with an opaque origin — fall through */
  }
  return "/privacy";
}

/** Stable alias for call sites that only need the string. */
export const PRIVACY_POLICY_URL = privacyPolicyUrl();

export type PolicySection = {
  /** Stable id — used as the HTML anchor and the in-screen nav. */
  id: string;
  heading: string;
  /** Paragraphs. Plain text; the renderer escapes it. */
  body: string[];
  /** Optional tabular detail: [label, value] rows. */
  rows?: [string, string][];
};

export type PolicyDocument = {
  title: string;
  game: string;
  version: string;
  controller: string;
  summary: string[];
  sections: PolicySection[];
  contact: { label: string; value: string }[];
};

/** One external host this policy names, with the reason it is contacted. */
export type ExternalHost = {
  host: string;
  purpose: string;
  /** CSP directive the host belongs in (`script-src`, `connect-src`, `webrtc`). */
  directive: string;
  /** Which build target the host belongs to. */
  edition: string;
};

/**
 * The per-edition half of the policy: the four sections whose contents depend
 * on where the game is distributed, plus the host table the CSP request and the
 * policy page must agree on.
 */
export type LegalEdition = {
  id: "web" | "poki" | "crazy" | "generic";
  /** Human label, used when more than one edition is composed into one page. */
  label: string;
  multiplayer: { body: string[]; rows: [string, string][] };
  analytics: { body: string[] };
  payments: { body: string[]; rows: [string, string][] };
  retention: { body: string[] };
  hosts: ExternalHost[];
};

/* ------------------------------------------------------------ shared prose */

const SUMMARY = [
  "Sunbird is built so that almost nothing about you has to leave your device. This page states exactly what is stored, what can be sent, when, and to whom — including the cases where nothing is sent at all.",
  "Short version: no account, no email, no real name, no cookies, no advertising trackers, no chat, and no precise location. Progress lives in your browser's own storage. A random, made-up pilot name and a random device code are the only identifiers the game can create, and neither points back to you.",
];

const ON_DEVICE: PolicySection = {
  id: "on-device",
  heading: "1. What stays on your device",
  body: [
    "The game saves your progress in your browser's local storage (falling back to session storage, then to memory, when a site blocks it — for example when the game runs inside another website's frame). This is strictly functional storage: it is what makes the game remember you between visits, and it is required to deliver the service you asked for.",
    "None of this is transmitted anywhere by the game itself. It leaves your device only if you choose to export it yourself, as a save code you copy and paste.",
  ],
  rows: [
    ["Game progress", "Scores, coins, unlocks, missions, season and career state"],
    [
      "Preferences",
      "Sound and music volume, language, distance unit, comfort options (reduce motion, colourblind assist, large text), render quality",
    ],
    ["Pilot identity", "A pilot name — chosen by you, or generated for you — capped at 14 characters"],
    ["Device code", "A random 64-character string generated on your device. It is not a fingerprint and cannot identify you"],
    ["Crash journal", "Up to 5 redacted error records, used to diagnose failures. No personal data is captured in them"],
    ["Purchase references", "Receipt identifiers only, so an entitlement can be restored. Card details never touch the game"],
  ],
};

const NO_COLLECTION: PolicySection = {
  id: "no-collection",
  heading: "2. What Sunbird never collects",
  body: [
    "The following are absent by construction, not by configuration. There is no code path in the game that would collect them:",
  ],
  rows: [
    ["Name, email, phone, address", "Never requested. There is no account system and no sign-in"],
    ["Cookies and tracking pixels", "None are set or read anywhere in the game"],
    ["Precise location", "Never requested. The browser geolocation permission is explicitly disabled"],
    ["Camera and microphone", "Never requested; both are explicitly disabled by the site's permissions policy"],
    [
      "Device fingerprinting",
      "Not performed. Hardware capability is probed only to pick a graphics quality tier, and the result stays on the device",
    ],
    ["Chat and user messages", "No text chat exists. Player expression is limited to a fixed set of emotes"],
    ["Profiling and automated decisions", "None. There is no behavioural scoring and no advertising inside the game build"],
  ],
};

const CHILDREN: PolicySection = {
  id: "children",
  heading: "6. Children",
  body: [
    "Sunbird is an all-ages game. It collects no personal information from anyone, which includes children: there is no registration, no contact capture, no behavioural data and no advertising inside the game build. Portals that host the game apply their own age and consent policies on top of this.",
  ],
};

const RIGHTS: PolicySection = {
  id: "rights",
  heading: "8. Your rights, and how to exercise them",
  body: [
    "Depending on where you live you may have rights of access, portability, rectification, erasure, restriction and objection. Because the game holds almost nothing about you, most of these are self-service:",
  ],
  rows: [
    [
      "Get a copy of your data",
      "Settings → Account → export a save code. That text is a complete copy of everything the game stores on your device",
    ],
    ["Delete your data", "Settings → Manage saved progress → reset. This erases the device-side save"],
    ["Correct your data", "Settings → pilot name (where the edition allows editing)"],
    [
      "Delete backend data",
      "Write to the contact below with your pilot name and device code. Because there is no account system, those two values are how a record is located",
    ],
    ["Object to analytics", "Aggregate counters are anonymous and cannot be tied to you; in portal editions they are disabled outright"],
    [
      "Withdraw consent",
      "No consent-gated processing exists. Everything the game does is either strictly functional storage or, in portal editions, nothing",
    ],
  ],
};

const SECURITY: PolicySection = {
  id: "security",
  heading: "9. Security",
  body: [
    "All network traffic is HTTPS or secure WebSocket. Every string that other players can influence is escaped before it is displayed, and is additionally stripped of markup server-side before it is stored. Requests are rate-limited and size-capped, and no secret is ever embedded in the game bundle.",
  ],
};

const CHANGES: PolicySection = {
  id: "changes",
  heading: "10. Changes to this policy",
  body: [
    "If a data flow changes, this document changes with it and the version date below is updated. The policy is always reachable from inside the game at Settings → Privacy Policy, so a change is visible to players without them having to find a webpage.",
  ],
};

const CONTACT = [
  { label: "Data controller", value: "CerisonAutomation" },
  { label: "Game", value: "Sunbird" },
  { label: "Policy version", value: PRIVACY_POLICY_VERSION },
  {
    label: "Requests",
    value:
      "Open an issue on the project's public repository, or use the contact details published with the game's store listing. Include your pilot name and device code so a record can be located.",
  },
];

/* --------------------------------------------------------------- composing */

/**
 * Builds the policy document from one or more editions.
 *
 * With a single edition (every shipped bundle) the sections read as one plain
 * document. With several (the hosted page) each edition's contribution is
 * labelled, so a reader can see which disclosure belongs to the build they are
 * actually playing without the game shipping anybody else's host names.
 */
export function composePolicy(editions: LegalEdition[]): PolicyDocument {
  const list = editions.length ? editions : [LEGAL_EDITION];
  const many = list.length > 1;
  const label = (e: LegalEdition, text: string): string => (many ? `${e.label}: ${text}` : text);

  const multiplayer: PolicySection = {
    id: "multiplayer",
    heading: "3. Multiplayer",
    body: [
      "When you join a race against other players, the minimum needed to run that race is exchanged. What that means depends on the edition of the game you are playing.",
      ...list.flatMap((e) => e.multiplayer.body.map((p) => label(e, p))),
    ],
    rows: list.flatMap((e) => e.multiplayer.rows.map(([k, v]) => [many ? `${k} (${e.label})` : k, v] as [string, string])),
  };

  const analytics: PolicySection = {
    id: "analytics",
    heading: "4. Analytics and diagnostics",
    body: list.flatMap((e) => e.analytics.body.map((p) => label(e, p))),
  };

  const payments: PolicySection = {
    id: "payments",
    heading: "5. Payments",
    body: list.flatMap((e) => e.payments.body.map((p) => label(e, p))),
    rows: list.flatMap((e) => e.payments.rows.map(([k, v]) => [many ? `${k} (${e.label})` : k, v] as [string, string])),
  };

  // A declared host is rendered into the document here, so the disclosure can
  // never silently lag the host table: adding an origin to `legal.edition*.ts`
  // publishes it on the policy page AND on the portal CSP request
  // (`scripts/gen-csp-request.ts` reads the same array) in one commit.
  const security: PolicySection = {
    ...SECURITY,
    rows: list.flatMap((e) =>
      e.hosts.map(
        (h) =>
          [
            many ? `External origin (${e.label})` : "External origin",
            `${h.host} — ${h.purpose} (permitted by ${h.directive})`,
          ] as [string, string],
      ),
    ),
  };

  const retention: PolicySection = {
    id: "retention",
    heading: "7. How long data is kept",
    body: [
      "Data on your device is kept until you delete it — through Settings → Manage saved progress, or by clearing your browser's storage.",
      ...list.flatMap((e) => e.retention.body.map((p) => label(e, p))),
    ],
  };

  return {
    title: "Privacy Policy",
    game: "Sunbird",
    version: PRIVACY_POLICY_VERSION,
    controller: "CerisonAutomation (the developer of Sunbird)",
    summary: SUMMARY,
    sections: [ON_DEVICE, NO_COLLECTION, multiplayer, analytics, payments, CHILDREN, retention, RIGHTS, security, CHANGES],
    contact: CONTACT,
  };
}

/** This build's policy: the shared sections plus this edition's disclosures. */
export const PRIVACY_POLICY: PolicyDocument = composePolicy([LEGAL_EDITION]);

/**
 * Every external host THIS build names, with the reason it is contacted.
 * Consumed by `scripts/gen-csp-request.ts`, so the Content-Security-Policy request
 * and the policy page can never disagree about what the game talks to.
 */
export const EXTERNAL_HOSTS: ExternalHost[] = LEGAL_EDITION.hosts;
