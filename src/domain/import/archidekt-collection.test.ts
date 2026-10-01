import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseArchidektCollection, preferPrintings } from "@/domain/import/archidekt-collection";

const SAMPLE = `Quantity,Name,Finish,Date Added,Edition Code,Scryfall ID,Collector Number,Scryfall Oracle ID
2,"Aang, Swift Savior // Aang and La, Ocean's Fury",Normal,2026-05-10,tla,82866a0e-485a-4f7e-8c49-f7d9ff3f4ad4,204,cbf09050-39d0-463b-96db-9e22011ae0d8
1,"Adéwalé, Breaker of Chains",Normal,2026-06-12,acr,c2e0ee24-94fc-4042-b3cf-a5a8a2432ba4,136,e30d9e08-cf88-4e2d-95e1-7144d8fea5c7
1,"Adéwalé, Breaker of Chains",Foil,2026-06-12,acr,914efc24-5c3a-4d22-9d77-fce337a08d4d,44,e30d9e08-cf88-4e2d-95e1-7144d8fea5c7
2,Arcane Signet,Normal,2026-05-01,ltc,4e92354d-0000-0000-0000-000000000001,273,oracle-signet
1,Arcane Signet,Normal,2026-06-01,soc,7811dd72-0000-0000-0000-000000000002,127,oracle-signet
`;

describe("parseArchidektCollection", () => {
  it("keeps quoted names and the Scryfall printing id", () => {
    const rows = parseArchidektCollection(SAMPLE);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({
      name: "Aang, Swift Savior // Aang and La, Ocean's Fury",
      quantity: 2,
      scryfallId: "82866a0e-485a-4f7e-8c49-f7d9ff3f4ad4",
      setCode: "tla",
      collectorNumber: "204",
    });
  });

  it("prefers the printing you own the most of, then non-foil", () => {
    const preferred = preferPrintings(parseArchidektCollection(SAMPLE));
    const adewale = preferred.find((card) => card.name.startsWith("Adéwalé"));
    const signet = preferred.find((card) => card.name === "Arcane Signet");
    expect(adewale).toMatchObject({
      scryfallId: "c2e0ee24-94fc-4042-b3cf-a5a8a2432ba4",
      collectorNumber: "136",
      quantity: 2,
      printingCount: 2,
    });
    expect(signet).toMatchObject({
      scryfallId: "4e92354d-0000-0000-0000-000000000001",
      setCode: "ltc",
      quantity: 3,
      printingCount: 2,
    });
  });
});

describe("desktop Archidekt export", () => {
  const path = "/mnt/c/Users/Antonio/Desktop/archidekt-collection-export-2026-10-01.csv";

  it("loads every owned printing from the 2026-10-01 export", () => {
    if (!existsSync(path)) return;
    const rows = parseArchidektCollection(readFileSync(path, "utf8"));
    expect(rows.length).toBeGreaterThan(1000);
    expect(rows.every((row) => row.scryfallId && row.oracleId)).toBe(true);

    const preferred = preferPrintings(rows);
    const tunnel = preferred.find((card) => card.name === "Access Tunnel");
    const muck = preferred.find((card) => card.name === "Bubbling Muck");
    const archive = preferred.find((card) => card.name === "Alhammarret's Archive");
    expect(tunnel).toMatchObject({ setCode: "pw26", collectorNumber: "9" });
    expect(muck).toMatchObject({ setCode: "plst", collectorNumber: "UDS-54" });
    expect(archive).toMatchObject({ setCode: "ori", collectorNumber: "221" });
  });
});
