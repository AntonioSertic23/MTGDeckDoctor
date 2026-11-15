import { eurPrice } from "@/domain/decks/sort-entries";
import type { AdditionCandidate, ResolvedDeckEntry } from "@/domain/types";

export interface DeckValue {
  /** Sum of EUR price × quantity over priced cards. */
  totalEur: number;
  /** Distinct cards with no EUR price (not counted in the total). */
  unpricedCards: number;
}

export function deckValue(entries: ResolvedDeckEntry[]): DeckValue {
  let totalEur = 0;
  let unpricedCards = 0;
  for (const entry of entries) {
    const price = eurPrice(entry.card.prices);
    if (price === null) unpricedCards += 1;
    else totalEur += price * entry.quantity;
  }
  return { totalEur: Math.round(totalEur * 100) / 100, unpricedCards };
}

/**
 * Keeps additions at or under `maxEur`. Cards the user already owns always
 * pass (they cost nothing), and unpriced cards pass so they can be checked by
 * hand. `null` disables the cap.
 */
export function filterAdditionsByBudget(
  additions: AdditionCandidate[],
  maxEur: number | null,
): AdditionCandidate[] {
  if (maxEur === null) return additions;
  return additions.filter((item) => {
    if ((item.ownedCopies ?? 0) > 0) return true;
    const price = eurPrice(item.prices ?? null);
    return price === null || price <= maxEur;
  });
}
