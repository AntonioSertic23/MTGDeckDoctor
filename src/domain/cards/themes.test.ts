import { describe, expect, it } from "vitest";
import { detectThemes } from "@/domain/cards/themes";
import type { Card } from "@/domain/types";

function card(partial: Partial<Card> & Pick<Card, "oracleId" | "name">): Card {
  return {
    scryfallId: partial.oracleId,
    manaCost: "{2}{G}",
    manaValue: 3,
    typeLine: "Creature",
    oracleText: "",
    colors: ["G"],
    colorIdentity: ["G"],
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

describe("detectThemes", () => {
  it("tags Food cards as FOOD, not SACRIFICE", () => {
    const themes = detectThemes(
      card({
        oracleId: "1",
        name: "Gilded Goose",
        typeLine: "Creature — Bird",
        oracleText: "{T}: Create a Food token. {1}{G}, {T}: Sacrifice a Food: Add one mana of any color.",
      }),
    );
    expect(themes).toContain("FOOD");
    expect(themes).not.toContain("SACRIFICE");
  });

  it("still tags real aristocrats as SACRIFICE", () => {
    const themes = detectThemes(
      card({
        oracleId: "2",
        name: "Viscera Seer",
        typeLine: "Creature — Vampire Wizard",
        oracleText: "Sacrifice a creature: Scry 1.",
        colorIdentity: ["B"],
        colors: ["B"],
      }),
    );
    expect(themes).toContain("SACRIFICE");
  });

  it("does not treat every artifact as ARTIFACTS theme", () => {
    const themes = detectThemes(
      card({
        oracleId: "3",
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
    expect(themes).not.toContain("ARTIFACTS");
  });

  it("does not treat every ETB as BLINK", () => {
    const themes = detectThemes(
      card({
        oracleId: "4",
        name: "Elvish Visionary",
        typeLine: "Creature — Elf Shaman",
        oracleText: "When Elvish Visionary enters, draw a card.",
      }),
    );
    expect(themes).not.toContain("BLINK");
  });
});
