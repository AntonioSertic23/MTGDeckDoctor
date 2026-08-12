"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { DeckClinicList } from "@/components/deck-clinic-list";
import { Button, buttonClassName, EmptyState, PageHeader, Panel } from "@/components/ui";
import type { Card, Color, Deck, DeckWithCards } from "@/domain/types";
import { exportDecksToFile } from "@/lib/decks/file-io";
import { useDeckAnalyses } from "@/lib/hooks/use-deck-analyses";
import { useDecksWithCards } from "@/lib/hooks/use-repository";

type DeckSort = "name" | "created" | "updated" | "colors";

const COLOR_RANK: Record<Color, number> = { W: 0, U: 1, B: 2, R: 3, G: 4 };

const SORT_OPTIONS: { value: DeckSort; label: string }[] = [
  { value: "name", label: "Alphabetical" },
  { value: "created", label: "Date added" },
  { value: "updated", label: "Last modified" },
  { value: "colors", label: "Colors" },
];

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
  // Fewer colours first, then WUBRG order within the same size (mono W → … → 5c).
  return `${String(colors.length).padStart(2, "0")}-${colors.join("")}`;
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

export default function DecksPage() {
  const { decks, cards, loading, error } = useDecksWithCards();
  const scores = useDeckAnalyses(decks);
  const [pending, startTransition] = useTransition();
  const [sort, setSort] = useState<DeckSort>("name");

  const sortedDecks = useMemo(() => sortDecks(decks, cards, sort), [decks, cards, sort]);

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
        <Panel className="space-y-4">
          <label className="block w-full max-w-xs space-y-1.5">
            <span className="text-xs font-medium text-muted">Sort by</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as DeckSort)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <DeckClinicList decks={sortedDecks} cards={cards} scores={scores} />
        </Panel>
      ) : null}
    </div>
  );
}
