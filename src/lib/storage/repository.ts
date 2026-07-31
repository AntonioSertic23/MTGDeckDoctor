import type {
  Card,
  CardAllocation,
  Deck,
  DeckCard,
  DeckWithCards,
  InventoryItem,
} from "@/domain/types";

/**
 * Persistence boundary.
 *
 * v1 stores everything in the browser (see `idb-repository.ts`), which keeps
 * each visitor's decks private without an auth system. Moving to Postgres
 * later means writing one more implementation of this interface — no call site
 * needs to change.
 */
export interface DeckRepository {
  listDecks(): Promise<Deck[]>;
  getDeck(id: string): Promise<DeckWithCards | null>;
  listDecksWithCards(): Promise<DeckWithCards[]>;
  createDeck(deck: Deck, cards: DeckCard[]): Promise<void>;
  updateDeck(deck: Deck): Promise<void>;
  setDeckCards(deckId: string, cards: DeckCard[]): Promise<void>;
  deleteDeck(id: string): Promise<void>;

  getCards(oracleIds: string[]): Promise<Card[]>;
  getAllCards(): Promise<Card[]>;
  saveCards(cards: Card[]): Promise<void>;

  listInventory(): Promise<InventoryItem[]>;
  setInventoryQuantity(oracleId: string, quantity: number): Promise<void>;

  listAllocations(): Promise<CardAllocation[]>;
  /** Moves a physical copy between decks without touching decklist membership. */
  setAllocation(allocation: CardAllocation): Promise<void>;
  clearAllocation(oracleId: string, deckId: string): Promise<void>;
}
