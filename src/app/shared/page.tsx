"use client";

import { useMemo, useState } from "react";
import {
  buildMatrix,
  buildSharedCardIndex,
  findConflicts,
  findSharedCards,
} from "@/domain/sharing/shared-cards";
import { useDecksWithCards } from "@/lib/hooks/use-repository";
import { getRepository } from "@/lib/storage";
import { SharedCardList } from "@/components/shared-card-list";
import { Button, EmptyState, PageHeader, Panel } from "@/components/ui";
import { cardEurPrice, cn } from "@/lib/utils";

const DEFAULT_MIN_EUR = 5;

export default function SharedCardsPage() {
  const { decks, cards, inventory, loading, error, refresh } = useDecksWithCards();
  const [query, setQuery] = useState("");
  const [onlyConflicts, setOnlyConflicts] = useState(false);
  const [minEur, setMinEur] = useState(DEFAULT_MIN_EUR);
  const [view, setView] = useState<"list" | "matrix">("list");

  const usage = useMemo(
    () => buildSharedCardIndex(decks, cards, inventory),
    [decks, cards, inventory],
  );

  const shared = useMemo(() => findSharedCards(usage), [usage]);
  const conflicts = useMemo(() => findConflicts(usage), [usage]);

  const filtered = useMemo(() => {
    const base = onlyConflicts ? conflicts : shared;
    const q = query.trim().toLowerCase();
    return base.filter((item) => {
      const eur = cardEurPrice(cards.get(item.oracleId));
      if (minEur > 0 && (eur === null || eur < minEur)) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.deckNames.some((name) => name.toLowerCase().includes(q))
      );
    });
  }, [shared, conflicts, onlyConflicts, query, minEur, cards]);

  const matrix = useMemo(() => buildMatrix(decks, filtered, 2), [decks, filtered]);

  async function setOwned(oracleId: string, quantity: number) {
    await getRepository().setInventoryQuantity(oracleId, quantity);
    await refresh();
  }

  if (loading) return <p className="text-sm text-muted">Checking overlaps…</p>;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;

  if (decks.length < 2) {
    return (
      <div>
        <PageHeader
          eyebrow="Inventory"
          title="Shared cards"
          description="See which physical staples appear in more than one deck — and where your single copy currently needs to be."
        />
        <EmptyState
          title="Need at least two decks"
          description="Import another list to surface contested cards like Rhystic Study and Sol Ring."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Inventory"
        title="Shared cards"
        description={`${shared.length} shared · showing ${filtered.length} with EUR ≥ ${minEur.toFixed(0)} (Cardmarket via Scryfall).`}
      />

      <Panel className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="block min-w-0 flex-1 space-y-1.5">
            <span className="text-xs font-medium text-muted">Search</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search card or deck"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2"
            />
          </label>
          <label className="block w-full space-y-1.5 sm:w-40">
            <span className="text-xs font-medium text-muted">Min EUR</span>
            <input
              type="number"
              min={0}
              step={1}
              value={minEur}
              onChange={(e) => setMinEur(Math.max(0, Number(e.target.value) || 0))}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={minEur === 5 ? "primary" : "secondary"}
              onClick={() => setMinEur(5)}
            >
              ≥ €5
            </Button>
            <Button
              type="button"
              variant={minEur === 0 ? "primary" : "secondary"}
              onClick={() => setMinEur(0)}
            >
              All
            </Button>
            <Button
              type="button"
              variant={onlyConflicts ? "primary" : "secondary"}
              onClick={() => setOnlyConflicts((v) => !v)}
            >
              Conflicts
            </Button>
            <Button
              type="button"
              variant={view === "list" ? "primary" : "secondary"}
              onClick={() => setView("list")}
            >
              List
            </Button>
            <Button
              type="button"
              variant={view === "matrix" ? "primary" : "secondary"}
              onClick={() => setView("matrix")}
            >
              Matrix
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted">
          Prices are Scryfall EUR (Cardmarket). Basics and cheap staples drop out when Min EUR is set.
        </p>
      </Panel>

      {view === "list" ? (
        <Panel>
          <SharedCardList items={filtered} cards={cards} />
          {filtered.length > 0 ? (
            <div className="mt-6 space-y-3 border-t border-[var(--border)] pt-4">
              <h2 className="text-sm font-semibold text-ink">Copies owned (optional)</h2>
              <p className="text-xs text-muted">
                Set a quantity to detect conflicts when decks outnumber physical copies.
              </p>
              <ul className="space-y-2">
                {filtered.slice(0, 12).map((item) => (
                  <li
                    key={item.oracleId}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2"
                  >
                    <span className="min-w-0 truncate text-sm font-medium">{item.name}</span>
                    <label className="flex items-center gap-2 text-xs text-muted">
                      Owned
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={item.copiesOwned}
                        onChange={(e) => void setOwned(item.oracleId, Number(e.target.value) || 0)}
                        className="w-16 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm text-ink outline-none ring-accent focus:ring-2"
                      />
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>
      ) : (
        <Panel className="overflow-x-auto">
          {matrix.rows.length === 0 ? (
            <p className="text-sm text-muted">No shared cards match this filter.</p>
          ) : (
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-[var(--card)] px-2 py-2 font-semibold text-ink">Card</th>
                  {matrix.deckNames.map((name) => (
                    <th key={name} className="px-2 py-2 font-medium text-muted">
                      <span className="inline-block max-w-[5.5rem] truncate align-bottom" title={name}>
                        {name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((row) => (
                  <tr key={row.oracleId} className="border-t border-[var(--border)]">
                    <td className="sticky left-0 bg-[var(--card)] px-2 py-2 font-medium text-ink">
                      {row.name}
                    </td>
                    {row.present.map((on, i) => (
                      <td key={`${row.oracleId}-${matrix.deckIds[i]}`} className="px-2 py-2 text-center">
                        <span
                          className={cn(
                            "inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold",
                            on
                              ? "bg-accent/15 text-accent-strong"
                              : "bg-black/[0.03] text-muted dark:bg-white/[0.04]",
                          )}
                        >
                          {on ? "✓" : "·"}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      )}
    </div>
  );
}
