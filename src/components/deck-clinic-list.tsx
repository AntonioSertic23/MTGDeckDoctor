"use client";

import Link from "next/link";
import type { Card, Deck, DeckAnalysis } from "@/domain/types";
import { CardArt } from "@/components/card-art";
import { HEALTH_STATUS_BAR, cn, healthStatus } from "@/lib/utils";

export function DeckClinicList({
  decks,
  cards,
  scores,
}: {
  decks: Deck[];
  cards: Map<string, Card>;
  scores: Record<string, DeckAnalysis>;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {decks.map((deck) => {
        const analysis = scores[deck.id];
        const commanders = deck.commanderOracleIds
          .map((id) => cards.get(id))
          .filter((c): c is Card => Boolean(c));

        return (
          <li key={deck.id} className="min-w-0">
            <Link
              href={`/decks/${deck.id}`}
              className={cn(
                "flex h-full flex-col rounded-2xl border bg-[var(--card)] p-2 transition",
                deck.ready
                  ? "border-emerald-400/80 shadow-[0_0_22px_rgba(16,185,129,0.45)]"
                  : "border-[var(--border)] hover:border-accent/40",
              )}
            >
              <div className={cn("grid gap-1.5", commanders.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                {commanders.length > 0 ? (
                  commanders.slice(0, 2).map((commander) => (
                    <CardArt
                      key={commander.oracleId}
                      name={commander.name}
                      imageUri={commander.imageUri}
                      prices={commander.prices}
                      size="fill"
                      className="w-full"
                    />
                  ))
                ) : (
                  <CardArt name="Commander" imageUri={null} size="fill" className="w-full" />
                )}
              </div>

              {analysis ? (
                <ShelfHealth score={analysis.health.overall} />
              ) : (
                <p className="mt-2 text-center text-xs text-muted">No diagnosis yet</p>
              )}

              <div className="mt-2 min-w-0 px-0.5 pb-1">
                <h3 className="truncate font-semibold text-ink">{deck.name}</h3>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted">
                  {commanders.length > 0
                    ? commanders.map((c) => c.name).join(" / ")
                    : "Commander not set"}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ShelfHealth({ score }: { score: number }) {
  const status = healthStatus(score);
  return (
    <div className="mt-2 px-0.5">
      <div className="mb-1 text-right text-xs font-semibold tabular-nums text-ink">{score}/100</div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className={cn("h-full rounded-full", HEALTH_STATUS_BAR[status])}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
