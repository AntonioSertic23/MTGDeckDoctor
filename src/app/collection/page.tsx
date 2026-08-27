"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Library, Minus, Plus, Upload, WandSparkles } from "lucide-react";
import { CardArt } from "@/components/card-art";
import { Button, buttonClassName, EmptyState, PageHeader, Panel, StatChip } from "@/components/ui";
import { classifyCard } from "@/domain/cards/classifier";
import {
  CARD_ROLE_LABELS,
  type Card,
  type CardRole,
  type Color,
  type InventoryItem,
} from "@/domain/types";
import {
  importArchidektCollectionCsv,
  type CollectionImportResult,
} from "@/lib/collection/import-collection";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { useInventory } from "@/lib/hooks/use-repository";
import { cardEurPrice, formatCardPrices } from "@/lib/utils";

type CollectionSort = "name" | "quantity" | "price" | "manaValue";
type ColorFilter = "all" | Color | "C";
type TypeFilter =
  | "all"
  | "creature"
  | "instant"
  | "sorcery"
  | "artifact"
  | "enchantment"
  | "planeswalker"
  | "land"
  | "other";

const SORT_KEY = "mtg-deck-doctor:collection-sort";
const COLOR_KEY = "mtg-deck-doctor:collection-color";
const TYPE_KEY = "mtg-deck-doctor:collection-type";

const SORT_OPTIONS: { value: CollectionSort; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "quantity", label: "Quantity" },
  { value: "price", label: "Price (EUR)" },
  { value: "manaValue", label: "Mana value" },
];

const COLOR_OPTIONS: { value: ColorFilter; label: string }[] = [
  { value: "all", label: "All colors" },
  { value: "W", label: "White" },
  { value: "U", label: "Blue" },
  { value: "B", label: "Black" },
  { value: "R", label: "Red" },
  { value: "G", label: "Green" },
  { value: "C", label: "Colorless" },
];

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "creature", label: "Creature" },
  { value: "instant", label: "Instant" },
  { value: "sorcery", label: "Sorcery" },
  { value: "artifact", label: "Artifact" },
  { value: "enchantment", label: "Enchantment" },
  { value: "planeswalker", label: "Planeswalker" },
  { value: "land", label: "Land" },
  { value: "other", label: "Other" },
];

const ROLE_FILTER_OPTIONS: CardRole[] = [
  "RAMP",
  "CARD_DRAW",
  "SPOT_REMOVAL",
  "BOARD_WIPE",
  "COUNTERSPELL",
  "TUTOR",
  "PROTECTION",
  "WIN_CONDITION",
  "LAND",
];

const selectClassName =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2";

function isCollectionSort(value: string): value is CollectionSort {
  return value === "name" || value === "quantity" || value === "price" || value === "manaValue";
}

function isColorFilter(value: string): value is ColorFilter {
  return value === "all" || value === "W" || value === "U" || value === "B" || value === "R" || value === "G" || value === "C";
}

function isTypeFilter(value: string): value is TypeFilter {
  return (
    value === "all" ||
    value === "creature" ||
    value === "instant" ||
    value === "sorcery" ||
    value === "artifact" ||
    value === "enchantment" ||
    value === "planeswalker" ||
    value === "land" ||
    value === "other"
  );
}

function matchesType(card: Card | undefined, filter: TypeFilter): boolean {
  if (filter === "all") return true;
  if (!card) return filter === "other";
  const type = card.typeLine.toLowerCase();
  if (filter === "land") return type.includes("land");
  if (filter === "creature") return type.includes("creature");
  if (filter === "instant") return type.includes("instant");
  if (filter === "sorcery") return type.includes("sorcery");
  if (filter === "artifact") return type.includes("artifact");
  if (filter === "enchantment") return type.includes("enchantment");
  if (filter === "planeswalker") return type.includes("planeswalker");
  return !(
    type.includes("land") ||
    type.includes("creature") ||
    type.includes("instant") ||
    type.includes("sorcery") ||
    type.includes("artifact") ||
    type.includes("enchantment") ||
    type.includes("planeswalker")
  );
}

function matchesColor(card: Card | undefined, filter: ColorFilter): boolean {
  if (filter === "all") return true;
  if (!card) return false;
  if (filter === "C") return card.colorIdentity.length === 0;
  return card.colorIdentity.includes(filter);
}

interface CollectionRow {
  item: InventoryItem;
  card: Card | undefined;
  roles: CardRole[];
}

