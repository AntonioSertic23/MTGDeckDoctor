"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { deckContentKey, getCachedOrAnalyzeDeck } from "@/lib/decks/analyze-local";
import { useDecksWithCards } from "@/lib/hooks/use-repository";
import { buildSharedCardIndex, findConflicts, findSharedCards } from "@/domain/sharing/shared-cards";
import { HealthMeter } from "@/components/health-meter";
import { SharedCardList } from "@/components/shared-card-list";
import { CardArt } from "@/components/card-art";
import { buttonClassName, EmptyState, PageHeader, Panel } from "@/components/ui";
import { HEALTH_STATUS_SOFT_BG, cardEurPrice, cn, healthStatus } from "@/lib/utils";
import type { DeckAnalysis } from "@/domain/types";

export default function DashboardPage() {
  const { decks, cards, inventory, loading, error } = useDecksWithCards();
  const [scores, setScores] = useState<Record<string, DeckAnalysis>>({});

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const next: Record<string, DeckAnalysis> = {};
      // Paint cached scores immediately so Home does not flash "Analyzing…".
      for (const deck of decks) {
        const snap = deck.deck.analysisSnapshot;
        if (snap && snap.contentKey === deckContentKey(deck)) {
          next[deck.deck.id] = snap.analysis;
        }
      }
      if (!cancelled) setScores({ ...next });

      for (const deck of decks) {
        if (next[deck.deck.id]) continue;
        try {
          const { analysis } = await getCachedOrAnalyzeDeck(deck);
          next[deck.deck.id] = analysis;
          if (!cancelled) setScores({ ...next });
        } catch {
          // Incomplete card cache — skip until the user re-opens the deck.
        }
      }
    }

    if (decks.length > 0) void run();
    else setScores({});

    return () => {
      cancelled = true;
    };
  }, [decks]);

  const shared = useMemo(() => {
    const usage = buildSharedCardIndex(decks, cards, inventory);
    const allShared = findSharedCards(usage);
    const valuable = allShared.filter((item) => {
      const eur = cardEurPrice(cards.get(item.oracleId));
      return eur !== null && eur >= 5;
    });
    return {
      shared: valuable.slice(0, 5),
      conflicts: findConflicts(usage).filter((item) => {
        const eur = cardEurPrice(cards.get(item.oracleId));
        return eur === null || eur >= 5;
      }),
      sharedCount: allShared.length,
      valuableCount: valuable.length,
    };
  }, [decks, cards, inventory]);

  if (loading) {
    return <p className="text-sm text-muted">Opening the clinic…</p>;
  }

  if (error) {
    return <p className="text-sm text-rose-600">{error}</p>;
  }

  if (decks.length === 0) {
    return (
      <div>
        <PageHeader
          eyebrow="Clinic open"
          title="MTG Deck Doctor"
          description="Take care of your decks. Import a Commander list to get a health report, concrete problems, and shared-card conflicts."
        />
        <EmptyState
          title="No decks on the table"
          description="Paste a plain-text decklist to run the first diagnosis. Everything stays in this browser — no account required."
          action={
            <Link href="/decks/new" className={buttonClassName()}>
              Import your first deck
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Good to see you"
        title="Deck clinic"
        description="Which lists need attention, and which physical cards are fighting for the same slot."
        actions={
          <Link href="/decks/new" className={buttonClassName()}>
            Import deck
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <Panel>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Decks</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums">
            {decks.length}
          </p>
        </Panel>
        <Panel>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Shared ≥ €5</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums">
            {shared.valuableCount}
          </p>
        </Panel>
        <Panel>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Conflicts</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums">
            {shared.conflicts.length}
          </p>
        </Panel>
      </section>

      <Panel>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Your decks</h2>
          <Link href="/decks" className="text-sm font-medium text-accent-strong hover:underline">
            View all
          </Link>
        </div>
        <ul className="space-y-3">
          {decks.map(({ deck }) => {
            const analysis = scores[deck.id];
            const status = analysis ? healthStatus(analysis.health.overall) : null;
            const commanders = deck.commanderOracleIds
              .map((id) => cards.get(id))
              .filter((c): c is NonNullable<typeof c> => Boolean(c));
            return (
              <li key={deck.id}>
                <Link
                  href={`/decks/${deck.id}`}
                  className="block rounded-2xl border border-[var(--border)] p-3 transition hover:border-accent/40 hover:bg-accent/[0.03] sm:p-4"
                >
                  <div className="flex gap-3">
                    <div className="flex shrink-0 gap-2">
                      {commanders.length > 0 ? (
                        commanders.slice(0, 2).map((commander) => (
                          <CardArt
                            key={commander.oracleId}
                            name={commander.name}
                            imageUri={commander.imageUri}
                            size="md"
                          />
                        ))
                      ) : (
                        <CardArt name="Commander" imageUri={null} size="md" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-ink">{deck.name}</h3>
                      <p className="mt-0.5 truncate text-sm text-muted">
                        {commanders.length > 0
                          ? commanders.map((c) => c.name).join(" / ")
                          : "Commander not set"}
                      </p>
                      {status ? (
                        <span
                          className={cn(
                            "mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            HEALTH_STATUS_SOFT_BG[status],
                          )}
                        >
                          {analysis.health.overall}/100
                        </span>
                      ) : (
                        <span className="mt-2 inline-block text-xs text-muted">Analyzing…</span>
                      )}
                      {analysis ? (
                        <div className="mt-3">
                          <HealthMeter health={analysis.health} compact />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Shared staples ≥ €5
          </h2>
          <Link href="/shared" className="text-sm font-medium text-accent-strong hover:underline">
            Shared cards
          </Link>
        </div>
        <SharedCardList
          items={shared.conflicts.length > 0 ? shared.conflicts.slice(0, 5) : shared.shared}
          cards={cards}
        />
      </Panel>
    </div>
  );
}
