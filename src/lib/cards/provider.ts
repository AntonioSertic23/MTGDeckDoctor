import type { Card } from "@/domain/types";

/**
 * A lookup that may include Archidekt printing hints so Scryfall can return the
 * exact set art / Cardmarket EUR price instead of a random default printing.
 */
export interface CardLookup {
  name: string;
  setCode?: string;
  collectorNumber?: string;
}

/**
 * The rest of the application depends on this interface, never on Scryfall
 * specifics (PRD §23). Swapping in a different card source, a bulk-data
 * importer or a test double only requires another implementation.
 */
export interface CardProvider {
  findByLookups(lookups: CardLookup[]): Promise<{ cards: Card[]; notFound: string[] }>;
  /** Convenience wrapper around `findByLookups`. */
  findByNames(names: string[]): Promise<{ cards: Card[]; notFound: string[] }>;
  getByOracleIds(oracleIds: string[]): Promise<Card[]>;
  search(query: string, limit?: number): Promise<Card[]>;
}
