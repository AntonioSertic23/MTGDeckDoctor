import { describe, expect, it } from "vitest";
import { analyzeDeck, resolveDeck } from "@/domain/analysis/analyze";
import { suggestAdditions } from "@/domain/recommendations/additions";
import type { Card, DeckWithCards } from "@/domain/types";

function card(partial: Partial<Card> & Pick<Card, "oracleId" | "name">): Card {
  return {
    scryfallId: partial.oracleId,
    manaCost: "{2}{G}",
    manaValue: 3,
    typeLine: "Creature",
    oracleText: "",
    colors: ["G"],
    colorIdentity: partial.colorIdentity ?? ["G"],
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

function buildGreenDeck(): { deck: DeckWithCards; cards: Map<string, Card> } {
  const deck: DeckWithCards = {
    deck: {
      id: "d1",
      name: "Test",
      format: "commander",
      commanderOracleIds: ["cmd"],
      ready: false,
      timesBrought: 0,
      timesPlayed: 0,
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
      power: null,
      toughness: null,
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
      power: null,
      toughness: null,
    }),
  );
  for (let i = 0; i < 61; i++) {
    cards.set(
      `filler${i}`,
      card({
        oracleId: `filler${i}`,
        name: `Random Creature ${i}`,
        typeLine: "Creature — Beast",
        oracleText: "Trample",
        manaCost: "{4}{G}",
        manaValue: 5,
        power: "4",
        toughness: "4",
      }),
    );
  }

  return { deck, cards };
}

describe("suggestCuts", () => {
  it("does not recommend cutting Sol Ring or Arcane Signet", () => {
    const { deck, cards } = buildGreenDeck();
    const resolved = resolveDeck(deck, cards);
    const analysis = analyzeDeck(resolved);

    expect(analysis.cuts.map((c) => c.name)).not.toContain("Sol Ring");
    expect(analysis.cuts.map((c) => c.name)).not.toContain("Arcane Signet");
  });
});

describe("suggestAdditions", () => {
  it("does not push sacrifice finishers into a non-sacrifice green deck", () => {
    const { deck, cards } = buildGreenDeck();
    // Give the deck black so sac staples are legal identity-wise — we want
    // theme mismatch, not colour filter, to be the reason they drop out.
    cards.get("cmd")!.colorIdentity = ["B", "G"];
    for (const entry of deck.cards) {
      const c = cards.get(entry.oracleId);
      if (c && !c.typeLine.includes("Land") && entry.oracleId !== "sol" && entry.oracleId !== "signet") {
        c.colorIdentity = ["B", "G"];
      }
    }

    const resolved = resolveDeck(deck, cards);
    const analysis = analyzeDeck(resolved);
    const additions = suggestAdditions(resolved, analysis.statistics, analysis.synergy);

    const sacFinishers = ["Zulaport Cutthroat", "Blood Artist", "Viscera Seer", "Ashnod's Altar"];
    for (const name of sacFinishers) {
      expect(additions.map((a) => a.name)).not.toContain(name);
    }
  });

  it("still suggests utility staples when a role gap exists", () => {
    const { deck, cards } = buildGreenDeck();
    const resolved = resolveDeck(deck, cards);
    const analysis = analyzeDeck(resolved);
    const additions = suggestAdditions(resolved, analysis.statistics, analysis.synergy);

    expect(additions.length).toBeGreaterThan(0);
    const utility = additions.some((a) =>
      a.roles.some((r) =>
        ["RAMP", "CARD_DRAW", "SPOT_REMOVAL", "BOARD_WIPE", "PROTECTION"].includes(r),
      ),
    );
    expect(utility).toBe(true);
  });
});
