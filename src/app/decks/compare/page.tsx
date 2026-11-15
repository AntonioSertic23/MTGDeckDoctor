"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { compareDecks, compareHealth, type CompareRow } from "@/domain/decks/compare";
import { deckValue } from "@/domain/decks/value";
import { PageHeader, Panel, SectionTitle, Select, Skeleton } from "@/components/ui";
import { useDeck, useDecks } from "@/lib/hooks/use-repository";
import { useDeckAnalysis } from "@/lib/hooks/use-deck-analysis";
import type { LocalAnalysis } from "@/lib/decks/analyze-local";
import { cn, formatEur, HEALTH_STATUS_BAR, healthStatus } from "@/lib/utils";

export default function CompareDecksPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40" />}>
      <CompareDecks />
    </Suspense>
  );
}

function CompareDecks() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const idA = searchParams.get("a") ?? "";
  const idB = searchParams.get("b") ?? "";

  const { decks, loading: decksLoading } = useDecks();
  const { deck: deckA } = useDeck(idA);
  const { deck: deckB } = useDeck(idB);
  const { analysis: analysisA, cardsPending: pendingA } = useDeckAnalysis(idA ? deckA : null);
  const { analysis: analysisB, cardsPending: pendingB } = useDeckAnalysis(idB ? deckB : null);

  function choose(side: "a" | "b", id: string) {
    const query = new URLSearchParams(searchParams.toString());
    if (id) query.set(side, id);
    else query.delete(side);
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  }

  const ready =
    analysisA && analysisB && !pendingA && !pendingB && idA && idB && idA !== idB;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Compare"
        title="Compare decks"
        description="Side-by-side health and the cards that differ between two lists."
      />

      <Panel>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["a", "b"] as const).map((side) => (
            <Select
              key={side}
              label={side === "a" ? "Deck A" : "Deck B"}
              value={side === "a" ? idA : idB}
              disabled={decksLoading}
              onChange={(event) => choose(side, event.target.value)}
            >
              <option value="">Choose a deck…</option>
              {decks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.name}
                </option>
              ))}
            </Select>
          ))}
        </div>
        {idA && idB && idA === idB ? (
          <p className="mt-3 text-sm text-muted">Pick two different decks.</p>
        ) : null}
      </Panel>

      {!idA || !idB ? (
        <p className="text-sm text-muted">Choose two decks to compare.</p>
      ) : !ready ? (
        idA === idB ? null : (
          <div className="space-y-3" aria-busy>
            <Skeleton className="h-56" />
            <Skeleton className="h-72" />
          </div>
        )
      ) : (
        <Comparison
          a={analysisA}
          b={analysisB}
          nameA={deckA?.deck.name ?? "Deck A"}
          nameB={deckB?.deck.name ?? "Deck B"}
          idA={idA}
          idB={idB}
        />
      )}
    </div>
  );
}

