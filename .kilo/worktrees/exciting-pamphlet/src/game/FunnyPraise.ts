/**
 * Funny Messages + Praise — makes player want to beat time, laugh, feel praised.
 * Hexagonal: pure domain, no side effects, testable.
 */

import { pickRandom } from "./economy/CostCritique";
import { t } from "../i18n";

export type PraiseKind = "perfect" | "fever" | "boing" | "combo" | "nearBest" | "beating" | "slow" | "funny" | "record";

export type PraiseMessage = {
  kind: PraiseKind;
  text: string;
  icon: string;
  tone: "gold" | "power" | "info" | "warn" | "zenith";
};

// Use translation keys — i18n audit requires t() not literal toast
const PRAISE_POOL: Record<PraiseKind, string[]> = {
  perfect: [
    "praise.perfect.1",
    "praise.perfect.2",
    "praise.perfect.3",
    "praise.perfect.4",
    "praise.perfect.5",
  ],
  fever: [
    "praise.fever.1",
    "praise.fever.2",
    "praise.fever.3",
    "praise.fever.4",
    "praise.fever.5",
  ],
  boing: [
    "praise.boing.1",
    "praise.boing.2",
    "praise.boing.3",
    "praise.boing.4",
    "praise.boing.5",
  ],
  combo: [
    "praise.combo.1",
    "praise.combo.2",
    "praise.combo.3",
    "praise.combo.4",
    "praise.combo.5",
  ],
  nearBest: [
    "praise.nearBest.1",
    "praise.nearBest.2",
    "praise.nearBest.3",
    "praise.nearBest.4",
    "praise.nearBest.5",
  ],
  beating: [
    "praise.beating.1",
    "praise.beating.2",
    "praise.beating.3",
    "praise.beating.4",
    "praise.beating.5",
  ],
  slow: [
    "praise.slow.1",
    "praise.slow.2",
    "praise.slow.3",
    "praise.slow.4",
    "praise.slow.5",
  ],
  funny: [
    "praise.funny.1",
    "praise.funny.2",
    "praise.funny.3",
    "praise.funny.4",
    "praise.funny.5",
  ],
  record: [
    "praise.record.1",
    "praise.record.2",
    "praise.record.3",
    "praise.record.4",
    "praise.record.5",
  ],
};

export function getPraise(kind: PraiseKind, seed: number): PraiseMessage {
  const pool = PRAISE_POOL[kind];
  const key = pickRandom(pool, seed);
  const text = t(key, undefined, key);
  const tone = kind === "perfect" || kind === "record" ? "zenith" : kind === "fever" || kind === "beating" ? "gold" : kind === "slow" ? "warn" : "power";
  const icon = text.split(" ")[0] ?? "✨";
  return { kind, text, icon, tone: tone as "gold" | "power" | "info" | "warn" | "zenith" };
}

export function getTimePressureMessage(ghostDelta: number | null, distance: number, bestDistance: number, seed: number): PraiseMessage | null {
  if (ghostDelta === null) return null;
  if (bestDistance <= 0) return null;

  const nearBest = distance >= bestDistance * 0.85 && distance < bestDistance;
  const beating = ghostDelta > 5;
  const slow = ghostDelta < -20;

  if (beating && distance > bestDistance * 0.5) {
    return getPraise("beating", seed);
  }
  if (nearBest) {
    return getPraise("nearBest", seed + 1);
  }
  if (slow && distance > bestDistance * 0.3) {
    return getPraise("slow", seed + 2);
  }
  return null;
}

export function getFunnyIdleMessage(seed: number): PraiseMessage {
  return getPraise("funny", seed);
}

export function getPraiseForMoment(kind: string, seed: number): PraiseMessage | null {
  if (kind === "perfect") return getPraise("perfect", seed);
  if (kind === "fever") return getPraise("fever", seed);
  if (kind === "boing") return getPraise("boing", seed);
  if (kind === "combo" || kind === "phew") return getPraise("combo", seed);
  if (kind === "record") return getPraise("record", seed);
  return null;
}
