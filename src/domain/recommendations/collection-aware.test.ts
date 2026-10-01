import { describe, expect, it } from "vitest";
import { analyzeDeck, resolveDeck } from "@/domain/analysis/analyze";
import { suggestAdditions } from "@/domain/recommendations/additions";
import { buildCollectionContext } from "@/domain/recommendations/collection-aware";
import { suggestCuts } from "@/domain/recommendations/cuts";
import type { Card, DeckWithCards, InventoryItem } from "@/domain/types";

function card(partial: Partial<Card> & Pick<Card, "oracleId" | "name">): Card {
  return {
    scryfallId: partial.oracleId,
    manaCost: "{2}{G}",
    manaValue: 3,
    typeLine: "Sorcery",
    oracleText: "",
    colors: ["G"],
    colorIdentity: partial.colorIdentity ?? ["G"],
    keywords: [],
    producedMana: [],
    power: null,
    toughness: null,
    imageUri: null,
    setCode: "test",
    rarity: "rare",
    prices: { usd: null, eur: null },
    legalities: {},
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

function buildGreenDeck(): { deck: DeckWithCards; cards: Map<string, Card> } {
  const deck: DeckWithCards = {
    deck: {
      id: "d1",
      name: "Test",
      format: "commander",
      commanderOracleIds: ["cmd"],
      ready: false,
      createdAt: "",
      updatedAt: "",
    },
    cards: [
      { oracleId: "cmd", quantity: 1 },
      ...Array.from({ length: 36 }, (_, i) => ({ oracleId: `land${i}`, quantity: 1 })),
      { oracleId: "sol", quantity: 1 },
      { oracleId: "signet", quantity: 1 },
      ...Array.from({ length: 61 }, (_, i) => ({ oracleId: `filler${i}`, quantity: 1 })),
    ],
  };

  const cards = new Map<string, Card>();
  cards.set(
    "cmd",
    card({
      oracleId: "cmd",
      name: "Green Commander",
      typeLine: "Legendary Creature — Elf Druid",
      colorIdentity: ["G"],
      colors: ["G"],
      manaCost: "{2}{G}{G}",
      manaValue: 4,
      oracleText: "Creatures you control get +1/+1.",
      power: "3",
      toughness: "3",
    }),
  );
  for (let i = 0; i < 36; i++) {
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
        power: null,
        toughness: null,
      }),
    );
  }
  cards.set(
    "sol",
    card({
      oracleId: "sol",
      name: "Sol Ring",
      typeLine: "Artifact",
      oracleText: "{T}: Add {C}{C}.",
      manaCost: "{1}",
      manaValue: 1,
      colors: [],
      colorIdentity: [],
    }),
  );
  cards.set(
    "signet",
    card({
      oracleId: "signet",
      name: "Arcane Signet",
      typeLine: "Artifact",
      oracleText: "{T}: Add one mana of any color in your commander's color identity.",
      manaCost: "{2}",
      manaValue: 2,
      colors: [],
      colorIdentity: [],
    }),
  );
  for (let i = 0; i < 61; i++) {
    cards.set(
      `filler${i}`,
      card({
        oracleId: `filler${i}`,
        name: `Green Vanilla ${i}`,
        typeLine: "Creature — Beast",
        oracleText: "",
        manaCost: "{2}{G}",
        manaValue: 3,
        power: "2",
        toughness: "2",
      }),
    );
  }
  return { deck, cards };
}

describe("collection-aware additions", () => {
  it("ranks an owned gap-filler above buy-in staples", () => {
    const { deck, cards } = buildGreenDeck();
    const resolved = resolveDeck(deck, cards);
    const analysis = analyzeDeck(resolved);

    const ownedRamp = card({
      oracleId: "my-ramp",
      name: "Personal Cultivate",
      typeLine: "Sorcery",
      oracleText: "Search your library for up to two basic land cards, put one onto the battlefield tapped and the other into your hand.",
      manaCost: "{2}{G}",
      manaValue: 3,
    });

    const inventory: InventoryItem[] = [{ oracleId: "my-ramp", quantity: 1 }];
    const collection = buildCollectionContext(
      "d1",
      deck.cards.map((c) => c.oracleId),
      inventory,
      [ownedRamp],
      [deck],
    );

    const additions = suggestAdditions(
      resolved,
      analysis.statistics,
      analysis.synergy,
      undefined,
      12,
      collection,
    );

    expect(additions[0]?.name).toBe("Personal Cultivate");
    expect(additions[0]?.ownedCopies).toBe(1);
    expect(additions[0]?.fromCollection).toBe(true);
    expect(additions[0]?.reasons.some((r) => r.startsWith("You own"))).toBe(true);
  });

  it("marks a staple you already own", () => {
    const { deck, cards } = buildGreenDeck();
    const resolved = resolveDeck(deck, cards);
    const analysis = analyzeDeck(resolved);

    const kodama = card({
      oracleId: "kodama",
      name: "Kodama's Reach",
      typeLine: "Sorcery",
      oracleText: "Search your library for up to two basic land cards, put one onto the battlefield tapped and the other into your hand.",
    });

    const collection = buildCollectionContext(
      "d1",
      deck.cards.map((c) => c.oracleId),
      [{ oracleId: "kodama", quantity: 2 }],
      [kodama],
      [deck],
    );

    const additions = suggestAdditions(
      resolved,
      analysis.statistics,
      analysis.synergy,
      undefined,
      12,
      collection,
    );
    const hit = additions.find((a) => a.name === "Kodama's Reach");
    expect(hit?.ownedCopies).toBe(2);
  });
});

describe("collection-aware cuts", () => {
  it("flags a card that is shared and under-owned", () => {
    const { deck, cards } = buildGreenDeck();
    const resolved = resolveDeck(deck, cards);
    const analysis = analyzeDeck(resolved);

    const other: DeckWithCards = {
      deck: { ...deck.deck, id: "d2", name: "Second Deck" },
      cards: [{ oracleId: "filler0", quantity: 1 }],
    };

    const collection = buildCollectionContext(
      "d1",
      deck.cards.map((c) => c.oracleId),
      [{ oracleId: "filler0", quantity: 1 }],
      [cards.get("filler0")!],
      [deck, other],
    );

    const cuts = suggestCuts(
      resolved,
      analysis.statistics,
      analysis.synergy,
      analysis.problems,
      12,
      { collection },
    );
    const hit = cuts.find((c) => c.oracleId === "filler0");
    expect(hit).toBeTruthy();
    expect(hit?.ownedCopies).toBe(1);
    expect(hit?.otherDeckNames).toContain("Second Deck");
    expect(hit?.reasons.some((r) => r.includes("Shared with Second Deck"))).toBe(true);
  });
});
