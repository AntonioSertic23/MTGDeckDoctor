import { describe, expect, it } from "vitest";
import {
  buildSharedCardIndex,
  findConflicts,
  findSharedCards,
} from "@/domain/sharing/shared-cards";
import type { Card, DeckWithCards } from "@/domain/types";

function card(oracleId: string, name: string): Card {
  return {
    oracleId,
    scryfallId: oracleId,
    name,
    manaCost: "{1}",
    manaValue: 1,
    typeLine: "Artifact",
    oracleText: "",
    colors: [],
    colorIdentity: [],
    keywords: [],
    producedMana: [],
    power: null,
    toughness: null,
    imageUri: null,
    setCode: "c21",
    rarity: "rare",
    prices: { usd: null, eur: null },
    legalities: {},
    updatedAt: new Date().toISOString(),
  };
}

function deck(id: string, name: string, oracleIds: string[]): DeckWithCards {
  return {
    deck: {
      id,
      name,
      format: "commander",
      commanderOracleIds: [],
      createdAt: "",
      updatedAt: "",
    },
    cards: oracleIds.map((oracleId) => ({ oracleId, quantity: 1 })),
  };
}

describe("shared cards", () => {
  const decks = [
    deck("a", "Deck A", ["sol", "rhystic"]),
    deck("b", "Deck B", ["sol", "swords"]),
    deck("c", "Deck C", ["rhystic"]),
  ];

  const cards = new Map([
    ["sol", card("sol", "Sol Ring")],
    ["rhystic", card("rhystic", "Rhystic Study")],
    ["swords", card("swords", "Swords to Plowshares")],
  ]);

  it("indexes which decks contain each card", () => {
    const usage = buildSharedCardIndex(decks, cards);
    const shared = findSharedCards(usage);

    expect(shared.find((u) => u.oracleId === "sol")?.deckNames).toEqual(["Deck A", "Deck B"]);
    expect(shared.find((u) => u.oracleId === "rhystic")?.deckNames).toEqual(["Deck A", "Deck C"]);
    expect(shared.some((u) => u.oracleId === "swords")).toBe(false);
  });

  it("detects inventory conflicts only when ownership is recorded", () => {
    const usage = buildSharedCardIndex(decks, cards, [{ oracleId: "rhystic", quantity: 1 }]);
    const conflicts = findConflicts(usage);
    const rhystic = conflicts.find((u) => u.oracleId === "rhystic");

    // Two decks list one copy each → required 2, owned 1 → shortage 1.
    expect(rhystic).toMatchObject({ conflict: true, shortage: 1, copiesOwned: 1, copiesRequired: 2 });
    expect(findConflicts(buildSharedCardIndex(decks, cards))).toHaveLength(0);
  });
});
