import type { InventoryItem } from "@/domain/types";
import type { AggregatedCollectionEntry } from "@/domain/collection/archidekt-csv";

export interface MergeCollectionResult {
  /** Cards to write — only oracle ids not already in inventory. */
  toAdd: InventoryItem[];
  /** Distinct oracle cards from the file that were already owned. */
  skippedExisting: number;
  /** Entries that still need a Scryfall name lookup. */
  pendingNameResolve: AggregatedCollectionEntry[];
}

/**
 * Skip anything already in inventory so a full Archidekt re-export can be
 * uploaded repeatedly without changing existing quantities.
 */
export function mergeCollectionImport(
  entries: AggregatedCollectionEntry[],
  existing: InventoryItem[],
): MergeCollectionResult {
  const owned = new Set(existing.map((item) => item.oracleId));
  const toAdd: InventoryItem[] = [];
  const pendingNameResolve: AggregatedCollectionEntry[] = [];
  let skippedExisting = 0;

  for (const entry of entries) {
    if (entry.needsNameResolve || !entry.oracleId) {
      pendingNameResolve.push(entry);
      continue;
    }

    if (owned.has(entry.oracleId)) {
      skippedExisting += 1;
      continue;
    }

    toAdd.push({ oracleId: entry.oracleId, quantity: entry.quantity });
    owned.add(entry.oracleId);
  }

  return { toAdd, skippedExisting, pendingNameResolve };
}

/**
 * After name resolution, drop cards that were already owned (or already queued).
 */
export function filterResolvedAgainstOwned(
  resolved: InventoryItem[],
  existingOracleIds: Iterable<string>,
): { toAdd: InventoryItem[]; skippedExisting: number } {
  const owned = new Set(existingOracleIds);
  const toAdd: InventoryItem[] = [];
  let skippedExisting = 0;

  for (const item of resolved) {
    if (owned.has(item.oracleId)) {
      skippedExisting += 1;
      continue;
    }
    toAdd.push(item);
    owned.add(item.oracleId);
  }

  return { toAdd, skippedExisting };
}
