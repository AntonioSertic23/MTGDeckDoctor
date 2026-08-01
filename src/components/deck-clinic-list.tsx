"use client";

import Link from "next/link";
import type { Card, DeckAnalysis, DeckWithCards } from "@/domain/types";
import { CardArt } from "@/components/card-art";
import { HealthMeter } from "@/components/health-meter";
import { HEALTH_STATUS_SOFT_BG, cn, formatRelative, healthStatus } from "@/lib/utils";

export function DeckClinicList({
  decks,
  cards,
  scores,
}: {
  decks: DeckWithCards[];
  cards: Map<string, Card>;
  scores: Record<string, DeckAnalysis>;
}) {
  return (
    <ul className="space-y-3">
      {decks.map(({ deck }) => {
        const analysis = scores[deck.id];
        const status = analysis ? healthStatus(analysis.health.overall) : null;
        const commanders = deck.commanderOracleIds
          .map((id) => cards.get(id))
          .filter((c): c is Card => Boolean(c));

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
                        prices={commander.prices}
                        size="md"
                      />
                    ))
                  ) : (
                    <CardArt name="Commander" imageUri={null} size="md" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h3 className="truncate font-semibold text-ink">{deck.name}</h3>
                    <span className="shrink-0 text-xs text-muted">
                      Updated {formatRelative(deck.updatedAt)}
                    </span>
                  </div>
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
  );
}
