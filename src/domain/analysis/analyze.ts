import type {
  Card,
  DeckAnalysis,
  DeckWithCards,
  ResolvedDeck,
  ResolvedDeckEntry,
} from "@/domain/types";
import { classifyCard } from "@/domain/cards/classifier";
import { detectThemes } from "@/domain/cards/themes";
import { calculateStatistics } from "@/domain/analysis/statistics";
import { calculateSynergy } from "@/domain/analysis/synergy";
import { calculateHealth } from "@/domain/analysis/health";
import { detectProblems } from "@/domain/analysis/problems";
import { suggestCuts } from "@/domain/recommendations/cuts";
import { explainDeck } from "@/domain/analysis/explain";

/**
 * The analyzer pipeline from PRD §25:
 * resolve → classify → statistics → synergy → health → problems → cuts → explanation.
 *
 * Synchronous and pure: given the same deck and cards it always produces the
 * same analysis.
 */
export function resolveDeck(deck: DeckWithCards, cards: Map<string, Card>): ResolvedDeck {
  const entries: ResolvedDeckEntry[] = [];
  const unresolved: string[] = [];
  const commanderIds = new Set(deck.deck.commanderOracleIds);

  for (const deckCard of deck.cards) {
    const card = cards.get(deckCard.oracleId);
    if (!card) {
      unresolved.push(deckCard.oracleId);
      continue;
    }
    entries.push({
      card,
      quantity: deckCard.quantity,
      roles: classifyCard(card),
      themes: detectThemes(card),
      isCommander: commanderIds.has(card.oracleId),
    });
  }

  return {
    deck: deck.deck,
    entries,
    commanders: entries.filter((e) => e.isCommander).map((e) => e.card),
    unresolved,
  };
}

export function analyzeDeck(resolved: ResolvedDeck): DeckAnalysis {
  const statistics = calculateStatistics(resolved);
  const synergy = calculateSynergy(resolved);
  const health = calculateHealth(statistics, synergy);
  const problems = detectProblems(resolved, statistics, synergy);
  const cuts = suggestCuts(resolved, statistics, synergy, problems);
  const explanation = explainDeck(resolved, statistics, synergy, problems);

  return {
    deckId: resolved.deck.id,
    generatedAt: new Date().toISOString(),
    statistics,
    health,
    problems,
    cuts,
    explanation,
    synergy,
    unresolved: resolved.unresolved,
  };
}
