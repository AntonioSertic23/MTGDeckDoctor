import type { CollectionBuildResult } from "@/domain/builder/from-collection";
import type { Deck, DeckCard } from "@/domain/types";
import { getCachedOrAnalyzeDeck } from "@/lib/decks/analyze-local";
import { getRepository } from "@/lib/storage";
import { createId } from "@/lib/utils";

export async function saveBuiltDeck(result: CollectionBuildResult): Promise<string> {
  if (result.cards.length === 0) {
    throw new Error("Nothing to save — the builder returned an empty list.");
  }

  const now = new Date().toISOString();
  const deck: Deck = {
    id: createId(),
    name: result.commander.name,
    format: "commander",
    commanderOracleIds: [result.commander.oracleId],
    description: notesFor(result),
    ready: false,
    createdAt: now,
    updatedAt: now,
  };

  const cards: DeckCard[] = result.cards.map((entry) => ({
    oracleId: entry.card.oracleId,
    quantity: entry.quantity,
  }));

  const repo = getRepository();
  await repo.saveCards(result.cards.map((entry) => entry.card));
  await repo.createDeck(deck, cards);
  try {
    await getCachedOrAnalyzeDeck({ deck, cards });
  } catch {
    // Analysis can retry when the user opens the deck.
  }
  return deck.id;
}

function notesFor(result: CollectionBuildResult): string {
  if (result.gaps.length === 0) {
    return `Built from collection (${result.totalCards} cards). All role quotas met.`;
  }
  const gaps = result.gaps.map((g) => `${g.label} ${g.have}/${g.want}`).join(", ");
  return `Built from collection (${result.totalCards} cards). Still short: ${gaps}.`;
}
