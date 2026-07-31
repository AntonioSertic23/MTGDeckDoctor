import type { HealthCategoryId } from "@/domain/types";

/**
 * Health weights and thresholds live in configuration, never inside UI
 * components (PRD §8). Tuning the diagnosis should never require touching a
 * React file.
 */
export const HEALTH_WEIGHTS: Record<HealthCategoryId, number> = {
  manaBase: 0.15,
  ramp: 0.15,
  cardAdvantage: 0.15,
  interaction: 0.15,
  removal: 0.1,
  winConditions: 0.1,
  curve: 0.1,
  synergy: 0.1,
};

export const HEALTH_CATEGORY_LABELS: Record<HealthCategoryId, string> = {
  manaBase: "Mana Base",
  ramp: "Ramp",
  cardAdvantage: "Card Draw",
  interaction: "Interaction",
  removal: "Removal",
  winConditions: "Win Conditions",
  curve: "Curve",
  synergy: "Synergy",
};

export interface HealthThresholds {
  /** Deck size a Commander list is measured against. */
  deckSize: number;
  /** Land count for a deck sitting at `baselineManaValue`. */
  baselineLands: number;
  baselineManaValue: number;
  /** Extra lands demanded per point of average mana value above baseline. */
  landsPerManaValue: number;
  minLands: number;
  maxLands: number;

  baselineRamp: number;
  rampPerManaValue: number;
  minRamp: number;
  maxRamp: number;

  recommendedDraw: number;
  recommendedInstantSpeedInteraction: number;
  recommendedSpotRemoval: number;
  recommendedBoardWipes: number;
  recommendedWinConditions: number;

  /** Average mana value that scores a perfect curve. */
  idealManaValue: number;
  /** Deviation from the ideal at which the curve score reaches zero. */
  manaValueTolerance: number;
}

export const DEFAULT_THRESHOLDS: HealthThresholds = {
  deckSize: 100,
  baselineLands: 36,
  baselineManaValue: 3.2,
  landsPerManaValue: 3,
  minLands: 33,
  maxLands: 40,

  baselineRamp: 9,
  rampPerManaValue: 6,
  minRamp: 6,
  maxRamp: 16,

  recommendedDraw: 10,
  recommendedInstantSpeedInteraction: 8,
  recommendedSpotRemoval: 8,
  recommendedBoardWipes: 3,
  recommendedWinConditions: 3,

  idealManaValue: 3.1,
  manaValueTolerance: 1.4,
};

export function recommendedLands(averageManaValue: number, t = DEFAULT_THRESHOLDS): number {
  const raw = t.baselineLands + (averageManaValue - t.baselineManaValue) * t.landsPerManaValue;
  return clamp(Math.round(raw), t.minLands, t.maxLands);
}

export function recommendedRamp(averageManaValue: number, t = DEFAULT_THRESHOLDS): number {
  const raw = t.baselineRamp + (averageManaValue - t.baselineManaValue) * t.rampPerManaValue;
  return clamp(Math.round(raw), t.minRamp, t.maxRamp);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
