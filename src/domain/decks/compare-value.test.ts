import { describe, expect, it } from "vitest";
import { compareDecks, compareHealth } from "@/domain/decks/compare";
import { deckValue, filterAdditionsByBudget } from "@/domain/decks/value";
import type { AdditionCandidate, Card, DeckHealth, ResolvedDeckEntry } from "@/domain/types";

function entry(oracleId: string, name: string, quantity = 1, eur: string | null = null): ResolvedDeckEntry {
  const card: Card = {
    oracleId,
    scryfallId: oracleId,
    name,
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
    prices: { usd: null, eur },
    legalities: {},
    updatedAt: "",
  };
  return { card, quantity, roles: [], themes: [], isCommander: false };
}

function addition(name: string, eur: string | null, ownedCopies = 0): AdditionCandidate {
  return {
    name,
    roles: [],
    themes: [],
    approxManaValue: 2,
    score: 50,
    reasons: [],
    prices: { usd: null, eur },
    ownedCopies,
  };
}

describe("deckValue", () => {
  it("sums priced cards times quantity and counts unpriced ones", () => {
    const value = deckValue([
      entry("a", "A", 1, "1.50"),
      entry("b", "B", 10, "0.10"),
      entry("c", "C", 1, null),
    ]);
    expect(value).toEqual({ totalEur: 2.5, unpricedCards: 1 });
  });
});

describe("filterAdditionsByBudget", () => {
  const list = [
    addition("Cheap", "0.50"),
    addition("Pricey", "40.00"),
    addition("Owned pricey", "40.00", 1),
    addition("Unpriced", null),
  ];

  it("keeps cheap, owned and unpriced cards under a cap", () => {
    expect(filterAdditionsByBudget(list, 5).map((a) => a.name)).toEqual([
      "Cheap",
      "Owned pricey",
      "Unpriced",
    ]);
  });

  it("does nothing without a cap", () => {
    expect(filterAdditionsByBudget(list, null)).toHaveLength(4);
  });
});

describe("compareDecks", () => {
  it("splits cards into only-A, only-B and shared", () => {
    const result = compareDecks(
      [entry("sol", "Sol Ring"), entry("a", "Alpha"), entry("f", "Forest", 10)],
      [entry("sol", "Sol Ring"), entry("b", "Beta"), entry("f", "Forest", 8)],
    );
    expect(result.onlyA.map((r) => r.name)).toEqual(["Alpha"]);
    expect(result.onlyB.map((r) => r.name)).toEqual(["Beta"]);
    expect(result.shared.map((r) => [r.name, r.quantityA, r.quantityB])).toEqual([
      ["Forest", 10, 8],
      ["Sol Ring", 1, 1],
    ]);
    expect(result.overlapPercent).toBe(67);
  });
});

describe("compareHealth", () => {
  it("reports overall and per-category deltas", () => {
    const a: DeckHealth = {
      overall: 60,
      categories: [{ id: "ramp", label: "Ramp", score: 50, evidence: [] }],
    };
    const b: DeckHealth = {
      overall: 72,
      categories: [{ id: "ramp", label: "Ramp", score: 80, evidence: [] }],
    };
    expect(compareHealth(a, b).map((r) => [r.id, r.delta])).toEqual([
      ["overall", 12],
      ["ramp", 30],
    ]);
  });
});
