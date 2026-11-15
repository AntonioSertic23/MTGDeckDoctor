import { describe, expect, it } from "vitest";
import {
  colorSortKey,
  eurPrice,
  groupEntriesByType,
  primaryType,
  sortDeckEntries,
} from "@/domain/decks/sort-entries";
import type { Card, ResolvedDeckEntry } from "@/domain/types";

function entry(
  partial: Partial<Card> & Pick<Card, "oracleId" | "name">,
  extra: Partial<ResolvedDeckEntry> = {},
): ResolvedDeckEntry {
  return {
    card: {
      scryfallId: partial.oracleId,
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
      prices: { usd: null, eur: null },
      legalities: {},
      updatedAt: "",
      ...partial,
    },
    quantity: 1,
    roles: [],
    themes: [],
    isCommander: false,
    ...extra,
  };
}

describe("primaryType", () => {
  it("prefers creature over artifact for artifact creatures", () => {
    expect(primaryType("Artifact Creature — Golem")).toBe("creature");
  });

  it("falls back to other", () => {
    expect(primaryType("Kindred Phenomenon")).toBe("other");
  });
});

describe("colorSortKey", () => {
  it("orders by color count then WUBRG, colorless last", () => {
    const keys = [
      colorSortKey(["G", "W"]),
      colorSortKey([]),
      colorSortKey(["U"]),
      colorSortKey(["W"]),
    ].sort();
    expect(keys).toEqual(["01-U", "01-W", "02-WG", "99"].sort());
    expect(colorSortKey(["G", "W"])).toBe("02-WG");
  });
});

describe("eurPrice", () => {
  it("parses prices and rejects missing ones", () => {
    expect(eurPrice({ eur: "1.25" })).toBe(1.25);
    expect(eurPrice({ eur: null })).toBeNull();
    expect(eurPrice(null)).toBeNull();
  });
});

describe("sortDeckEntries", () => {
  const commander = entry({ oracleId: "c", name: "Zeta Commander" }, { isCommander: true });
  const land = entry({ oracleId: "l", name: "Alpha Land", typeLine: "Land", manaValue: 0 });
  const bolt = entry({
    oracleId: "b",
    name: "Bolt",
    typeLine: "Instant",
    manaValue: 1,
    prices: { usd: null, eur: "2.00" },
  });
  const giant = entry({
    oracleId: "g",
    name: "Giant",
    typeLine: "Creature — Giant",
    manaValue: 6,
    prices: { usd: null, eur: "0.10" },
  });

  it("keeps commanders first", () => {
    const sorted = sortDeckEntries([land, bolt, commander], "name");
    expect(sorted.map((e) => e.card.name)).toEqual(["Zeta Commander", "Alpha Land", "Bolt"]);
  });

  it("sorts by type in decklist order", () => {
    const sorted = sortDeckEntries([land, bolt, giant], "type");
    expect(sorted.map((e) => e.card.oracleId)).toEqual(["g", "b", "l"]);
  });

  it("sorts by price descending, unpriced last", () => {
    const sorted = sortDeckEntries([land, giant, bolt], "price");
    expect(sorted.map((e) => e.card.oracleId)).toEqual(["b", "g", "l"]);
  });

  it("sorts by mana value", () => {
    const sorted = sortDeckEntries([giant, land, bolt], "manaValue");
    expect(sorted.map((e) => e.card.oracleId)).toEqual(["l", "b", "g"]);
  });
});

describe("groupEntriesByType", () => {
  it("puts commanders first and keeps type order", () => {
    const groups = groupEntriesByType([
      entry({ oracleId: "l", name: "Forest", typeLine: "Basic Land — Forest" }),
      entry({ oracleId: "c", name: "Cmd", typeLine: "Legendary Creature" }, { isCommander: true }),
      entry({ oracleId: "x", name: "Elf", typeLine: "Creature — Elf" }),
    ]);
    expect(groups.map((g) => g.id)).toEqual(["commander", "creature", "land"]);
  });
});
