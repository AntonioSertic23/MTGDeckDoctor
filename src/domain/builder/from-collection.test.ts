import { describe, expect, it } from "vitest";
import { buildDeckFromCollection, isCommanderCandidate } from "@/domain/builder/from-collection";
import { quotasForCommander } from "@/domain/builder/quotas";
import type { Card } from "@/domain/types";

function card(partial: Partial<Card> & Pick<Card, "oracleId" | "name">): Card {
  return {
    scryfallId: partial.oracleId,
    manaCost: "{2}{G}",
    manaValue: 3,
    typeLine: "Creature — Beast",
    oracleText: "",
    colors: ["G"],
    colorIdentity: partial.colorIdentity ?? ["G"],
    keywords: [],
    producedMana: [],
    power: "2",
    toughness: "2",
    imageUri: null,
    setCode: "test",
    rarity: "common",
    prices: { usd: null, eur: null },
    legalities: {},
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

function many(
  prefix: string,
  count: number,
  extra: Partial<Card> & { oracleText: string; typeLine: string },
): Card[] {
  return Array.from({ length: count }, (_, i) =>
    card({
      oracleId: `${prefix}-${i}`,
      name: `${prefix} ${i}`,
      ...extra,
    }),
  );
}

describe("quotasForCommander", () => {
  it("asks for more ramp/lands on an expensive green commander", () => {
    const cheap = quotasForCommander(
      card({
        oracleId: "c1",
        name: "Cheap",
        typeLine: "Legendary Creature — Soldier",
        manaValue: 2,
        manaCost: "{1}{W}",
        colorIdentity: ["W"],
        colors: ["W"],
      }),
    );
    const expensiveGreen = quotasForCommander(
      card({
        oracleId: "c2",
        name: "Big Green",
        typeLine: "Legendary Creature — Elemental",
        manaValue: 6,
        manaCost: "{4}{G}{G}",
        colorIdentity: ["G"],
        colors: ["G"],
        oracleText: "Creatures you control get +1/+1.",
      }),
    );

    expect(expensiveGreen.ramp).toBeGreaterThan(cheap.ramp);
    expect(expensiveGreen.lands).toBeGreaterThanOrEqual(cheap.lands);
  });

  it("leans into draw/interaction for blue commanders", () => {
    const blue = quotasForCommander(
      card({
        oracleId: "c3",
        name: "Blue Mage",
        typeLine: "Legendary Creature — Wizard",
        manaValue: 3,
        manaCost: "{2}{U}",
        colorIdentity: ["U"],
        colors: ["U"],
        oracleText: "Whenever you cast an instant or sorcery spell, draw a card.",
      }),
    );
    const green = quotasForCommander(
      card({
        oracleId: "c4",
        name: "Green Mage",
        typeLine: "Legendary Creature — Druid",
        manaValue: 3,
        manaCost: "{2}{G}",
        colorIdentity: ["G"],
        colors: ["G"],
      }),
    );

    expect(blue.cardDraw).toBeGreaterThan(green.cardDraw);
    expect(blue.interaction).toBeGreaterThan(green.interaction);
  });
});

describe("buildDeckFromCollection", () => {
  it("builds a 100-card list and stacks basic lands", () => {
    const commander = card({
      oracleId: "cmd",
      name: "Green Commander",
      typeLine: "Legendary Creature — Elf Druid",
      manaCost: "{2}{G}{G}",
      manaValue: 4,
      oracleText: "Creatures you control get +1/+1.",
      power: "3",
      toughness: "3",
      colorIdentity: ["G"],
    });

    const owned = [
      { card: commander, quantity: 1 },
      {
        card: card({
          oracleId: "forest",
          name: "Forest",
          typeLine: "Basic Land — Forest",
          oracleText: "{T}: Add {G}.",
          manaCost: "",
          manaValue: 0,
          colors: [],
          colorIdentity: [],
          producedMana: ["G"],
          power: null,
          toughness: null,
        }),
        quantity: 40,
      },
      // Many unique nonbasics — must not consume every land slot as 1x each.
      ...many("dual", 30, {
        typeLine: "Land",
        oracleText: "{T}: Add {G}.",
        manaCost: "",
        manaValue: 0,
        colors: [],
        colorIdentity: [],
        producedMana: ["G"],
        power: null,
        toughness: null,
      }).map((c) => ({ card: c, quantity: 1 })),
      ...many("ramp", 12, {
        typeLine: "Sorcery",
        oracleText:
          "Search your library for up to two basic land cards, put one onto the battlefield tapped and the other into your hand.",
        manaCost: "{2}{G}",
        manaValue: 3,
        power: null,
        toughness: null,
      }).map((c) => ({ card: c, quantity: 1 })),
      ...many("draw", 12, {
        typeLine: "Sorcery",
        oracleText: "You draw three cards.",
        manaCost: "{3}{G}",
        manaValue: 4,
        power: null,
        toughness: null,
      }).map((c) => ({ card: c, quantity: 1 })),
      ...many("kill", 10, {
        typeLine: "Instant",
        oracleText: "Destroy target creature.",
        manaCost: "{1}{G}",
        manaValue: 2,
        power: null,
        toughness: null,
      }).map((c) => ({ card: c, quantity: 1 })),
      ...many("wipe", 4, {
        typeLine: "Sorcery",
        oracleText: "Destroy all creatures.",
        manaCost: "{4}{G}",
        manaValue: 5,
        power: null,
        toughness: null,
      }).map((c) => ({ card: c, quantity: 1 })),
      ...many("hexproof", 8, {
        typeLine: "Instant",
        oracleText: "Target creature you control gains hexproof until end of turn.",
        manaCost: "{G}",
        manaValue: 1,
        power: null,
        toughness: null,
      }).map((c) => ({ card: c, quantity: 1 })),
      ...many("finisher", 4, {
        typeLine: "Creature — Beast",
        oracleText: "Trample",
        power: "7",
        toughness: "7",
        manaValue: 6,
        manaCost: "{5}{G}",
      }).map((c) => ({ card: c, quantity: 1 })),
      ...many("vanilla", 30, {
        typeLine: "Creature — Beast",
        oracleText: "",
        power: "2",
        toughness: "2",
      }).map((c) => ({ card: c, quantity: 1 })),
    ];

    const result = buildDeckFromCollection(commander, owned);
    const targets = quotasForCommander(commander);

    expect(result.totalCards).toBe(100);
    expect(result.cards.some((c) => c.card.oracleId === "cmd")).toBe(true);

    const forest = result.cards.find((c) => c.card.oracleId === "forest");
    expect(forest).toBeTruthy();
    expect(forest!.quantity).toBeGreaterThan(1);

    const landQuota = result.quotas.find((q) => q.id === "LAND");
    expect(landQuota?.want).toBe(targets.lands);
    expect(landQuota?.have).toBe(targets.lands);
  });

  it("reports gaps when the collection is too thin", () => {
    const commander = card({
      oracleId: "cmd",
      name: "Green Commander",
      typeLine: "Legendary Creature — Elf",
      colorIdentity: ["G"],
    });
    const result = buildDeckFromCollection(commander, [
      { card: commander, quantity: 1 },
      {
        card: card({
          oracleId: "forest",
          name: "Forest",
          typeLine: "Basic Land — Forest",
          oracleText: "{T}: Add {G}.",
          manaCost: "",
          manaValue: 0,
          colors: [],
          colorIdentity: [],
          producedMana: ["G"],
          power: null,
          toughness: null,
        }),
        quantity: 8,
      },
    ]);

    expect(result.totalCards).toBeLessThan(100);
    expect(result.gaps.some((g) => g.id === "LAND" && g.have < g.want)).toBe(true);
    expect(result.gaps.some((g) => g.id === "RAMP")).toBe(true);
  });
});

describe("isCommanderCandidate", () => {
  it("accepts legendary creatures", () => {
    expect(
      isCommanderCandidate(
        card({
          oracleId: "x",
          name: "Hero",
          typeLine: "Legendary Creature — Human",
        }),
      ),
    ).toBe(true);
  });

  it("rejects non-legendary creatures", () => {
    expect(
      isCommanderCandidate(
        card({
          oracleId: "x",
          name: "Bear",
          typeLine: "Creature — Bear",
        }),
      ),
    ).toBe(false);
  });
});
