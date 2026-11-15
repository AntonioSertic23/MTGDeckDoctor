import type { Card, CardPrices } from "@/domain/types";

/** Scryfall refreshes Cardmarket prices about once a day. */
export const PRICE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface ValueRow {
  card?: Card | null;
  quantity: number;
  foilQuantity?: number;
  /** Total paid for this row's copies (Archidekt Purchase Price), if known. */
  purchaseEur?: number | null;
}

export interface RowValue {
  /** Sum over priced copies. */
  valueEur: number;
  pricedCopies: number;
  unpricedCopies: number;
  foilCopies: number;
}

export interface CollectionValue {
  totalEur: number;
  pricedCopies: number;
  unpricedCopies: number;
  foilCopies: number;
  /** Total paid across rows that have a purchase price; null when none do. */
  paidEur: number | null;
  /** Current value of those same rows, for a gain/loss comparison. */
  paidRowsValueEur: number | null;
  paidRows: number;
}

function parse(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Per-copy prices for each finish. When one finish has no Cardmarket price the
 * other is used, which is closer than counting the copy as worthless.
 */
export function finishPrices(prices: CardPrices | null | undefined): {
  normal: number | null;
  foil: number | null;
} {
  const normal = parse(prices?.eur);
  const foil = parse(prices?.eurFoil);
  return { normal: normal ?? foil, foil: foil ?? normal };
}

export function rowValue(row: ValueRow): RowValue {
  const quantity = Math.max(0, row.quantity);
  const foilCopies = Math.min(quantity, Math.max(0, row.foilQuantity ?? 0));
  const normalCopies = quantity - foilCopies;
  const { normal, foil } = finishPrices(row.card?.prices);

  let valueEur = 0;
  let pricedCopies = 0;
  let unpricedCopies = 0;
  if (normalCopies > 0) {
    if (normal === null) unpricedCopies += normalCopies;
    else {
      valueEur += normal * normalCopies;
      pricedCopies += normalCopies;
    }
  }
  if (foilCopies > 0) {
    if (foil === null) unpricedCopies += foilCopies;
    else {
      valueEur += foil * foilCopies;
      pricedCopies += foilCopies;
    }
  }
  return { valueEur, pricedCopies, unpricedCopies, foilCopies };
}

export function collectionValue(rows: ValueRow[]): CollectionValue {
  let totalEur = 0;
  let pricedCopies = 0;
  let unpricedCopies = 0;
  let foilCopies = 0;
  let paidEur = 0;
  let paidRowsValueEur = 0;
  let paidRows = 0;

  for (const row of rows) {
    const value = rowValue(row);
    totalEur += value.valueEur;
    pricedCopies += value.pricedCopies;
    unpricedCopies += value.unpricedCopies;
    foilCopies += value.foilCopies;
    if (typeof row.purchaseEur === "number" && Number.isFinite(row.purchaseEur)) {
      paidEur += row.purchaseEur;
      paidRowsValueEur += value.valueEur;
      paidRows += 1;
    }
  }

  return {
    totalEur: round(totalEur),
    pricedCopies,
    unpricedCopies,
    foilCopies,
    paidEur: paidRows > 0 ? round(paidEur) : null,
    paidRowsValueEur: paidRows > 0 ? round(paidRowsValueEur) : null,
    paidRows,
  };
}

/** True when the stored price is older than `maxAgeMs` (or has no timestamp). */
export function isPriceStale(
  card: Pick<Card, "updatedAt">,
  nowMs: number,
  maxAgeMs = PRICE_MAX_AGE_MS,
): boolean {
  const at = Date.parse(card.updatedAt);
  return !Number.isFinite(at) || nowMs - at > maxAgeMs;
}

/** Oldest price timestamp among `cards`, or null. */
export function oldestPriceDate(cards: Pick<Card, "updatedAt">[]): string | null {
  let oldest: number | null = null;
  for (const card of cards) {
    const at = Date.parse(card.updatedAt);
    if (Number.isFinite(at) && (oldest === null || at < oldest)) oldest = at;
  }
  return oldest === null ? null : new Date(oldest).toISOString();
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
