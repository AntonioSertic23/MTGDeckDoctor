import type {
  DeckHealth,
  DeckStatistics,
  HealthCategory,
  HealthCategoryId,
  SynergySummary,
} from "@/domain/types";
import {
  DEFAULT_THRESHOLDS,
  HEALTH_CATEGORY_LABELS,
  HEALTH_WEIGHTS,
  type HealthThresholds,
  clamp,
  recommendedLands,
  recommendedRamp,
} from "@/domain/analysis/health-config";

/**
 * Turns statistics into a 0–100 diagnostic heuristic (PRD §8).
 *
 * This is explicitly not a measure of whether a deck is good; it measures how
 * far the deck sits from conventional Commander deckbuilding ratios.
 */
export function calculateHealth(
  stats: DeckStatistics,
  synergy: SynergySummary,
  thresholds: HealthThresholds = DEFAULT_THRESHOLDS,
): DeckHealth {
  const categories: HealthCategory[] = [
    manaBaseCategory(stats, thresholds),
    rampCategory(stats, thresholds),
    cardAdvantageCategory(stats, thresholds),
    interactionCategory(stats, thresholds),
    removalCategory(stats, thresholds),
    winConditionsCategory(stats, thresholds),
    curveCategory(stats, thresholds),
    synergyCategory(synergy),
  ];

  const overall = categories.reduce(
    (sum, category) => sum + category.score * HEALTH_WEIGHTS[category.id],
    0,
  );

  return { overall: Math.round(overall), categories };
}

function category(
  id: HealthCategoryId,
  score: number,
  evidence: string[],
): HealthCategory {
  return { id, label: HEALTH_CATEGORY_LABELS[id], score: Math.round(clamp(score, 0, 100)), evidence };
}

/** Scores a count against a target, penalising shortfall and mild excess. */
function scoreAgainstTarget(actual: number, target: number, overshootTolerance = 1.6): number {
  if (target <= 0) return 100;
  if (actual <= target) return (actual / target) * 100;
  const excessRatio = (actual - target) / (target * overshootTolerance);
  return 100 - clamp(excessRatio, 0, 1) * 25;
}

function manaBaseCategory(stats: DeckStatistics, t: HealthThresholds): HealthCategory {
  const target = recommendedLands(stats.averageManaValue, t);
  // Ramp partially substitutes for lands, so count it as a fractional source.
  const effectiveSources = stats.landCount + stats.rampCount * 0.5;
  const score = scoreAgainstTarget(effectiveSources, target + 2);

  return category("manaBase", score, [
    `${stats.landCount} lands`,
    `${stats.rampCount} ramp pieces count as ${(stats.rampCount * 0.5).toFixed(1)} extra sources`,
    `Recommended around ${target} lands at an average mana value of ${stats.averageManaValue}`,
  ]);
}

function rampCategory(stats: DeckStatistics, t: HealthThresholds): HealthCategory {
  const target = recommendedRamp(stats.averageManaValue, t);
  return category("ramp", scoreAgainstTarget(stats.rampCount, target), [
    `${stats.rampCount} ramp pieces`,
    `Recommended around ${target} at an average mana value of ${stats.averageManaValue}`,
  ]);
}

function cardAdvantageCategory(stats: DeckStatistics, t: HealthThresholds): HealthCategory {
  const target = t.recommendedDraw;
  return category("cardAdvantage", scoreAgainstTarget(stats.drawCount, target), [
    `${stats.drawCount} card draw / card advantage pieces`,
    `Recommended minimum ${target}`,
  ]);
}

function interactionCategory(stats: DeckStatistics, t: HealthThresholds): HealthCategory {
  const target = t.recommendedInstantSpeedInteraction;
  const score = scoreAgainstTarget(stats.instantSpeedInteractionCount, target);
  return category("interaction", score, [
    `${stats.instantSpeedInteractionCount} cards can interact at instant speed`,
    `${stats.counterspellCount} counterspells`,
    `Recommended minimum ${target}`,
  ]);
}

function removalCategory(stats: DeckStatistics, t: HealthThresholds): HealthCategory {
  const spotScore = scoreAgainstTarget(stats.spotRemovalCount, t.recommendedSpotRemoval);
  const wipeScore = scoreAgainstTarget(stats.boardWipeCount, t.recommendedBoardWipes);
  return category("removal", spotScore * 0.65 + wipeScore * 0.35, [
    `${stats.spotRemovalCount} spot removal spells (recommended ${t.recommendedSpotRemoval})`,
    `${stats.boardWipeCount} board wipes (recommended ${t.recommendedBoardWipes})`,
  ]);
}

function winConditionsCategory(stats: DeckStatistics, t: HealthThresholds): HealthCategory {
  const target = t.recommendedWinConditions;
  return category("winConditions", scoreAgainstTarget(stats.winConditionCount, target, 4), [
    `${stats.winConditionCount} identified win conditions or large threats`,
    `Recommended minimum ${target}`,
  ]);
}

function curveCategory(stats: DeckStatistics, t: HealthThresholds): HealthCategory {
  const deviation = Math.abs(stats.averageManaValue - t.idealManaValue);
  const score = 100 - clamp(deviation / t.manaValueTolerance, 0, 1) * 100;
  const cheapSpells = (stats.manaCurve["1"] ?? 0) + (stats.manaCurve["2"] ?? 0);

  return category("curve", score, [
    `Average mana value ${stats.averageManaValue} (median ${stats.medianManaValue})`,
    `${cheapSpells} spells at mana value 1–2`,
    `${(stats.manaCurve["6"] ?? 0) + (stats.manaCurve["7+"] ?? 0)} spells at mana value 6 or more`,
  ]);
}

function synergyCategory(synergy: SynergySummary): HealthCategory {
  const topThemes = synergy.themes.slice(0, 3).map((t) => t.label);
  return category("synergy", synergy.averageScore, [
    `Average card synergy score ${Math.round(synergy.averageScore)}/100`,
    topThemes.length > 0
      ? `Strongest themes: ${topThemes.join(", ")}`
      : "No dominant theme detected",
  ]);
}
