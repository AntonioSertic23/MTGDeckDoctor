/**
 * Archidekt collection CSV parser.
 *
 * Exports include Quantity, Name, Scryfall Oracle ID (and many printing fields).
 * Inventory is oracle-level, so foil/normal/printings of the same card are
 * aggregated into one quantity. Foil copies and purchase prices are summed
 * alongside so the collection can be valued per finish.
 */

export interface ArchidektCollectionRow {
  quantity: number;
  name: string;
  oracleId: string | null;
  scryfallId: string | null;
  setCode: string | null;
}

/** One logical card after summing printings / finishes that share an oracle id. */
export interface AggregatedCollectionEntry {
  /** Present when the CSV had a Scryfall Oracle ID. */
  oracleId: string | null;
  name: string;
  quantity: number;
  /** Copies whose Finish is Foil or Etched. */
  foilQuantity: number;
  /** Purchase Price × quantity summed over rows that had one; null if none did. */
  purchaseEur: number | null;
  /** Rows that lacked an oracle id (resolved later by name). */
  needsNameResolve: boolean;
}

export interface ParseArchidektCollectionResult {
  entries: AggregatedCollectionEntry[];
  /** Raw data rows counted (excluding header). */
  rowCount: number;
  ignoredRows: string[];
  /** The file has a Finish and/or Purchase Price column, so details can be stored. */
  hasDetails: boolean;
}

const HEADER_ALIASES: Record<string, keyof MappedColumns> = {
  quantity: "quantity",
  name: "name",
  "scryfall oracle id": "oracleId",
  "scryfall id": "scryfallId",
  "edition code": "setCode",
  finish: "finish",
  "purchase price": "purchasePrice",
};

interface MappedColumns {
  quantity: number;
  name: number;
  oracleId: number;
  scryfallId: number;
  setCode: number;
  finish: number;
  purchasePrice: number;
}

export function parseArchidektCollectionCsv(input: string): ParseArchidektCollectionResult {
  const text = stripBom(input).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { entries: [], rowCount: 0, ignoredRows: [], hasDetails: false };
  }

  const header = rows[0]!.map((cell) => cell.trim());
  const columns = mapColumns(header);
  if (columns.quantity < 0 || columns.name < 0) {
    throw new Error(
      "This does not look like an Archidekt collection export. Expected Quantity and Name columns.",
    );
  }

  const byOracle = new Map<string, AggregatedCollectionEntry>();
  const byNameKey = new Map<string, AggregatedCollectionEntry>();
  const ignoredRows: string[] = [];
  let rowCount = 0;

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i]!;
    if (cells.every((cell) => cell.trim() === "")) continue;
    rowCount += 1;

    const quantity = Number.parseInt(cellAt(cells, columns.quantity).trim(), 10);
    const name = cellAt(cells, columns.name).trim();
    const oracleRaw = cellAt(cells, columns.oracleId).trim();
    const oracleId = isUuid(oracleRaw) ? oracleRaw.toLowerCase() : null;

    if (!name || !Number.isFinite(quantity) || quantity <= 0) {
      ignoredRows.push(cells.join(","));
      continue;
    }

    const foil = isFoilFinish(cellAt(cells, columns.finish));
    const unitPrice = parsePrice(cellAt(cells, columns.purchasePrice));
    const map = oracleId ? byOracle : byNameKey;
    const key = oracleId ?? normalizeName(name);
    const entry =
      map.get(key) ??
      ({
        oracleId,
        name,
        quantity: 0,
        foilQuantity: 0,
        purchaseEur: null,
        needsNameResolve: !oracleId,
      } satisfies AggregatedCollectionEntry);
    entry.quantity += quantity;
    if (foil) entry.foilQuantity += quantity;
    if (unitPrice !== null) entry.purchaseEur = round2((entry.purchaseEur ?? 0) + unitPrice * quantity);
    map.set(key, entry);
  }

  return {
    entries: [...byOracle.values(), ...byNameKey.values()],
    rowCount,
    ignoredRows,
    hasDetails: columns.finish >= 0 || columns.purchasePrice >= 0,
  };
}

/** Split on commas while respecting double-quoted fields (RFC 4180-ish). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
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
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function mapColumns(header: string[]): MappedColumns {
  const columns: MappedColumns = {
    quantity: -1,
    name: -1,
    oracleId: -1,
    scryfallId: -1,
    setCode: -1,
    finish: -1,
    purchasePrice: -1,
  };

  header.forEach((raw, index) => {
    const key = HEADER_ALIASES[raw.trim().toLowerCase()];
    if (key && columns[key] < 0) columns[key] = index;
  });

  return columns;
}

function cellAt(cells: string[], index: number): string {
  if (index < 0) return "";
  return cells[index] ?? "";
}

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Archidekt finishes: Normal, Foil, Etched. Etched is priced like foil. */
export function isFoilFinish(value: string): boolean {
  const finish = value.trim().toLowerCase();
  return finish === "foil" || finish === "etched" || (finish.includes("foil") && !finish.includes("non"));
}

/** "1.50", "1,50", "€1.50" → 1.5. Empty or invalid → null. */
export function parsePrice(value: string): number | null {
  const cleaned = value.trim().replace(/[^0-9.,-]/g, "");
  if (!cleaned) return null;
  // A lone comma is a decimal separator ("1,50"); with a dot present it groups thousands.
  const normalized = cleaned.includes(".") ? cleaned.replace(/,/g, "") : cleaned.replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
