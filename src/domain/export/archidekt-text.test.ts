import { describe, expect, it } from "vitest";
import { formatArchidektDecklist } from "@/domain/export/archidekt-text";
import { parseDecklist } from "@/domain/import/text-importer";
import type { Card } from "@/domain/types";

function card(partial: Partial<Card> & Pick<Card, "oracleId" | "name">): Card {
  return {
    scryfallId: partial.oracleId,
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
    rarity: "common",
    prices: { usd: null, eur: null },
    legalities: {},
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

describe("formatArchidektDecklist", () => {
  it("emits commander section and Archidekt-style lines", () => {
    const text = formatArchidektDecklist(
      [
        {
          card: card({
            oracleId: "cmd",
            name: "Atraxa, Praetors' Voice",
            setCode: "c16",
            typeLine: "Legendary Creature — Phyrexian Angel Horror",
          }),
          quantity: 1,
          roles: [],
          isCommander: true,
        },
        {
          card: card({ oracleId: "sol", name: "Sol Ring", setCode: "C21" }),
          quantity: 1,
          roles: ["RAMP"],
        },
        {
          card: card({
            oracleId: "forest",
            name: "Forest",
            setCode: "one",
            typeLine: "Basic Land — Forest",
          }),
          quantity: 8,
          roles: ["LAND"],
        },
      ],
      ["cmd"],
    );

    expect(text).toContain("// Commander");
    expect(text).toContain("1x Atraxa, Praetors' Voice (c16) [Commander]");
    expect(text).toContain("// Deck");
    expect(text).toContain("1x Sol Ring (c21) [Ramp]");
    expect(text).toContain("8x Forest (one) [Land]");
  });

  it("round-trips through the text importer", () => {
    const text = formatArchidektDecklist(
      [
        {
          card: card({ oracleId: "cmd", name: "Green Commander", setCode: "mh3" }),
          quantity: 1,
          isCommander: true,
        },
        {
          card: card({ oracleId: "sol", name: "Sol Ring", setCode: "c21" }),
          quantity: 1,
          roles: ["RAMP"],
        },
      ],
      ["cmd"],
    );

    const parsed = parseDecklist(text);
    expect(parsed.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Green Commander", isCommander: true, setCode: "mh3" }),
        expect.objectContaining({ name: "Sol Ring", quantity: 1, setCode: "c21" }),
      ]),
    );
  });
});
