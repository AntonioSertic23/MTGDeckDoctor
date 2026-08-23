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
              className={cn(
                "relative block overflow-hidden rounded-2xl border p-3 transition sm:p-4",
                deck.ready
                  ? "border-emerald-500/50 bg-emerald-500/[0.06] shadow-sm shadow-emerald-500/10 hover:border-emerald-500/70 hover:bg-emerald-500/[0.09]"
                  : "border-[var(--border)] hover:border-accent/40 hover:bg-accent/[0.03]",
              )}
            >
              {deck.ready ? (
                <span
                  className="absolute inset-y-0 left-0 w-1 bg-emerald-500"
                  aria-hidden
                />
              ) : null}
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
                    <h3 className="truncate font-semibold text-ink">
                      {deck.name}
                      {deck.ready ? (
                        <span className="ml-2 inline-flex align-middle items-center rounded-full bg-emerald-600/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-200">
                          Ready
                        </span>
                      ) : null}
                    </h3>
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
