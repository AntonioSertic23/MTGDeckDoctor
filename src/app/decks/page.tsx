"use client";

import Link from "next/link";
import { useMemo, useTransition } from "react";
import { DeckClinicList } from "@/components/deck-clinic-list";
import {
  Button,
  buttonClassName,
  EmptyState,
  PageHeader,
  Panel,
  Select,
  Skeleton,
} from "@/components/ui";
import { sortColors } from "@/domain/decks/sort-entries";
import type { Card, Color, Deck, DeckAnalysis } from "@/domain/types";
import { exportDecksToFile } from "@/lib/decks/file-io";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { useDeckShelf } from "@/lib/hooks/use-repository";

type DeckSort = "name" | "created" | "updated" | "colors";
type ReadyFilter = "all" | "ready" | "not-ready";

const DECK_SORT_KEY = "mtg-deck-doctor:decks-sort";
const DECK_READY_FILTER_KEY = "mtg-deck-doctor:decks-ready-filter";

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
  return sortColors([...set]);
}

function colorSortKey(colors: Color[]): string {
  return `${String(colors.length).padStart(2, "0")}-${colors.join("")}`;
}

function filterDecks(decks: Deck[], readyFilter: ReadyFilter): Deck[] {
  if (readyFilter === "all") return decks;
  if (readyFilter === "ready") return decks.filter((deck) => deck.ready);
  return decks.filter((deck) => !deck.ready);
}

function sortDecks(decks: Deck[], cards: Map<string, Card>, sort: DeckSort): Deck[] {
  const copy = [...decks];
  copy.sort((a, b) => {
    switch (sort) {
      case "name":
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      case "created":
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      case "updated":
        return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
      case "colors": {
        const byColor = colorSortKey(commanderColors(a, cards)).localeCompare(
          colorSortKey(commanderColors(b, cards)),
        );
        if (byColor !== 0) return byColor;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }
      default:
        return 0;
    }
  });
  return copy;
}

export default function DecksPage() {
  const { decks, cards, loading, error } = useDeckShelf();
  const scores = useMemo(() => {
    const next: Record<string, DeckAnalysis> = {};
    for (const deck of decks) {
      if (deck.analysisSnapshot?.analysis) next[deck.id] = deck.analysisSnapshot.analysis;
    }
    return next;
  }, [decks]);
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
            {decks.length > 1 ? (
              <Link href="/decks/compare" className={buttonClassName("secondary")}>
                Compare
              </Link>
            ) : null}
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

      {loading && decks.length === 0 ? (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4" aria-busy aria-label="Loading decks">
          {Array.from({ length: 8 }, (_, index) => (
            <li key={index} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2">
              <Skeleton className="aspect-[5/7] w-full rounded-lg" />
              <Skeleton className="mt-3 h-1.5 w-full" />
              <Skeleton className="mt-3 h-4 w-3/4" />
              <Skeleton className="mt-1.5 h-3 w-1/2" />
            </li>
          ))}
        </ul>
      ) : null}
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
              <Select
                label="Sort by"
                wrapperClassName="flex-1 sm:max-w-xs"
                value={sort}
                onChange={(e) => setSort(e.target.value as DeckSort)}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Select
                label="Show"
                wrapperClassName="flex-1 sm:max-w-xs"
                value={readyFilter}
                onChange={(e) => setReadyFilter(e.target.value as ReadyFilter)}
              >
                {READY_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
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