function Comparison({
  a,
  b,
  nameA,
  nameB,
  idA,
  idB,
}: {
  a: LocalAnalysis;
  b: LocalAnalysis;
  nameA: string;
  nameB: string;
  idA: string;
  idB: string;
}) {
  const health = useMemo(
    () => compareHealth(a.analysis.health, b.analysis.health),
    [a.analysis.health, b.analysis.health],
  );
  const cards = useMemo(
    () => compareDecks(a.resolved.entries, b.resolved.entries),
    [a.resolved.entries, b.resolved.entries],
  );
  const valueA = useMemo(() => deckValue(a.resolved.entries), [a.resolved.entries]);
  const valueB = useMemo(() => deckValue(b.resolved.entries), [b.resolved.entries]);
  const statsA = a.analysis.statistics;
  const statsB = b.analysis.statistics;

  return (
    <div className="space-y-4">
      <Panel>
        <SectionTitle className="mb-4">Health</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="pb-2 font-medium">
                  Category
                </th>
                <th scope="col" className="pb-2 font-medium">
                  <Link href={`/decks/${idA}`} className="hover:underline">
                    {nameA}
                  </Link>
                </th>
                <th scope="col" className="pb-2 font-medium">
                  <Link href={`/decks/${idB}`} className="hover:underline">
                    {nameB}
                  </Link>
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  B − A
                </th>
              </tr>
            </thead>
            <tbody>
              {health.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-t border-[var(--border)]",
                    row.id === "overall" && "font-semibold",
                  )}
                >
                  <th scope="row" className="py-2 pr-3 text-left font-medium text-ink">
                    {row.label}
                  </th>
                  <td className="py-2 pr-3">
                    <ScoreCell score={row.scoreA} />
                  </td>
                  <td className="py-2 pr-3">
                    <ScoreCell score={row.scoreB} />
                  </td>
                  <td
                    className={cn(
                      "py-2 text-right tabular-nums",
                      row.delta > 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : row.delta < 0
                          ? "text-rose-700 dark:text-rose-400"
                          : "text-muted",
                    )}
                  >
                    {row.delta > 0 ? `+${row.delta}` : row.delta === 0 ? "±0" : row.delta}
                  </td>
                </tr>
              ))}
              <StatRow label="Cards" a={statsA.totalCards} b={statsB.totalCards} />
              <StatRow label="Lands" a={statsA.landCount} b={statsB.landCount} />
              <StatRow label="Avg MV" a={statsA.averageManaValue} b={statsB.averageManaValue} />
              <StatRow
                label="Value"
                a={valueA.totalEur}
                b={valueB.totalEur}
                format={formatEur}
              />
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <SectionTitle
          className="mb-4"
          description={`${cards.shared.length} cards in common · ${cards.overlapPercent}% of ${nameA} also appears in ${nameB}.`}
        >
          Cards
        </SectionTitle>
        <div className="grid gap-4 md:grid-cols-3">
          <CardColumn title={`Only in ${nameA}`} rows={cards.onlyA} quantity={(r) => r.quantityA} />
          <CardColumn title={`Only in ${nameB}`} rows={cards.onlyB} quantity={(r) => r.quantityB} />
          <CardColumn
            title="In both"
            rows={cards.shared}
            quantity={(r) =>
              r.quantityA === r.quantityB ? r.quantityA : `${r.quantityA} / ${r.quantityB}`
            }
          />
        </div>
      </Panel>
    </div>
  );
}

function ScoreCell({ score }: { score: number }) {
  const status = healthStatus(score);
  return (
    <span className="flex items-center gap-2">
      <span className="w-7 shrink-0 tabular-nums text-ink">{score}</span>
      <span className="h-1.5 w-full max-w-24 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <span
          className={cn("block h-full rounded-full", HEALTH_STATUS_BAR[status])}
          style={{ width: `${score}%` }}
        />
      </span>
    </span>
  );
}

function StatRow({
  label,
  a,
  b,
  format = (value: number) => String(value),
}: {
  label: string;
  a: number;
  b: number;
  format?: (value: number) => string;
}) {
  const delta = Math.round((b - a) * 100) / 100;
  return (
    <tr className="border-t border-[var(--border)] text-muted">
      <th scope="row" className="py-2 pr-3 text-left font-medium">
        {label}
      </th>
      <td className="py-2 pr-3 tabular-nums">{format(a)}</td>
      <td className="py-2 pr-3 tabular-nums">{format(b)}</td>
      <td className="py-2 text-right tabular-nums">
        {delta > 0 ? `+${format(delta)}` : delta === 0 ? "±0" : format(delta)}
      </td>
    </tr>
  );
}

function CardColumn({
  title,
  rows,
  quantity,
}: {
  title: string;
  rows: CompareRow[];
  quantity: (row: CompareRow) => number | string;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-[var(--border)] p-3">
      <h3 className="mb-2 truncate text-sm font-semibold text-ink" title={title}>
        {title} <span className="font-normal tabular-nums text-muted">({rows.length})</span>
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">None.</p>
      ) : (
        <ul className="max-h-96 space-y-1 overflow-y-auto pr-1 text-sm">
          {rows.map((row) => (
            <li key={row.oracleId} className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-ink" title={row.typeLine}>
                {row.name}
              </span>
              <span className="shrink-0 tabular-nums text-muted">{quantity(row)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
