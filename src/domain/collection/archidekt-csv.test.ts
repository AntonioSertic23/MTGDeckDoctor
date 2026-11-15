import { describe, expect, it } from "vitest";
import {
  isFoilFinish,
  parseArchidektCollectionCsv,
  parsePrice,
} from "@/domain/collection/archidekt-csv";
import {
  buildInventoryDetails,
  filterResolvedAgainstOwned,
  mergeCollectionImport,
} from "@/domain/collection/merge-inventory";

const SAMPLE = `Quantity,Name,Finish,Condition,Date Added,Language,Purchase Price,Tags,Edition Name,Edition Code,Multiverse Id,Scryfall ID,MTGO ID,Collector Number,Mana Value,Colors,Identities,Mana cost,Types,Sub-types,Super-types,Rarity,Price (Card Kingdom),Price (TCG Player),Price (Star City Games),Price (Card Hoarder),Price (Card Market),Scryfall Oracle ID
1,Abrade,Normal,NM,2026-06-08,EN,,,The Lost Caverns of Ixalan,lci,636839,47f39b5e-2e85-4f31-bbab-0b0bf58f701d,118074,131,2,Red,Red,{1}{R},Instant,,,common,0.35,0.30,0.29,0.03,0.17,f9db72dc-9a5b-48a4-a86e-7464d9a2166a
1,"Adéwalé, Breaker of Chains",Normal,NM,2026-06-12,EN,,,Assassin's Creed,acr,668162,c2e0ee24-94fc-4042-b3cf-a5a8a2432ba4,127662,136,3,"Black,Blue","Blue,Black",{1}{U}{B},Creature,"Human,Assassin,Pirate",Legendary,uncommon,0.35,0.26,0.29,0.04,0.10,e30d9e08-cf88-4e2d-95e1-7144d8fea5c7
1,"Adéwalé, Breaker of Chains",Foil,NM,2026-06-12,EN,,,Assassin's Creed,acr,667634,914efc24-5c3a-4d22-9d77-fce337a08d4d,128054,44,3,"Black,Blue","Blue,Black",{1}{U}{B},Creature,"Human,Assassin,Pirate",Legendary,uncommon,0.49,0.31,0.39,0.00,0.25,e30d9e08-cf88-4e2d-95e1-7144d8fea5c7
4,Action News Crew,Normal,NM,2026-05-06,EN,,,Teenage Mutant Ninja Turtles,tmt,0,bc0f5ca8-47bd-4451-8fd1-a312ff7d31ec,147625,1,2,White,White,{1}{W},Creature,"Human,Citizen",,common,0.35,0.08,0.29,0.03,0.10,a9d68cf5-3055-4ec9-9893-244bfd7046be
2,Mystery Card,Normal,NM,2026-01-01,EN,,,Unknown Set,unk,0,,,,,,White,White,,,,common,,,,,,,
`;

describe("parseArchidektCollectionCsv", () => {
  it("aggregates foil and normal printings by oracle id", () => {
    const result = parseArchidektCollectionCsv(SAMPLE);
    const ade = result.entries.find((e) => e.oracleId === "e30d9e08-cf88-4e2d-95e1-7144d8fea5c7");
    expect(ade?.quantity).toBe(2);
    expect(ade?.needsNameResolve).toBe(false);
  });

  it("keeps quantity from a multi-copy row", () => {
    const result = parseArchidektCollectionCsv(SAMPLE);
    const crew = result.entries.find((e) => e.oracleId === "a9d68cf5-3055-4ec9-9893-244bfd7046be");
    expect(crew?.quantity).toBe(4);
  });

  it("queues rows without an oracle id for name resolve", () => {
    const result = parseArchidektCollectionCsv(SAMPLE);
    const mystery = result.entries.find((e) => e.name === "Mystery Card");
    expect(mystery).toMatchObject({
      oracleId: null,
      quantity: 2,
      needsNameResolve: true,
    });
  });

  it("counts data rows", () => {
    const result = parseArchidektCollectionCsv(SAMPLE);
    expect(result.rowCount).toBe(5);
    expect(result.entries).toHaveLength(4);
  });
});

describe("mergeCollectionImport", () => {
  it("skips oracle ids already in inventory", () => {
    const parsed = parseArchidektCollectionCsv(SAMPLE);
    const merge = mergeCollectionImport(parsed.entries, [
      { oracleId: "f9db72dc-9a5b-48a4-a86e-7464d9a2166a", quantity: 1 },
    ]);

    expect(merge.skippedExisting).toBe(1);
    expect(merge.toAdd.map((i) => i.oracleId).sort()).toEqual([
      "a9d68cf5-3055-4ec9-9893-244bfd7046be",
      "e30d9e08-cf88-4e2d-95e1-7144d8fea5c7",
    ]);
    expect(merge.pendingNameResolve).toHaveLength(1);
  });

  it("filterResolvedAgainstOwned skips duplicates after name resolve", () => {
    const { toAdd, skippedExisting } = filterResolvedAgainstOwned(
      [
        { oracleId: "aaa", quantity: 1 },
        { oracleId: "bbb", quantity: 2 },
      ],
      ["aaa"],
    );
    expect(skippedExisting).toBe(1);
    expect(toAdd).toEqual([{ oracleId: "bbb", quantity: 2 }]);
  });
});

describe("finish and purchase price", () => {
  const PRICED = `Quantity,Name,Finish,Purchase Price,Scryfall Oracle ID
2,Sol Ring,Normal,1.50,6ad8011d-3471-4369-9d68-b264cc027487
1,Sol Ring,Foil,"4,00",6ad8011d-3471-4369-9d68-b264cc027487
1,Arcane Signet,Etched,,a1e1a1b2-0000-4000-8000-000000000001
`;

  it("counts foil copies and sums purchase prices per oracle id", () => {
    const result = parseArchidektCollectionCsv(PRICED);
    expect(result.hasDetails).toBe(true);
    const sol = result.entries.find((e) => e.name === "Sol Ring");
    expect(sol).toMatchObject({ quantity: 3, foilQuantity: 1, purchaseEur: 7 });
    const signet = result.entries.find((e) => e.name === "Arcane Signet");
    expect(signet).toMatchObject({ foilQuantity: 1, purchaseEur: null });
  });

  it("marks files without the columns", () => {
    const result = parseArchidektCollectionCsv("Quantity,Name\n1,Sol Ring\n");
    expect(result.hasDetails).toBe(false);
    expect(result.entries[0]).toMatchObject({ foilQuantity: 0, purchaseEur: null });
  });

  it("reads finishes and price formats", () => {
    expect(isFoilFinish("Foil")).toBe(true);
    expect(isFoilFinish("Etched")).toBe(true);
    expect(isFoilFinish("Normal")).toBe(false);
    expect(isFoilFinish("Non-foil")).toBe(false);
    expect(parsePrice("1,50")).toBe(1.5);
    expect(parsePrice("€2.25")).toBe(2.25);
    expect(parsePrice("1,234.50")).toBe(1234.5);
    expect(parsePrice("")).toBeNull();
  });
});

describe("buildInventoryDetails", () => {
  it("clamps foil to the stored quantity and skips cards not in inventory", () => {
    const items = buildInventoryDetails(
      [
        { oracleId: "a", foilQuantity: 3, purchaseEur: 2 },
        { oracleId: "a", foilQuantity: 0, purchaseEur: 1 },
        { oracleId: "b", foilQuantity: 1, purchaseEur: null },
      ],
      new Map([["a", 2]]),
    );
    expect(items).toEqual([{ oracleId: "a", quantity: 2, foilQuantity: 2, purchaseEur: 3 }]);
  });
});
