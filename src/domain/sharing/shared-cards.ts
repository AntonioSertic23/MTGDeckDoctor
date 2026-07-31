import type { Card, DeckWithCards, InventoryItem, SharedCardUsage } from "@/domain/types";

/**
 * Shared card detection and inventory conflicts (PRD §13–§18, §34).
 *
 * Cards are matched on `oracleId` so different printings of the same card are
 * treated as one logical card.
 */
export function buildSharedCardIndex(
  decks: DeckWithCards[],
  cards: Map<string, Card>,
  inventory: InventoryItem[] = [],
): SharedCardUsage[] {
  const owned = new Map(inventory.map((item) => [item.oracleId, item.quantity]));
  const usage = new Map<string, { deckIds: string[]; deckNames: string[]; copies: number }>();

  for (const { deck, cards: deckCards } of decks) {
    for (const deckCard of deckCards) {
      const entry = usage.get(deckCard.oracleId) ?? { deckIds: [], deckNames: [], copies: 0 };
      if (!entry.deckIds.includes(deck.id)) {
        entry.deckIds.push(deck.id);
        entry.deckNames.push(deck.name);
      }
      entry.copies += deckCard.quantity;
      usage.set(deckCard.oracleId, entry);
    }
  }

  const result: SharedCardUsage[] = [];

  for (const [oracleId, entry] of usage) {
    const copiesOwned = owned.get(oracleId) ?? 0;
    const copiesRequired = entry.copies;
    const shortage = Math.max(0, copiesRequired - copiesOwned);

    result.push({
      oracleId,
      name: cards.get(oracleId)?.name ?? oracleId,
      deckIds: entry.deckIds,
      deckNames: entry.deckNames,
      copiesRequired,
      copiesOwned,
      // Without a recorded quantity we cannot claim a conflict — only that the
      // card is shared. Owning zero copies means "not tracked yet".
      shortage: copiesOwned > 0 ? shortage : 0,
      conflict: copiesOwned > 0 && shortage > 0,
    });
  }

  return result.sort(
    (a, b) => b.deckIds.length - a.deckIds.length || a.name.localeCompare(b.name),
  );
}

/** Cards that appear in more than one deck. */
export function findSharedCards(usage: SharedCardUsage[]): SharedCardUsage[] {
  return usage.filter((u) => u.deckIds.length > 1);
}

export function findConflicts(usage: SharedCardUsage[]): SharedCardUsage[] {
  return usage.filter((u) => u.conflict).sort((a, b) => b.shortage - a.shortage);
}

export interface SharedCardMatrix {
  deckIds: string[];
  deckNames: string[];
  rows: { oracleId: string; name: string; present: boolean[]; deckCount: number }[];
}

/** Card × deck grid for the matrix view (PRD §15). */
export function buildMatrix(
  decks: DeckWithCards[],
  usage: SharedCardUsage[],
  minDecks = 2,
): SharedCardMatrix {
  const deckIds = decks.map((d) => d.deck.id);
  const deckNames = decks.map((d) => d.deck.name);

  const rows = usage
    .filter((u) => u.deckIds.length >= minDecks)
    .map((u) => ({
      oracleId: u.oracleId,
      name: u.name,
      present: deckIds.map((id) => u.deckIds.includes(id)),
      deckCount: u.deckIds.length,
    }));

  return { deckIds, deckNames, rows };
}
