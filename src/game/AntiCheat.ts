import { BOOST_EXTRA_SPEED, MAX_SPEED_FEVER } from "./constants";
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
 * It used to be a literal `120`, which is below the bird's own ceiling:
 * `MAX_SPEED_FEVER` is 128 and a boost adds 42, so a legal fever-and-boost run
 * tops out near 170 m/s. Every such run averaged out above 120 and was
 * quarantined as cheating — the gate was rejecting exactly the players the
 * leaderboard is for, and a literal can never be re-checked when the physics
 * moves. The floor is now the physics floor.
 */
const MAX_SPEED_MPS = MAX_SPEED_FEVER + BOOST_EXTRA_SPEED;

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
