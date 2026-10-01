import { parseArchidektCollection, preferPrintings } from "@/domain/import/archidekt-collection";
import type { Card } from "@/domain/types";
import { resolveCardsByScryfallIds } from "@/lib/cards/client";
import { invalidateStoredCardCaches } from "@/lib/hooks/use-repository";
import { getRepository } from "@/lib/storage";

export interface CollectionImportResult {
  updated: number;
  missing: string[];
  /** Cards you own in more than one printing. The stored art is the copy you have the most of. */
  multiPrinting: number;
}

/**
 * Replace stored card art and prices with the exact printings in an Archidekt
 * collection CSV. Decks keep their lists; only the displayed version changes.
 */
export async function importArchidektCollection(csv: string): Promise<CollectionImportResult> {
  const preferred = preferPrintings(parseArchidektCollection(csv));
  const resolved = await resolveCardsByScryfallIds(preferred.map((card) => card.scryfallId));
  const byScryfallId = new Map(resolved.map((card) => [card.scryfallId, card]));

  const toSave: Card[] = [];
  const missing: string[] = [];
  for (const printing of preferred) {
    const card = byScryfallId.get(printing.scryfallId);
    if (!card) {
      missing.push(printing.name);
      continue;
    }
    toSave.push(card);
  }

  const repo = getRepository();
  for (let index = 0; index < toSave.length; index += 100) {
    await repo.saveCards(toSave.slice(index, index + 100));
  }
  invalidateStoredCardCaches();

  return {
    updated: toSave.length,
    missing,
    multiPrinting: preferred.filter((card) => card.printingCount > 1).length,
  };
}
