/**
 * Archidekt collection CSV parser.
 *
 * Exports include Quantity, Name, Scryfall Oracle ID (and many printing fields).
 * Inventory is oracle-level, so foil/normal/printings of the same card are
 * aggregated into one quantity.
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
  /** Rows that lacked an oracle id (resolved later by name). */
  needsNameResolve: boolean;
}

export interface ParseArchidektCollectionResult {
  entries: AggregatedCollectionEntry[];
  /** Raw data rows counted (excluding header). */
  rowCount: number;
  ignoredRows: string[];
}

const HEADER_ALIASES: Record<string, keyof MappedColumns> = {
  quantity: "quantity",
  name: "name",
  "scryfall oracle id": "oracleId",
  "scryfall id": "scryfallId",
  "edition code": "setCode",
};

interface MappedColumns {
  quantity: number;
  name: number;
  oracleId: number;
  scryfallId: number;
  setCode: number;
}

export function parseArchidektCollectionCsv(input: string): ParseArchidektCollectionResult {
  const text = stripBom(input).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { entries: [], rowCount: 0, ignoredRows: [] };
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

    if (oracleId) {
      const existing = byOracle.get(oracleId);
      if (existing) existing.quantity += quantity;
      else {
        byOracle.set(oracleId, {
          oracleId,
          name,
          quantity,
          needsNameResolve: false,
        });
      }
      continue;
    }

    const key = normalizeName(name);
    const existing = byNameKey.get(key);
    if (existing) existing.quantity += quantity;
    else {
      byNameKey.set(key, {
        oracleId: null,
        name,
        quantity,
        needsNameResolve: true,
      });
    }
  }

  return {
    entries: [...byOracle.values(), ...byNameKey.values()],
    rowCount,
    ignoredRows,
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
