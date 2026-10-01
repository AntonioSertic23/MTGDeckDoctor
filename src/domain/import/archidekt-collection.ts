/**
 * Archidekt collection CSV (Collection → Export).
 * Each row is one owned printing, identified by Scryfall ID — not just the card name.
 */

export interface ArchidektCollectionRow {
  name: string;
  quantity: number;
  finish: string;
  setCode: string;
  collectorNumber: string;
  scryfallId: string;
  oracleId: string;
  dateAdded: string;
}

export interface PreferredPrinting {
  oracleId: string;
  scryfallId: string;
  name: string;
  /** Total copies owned across every printing of this card. */
  quantity: number;
  setCode: string;
  collectorNumber: string;
  /** How many different printings were collapsed into this choice. */
  printingCount: number;
}

const FINISH_RANK: Record<string, number> = {
  normal: 0,
  etched: 1,
  foil: 2,
};

export function parseArchidektCollection(csv: string): ArchidektCollectionRow[] {
  const table = parseCsv(csv);
  if (table.length < 2) {
    throw new Error("That file is empty.");
  }

  const header = table[0].map((cell) => cell.trim());
  const index = (name: string) => header.findIndex((cell) => cell.toLowerCase() === name.toLowerCase());
  const nameIdx = index("Name");
  const qtyIdx = index("Quantity");
  const finishIdx = index("Finish");
  const setIdx = index("Edition Code");
  const collectorIdx = index("Collector Number");
  const scryfallIdx = index("Scryfall ID");
  const oracleIdx = index("Scryfall Oracle ID");
  const dateIdx = index("Date Added");

  if (scryfallIdx < 0 || oracleIdx < 0 || nameIdx < 0) {
    throw new Error(
      "This is not an Archidekt collection export. Expected columns Name, Scryfall ID, and Scryfall Oracle ID.",
    );
  }

  const rows: ArchidektCollectionRow[] = [];
  for (const cells of table.slice(1)) {
    const scryfallId = (cells[scryfallIdx] ?? "").trim();
    const oracleId = (cells[oracleIdx] ?? "").trim();
    const name = (cells[nameIdx] ?? "").trim();
    if (!scryfallId || !oracleId || !name) continue;
    const quantity = Number.parseInt((cells[qtyIdx] ?? "1").trim(), 10);
    rows.push({
      name,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      finish: (cells[finishIdx] ?? "").trim(),
      setCode: (cells[setIdx] ?? "").trim().toLowerCase(),
      collectorNumber: (cells[collectorIdx] ?? "").trim(),
      scryfallId,
      oracleId,
      dateAdded: (cells[dateIdx] ?? "").trim(),
    });
  }

  if (rows.length === 0) {
    throw new Error("No cards found in that collection export.");
  }
  return rows;
}

/**
 * One stored card per oracle id. When you own several printings, keep the one
 * you have the most copies of, then non-foil over etched over foil.
 */
export function preferPrintings(rows: ArchidektCollectionRow[]): PreferredPrinting[] {
  const byOracle = new Map<string, ArchidektCollectionRow[]>();
  for (const row of rows) {
    const list = byOracle.get(row.oracleId) ?? [];
    list.push(row);
    byOracle.set(row.oracleId, list);
  }

  const preferred: PreferredPrinting[] = [];
  for (const [oracleId, list] of byOracle) {
    const total = list.reduce((sum, row) => sum + row.quantity, 0);
    const byPrinting = new Map<string, ArchidektCollectionRow[]>();
    for (const row of list) {
      const group = byPrinting.get(row.scryfallId) ?? [];
      group.push(row);
      byPrinting.set(row.scryfallId, group);
    }

    let best: ArchidektCollectionRow[] | null = null;
    for (const group of byPrinting.values()) {
      if (!best || comparePrintingGroups(group, best) < 0) best = group;
    }
    const winner = best![0];
    preferred.push({
      oracleId,
      scryfallId: winner.scryfallId,
      name: winner.name,
      quantity: total,
      setCode: winner.setCode,
      collectorNumber: winner.collectorNumber,
      printingCount: byPrinting.size,
    });
  }

  return preferred;
}

function comparePrintingGroups(left: ArchidektCollectionRow[], right: ArchidektCollectionRow[]): number {
  const leftQty = left.reduce((sum, row) => sum + row.quantity, 0);
  const rightQty = right.reduce((sum, row) => sum + row.quantity, 0);
  if (leftQty !== rightQty) return rightQty - leftQty;
  const finish = bestFinish(left) - bestFinish(right);
  if (finish !== 0) return finish;
  return latestDate(right).localeCompare(latestDate(left));
}

function bestFinish(rows: ArchidektCollectionRow[]): number {
  return Math.min(...rows.map((row) => FINISH_RANK[row.finish.toLowerCase()] ?? 9));
}

function latestDate(rows: ArchidektCollectionRow[]): string {
  return rows.reduce((latest, row) => (row.dateAdded > latest ? row.dateAdded : latest), "");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }
  return rows;
}
