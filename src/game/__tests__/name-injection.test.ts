import { afterEach, describe, expect, it } from "vitest";

import { isPilotNameClean, moderatePilotName } from "../pilotNameModeration";
import { savePilotName } from "../Leaderboard";
import { storage } from "../Storage";

/**
 * Pilot names are the one piece of genuinely untrusted text this game handles.
 *
 * A name can arrive from a PORTAL ACCOUNT — i.e. it is someone else's username
 * on someone else's platform — and it is then broadcast to strangers over P2P
 * netlib rooms and rendered into the roster, the board, the lobby and the
 * nametags. That makes it a real injection surface, not a theoretical one.
 *
 * The codebase defends it twice, and these pin both layers because either one
 * alone is a defence that could be refactored away by someone who did not know:
 *
 *   1. INPUT  — `savePilotName` keeps only letters, numbers, space, `_ . -`.
 *   2. OUTPUT — every render site wraps the value in `escapeHtml`.
 *
 * Layer 1 alone is what makes this safe today: `<script>` cannot survive the
 * character filter at all. Layer 2 is what makes it safe if layer 1 is ever
 * widened, which is exactly the refactor that would reintroduce the risk.
 */
afterEach(() => {
  try {
    for (const k of ["sunbird.name", "sunbird.pilotName"]) storage.removeItem(k);
  } catch {
    /* private mode */
  }
});

const ATTACKS = [
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  "'><svg onload=alert(1)>",
  '<iframe src=javascript:alert(1)>',
  'javascript:alert(1)',
  '"><body onload=alert(1)>',
  '${alert(1)}',
  '`${alert(1)}`',
  '<a href="javascript:alert(1)">x</a>',
];

describe("name input filter — layer 1", () => {
  it("strips every character that could open a tag or an attribute", () => {
    for (const attack of ATTACKS) {
      const clean = savePilotName(attack);
      expect(clean, `${attack} -> ${clean}`).not.toMatch(/[<>"'`\\]/);
    }
  });

  it("never returns the attack verbatim", () => {
    for (const attack of ATTACKS) {
      expect(savePilotName(attack), attack).not.toBe(attack);
    }
  });

  it("returns something clean and non-empty for every attack", () => {
    for (const attack of ATTACKS) {
      const clean = savePilotName(attack);
      expect(clean.length, attack).toBeGreaterThan(0);
      expect(isPilotNameClean(clean), `${attack} -> ${clean}`).toBe(true);
    }
  });

  it("keeps ordinary international names intact — the filter is not a blocklist", () => {
    // A filter that only knew about ASCII would quietly destroy the 36 locales
    // this game ships, and the name is the player's identity in every one.
    // All at or above PILOT_NAME_MIN (3) — a shorter name is replaced for
    // length, not for its script, and that is a separate rule with its own test.
    for (const name of ["Rook", "Пётр", "太陽様", "小白龍", "김치맨", "Ísland", "Zoë-99", "a_b.c"]) {
      expect(savePilotName(name), name).toBe(name);
    }
  });
});

describe("name moderation — the trust rule", () => {
  it("rejects blocked language with the honest reason, not a generic failure", () => {
    expect(moderatePilotName("fuck")).toEqual({ ok: false, reason: "language" });
  });

  it("rejects contact details before charset, so the reason is accurate", () => {
    // A "@handle" is a contact detail, not a shape problem; telling a player
    // "letters, numbers, spaces" when the real issue is an @ is a lie that
    // sends them to fix the wrong thing.
    expect(moderatePilotName("rider@example")).toEqual({ ok: false, reason: "contact" });
  });

  it("rejects a URL-shaped name for the same reason", () => {
    expect(moderatePilotName("sunbird.gg/pro").ok).toBe(false);
  });

  it("requires a real length and two letters, so punctuation is not a name", () => {
    expect(moderatePilotName("ab").ok).toBe(false);        // under the minimum
    // A two-character CJK name is rejected for LENGTH, not for its script —
    // worth pinning, because "3 characters" is a much longer name in Japanese
    // or Chinese than it is in English, and someone widening the charset
    // filter could mistake that for a script problem.
    expect(moderatePilotName("太陽")).toEqual({ ok: false, reason: "shape" });
    expect(moderatePilotName("123456").ok).toBe(false);    // digits only
    expect(moderatePilotName("...").ok).toBe(false);       // punctuation only
  });
});
