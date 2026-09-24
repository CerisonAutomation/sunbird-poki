import type { ScoreSubmission } from "./Leaderboard";

export type VerificationResult = {
  valid: boolean;
  quarantined: boolean;
  reason?: string;
};

const MAX_SPEED_MPS = 120; // 120 m/s max theoretical bird speed
const MIN_DURATION_MS_PER_100M = 500; // minimum 500ms required per 100m distance

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

  if (dist > 100) {
    const avgSpeed = (dist / (duration / 1000));
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
