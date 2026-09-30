import { BOOST_EXTRA_SPEED, MAX_SKIN_SPEED_MULT, MAX_SPEED_FEVER } from "./constants";
import { ENDLESS_SPEED_SCALE_MAX } from "./FlightProgression";
import type { ScoreSubmission } from "./Leaderboard";

export type VerificationResult = {
  valid: boolean;
  quarantined: boolean;
  reason?: string;
};

/**
 * The fastest a run may legally average, derived from the physics rather than
 * typed in.
 *
 * It used to be a literal `120`, which is below the bird's own ceiling, so
 * every fever-and-boost run was quarantined as cheating. Replacing it with
 * `MAX_SPEED_FEVER + BOOST_EXTRA_SPEED` fixed that instance but left the same
 * bug one layer down: `Bird.step` computes its cap as
 *
 *     (fever ? MAX_SPEED_FEVER : MAX_SPEED) * opts.speedMult + (boost ? BOOST_EXTRA_SPEED : 0)
 *
 * and `opts.speedMult` is NOT 1 in a real run. `Game.fixedUpdate` passes
 * `skin.speedMult * challengeMods.speedMult * escalateMult()`, so a 1.08 skin
 * in a long escalating run reaches a cap of
 * 128 * 1.08 * 1.55 + 42 = 256.3 m/s. The gate said 170, so the fastest
 * legitimate runs — exactly the players a leaderboard is for — were still being
 * quarantined, and `MIN_DURATION_MS_PER_100M` was derived from the same wrong
 * number, so both checks agreed with each other and disagreed with the game.
 *
 * So the ceiling multiplies out the same three factors the physics does. The
 * challenge half is omitted deliberately: `CHALLENGE_MODS` only ever *lowers*
 * speed (`heavy_wings` is 0.95, everything else 1), so it cannot raise the cap.
 * `anticheat.test.ts` drives the real `Bird` at these settings and fails if this
 * ceiling is ever lower than what the bird actually reaches.
 */
const MAX_SPEED_MPS = MAX_SPEED_FEVER * MAX_SKIN_SPEED_MULT * ENDLESS_SPEED_SCALE_MAX + BOOST_EXTRA_SPEED;

/**
 * The slowest a run may legally average, as ms per 100 m. Derived from the same
 * ceiling so the two checks cannot contradict each other.
 */
const MIN_DURATION_MS_PER_100M = (100 / MAX_SPEED_MPS) * 1000;

/**
 * Exported so `anticheat.test.ts` can read the client's real numbers back and
 * compare them with `server/src/anticheat/limits.ts`. The server is the side
 * that actually decides, and the two had drifted apart silently: the server
 * still rejected above 120 m/s while the client had already moved to 170, so a
 * legal fast run was accepted locally and then thrown away on submission.
 */
export const ANTICHEAT_MAX_SPEED_MPS = MAX_SPEED_MPS;
export const ANTICHEAT_MIN_MS_PER_100M = MIN_DURATION_MS_PER_100M;

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
