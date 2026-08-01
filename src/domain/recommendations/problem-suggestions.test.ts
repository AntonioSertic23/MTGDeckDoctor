import { describe, expect, it } from "vitest";
import { analyzeDeck, resolveDeck } from "@/domain/analysis/analyze";
import type { Card, DeckWithCards } from "@/domain/types";

function card(partial: Partial<Card> & Pick<Card, "oracleId" | "name">): Card {
  return {
    scryfallId: partial.oracleId,
    manaCost: "{2}{B}",
    manaValue: 3,
    typeLine: "Creature",
    oracleText: "",
    colors: ["B"],
    colorIdentity: partial.colorIdentity ?? ["B"],
    keywords: [],
    producedMana: [],
    power: "2",
    toughness: "2",
    imageUri: null,
    setCode: "test",
    rarity: "rare",
    prices: { usd: null, eur: null },
    legalities: {},
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

describe("problem suggestions", () => {
  it("attaches spot removal staples when the deck is short on removal", () => {
    const deck: DeckWithCards = {
      deck: {
        id: "d1",
        name: "Test",
        format: "commander",
        commanderOracleIds: ["cmd"],
        createdAt: "",
        updatedAt: "",
      },
      cards: [
        { oracleId: "cmd", quantity: 1 },
        ...Array.from({ length: 35 }, (_, i) => ({ oracleId: `land${i}`, quantity: 1 })),
        ...Array.from({ length: 64 }, (_, i) => ({ oracleId: `spell${i}`, quantity: 1 })),
      ],
    };

    const cards = new Map<string, Card>();
    cards.set(
      "cmd",
      card({
        oracleId: "cmd",
        name: "Test Commander",
        typeLine: "Legendary Creature — Human Assassin",
        colorIdentity: ["B", "G"],
        colors: ["B", "G"],
        manaCost: "{2}{B}{G}",
        manaValue: 4,
      }),
    );
    for (let i = 0; i < 35; i++) {
      cards.set(
        `land${i}`,
        card({
          oracleId: `land${i}`,
          name: `Forest ${i}`,
          typeLine: "Basic Land — Forest",
          oracleText: "{T}: Add {G}.",
          manaCost: "",
          manaValue: 0,
          colors: [],
          colorIdentity: [],
        }),
      );
    }
    for (let i = 0; i < 64; i++) {
      cards.set(
        `spell${i}`,
        card({
          oracleId: `spell${i}`,
          name: `Generic Creature ${i}`,
          typeLine: "Creature — Beast",
          oracleText: "Trample",
          colorIdentity: ["G"],
          colors: ["G"],
          manaCost: "{3}{G}",
          manaValue: 4,
        }),
      );
    }

    const resolved = resolveDeck(deck, cards);
    const analysis = analyzeDeck(resolved);
    const removal = analysis.problems.find((p) => p.type === "LOW_REMOVAL");

    expect(removal).toBeTruthy();
    expect(removal?.suggestions?.length).toBeGreaterThan(0);
    expect(removal?.suggestions?.some((s) => s.roles.includes("SPOT_REMOVAL"))).toBe(true);
    expect(removal?.description).toMatch(/recommended/i);
  });
});
