"use client";

import Link from "next/link";
import { useTransition } from "react";
import { DeckClinicList } from "@/components/deck-clinic-list";
import { Button, buttonClassName, EmptyState, PageHeader, Panel } from "@/components/ui";
import { exportDecksToFile } from "@/lib/decks/file-io";
import { useDeckAnalyses } from "@/lib/hooks/use-deck-analyses";
import { useDecksWithCards } from "@/lib/hooks/use-repository";

export default function DecksPage() {
  const { decks, cards, loading, error } = useDecksWithCards();
  const scores = useDeckAnalyses(decks);
  const [pending, startTransition] = useTransition();

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
        <Panel>
          <DeckClinicList decks={decks} cards={cards} scores={scores} />
        </Panel>
      ) : null}
    </div>
  );
}
