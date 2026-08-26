import { parseArchidektCollectionCsv } from "@/domain/collection/archidekt-csv";
import {
  filterResolvedAgainstOwned,
  mergeCollectionImport,
} from "@/domain/collection/merge-inventory";
import type { Card, InventoryItem } from "@/domain/types";
import { resolveCardLookups, resolveCardsByOracleIds } from "@/lib/cards/client";
import { getRepository } from "@/lib/storage";

export interface CollectionImportProgress {
  phase: "parse" | "hydrate" | "resolve-names" | "save" | "done";
  message: string;
}

export interface CollectionImportResult {
  added: number;
  skippedExisting: number;
  unresolvedNames: string[];
  ignoredRows: number;
  rowCount: number;
  distinctInFile: number;
}

/**
 * Import an Archidekt collection CSV.
 *
 * Existing inventory rows are left untouched so the same full export can be
 * re-uploaded whenever new cards are added in Archidekt.
 */
export async function importArchidektCollectionCsv(
  csvText: string,
  onProgress?: (progress: CollectionImportProgress) => void,
): Promise<CollectionImportResult> {
  const report = (phase: CollectionImportProgress["phase"], message: string) => {
    onProgress?.({ phase, message });
  };

  report("parse", "Reading Archidekt export…");
  const parsed = parseArchidektCollectionCsv(csvText);
  if (parsed.entries.length === 0) {
    throw new Error("No cards found in that file. Export your collection from Archidekt as CSV.");
  }

  const repo = getRepository();
  const existing = await repo.listInventory();
  const merge = mergeCollectionImport(parsed.entries, existing);

  const ownedIds = new Set(existing.map((item) => item.oracleId));
  for (const item of merge.toAdd) ownedIds.add(item.oracleId);

  let toAdd: InventoryItem[] = [...merge.toAdd];
  let skippedExisting = merge.skippedExisting;
  const unresolvedNames: string[] = [];
  const cardsToCache: Card[] = [];

  if (toAdd.length > 0) {
    report("hydrate", `Loading ${toAdd.length} new card(s) from Scryfall…`);
    const hydrated = await resolveCardsByOracleIds(toAdd.map((item) => item.oracleId));
    cardsToCache.push(...hydrated);
    const found = new Set(hydrated.map((card) => card.oracleId));
    // Keep inventory rows even if art hydrate partially fails — name shows later.
    const missingArt = toAdd.filter((item) => !found.has(item.oracleId));
    if (missingArt.length > 0 && hydrated.length === 0) {
      // Complete Scryfall failure — still allow qty write; list will show oracle ids until retry.
    }
  }

  if (merge.pendingNameResolve.length > 0) {
    report("resolve-names", `Resolving ${merge.pendingNameResolve.length} card(s) by name…`);
    const { cards, notFound } = await resolveCardLookups(
      merge.pendingNameResolve.map((entry) => ({ name: entry.name })),
    );
    cardsToCache.push(...cards);
    unresolvedNames.push(...notFound);

    const byName = new Map<string, Card>();
    for (const card of cards) {
      byName.set(normalize(card.name), card);
      const front = normalize(card.name.split("//")[0] ?? card.name);
      if (!byName.has(front)) byName.set(front, card);
    }

    const resolvedItems: InventoryItem[] = [];
    for (const entry of merge.pendingNameResolve) {
      const card =
        byName.get(normalize(entry.name)) ??
        byName.get(normalize(entry.name.split("//")[0] ?? entry.name));
      if (!card) {
        if (!unresolvedNames.includes(entry.name)) unresolvedNames.push(entry.name);
        continue;
      }
      const existingQty = resolvedItems.find((item) => item.oracleId === card.oracleId);
      if (existingQty) existingQty.quantity += entry.quantity;
      else resolvedItems.push({ oracleId: card.oracleId, quantity: entry.quantity });
    }

    const filtered = filterResolvedAgainstOwned(resolvedItems, ownedIds);
    skippedExisting += filtered.skippedExisting;
    toAdd = [...toAdd, ...filtered.toAdd];
  }

  if (cardsToCache.length > 0) {
    await repo.saveCards(cardsToCache);
  }

  if (toAdd.length > 0) {
    report("save", `Saving ${toAdd.length} card(s) to your collection…`);
    await repo.setInventoryItems(toAdd);
  }

  report("done", "Import finished.");

  return {
    added: toAdd.length,
    skippedExisting,
    unresolvedNames: [...new Set(unresolvedNames)],
    ignoredRows: parsed.ignoredRows.length,
    rowCount: parsed.rowCount,
    distinctInFile: parsed.entries.length,
  };
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}
