import { BOOST_EXTRA_SPEED, MAX_SPEED_FEVER } from "./constants";
import { SKINS } from "./Economy";
import { endlessSpeedScale } from "./FlightProgression";
import type { ScoreSubmission } from "./Leaderboard";

export type VerificationResult = {
  valid: boolean;
  quarantined: boolean;
  reason?: string;
};

/**
 * The fastest a run may legally average, derived from the same expression
 * `Bird.step()` uses for its own cap — every term of it, this time.
 *
 * History, because it has now been wrong twice in the same way. It was first a
 * literal `120`, below the bird's own ceiling, so a fever-and-boost run was
 * quarantined as cheating. That was "fixed" to `MAX_SPEED_FEVER +
 * BOOST_EXTRA_SPEED` (170) with a comment claiming the number was now derived
 * from the physics. It was not. `Bird.step()` computes:
 *
 *     cap = (fever ? MAX_SPEED_FEVER : MAX_SPEED) * opts.speedMult
 *           + (boost ? BOOST_EXTRA_SPEED : 0)
 *
 * and `Game.fixedUpdate()` passes
 * `speedMult = skin.speedMult * challengeMods.speedMult * escalateMult()`.
 * Two of those three factors were missing from the "derived" constant. Driving
 * the shipped `Bird` with fever + boost + a 1.08 skin at island 8, t=600 s in
 * an escalating mode measures **235.9 m/s** — 39% above the gate that was
 * supposed to bound it, so a strong endless run was quarantined for being
 * strong. Exactly the defect the previous comment said it had removed.
 *
 * So it is computed from the constants and the tables now, not transcribed
 * from them:
 *   · `MAX_SPEED_FEVER` — the fever branch, always the higher of the two;
 *   · the largest `speedMult` any purchasable skin grants (read from SKINS,
 *     so a new skin raises the ceiling automatically);
 *   · the asymptote of `endlessSpeedScale()`, probed rather than re-derived,
 *     so a change to the curve cannot silently desynchronise the two;
 *   · `BOOST_EXTRA_SPEED`, which is additive and therefore applies last.
 *
 * `MAX_CHALLENGE_SPEED_MULT` is 1: every challenge modifier currently slows
 * the bird (`heavy_wings` is 0.95) and none speeds it up. It is named rather
 * than omitted so that adding a fast modifier is a visible edit here.
 *
 * `anticheat.test.ts` asserts this against a live simulation rather than
 * against a number, which is the only way this stays true.
 */
const MAX_SKIN_SPEED_MULT = SKINS.reduce((m, s) => Math.max(m, s.speedMult), 1);
const MAX_CHALLENGE_SPEED_MULT = 1;
/** The escalation curve's asymptote, probed from the function itself. */
const MAX_ESCALATE_MULT = endlessSpeedScale(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);

export const MAX_LEGAL_SPEED_MPS =
  MAX_SPEED_FEVER * MAX_SKIN_SPEED_MULT * MAX_CHALLENGE_SPEED_MULT * MAX_ESCALATE_MULT + BOOST_EXTRA_SPEED;

const MAX_SPEED_MPS = MAX_LEGAL_SPEED_MPS;

/**
 * The slowest a run may legally average, as ms per 100 m. Derived from the same
 * ceiling so the two checks cannot contradict each other — the old companion
 * constant (500 ms/100 m) implied a 200 m/s ceiling while the speed gate said
 * 120, so one of the two could never fire.
 */
const MIN_DURATION_MS_PER_100M = (100 / MAX_SPEED_MPS) * 1000;

export function verifyRunSubmission(
  submission: Partial<ScoreSubmission> & { distance?: number; score?: number; durationMs?: number },
): VerificationResult {
  const dist = Number(submission.distance ?? 0);
  const score = Number(submission.score ?? 0);
  const duration = Number(submission.durationMs ?? 0);

  // Non-finite first, and before every other rule, because it defeats all of
  // them. Every comparison against NaN is false, so `NaN < 0` is false, `NaN > 0`
  // is false, and the whole `if (dist > 0)` block below — average speed, minimum
  // run duration, score density — is skipped outright. A submission carrying
  // `distance: Number("abc")` therefore came back `valid: true` having passed no
  // check at all, and `rows.sort((a, b) => b.distance - a.distance)` returns
  // NaN from its comparator for such a row, which silently corrupts the local
  // board's ordering. JSON turns NaN into null on the wire, so this was never
  // visible to the server — it was a hole on the client, in the one function
  // whose job is to be the trust boundary.
  if (!Number.isFinite(dist) || !Number.isFinite(score) || !Number.isFinite(duration)) {
    return { valid: false, quarantined: true, reason: "Non-finite telemetry values" };
  }

  if (dist < 0 || score < 0 || duration < 0) {
    return { valid: false, quarantined: true, reason: "Negative telemetry values" };
  }

  if (dist > 0 && duration <= 0) {
    return { valid: false, quarantined: true, reason: "Instantaneous distance accumulation" };
  }

  // These used to be skipped entirely below 100 m, so a short run could claim any
  // speed at all. There is no reason for the exemption: the density check
  // already handles the degenerate short case, and a run that is too short to
  // have an average is caught by the duration check below.
  if (dist > 0) {
    const avgSpeed = dist / (duration / 1000);
    if (avgSpeed > MAX_SPEED_MPS) {
      return { valid: false, quarantined: true, reason: `Unrealistic average speed (${avgSpeed.toFixed(1)} m/s)` };
    }

    const minExpectedMs = (dist / 100) * MIN_DURATION_MS_PER_100M;
    if (duration < minExpectedMs) {
      return { valid: false, quarantined: true, reason: "Impossible run duration for distance" };
    }
  }

  // Max score density check: score should not exceed 1000x distance
  if (dist > 0 && score > dist * 1000 + 100000) {
    return { valid: false, quarantined: true, reason: "Score density exceeds physical threshold" };
  }

  return { valid: true, quarantined: false };
}

/* --- canonical player profile (trust/safety surface) --- */

export type PrivacySettings = {
  showOnLeaderboards: boolean;
  allowFriendRequests: boolean;
  allowInvites: boolean;
  showPresence: boolean;
};

export type ModerationState = {
  status: "clear" | "muted" | "suspended";
  reasonCode?: string;
};

export type PlayerProfile = {
  playerId: string;
  displayName: string;
  avatarUrl?: string;
  guest: boolean;
  countryCode?: string;
  createdAt: string;
  updatedAt: string;
  privacy: PrivacySettings;
  moderation: ModerationState;
};

export function defaultProfile(playerId: string, name = "Sunbird Pilot"): PlayerProfile {
  const now = new Date().toISOString();
  return {
    playerId,
    displayName: name,
    guest: true,
    createdAt: now,
    updatedAt: now,
    privacy: {
      showOnLeaderboards: true,
      allowFriendRequests: true,
      allowInvites: true,
      showPresence: true,
    },
    moderation: {
      status: "clear",
    },
  };
}
