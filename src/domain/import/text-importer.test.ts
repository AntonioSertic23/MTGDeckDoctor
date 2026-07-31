import { describe, expect, it } from "vitest";
import { parseDecklist } from "@/domain/import/text-importer";

describe("parseDecklist", () => {
  it("parses quantities, commander section, and annotations", () => {
    const result = parseDecklist(`
// Commander
1 Muldrotha, the Gravetide

Deck
1 Sol Ring (C21) 263
2 Arcane Signet
Rhystic Study *CMDR*
1 Fire // Ice
`);

    expect(result.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Muldrotha, the Gravetide", quantity: 1, isCommander: true }),
        expect.objectContaining({
          name: "Sol Ring",
          quantity: 1,
          setCode: "c21",
          collectorNumber: "263",
        }),
        expect.objectContaining({ name: "Arcane Signet", quantity: 2 }),
        expect.objectContaining({ name: "Rhystic Study", isCommander: true }),
        expect.objectContaining({ name: "Fire // Ice", quantity: 1 }),
      ]),
    );
  });

  it("skips sideboard and maybeboard sections", () => {
    const result = parseDecklist(`
1 Sol Ring
Sideboard
1 Negate
Maybeboard
1 Counterspell
`);

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.name).toBe("Sol Ring");
  });

  it("keeps Archidekt set and collector for printing-accurate resolve", () => {
    const result = parseDecklist(`
1x Access Tunnel (pw26) 9 [Land]
1x Alhammarret's Archive (c21) 233 [Draw]
1x Arcane Signet (ltc) 273 [Ramp]
1x Basilica Screecher (gtc) 58 [Lifegain]
`);

    expect(result.cards).toEqual([
      {
        name: "Access Tunnel",
        quantity: 1,
        isCommander: false,
        setCode: "pw26",
        collectorNumber: "9",
      },
      {
        name: "Alhammarret's Archive",
        quantity: 1,
        isCommander: false,
        setCode: "c21",
        collectorNumber: "233",
      },
      {
        name: "Arcane Signet",
        quantity: 1,
        isCommander: false,
        setCode: "ltc",
        collectorNumber: "273",
      },
      {
        name: "Basilica Screecher",
        quantity: 1,
        isCommander: false,
        setCode: "gtc",
        collectorNumber: "58",
      },
    ]);
  });

  it("keeps The List collectors, foil markers, and Commander category tags", () => {
    const result = parseDecklist(`
1x Bubbling Muck (plst) UDS-54 [Ramp]
1x Sword of War and Peace (plst) 2XM-300 [Protection]
1x Diabolic Tutor (pw24) 13 *F* [Tutor]
1x Gollum, Obsessed Stalker (ltc) 26 [Commander{top}]
27x Swamp (msh) 291 [Land]
`);

    expect(result.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Bubbling Muck",
          setCode: "plst",
          collectorNumber: "UDS-54",
        }),
        expect.objectContaining({
          name: "Sword of War and Peace",
          setCode: "plst",
          collectorNumber: "2XM-300",
        }),
        expect.objectContaining({
          name: "Diabolic Tutor",
          setCode: "pw24",
          collectorNumber: "13",
          foil: true,
        }),
        expect.objectContaining({
          name: "Gollum, Obsessed Stalker",
          isCommander: true,
          setCode: "ltc",
          collectorNumber: "26",
        }),
        expect.objectContaining({ name: "Swamp", quantity: 27, setCode: "msh", collectorNumber: "291" }),
      ]),
    );
    expect(result.cards.reduce((sum, c) => sum + c.quantity, 0)).toBe(31);
  });
});
