import type { Card } from "@/domain/types";
import { resolveCardsByScryfallIds } from "@/lib/cards/client";
import { invalidateStoredCardCaches } from "@/lib/hooks/use-repository";
import { getRepository } from "@/lib/storage";

/** One serverless call per batch (Scryfall /cards/collection takes 75 ids). */
const BATCH = 75;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RefreshProgress {
  done: number;
  total: number;
}

/**
 * Re-fetches the exact stored printings (by Scryfall id, so owned art is kept)
 * to get today's Cardmarket prices. Each batch is saved as it arrives, so a
 * failure part-way keeps what already refreshed; `onBatch` receives the fresh
 * cards so the page can update without a reload.
 */
export async function refreshCardPrices(
  cards: Card[],
  options: {
    onProgress?: (progress: RefreshProgress) => void;
    onBatch?: (fresh: Card[]) => void;
  } = {},
): Promise<{ refreshed: number; failed: number }> {
  const ids = [...new Set(cards.map((card) => card.scryfallId).filter((id) => UUID.test(id)))];
  const repo = getRepository();
  let refreshed = 0;
  let failed = 0;

  options.onProgress?.({ done: 0, total: ids.length });
  for (let index = 0; index < ids.length; index += BATCH) {
    const slice = ids.slice(index, index + BATCH);
    try {
      const fresh = await resolveCardsByScryfallIds(slice, { fresh: true });
      if (fresh.length > 0) {
        await repo.saveCards(fresh);
        refreshed += fresh.length;
        options.onBatch?.(fresh);
      }
      failed += slice.length - fresh.length;
    } catch {
      failed += slice.length;
    }
    options.onProgress?.({ done: Math.min(index + slice.length, ids.length), total: ids.length });
  }

  // Deck pages and the shelf read cards from their own in-memory caches.
  if (refreshed > 0) invalidateStoredCardCaches();
  return { refreshed, failed };
}