export default function CollectionPage() {
  const { inventory, cards, loading, error, refresh, setQuantity } = useInventory();
  const fileRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<CardRole | "all">("all");
  const [sort, setSort] = usePersistedState(SORT_KEY, "name", isCollectionSort);
  const [colorFilter, setColorFilter] = usePersistedState(COLOR_KEY, "all", isColorFilter);
  const [typeFilter, setTypeFilter] = usePersistedState(TYPE_KEY, "all", isTypeFilter);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [lastImport, setLastImport] = useState<CollectionImportResult | null>(null);

  const rows = useMemo<CollectionRow[]>(() => {
    return inventory.map((item) => {
      const card = cards.get(item.oracleId);
      return {
        item,
        card,
        roles: card ? classifyCard(card) : [],
      };
    });
  }, [inventory, cards]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((row) => {
      if (!matchesColor(row.card, colorFilter)) return false;
      if (!matchesType(row.card, typeFilter)) return false;
      if (roleFilter !== "all" && !row.roles.includes(roleFilter)) return false;
      if (!q) return true;
      const name = row.card?.name ?? row.item.oracleId;
      return name.toLowerCase().includes(q);
    });

    list.sort((a, b) => {
      switch (sort) {
        case "quantity":
          return b.item.quantity - a.item.quantity || compareName(a, b);
        case "price": {
          const pa = cardEurPrice(a.card) ?? -1;
          const pb = cardEurPrice(b.card) ?? -1;
          return pb - pa || compareName(a, b);
        }
        case "manaValue": {
          const ma = a.card?.manaValue ?? -1;
          const mb = b.card?.manaValue ?? -1;
          return ma - mb || compareName(a, b);
        }
        case "name":
        default:
          return compareName(a, b);
      }
    });

    return list;
  }, [rows, query, colorFilter, typeFilter, roleFilter, sort]);

  const totalCopies = useMemo(
    () => inventory.reduce((sum, item) => sum + item.quantity, 0),
    [inventory],
  );

  async function setOwned(oracleId: string, quantity: number) {
    try {
      await setQuantity(oracleId, quantity);
    } catch {
      // Hook rolls inventory back via refresh; surface nothing extra for a tap.
    }
  }

  async function onFileSelected(file: File | null) {
    if (!file) return;
    setImporting(true);
    setImportMessage("Starting import…");
    setLastImport(null);
    try {
      const text = await file.text();
      const result = await importArchidektCollectionCsv(text, (progress) => {
        setImportMessage(progress.message);
      });
      setLastImport(result);
      setImportMessage(null);
      await refresh();
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading collection…</p>;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Inventory"
        title="Collection"
        description="Cards you own. Import an Archidekt CSV anytime — cards already here are skipped so you can re-upload the full export."
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => void onFileSelected(e.target.files?.[0] ?? null)}
            />
            <Link href="/build" className={buttonClassName("secondary")}>
              <WandSparkles className="h-4 w-4" aria-hidden />
              Build deck
            </Link>
            <Button
              type="button"
              disabled={importing}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" aria-hidden />
              {importing ? "Importing…" : "Import CSV"}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatChip label="Unique cards" value={inventory.length} />
        <StatChip label="Total copies" value={totalCopies} />
        <StatChip label="Showing" value={filtered.length} />
      </div>

      {(importMessage || lastImport) && (
        <Panel className="space-y-1 text-sm">
          {importMessage ? <p className="text-ink">{importMessage}</p> : null}
          {lastImport ? (
            <p className="text-ink-muted">
              Added {lastImport.added} · skipped {lastImport.skippedExisting} already owned ·{" "}
              {lastImport.rowCount} rows in file
              {lastImport.unresolvedNames.length > 0
                ? ` · ${lastImport.unresolvedNames.length} unresolved`
                : ""}
              {lastImport.ignoredRows > 0 ? ` · ${lastImport.ignoredRows} ignored` : ""}
            </p>
          ) : null}
          {lastImport && lastImport.unresolvedNames.length > 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Could not resolve: {lastImport.unresolvedNames.slice(0, 8).join(", ")}
              {lastImport.unresolvedNames.length > 8 ? "…" : ""}
            </p>
          ) : null}
        </Panel>
      )}

      {inventory.length === 0 ? (
        <EmptyState
          title="No cards in your collection yet"
          description="Export your collection from Archidekt (CSV) and import it here. Re-import later anytime — existing cards stay as they are."
          action={
            <Button type="button" disabled={importing} onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" aria-hidden />
              Import Archidekt CSV
            </Button>
          }
        />
      ) : (
        <>
          <Panel className="space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <label className="block min-w-0 flex-1 space-y-1.5">
                <span className="text-xs font-medium text-muted">Search</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name"
                  className={selectClassName}
                />
              </label>
              <label className="block w-full space-y-1.5 sm:w-40">
                <span className="text-xs font-medium text-muted">Sort</span>
                <select
                  className={selectClassName}
                  value={sort}
                  onChange={(e) => setSort(e.target.value as CollectionSort)}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block w-full space-y-1.5 sm:w-40">
                <span className="text-xs font-medium text-muted">Color</span>
                <select
                  className={selectClassName}
                  value={colorFilter}
                  onChange={(e) => setColorFilter(e.target.value as ColorFilter)}
                >
                  {COLOR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block w-full space-y-1.5 sm:w-44">
                <span className="text-xs font-medium text-muted">Type</span>
                <select
                  className={selectClassName}
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block w-full space-y-1.5 sm:w-44">
                <span className="text-xs font-medium text-muted">Role</span>
                <select
                  className={selectClassName}
                  value={roleFilter}
                  onChange={(e) =>
                    setRoleFilter(e.target.value === "all" ? "all" : (e.target.value as CardRole))
                  }
                >
                  <option value="all">All roles</option>
                  {ROLE_FILTER_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {CARD_ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Panel>

          <div>
            {filtered.length === 0 ? (
              <Panel>
                <p className="py-8 text-center text-sm text-muted">No cards match these filters.</p>
              </Panel>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
                {filtered.map((row) => (
                  <CollectionCardTile
                    key={row.item.oracleId}
                    row={row}
                    onQuantityChange={(quantity) => void setOwned(row.item.oracleId, quantity)}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <p className="flex items-center gap-2 text-xs text-muted">
        <Library className="h-3.5 w-3.5" aria-hidden />
        Archidekt CSV only for now. Foil and normal printings of the same card count as one oracle entry.
      </p>
    </div>
  );
}

function compareName(a: CollectionRow, b: CollectionRow): number {
  const an = a.card?.name ?? a.item.oracleId;
  const bn = b.card?.name ?? b.item.oracleId;
  return an.localeCompare(bn, undefined, { sensitivity: "base" });
}

function CollectionCardTile({
  row,
  onQuantityChange,
}: {
  row: CollectionRow;
  onQuantityChange: (quantity: number) => void;
}) {
  const name = row.card?.name ?? "Unknown card";
  const price = formatCardPrices(row.card?.prices);
  const roleLabel = row.roles[0] ? CARD_ROLE_LABELS[row.roles[0]] : null;

  return (
    <li className="min-w-0">
      <div className="relative overflow-hidden rounded-xl shadow-md ring-1 ring-black/5 dark:ring-white/10">
        <CardArt
          name={name}
          imageUri={row.card?.imageUri}
          prices={row.card?.prices}
          size="fill"
          className="block w-full"
        />
        <span
          className="pointer-events-none absolute right-1.5 top-1.5 z-10 rounded-md bg-black/80 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-white shadow-sm"
          aria-label={`Quantity ${row.item.quantity}`}
        >
          ×{row.item.quantity}
        </span>
      </div>

      <div
        className="mt-1.5 flex items-center justify-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink transition hover:bg-black/5 dark:hover:bg-white/10"
          aria-label={`Decrease ${name}`}
          onClick={() => onQuantityChange(Math.max(0, row.item.quantity - 1))}
        >
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <span className="min-w-[1.5rem] text-center text-sm font-semibold tabular-nums text-ink">
          {row.item.quantity}
        </span>
        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink transition hover:bg-black/5 dark:hover:bg-white/10"
          aria-label={`Increase ${name}`}
          onClick={() => onQuantityChange(row.item.quantity + 1)}
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="mt-1.5 space-y-0.5 px-0.5">
        <div className="truncate text-sm font-medium leading-snug text-ink" title={name}>
          {name}
        </div>
        <div className="flex items-baseline justify-between gap-2 text-[11px] text-muted">
          <span className="truncate">{row.card?.manaCost || "—"}</span>
          {price ? <span className="shrink-0 tabular-nums">{price}</span> : null}
        </div>
        {roleLabel ? <div className="truncate text-[11px] text-ink-muted">{roleLabel}</div> : null}
      </div>
    </li>
  );
}
