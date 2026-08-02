"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useDeckAnalyses } from "@/lib/hooks/use-deck-analyses";
import { useDecksWithCards } from "@/lib/hooks/use-repository";
import { buildSharedCardIndex, findConflicts, findSharedCards } from "@/domain/sharing/shared-cards";
import { SharedCardList } from "@/components/shared-card-list";
import { buttonClassName, EmptyState, PageHeader, Panel, StatChip } from "@/components/ui";
import { HEALTH_STATUS_SOFT_BG, cardEurPrice, cn, healthStatus } from "@/lib/utils";

export default function DashboardPage() {
  const { decks, cards, inventory, loading, error } = useDecksWithCards();
  const scores = useDeckAnalyses(decks);

  const shared = useMemo(() => {
    const usage = buildSharedCardIndex(decks, cards, inventory);
    const allShared = findSharedCards(usage);
    const valuable = allShared.filter((item) => {
      const eur = cardEurPrice(cards.get(item.oracleId));
      return eur !== null && eur >= 5;
    });
    return {
      preview: (findConflicts(usage).length > 0
        ? findConflicts(usage)
        : valuable
      ).slice(0, 4),
      conflicts: findConflicts(usage).filter((item) => {
        const eur = cardEurPrice(cards.get(item.oracleId));
        return eur === null || eur >= 5;
      }),
      sharedCount: allShared.length,
      valuableCount: valuable.length,
    };
  }, [decks, cards, inventory]);

  const clinic = useMemo(() => {
    const analyzed = decks
      .map(({ deck }) => {
        const analysis = scores[deck.id];
        if (!analysis) return null;
        return { deck, analysis, status: healthStatus(analysis.health.overall) };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const overallAvg =
      analyzed.length > 0
        ? Math.round(
            analyzed.reduce((sum, row) => sum + row.analysis.health.overall, 0) / analyzed.length,
          )
        : null;

    const needingAttention = analyzed
      .filter((row) => row.status === "critical" || row.status === "observation" || row.status === "attention")
      .sort((a, b) => a.analysis.health.overall - b.analysis.health.overall);

    const missingCommander = decks.filter((d) => d.deck.commanderOracleIds.length === 0).length;
    const problemCount = analyzed.reduce((sum, row) => sum + row.analysis.problems.length, 0);
    const strongest = [...analyzed].sort(
      (a, b) => b.analysis.health.overall - a.analysis.health.overall,
    )[0];
    const readyCount = decks.filter((d) => d.deck.ready).length;
    const broughtTotal = decks.reduce((sum, d) => sum + d.deck.timesBrought, 0);
    const playedTotal = decks.reduce((sum, d) => sum + d.deck.timesPlayed, 0);

    return {
      analyzedCount: analyzed.length,
      overallAvg,
      needingAttention: needingAttention.slice(0, 4),
      missingCommander,
      problemCount,
      strongest,
      readyCount,
      broughtTotal,
      playedTotal,
    };
  }, [decks, scores]);

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
          description="Paste a plain-text decklist to run the first diagnosis."
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
        eyebrow="Clinic open"
        title="MTG Deck Doctor"
        description="A quick pulse across your collection — open Decks for the full shelf with commander art."
        actions={
          <>
            <Link href="/decks" className={buttonClassName("secondary")}>
              Browse decks
            </Link>
            <Link href="/decks/new" className={buttonClassName()}>
              Import deck
            </Link>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatPanel label="Decks" value={decks.length} hint={`${clinic.readyCount} ready to play`} />
        <StatPanel
          label="Avg health"
          value={clinic.overallAvg ?? "—"}
          hint={clinic.overallAvg !== null ? "/ 100" : "Still analyzing"}
        />
        <StatPanel
          label="Brought / played"
          value={`${clinic.broughtTotal}/${clinic.playedTotal}`}
          hint="Across all lists"
        />
        <StatPanel
          label="Shared ≥ €5"
          value={shared.valuableCount}
          hint={
            shared.conflicts.length > 0
              ? `${shared.conflicts.length} conflict${shared.conflicts.length === 1 ? "" : "s"}`
              : "No conflicts"
          }
        />
      </section>

      {clinic.missingCommander > 0 || clinic.strongest ? (
        <Panel>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Snapshot</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-muted">
            {clinic.strongest ? (
              <li>
                Strongest list:{" "}
                <Link
                  href={`/decks/${clinic.strongest.deck.id}`}
                  className="font-medium text-accent-strong hover:underline"
                >
                  {clinic.strongest.deck.name}
                </Link>{" "}
                ({clinic.strongest.analysis.health.overall}/100)
              </li>
            ) : null}
            {clinic.missingCommander > 0 ? (
              <li>
                {clinic.missingCommander} deck
                {clinic.missingCommander === 1 ? "" : "s"} still missing a commander — set one for
                better diagnosis.
              </li>
            ) : null}
            <li>
              {shared.sharedCount} overlapping staple
              {shared.sharedCount === 1 ? "" : "s"} across your lists.
            </li>
          </ul>
        </Panel>
      ) : null}

      {clinic.needingAttention.length > 0 ? (
        <Panel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
              Needs a checkup
            </h2>
            <Link href="/decks" className="text-sm font-medium text-accent-strong hover:underline">
              All decks
            </Link>
          </div>
          <ul className="space-y-2">
            {clinic.needingAttention.map(({ deck, analysis, status }) => (
              <li key={deck.id}>
                <Link
                  href={`/decks/${deck.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5 transition hover:border-accent/40"
                >
                  <span className="min-w-0 truncate font-medium text-ink">{deck.name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <StatChip label="Problems" value={analysis.problems.length} />
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        HEALTH_STATUS_SOFT_BG[status],
                      )}
                    >
                      {analysis.health.overall}/100
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Shared staples ≥ €5
          </h2>
          <Link href="/shared" className="text-sm font-medium text-accent-strong hover:underline">
            Shared cards
          </Link>
        </div>
        {shared.preview.length > 0 ? (
          <SharedCardList items={shared.preview} cards={cards} />
        ) : (
          <p className="text-sm text-muted">No expensive overlaps yet — import another deck.</p>
        )}
      </Panel>
    </div>
  );
}

function StatPanel({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint: string;
}) {
  return (
    <Panel>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums text-ink">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </Panel>
  );
}
