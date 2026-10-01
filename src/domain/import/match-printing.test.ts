import { describe, expect, it } from "vitest";
import type { Card } from "@/domain/types";
import { pickPrinting } from "@/domain/import/match-printing";

function card(partial: Pick<Card, "oracleId" | "name" | "setCode"> & Partial<Card>): Card {
  return {
    scryfallId: partial.scryfallId ?? partial.oracleId,
    manaCost: null,
    manaValue: 0,
    typeLine: "",
    oracleText: "",
    colors: [],
    colorIdentity: [],
    keywords: [],
    producedMana: [],
    power: null,
    toughness: null,
    imageUri: partial.imageUri ?? null,
    rarity: "rare",
    prices: { usd: null, eur: null },
    legalities: {},
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...partial,
  };
}

describe("pickPrinting", () => {
  const owned = card({
    oracleId: "sol",
    name: "Sol Ring",
    setCode: "ltc",
    collectorNumber: "273",
    scryfallId: "owned",
    imageUri: "owned.jpg",
  });
  const other = card({
    oracleId: "sol",
    name: "Sol Ring",
    setCode: "cmm",
    collectorNumber: "410",
    scryfallId: "default",
    imageUri: "default.jpg",
  });

  it("keeps the set and collector from the list when a default printing is also present", () => {
    const picked = pickPrinting(
      { name: "Sol Ring", setCode: "ltc", collectorNumber: "273" },
      [other, owned],
    );
    expect(picked?.mode).toBe("exact");
    expect(picked?.card.scryfallId).toBe("owned");
  });

  it("does not use a different printing from the same set", () => {
    const showcase = card({
      oracleId: "ade",
      name: "Adéwalé, Breaker of Chains",
      setCode: "acr",
      collectorNumber: "44",
      scryfallId: "foil-art",
    });
    const regular = card({
      oracleId: "ade",
      name: "Adéwalé, Breaker of Chains",
      setCode: "acr",
      collectorNumber: "136",
      scryfallId: "regular-art",
    });
    const picked = pickPrinting(
      { name: "Adéwalé, Breaker of Chains", setCode: "acr", collectorNumber: "136" },
      [showcase, regular],
    );
    expect(picked?.card.scryfallId).toBe("regular-art");
  });
});
