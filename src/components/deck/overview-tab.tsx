"use client";

import { useMemo } from "react";
import { deckValue } from "@/domain/decks/value";
import { HealthMeter } from "@/components/health-meter";
import { ProblemList, type CardVisual } from "@/components/problem-list";
import { Panel, SectionTitle, StatChip } from "@/components/ui";
import { ColorPipsChart, ManaCurveChart } from "@/components/deck/deck-charts";
import type { LocalAnalysis } from "@/lib/decks/analyze-local";
import { formatEur } from "@/lib/utils";

export function OverviewTab({
  analysis,
  cardsPending,
  artByName,
  onShowHealth,
}: {
  analysis: LocalAnalysis;
  cardsPending: boolean;
  artByName: Map<string, CardVisual>;
  onShowHealth: () => void;
}) {
  const stats = analysis.analysis.statistics;
  const value = useMemo(() => deckValue(analysis.resolved.entries), [analysis.resolved.entries]);

  return (
    <div className="space-y-4">
      <Panel className="space-y-3">
        <HealthMeter health={analysis.analysis.health} compact />
        <button
          type="button"
          onClick={onShowHealth}
          className="text-sm font-medium text-accent-strong hover:underline"
        >
          See every health category →
        </button>
      </Panel>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <StatChip label="Cards" value={stats.totalCards} />
        <StatChip label="Lands" value={stats.landCount} />
        <StatChip label="Avg MV" value={stats.averageManaValue} />
        <StatChip label="Problems" value={analysis.analysis.problems.length} />
        <StatChip
          label="Value"
          value={cardsPending ? "—" : formatEur(value.totalEur)}
          hint={
            !cardsPending && value.unpricedCards > 0
              ? `${value.unpricedCards} without a price`
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <ManaCurveChart curve={stats.manaCurve} averageManaValue={stats.averageManaValue} />
        </Panel>
        <Panel>
          <ColorPipsChart pips={stats.colorPips} colorIdentity={stats.colorIdentity} />
        </Panel>
      </div>

      <Panel>
        <SectionTitle size="lg" className="mb-3">
          Top problems
        </SectionTitle>
        <ProblemList problems={analysis.analysis.problems.slice(0, 3)} artByName={artByName} />
      </Panel>
    </div>
  );
}
