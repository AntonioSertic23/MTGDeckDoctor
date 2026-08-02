import type { Deck, DeckFormat } from "@/domain/types";

/** Fill defaults for decks saved before ready / play counters existed. */
export function normalizeDeck(deck: Partial<Deck> & Pick<Deck, "id" | "name">): Deck {
  return {
    id: deck.id,
    name: deck.name,
    format: (deck.format as DeckFormat) || "commander",
    commanderOracleIds: Array.isArray(deck.commanderOracleIds) ? deck.commanderOracleIds : [],
    description: deck.description,
    ready: Boolean(deck.ready),
    timesBrought: Math.max(0, Number(deck.timesBrought) || 0),
    timesPlayed: Math.max(0, Number(deck.timesPlayed) || 0),
    createdAt: deck.createdAt || new Date().toISOString(),
    updatedAt: deck.updatedAt || new Date().toISOString(),
    analysisSnapshot: deck.analysisSnapshot ?? null,
  };
}
