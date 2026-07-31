"use client";

import Link from "next/link";
import { useMemo, useTransition } from "react";
import { useDecksWithCards } from "@/lib/hooks/use-repository";
import { exportDecksToFile } from "@/lib/decks/file-io";
import { Button, buttonClassName, EmptyState, PageHeader, Panel } from "@/components/ui";
import { formatRelative } from "@/lib/utils";

export default function DecksPage() {
  const { decks, cards, loading, error } = useDecksWithCards();
  const [pending, startTransition] = useTransition();

  const rows = useMemo(
    () =>
      decks.map(({ deck }) => {
        const commanders = deck.commanderOracleIds
          .map((id) => cards.get(id)?.name)
          .filter((name): name is string => Boolean(name));
        return { deck, commanders };
      }),
    [decks, cards],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Library"
        title="Decks"
        description="Every Commander list stored in this browser. Export a JSON backup anytime; restore it from Import."
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

      {rows.length > 0 ? (
        <Panel className="p-0 sm:p-0">
          <ul className="divide-y divide-[var(--border)]">
            {rows.map(({ deck, commanders }) => (
              <li key={deck.id}>
                <Link
                  href={`/decks/${deck.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-4 transition hover:bg-black/[0.02] sm:px-5 dark:hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-ink">{deck.name}</h2>
                    <p className="mt-0.5 text-xs text-muted">
                      {commanders.length > 0 ? (
                        <>Commander: {commanders.join(" / ")}</>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-300">Commander not set</span>
                      )}
                      {" · "}
                      Updated {formatRelative(deck.updatedAt)}
                    </p>
                  </div>
                  <span className="text-sm text-accent-strong">Open</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
