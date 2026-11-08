"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Library, Minus, Plus, Upload, WandSparkles } from "lucide-react";
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
import { fetchCardsBySet } from "@/lib/cards/client";
import {
  importArchidektCollectionCsv,
  type CollectionImportResult,
} from "@/lib/collection/import-collection";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { useInventory } from "@/lib/hooks/use-repository";
import { getRepository } from "@/lib/storage";
import { cardEurPrice, cn, formatCardPrices } from "@/lib/utils";

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
const SET_KEY = "mtg-deck-doctor:collection-set";

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

function isSetFilter(value: string): value is string {
  return value === "all" || /^[a-z0-9]{3,6}$/.test(value);
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
  /** True when this tile is a set checklist gap, not an owned inventory row. */
  missing?: boolean;
}

export default function CollectionPage() {
  const { inventory, cards, loading, error, refresh, setQuantity } = useInventory();
  const fileRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<CardRole | "all">("all");
  const [sort, setSort] = usePersistedState(SORT_KEY, "name", isCollectionSort);
  const [colorFilter, setColorFilter] = usePersistedState(COLOR_KEY, "all", isColorFilter);
  const [typeFilter, setTypeFilter] = usePersistedState(TYPE_KEY, "all", isTypeFilter);
  const [setFilter, setSetFilter] = usePersistedState<string>(SET_KEY, "all", isSetFilter);
  const [showMissing, setShowMissing] = useState(false);
  const [setCards, setSetCards] = useState<Card[]>([]);
  const [loadingSet, setLoadingSet] = useState(false);
  const [setError, setSetError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [lastImport, setLastImport] = useState<CollectionImportResult | null>(null);

  const ownedOracleIds = useMemo(
    () => new Set(inventory.map((item) => item.oracleId)),
    [inventory],
  );

  const setOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of inventory) {
      const code = cards.get(item.oracleId)?.setCode?.trim().toLowerCase();
      if (!code) continue;
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([code, ownedCount]) => ({ code, ownedCount }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [inventory, cards]);

  useEffect(() => {
    if (setFilter !== "all" && !setOptions.some((opt) => opt.code === setFilter)) {
      setSetFilter("all");
      setShowMissing(false);
    }
  }, [setFilter, setOptions, setSetFilter]);

  useEffect(() => {
    if (setFilter === "all") {
      setShowMissing(false);
      setSetCards([]);
      setSetError(null);
      setLoadingSet(false);
    }
  }, [setFilter]);

  useEffect(() => {
    if (!showMissing || setFilter === "all") {
      setSetCards([]);
      setSetError(null);
      setLoadingSet(false);
      return;
    }

    let cancelled = false;
    setLoadingSet(true);
    setSetError(null);
    void fetchCardsBySet(setFilter)
      .then((cardsInSet) => {
        if (cancelled) return;
        setSetCards(cardsInSet);
      })
      .catch((err) => {
        if (cancelled) return;
        setSetCards([]);
        setSetError(err instanceof Error ? err.message : "Could not load that set.");
      })
      .finally(() => {
        if (!cancelled) setLoadingSet(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showMissing, setFilter]);

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
      if (setFilter !== "all") {
        const code = row.card?.setCode?.trim().toLowerCase() ?? "";
        if (code !== setFilter) return false;
      }
      if (!matchesColor(row.card, colorFilter)) return false;
      if (!matchesType(row.card, typeFilter)) return false;
      if (roleFilter !== "all" && !row.roles.includes(roleFilter)) return false;
      if (!q) return true;
      const name = row.card?.name ?? row.item.oracleId;
      return name.toLowerCase().includes(q);
    });

    if (showMissing && setFilter !== "all") {
      for (const card of setCards) {
        if (ownedOracleIds.has(card.oracleId)) continue;
        const roles = classifyCard(card);
        if (!matchesColor(card, colorFilter)) continue;
        if (!matchesType(card, typeFilter)) continue;
        if (roleFilter !== "all" && !roles.includes(roleFilter)) continue;
        if (q && !card.name.toLowerCase().includes(q)) continue;
        list.push({
          item: { oracleId: card.oracleId, quantity: 0 },
          card,
          roles,
          missing: true,
        });
      }
    }

    list.sort((a, b) => {
      if (Boolean(a.missing) !== Boolean(b.missing)) {
        return a.missing ? 1 : -1;
      }
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
  }, [
    rows,
    query,
    colorFilter,
    typeFilter,
    roleFilter,
    sort,
    setFilter,
    showMissing,
    setCards,
    ownedOracleIds,
  ]);

  const totalCopies = useMemo(
    () => inventory.reduce((sum, item) => sum + item.quantity, 0),
    [inventory],
  );

  const missingCount = useMemo(
    () => filtered.reduce((sum, row) => sum + (row.missing ? 1 : 0), 0),
    [filtered],
  );

  async function setOwned(oracleId: string, quantity: number) {
    try {
      await setQuantity(oracleId, quantity);
    } catch {
      // Hook rolls inventory back via refresh; surface nothing extra for a tap.
    }
  }

  async function clearCollection() {
    if (inventory.length === 0 || clearing) return;
    const ok = window.confirm(
      "Delete your entire collection? Owned-card counts will be removed. Deck lists stay. This cannot be undone.",
    );
    if (!ok) return;
    setClearing(true);
    setImportMessage(null);
    try {
      await getRepository().clearInventory();
      await refresh();
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : "Could not delete the collection.");
    } finally {
      setClearing(false);
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
        description="Cards you own. Re-upload an Archidekt CSV to add new cards and replace stored art with the printing in the file."
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
            {inventory.length > 0 ? (
              <Button
                type="button"
                variant="danger"
                disabled={importing || clearing}
                onClick={() => void clearCollection()}
              >
                {clearing ? "Deleting…" : "Delete collection"}
              </Button>
            ) : null}
            <Button
              type="button"
              disabled={importing || clearing}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" aria-hidden />
              {importing ? "Importing…" : "Import CSV"}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatChip label="Unique cards" value={inventory.length} />
        <StatChip label="Total copies" value={totalCopies} />
        <StatChip label="Showing" value={filtered.length} />
        {showMissing && setFilter !== "all" ? (
          <StatChip label="Missing in set" value={missingCount} />
        ) : null}
      </div>

      {(importMessage || lastImport) && (
        <Panel className="space-y-1 text-sm">
          {importMessage ? <p className="text-ink">{importMessage}</p> : null}
          {lastImport ? (
            <p className="text-ink-muted">
              Updated {lastImport.printingsUpdated} printing(s) · added {lastImport.added} · skipped{" "}
              {lastImport.skippedExisting} already owned · {lastImport.rowCount} rows in file
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
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
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
              <label className="block w-full space-y-1.5 sm:w-48">
                <span className="text-xs font-medium text-muted">Set</span>
                <select
                  className={selectClassName}
                  value={setFilter}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSetFilter(next === "all" ? "all" : next.toLowerCase());
                    if (next === "all") setShowMissing(false);
                  }}
                >
                  <option value="all">All sets</option>
                  {setOptions.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.code.toUpperCase()} ({opt.ownedCount})
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex w-full flex-col gap-1.5 sm:w-auto">
                <span className="text-xs font-medium text-muted">Checklist</span>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={setFilter === "all" || loadingSet}
                  onClick={() => setShowMissing((value) => !value)}
                  className="w-full sm:w-auto"
                >
                  {showMissing ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                  {loadingSet
                    ? "Loading set…"
                    : showMissing
                      ? "Hide missing"
                      : "Show missing"}
                </Button>
              </div>
            </div>
            {setError ? <p className="text-sm text-rose-600">{setError}</p> : null}
            {showMissing && setFilter !== "all" && !loadingSet && !setError ? (
              <p className="text-xs text-muted">
                Gray tiles are cards from {setFilter.toUpperCase()} you do not own yet.
              </p>
            ) : null}
          </Panel>

          <div>
            {filtered.length === 0 ? (
              <Panel>
                <p className="py-8 text-center text-sm text-muted">
                  {loadingSet
                    ? "Loading the rest of this set…"
                    : "No cards match these filters."}
                </p>
              </Panel>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
                {filtered.map((row) => (
                  <CollectionCardTile
                    key={`${row.missing ? "missing" : "owned"}-${row.item.oracleId}`}
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
  const missing = Boolean(row.missing);

  return (
    <li className={cn("min-w-0", missing && "opacity-40")}>
      <div
        className={cn(
          "relative overflow-hidden rounded-xl shadow-md ring-1 ring-black/5 dark:ring-white/10",
          missing && "grayscale",
        )}
      >
        <CardArt
          name={name}
          imageUri={row.card?.imageUri}
          prices={row.card?.prices}
          size="fill"
          className="block w-full"
        />
        {missing ? (
          <span className="pointer-events-none absolute right-1.5 top-1.5 z-10 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90 shadow-sm">
            Missing
          </span>
        ) : (
          <span
            className="pointer-events-none absolute right-1.5 top-1.5 z-10 rounded-md bg-black/80 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-white shadow-sm"
            aria-label={`Quantity ${row.item.quantity}`}
          >
            ×{row.item.quantity}
          </span>
        )}
      </div>

      {missing ? (
        <div className="mt-1.5 rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] px-2 py-2 text-center text-[11px] font-medium text-muted">
          Not in collection
        </div>
      ) : (
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
      )}

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
