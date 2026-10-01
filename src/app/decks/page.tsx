"use client";

import Link from "next/link";
import { useMemo, useTransition } from "react";
import { DeckClinicList } from "@/components/deck-clinic-list";
import { Button, buttonClassName, EmptyState, PageHeader, Panel } from "@/components/ui";
import type { Card, Color, Deck, DeckWithCards } from "@/domain/types";
import { exportDecksToFile } from "@/lib/decks/file-io";
import { useDeckAnalyses } from "@/lib/hooks/use-deck-analyses";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { useDecksWithCards } from "@/lib/hooks/use-repository";

type DeckSort = "name" | "created" | "updated" | "colors";
type ReadyFilter = "all" | "ready" | "not-ready";

const DECK_SORT_KEY = "mtg-deck-doctor:decks-sort";
const DECK_READY_FILTER_KEY = "mtg-deck-doctor:decks-ready-filter";

const COLOR_RANK: Record<Color, number> = { W: 0, U: 1, B: 2, R: 3, G: 4 };

const SORT_OPTIONS: { value: DeckSort; label: string }[] = [
  { value: "name", label: "Alphabetical" },
  { value: "created", label: "Date added" },
  { value: "updated", label: "Last modified" },
  { value: "colors", label: "Colors" },
];

const READY_FILTER_OPTIONS: { value: ReadyFilter; label: string }[] = [
  { value: "all", label: "All decks" },
  { value: "ready", label: "Ready to play" },
  { value: "not-ready", label: "Not ready" },
];

function isDeckSort(value: string): value is DeckSort {
  return value === "name" || value === "created" || value === "updated" || value === "colors";
}

function isReadyFilter(value: string): value is ReadyFilter {
  return value === "all" || value === "ready" || value === "not-ready";
}

function commanderColors(deck: Deck, cards: Map<string, Card>): Color[] {
  const set = new Set<Color>();
  for (const id of deck.commanderOracleIds) {
    const card = cards.get(id);
    if (!card) continue;
    for (const color of card.colorIdentity) set.add(color);
  }
  return [...set].sort((a, b) => COLOR_RANK[a] - COLOR_RANK[b]);
}

function colorSortKey(colors: Color[]): string {
  return `${String(colors.length).padStart(2, "0")}-${colors.join("")}`;
}

function filterDecks(decks: DeckWithCards[], readyFilter: ReadyFilter): DeckWithCards[] {
  if (readyFilter === "all") return decks;
  if (readyFilter === "ready") return decks.filter(({ deck }) => deck.ready);
  return decks.filter(({ deck }) => !deck.ready);
}

function sortDecks(
  decks: DeckWithCards[],
  cards: Map<string, Card>,
  sort: DeckSort,
): DeckWithCards[] {
  const copy = [...decks];
  copy.sort((a, b) => {
    switch (sort) {
      case "name":
        return a.deck.name.localeCompare(b.deck.name, undefined, { sensitivity: "base" });
      case "created":
        return Date.parse(b.deck.createdAt) - Date.parse(a.deck.createdAt);
      case "updated":
        return Date.parse(b.deck.updatedAt) - Date.parse(a.deck.updatedAt);
      case "colors": {
        const byColor = colorSortKey(commanderColors(a.deck, cards)).localeCompare(
          colorSortKey(commanderColors(b.deck, cards)),
        );
        if (byColor !== 0) return byColor;
        return a.deck.name.localeCompare(b.deck.name, undefined, { sensitivity: "base" });
      }
      default:
        return 0;
    }
  });
  return copy;
}

const selectClassName =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2";

export default function DecksPage() {
  const { decks, cards, loading, error } = useDecksWithCards();
  const scores = useDeckAnalyses(decks);
  const [pending, startTransition] = useTransition();
  const [sort, setSort] = usePersistedState(DECK_SORT_KEY, "name", isDeckSort);
  const [readyFilter, setReadyFilter] = usePersistedState(
    DECK_READY_FILTER_KEY,
    "all",
    isReadyFilter,
  );

  const visibleDecks = useMemo(() => {
    const filtered = filterDecks(decks, readyFilter);
    return sortDecks(filtered, cards, sort);
  }, [decks, cards, sort, readyFilter]);

  const emptyAfterFilter = decks.length > 0 && visibleDecks.length === 0;
  const readyFilterLabel =
    READY_FILTER_OPTIONS.find((o) => o.value === readyFilter)?.label ?? "All decks";

  return (
    <div>
      <PageHeader
        eyebrow="Library"
        title="Decks"
        description="Every Commander list with art, health score, and a quick pulse across categories."
        actions={
          <>
            {decks.length > 0 ? (
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => startTransition(async () => exportDecksToFile())}
              >
                Export all
              </Button>
            ) : null}
            <Link href="/decks/new" className={buttonClassName()}>
              Import deck
            </Link>
          </>
        }
      />

      {loading ? <p className="text-sm text-muted">Loading decks…</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {!loading && decks.length === 0 ? (
        <EmptyState
          title="No decks yet"
          description="Import a plain-text Commander list (Archidekt export works) to start the first checkup."
          action={
            <Link href="/decks/new" className={buttonClassName()}>
              Import deck
            </Link>
          }
        />
      ) : null}

      {decks.length > 0 ? (
        <div className="space-y-4">
          <Panel>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <label className="block w-full min-w-0 flex-1 space-y-1.5 sm:max-w-xs">
                <span className="text-xs font-medium text-muted">Sort by</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as DeckSort)}
                  className={selectClassName}
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block w-full min-w-0 flex-1 space-y-1.5 sm:max-w-xs">
                <span className="text-xs font-medium text-muted">Show</span>
                <select
                  value={readyFilter}
                  onChange={(e) => setReadyFilter(e.target.value as ReadyFilter)}
                  className={selectClassName}
                >
                  {READY_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Panel>

          {emptyAfterFilter ? (
            <p className="text-sm text-muted">
              No decks match “{readyFilterLabel}”. Try another filter or import a new list.
            </p>
          ) : (
            <DeckClinicList decks={visibleDecks} cards={cards} scores={scores} />
          )}
        </div>
      ) : null}
    </div>
  );
}
