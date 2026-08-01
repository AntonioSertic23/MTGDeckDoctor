import type {
  Card,
  CardAllocation,
  Deck,
  DeckAnalysisSnapshot,
  DeckCard,
  DeckWithCards,
  InventoryItem,
} from "@/domain/types";

/**
 * Persistence boundary.
 *
 * Prefer Supabase when configured; otherwise IndexedDB. Analysis snapshots are
 * stored with the deck so Home / detail pages do not re-run the full pipeline
 * until the list content changes.
 */
export interface DeckRepository {
  listDecks(): Promise<Deck[]>;
  getDeck(id: string): Promise<DeckWithCards | null>;
  listDecksWithCards(): Promise<DeckWithCards[]>;
  createDeck(deck: Deck, cards: DeckCard[]): Promise<void>;
  updateDeck(deck: Deck): Promise<void>;
  setDeckCards(deckId: string, cards: DeckCard[]): Promise<void>;
  deleteDeck(id: string): Promise<void>;
  /** Persist diagnosis without bumping deck.updatedAt. */
  saveAnalysisSnapshot(deckId: string, snapshot: DeckAnalysisSnapshot): Promise<void>;

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
