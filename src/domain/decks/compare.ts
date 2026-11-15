import type { DeckHealth, HealthCategoryId, ResolvedDeckEntry } from "@/domain/types";

export interface CompareRow {
  oracleId: string;
  name: string;
  typeLine: string;
  quantityA: number;
  quantityB: number;
}

export interface DeckComparison {
  onlyA: CompareRow[];
  onlyB: CompareRow[];
  shared: CompareRow[];
  /** Share of A's distinct cards that are also in B, 0–100. */
  overlapPercent: number;
}

export interface CategoryDelta {
  id: HealthCategoryId | "overall";
  label: string;
  scoreA: number;
  scoreB: number;
  /** B − A, rounded. */
  delta: number;
}

/** Card-level diff by oracle id. Lists are sorted by name. */
export function compareDecks(a: ResolvedDeckEntry[], b: ResolvedDeckEntry[]): DeckComparison {
  const mapA = new Map(a.map((entry) => [entry.card.oracleId, entry]));
  const mapB = new Map(b.map((entry) => [entry.card.oracleId, entry]));

  const onlyA: CompareRow[] = [];
  const onlyB: CompareRow[] = [];
  const shared: CompareRow[] = [];

  for (const [oracleId, entry] of mapA) {
    const other = mapB.get(oracleId);
    const row = toRow(entry, entry.quantity, other?.quantity ?? 0);
    (other ? shared : onlyA).push(row);
  }
  for (const [oracleId, entry] of mapB) {
    if (!mapA.has(oracleId)) onlyB.push(toRow(entry, 0, entry.quantity));
  }

  const byName = (x: CompareRow, y: CompareRow) =>
    x.name.localeCompare(y.name, undefined, { sensitivity: "base" });

  return {
    onlyA: onlyA.sort(byName),
    onlyB: onlyB.sort(byName),
    shared: shared.sort(byName),
    overlapPercent: mapA.size === 0 ? 0 : Math.round((shared.length / mapA.size) * 100),
  };
}

/** Overall score first, then every category present in either deck. */
export function compareHealth(a: DeckHealth, b: DeckHealth): CategoryDelta[] {
  const rows: CategoryDelta[] = [
    {
      id: "overall",
      label: "Overall",
      scoreA: a.overall,
      scoreB: b.overall,
      delta: Math.round(b.overall - a.overall),
    },
  ];
  const byIdB = new Map(b.categories.map((category) => [category.id, category]));
  const seen = new Set<HealthCategoryId>();
  for (const category of a.categories) {
    const other = byIdB.get(category.id);
    seen.add(category.id);
    rows.push({
      id: category.id,
      label: category.label,
      scoreA: Math.round(category.score),
      scoreB: Math.round(other?.score ?? 0),
      delta: Math.round((other?.score ?? 0) - category.score),
    });
  }
  for (const category of b.categories) {
    if (seen.has(category.id)) continue;
    rows.push({
      id: category.id,
      label: category.label,
      scoreA: 0,
      scoreB: Math.round(category.score),
      delta: Math.round(category.score),
    });
  }
  return rows;
}

function toRow(entry: ResolvedDeckEntry, quantityA: number, quantityB: number): CompareRow {
  return {
    oracleId: entry.card.oracleId,
    name: entry.card.name,
    typeLine: entry.card.typeLine,
    quantityA,
    quantityB,
  };
}
