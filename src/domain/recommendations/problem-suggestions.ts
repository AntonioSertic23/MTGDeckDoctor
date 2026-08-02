import type {
  AdditionCandidate,
  CardRole,
  DeckStatistics,
  HealthCategoryId,
  Problem,
  ResolvedDeck,
  SynergySummary,
} from "@/domain/types";
import { suggestAdditions, suggestAdditionsForRoles } from "@/domain/recommendations/additions";
import { suggestCuts } from "@/domain/recommendations/cuts";
import type { HealthThresholds } from "@/domain/analysis/health-config";
import { DEFAULT_THRESHOLDS } from "@/domain/analysis/health-config";

/** Problem type → roles we should recommend staples for. */
export const PROBLEM_SUGGESTION_ROLES: Record<string, CardRole[]> = {
  LOW_RAMP: ["RAMP"],
  HIGH_MANA_VALUE: ["RAMP"],
  TOO_FEW_LANDS: ["RAMP"],
  LOW_REMOVAL: ["SPOT_REMOVAL"],
  LOW_BOARD_WIPES: ["BOARD_WIPE"],
  LOW_INTERACTION: ["COUNTERSPELL", "SPOT_REMOVAL"],
  LOW_CARD_ADVANTAGE: ["CARD_DRAW"],
  UNCLEAR_WIN_CONDITION: ["WIN_CONDITION"],
};

/** Health category → roles for “try adding” when the score is weak. */
export const HEALTH_CATEGORY_ROLES: Partial<Record<HealthCategoryId, CardRole[]>> = {
  ramp: ["RAMP"],
  cardAdvantage: ["CARD_DRAW"],
  interaction: ["COUNTERSPELL", "SPOT_REMOVAL"],
  removal: ["SPOT_REMOVAL"],
  winConditions: ["WIN_CONDITION"],
};

const SUGGESTIONS_PER_PROBLEM = 4;
const WEAK_HEALTH_SCORE = 70;

/**
 * Attaches concrete staple picks to each actionable problem so the Problems
 * tab can show “try these cards” instead of only a count gap.
 */
export function enrichProblemsWithSuggestions(
  problems: Problem[],
  deck: ResolvedDeck,
  stats: DeckStatistics,
  synergy: SynergySummary,
  thresholds: HealthThresholds = DEFAULT_THRESHOLDS,
): Problem[] {
  return problems.map((problem) => {
    if (problem.type === "TOO_MANY_CARDS") {
      return enrichTooManyCards(problem, deck, stats, synergy, problems);
    }
    if (problem.type === "TOO_FEW_CARDS") {
      return enrichTooFewCards(problem, deck, stats, synergy, thresholds);
    }

    const roles = PROBLEM_SUGGESTION_ROLES[problem.type];
    if (!roles) return problem;

    const suggestions = suggestAdditionsForRoles(
      deck,
      stats,
      synergy,
      roles,
      SUGGESTIONS_PER_PROBLEM,
      thresholds,
    );
    if (suggestions.length === 0) return problem;

    return {
      ...problem,
      suggestions,
      suggestedFix:
        problem.suggestedFix ??
        `Consider adding cards like ${suggestions
          .slice(0, 3)
          .map((s) => s.name)
          .join(", ")}.`,
    };
  });
}

function enrichTooManyCards(
  problem: Problem,
  deck: ResolvedDeck,
  stats: DeckStatistics,
  synergy: SynergySummary,
  problems: Problem[],
): Problem {
  const excess = Number(problem.evidence.excess) || Math.max(0, stats.totalCards - 100);
  if (excess <= 0) return problem;

  const cuts = suggestCuts(deck, stats, synergy, problems, excess, {
    minScore: 0,
    relaxFilters: true,
  });
  let names = cuts.map((c) => c.name);

  if (names.length < excess) {
    const already = new Set(names.map((n) => n.toLowerCase()));
    const fillers = deck.entries
      .filter((e) => !e.isCommander && !e.roles.includes("LAND"))
      .filter((e) => !already.has(e.card.name.toLowerCase()))
      .sort(
        (a, b) =>
          (synergy.cardScores[a.card.oracleId] ?? 50) - (synergy.cardScores[b.card.oracleId] ?? 50),
      )
      .map((e) => e.card.name);
    names = [...names, ...fillers].slice(0, excess);
  } else {
    names = names.slice(0, excess);
  }

  if (names.length === 0) return problem;

  return {
    ...problem,
    affectedCards: names,
    suggestedFix: `Cut ${excess} card${excess === 1 ? "" : "s"} to reach 100. Strongest cut candidates: ${names
      .slice(0, 5)
      .join(", ")}${names.length > 5 ? "…" : ""}.`,
  };
}

function enrichTooFewCards(
  problem: Problem,
  deck: ResolvedDeck,
  stats: DeckStatistics,
  synergy: SynergySummary,
  thresholds: HealthThresholds,
): Problem {
  const missing = Number(problem.evidence.missing) || Math.max(0, 100 - stats.totalCards);
  if (missing <= 0) return problem;

  const suggestions = suggestAdditions(deck, stats, synergy, thresholds, missing);
  if (suggestions.length === 0) return problem;

  return {
    ...problem,
    suggestions,
    suggestedFix: `Add ${missing} card${missing === 1 ? "" : "s"} to reach 100. Consider: ${suggestions
      .slice(0, 5)
      .map((s) => s.name)
      .join(", ")}${suggestions.length > 5 ? "…" : ""}.`,
  };
}

/** Staple picks for health categories that are currently below target. */
export function suggestionsForHealthCategories(
  deck: ResolvedDeck,
  stats: DeckStatistics,
  synergy: SynergySummary,
  categoryScores: { id: HealthCategoryId; score: number }[],
  thresholds: HealthThresholds = DEFAULT_THRESHOLDS,
): Partial<Record<HealthCategoryId, AdditionCandidate[]>> {
  const result: Partial<Record<HealthCategoryId, AdditionCandidate[]>> = {};

  for (const category of categoryScores) {
    if (category.score >= WEAK_HEALTH_SCORE) continue;
    const roles = HEALTH_CATEGORY_ROLES[category.id];
    if (!roles) continue;
    const suggestions = suggestAdditionsForRoles(
      deck,
      stats,
      synergy,
      roles,
      SUGGESTIONS_PER_PROBLEM,
      thresholds,
    );
    if (suggestions.length > 0) result[category.id] = suggestions;
  }

  return result;
}
