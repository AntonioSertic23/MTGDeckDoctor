import type { Color, ResolvedDeckEntry } from "@/domain/types";

export type CardSort = "name" | "manaValue" | "type" | "color" | "price" | "quantity";

export const CARD_SORT_OPTIONS: { value: CardSort; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "manaValue", label: "Mana value" },
  { value: "type", label: "Type" },
  { value: "color", label: "Color" },
  { value: "price", label: "Price (EUR)" },
  { value: "quantity", label: "Quantity" },
];

export function isCardSort(value: string): value is CardSort {
  return CARD_SORT_OPTIONS.some((opt) => opt.value === value);
}

/** WUBRG order. */
export const COLOR_RANK: Record<Color, number> = { W: 0, U: 1, B: 2, R: 3, G: 4 };

export function sortColors(colors: Color[]): Color[] {
  return [...colors].sort((a, b) => COLOR_RANK[a] - COLOR_RANK[b]);
}

/** Card types in the order a decklist is usually read. */
export const TYPE_ORDER = [
  "creature",
  "planeswalker",
  "instant",
  "sorcery",
  "artifact",
  "enchantment",
  "battle",
  "land",
] as const;

export type PrimaryType = (typeof TYPE_ORDER)[number] | "other";

export const PRIMARY_TYPE_LABELS: Record<PrimaryType, string> = {
  creature: "Creatures",
  planeswalker: "Planeswalkers",
  instant: "Instants",
  sorcery: "Sorceries",
  artifact: "Artifacts",
  enchantment: "Enchantments",
  battle: "Battles",
  land: "Lands",
  other: "Other",
};

/** First matching type in `TYPE_ORDER`, so an artifact creature counts as a creature. */
export function primaryType(typeLine: string): PrimaryType {
  const lower = typeLine.toLowerCase();
  for (const type of TYPE_ORDER) {
    if (lower.includes(type)) return type;
  }
  return "other";
}

/** Colorless sorts last; otherwise by color count, then WUBRG. */
export function colorSortKey(colors: Color[]): string {
  if (colors.length === 0) return "99";
  return `${String(colors.length).padStart(2, "0")}-${sortColors(colors).join("")}`;
}

/** Cardmarket EUR price, or null when missing or unparseable. */
export function eurPrice(prices: { eur: string | null } | null | undefined): number | null {
  if (!prices?.eur) return null;
  const value = Number.parseFloat(prices.eur);
  return Number.isFinite(value) ? value : null;
}

function compareName(a: ResolvedDeckEntry, b: ResolvedDeckEntry): number {
  return a.card.name.localeCompare(b.card.name, undefined, { sensitivity: "base" });
}

export function sortDeckEntries(entries: ResolvedDeckEntry[], sort: CardSort): ResolvedDeckEntry[] {
  const copy = [...entries];
  copy.sort((a, b) => {
    // Commanders stay at the top regardless of sort.
    if (a.isCommander !== b.isCommander) return a.isCommander ? -1 : 1;

    switch (sort) {
      case "manaValue": {
        const byMv = a.card.manaValue - b.card.manaValue;
        return byMv !== 0 ? byMv : compareName(a, b);
      }
      case "type": {
        const byType =
          typeIndex(primaryType(a.card.typeLine)) - typeIndex(primaryType(b.card.typeLine));
        return byType !== 0 ? byType : compareName(a, b);
      }
      case "color": {
        const byColor = colorSortKey(a.card.colorIdentity).localeCompare(
          colorSortKey(b.card.colorIdentity),
        );
        return byColor !== 0 ? byColor : compareName(a, b);
      }
      case "price": {
        const pa = eurPrice(a.card.prices) ?? -1;
        const pb = eurPrice(b.card.prices) ?? -1;
        return pb - pa || compareName(a, b);
      }
      case "quantity": {
        const byQty = b.quantity - a.quantity;
        return byQty !== 0 ? byQty : compareName(a, b);
      }
      case "name":
      default:
        return compareName(a, b);
    }
  });
  return copy;
}

function typeIndex(type: PrimaryType): number {
  const index = (TYPE_ORDER as readonly string[]).indexOf(type);
  return index === -1 ? TYPE_ORDER.length : index;
}

/** Groups already-sorted entries by primary type, keeping `TYPE_ORDER`. Commanders get their own group. */
export function groupEntriesByType(
  entries: ResolvedDeckEntry[],
): { id: PrimaryType | "commander"; label: string; entries: ResolvedDeckEntry[] }[] {
  const commanders = entries.filter((entry) => entry.isCommander);
  const byType = new Map<PrimaryType, ResolvedDeckEntry[]>();
  for (const entry of entries) {
    if (entry.isCommander) continue;
    const type = primaryType(entry.card.typeLine);
    const list = byType.get(type) ?? [];
    list.push(entry);
    byType.set(type, list);
  }

  const groups: { id: PrimaryType | "commander"; label: string; entries: ResolvedDeckEntry[] }[] = [];
  if (commanders.length > 0) groups.push({ id: "commander", label: "Commander", entries: commanders });
  for (const type of [...TYPE_ORDER, "other"] as PrimaryType[]) {
    const list = byType.get(type);
    if (list?.length) groups.push({ id: type, label: PRIMARY_TYPE_LABELS[type], entries: list });
  }
  return groups;
}
