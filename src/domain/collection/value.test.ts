import { describe, expect, it } from "vitest";
import {
  collectionValue,
  finishPrices,
  isPriceStale,
  oldestPriceDate,
  rowValue,
} from "@/domain/collection/value";
import type { Card } from "@/domain/types";

function card(eur: string | null, eurFoil: string | null = null, updatedAt = "2026-11-15T00:00:00Z"): Card {
  return {
    oracleId: "o",
    scryfallId: "s",
    name: "Card",
    manaCost: null,
    manaValue: 0,
    typeLine: "Artifact",
    oracleText: "",
    colors: [],
    colorIdentity: [],
    keywords: [],
    producedMana: [],
    power: null,
    toughness: null,
    imageUri: null,
    setCode: "",
    rarity: "common",
    prices: { usd: null, eur, eurFoil },
    legalities: {},
    updatedAt,
  };
}

describe("finishPrices", () => {
  it("falls back to the other finish when one is missing", () => {
    expect(finishPrices({ usd: null, eur: "1.00", eurFoil: null })).toEqual({ normal: 1, foil: 1 });
    expect(finishPrices({ usd: null, eur: null, eurFoil: "3.00" })).toEqual({ normal: 3, foil: 3 });
    expect(finishPrices({ usd: null, eur: null })).toEqual({ normal: null, foil: null });
  });
});

describe("rowValue", () => {
  it("prices foil copies at the foil price", () => {
    expect(rowValue({ card: card("1.00", "5.00"), quantity: 3, foilQuantity: 1 })).toEqual({
      valueEur: 7,
      pricedCopies: 3,
      unpricedCopies: 0,
      foilCopies: 1,
    });
  });

  it("clamps foil copies to the quantity", () => {
    expect(rowValue({ card: card("1.00", "5.00"), quantity: 1, foilQuantity: 4 }).valueEur).toBe(5);
  });

  it("counts copies without any price", () => {
    expect(rowValue({ card: card(null), quantity: 2 })).toMatchObject({
      valueEur: 0,
      unpricedCopies: 2,
    });
    expect(rowValue({ card: null, quantity: 1 }).unpricedCopies).toBe(1);
  });
});

describe("collectionValue", () => {
  it("sums value and compares paid rows", () => {
    const value = collectionValue([
      { card: card("2.00"), quantity: 2, purchaseEur: 1.5 },
      { card: card("0.10", "0.50"), quantity: 4, foilQuantity: 2 },
      { card: card(null), quantity: 1 },
    ]);
    expect(value).toEqual({
      totalEur: 5.2,
      pricedCopies: 6,
      unpricedCopies: 1,
      foilCopies: 2,
      paidEur: 1.5,
      paidRowsValueEur: 4,
      paidRows: 1,
    });
  });

  it("reports no paid total without purchase prices", () => {
    expect(collectionValue([{ card: card("1.00"), quantity: 1 }]).paidEur).toBeNull();
  });
});

describe("price age", () => {
  const now = Date.parse("2026-11-15T12:00:00Z");

  it("flags prices older than a day", () => {
    expect(isPriceStale(card("1", null, "2026-11-15T00:00:00Z"), now)).toBe(false);
    expect(isPriceStale(card("1", null, "2026-11-13T00:00:00Z"), now)).toBe(true);
    expect(isPriceStale(card("1", null, ""), now)).toBe(true);
  });

  it("finds the oldest timestamp", () => {
    expect(
      oldestPriceDate([card("1", null, "2026-11-10T00:00:00Z"), card("1", null, "2026-11-12T00:00:00Z")]),
    ).toBe("2026-11-10T00:00:00.000Z");
  });
});
