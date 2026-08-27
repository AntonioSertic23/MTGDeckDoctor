import { classifyCard } from "@/domain/cards/classifier";
import { detectThemes } from "@/domain/cards/themes";
import type {
  Card,
  CardRole,
  DeckWithCards,
  InventoryItem,
} from "@/domain/types";

/**
 * Snapshot of the user's collection and how other decks use those cards.
 * Pure data — no I/O. Used to rank adds/cuts without changing diagnosis.
 */
export interface CollectionContext {
  ownedQty: Map<string, number>;
  ownedCards: Card[];
  /** oracleId → other decks that list this card (name + copies in those lists). */
  otherDecks: Map<string, { names: string[]; copies: number }>;
  currentDeckOracleIds: Set<string>;
}

export function buildCollectionContext(
  currentDeckId: string,
  currentOracleIds: Iterable<string>,
  inventory: InventoryItem[],
  ownedCards: Card[],
  allDecks: DeckWithCards[],
): CollectionContext {
  const ownedQty = new Map(inventory.map((item) => [item.oracleId, item.quantity]));
  const currentDeckOracleIds = new Set(currentOracleIds);
  const otherDecks = new Map<string, { names: string[]; copies: number }>();

  for (const { deck, cards } of allDecks) {
    if (deck.id === currentDeckId) continue;
    for (const deckCard of cards) {
      const entry = otherDecks.get(deckCard.oracleId) ?? { names: [], copies: 0 };
      if (!entry.names.includes(deck.name)) entry.names.push(deck.name);
      entry.copies += deckCard.quantity;
      otherDecks.set(deckCard.oracleId, entry);
    }
  }

  return { ownedQty, ownedCards, otherDecks, currentDeckOracleIds };
}

export function findOwnedCard(name: string, collection: CollectionContext): Card | undefined {
  const variants = nameVariants(name);
  return collection.ownedCards.find((card) =>
    nameVariants(card.name).some((v) => variants.includes(v)),
  );
}

export function ownedCopiesOf(oracleId: string, collection: CollectionContext): number {
  return collection.ownedQty.get(oracleId) ?? 0;
}

/** Extra cut pressure when this physical card is stretched across decks. */
export function inventoryCutAdjustment(
  oracleId: string,
  copiesInThisDeck: number,
  collection: CollectionContext,
): { points: number; reason: string } | null {
  const owned = ownedCopiesOf(oracleId, collection);
  if (owned <= 0) return null;

  const elsewhere = collection.otherDecks.get(oracleId);
  if (!elsewhere || elsewhere.copies <= 0) return null;

  const required = copiesInThisDeck + elsewhere.copies;
  if (owned >= required) return null;

  const decks = formatDeckNames(elsewhere.names);
  return {
    points: Math.min(16, 8 + (required - owned) * 4),
    reason: `Shared with ${decks} — you only own ${owned}`,
  };
}

export function formatDeckNames(names: string[]): string {
  if (names.length === 0) return "another deck";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]} +${names.length - 1} more`;
}

/** Skip basics and cards that cannot fill a role gap. */
export function isCollectionAddCandidate(card: Card, roles: CardRole[]): boolean {
  const type = card.typeLine.toLowerCase();
  if (type.includes("basic land")) return false;
  if (roles.length === 0) return false;
  if (roles.length === 1 && roles[0] === "LAND") return false;
  return true;
}

export function collectionRolesAndThemes(card: Card): { roles: CardRole[]; themes: ReturnType<typeof detectThemes> } {
  return { roles: classifyCard(card), themes: detectThemes(card) };
}

function nameVariants(name: string): string[] {
  const normalized = name.toLowerCase().replace(/\s+/g, " ").trim();
  const front = normalized.split("//")[0]?.trim() ?? normalized;
  return [...new Set([normalized, front])];
}
