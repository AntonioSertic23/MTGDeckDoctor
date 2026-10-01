import type { Card } from "@/domain/types";
import { cleanCardName } from "@/lib/cards/clean-name";

export type MatchMode = "exact" | "set" | "name";

/**
 * Prefer the printing named in the list (`set` + collector). A name-only hit is
 * only a fallback so a default Scryfall art cannot replace a known printing.
 */
export function pickPrinting(
  entry: { name: string; setCode?: string; collectorNumber?: string },
  cards: Card[],
): { card: Card; mode: MatchMode } | undefined {
  const named = cards.filter((card) => namesMatch(entry.name, card.name));
  if (entry.setCode && entry.collectorNumber) {
    const exact = named.find(
      (card) =>
        card.setCode.toLowerCase() === entry.setCode!.toLowerCase() &&
        card.collectorNumber?.toLowerCase() === entry.collectorNumber!.toLowerCase(),
    );
    if (exact) return { card: exact, mode: "exact" };
  }
  if (entry.setCode) {
    const bySet = named.find((card) => card.setCode.toLowerCase() === entry.setCode!.toLowerCase());
    if (bySet) return { card: bySet, mode: "set" };
  }
  const byName = named[0];
  return byName ? { card: byName, mode: "name" } : undefined;
}

function namesMatch(left: string, right: string): boolean {
  const variants = nameVariants(left);
  return nameVariants(right).some((variant) => variants.includes(variant));
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function nameVariants(name: string): string[] {
  const variants = new Set<string>();
  for (const candidate of [name, cleanCardName(name)]) {
    if (!candidate.trim()) continue;
    const normalized = normalize(candidate);
    variants.add(normalized);
    const front = normalized.split("//")[0]?.trim();
    if (front) variants.add(front);
  }
  return [...variants];
}
