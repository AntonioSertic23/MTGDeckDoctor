import { analyzeDeck, resolveDeck } from "@/domain/analysis/analyze";
import { suggestAdditions } from "@/domain/recommendations/additions";
import type {
  AdditionCandidate,
  DeckAnalysis,
  DeckWithCards,
  ResolvedDeck,
} from "@/domain/types";
import { idbRepository } from "@/lib/storage/idb-repository";

export interface LocalAnalysis {
  resolved: ResolvedDeck;
  analysis: DeckAnalysis;
  additions: AdditionCandidate[];
}

/** Loads cached cards from IndexedDB and runs the pure analyzer pipeline. */
export async function analyzeDeckLocal(deck: DeckWithCards): Promise<LocalAnalysis> {
  const oracleIds = deck.cards.map((c) => c.oracleId);
  const cards = await idbRepository.getCards(oracleIds);
  const map = new Map(cards.map((c) => [c.oracleId, c]));

  const resolved = resolveDeck(deck, map);
  const analysis = analyzeDeck(resolved);
  const additions = suggestAdditions(resolved, analysis.statistics, analysis.synergy);

  return { resolved, analysis, additions };
}
